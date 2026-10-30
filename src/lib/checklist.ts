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

function formatItemLine(item: ShoppingItem, format: ChecklistExportOptions['format']): string {
  const label = item.qty ? `${item.qty} ${item.name}` : item.name;
  switch (format) {
    case 'markdown':
      return `- [${item.checked ? 'x' : ' '}] ${label}`;
    case 'unicode':
      return `${item.checked ? '☑' : '☐'} ${label}`;
    case 'notes-plain':
    default:
      // Clean lines with zero bullet prefix so tapping the Checklist button in
      // Apple Notes / Google Keep / Samsung Notes turns every line into a native checkbox!
      return item.checked ? `✓ ${label}` : label;
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
    return `${list.emoji} ${list.title}\n(Empty list)`;
  }

  if (!options.groupByCategory) {
    const lines = activeItems.map((item) => formatItemLine(item, options.format));
    if (options.format === 'notes-plain') {
      // Pure item lines make "Select All -> Checklist" in Apple Notes / Keep 1-tap clean
      return lines.join('\n');
    }
    return `${list.emoji} ${list.title}\n\n${lines.join('\n')}`;
  }

  const grouped = new Map<CategoryId, ShoppingItem[]>();
  for (const item of activeItems) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  const sections: string[] = [];
  if (options.format !== 'notes-plain') {
    sections.push(`${list.emoji} ${list.title}`);
  }

  for (const cat of CATEGORIES) {
    const bucket = grouped.get(cat.id);
    if (!bucket || bucket.length === 0) continue;
    const header =
      options.format === 'markdown'
        ? `### ${cat.emoji} ${cat.shortLabel}`
        : `${cat.emoji} ${cat.shortLabel}`;
    const itemLines = bucket.map((item) => formatItemLine(item, options.format)).join('\n');
    sections.push(`${header}\n${itemLines}`);
  }

  return sections.join('\n\n');
}

const KNOWN_HEADERS = new Set(
  CATEGORIES.flatMap((c) => [
    c.label.toLowerCase(),
    c.shortLabel.toLowerCase(),
    `${c.emoji} ${c.label}`.toLowerCase(),
    `${c.emoji} ${c.shortLabel}`.toLowerCase(),
  ])
);

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

    // Skip markdown headings or our own exported aisle headers
    const withoutHashes = line.replace(/^#{1,6}\s*/, '').trim();
    if (
      line.startsWith('#') ||
      KNOWN_HEADERS.has(line.toLowerCase()) ||
      KNOWN_HEADERS.has(withoutHashes.toLowerCase()) ||
      line === '(Empty list)'
    ) {
      continue;
    }

    let checked = false;

    // Detect checked markers: - [x], * [X], [x], ☑, ✅, ✓, ✔
    if (/^(?:[-*•]\s*)?\[[xX✓✔]\]\s+/.test(line)) {
      checked = true;
      line = line.replace(/^(?:[-*•]\s*)?\[[xX✓✔]\]\s+/, '');
    } else if (/^[☑✅✓✔]\s+/.test(line)) {
      checked = true;
      line = line.replace(/^[☑✅✓✔]\s+/, '');
    } else if (/^(?:[-*•]\s*)?\[\s?\]\s+/.test(line)) {
      // Unchecked markdown checkbox: - [ ] Milk
      line = line.replace(/^(?:[-*•]\s*)?\[\s?\]\s+/, '');
    } else if (/^[☐⬜◻▫•*–—-]\s+/.test(line)) {
      // Unchecked unicode checkbox or bullet
      line = line.replace(/^[☐⬜◻▫•*–—-]\s+/, '');
    } else if (/^\d+[.)]\s+/.test(line)) {
      // Numbered list: "1. Milk"
      line = line.replace(/^\d+[.)]\s+/, '');
    }

    const cleaned = line.trim();
    if (!cleaned) continue;

    // Skip if line matches an aisle emoji+name header after stripping
    const strippedEmoji = cleaned.replace(/^[\p{Emoji}\p{Emoji_Component}\s]+/u, '').trim().toLowerCase();
    if (
      Object.values(CATEGORY_MAP).some(
        (c) =>
          cleaned === `${c.emoji} ${c.shortLabel}` ||
          cleaned === `${c.emoji} ${c.label}` ||
          (cleaned.startsWith(c.emoji) && (strippedEmoji === c.shortLabel.toLowerCase() || strippedEmoji === c.label.toLowerCase()))
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
