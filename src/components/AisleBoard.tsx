import {
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
} from 'lucide-react';
import { CATEGORIES } from '../lib/categorizer';
import { MAX_LIST_TITLE_LENGTH } from '../hooks/useHouseholdStore';
import { ItemRow } from './ItemRow';
import type { CategoryId, ShoppingItem, ShoppingList } from '../types/shopping';

const EMPTY_STAPLE_GROUPS: ReadonlyArray<{
  title: string;
  tone: string;
  items: ReadonlyArray<string>;
}> = [
  {
    title: 'Dairy & eggs',
    tone: 'cat-dairy',
    items: ['2x Oat milk', 'Free-range eggs', 'Salted butter', 'Greek yogurt'],
  },
  {
    title: 'Produce & fruit',
    tone: 'cat-produce',
    items: ['Bananas', 'Avocados', 'Cherry tomatoes', 'Fresh lemons'],
  },
  {
    title: 'Bakery & pantry',
    tone: 'cat-bakery',
    items: ['Sourdough bread', 'Extra virgin olive oil', 'Pasta', 'Coffee beans'],
  },
  {
    title: 'Household & treats',
    tone: 'cat-candy',
    items: ['Dish soap', 'Paper towels', 'Dark chocolate', 'Sparkling water'],
  },
];

const TWO_COL_QUERY = '(min-width: 768px)';

function subscribeTwoColumn(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(TWO_COL_QUERY);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getTwoColumnSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(TWO_COL_QUERY).matches;
}

interface AisleBoardProps {
  list: ShoppingList;
  isGuestList: boolean;
  onToggleItem: (id: string) => void;
  onChangeItemCategory: (id: string, cat: CategoryId) => void;
  onRemoveItem: (id: string) => void;
  onClearChecked: () => void;
  onUncheckAll: () => void;
  onRenameList: (listCode: string, nextTitle: string, nextEmoji?: string) => void;
  onQuickAddStarter: (name: string) => void;
  onOpenChecklistModal: () => void;
  onOpenShareList: () => void;
  composerSlot: ReactNode;
}

export function AisleBoard({
  list,
  isGuestList,
  onToggleItem,
  onChangeItemCategory,
  onRemoveItem,
  onClearChecked,
  onUncheckAll,
  onRenameList,
  onQuickAddStarter,
  onOpenChecklistModal,
  onOpenShareList,
  composerSlot,
}: AisleBoardProps) {
  const [viewMode, setViewMode] = useState<'aisle' | 'recent'>('aisle');
  const [checkedOpen, setCheckedOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(list.title);
  const renameInputId = useId();
  const isTwoColumn = useSyncExternalStore(subscribeTwoColumn, getTwoColumnSnapshot, () => false);

  const { unchecked, checked } = useMemo(() => {
    const u: ShoppingItem[] = [];
    const c: ShoppingItem[] = [];
    for (const item of Object.values(list.items)) {
      if (item.deletedAt) continue;
      if (item.checked) c.push(item);
      else u.push(item);
    }
    u.sort((a, b) => b.updatedAt - a.updatedAt);
    c.sort((a, b) => b.updatedAt - a.updatedAt);
    return { unchecked: u, checked: c };
  }, [list.items]);

  const groupedAisles = useMemo(() => {
    const map = new Map<CategoryId, ShoppingItem[]>();
    for (const item of unchecked) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return CATEGORIES.map((cat) => ({
      cat,
      items: (map.get(cat.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.items.length > 0);
  }, [unchecked]);

  const balancedColumns = useMemo(() => {
    if (groupedAisles.length <= 1) {
      return { cols: [groupedAisles, []] as const, diff: 0 };
    }
    const n = groupedAisles.length;
    const heights = groupedAisles.map((g) => 58 + g.items.length * 42.5);
    let bestMask = 0;
    let bestDiff = Infinity;
    const limit = 1 << (n - 1);
    for (let mask = 0; mask < limit; mask++) {
      let leftH = heights[0]!;
      let leftCount = 1;
      let rightH = 0;
      let rightCount = 0;
      for (let i = 1; i < n; i++) {
        if ((mask & (1 << (i - 1))) !== 0) {
          rightH += heights[i]!;
          rightCount++;
        } else {
          leftH += heights[i]!;
          leftCount++;
        }
      }
      if (rightCount === 0) continue;
      leftH += (leftCount - 1) * 15;
      rightH += (rightCount - 1) * 15;
      const diff = Math.abs(leftH - rightH);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMask = mask;
      }
    }
    const left: typeof groupedAisles = [groupedAisles[0]!];
    const right: typeof groupedAisles = [];
    for (let i = 1; i < n; i++) {
      if ((bestMask & (1 << (i - 1))) !== 0) right.push(groupedAisles[i]!);
      else left.push(groupedAisles[i]!);
    }
    return { cols: [left, right] as const, diff: bestDiff };
  }, [groupedAisles]);

  const startEditing = () => {
    setDraftTitle(list.title);
    setEditingTitle(true);
  };

  const commitRename = (e?: FormEvent) => {
    e?.preventDefault();
    onRenameList(list.listCode, draftTitle);
    setEditingTitle(false);
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      setEditingTitle(false);
    }
  };

  const totalActiveCount = unchecked.length + checked.length;
  const progressPercent =
    totalActiveCount > 0 ? Math.round((checked.length / totalActiveCount) * 100) : 0;

  const statusLine =
    totalActiveCount === 0
      ? 'Empty list, ready for groceries'
      : unchecked.length === 0
        ? `All ${checked.length} ${checked.length === 1 ? 'item' : 'items'} in cart`
        : `${unchecked.length} left to buy, ${checked.length} in cart`;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* List Title & Toolbar */}
      <div className="flex flex-col gap-3">
        {editingTitle ? (
          <form onSubmit={commitRename} className="flex flex-wrap items-center gap-2">
            <label htmlFor={renameInputId} className="sr-only">
              List name
            </label>
            <input
              id={renameInputId}
              type="text"
              value={draftTitle}
              maxLength={MAX_LIST_TITLE_LENGTH}
              autoFocus
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              placeholder="Name your list anything"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] px-3 text-[16px] font-medium text-[var(--text-main)] focus:outline-2 focus:outline-[var(--accent-bg)]"
            />
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--primary-bg)] px-4 text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Check className="h-4 w-4" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingTitle(false)}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-lg px-3 text-[14px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1
                  title={list.title}
                  className="font-editorial min-w-0 truncate text-[24px] leading-[1.15] font-normal text-[var(--text-main)] sm:text-[32px]"
                >
                  {list.title}
                </h1>
                <button
                  type="button"
                  onClick={startEditing}
                  aria-label="Rename list"
                  title="Rename list"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {isGuestList && (
                  <span className="shrink-0 rounded-md bg-[var(--bg-surface)] px-2 py-0.5 text-[13px] font-medium text-[var(--text-muted)]">
                    Shared list
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px]">
                <span className="tabular text-[var(--text-muted)]">{statusLine}</span>
                {checked.length > 0 && unchecked.length > 0 && (
                  <span className="tabular rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[13px] font-medium text-[var(--accent-ink)]">
                    {progressPercent}% gathered
                  </span>
                )}
              </div>
            </div>

            {/* Compact Segmented View Switch + Desktop List Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="List grouping"
                className="inline-flex rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('aisle')}
                  aria-pressed={viewMode === 'aisle'}
                  className={`h-8 cursor-pointer rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                    viewMode === 'aisle'
                      ? 'bg-[var(--bg-raised)] text-[var(--text-main)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  By aisle
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('recent')}
                  aria-pressed={viewMode === 'recent'}
                  className={`h-8 cursor-pointer rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                    viewMode === 'recent'
                      ? 'bg-[var(--bg-raised)] text-[var(--text-main)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Added
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenChecklistModal}
                className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] px-3 text-[14px] font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface)] lg:inline-flex"
                title="Copy or paste checklist for Apple Notes or Google Keep"
              >
                <ClipboardList className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Copy list</span>
              </button>

              <button
                type="button"
                onClick={onOpenShareList}
                className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] px-3 text-[14px] font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface)] lg:inline-flex"
                title="Share just this list via Friend Code or QR"
              >
                <Share2 className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Share list</span>
              </button>
            </div>
          </div>
        )}

        {/* Basket Completion Progress */}
        {totalActiveCount > 0 && (
          <div
            role="progressbar"
            aria-label="Shopping basket progress"
            aria-valuemin={0}
            aria-valuemax={totalActiveCount}
            aria-valuenow={checked.length}
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--accent-soft)]"
          >
            <div
              data-progress-fill=""
              className="h-full bg-[var(--accent-bg)] transition-[width] duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Inline Item Composer (anchored at bottom on phones) */}
      {composerSlot}

      {/* Empty State: Balanced 2x2 Common Kitchen Staples Board */}
      {totalActiveCount === 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-[var(--text-main)]">
              Common kitchen staples
            </h2>
            <span className="text-[13px] text-[var(--text-muted)]">
              Tap an item to add it, or paste a checklist from your Notes app
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {EMPTY_STAPLE_GROUPS.map((group) => (
              <section
                key={group.title}
                className={`${group.tone} rounded-xl border border-[var(--aisle-rule)] bg-[var(--aisle-bg)] px-4 py-3.5`}
              >
                <div className="mb-2 flex items-center justify-between px-1.5">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--aisle-ink)]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--aisle-dot)]"
                      aria-hidden="true"
                    />
                    <span>{group.title}</span>
                  </h3>
                  <span className="rounded-md bg-[var(--aisle-pill-bg)] px-2 py-0.5 text-[13px] font-medium text-[var(--aisle-ink)]">
                    Quick add
                  </span>
                </div>
                <ul role="list">
                  {group.items.map((sample) => (
                    <li
                      key={sample}
                      className="border-t border-[var(--aisle-rule)] first:border-t-0"
                    >
                      <button
                        type="button"
                        onClick={() => onQuickAddStarter(sample)}
                        className="flex h-10 w-full cursor-pointer items-center justify-between rounded-lg px-1.5 text-left text-[14px] text-[var(--text-main)] transition-colors hover:bg-[var(--aisle-pill-bg)]/55"
                      >
                        <span>{sample}</span>
                        <Plus className="h-4 w-4 shrink-0 text-[var(--aisle-ink)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Unchecked Items Grouped by Aisle */}
      {unchecked.length > 0 && viewMode === 'aisle' && (
        isTwoColumn && balancedColumns.cols[1].length > 0 ? (
          <div
            className={`grid grid-cols-2 gap-4 ${
              balancedColumns.diff <= 36 ? '' : 'items-start'
            }`}
          >
            {balancedColumns.cols.map((col, colIdx) => (
              <div
                key={colIdx}
                className={`flex min-w-0 flex-col gap-4 ${
                  balancedColumns.diff <= 36 ? '[&>section:last-child]:flex-1' : ''
                }`}
              >
                {col.map(({ cat, items }) => (
                  <section
                    key={cat.id}
                    className={`${cat.tone} rounded-xl border border-[var(--aisle-rule)] bg-[var(--aisle-bg)] px-4 py-3.5`}
                  >
                    <div className="mb-1.5 flex items-center justify-between px-1.5">
                      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--aisle-ink)]">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--aisle-dot)]"
                          aria-hidden="true"
                        />
                        <span>{cat.label}</span>
                      </h2>
                      <span className="tabular rounded-md bg-[var(--aisle-pill-bg)] px-2 py-0.5 text-[13px] font-medium text-[var(--aisle-ink)]">
                        {items.length}
                      </span>
                    </div>
                    <ul role="list">
                      {items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          showCategoryLabel={false}
                          onToggle={onToggleItem}
                          onChangeCategory={onChangeItemCategory}
                          onRemove={onRemoveItem}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {groupedAisles.map(({ cat, items }) => (
              <section
                key={cat.id}
                className={`${cat.tone} rounded-xl border border-[var(--aisle-rule)] bg-[var(--aisle-bg)] px-4 py-3.5`}
              >
                <div className="mb-1.5 flex items-center justify-between px-1.5">
                  <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--aisle-ink)]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--aisle-dot)]"
                      aria-hidden="true"
                    />
                    <span>{cat.label}</span>
                  </h2>
                  <span className="tabular rounded-md bg-[var(--aisle-pill-bg)] px-2 py-0.5 text-[13px] font-medium text-[var(--aisle-ink)]">
                    {items.length}
                  </span>
                </div>
                <ul role="list">
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      showCategoryLabel={false}
                      onToggle={onToggleItem}
                      onChangeCategory={onChangeItemCategory}
                      onRemove={onRemoveItem}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      )}

      {/* Unchecked Items Ordered by Recently Added */}
      {unchecked.length > 0 && viewMode === 'recent' && (
        <section className="rounded-xl bg-[var(--bg-surface)] px-4 py-3.5">
          <ul role="list">
            {unchecked.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                showCategoryLabel
                onToggle={onToggleItem}
                onChangeCategory={onChangeItemCategory}
                onRemove={onRemoveItem}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Checked ("In cart") Collapsible Section */}
      {checked.length > 0 && (
        <section className="rounded-xl bg-[var(--bg-surface)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 py-1">
            <button
              type="button"
              onClick={() => setCheckedOpen((v) => !v)}
              className="tabular flex cursor-pointer items-center gap-1.5 text-[14px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
            >
              {checkedOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>In cart ({checked.length})</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onUncheckAll}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Uncheck all</span>
              </button>
              <button
                type="button"
                onClick={onClearChecked}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-[var(--danger-text)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear checked</span>
              </button>
            </div>
          </div>

          {checkedOpen && (
            <ul className="mt-1" role="list">
              {checked.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  showCategoryLabel
                  onToggle={onToggleItem}
                  onChangeCategory={onChangeItemCategory}
                  onRemove={onRemoveItem}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
