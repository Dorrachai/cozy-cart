import { Suspense, lazy, useMemo, useState } from 'react';
import { AisleBoard } from './components/AisleBoard';
import { CreateListModal } from './components/CreateListModal';
import { Header } from './components/Header';
import { ListSidebarContent } from './components/ListSidebar';
import { ModalDialog } from './components/ModalDialog';
import { QuickAddBar } from './components/QuickAddBar';
import { ThemeToggle } from './components/ThemeToggle';
import { useHouseholdStore } from './hooks/useHouseholdStore';
import type { ShoppingList } from './types/shopping';

const ChecklistModal = lazy(() =>
  import('./components/ChecklistModal').then((m) => ({ default: m.ChecklistModal }))
);
const ShareModal = lazy(() =>
  import('./components/ShareModal').then((m) => ({ default: m.ShareModal }))
);

function BasketMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--accent-bg)]"
    >
      <path
        d="M6.2 8L8.4 3.8M13.8 8L11.6 3.8M3 8H17L15.6 15.4C15.45 16.2 14.75 16.8 13.93 16.8H6.07C5.25 16.8 4.55 16.2 4.4 15.4L3 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11.2V13.8M10 11.2V13.8M12.5 11.2V13.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function App() {
  const store = useHouseholdStore();

  const [mobileListsOpen, setMobileListsOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [shareModalState, setShareModalState] = useState<{
    open: boolean;
    tab: 'household' | 'list' | 'join';
  }>({ open: false, tab: 'household' });
  const [pendingDeleteList, setPendingDeleteList] = useState<ShoppingList | null>(null);

  const uncheckedCount = useMemo(
    () =>
      Object.values(store.activeList.items).filter((i) => !i.deletedAt && !i.checked).length,
    [store.activeList.items]
  );

  const syncStatusText = !store.cloudConfigured
    ? 'Saved locally'
    : store.syncMode === 'synced'
      ? 'Encrypted sync'
      : store.syncMode === 'connecting'
        ? 'Connecting'
        : 'Reconnecting';

  return (
    <div
      className="min-h-dvh bg-[var(--bg-page)] text-[var(--text-main)] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]"
    >
      {/* Mobile & Tablet Top Bar (< 1024px) */}
      <Header
        activeList={store.activeList}
        uncheckedCount={uncheckedCount}
        onOpenMobileLists={() => setMobileListsOpen(true)}
        onOpenChecklistModal={() => setChecklistOpen(true)}
        onOpenShareModal={() => setShareModalState({ open: true, tab: 'household' })}
      />

      {/* Desktop Sidebar (>= 1024px) */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-[var(--border-rail)] lg:bg-[var(--bg-rail)]">
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <BasketMark />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text-main)]">
              CozyCart
            </span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 px-4 pb-4 text-[13px] text-[var(--text-muted)]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              store.syncMode === 'synced' ? 'bg-[var(--accent-bg)]' : 'bg-[var(--text-faint)]'
            }`}
            aria-hidden="true"
          />
          <span>{syncStatusText}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-4">
          <ListSidebarContent
            householdLists={store.householdLists}
            guestLists={store.guestLists}
            activeListCode={store.activeList.listCode}
            onSelectList={store.selectList}
            onOpenCreateList={() => setCreateListOpen(true)}
            onOpenJoinCode={() => setShareModalState({ open: true, tab: 'join' })}
            onOpenChecklistModal={() => setChecklistOpen(true)}
            onOpenShareModal={() => setShareModalState({ open: true, tab: 'household' })}
            onDeleteList={(list) => setPendingDeleteList(list)}
          />
        </div>
      </aside>

      {/* Main Working Sheet */}
      <main className="min-w-0 px-5 pt-5 pb-28 sm:px-8 lg:px-12 lg:pt-9 lg:pb-14">
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          <AisleBoard
            key={store.activeList.listCode}
            list={store.activeList}
            isGuestList={store.isGuestListActive}
            onToggleItem={store.toggleItem}
            onChangeItemCategory={store.updateItemCategory}
            onRemoveItem={store.removeItem}
            onClearChecked={store.clearCheckedItems}
            onUncheckAll={store.uncheckAllItems}
            onRenameList={store.renameList}
            onQuickAddStarter={(sample) => store.addItem(sample)}
            onOpenChecklistModal={() => setChecklistOpen(true)}
            onOpenShareList={() => setShareModalState({ open: true, tab: 'list' })}
            composerSlot={
              <QuickAddBar
                learnedCategories={store.learnedCategories}
                categorizerReady={store.categorizerReady}
                onAddItem={store.addItem}
                onPasteMultiLine={store.importChecklistText}
              />
            }
          />
        </div>
      </main>

      {/* Smartphone Lists Switcher Sheet */}
      <ModalDialog
        open={mobileListsOpen}
        onClose={() => setMobileListsOpen(false)}
        title="Shopping lists"
        subtitle="Switch between household lists or start a new one."
      >
        <ListSidebarContent
          householdLists={store.householdLists}
          guestLists={store.guestLists}
          activeListCode={store.activeList.listCode}
          onSelectList={(code) => {
            store.selectList(code);
            setMobileListsOpen(false);
          }}
          onOpenCreateList={() => {
            setMobileListsOpen(false);
            setCreateListOpen(true);
          }}
          onOpenJoinCode={() => {
            setMobileListsOpen(false);
            setShareModalState({ open: true, tab: 'join' });
          }}
          onDeleteList={(list) => {
            setMobileListsOpen(false);
            setPendingDeleteList(list);
          }}
        />
      </ModalDialog>

      {/* Create Custom-Named List Modal */}
      <CreateListModal
        open={createListOpen}
        onClose={() => setCreateListOpen(false)}
        currentListTitle={store.activeList.title}
        uncheckedCountInCurrent={uncheckedCount}
        onCreate={store.createCustomList}
      />

      {/* Copy & Paste Notes App Checklist Modal */}
      {checklistOpen && (
        <Suspense fallback={null}>
          <ChecklistModal
            open={checklistOpen}
            onClose={() => setChecklistOpen(false)}
            list={store.activeList}
            learnedCategories={store.learnedCategories}
            onImportText={store.importChecklistText}
          />
        </Suspense>
      )}

      {/* Friend Codes & Zero-Knowledge Privacy Modal */}
      {shareModalState.open && (
        <Suspense fallback={null}>
          <ShareModal
            key={shareModalState.tab}
            open={shareModalState.open}
            initialTab={shareModalState.tab}
            onClose={() => setShareModalState((s) => ({ ...s, open: false }))}
            householdCode={store.householdCode}
            activeList={store.activeList}
            cloudConfigured={store.cloudConfigured}
            onJoinCode={store.joinWithFriendCode}
            onResetHousehold={store.startFreshHousehold}
          />
        </Suspense>
      )}

      {/* Confirm Remove / Delete List Modal */}
      <ModalDialog
        open={Boolean(pendingDeleteList)}
        onClose={() => setPendingDeleteList(null)}
        title="Remove list?"
        maxWidthClass="max-w-md"
      >
        {pendingDeleteList && (
          <div className="flex flex-col gap-4">
            <p className="break-words text-[14px] text-[var(--text-muted)]">
              Remove <strong>&quot;{pendingDeleteList.title}&quot;</strong> from your workspace?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteList(null)}
                className="h-9 cursor-pointer rounded-lg px-3.5 text-[14px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void store.deleteList(pendingDeleteList.listCode, true);
                  setPendingDeleteList(null);
                }}
                className="h-9 cursor-pointer rounded-lg bg-[var(--danger-bg)] px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Remove list
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Polite Accessible Toast Banner */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-5 lg:inset-x-auto lg:right-6 lg:bottom-6"
      >
        {store.statusToast && (
          <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] px-4 py-2 text-[14px] font-medium text-[var(--text-main)]">
            {store.statusToast}
          </div>
        )}
      </div>
    </div>
  );
}
