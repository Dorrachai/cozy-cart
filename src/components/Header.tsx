import { ChevronDown, ClipboardList, PanelLeft, Users } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { ShoppingList } from '../types/shopping';

interface HeaderProps {
  activeList: ShoppingList;
  uncheckedCount: number;
  onOpenMobileLists: () => void;
  onOpenChecklistModal: () => void;
  onOpenShareModal: () => void;
}

/**
 * Compact mobile and tablet top bar (< 1024px).
 * On desktop (>= 1024px), navigation and list actions live in the left rail and sheet header.
 */
export function Header({
  activeList,
  uncheckedCount,
  onOpenMobileLists,
  onOpenChecklistModal,
  onOpenShareModal,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-rail)] bg-[var(--bg-rail)] lg:hidden">
      <div className="flex h-13 items-center justify-between gap-2 px-5">
        <button
          type="button"
          onClick={onOpenMobileLists}
          title={`Switch or create lists (Current: ${activeList.title})`}
          className="-ml-2 flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-[var(--bg-surface)]"
        >
          <PanelLeft className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <span className="min-w-0 truncate text-[15px] font-medium text-[var(--text-main)]">
            {activeList.title}
          </span>
          {uncheckedCount > 0 && (
            <span className="tabular shrink-0 rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[13px] font-medium text-[var(--text-muted)]">
              {uncheckedCount}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenChecklistModal}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] px-2.5 text-[14px] font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface)]"
            title="Copy or paste checklist for Notes"
          >
            <ClipboardList className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
            <span>Notes</span>
          </button>

          <button
            type="button"
            onClick={onOpenShareModal}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--primary-bg)] px-3 text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)]"
            title="Share or join with a Friend Code"
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Share</span>
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
