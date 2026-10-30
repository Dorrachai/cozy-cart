import { useMemo, useState } from 'react';
import { Check, ClipboardCopy, ClipboardPaste, Sparkles } from 'lucide-react';
import { CATEGORY_MAP } from '../lib/categorizer';
import { exportListAsChecklist, parsePastedChecklist } from '../lib/checklist';
import { ModalDialog } from './ModalDialog';
import type { CategoryId, ChecklistFormat, ShoppingList } from '../types/shopping';

interface ChecklistModalProps {
  open: boolean;
  onClose: () => void;
  list: ShoppingList;
  learnedCategories: Record<string, CategoryId>;
  onImportText: (rawText: string) => number;
}

export function ChecklistModal({
  open,
  onClose,
  list,
  learnedCategories,
  onImportText,
}: ChecklistModalProps) {
  const [tab, setTab] = useState<'copy' | 'paste'>('copy');
  const [format, setFormat] = useState<ChecklistFormat>('unicode');
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [includeChecked, setIncludeChecked] = useState(false);
  const [copied, setCopied] = useState(false);

  const [pasteInput, setPasteInput] = useState('');

  const exportedText = useMemo(
    () =>
      exportListAsChecklist(list, {
        format,
        groupByCategory,
        includeChecked,
      }),
    [list, format, groupByCategory, includeChecked]
  );

  const parsedPreview = useMemo(
    () => parsePastedChecklist(pasteInput, learnedCategories),
    [pasteInput, learnedCategories]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback selection copy
    }
  };

  const handleImport = () => {
    const count = onImportText(pasteInput);
    if (count > 0) {
      setPasteInput('');
      onClose();
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Notes App Checklist"
      subtitle="Heading into a store without internet? Copy your list into your phone's Notes app—or paste a Notes list back in!"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--bg-subtle)] p-1">
          <button
            type="button"
            onClick={() => setTab('copy')}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition ${
              tab === 'copy'
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy to Notes
          </button>
          <button
            type="button"
            onClick={() => setTab('paste')}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition ${
              tab === 'paste'
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste from Notes
          </button>
        </div>

        {tab === 'copy' ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'unicode', label: '☐ Checkboxes (Universal)' },
                  { id: 'notes-plain', label: 'Apple Notes / Keep Lines' },
                  { id: 'markdown', label: '- [ ] Markdown' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    format === opt.id
                      ? 'border-[var(--accent-bg)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-soft)] bg-[var(--bg-page)] text-[var(--text-muted)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-semibold text-[var(--text-muted)]">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-bg)]"
                />
                Group by aisle
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeChecked}
                  onChange={(e) => setIncludeChecked(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-bg)]"
                />
                Include checked items
              </label>
            </div>

            <textarea
              readOnly
              value={exportedText}
              rows={8}
              aria-label="Formatted checklist text"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-y rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-page)] p-3 font-mono text-xs leading-relaxed text-[var(--text-main)] focus:outline-none"
            />

            <button
              type="button"
              onClick={handleCopy}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-bg)] text-sm font-extrabold text-white shadow-xs transition hover:bg-[var(--accent-hover)]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  Copied! Ready to paste in Notes ✨
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4" />
                  Copy Checklist
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              rows={7}
              placeholder={"Paste lines from Apple Notes, Google Keep, or messages:\n- [ ] 2x Oat milk\n☐ Sour gummies\n• Sourdough bread"}
              aria-label="Paste checklist lines"
              className="w-full resize-y rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-page)] p-3 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:ring-2 focus:ring-[var(--accent-bg)] focus:outline-none"
            />

            {parsedPreview.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-subtle)]/60 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-muted)]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent-ink)]" />
                  Auto-sorting {parsedPreview.length}{' '}
                  {parsedPreview.length === 1 ? 'item' : 'items'}:
                </p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {parsedPreview.map((p, idx) => {
                    const cat = CATEGORY_MAP[p.category];
                    return (
                      <span
                        key={`${p.name}-${idx}`}
                        className={`${cat.tone} inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold`}
                      >
                        <span>{cat.emoji}</span>
                        <span>
                          {p.qty ? `${p.qty} ` : ''}
                          {p.name}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={parsedPreview.length === 0}
              onClick={handleImport}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-bg)] text-sm font-extrabold text-white shadow-xs transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles className="h-4 w-4" />
              Add &amp; Auto-Sort {parsedPreview.length > 0 ? `${parsedPreview.length} Items` : 'Items'}
            </button>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
