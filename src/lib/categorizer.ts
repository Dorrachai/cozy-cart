import Fuse from 'fuse.js';
import type { CategoryId, CategoryMeta } from '../types/shopping';

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'produce', label: 'Produce & fruit', shortLabel: 'Produce', emoji: '', order: 1, tone: 'cat-produce' },
  { id: 'bakery', label: 'Bakery & bread', shortLabel: 'Bakery', emoji: '', order: 2, tone: 'cat-bakery' },
  { id: 'dairy', label: 'Dairy & eggs', shortLabel: 'Dairy', emoji: '', order: 3, tone: 'cat-dairy' },
  { id: 'meat', label: 'Meat, fish & tofu', shortLabel: 'Meat & fish', emoji: '', order: 4, tone: 'cat-meat' },
  { id: 'pantry', label: 'Pantry & dry goods', shortLabel: 'Pantry', emoji: '', order: 5, tone: 'cat-pantry' },
  { id: 'frozen', label: 'Frozen', shortLabel: 'Frozen', emoji: '', order: 6, tone: 'cat-frozen' },
  { id: 'candy', label: 'Sweets & snacks', shortLabel: 'Snacks', emoji: '', order: 7, tone: 'cat-candy' },
  { id: 'drinks', label: 'Drinks & coffee', shortLabel: 'Drinks', emoji: '', order: 8, tone: 'cat-drinks' },
  { id: 'household', label: 'Household & paper', shortLabel: 'Household', emoji: '', order: 9, tone: 'cat-household' },
  { id: 'care', label: 'Personal care', shortLabel: 'Care', emoji: '', order: 10, tone: 'cat-care' },
  { id: 'pets', label: 'Pets', shortLabel: 'Pets', emoji: '', order: 11, tone: 'cat-pets' },
  { id: 'other', label: 'Other items', shortLabel: 'Other', emoji: '', order: 12, tone: 'cat-other' },
] as const;

export const CATEGORY_MAP: Record<CategoryId, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
) as Record<CategoryId, CategoryMeta>;

export interface TaxonomyData {
  version: number;
  source: string;
  suffixes: Array<{ suffixes: string[]; category: CategoryId }>;
  categories: Partial<Record<CategoryId, string[]>>;
}

interface FuseEntry {
  term: string;
  category: CategoryId;
}

let exactMap = new Map<string, CategoryId>();
let suffixRules: Array<{ suffixes: string[]; category: CategoryId }> = [];
let fuseIndex: Fuse<FuseEntry> | null = null;
let loaded = false;

export function normalizeGroceryTerm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits optional leading or trailing quantities from a grocery string:
 * - "2x oat milk" -> { name: "Oat milk", qty: "2x" }
 * - "500g strawberries" -> { name: "Strawberries", qty: "500g" }
 * - "milk x3" -> { name: "Milk", qty: "3x" }
 * - "2 avocados" -> { name: "Avocados", qty: "2" }
 */
export function parseItemInput(rawInput: string): { name: string; qty: string } {
  const trimmed = rawInput.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { name: '', qty: '' };

  // Pattern 1: Leading quantity with optional unit (e.g. "2x", "500g", "1.5 kg", "3 pkt", "2 st", "2")
  const leadingMatch = trimmed.match(
    /^(\d+(?:[.,]\d+)?\s*(?:x|st|pcs|pc|pk|pkt|pack|packs|g|kg|hg|ml|cl|dl|l|oz|lb|lbs|burk|påse|förp)?)\s+(.+)$/i
  );
  if (leadingMatch && leadingMatch[2] && /\p{L}/u.test(leadingMatch[2])) {
    return {
      qty: leadingMatch[1]!.replace(/\s+/g, ''),
      name: capitalizeFirst(leadingMatch[2]!.trim()),
    };
  }

  // Pattern 2: Trailing multiplier or parenthesis (e.g. "oat milk x2", "apples (4)")
  const trailingMatch = trimmed.match(/^(.+?)\s+(?:x\s*(\d+)|\((\d+[^)]*)\))$/i);
  if (trailingMatch && trailingMatch[1] && /\p{L}/u.test(trailingMatch[1])) {
    const qty = trailingMatch[2] ? `${trailingMatch[2]}x` : trailingMatch[3]!.trim();
    return {
      qty,
      name: capitalizeFirst(trailingMatch[1]!.trim()),
    };
  }

  return { name: capitalizeFirst(trimmed), qty: '' };
}

function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Initializes the in-memory exact dictionary, compound suffix table, and Fuse.js fuzzy index.
 */
export function initCategorizerFromData(data: TaxonomyData): void {
  const nextMap = new Map<string, CategoryId>();
  const entries: FuseEntry[] = [];

  for (const [catKey, terms] of Object.entries(data.categories)) {
    const category = catKey as CategoryId;
    if (!Array.isArray(terms)) continue;
    for (const rawTerm of terms) {
      const term = normalizeGroceryTerm(rawTerm);
      if (!term) continue;
      nextMap.set(term, category);
      entries.push({ term, category });
    }
  }

  exactMap = nextMap;
  suffixRules = data.suffixes ?? [];
  fuseIndex = new Fuse(entries, {
    keys: ['term'],
    includeScore: true,
    threshold: 0.27,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });
  loaded = true;
}

export function isCategorizerReady(): boolean {
  return loaded;
}

/**
 * Loads `data/grocery-taxonomy.json` dynamically in the browser once.
 */
let loadPromise: Promise<void> | null = null;
export function ensureCategorizerLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = fetch('./data/grocery-taxonomy.json')
    .then((res) => {
      if (!res.ok) throw new Error(`Taxonomy HTTP ${res.status}`);
      return res.json() as Promise<TaxonomyData>;
    })
    .then((data) => {
      initCategorizerFromData(data);
    })
    .catch((err) => {
      console.warn('Taxonomy load failed, falling back to manual categories:', err);
    });

  return loadPromise;
}

function stripSimplePlural(word: string): string {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  if (word.length > 5 && (word.endsWith('ar') || word.endsWith('er') || word.endsWith('or'))) {
    return word.slice(0, -2);
  }
  return word;
}

/**
 * Classifies a grocery item completely in-browser with zero network calls:
 * 1. Encrypted household-learned category overrides
 * 2. Exact full-phrase match & singularized match
 * 3. Multi-word token & compound-word suffix match (e.g. "havremjölk", "organic sour gummies")
 * 4. Fuse.js typo-tolerant fuzzy search over the distilled Open Food Facts taxonomy
 */
export function categorizeItem(
  rawName: string,
  learnedCategories: Record<string, CategoryId> = {}
): CategoryId {
  const { name } = parseItemInput(rawName);
  const norm = normalizeGroceryTerm(name || rawName);
  if (!norm) return 'other';

  // 1. Household learned overrides take top priority
  const learned = learnedCategories[norm];
  if (learned && CATEGORY_MAP[learned]) {
    return learned;
  }

  // 2. Exact phrase or simple singularized phrase match
  const exact = exactMap.get(norm) ?? exactMap.get(stripSimplePlural(norm));
  if (exact) return exact;

  const tokens = norm.split(' ').filter((t) => t.length >= 2);

  // Check 2-word sub-phrases right-to-left (head noun in English/Germanic is usually rightmost, e.g. "organic oat milk")
  if (tokens.length >= 2) {
    for (let i = tokens.length - 2; i >= 0; i--) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      const hit = exactMap.get(bigram) ?? exactMap.get(stripSimplePlural(bigram));
      if (hit) return hit;
    }
  }

  // 3. Compound-word suffix rules (handles Swedish/German/English compounds like "chokladmjölk", "lösgodis", "vollmilch")
  for (const rule of suffixRules) {
    for (const sfx of rule.suffixes) {
      if (
        norm === sfx ||
        norm.endsWith(` ${sfx}`) ||
        (sfx.length >= 4 && norm.endsWith(sfx)) ||
        tokens.some((tok) => tok === sfx || (sfx.length >= 4 && tok.endsWith(sfx)))
      ) {
        return rule.category;
      }
    }
  }

  // Token-level exact lookup right-to-left (e.g. "fresh organic strawberries" -> "strawberries")
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i]!;
    if (tok.length < 3) continue;
    const hit = exactMap.get(tok) ?? exactMap.get(stripSimplePlural(tok));
    if (hit) return hit;
  }

  // 4. Fuse.js typo-tolerant fuzzy match ("strawberies" -> "strawberries")
  if (fuseIndex && norm.length >= 4) {
    const fullHits = fuseIndex.search(norm, { limit: 1 });
    if (fullHits[0] && (fullHits[0].score ?? 1) <= 0.25) {
      return fullHits[0].item.category;
    }

    // Also try rightmost significant token if multi-word
    const headNoun = tokens[tokens.length - 1];
    if (tokens.length > 1 && headNoun && headNoun.length >= 4) {
      const headHits = fuseIndex.search(headNoun, { limit: 1 });
      if (headHits[0] && (headHits[0].score ?? 1) <= 0.22) {
        return headHits[0].item.category;
      }
    }
  }

  return 'other';
}
