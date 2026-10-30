import { useId, useMemo, useState } from 'react';
import { Check, ClipboardCopy, ClipboardPaste, Plus } from 'lucide-react';
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

  const exportAreaId = useId();
  const pasteAreaId = useId();

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
      title="Notes app checklist"
      subtitle="Heading into a store with poor reception? Copy your list into Apple Notes or Google Keep, or paste lines back in."
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => setTab('copy')}
            className={`flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[14px] font-medium transition-colors ${
              tab === 'copy'
                ? 'bg-[var(--bg-raised)] text-[var(--text-main)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ClipboardCopy className="h-4 w-4" />
            <span>Copy to Notes</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('paste')}
            className={`flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[14px] font-medium transition-colors ${
              tab === 'paste'
                ? 'bg-[var(--bg-raised)] text-[var(--text-main)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ClipboardPaste className="h-4 w-4" />
            <span>Paste from Notes</span>
          </button>
        </div>

        {tab === 'copy' ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'unicode', label: 'Checkboxes (universal)' },
                  { id: 'notes-plain', label: 'Apple Notes / Keep lines' },
                  { id: 'markdown', label: 'Markdown (- [ ])' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    format === opt.id
                      ? 'border-[var(--accent-bg)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-soft)] bg-[var(--bg-page)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-[14px] text-[var(--text-muted)]">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-bg)]"
                />
                <span>Group by aisle</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeChecked}
                  onChange={(e) => setIncludeChecked(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-bg)]"
                />
                <span>Include checked items</span>
              </label>
            </div>

            <div>
              <label htmlFor={exportAreaId} className="sr-only">
                Formatted checklist text
              </label>
              <textarea
                id={exportAreaId}
                readOnly
                value={exportedText}
                rows={8}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--bg-page)] p-3 text-[14px] leading-relaxed text-[var(--text-main)] focus:outline-2 focus:outline-[var(--accent-bg)]"
              />
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--primary-bg)] text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied to clipboard</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4" />
                  <span>Copy checklist</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div>
              <label htmlFor={pasteAreaId} className="sr-only">
                Paste checklist lines
              </label>
              <textarea
                id={pasteAreaId}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                rows={7}
                placeholder={
                  'Paste lines from Apple Notes, Google Keep, or messages:\n- [ ] 2x Oat milk\n- Sourdough bread\n- Cherry tomatoes'
                }
                className="w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--bg-page)] p-3 text-[14px] leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:outline-2 focus:outline-[var(--accent-bg)]"
              />
            </div>

            {parsedPreview.length > 0 && (
              <div className="rounded-xl bg-[var(--bg-surface)] p-3">
                <p className="tabular mb-2 text-[13px] font-medium text-[var(--text-muted)]">
                  Detected {parsedPreview.length}{' '}
                  {parsedPreview.length === 1 ? 'item' : 'items'} by aisle:
                </p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {parsedPreview.map((p, idx) => {
                    const cat = CATEGORY_MAP[p.category];
                    return (
                      <span
                        key={`${p.name}-${idx}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-raised)] px-2.5 py-1 text-[13px] font-medium text-[var(--text-main)]"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${cat.tone}`}
                          aria-hidden="true"
                        />
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
              className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--primary-bg)] text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              <span>
                Add {parsedPreview.length > 0 ? `${parsedPreview.length} items` : 'items'} to list
              </span>
            </button>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
