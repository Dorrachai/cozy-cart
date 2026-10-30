import type {
  CategoryId,
  HouseholdIndex,
  HouseholdListRef,
  ShoppingItem,
  ShoppingList,
} from '../types/shopping';

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function pickNewerItem(a: ShoppingItem, b: ShoppingItem): ShoppingItem {
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt > b.updatedAt ? a : b;
  }
  // Deterministic tie-breaker so all peers converge to identical state
  const aJson = JSON.stringify(a);
  const bJson = JSON.stringify(b);
  return aJson >= bJson ? a : b;
}

function pickNewerListRef(a: HouseholdListRef, b: HouseholdListRef): HouseholdListRef {
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt > b.updatedAt ? a : b;
  }
  const aJson = JSON.stringify(a);
  const bJson = JSON.stringify(b);
  return aJson >= bJson ? a : b;
}

/**
 * Deterministic Last-Write-Wins Element-Set (LWW-CRDT) merger for ShoppingLists.
 * Guarantees two partners adding/checking/renaming concurrently never overwrite each other's items.
 */
export function mergeLists(
  local: ShoppingList,
  remote: ShoppingList,
  now = Date.now()
): ShoppingList {
  const newerMeta = local.updatedAt >= remote.updatedAt ? local : remote;
  const allIds = new Set([...Object.keys(local.items), ...Object.keys(remote.items)]);
  const mergedItems: Record<string, ShoppingItem> = {};

  for (const id of allIds) {
    const l = local.items[id];
    const r = remote.items[id];
    const winner = l && r ? pickNewerItem(l, r) : (l ?? r)!;

    // Prune expired soft-delete tombstones so single-document payloads stay tiny forever
    if (winner.deletedAt && now - winner.deletedAt > TOMBSTONE_TTL_MS) {
      continue;
    }
    mergedItems[id] = winner;
  }

  return {
    id: local.id,
    listCode: local.listCode || remote.listCode,
    title: newerMeta.title,
    emoji: newerMeta.emoji,
    createdAt: Math.min(local.createdAt, remote.createdAt),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    items: mergedItems,
  };
}

/**
 * Deterministic LWW-CRDT merger for encrypted HouseholdIndex documents
 * (custom-named list references + learned category mappings).
 */
export function mergeHouseholdIndexes(
  local: HouseholdIndex,
  remote: HouseholdIndex,
  now = Date.now()
): HouseholdIndex {
  const newerRoot = local.updatedAt >= remote.updatedAt ? local : remote;
  const olderRoot = local.updatedAt >= remote.updatedAt ? remote : local;

  const allListIds = new Set([...Object.keys(local.lists), ...Object.keys(remote.lists)]);
  const mergedLists: Record<string, HouseholdListRef> = {};

  for (const id of allListIds) {
    const l = local.lists[id];
    const r = remote.lists[id];
    const winner = l && r ? pickNewerListRef(l, r) : (l ?? r)!;
    if (winner.deletedAt && now - winner.deletedAt > TOMBSTONE_TTL_MS) {
      continue;
    }
    mergedLists[id] = winner;
  }

  const mergedLearned: Record<string, CategoryId> = {
    ...olderRoot.learnedCategories,
    ...newerRoot.learnedCategories,
  };

  return {
    version: 1,
    householdName: newerRoot.householdName,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    lists: mergedLists,
    learnedCategories: mergedLearned,
  };
}
