export interface Store {
  id: string;
  name: string;
  branch: string;
  logo: string | null;
  /** Fixed path through this store; null → household default */
  categoryOrder: string[] | null;
  /** V1.1: null = never set up by a user → setup offer in store mode */
  orderSetAtMs: number | null;
  /** V1.1: last save or last "Passt noch"; drives the 60-day check-back */
  orderCheckedAtMs: number | null;
  orderSetBy: string | null;
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
  /** V1.1: added for a store the shopper already finished; waiting for the Rückfrage answer. Not on the trip. */
  pendingDecision: boolean;
  /** V1.1: "Beim nächsten …-Einkauf" — not on the current trip, cleared on "Einkauf abschließen" */
  nextTrip: boolean;
}

/** V1.1: someone is shopping right now (households/{hid}/sessions/{uid}) */
export interface Session {
  uid: string;
  listId: string;
  /** Stop the shopper is at (a store id, or "once:…" for a free-text stop) */
  storeId: string;
  /** Index into that store's category order: categories before it are passed */
  position: number;
  doneStoreIds: string[];
  stopIndex: number;
  stopCount: number;
  startedAtMs: number;
  updatedAtMs: number;
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
