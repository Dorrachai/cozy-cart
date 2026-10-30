import { useId, useMemo, useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { MAX_LIST_TITLE_LENGTH } from '../hooks/useHouseholdStore';
import { ModalDialog } from './ModalDialog';

const COMMON_STAPLES = [
  'Milk',
  'Eggs',
  'Butter',
  'Bread',
  'Bananas',
  'Coffee',
  'Pasta',
  'Toilet paper',
];

interface CreateListModalProps {
  open: boolean;
  onClose: () => void;
  currentListTitle: string;
  uncheckedCountInCurrent: number;
  onCreate: (opts: {
    title: string;
    emoji: string;
    carryOverUnchecked: boolean;
    initialStaples: string[];
  }) => void;
}

export function CreateListModal({
  open,
  onClose,
  currentListTitle,
  uncheckedCountInCurrent,
  onCreate,
}: CreateListModalProps) {
  const titleInputId = useId();

  const suggestions = useMemo(() => {
    const now = new Date();
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
    const nextMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(nextMonthDate);
    return [
      nextMonth,
      thisMonth,
      'Weekly groceries',
      'Taco Friday',
      'Dinner with friends',
      'Weekend cabin',
    ];
  }, []);

  const [title, setTitle] = useState('');
  const [carryOver, setCarryOver] = useState(false);
  const [selectedStaples, setSelectedStaples] = useState<string[]>([]);

  const toggleStaple = (item: string) => {
    setSelectedStaples((curr) =>
      curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || suggestions[0]!;
    onCreate({
      title: finalTitle,
      emoji: '',
      carryOverUnchecked: carryOver,
      initialStaples: selectedStaples,
    });
    setTitle('');
    setCarryOver(false);
    setSelectedStaples([]);
    onClose();
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="New shopping list"
      subtitle="Name it anything: a month, a dinner menu, a weekend trip, or a hardware run."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor={titleInputId}
            className="mb-1.5 block text-[14px] font-medium text-[var(--text-main)]"
          >
            List name
          </label>
          <input
            id={titleInputId}
            type="text"
            autoFocus
            value={title}
            maxLength={MAX_LIST_TITLE_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${suggestions[0]!}, Taco Friday, IKEA run`}
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-page)] px-3 text-[15px] text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:outline-2 focus:outline-[var(--accent-bg)]"
          />

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setTitle(label)}
                className="cursor-pointer rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2.5 py-1 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-main)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {uncheckedCountInCurrent > 0 && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--bg-surface)] p-3">
            <input
              type="checkbox"
              checked={carryOver}
              onChange={(e) => setCarryOver(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent-bg)]"
            />
            <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-main)]">
              Carry over {uncheckedCountInCurrent} unchecked{' '}
              {uncheckedCountInCurrent === 1 ? 'item' : 'items'} from &quot;{currentListTitle}&quot;
            </span>
          </label>
        )}

        <div>
          <span className="mb-2 block text-[14px] font-medium text-[var(--text-main)]">
            Include household staples (optional)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_STAPLES.map((staple) => {
              const active = selectedStaples.includes(staple);
              return (
                <button
                  key={staple}
                  type="button"
                  onClick={() => toggleStaple(staple)}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[13px] font-medium transition-colors ${
                    active
                      ? 'border-[var(--accent-bg)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-soft)] bg-[var(--bg-page)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>{staple}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded-lg px-3.5 text-[14px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--primary-bg)] px-4 text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            <span>Create list</span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
