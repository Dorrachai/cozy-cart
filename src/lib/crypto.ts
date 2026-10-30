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

/**
 * Strict Friend Code allowlist:
 * - Prefix `H` (Household) or `L` (Single List)
 * - 1 to 4 lowercase alphanumeric word segments (2..20 chars each)
 * - 1 uppercase alphanumeric token segment (4..16 chars)
 * Contains ONLY `[A-Za-z0-9-]` — mathematically impossible to contain URLs, schemes, dots, slashes, or HTML/JS.
 */
export const FRIEND_CODE_PATTERN = /^[HL](?:-[a-z0-9]{2,20}){1,4}-[A-Z0-9]{4,16}$/;
export const MAX_FRIEND_CODE_LENGTH = 64;

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
 * produce the exact same cryptographic key, while strictly blocking URLs and special characters.
 */
export function normalizeFriendCode(raw: string): string {
  if (typeof raw !== 'string' || raw.length > 256) {
    throw new Error('Invalid friend code length.');
  }

  const cleaned = raw
    .trim()
    .replace(/^#?join=/i, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

  if (!cleaned) {
    throw new Error('Friend code cannot be empty.');
  }

  // Strict ASCII alphanumeric + hyphen allowlist: blocks `://`, `/`, `.`, `?`, `<`, `>`, quotes, etc.
  if (!/^[A-Za-z0-9-]+$/.test(cleaned)) {
    throw new Error(
      'Invalid friend code: URLs and special characters are blocked for your security.'
    );
  }

  const parts = cleaned.split('-').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Friend code is incomplete. Expected format like H-berry-mochi-7K4P9X2.');
  }

  const firstUpper = parts[0]!.toUpperCase();
  const prefix = firstUpper === 'H' || firstUpper === 'L' ? firstUpper : 'H';
  const rest = firstUpper === 'H' || firstUpper === 'L' ? parts.slice(1) : parts;

  if (rest.length < 2 || rest.length > 5) {
    throw new Error('Friend code format is invalid. Expected format like H-berry-mochi-7K4P9X2.');
  }

  const normalizedRest = rest.map((segment, idx) =>
    idx === rest.length - 1 ? segment.toUpperCase() : segment.toLowerCase()
  );

  const joined = `${prefix}-${normalizedRest.join('-')}`;
  if (
    joined.length < 12 ||
    joined.length > MAX_FRIEND_CODE_LENGTH ||
    !FRIEND_CODE_PATTERN.test(joined)
  ) {
    throw new Error('Invalid friend code format. Expected format like H-berry-mochi-7K4P9X2.');
  }
  return joined;
}

/**
 * Checks whether an untrusted value is a valid Friend Code without throwing.
 */
export function isValidFriendCode(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    normalizeFriendCode(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely parses user input from the "Join Code" form.
 * - Accepts valid Friend Codes (`H-berry-mochi-7K4P9X2`).
 * - Accepts same-origin CozyCart `#join=` invite links if the user pasted the whole link.
 * - Blocks all external domains, `javascript:`/`data:` URIs, and malformed links.
 */
export function extractFriendCodeFromInput(rawInput: string, allowedOrigin?: string): string {
  if (typeof rawInput !== 'string' || rawInput.length > 512) {
    throw new Error('Input is too long.');
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Please enter a Friend Code.');
  }

  // Detect any URI scheme (`https://...`, `javascript:...`, `data:...`, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('Invalid link blocked. Please enter a CozyCart Friend Code.');
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Unsafe link scheme blocked. Please enter a CozyCart Friend Code.');
    }

    if (allowedOrigin && parsed.origin !== allowedOrigin) {
      throw new Error(
        'External links are blocked for your security. Enter a CozyCart Friend Code instead.'
      );
    }

    const fromHash = parseInviteHash(parsed.hash);
    if (!fromHash) {
      throw new Error('That link does not contain a valid CozyCart #join Friend Code.');
    }
    return fromHash;
  }

  return normalizeFriendCode(trimmed);
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
 * Builds a zero-leak invite link putting the validated Friend Code in the `#hash` fragment.
 * - Origin and path are strictly pinned to the app's own HTTP(S) URL (never user-supplied domains).
 * - Friend Code is validated against `FRIEND_CODE_PATTERN` (`[A-Za-z0-9-]` only).
 * - URL `#hash` fragments are NEVER sent over HTTP to GitHub Pages or third-party servers.
 */
export function buildInviteUrl(friendCode: string, currentHref?: string): string {
  const safeCode = normalizeFriendCode(friendCode);
  const baseHref =
    currentHref ?? (typeof window !== 'undefined' ? window.location.href : 'https://example.github.io/');
  const url = new URL(baseHref);

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Invite URLs require an http or https origin.');
  }

  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = `join=${safeCode}`;

  const result = url.toString();
  if (!result.startsWith(`${url.origin}${url.pathname}#join=${safeCode}`)) {
    throw new Error('Invite URL origin verification failed.');
  }
  return result;
}

/**
 * Extracts `#join=<code>` from a URL hash if present, returning the normalized Friend Code.
 * Rejects any non-conforming or malicious hash payloads by returning `null`.
 */
export function parseInviteHash(hash: string): string | null {
  if (!hash || hash.length > 256) return null;
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const raw = params.get('join');
  if (!raw) return null;
  try {
    return normalizeFriendCode(raw);
  } catch {
    return null;
  }
}
