import { ChevronDown, ClipboardList, Lock, Users } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { ShoppingList, SyncMode } from '../types/shopping';

interface HeaderProps {
  activeList: ShoppingList;
  uncheckedCount: number;
  syncMode: SyncMode;
  cloudConfigured: boolean;
  onOpenMobileLists: () => void;
  onOpenChecklistModal: () => void;
  onOpenShareModal: () => void;
}

export function Header({
  activeList,
  uncheckedCount,
  syncMode,
  cloudConfigured,
  onOpenMobileLists,
  onOpenChecklistModal,
  onOpenShareModal,
}: HeaderProps) {
  const syncLabel = !cloudConfigured
    ? 'Private Browser Mode'
    : syncMode === 'synced'
      ? 'E2EE Synced'
      : syncMode === 'connecting'
        ? 'Connecting…'
        : 'Sync Retry';

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[var(--bg-page)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Left: Brand on PC + Mobile Active List Switcher on Smartphone */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="hidden items-center gap-2.5 lg:flex">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-xl shadow-xs">
              🧺
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight">CozyCart</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mint-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--mint-ink)]">
                  <Lock className="h-3 w-3" />
                  {syncLabel}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Zero-login encrypted household shopping lists
              </p>
            </div>
          </div>

          {/* Mobile List Switcher Pill (overflow-proof for any custom list name!) */}
          <button
            type="button"
            onClick={onOpenMobileLists}
            title={`Switch or create lists (Current: ${activeList.title})`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2.5 py-2 text-left shadow-xs transition hover:bg-[var(--bg-subtle)] lg:hidden"
          >
            <span className="shrink-0 text-base leading-none">{activeList.emoji}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              {activeList.title}
            </span>
            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-ink)]">
              {uncheckedCount}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Right Actions: Notes Checklist + Friend Code + Theme Toggle */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenChecklistModal}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2.5 text-xs font-bold text-[var(--text-main)] shadow-xs transition hover:bg-[var(--bg-subtle)] sm:px-3.5 sm:text-sm"
            title="Copy or paste as a checklist for your Notes app"
          >
            <ClipboardList className="h-4 w-4 shrink-0 text-[var(--accent-ink)]" />
            <span className="hidden sm:inline">Notes</span>
          </button>

          <button
            type="button"
            onClick={onOpenShareModal}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-2xl bg-[var(--accent-bg)] px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--accent-hover)] sm:px-4 sm:text-sm"
            title="Share or join with a Friend Code"
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>Friend Code</span>
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
