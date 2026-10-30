import { useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { Plus, Sparkles } from 'lucide-react';
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

  const detectedCategory: CategoryId = useMemo(() => {
    if (overrideCategory) return overrideCategory;
    if (!text.trim()) return 'other';
    // Reference categorizerReady so preview refreshes once taxonomy finishes loading
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
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-soft)] bg-[var(--bg-page)]/95 px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <div className="relative mx-auto max-w-3xl lg:max-w-none">
        {pickerOpen && (
          <div className="mb-2 flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-2.5 shadow-lg">
            <span className="w-full px-1 text-[11px] font-bold text-[var(--text-muted)]">
              Pick aisle for this item:
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
                className={` ${c.tone} inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition hover:scale-105`}
              >
                <span>{c.emoji}</span>
                <span>{c.shortLabel}</span>
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-[var(--accent-bg)]"
        >
          <input
            ref={inputRef}
            type="text"
            value={text}
            maxLength={100}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value.trim()) setOverrideCategory(null);
            }}
            onPaste={handlePaste}
            placeholder="Add item (e.g. 2x oat milk, sour candy…) or paste a list"
            aria-label="Add item to shopping list"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:outline-none"
          />

          {text.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title="Auto-detected category (tap to override)"
              className={`${catMeta.tone} flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition hover:opacity-90`}
            >
              <span>{catMeta.emoji}</span>
              <span className="hidden sm:inline">{catMeta.shortLabel}</span>
              <Sparkles className="h-3 w-3 opacity-70" />
            </button>
          )}

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Add item"
            className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-bg)] px-4 text-sm font-bold text-white shadow-xs transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
      </div>
    </div>
  );
}
