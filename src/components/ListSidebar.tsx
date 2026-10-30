import { ClipboardList, KeyRound, Plus, Trash2, Users } from 'lucide-react';
import type { ShoppingList } from '../types/shopping';

interface ListSidebarProps {
  householdLists: ShoppingList[];
  guestLists: ShoppingList[];
  activeListCode: string;
  onSelectList: (listCode: string) => void;
  onOpenCreateList: () => void;
  onOpenJoinCode: () => void;
  onOpenChecklistModal?: () => void;
  onOpenShareModal?: () => void;
  onDeleteList: (list: ShoppingList) => void;
}

function countRemaining(list: ShoppingList): number {
  return Object.values(list.items).filter((i) => !i.deletedAt && !i.checked).length;
}

export function ListSidebarContent({
  householdLists,
  guestLists,
  activeListCode,
  onSelectList,
  onOpenCreateList,
  onOpenJoinCode,
  onOpenChecklistModal,
  onOpenShareModal,
  onDeleteList,
}: ListSidebarProps) {
  const totalListsCount = householdLists.length + guestLists.length;

  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[13px] font-medium text-[var(--text-muted)]">
              Household lists
            </span>
            <button
              type="button"
              onClick={onOpenCreateList}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[13px] font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
          </div>

          <ul className="flex flex-col gap-0.5" role="list">
            {householdLists.map((list) => {
              const isActive = list.listCode === activeListCode;
              const remaining = countRemaining(list);
              return (
                <li key={list.listCode} className="group flex min-w-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectList(list.listCode)}
                    title={list.title}
                    className={`flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[14px] transition-colors ${
                      isActive
                        ? 'bg-[var(--nav-active-bg)] font-medium text-[var(--nav-active-ink)]'
                        : 'font-normal text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{list.title}</span>
                    <span
                      className={`tabular shrink-0 rounded px-1.5 py-0.5 text-[13px] ${
                        isActive
                          ? 'bg-[var(--nav-active-badge)] text-[var(--nav-active-ink)]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {remaining}
                    </span>
                  </button>
                  {totalListsCount > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteList(list)}
                      aria-label={`Remove ${list.title}`}
                      title={`Remove "${list.title}"`}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] opacity-75 transition-opacity hover:bg-[var(--bg-hover)] hover:text-[var(--danger-bg)] sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {guestLists.length > 0 && (
          <div className="border-t border-[var(--border-soft)] pt-4">
            <span className="mb-2 block px-2 text-[13px] font-medium text-[var(--text-muted)]">
              Shared single lists
            </span>
            <ul className="flex flex-col gap-0.5" role="list">
              {guestLists.map((list) => {
                const isActive = list.listCode === activeListCode;
                const remaining = countRemaining(list);
                return (
                  <li key={list.listCode} className="group flex min-w-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectList(list.listCode)}
                      title={list.title}
                      className={`flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[14px] transition-colors ${
                        isActive
                          ? 'bg-[var(--nav-active-bg)] font-medium text-[var(--nav-active-ink)]'
                          : 'font-normal text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{list.title}</span>
                      <span
                        className={`tabular shrink-0 rounded px-1.5 py-0.5 text-[13px] ${
                          isActive
                            ? 'bg-[var(--nav-active-badge)] text-[var(--nav-active-ink)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {remaining}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteList(list)}
                      aria-label={`Leave ${list.title}`}
                      title={`Leave "${list.title}"`}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger-bg)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom Workspace Utilities */}
      <div className="flex flex-col gap-0.5 border-t border-[var(--border-soft)] pt-3">
        {onOpenChecklistModal && (
          <button
            type="button"
            onClick={onOpenChecklistModal}
            className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span>Copy for Notes app</span>
          </button>
        )}
        {onOpenShareModal && (
          <button
            type="button"
            onClick={onOpenShareModal}
            className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>Invite partner or QR</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenJoinCode}
          className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          <span>Join with Friend Code</span>
        </button>
      </div>
    </div>
  );
}
