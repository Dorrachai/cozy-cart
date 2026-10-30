import { Suspense, lazy, useMemo, useState } from 'react';
import { AisleBoard } from './components/AisleBoard';
import { CreateListModal } from './components/CreateListModal';
import { Header } from './components/Header';
import { ListSidebarContent } from './components/ListSidebar';
import { ModalDialog } from './components/ModalDialog';
import { QuickAddBar } from './components/QuickAddBar';
import { useHouseholdStore } from './hooks/useHouseholdStore';
import type { ShoppingList } from './types/shopping';

const ChecklistModal = lazy(() =>
  import('./components/ChecklistModal').then((m) => ({ default: m.ChecklistModal }))
);
const ShareModal = lazy(() =>
  import('./components/ShareModal').then((m) => ({ default: m.ShareModal }))
);

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

  return (
    <div className="min-h-dvh bg-[var(--bg-page)] text-[var(--text-main)]">
      <Header
        activeList={store.activeList}
        uncheckedCount={uncheckedCount}
        syncMode={store.syncMode}
        cloudConfigured={store.cloudConfigured}
        onOpenMobileLists={() => setMobileListsOpen(true)}
        onOpenChecklistModal={() => setChecklistOpen(true)}
        onOpenShareModal={() => setShareModalState({ open: true, tab: 'household' })}
      />

      {/* Main Responsive Layout: 1-column Phone UI, 2-column Sidebar + Canvas PC UI */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-3 pt-4 sm:px-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:pt-6">
        {/* PC Persistent Left Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-22 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <ListSidebarContent
              householdLists={store.householdLists}
              guestLists={store.guestLists}
              activeListCode={store.activeList.listCode}
              onSelectList={store.selectList}
              onOpenCreateList={() => setCreateListOpen(true)}
              onOpenJoinCode={() => setShareModalState({ open: true, tab: 'join' })}
              onDeleteList={(list) => setPendingDeleteList(list)}
            />
          </div>
        </aside>

        {/* Main Shopping Canvas */}
        <main className="flex min-w-0 flex-col gap-4">
          <QuickAddBar
            learnedCategories={store.learnedCategories}
            categorizerReady={store.categorizerReady}
            onAddItem={store.addItem}
            onPasteMultiLine={store.importChecklistText}
          />

          <AisleBoard
            key={store.activeList.listCode}
            list={store.activeList}
            isGuestList={store.isGuestListActive}
            onToggleItem={store.toggleItem}
            onChangeItemCategory={store.updateItemCategory}
            onRemoveItem={store.removeItem}
            onAutoSort={store.autoSortAllItems}
            onClearChecked={store.clearCheckedItems}
            onUncheckAll={store.uncheckAllItems}
            onRenameList={store.renameList}
            onQuickAddStarter={(sample) => store.addItem(sample)}
            onOpenChecklistModal={() => setChecklistOpen(true)}
            onOpenShareList={() => setShareModalState({ open: true, tab: 'list' })}
          />
        </main>
      </div>

      {/* Smartphone Lists Switcher Sheet */}
      <ModalDialog
        open={mobileListsOpen}
        onClose={() => setMobileListsOpen(false)}
        title="Your Shopping Lists"
        subtitle="Switch between household lists or create a new custom list"
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
        title="Remove Shopping List?"
        maxWidthClass="max-w-md"
      >
        {pendingDeleteList && (
          <div className="flex flex-col gap-4">
            <p className="break-words text-sm text-[var(--text-muted)]">
              Remove <strong>&quot;{pendingDeleteList.title}&quot;</strong> from your lists?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteList(null)}
                className="h-10 cursor-pointer rounded-2xl px-4 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void store.deleteList(pendingDeleteList.listCode, true);
                  setPendingDeleteList(null);
                }}
                className="h-10 cursor-pointer rounded-2xl bg-rose-600 px-4 text-xs font-extrabold text-white transition hover:bg-rose-700"
              >
                Remove List
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Polite Accessible Toast Banner */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4"
      >
        {store.statusToast && (
          <div className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-extrabold text-[var(--text-main)] shadow-lg">
            {store.statusToast}
          </div>
        )}
      </div>
    </div>
  );
}
