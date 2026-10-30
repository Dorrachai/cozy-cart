import type { RoomCredentials } from '../types/shopping';

/**
 * Curated cute, memorable, unambiguous cozy grocery words for Friend Codes.
 * 64 words = 6 bits/word (2 words = 12 bits) + 7 unambiguous Base32 chars (35 bits) = 47 bits entropy.
 */
const COZY_WORDS = [
  'apple', 'apricot', 'avocado', 'bagel', 'basil', 'berry', 'biscuit', 'blossom',
  'blueberry', 'breeze', 'brioche', 'butter', 'cacao', 'caramel', 'carrot', 'cashew',
  'cherry', 'cinnamon', 'citrus', 'clover', 'cloud', 'cocoa', 'coconut', 'coffee',
  'cookie', 'cupcake', 'daisy', 'dumpling', 'espresso', 'fig', 'ginger', 'honey',
  'jasmine', 'kiwi', 'latte', 'lavender', 'lemon', 'lilac', 'lime', 'lotus',
  'lychee', 'macaron', 'mango', 'maple', 'matcha', 'melon', 'mint', 'mochi',
  'muffin', 'nectar', 'noodle', 'nutmeg', 'oat', 'olive', 'orange', 'orchid',
  'pancake', 'papaya', 'peach', 'peanut', 'pear', 'pecan', 'pistachio', 'plum',
  'poppy', 'pretzel', 'pumpkin', 'quinoa', 'raspberry', 'rose', 'saffron', 'sage',
  'sesame', 'sorbet', 'sprout', 'starfruit', 'strawberry', 'sugar', 'sunflower', 'syrup',
  'tangerine', 'thyme', 'toast', 'toffee', 'truffle', 'tulip', 'vanilla', 'waffle',
  'walnut', 'wasabi', 'willow', 'yuzu',
] as const;

const SAFE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_SALT = 'cozycart-e2ee-v1';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Generates a high-entropy, human-friendly Friend Code:
 * - `H-<word>-<word>-<7chars>` for a Household (shares all lists inside the household)
 * - `L-<word>-<word>-<7chars>` for a Single List (shares ONLY that specific list)
 */
export function generateFriendCode(kind: 'household' | 'list'): string {
  const prefix = kind === 'household' ? 'H' : 'L';
  const rand = new Uint32Array(9);
  crypto.getRandomValues(rand);

  const w1 = COZY_WORDS[rand[0]! % COZY_WORDS.length]!;
  let w2 = COZY_WORDS[rand[1]! % COZY_WORDS.length]!;
  if (w2 === w1) {
    w2 = COZY_WORDS[(rand[1]! + 1) % COZY_WORDS.length]!;
  }

  let suffix = '';
  for (let i = 2; i < 9; i++) {
    suffix += SAFE_ALPHABET[rand[i]! % SAFE_ALPHABET.length]!;
  }

  return `${prefix}-${w1}-${w2}-${suffix}`;
}

/**
 * Normalizes user-typed or pasted Friend Codes so minor casing/whitespace differences
 * produce the exact same cryptographic key.
 */
export function normalizeFriendCode(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^#?join=/i, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

  const parts = cleaned.split('-').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Friend code is incomplete. Expected format like H-berry-mochi-7K4P9X2.');
  }

  const firstUpper = parts[0]!.toUpperCase();
  const prefix = firstUpper === 'H' || firstUpper === 'L' ? firstUpper : 'H';
  const rest = firstUpper === 'H' || firstUpper === 'L' ? parts.slice(1) : parts;

  if (rest.length < 2) {
    throw new Error('Friend code is too short.');
  }

  const normalizedRest = rest.map((segment, idx) =>
    idx === rest.length - 1 ? segment.toUpperCase() : segment.toLowerCase()
  );

  const joined = `${prefix}-${normalizedRest.join('-')}`;
  if (joined.length < 12) {
    throw new Error('Friend code must be at least 12 characters long.');
  }
  return joined;
}

/**
 * Derives TWO cryptographically separated secrets from a Friend Code using Web Crypto PBKDF2:
 * 1. `docId`: 64-hex-char SHA-256 hash used as the Firestore Document ID (server cannot reverse it)
 * 2. `aesKey`: Non-extractable 256-bit AES-GCM key that NEVER leaves the browser
 */
export async function deriveRoomCredentials(rawCode: string): Promise<RoomCredentials> {
  const normalized = normalizeFriendCode(rawCode);
  const enc = new TextEncoder();

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(normalized),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    512
  );

  const idSlice = bits.slice(0, 32);
  const keySlice = bits.slice(32, 64);

  const idDigest = await crypto.subtle.digest('SHA-256', idSlice);
  const docId = Array.from(new Uint8Array(idDigest), (b) => b.toString(16).padStart(2, '0')).join('');

  const aesKey = await crypto.subtle.importKey(
    'raw',
    keySlice,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    normalized,
    kind: normalized.startsWith('L-') ? 'list' : 'household',
    docId,
    aesKey,
  };
}

export async function encryptPayload<T>(payload: T, aesKey: CryptoKey): Promise<{ ct: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);
  return {
    ct: bytesToBase64(new Uint8Array(cipherBuffer)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptPayload<T>(ct: string, iv: string, aesKey: CryptoKey): Promise<T> {
  const cipherBytes = base64ToBytes(ct);
  const ivBytes = base64ToBytes(iv);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    cipherBytes
  );
  const json = new TextDecoder().decode(plainBuffer);
  return JSON.parse(json) as T;
}

/**
 * Builds a zero-leak invite link putting the Friend Code in the `#hash` fragment.
 * URL `#hash` fragments are NEVER sent over HTTP to GitHub Pages or third-party servers.
 */
export function buildInviteUrl(friendCode: string, currentHref?: string): string {
  const baseHref = currentHref ?? (typeof window !== 'undefined' ? window.location.href : 'https://example.github.io/');
  const url = new URL(baseHref);
  url.search = '';
  url.hash = `join=${encodeURIComponent(normalizeFriendCode(friendCode))}`;
  return url.toString();
}

/**
 * Extracts `#join=<code`> from a URL hash if present, returning the normalized Friend Code.
 */
export function parseInviteHash(hash: string): string | null {
  if (!hash) return null;
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const raw = params.get('join');
  if (!raw) return null;
  try {
    return normalizeFriendCode(decodeURIComponent(raw));
  } catch {
    return null;
  }
}
