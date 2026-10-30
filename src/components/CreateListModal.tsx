import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { MAX_LIST_TITLE_LENGTH } from '../hooks/useHouseholdStore';
import { ModalDialog } from './ModalDialog';

const EMOJI_CHOICES = ['🛒', '🧺', '🍓', '🥛', '🌮', '🍂', '❄️', '🌸', '☀️', '🎉', '🏕️', '🏠'];
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
  const suggestions = useMemo(() => {
    const now = new Date();
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
    const nextMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(nextMonthDate);
    return [
      { label: nextMonth, emoji: '🍂' },
      { label: thisMonth, emoji: '🛒' },
      { label: 'Weekly Groceries', emoji: '🍓' },
      { label: 'Taco Friday', emoji: '🌮' },
      { label: 'Party & Snacks', emoji: '🎉' },
      { label: 'Weekend Trip', emoji: '🏕️' },
    ];
  }, []);

  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🛒');
  const [carryOver, setCarryOver] = useState(false);
  const [selectedStaples, setSelectedStaples] = useState<string[]>([]);

  const toggleStaple = (item: string) => {
    setSelectedStaples((curr) =>
      curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || suggestions[0]!.label;
    onCreate({
      title: finalTitle,
      emoji,
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
      title="Create a New Shopping List"
      subtitle="Name it anything—a month, a trip, a dinner party, or a store!"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-extrabold text-[var(--text-muted)]">
            Choose a cute icon
          </label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-lg transition ${
                  emoji === em
                    ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent-bg)]'
                    : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="new-list-title"
            className="mb-1.5 block text-xs font-extrabold text-[var(--text-muted)]"
          >
            List name
          </label>
          <input
            id="new-list-title"
            type="text"
            value={title}
            maxLength={MAX_LIST_TITLE_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${suggestions[0]!.label}, Taco Night, IKEA Run…`}
            className="h-11 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-page)] px-3.5 text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent-bg)] focus:outline-none"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setTitle(s.label);
                  setEmoji(s.emoji);
                }}
                className="cursor-pointer rounded-full border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent-bg)] hover:text-[var(--text-main)]"
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        {uncheckedCountInCurrent > 0 && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-subtle)]/60 p-3">
            <input
              type="checkbox"
              checked={carryOver}
              onChange={(e) => setCarryOver(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent-bg)]"
            />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
              Carry over {uncheckedCountInCurrent} unchecked{' '}
              {uncheckedCountInCurrent === 1 ? 'item' : 'items'} from &quot;{currentListTitle}&quot;
            </span>
          </label>
        )}

        <div>
          <span className="mb-1.5 block text-xs font-extrabold text-[var(--text-muted)]">
            Quick-add household staples (optional)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_STAPLES.map((staple) => {
              const active = selectedStaples.includes(staple);
              return (
                <button
                  key={staple}
                  type="button"
                  onClick={() => toggleStaple(staple)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition ${
                    active
                      ? 'border-[var(--accent-bg)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-soft)] bg-[var(--bg-page)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  {active ? '✓ ' : '+ '}
                  {staple}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-2xl px-4 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-2xl bg-[var(--accent-bg)] px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Create List
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
