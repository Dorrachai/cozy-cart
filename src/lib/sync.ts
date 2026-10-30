import { decryptPayload, encryptPayload } from './crypto';
import type { EncryptedEnvelope, RoomCredentials } from '../types/shopping';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export function isCloudSyncConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

type CollectionName = 'households' | 'lists';

interface BusMessage {
  collection: CollectionName;
  docId: string;
}

const LOCAL_ENVELOPE_PREFIX = 'cozycart:env:';
const bus: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cozycart-e2ee-bus') : null;
const localListeners = new Map<string, Set<() => void>>();

if (bus) {
  bus.onmessage = (ev: MessageEvent<BusMessage>) => {
    if (!ev.data?.collection || !ev.data?.docId) return;
    const key = `${ev.data.collection}/${ev.data.docId}`;
    localListeners.get(key)?.forEach((fn) => fn());
  };
}

function readLocalEnvelope(collection: CollectionName, docId: string): EncryptedEnvelope | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_ENVELOPE_PREFIX}${collection}/${docId}`);
    if (!raw) return null;
    return JSON.parse(raw) as EncryptedEnvelope;
  } catch {
    return null;
  }
}

function writeLocalEnvelope(
  collection: CollectionName,
  docId: string,
  env: EncryptedEnvelope
): void {
  try {
    localStorage.setItem(`${LOCAL_ENVELOPE_PREFIX}${collection}/${docId}`, JSON.stringify(env));
    bus?.postMessage({ collection, docId } satisfies BusMessage);
  } catch {
    // Ignore storage quota errors
  }
}

function removeLocalEnvelope(collection: CollectionName, docId: string): void {
  try {
    localStorage.removeItem(`${LOCAL_ENVELOPE_PREFIX}${collection}/${docId}`);
    bus?.postMessage({ collection, docId } satisfies BusMessage);
  } catch {
    // Ignore
  }
}

// Lazy-loaded Firebase singleton so Firebase (~45 KB) never blocks initial UI render
let firebaseContextPromise: Promise<{
  db: import('firebase/firestore').Firestore;
  firestoreMod: typeof import('firebase/firestore');
}> | null = null;

async function getFirebaseContext() {
  if (!isCloudSyncConfigured()) {
    throw new Error('Firebase is not configured');
  }
  if (!firebaseContextPromise) {
    firebaseContextPromise = (async () => {
      const [{ initializeApp, getApps }, { getAuth, signInAnonymously }, firestoreMod] =
        await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);

      const app =
        getApps()[0] ??
        initializeApp({
          apiKey: FIREBASE_CONFIG.apiKey,
          authDomain: FIREBASE_CONFIG.authDomain,
          projectId: FIREBASE_CONFIG.projectId,
          storageBucket: FIREBASE_CONFIG.storageBucket,
          messagingSenderId: FIREBASE_CONFIG.messagingSenderId,
          appId: FIREBASE_CONFIG.appId,
        });

      const auth = getAuth(app);
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const db = firestoreMod.getFirestore(app);
      return { db, firestoreMod };
    })();
  }
  return firebaseContextPromise;
}

/**
 * Reads and decrypts a document once (from Firestore if configured, otherwise local encrypted bus).
 */
export async function fetchEncryptedDoc<T>(
  collection: CollectionName,
  creds: RoomCredentials
): Promise<T | null> {
  if (isCloudSyncConfigured()) {
    const { db, firestoreMod } = await getFirebaseContext();
    const ref = firestoreMod.doc(db, collection, creds.docId);
    const snap = await firestoreMod.getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as EncryptedEnvelope;
    writeLocalEnvelope(collection, creds.docId, { ct: data.ct, iv: data.iv, rev: data.rev });
    return decryptPayload<T>(data.ct, data.iv, creds.aesKey);
  }

  const localEnv = readLocalEnvelope(collection, creds.docId);
  if (!localEnv) return null;
  return decryptPayload<T>(localEnv.ct, localEnv.iv, creds.aesKey);
}

/**
 * Atomically reads remote ciphertext, decrypts, runs deterministic LWW-CRDT merge,
 * re-encrypts with a fresh 96-bit IV, and commits monotonic `rev + 1`.
 */
export async function upsertEncryptedDoc<T>(
  collection: CollectionName,
  creds: RoomCredentials,
  localState: T,
  mergeFn: (local: T, remote: T) => T
): Promise<T> {
  if (isCloudSyncConfigured()) {
    const { db, firestoreMod } = await getFirebaseContext();
    const ref = firestoreMod.doc(db, collection, creds.docId);

    const committed = await firestoreMod.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        const { ct, iv } = await encryptPayload(localState, creds.aesKey);
        tx.set(ref, {
          ct,
          iv,
          rev: 1,
          updatedAt: firestoreMod.serverTimestamp(),
        });
        return { state: localState, ct, iv, rev: 1 };
      }

      const env = snap.data() as EncryptedEnvelope;
      let merged = localState;
      try {
        const remoteState = await decryptPayload<T>(env.ct, env.iv, creds.aesKey);
        merged = mergeFn(localState, remoteState);
      } catch {
        // Should never happen for matching key; preserve localState
      }

      const nextRev = (typeof env.rev === 'number' ? env.rev : 0) + 1;
      const { ct, iv } = await encryptPayload(merged, creds.aesKey);
      tx.update(ref, {
        ct,
        iv,
        rev: nextRev,
        updatedAt: firestoreMod.serverTimestamp(),
      });
      return { state: merged, ct, iv, rev: nextRev };
    });

    writeLocalEnvelope(collection, creds.docId, {
      ct: committed.ct,
      iv: committed.iv,
      rev: committed.rev,
    });
    return committed.state;
  }

  // Local encrypted envelope + BroadcastChannel mode (allows multi-tab Friend Code testing with zero config)
  const existing = readLocalEnvelope(collection, creds.docId);
  let merged = localState;
  let nextRev = 1;
  if (existing) {
    try {
      const remoteState = await decryptPayload<T>(existing.ct, existing.iv, creds.aesKey);
      merged = mergeFn(localState, remoteState);
    } catch {
      // Ignore
    }
    nextRev = (existing.rev ?? 0) + 1;
  }
  const { ct, iv } = await encryptPayload(merged, creds.aesKey);
  writeLocalEnvelope(collection, creds.docId, { ct, iv, rev: nextRev });
  return merged;
}

/**
 * Subscribes to live encrypted updates for a Household or Single List document.
 */
export function subscribeEncryptedDoc<T>(
  collection: CollectionName,
  creds: RoomCredentials,
  onRemoteState: (decrypted: T) => void,
  onError?: (err: unknown) => void
): () => void {
  let cancelled = false;
  let unsubFirestore: (() => void) | null = null;

  const key = `${collection}/${creds.docId}`;
  const handleLocalBus = async () => {
    if (cancelled) return;
    const env = readLocalEnvelope(collection, creds.docId);
    if (!env) return;
    try {
      const dec = await decryptPayload<T>(env.ct, env.iv, creds.aesKey);
      if (!cancelled) onRemoteState(dec);
    } catch (err) {
      onError?.(err);
    }
  };

  const set = localListeners.get(key) ?? new Set<() => void>();
  set.add(handleLocalBus);
  localListeners.set(key, set);

  if (isCloudSyncConfigured()) {
    getFirebaseContext()
      .then(({ db, firestoreMod }) => {
        if (cancelled) return;
        const ref = firestoreMod.doc(db, collection, creds.docId);
        unsubFirestore = firestoreMod.onSnapshot(
          ref,
          async (snap) => {
            if (cancelled || !snap.exists()) return;
            const env = snap.data() as EncryptedEnvelope;
            try {
              const dec = await decryptPayload<T>(env.ct, env.iv, creds.aesKey);
              if (!cancelled) onRemoteState(dec);
            } catch (err) {
              onError?.(err);
            }
          },
          (err) => {
            if (!cancelled) onError?.(err);
          }
        );
      })
      .catch((err) => {
        if (!cancelled) onError?.(err);
      });
  }

  return () => {
    cancelled = true;
    unsubFirestore?.();
    const listeners = localListeners.get(key);
    if (listeners) {
      listeners.delete(handleLocalBus);
      if (listeners.size === 0) localListeners.delete(key);
    }
  };
}

/**
 * Deletes an encrypted document from cloud (and local cache) if user requests permanent deletion.
 */
export async function deleteEncryptedDoc(
  collection: CollectionName,
  creds: RoomCredentials
): Promise<void> {
  removeLocalEnvelope(collection, creds.docId);
  if (isCloudSyncConfigured()) {
    const { db, firestoreMod } = await getFirebaseContext();
    const ref = firestoreMod.doc(db, collection, creds.docId);
    await firestoreMod.deleteDoc(ref);
  }
}
