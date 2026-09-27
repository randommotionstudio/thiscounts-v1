export interface Store {
  id: string;
  name: string;
  branch: string;
  logo: string | null;
  /** Fixed path through this store; null → household default */
  categoryOrder: string[] | null;
  createdAtMs: number;
}

export interface List {
  id: string;
  name: string;
  storeIds: string[];
  /** "Hauptladen" — always first stop; default for unassigned items */
  mainStoreId: string | null;
  /** "Meine Reihenfolge" — standing order of the non-main stores */
  storeOrder: string[];
  /** Per-trip override from the plan ("nur für diesen Einkauf") */
  tripOrder: string[] | null;
  /** Stops pushed to the end ("Später erledigen" / "überspringen") */
  deferred: string[];
  createdAtMs: number;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  /** Display string, German format: "5 Stück", "500 g", "1,5 l" */
  qty: string | null;
  category: string;
  /** null = automatic → main store */
  storeId: string | null;
  /** true = one-time stop (store outside the list's set, or free text) */
  once: boolean;
  onceStopName: string | null;
  /** "Zurück auf die Einkaufsliste" — open, no store */
  parked: boolean;
  checked: boolean;
  checkedBy: string | null;
  createdBy: string | null;
  createdAtMs: number;
}

export interface MemoryEntry {
  storeId: string | null;
  category: string | null;
}

export interface HistoryEntry {
  id: string;
  name: string;
  qty: string | null;
  storeId: string | null;
  listId: string;
  completedAtMs: number;
}

/** A stop on the route: a real store, or a free-text one-time stop ("Apotheke"). */
export interface Stop {
  id: string;
  name: string;
  branch: string;
  logo: string | null;
  categoryOrder: string[] | null;
  custom: boolean;
}
