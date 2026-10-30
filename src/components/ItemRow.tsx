import { useState } from 'react';
import { ArrowLeftRight, Check, Trash2 } from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP } from '../lib/categorizer';
import type { CategoryId, ShoppingItem } from '../types/shopping';

interface ItemRowProps {
  item: ShoppingItem;
  showCategoryLabel?: boolean;
  onToggle: (id: string) => void;
  onChangeCategory: (id: string, category: CategoryId) => void;
  onRemove: (id: string) => void;
}

export function ItemRow({
  item,
  showCategoryLabel = false,
  onToggle,
  onChangeCategory,
  onRemove,
}: ItemRowProps) {
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const cat = CATEGORY_MAP[item.category] ?? CATEGORY_MAP.other;

  return (
    <li className="group relative flex flex-col border-t border-[var(--border-rule)] first:border-t-0">
      <div className="flex min-h-11 items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-[var(--bg-subtle)]/65">
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-pressed={item.checked}
          aria-label={item.checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
          className={`flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition-colors ${
            item.checked
              ? 'border-[var(--accent-bg)] bg-[var(--accent-bg)] text-[var(--primary-ink)]'
              : 'border-[var(--border-strong)] bg-[var(--bg-raised)] hover:border-[var(--accent-bg)]'
          }`}
        >
          {item.checked && <Check className="h-3 w-3 stroke-[2.75]" />}
        </button>

        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-baseline gap-2 text-left"
        >
          {item.qty && (
            <span className="tabular shrink-0 rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[13px] font-medium text-[var(--text-muted)]">
              {item.qty}
            </span>
          )}
          <span
            className={`min-w-0 break-words [overflow-wrap:anywhere] text-[15px] ${
              item.checked
                ? 'text-[var(--text-faint)] line-through'
                : 'font-normal text-[var(--text-main)]'
            }`}
          >
            {item.name}
          </span>
        </button>

        {showCategoryLabel ? (
          <button
            type="button"
            onClick={() => setCatMenuOpen((v) => !v)}
            title="Move to another aisle (remembered for your household)"
            className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${cat.tone}`} aria-hidden="true" />
            <span className="hidden sm:inline">{cat.shortLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCatMenuOpen((v) => !v)}
            aria-label={`Change aisle for ${item.name}`}
            title="Move to another aisle (remembered for your household)"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] opacity-70 transition-opacity hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Delete ${item.name}`}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] opacity-70 transition-opacity hover:bg-[var(--bg-hover)] hover:text-[var(--danger-text)] focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {catMenuOpen && (
        <div className="mx-1.5 mb-2 flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-raised)] p-3">
          <span className="w-full text-[13px] font-medium text-[var(--text-muted)]">
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
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium transition-colors ${
                c.id === item.category
                  ? 'border-[var(--accent-bg)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                  : 'border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${c.tone}`} aria-hidden="true" />
              <span>{c.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
