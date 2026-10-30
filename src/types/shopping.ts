export type CategoryId =
  | 'produce'
  | 'dairy'
  | 'bakery'
  | 'meat'
  | 'frozen'
  | 'pantry'
  | 'candy'
  | 'drinks'
  | 'household'
  | 'care'
  | 'pets'
  | 'other';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  shortLabel: string;
  emoji: string;
  order: number;
  /** Tailwind-compatible semantic CSS class hook */
  tone: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  qty: string;
  category: CategoryId;
  /** True if user manually chose category so auto-sort respects it */
  manualCategory?: boolean;
  checked: boolean;
  updatedAt: number;
  /** Soft-delete tombstone timestamp for LWW-CRDT convergence across devices */
  deletedAt?: number;
}

export interface ShoppingList {
  id: string;
  /** Full L-... Friend Code allowing single-list sharing without exposing household */
  listCode: string;
  /** Free-form user-chosen name (e.g. "November 2026", "Taco Friday", "IKEA Run") */
  title: string;
  emoji: string;
  createdAt: number;
  updatedAt: number;
  items: Record<string, ShoppingItem>;
}

export interface HouseholdListRef {
  id: string;
  listCode: string;
  title: string;
  emoji: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface HouseholdIndex {
  version: 1;
  householdName: string;
  updatedAt: number;
  /** Map of listId -> list metadata & L-... capability code */
  lists: Record<string, HouseholdListRef>;
  /** Encrypted household-learned category overrides (normalized term -> CategoryId) */
  learnedCategories: Record<string, CategoryId>;
}

export interface EncryptedEnvelope {
  ct: string;
  iv: string;
  rev: number;
  updatedAt?: unknown;
}

export interface RoomCredentials {
  normalized: string;
  kind: 'household' | 'list';
  docId: string;
  aesKey: CryptoKey;
}

export type SyncMode = 'local' | 'connecting' | 'synced' | 'offline' | 'error';

export type ChecklistFormat = 'notes-plain' | 'markdown' | 'unicode';

export interface ChecklistExportOptions {
  format: ChecklistFormat;
  groupByCategory: boolean;
  includeChecked: boolean;
}
