import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  categorizeItem,
  ensureCategorizerLoaded,
  normalizeGroceryTerm,
  parseItemInput,
} from '../lib/categorizer';
import { parsePastedChecklist } from '../lib/checklist';
import { mergeHouseholdIndexes, mergeLists } from '../lib/crdt';
import {
  deriveRoomCredentials,
  extractFriendCodeFromInput,
  generateFriendCode,
  normalizeFriendCode,
  parseInviteHash,
} from '../lib/crypto';
import { sanitizeHouseholdIndex, sanitizeShoppingList } from '../lib/sanitize';
import {
  deleteEncryptedDoc,
  fetchEncryptedDoc,
  isCloudSyncConfigured,
  subscribeEncryptedDoc,
  upsertEncryptedDoc,
} from '../lib/sync';
import type {
  CategoryId,
  HouseholdIndex,
  RoomCredentials,
  ShoppingItem,
  ShoppingList,
  SyncMode,
} from '../types/shopping';

const SESSION_KEY = 'cozycart:state:v1';
export const MAX_LIST_TITLE_LENGTH = 60;
export const MAX_ITEM_NAME_LENGTH = 100;

interface PersistedSession {
  householdCode: string;
  householdIndex: HouseholdIndex;
  listsByCode: Record<string, ShoppingList>;
  guestListCodes: string[];
  activeListCode: string;
}

function getDefaultStarterTitle(): { title: string; emoji: string } {
  const now = new Date();
  const monthYear = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(now);
  const month = now.getMonth();
  const seasonalEmojis = ['❄️', '❄️', '🌱', '🌷', '🌸', '🍓', '☀️', '🍉', '🍂', '🎃', '🍂', '🎄'];
  return {
    title: monthYear,
    emoji: seasonalEmojis[month] ?? '🛒',
  };
}

function makeShortId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 12);
}

function sanitizeListTitle(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LIST_TITLE_LENGTH);
  return trimmed || 'Shopping List';
}

function createInitialSession(): PersistedSession {
  const now = Date.now();
  const householdCode = generateFriendCode('household');
  const starterListCode = generateFriendCode('list');
  const listId = makeShortId();
  const { title, emoji } = getDefaultStarterTitle();

  const starterList: ShoppingList = {
    id: listId,
    listCode: starterListCode,
    title,
    emoji,
    createdAt: now,
    updatedAt: now,
    items: {},
  };

  const householdIndex: HouseholdIndex = {
    version: 1,
    householdName: 'Our Household',
    updatedAt: now,
    lists: {
      [listId]: {
        id: listId,
        listCode: starterListCode,
        title,
        emoji,
        createdAt: now,
        updatedAt: now,
      },
    },
    learnedCategories: {},
  };

  return {
    householdCode,
    householdIndex,
    listsByCode: { [starterListCode]: starterList },
    guestListCodes: [],
    activeListCode: starterListCode,
  };
}

function mergeSafeHousehold(local: HouseholdIndex, remoteRaw: unknown): HouseholdIndex {
  const cleanRemote = sanitizeHouseholdIndex(remoteRaw);
  return cleanRemote ? mergeHouseholdIndexes(local, cleanRemote) : local;
}

function makeSafeListMerger(pinnedCode: string) {
  return (local: ShoppingList, remoteRaw: unknown): ShoppingList => {
    const cleanRemote = sanitizeShoppingList(remoteRaw, pinnedCode);
    return cleanRemote ? mergeLists(local, cleanRemote) : local;
  };
}

function loadSession(): PersistedSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return createInitialSession();
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (!parsed?.householdCode || !parsed?.householdIndex || !parsed?.listsByCode) {
      return createInitialSession();
    }

    const safeHouseholdCode = normalizeFriendCode(parsed.householdCode);
    if (!safeHouseholdCode.startsWith('H-')) {
      return createInitialSession();
    }

    const safeIndex = sanitizeHouseholdIndex(parsed.householdIndex);
    if (!safeIndex) {
      return createInitialSession();
    }

    const safeListsByCode: Record<string, ShoppingList> = {};
    for (const [code, listVal] of Object.entries(parsed.listsByCode)) {
      try {
        const normCode = normalizeFriendCode(code);
        if (!normCode.startsWith('L-')) continue;
        const cleanList = sanitizeShoppingList(listVal, normCode);
        if (cleanList) {
          safeListsByCode[normCode] = cleanList;
        }
      } catch {
        // Drop tampered local list entries
      }
    }

    const safeGuestCodes: string[] = [];
    if (Array.isArray(parsed.guestListCodes)) {
      for (const g of parsed.guestListCodes) {
        try {
          const normG = normalizeFriendCode(String(g));
          if (normG.startsWith('L-') && !safeGuestCodes.includes(normG)) {
            safeGuestCodes.push(normG);
          }
        } catch {
          // Drop invalid guest codes
        }
      }
    }

    // Ensure at least one valid list exists
    if (Object.keys(safeIndex.lists).length === 0 && safeGuestCodes.length === 0) {
      return createInitialSession();
    }

    let safeActiveCode = '';
    if (typeof parsed.activeListCode === 'string') {
      try {
        const candidate = normalizeFriendCode(parsed.activeListCode);
        if (candidate.startsWith('L-')) safeActiveCode = candidate;
      } catch {
        // Fallback below
      }
    }
    if (!safeActiveCode) {
      safeActiveCode =
        Object.values(safeIndex.lists)[0]?.listCode ??
        safeGuestCodes[0] ??
        Object.keys(safeListsByCode)[0] ??
        '';
    }
    if (!safeActiveCode) {
      return createInitialSession();
    }

    return {
      householdCode: safeHouseholdCode,
      householdIndex: safeIndex,
      listsByCode: safeListsByCode,
      guestListCodes: safeGuestCodes,
      activeListCode: safeActiveCode,
    };
  } catch {
    return createInitialSession();
  }
}

export function useHouseholdStore() {
  const [session, setSession] = useState<PersistedSession>(() => loadSession());
  const [categorizerReady, setCategorizerReady] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>(() =>
    isCloudSyncConfigured() ? 'connecting' : 'local'
  );
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const credsCacheRef = useRef(new Map<string, Promise<RoomCredentials>>());
  const syncTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
  }, []);

  useEffect(() => {
    if (!statusToast) return;
    const t = setTimeout(() => setStatusToast(null), 3200);
    return () => clearTimeout(t);
  }, [statusToast]);

  // Persist local session snapshot
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Ignore quota errors
    }
  }, [session]);

  // Load Open Food Facts + Fuse.js multilingual taxonomy
  useEffect(() => {
    ensureCategorizerLoaded().then(() => setCategorizerReady(true));
  }, []);

  const getCreds = useCallback((code: string): Promise<RoomCredentials> => {
    const norm = normalizeFriendCode(code);
    let p = credsCacheRef.current.get(norm);
    if (!p) {
      p = deriveRoomCredentials(norm);
      credsCacheRef.current.set(norm, p);
    }
    return p;
  }, []);

  const scheduleHouseholdPush = useCallback(
    (code: string, nextIndex: HouseholdIndex) => {
      const key = `H:${code}`;
      const prev = syncTimersRef.current.get(key);
      if (prev) clearTimeout(prev);

      const timer = setTimeout(async () => {
        try {
          const creds = await getCreds(code);
          const merged = await upsertEncryptedDoc(
            'households',
            creds,
            nextIndex,
            mergeSafeHousehold
          );
          setSession((curr) =>
            curr.householdCode === code
              ? { ...curr, householdIndex: mergeSafeHousehold(curr.householdIndex, merged) }
              : curr
          );
          if (isCloudSyncConfigured()) setSyncMode('synced');
        } catch {
          if (isCloudSyncConfigured()) setSyncMode('error');
        }
      }, 280);
      syncTimersRef.current.set(key, timer);
    },
    [getCreds]
  );

  const scheduleListPush = useCallback(
    (listCode: string, nextList: ShoppingList) => {
      const key = `L:${listCode}`;
      const prev = syncTimersRef.current.get(key);
      if (prev) clearTimeout(prev);

      const timer = setTimeout(async () => {
        try {
          const creds = await getCreds(listCode);
          const safeMerger = makeSafeListMerger(creds.normalized);
          const merged = await upsertEncryptedDoc('lists', creds, nextList, safeMerger);
          setSession((curr) => {
            const existing = curr.listsByCode[listCode];
            if (!existing) return curr;
            return {
              ...curr,
              listsByCode: {
                ...curr.listsByCode,
                [listCode]: safeMerger(existing, merged),
              },
            };
          });
          if (isCloudSyncConfigured()) setSyncMode('synced');
        } catch {
          if (isCloudSyncConfigured()) setSyncMode('error');
        }
      }, 280);
      syncTimersRef.current.set(key, timer);
    },
    [getCreds]
  );

  // Subscribe to active Household document
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let active = true;
    const hCode = session.householdCode;

    getCreds(hCode)
      .then(async (creds) => {
        if (!active) return;
        // Initial push/pull convergence so new households seed their encrypted doc
        const merged = await upsertEncryptedDoc(
          'households',
          creds,
          sessionRef.current.householdIndex,
          mergeSafeHousehold
        );
        if (!active) return;
        setSession((curr) =>
          curr.householdCode === hCode
            ? { ...curr, householdIndex: mergeSafeHousehold(curr.householdIndex, merged) }
            : curr
        );
        if (isCloudSyncConfigured()) setSyncMode('synced');

        unsub = subscribeEncryptedDoc<unknown>(
          'households',
          creds,
          (remoteIndexRaw) => {
            const cleanRemote = sanitizeHouseholdIndex(remoteIndexRaw);
            if (!cleanRemote) return;
            setSession((curr) => {
              if (curr.householdCode !== hCode) return curr;
              return {
                ...curr,
                householdIndex: mergeHouseholdIndexes(curr.householdIndex, cleanRemote),
              };
            });
            if (isCloudSyncConfigured()) setSyncMode('synced');
          },
          () => {
            if (isCloudSyncConfigured()) setSyncMode('error');
          }
        );
      })
      .catch(() => {
        if (isCloudSyncConfigured()) setSyncMode('error');
      });

    return () => {
      active = false;
      unsub?.();
    };
  }, [session.householdCode, getCreds]);

  // Compute all active list codes (household lists + standalone guest lists)
  const trackedListCodes = useMemo(() => {
    const codes = new Set<string>(session.guestListCodes);
    for (const ref of Object.values(session.householdIndex.lists)) {
      if (!ref.deletedAt) codes.add(ref.listCode);
    }
    return Array.from(codes);
  }, [session.householdIndex.lists, session.guestListCodes]);

  const trackedCodesKey = trackedListCodes.slice().sort().join('|');

  // Subscribe to all tracked list documents
  useEffect(() => {
    const codes = trackedCodesKey ? trackedCodesKey.split('|') : [];
    const unsubs: Array<() => void> = [];
    let active = true;

    for (const listCode of codes) {
      getCreds(listCode)
        .then(async (creds) => {
          if (!active) return;
          const safeMerger = makeSafeListMerger(creds.normalized);
          const localList = sessionRef.current.listsByCode[listCode];
          if (localList) {
            const merged = await upsertEncryptedDoc('lists', creds, localList, safeMerger);
            if (!active) return;
            setSession((curr) => ({
              ...curr,
              listsByCode: {
                ...curr.listsByCode,
                [listCode]: curr.listsByCode[listCode]
                  ? safeMerger(curr.listsByCode[listCode]!, merged)
                  : merged,
              },
            }));
          } else {
            const remoteRaw = await fetchEncryptedDoc<unknown>('lists', creds);
            const cleanRemote = remoteRaw
              ? sanitizeShoppingList(remoteRaw, creds.normalized)
              : null;
            if (active && cleanRemote) {
              setSession((curr) => ({
                ...curr,
                listsByCode: { ...curr.listsByCode, [listCode]: cleanRemote },
              }));
            }
          }

          if (!active) return;
          const unsub = subscribeEncryptedDoc<unknown>('lists', creds, (remoteListRaw) => {
            const cleanRemote = sanitizeShoppingList(remoteListRaw, creds.normalized);
            if (!cleanRemote) return;
            setSession((curr) => {
              const currList = curr.listsByCode[listCode];
              const nextList = currList ? mergeLists(currList, cleanRemote) : cleanRemote;
              return {
                ...curr,
                listsByCode: { ...curr.listsByCode, [listCode]: nextList },
              };
            });
          });
          unsubs.push(unsub);
        })
        .catch(() => {
          // Ignore individual list fetch error
        });
    }

    return () => {
      active = false;
      unsubs.forEach((fn) => fn());
    };
  }, [trackedCodesKey, getCreds]);

  // Join by Friend Code (`H-...` Household OR `L-...` Single Guest List)
  const joinWithFriendCode = useCallback(
    async (rawCode: string): Promise<{ ok: boolean; message: string }> => {
      let creds: RoomCredentials;
      try {
        const allowedOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
        const extracted = extractFriendCodeFromInput(rawCode, allowedOrigin);
        creds = await getCreds(extracted);
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Invalid friend code format.',
        };
      }

      if (creds.kind === 'household') {
        try {
          const remoteHouseholdRaw = await fetchEncryptedDoc<unknown>('households', creds);
          const remoteHousehold = remoteHouseholdRaw
            ? sanitizeHouseholdIndex(remoteHouseholdRaw)
            : null;
          if (!remoteHousehold) {
            return {
              ok: false,
              message: isCloudSyncConfigured()
                ? 'No household found for that code yet. Ask your partner to open their app first!'
                : 'No household found in this browser for that code (connect Firebase in .env for cross-device sync).',
            };
          }

          // Fetch lists referenced inside the joined household
          const fetchedLists: Record<string, ShoppingList> = {};
          const activeRefs = Object.values(remoteHousehold.lists)
            .filter((r) => !r.deletedAt)
            .sort((a, b) => b.createdAt - a.createdAt);

          await Promise.all(
            activeRefs.map(async (ref) => {
              const lCreds = await getCreds(ref.listCode);
              const lDocRaw = await fetchEncryptedDoc<unknown>('lists', lCreds);
              const cleanDoc = lDocRaw ? sanitizeShoppingList(lDocRaw, lCreds.normalized) : null;
              fetchedLists[lCreds.normalized] = cleanDoc ?? {
                id: ref.id,
                listCode: lCreds.normalized,
                title: ref.title,
                emoji: ref.emoji,
                createdAt: ref.createdAt,
                updatedAt: ref.updatedAt,
                items: {},
              };
            })
          );

          const firstListCode = activeRefs[0]?.listCode ?? sessionRef.current.activeListCode;
          setSession((curr) => ({
            ...curr,
            householdCode: creds.normalized,
            householdIndex: remoteHousehold,
            listsByCode: { ...curr.listsByCode, ...fetchedLists },
            activeListCode: firstListCode,
          }));
          showToast('Joined shared household! ✨');
          return { ok: true, message: 'Joined household!' };
        } catch {
          return { ok: false, message: 'Could not decrypt household. Double-check the code!' };
        }
      }

      // Single-list guest code (`L-...`)
      try {
        const remoteListRaw = await fetchEncryptedDoc<unknown>('lists', creds);
        const remoteList = remoteListRaw
          ? sanitizeShoppingList(remoteListRaw, creds.normalized)
          : null;
        if (!remoteList) {
          return {
            ok: false,
            message: isCloudSyncConfigured()
              ? 'No shared list found for that code yet.'
              : 'No shared list found in this browser for that code (connect Firebase for cross-device sync).',
          };
        }

        setSession((curr) => ({
          ...curr,
          guestListCodes: curr.guestListCodes.includes(creds.normalized)
            ? curr.guestListCodes
            : [...curr.guestListCodes, creds.normalized],
          listsByCode: {
            ...curr.listsByCode,
            [creds.normalized]: curr.listsByCode[creds.normalized]
              ? mergeLists(curr.listsByCode[creds.normalized]!, remoteList)
              : remoteList,
          },
          activeListCode: creds.normalized,
        }));
        showToast(`Joined "${remoteList.title}"! 🛒`);
        return { ok: true, message: `Joined ${remoteList.title}!` };
      } catch {
        return { ok: false, message: 'Could not decrypt list. Double-check the friend code!' };
      }
    },
    [getCreds, showToast]
  );

  // Auto-handle `#join=...` invite URL hash on page load and scrub URL immediately for privacy
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHash = () => {
      const code = parseInviteHash(window.location.hash);
      if (!code) return;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      void joinWithFriendCode(code);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [joinWithFriendCode]);

  const householdLists = useMemo(() => {
    return Object.values(session.householdIndex.lists)
      .filter((r) => !r.deletedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((ref) => {
        const loaded = session.listsByCode[ref.listCode];
        return (
          loaded ?? {
            id: ref.id,
            listCode: ref.listCode,
            title: ref.title,
            emoji: ref.emoji,
            createdAt: ref.createdAt,
            updatedAt: ref.updatedAt,
            items: {},
          }
        );
      });
  }, [session.householdIndex.lists, session.listsByCode]);

  const guestLists = useMemo(() => {
    const householdCodeSet = new Set(householdLists.map((l) => l.listCode));
    return session.guestListCodes
      .filter((code) => !householdCodeSet.has(code))
      .map((code) => session.listsByCode[code])
      .filter((l): l is ShoppingList => Boolean(l));
  }, [session.guestListCodes, session.listsByCode, householdLists]);

  const activeList: ShoppingList = useMemo(() => {
    const direct = session.listsByCode[session.activeListCode];
    if (direct) return direct;
    if (householdLists[0]) return householdLists[0];
    if (guestLists[0]) return guestLists[0];
    const fallback = createInitialSession();
    return Object.values(fallback.listsByCode)[0]!;
  }, [session.listsByCode, session.activeListCode, householdLists, guestLists]);

  const isGuestListActive = useMemo(
    () => guestLists.some((g) => g.listCode === activeList.listCode),
    [guestLists, activeList.listCode]
  );

  const selectList = useCallback((listCode: string) => {
    setSession((curr) => ({ ...curr, activeListCode: listCode }));
  }, []);

  const mutateActiveList = useCallback(
    (updater: (list: ShoppingList, now: number) => ShoppingList) => {
      const now = Date.now();
      setSession((curr) => {
        const targetCode = curr.listsByCode[curr.activeListCode]
          ? curr.activeListCode
          : activeList.listCode;
        const base = curr.listsByCode[targetCode] ?? activeList;
        const updated = updater(base, now);
        scheduleListPush(targetCode, updated);

        // If title or emoji changed on a household list, sync household index too
        const hRef = curr.householdIndex.lists[updated.id];
        let nextHousehold = curr.householdIndex;
        if (hRef && (hRef.title !== updated.title || hRef.emoji !== updated.emoji)) {
          nextHousehold = {
            ...curr.householdIndex,
            updatedAt: now,
            lists: {
              ...curr.householdIndex.lists,
              [updated.id]: {
                ...hRef,
                title: updated.title,
                emoji: updated.emoji,
                updatedAt: now,
              },
            },
          };
          scheduleHouseholdPush(curr.householdCode, nextHousehold);
        }

        return {
          ...curr,
          householdIndex: nextHousehold,
          listsByCode: {
            ...curr.listsByCode,
            [targetCode]: updated,
          },
        };
      });
    },
    [activeList, scheduleListPush, scheduleHouseholdPush]
  );

  const addItem = useCallback(
    (rawInput: string, explicitCategory?: CategoryId) => {
      const { name, qty } = parseItemInput(rawInput);
      const cleanName = name.slice(0, MAX_ITEM_NAME_LENGTH).trim();
      if (!cleanName) return;

      const category =
        explicitCategory ??
        categorizeItem(cleanName, sessionRef.current.householdIndex.learnedCategories);

      mutateActiveList((list, now) => {
        // If an identical unchecked item already exists, update/uncheck it gracefully
        const existing = Object.values(list.items).find(
          (i) => !i.deletedAt && i.name.toLowerCase() === cleanName.toLowerCase()
        );
        const id = existing?.id ?? makeShortId();
        const nextItem: ShoppingItem = {
          id,
          name: cleanName,
          qty: qty || existing?.qty || '',
          category: explicitCategory ?? existing?.category ?? category,
          manualCategory: Boolean(explicitCategory || existing?.manualCategory),
          checked: false,
          updatedAt: now,
        };
        return {
          ...list,
          updatedAt: now,
          items: { ...list.items, [id]: nextItem },
        };
      });
    },
    [mutateActiveList]
  );

  const importChecklistText = useCallback(
    (rawText: string): number => {
      const parsed = parsePastedChecklist(
        rawText,
        sessionRef.current.householdIndex.learnedCategories
      );
      if (parsed.length === 0) return 0;

      mutateActiveList((list, now) => {
        const nextItems = { ...list.items };
        parsed.forEach((entry, idx) => {
          const cleanName = entry.name.slice(0, MAX_ITEM_NAME_LENGTH).trim();
          if (!cleanName) return;
          const existing = Object.values(nextItems).find(
            (i) => !i.deletedAt && i.name.toLowerCase() === cleanName.toLowerCase()
          );
          const id = existing?.id ?? makeShortId();
          nextItems[id] = {
            id,
            name: cleanName,
            qty: entry.qty || existing?.qty || '',
            category: entry.category,
            checked: entry.checked,
            updatedAt: now + idx,
          };
        });
        return {
          ...list,
          updatedAt: now + parsed.length,
          items: nextItems,
        };
      });

      showToast(`Imported & auto-sorted ${parsed.length} items! ✨`);
      return parsed.length;
    },
    [mutateActiveList, showToast]
  );

  const toggleItem = useCallback(
    (itemId: string) => {
      mutateActiveList((list, now) => {
        const item = list.items[itemId];
        if (!item || item.deletedAt) return list;
        return {
          ...list,
          updatedAt: now,
          items: {
            ...list.items,
            [itemId]: { ...item, checked: !item.checked, updatedAt: now },
          },
        };
      });
    },
    [mutateActiveList]
  );

  const removeItem = useCallback(
    (itemId: string) => {
      mutateActiveList((list, now) => {
        const item = list.items[itemId];
        if (!item) return list;
        return {
          ...list,
          updatedAt: now,
          items: {
            ...list.items,
            [itemId]: { ...item, deletedAt: now, updatedAt: now },
          },
        };
      });
    },
    [mutateActiveList]
  );

  const updateItemCategory = useCallback(
    (itemId: string, category: CategoryId) => {
      const targetItem = activeList.items[itemId];
      if (!targetItem) return;

      mutateActiveList((list, now) => ({
        ...list,
        updatedAt: now,
        items: {
          ...list.items,
          [itemId]: {
            ...targetItem,
            category,
            manualCategory: true,
            updatedAt: now,
          },
        },
      }));

      // Teach the household's encrypted learned dictionary so next time it auto-sorts automatically!
      const normTerm = normalizeGroceryTerm(targetItem.name);
      if (normTerm) {
        const now = Date.now();
        setSession((curr) => {
          const nextHousehold: HouseholdIndex = {
            ...curr.householdIndex,
            updatedAt: now,
            learnedCategories: {
              ...curr.householdIndex.learnedCategories,
              [normTerm]: category,
            },
          };
          scheduleHouseholdPush(curr.householdCode, nextHousehold);
          return { ...curr, householdIndex: nextHousehold };
        });
      }
    },
    [activeList.items, mutateActiveList, scheduleHouseholdPush]
  );

  const autoSortAllItems = useCallback(() => {
    let changedCount = 0;
    const learned = sessionRef.current.householdIndex.learnedCategories;

    mutateActiveList((list, now) => {
      const nextItems = { ...list.items };
      for (const [id, item] of Object.entries(nextItems)) {
        if (item.deletedAt || item.manualCategory) continue;
        const detected = categorizeItem(item.name, learned);
        if (detected !== item.category && detected !== 'other') {
          nextItems[id] = { ...item, category: detected, updatedAt: now };
          changedCount++;
        }
      }
      return { ...list, updatedAt: now, items: nextItems };
    });

    showToast(
      changedCount > 0
        ? `Auto-sorted ${changedCount} ${changedCount === 1 ? 'item' : 'items'} into aisles! ✨`
        : 'All items are sorted into their aisles! ✨'
    );
  }, [mutateActiveList, showToast]);

  const clearCheckedItems = useCallback(() => {
    mutateActiveList((list, now) => {
      const nextItems = { ...list.items };
      for (const [id, item] of Object.entries(nextItems)) {
        if (!item.deletedAt && item.checked) {
          nextItems[id] = { ...item, deletedAt: now, updatedAt: now };
        }
      }
      return { ...list, updatedAt: now, items: nextItems };
    });
  }, [mutateActiveList]);

  const uncheckAllItems = useCallback(() => {
    mutateActiveList((list, now) => {
      const nextItems = { ...list.items };
      for (const [id, item] of Object.entries(nextItems)) {
        if (!item.deletedAt && item.checked) {
          nextItems[id] = { ...item, checked: false, updatedAt: now };
        }
      }
      return { ...list, updatedAt: now, items: nextItems };
    });
  }, [mutateActiveList]);

  const createCustomList = useCallback(
    (options: {
      title: string;
      emoji: string;
      carryOverUnchecked: boolean;
      initialStaples?: string[];
    }) => {
      const now = Date.now();
      const cleanTitle = sanitizeListTitle(options.title);
      const cleanEmoji = options.emoji.trim() || '🛒';
      const newListCode = generateFriendCode('list');
      const newId = makeShortId();

      const seedItems: Record<string, ShoppingItem> = {};
      const learned = sessionRef.current.householdIndex.learnedCategories;

      if (options.carryOverUnchecked) {
        Object.values(activeList.items)
          .filter((i) => !i.deletedAt && !i.checked)
          .forEach((item, idx) => {
            const copyId = makeShortId();
            seedItems[copyId] = {
              ...item,
              id: copyId,
              checked: false,
              updatedAt: now + idx,
            };
          });
      }

      if (options.initialStaples) {
        options.initialStaples.forEach((staple, idx) => {
          const { name, qty } = parseItemInput(staple);
          if (!name) return;
          const itemId = makeShortId();
          seedItems[itemId] = {
            id: itemId,
            name,
            qty,
            category: categorizeItem(name, learned),
            checked: false,
            updatedAt: now + 100 + idx,
          };
        });
      }

      const newList: ShoppingList = {
        id: newId,
        listCode: newListCode,
        title: cleanTitle,
        emoji: cleanEmoji,
        createdAt: now,
        updatedAt: now,
        items: seedItems,
      };

      setSession((curr) => {
        const nextHousehold: HouseholdIndex = {
          ...curr.householdIndex,
          updatedAt: now,
          lists: {
            ...curr.householdIndex.lists,
            [newId]: {
              id: newId,
              listCode: newListCode,
              title: cleanTitle,
              emoji: cleanEmoji,
              createdAt: now,
              updatedAt: now,
            },
          },
        };
        scheduleListPush(newListCode, newList);
        scheduleHouseholdPush(curr.householdCode, nextHousehold);

        return {
          ...curr,
          householdIndex: nextHousehold,
          listsByCode: { ...curr.listsByCode, [newListCode]: newList },
          activeListCode: newListCode,
        };
      });

      showToast(`Created "${cleanTitle}"! 🎉`);
    },
    [activeList.items, scheduleHouseholdPush, scheduleListPush, showToast]
  );

  const renameList = useCallback(
    (listCode: string, nextTitleRaw: string, nextEmoji?: string) => {
      const cleanTitle = sanitizeListTitle(nextTitleRaw);
      const now = Date.now();

      setSession((curr) => {
        const target = curr.listsByCode[listCode];
        if (!target) return curr;
        const emoji = nextEmoji?.trim() || target.emoji;
        const updatedList: ShoppingList = {
          ...target,
          title: cleanTitle,
          emoji,
          updatedAt: now,
        };
        scheduleListPush(listCode, updatedList);

        let nextHousehold = curr.householdIndex;
        const hRef = curr.householdIndex.lists[target.id];
        if (hRef) {
          nextHousehold = {
            ...curr.householdIndex,
            updatedAt: now,
            lists: {
              ...curr.householdIndex.lists,
              [target.id]: {
                ...hRef,
                title: cleanTitle,
                emoji,
                updatedAt: now,
              },
            },
          };
          scheduleHouseholdPush(curr.householdCode, nextHousehold);
        }

        return {
          ...curr,
          householdIndex: nextHousehold,
          listsByCode: { ...curr.listsByCode, [listCode]: updatedList },
        };
      });
    },
    [scheduleHouseholdPush, scheduleListPush]
  );

  const deleteList = useCallback(
    async (listCode: string, alsoDeleteFromCloud = false) => {
      const now = Date.now();
      const target = sessionRef.current.listsByCode[listCode];

      if (alsoDeleteFromCloud) {
        try {
          const creds = await getCreds(listCode);
          await deleteEncryptedDoc('lists', creds);
        } catch {
          // Ignore network errors during local removal
        }
      }

      setSession((curr) => {
        const isGuest = curr.guestListCodes.includes(listCode);
        const remainingGuests = curr.guestListCodes.filter((c) => c !== listCode);

        let nextHousehold = curr.householdIndex;
        if (!isGuest && target && curr.householdIndex.lists[target.id]) {
          // Ensure at least 1 household list always remains so UI is never empty
          const activeHouseholdCount = Object.values(curr.householdIndex.lists).filter(
            (r) => !r.deletedAt
          ).length;
          if (activeHouseholdCount <= 1 && remainingGuests.length === 0) {
            const fresh = createInitialSession();
            return {
              ...fresh,
              householdCode: curr.householdCode,
            };
          }
          nextHousehold = {
            ...curr.householdIndex,
            updatedAt: now,
            lists: {
              ...curr.householdIndex.lists,
              [target.id]: {
                ...curr.householdIndex.lists[target.id]!,
                deletedAt: now,
                updatedAt: now,
              },
            },
          };
          scheduleHouseholdPush(curr.householdCode, nextHousehold);
        }

        const nextListsByCode = { ...curr.listsByCode };
        delete nextListsByCode[listCode];

        const fallbackCode =
          Object.values(nextHousehold.lists).find((r) => !r.deletedAt)?.listCode ??
          remainingGuests[0] ??
          '';

        return {
          ...curr,
          householdIndex: nextHousehold,
          guestListCodes: remainingGuests,
          listsByCode: nextListsByCode,
          activeListCode: curr.activeListCode === listCode ? fallbackCode : curr.activeListCode,
        };
      });

      showToast('Removed list from workspace.');
    },
    [getCreds, scheduleHouseholdPush, showToast]
  );

  const startFreshHousehold = useCallback(() => {
    const fresh = createInitialSession();
    setSession(fresh);
    showToast('Started a brand-new private household! 🌱');
  }, [showToast]);

  return {
    householdCode: session.householdCode,
    learnedCategories: session.householdIndex.learnedCategories,
    householdLists,
    guestLists,
    activeList,
    isGuestListActive,
    categorizerReady,
    syncMode,
    cloudConfigured: isCloudSyncConfigured(),
    statusToast,
    selectList,
    addItem,
    importChecklistText,
    toggleItem,
    removeItem,
    updateItemCategory,
    autoSortAllItems,
    clearCheckedItems,
    uncheckAllItems,
    createCustomList,
    renameList,
    deleteList,
    joinWithFriendCode,
    startFreshHousehold,
    showToast,
  };
}
