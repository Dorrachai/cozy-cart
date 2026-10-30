import { useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  ListOrdered,
  Pencil,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { CATEGORIES } from '../lib/categorizer';
import { MAX_LIST_TITLE_LENGTH } from '../hooks/useHouseholdStore';
import { ItemRow } from './ItemRow';
import type { CategoryId, ShoppingItem, ShoppingList } from '../types/shopping';

const QUICK_EMOJIS = ['🛒', '🧺', '🍓', '🥛', '🌮', '🍂', '❄️', '🌸', '☀️', '🎉', '🏕️', '🏠'];
const STARTER_SUGGESTIONS = ['2x Oat milk', 'Eggs', 'Sourdough bread', 'Bananas', 'Sour gummies', 'Dish soap'];

interface AisleBoardProps {
  list: ShoppingList;
  isGuestList: boolean;
  onToggleItem: (id: string) => void;
  onChangeItemCategory: (id: string, cat: CategoryId) => void;
  onRemoveItem: (id: string) => void;
  onAutoSort: () => void;
  onClearChecked: () => void;
  onUncheckAll: () => void;
  onRenameList: (listCode: string, nextTitle: string, nextEmoji?: string) => void;
  onQuickAddStarter: (name: string) => void;
  onOpenChecklistModal: () => void;
  onOpenShareList: () => void;
}

export function AisleBoard({
  list,
  isGuestList,
  onToggleItem,
  onChangeItemCategory,
  onRemoveItem,
  onAutoSort,
  onClearChecked,
  onUncheckAll,
  onRenameList,
  onQuickAddStarter,
  onOpenChecklistModal,
  onOpenShareList,
}: AisleBoardProps) {
  const [viewMode, setViewMode] = useState<'aisle' | 'recent'>('aisle');
  const [checkedOpen, setCheckedOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(list.title);
  const [draftEmoji, setDraftEmoji] = useState(list.emoji);

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

  const startEditing = () => {
    setDraftTitle(list.title);
    setDraftEmoji(list.emoji);
    setEditingTitle(true);
  };

  const commitRename = (e?: FormEvent) => {
    e?.preventDefault();
    onRenameList(list.listCode, draftTitle, draftEmoji);
    setEditingTitle(false);
  };

  const totalActiveCount = unchecked.length + checked.length;

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-28 lg:pb-10">
      {/* List Header Card — strictly overflow-proof for any custom list name */}
      <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        {editingTitle ? (
          <form onSubmit={commitRename} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setDraftEmoji(em)}
                  className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-lg transition ${
                    draftEmoji === em
                      ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent-bg)]'
                      : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draftTitle}
                maxLength={MAX_LIST_TITLE_LENGTH}
                autoFocus
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Name your list anything…"
                className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-page)] px-3.5 text-base font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent-bg)] focus:outline-none"
              />
              <button
                type="submit"
                className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-[var(--accent-bg)] px-4 text-sm font-bold text-white hover:bg-[var(--accent-hover)]"
              >
                <Check className="h-4 w-4" />
                Save
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={startEditing}
                title="Change list icon or name"
                className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-2xl transition hover:scale-105"
              >
                {list.emoji}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h1
                    title={list.title}
                    className="min-w-0 truncate text-xl font-extrabold tracking-tight sm:text-2xl"
                  >
                    {list.title}
                  </h1>
                  <button
                    type="button"
                    onClick={startEditing}
                    aria-label="Rename list"
                    title="Rename list"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {isGuestList && (
                    <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--text-muted)]">
                      Shared List
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {unchecked.length === 0 && checked.length > 0
                    ? 'All items checked off! 🎉'
                    : `${unchecked.length} to buy · ${checked.length} in cart`}
                </p>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onAutoSort}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 text-xs font-bold text-[var(--accent-ink)] transition hover:opacity-90"
                title="Auto-sort items into grocery categories"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto-Sort
              </button>

              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'aisle' ? 'recent' : 'aisle'))}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-3 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
                title="Switch between Aisle view and Recently Added order"
              >
                {viewMode === 'aisle' ? (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>By Aisle</span>
                  </>
                ) : (
                  <>
                    <ListOrdered className="h-3.5 w-3.5" />
                    <span>Recent</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenChecklistModal}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-3 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
                title="Copy as checklist for Apple Notes / Google Keep"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Copy Checklist</span>
              </button>

              <button
                type="button"
                onClick={onOpenShareList}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-3 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
                title="Share just this list via Friend Code"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share List</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {totalActiveCount === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/70 px-6 py-10 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--accent-soft)] text-3xl">
            🍓
          </div>
          <h2 className="text-base font-extrabold">Your basket is empty &amp; ready!</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--text-muted)]">
            Type items below (or paste a checklist from your Notes app). CozyCart automatically sorts them into cute aisles like Dairy, Produce, and Candy.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {STARTER_SUGGESTIONS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => onQuickAddStarter(sample)}
                className="cursor-pointer rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-main)] shadow-2xs transition hover:border-[var(--accent-bg)] hover:bg-[var(--accent-soft)]"
              >
                + {sample}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unchecked Items — Grouped by Cute Pastel Aisles OR Recent */}
      {unchecked.length > 0 && viewMode === 'aisle' && (
        <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
          {groupedAisles.map(({ cat, items }) => (
            <section
              key={cat.id}
              className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-card)]"
            >
              <div className="mb-1.5 flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`${cat.tone} inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </span>
                </div>
                <span className="text-xs font-bold text-[var(--text-faint)]">
                  {items.length}
                </span>
              </div>
              <ul className="divide-y divide-[var(--border-soft)]/50" role="list">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    showCategoryBadge
                    onToggle={onToggleItem}
                    onChangeCategory={onChangeItemCategory}
                    onRemove={onRemoveItem}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {unchecked.length > 0 && viewMode === 'recent' && (
        <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-card)]">
          <ul className="divide-y divide-[var(--border-soft)]/50" role="list">
            {unchecked.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                showCategoryBadge
                onToggle={onToggleItem}
                onChangeCategory={onChangeItemCategory}
                onRemove={onRemoveItem}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Checked ("In Cart") Collapsible Section */}
      {checked.length > 0 && (
        <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-subtle)]/65 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1">
            <button
              type="button"
              onClick={() => setCheckedOpen((v) => !v)}
              className="flex cursor-pointer items-center gap-1.5 text-xs font-extrabold text-[var(--text-muted)]"
            >
              {checkedOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>In Cart ({checked.length})</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onUncheckAll}
                className="inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]"
              >
                <RotateCcw className="h-3 w-3" />
                Uncheck all
              </button>
              <button
                type="button"
                onClick={onClearChecked}
                className="inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold text-rose-600 transition hover:bg-[var(--bg-surface)] dark:text-rose-400"
              >
                <Trash2 className="h-3 w-3" />
                Clear checked
              </button>
            </div>
          </div>

          {checkedOpen && (
            <ul className="mt-1 divide-y divide-[var(--border-soft)]/50" role="list">
              {checked.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  showCategoryBadge
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
