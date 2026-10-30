import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP } from '../lib/categorizer';
import type { CategoryId, ShoppingItem } from '../types/shopping';

interface ItemRowProps {
  item: ShoppingItem;
  showCategoryBadge?: boolean;
  onToggle: (id: string) => void;
  onChangeCategory: (id: string, category: CategoryId) => void;
  onRemove: (id: string) => void;
}

export function ItemRow({
  item,
  showCategoryBadge = true,
  onToggle,
  onChangeCategory,
  onRemove,
}: ItemRowProps) {
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const cat = CATEGORY_MAP[item.category] ?? CATEGORY_MAP.other;

  return (
    <li className="group relative flex flex-col rounded-2xl transition hover:bg-[var(--bg-subtle)]/70">
      <div className="flex min-h-12 items-center gap-2.5 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-pressed={item.checked}
          aria-label={item.checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
          className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition ${
            item.checked
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--accent-bg)]'
          }`}
        >
          {item.checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
        </button>

        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-baseline gap-1.5 text-left"
        >
          {item.qty && (
            <span className="shrink-0 rounded-lg bg-[var(--accent-soft)] px-1.5 py-0.5 text-xs font-extrabold text-[var(--accent-ink)]">
              {item.qty}
            </span>
          )}
          <span
            className={`min-w-0 break-words [overflow-wrap:anywhere] text-sm font-semibold sm:text-[15px] ${
              item.checked ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-main)]'
            }`}
          >
            {item.name}
          </span>
        </button>

        {showCategoryBadge && (
          <button
            type="button"
            onClick={() => setCatMenuOpen((v) => !v)}
            title="Tap to change category (household remembers for next time!)"
            className={`${cat.tone} flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition hover:scale-105`}
          >
            <span>{cat.emoji}</span>
            <span className="hidden sm:inline">{cat.shortLabel}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Delete ${item.name}`}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--text-faint)] opacity-75 transition hover:bg-[var(--bg-hover)] hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {catMenuOpen && (
        <div className="mx-2.5 mb-2 flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-page)] p-2.5">
          <span className="w-full text-[11px] font-bold text-[var(--text-muted)]">
            Move &quot;{item.name}&quot; to aisle (saved for your household):
          </span>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChangeCategory(item.id, c.id);
                setCatMenuOpen(false);
              }}
              className={`${c.tone} inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                c.id === item.category ? 'ring-2 ring-[var(--accent-bg)]' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <span>{c.emoji}</span>
              <span>{c.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
