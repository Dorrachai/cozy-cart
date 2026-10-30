import { KeyRound, Plus, Trash2 } from 'lucide-react';
import type { ShoppingList } from '../types/shopping';

interface ListSidebarProps {
  householdLists: ShoppingList[];
  guestLists: ShoppingList[];
  activeListCode: string;
  onSelectList: (listCode: string) => void;
  onOpenCreateList: () => void;
  onOpenJoinCode: () => void;
  onDeleteList: (list: ShoppingList) => void;
}

function countRemaining(list: ShoppingList): { remaining: number; total: number } {
  const all = Object.values(list.items).filter((i) => !i.deletedAt);
  const remaining = all.filter((i) => !i.checked).length;
  return { remaining, total: all.length };
}

export function ListSidebarContent({
  householdLists,
  guestLists,
  activeListCode,
  onSelectList,
  onOpenCreateList,
  onOpenJoinCode,
  onDeleteList,
}: ListSidebarProps) {
  const totalListsCount = householdLists.length + guestLists.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold tracking-wider text-[var(--text-muted)] uppercase">
          Household Lists
        </span>
        <button
          type="button"
          onClick={onOpenCreateList}
          className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--accent-ink)] transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New List
        </button>
      </div>

      <ul className="flex flex-col gap-1.5" role="list">
        {householdLists.map((list) => {
          const isActive = list.listCode === activeListCode;
          const { remaining, total } = countRemaining(list);
          return (
            <li key={list.listCode} className="group flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectList(list.listCode)}
                title={list.title}
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition ${
                  isActive
                    ? 'bg-[var(--accent-soft)] font-bold text-[var(--accent-ink)] shadow-2xs'
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <span className="shrink-0 text-lg leading-none">{list.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{list.title}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    isActive
                      ? 'bg-[var(--bg-surface)]/80 text-[var(--accent-ink)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  {remaining}/{total}
                </span>
              </button>
              {totalListsCount > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteList(list)}
                  aria-label={`Remove ${list.title}`}
                  title={`Remove "${list.title}"`}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--text-faint)] opacity-75 transition hover:bg-[var(--bg-subtle)] hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {guestLists.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--border-soft)] pt-4">
          <span className="text-xs font-extrabold tracking-wider text-[var(--text-muted)] uppercase">
            Joined Single Lists
          </span>
          <ul className="flex flex-col gap-1.5" role="list">
            {guestLists.map((list) => {
              const isActive = list.listCode === activeListCode;
              const { remaining, total } = countRemaining(list);
              return (
                <li key={list.listCode} className="group flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectList(list.listCode)}
                    title={list.title}
                    className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition ${
                      isActive
                        ? 'bg-[var(--accent-soft)] font-bold text-[var(--accent-ink)]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <span className="shrink-0 text-lg leading-none">{list.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{list.title}</span>
                    <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-xs font-bold text-[var(--text-muted)]">
                      {remaining}/{total}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteList(list)}
                    aria-label={`Leave ${list.title}`}
                    title={`Leave "${list.title}"`}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--text-faint)] transition hover:bg-[var(--bg-subtle)] hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/60 p-3.5">
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          Have a partner&apos;s <strong>Friend Code</strong>? Join their household or a single shared list anytime—no account needed.
        </p>
        <button
          type="button"
          onClick={onOpenJoinCode}
          className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-main)] shadow-2xs transition hover:bg-[var(--bg-hover)]"
        >
          <KeyRound className="h-3.5 w-3.5 text-[var(--accent-ink)]" />
          Join with Friend Code
        </button>
      </div>
    </div>
  );
}
