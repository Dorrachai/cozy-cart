import { useId, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP, categorizeItem } from '../lib/categorizer';
import type { CategoryId } from '../types/shopping';

interface QuickAddBarProps {
  learnedCategories: Record<string, CategoryId>;
  categorizerReady: boolean;
  onAddItem: (rawInput: string, explicitCategory?: CategoryId) => void;
  onPasteMultiLine: (rawText: string) => number;
}

export function QuickAddBar({
  learnedCategories,
  categorizerReady,
  onAddItem,
  onPasteMultiLine,
}: QuickAddBarProps) {
  const [text, setText] = useState('');
  const [overrideCategory, setOverrideCategory] = useState<CategoryId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  const detectedCategory: CategoryId = useMemo(() => {
    if (overrideCategory) return overrideCategory;
    if (!text.trim()) return 'other';
    void categorizerReady;
    return categorizeItem(text, learnedCategories);
  }, [text, overrideCategory, learnedCategories, categorizerReady]);

  const catMeta = CATEGORY_MAP[detectedCategory];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAddItem(text, overrideCategory ?? undefined);
    setText('');
    setOverrideCategory(null);
    setPickerOpen(false);
    inputRef.current?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && /\r?\n/.test(pasted.trim())) {
      const count = onPasteMultiLine(pasted);
      if (count > 0) {
        e.preventDefault();
        setText('');
        setOverrideCategory(null);
      }
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-soft)] bg-[var(--bg-page)] px-5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0">
      <div className="relative mx-auto max-w-4xl lg:max-w-none">
        {pickerOpen && (
          <div className="mb-2 flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-3">
            <span className="w-full px-0.5 text-[13px] font-medium text-[var(--text-muted)]">
              Choose aisle for this item:
            </span>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setOverrideCategory(c.id);
                  setPickerOpen(false);
                  inputRef.current?.focus();
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium transition-colors ${
                  c.id === detectedCategory
                    ? 'border-[var(--accent-bg)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                    : 'border-[var(--border-soft)] bg-[var(--bg-raised)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${c.tone}`} aria-hidden="true" />
                <span>{c.shortLabel}</span>
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-raised)] px-2 py-1.5 focus-within:outline-2 focus-within:outline-[var(--accent-bg)]"
        >
          <label htmlFor={inputId} className="sr-only">
            Add item to shopping list
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={text}
            maxLength={100}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value.trim()) setOverrideCategory(null);
            }}
            onPaste={handlePaste}
            placeholder="Add an item (e.g. 2x oat milk) or paste"
            className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[15px] text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:outline-none"
          />

          {text.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title="Detected aisle (click to change)"
              className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-2.5 text-[13px] font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${catMeta.tone}`} aria-hidden="true" />
              <span className="hidden sm:inline">{catMeta.shortLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </button>
          )}

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Add item"
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--primary-bg)] px-3.5 text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
      </div>
    </div>
  );
}
