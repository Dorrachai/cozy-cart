import { CATEGORIES, CATEGORY_MAP, categorizeItem, parseItemInput } from './categorizer';
import type {
  CategoryId,
  ChecklistExportOptions,
  ShoppingItem,
  ShoppingList,
} from '../types/shopping';

export interface ParsedChecklistLine {
  name: string;
  qty: string;
  checked: boolean;
  category: CategoryId;
}

const BOX_UNCHECKED = '\u2610';
const BOX_CHECKED = '\u2611';
const CHECK_MARK = '\u2713';

function formatItemLine(item: ShoppingItem, format: ChecklistExportOptions['format']): string {
  const label = item.qty ? `${item.qty} ${item.name}` : item.name;
  switch (format) {
    case 'markdown':
      return `- [${item.checked ? 'x' : ' '}] ${label}`;
    case 'unicode':
      return `${item.checked ? BOX_CHECKED : BOX_UNCHECKED} ${label}`;
    case 'notes-plain':
    default:
      // Clean lines with zero bullet prefix so tapping the Checklist button in
      // Apple Notes / Google Keep / Samsung Notes turns every line into a native checkbox
      return item.checked ? `${CHECK_MARK} ${label}` : label;
  }
}

/**
 * Formats a ShoppingList into clean text ready to paste into Apple Notes, Google Keep,
 * Samsung Notes, Notion, Obsidian, or chat messages.
 */
export function exportListAsChecklist(
  list: ShoppingList,
  options: ChecklistExportOptions
): string {
  const activeItems = Object.values(list.items)
    .filter((i) => !i.deletedAt && (options.includeChecked || !i.checked))
    .sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  if (activeItems.length === 0) {
    return `${list.title}\n(Empty list)`;
  }

  if (!options.groupByCategory) {
    const lines = activeItems.map((item) => formatItemLine(item, options.format));
    if (options.format === 'notes-plain') {
      return lines.join('\n');
    }
    return `${list.title}\n\n${lines.join('\n')}`;
  }

  const grouped = new Map<CategoryId, ShoppingItem[]>();
  for (const item of activeItems) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  const sections: string[] = [];
  if (options.format !== 'notes-plain') {
    sections.push(list.title);
  }

  for (const cat of CATEGORIES) {
    const bucket = grouped.get(cat.id);
    if (!bucket || bucket.length === 0) continue;
    const header = options.format === 'markdown' ? `### ${cat.shortLabel}` : cat.shortLabel;
    const itemLines = bucket.map((item) => formatItemLine(item, options.format)).join('\n');
    sections.push(`${header}\n${itemLines}`);
  }

  return sections.join('\n\n');
}

const KNOWN_HEADERS = new Set(
  CATEGORIES.flatMap((c) => [c.label.toLowerCase(), c.shortLabel.toLowerCase(), 'candy'])
);

const CHECKED_BRACKET_RE = /^(?:[-*\u2022]\s*)?\[[xX\u2713\u2714]\]\s+/;
const CHECKED_GLYPH_RE = /^[\u2611\u2705\u2713\u2714]\s+/;
const UNCHECKED_BRACKET_RE = /^(?:[-*\u2022]\s*)?\[\s?\]\s+/;
const UNCHECKED_GLYPH_RE = /^[\u2610\u2B1C\u25FB\u25AB\u2022*\u2013\u2014-]\s+/;

/**
 * Parses pasted multi-line checklists from Apple Notes, Google Keep, Markdown, or chat messages
 * back into structured, auto-categorized CozyCart grocery items.
 */
export function parsePastedChecklist(
  rawText: string,
  learnedCategories: Record<string, CategoryId> = {}
): ParsedChecklistLine[] {
  const lines = rawText.split(/\r?\n/);
  const parsed: ParsedChecklistLine[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Skip markdown headings or exported aisle headers
    const withoutHashes = line.replace(/^#{1,6}\s*/, '').trim();
    const strippedHeader = withoutHashes
      .replace(/^[\p{Emoji}\p{Emoji_Component}\s]+/u, '')
      .trim()
      .toLowerCase();

    if (
      line.startsWith('#') ||
      KNOWN_HEADERS.has(line.toLowerCase()) ||
      KNOWN_HEADERS.has(withoutHashes.toLowerCase()) ||
      KNOWN_HEADERS.has(strippedHeader) ||
      line === '(Empty list)'
    ) {
      continue;
    }

    let checked = false;

    if (CHECKED_BRACKET_RE.test(line)) {
      checked = true;
      line = line.replace(CHECKED_BRACKET_RE, '');
    } else if (CHECKED_GLYPH_RE.test(line)) {
      checked = true;
      line = line.replace(CHECKED_GLYPH_RE, '');
    } else if (UNCHECKED_BRACKET_RE.test(line)) {
      line = line.replace(UNCHECKED_BRACKET_RE, '');
    } else if (UNCHECKED_GLYPH_RE.test(line)) {
      line = line.replace(UNCHECKED_GLYPH_RE, '');
    } else if (/^\d+[.)]\s+/.test(line)) {
      line = line.replace(/^\d+[.)]\s+/, '');
    }

    const cleaned = line.trim();
    if (!cleaned) continue;

    const strippedEmoji = cleaned
      .replace(/^[\p{Emoji}\p{Emoji_Component}\s]+/u, '')
      .trim()
      .toLowerCase();
    if (
      cleaned !== strippedEmoji &&
      Object.values(CATEGORY_MAP).some(
        (c) =>
          strippedEmoji === c.shortLabel.toLowerCase() || strippedEmoji === c.label.toLowerCase()
      )
    ) {
      continue;
    }

    const { name, qty } = parseItemInput(cleaned);
    if (!name) continue;

    parsed.push({
      name,
      qty,
      checked,
      category: categorizeItem(name, learnedCategories),
    });
  }

  return parsed;
}
