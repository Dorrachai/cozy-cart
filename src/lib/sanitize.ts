import { normalizeFriendCode } from './crypto';
import type {
  CategoryId,
  HouseholdIndex,
  HouseholdListRef,
  ShoppingItem,
  ShoppingList,
} from '../types/shopping';

const VALID_CATEGORIES = new Set<CategoryId>([
  'dairy',
  'candy',
  'produce',
  'bakery',
  'meat',
  'frozen',
  'pantry',
  'drinks',
  'household',
  'care',
  'pets',
  'other',
]);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes max future skew to prevent CRDT timestamp poisoning
const MAX_ITEMS_PER_LIST = 500;
const MAX_LISTS_PER_HOUSEHOLD = 100;
const MAX_LEARNED_CATEGORIES = 1000;

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function stripControlChars(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeSafeId(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || FORBIDDEN_KEYS.has(trimmed)) return null;
  if (!/^[A-Za-z0-9_-]{1,36}$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeTimestamp(val: unknown, fallback: number, maxFuture: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    return fallback;
  }
  return Math.min(Math.floor(val), maxFuture);
}

function sanitizeCategory(val: unknown): CategoryId {
  if (typeof val === 'string' && VALID_CATEGORIES.has(val as CategoryId)) {
    return val as CategoryId;
  }
  return 'other';
}

/**
 * Zero-trust runtime validator & sanitizer for decrypted `ShoppingList` JSON payloads.
 * Always pins `listCode` to the verified cryptographic capability key (`pinnedListCode`),
 * ensuring a peer can never spoof `listCode` to alter the QR code or Friend Code display.
 */
export function sanitizeShoppingList(
  raw: unknown,
  pinnedListCode: string,
  now = Date.now()
): ShoppingList | null {
  let safePinnedCode: string;
  try {
    safePinnedCode = normalizeFriendCode(pinnedListCode);
    if (!safePinnedCode.startsWith('L-')) return null;
  } catch {
    return null;
  }

  if (!isPlainRecord(raw)) return null;

  const maxFuture = now + MAX_CLOCK_SKEW_MS;
  const fallbackId = safePinnedCode.slice(-12).replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'list01';
  const id = sanitizeSafeId(raw.id) ?? fallbackId;
  const title = stripControlChars(raw.title, 60) || 'Shopping List';
  const emoji = stripControlChars(raw.emoji, 16) || '🛒';
  const createdAt = sanitizeTimestamp(raw.createdAt, now, maxFuture);
  const updatedAt = sanitizeTimestamp(raw.updatedAt, createdAt, maxFuture);

  const items: Record<string, ShoppingItem> = {};
  if (isPlainRecord(raw.items)) {
    let count = 0;
    for (const [key, itemRaw] of Object.entries(raw.items)) {
      if (count >= MAX_ITEMS_PER_LIST) break;
      if (FORBIDDEN_KEYS.has(key) || !isPlainRecord(itemRaw)) continue;

      const itemId = sanitizeSafeId(itemRaw.id ?? key);
      if (!itemId) continue;

      const name = stripControlChars(itemRaw.name, 100);
      if (!name) continue;

      const qty = stripControlChars(itemRaw.qty, 30);
      const itemUpdatedAt = sanitizeTimestamp(itemRaw.updatedAt, updatedAt, maxFuture);
      const deletedAt =
        itemRaw.deletedAt !== undefined && itemRaw.deletedAt !== null
          ? sanitizeTimestamp(itemRaw.deletedAt, itemUpdatedAt, maxFuture)
          : undefined;

      const cleanItem: ShoppingItem = {
        id: itemId,
        name,
        qty,
        category: sanitizeCategory(itemRaw.category),
        manualCategory: Boolean(itemRaw.manualCategory),
        checked: Boolean(itemRaw.checked),
        updatedAt: itemUpdatedAt,
      };
      if (deletedAt !== undefined) {
        cleanItem.deletedAt = deletedAt;
      }
      items[itemId] = cleanItem;
      count++;
    }
  }

  return {
    id,
    listCode: safePinnedCode,
    title,
    emoji,
    createdAt,
    updatedAt,
    items,
  };
}

/**
 * Zero-trust runtime validator & sanitizer for decrypted `HouseholdIndex` JSON payloads.
 * Strictly validates every referenced `listCode` against `FRIEND_CODE_PATTERN` (`L-...`),
 * dropping any malformed or URL-like entries before they can enter app state.
 */
export function sanitizeHouseholdIndex(raw: unknown, now = Date.now()): HouseholdIndex | null {
  if (!isPlainRecord(raw)) return null;

  const maxFuture = now + MAX_CLOCK_SKEW_MS;
  const householdName = stripControlChars(raw.householdName, 60) || 'Our Household';
  const updatedAt = sanitizeTimestamp(raw.updatedAt, now, maxFuture);

  const lists: Record<string, HouseholdListRef> = {};
  if (isPlainRecord(raw.lists)) {
    let listCount = 0;
    for (const [key, refRaw] of Object.entries(raw.lists)) {
      if (listCount >= MAX_LISTS_PER_HOUSEHOLD) break;
      if (FORBIDDEN_KEYS.has(key) || !isPlainRecord(refRaw)) continue;

      const id = sanitizeSafeId(refRaw.id ?? key);
      if (!id || typeof refRaw.listCode !== 'string') continue;

      let safeListCode: string;
      try {
        safeListCode = normalizeFriendCode(refRaw.listCode);
        if (!safeListCode.startsWith('L-')) continue;
      } catch {
        // Drop any malformed or malicious listCode (e.g. injected URLs)
        continue;
      }

      const title = stripControlChars(refRaw.title, 60) || 'Shopping List';
      const emoji = stripControlChars(refRaw.emoji, 16) || '🛒';
      const refCreated = sanitizeTimestamp(refRaw.createdAt, updatedAt, maxFuture);
      const refUpdated = sanitizeTimestamp(refRaw.updatedAt, refCreated, maxFuture);
      const deletedAt =
        refRaw.deletedAt !== undefined && refRaw.deletedAt !== null
          ? sanitizeTimestamp(refRaw.deletedAt, refUpdated, maxFuture)
          : undefined;

      const cleanRef: HouseholdListRef = {
        id,
        listCode: safeListCode,
        title,
        emoji,
        createdAt: refCreated,
        updatedAt: refUpdated,
      };
      if (deletedAt !== undefined) {
        cleanRef.deletedAt = deletedAt;
      }
      lists[id] = cleanRef;
      listCount++;
    }
  }

  const learnedCategories: Record<string, CategoryId> = {};
  if (isPlainRecord(raw.learnedCategories)) {
    let learnedCount = 0;
    for (const [termRaw, catRaw] of Object.entries(raw.learnedCategories)) {
      if (learnedCount >= MAX_LEARNED_CATEGORIES) break;
      const cleanTerm = stripControlChars(termRaw, 80).toLowerCase();
      if (!cleanTerm || FORBIDDEN_KEYS.has(cleanTerm)) continue;
      if (typeof catRaw !== 'string' || !VALID_CATEGORIES.has(catRaw as CategoryId)) continue;
      learnedCategories[cleanTerm] = catRaw as CategoryId;
      learnedCount++;
    }
  }

  return {
    version: 1,
    householdName,
    updatedAt,
    lists,
    learnedCategories,
  };
}
