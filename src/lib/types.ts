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
  /** V1.4: town of the store's own branch (the fields above); null = the household's home town */
  town: string | null;
  /** V1.4: branches in other towns, by town id */
  branches: Record<string, Branch>;
  /**
   * V1.4: only on a store as seen in one town (storesInTown): which branch the fields above are.
   * null = the store's own branch; a town id = that entry of `branches`.
   */
  branchTown: string | null;
}

/** V1.4: the same store in another town – its own address and its own path through the store */
export interface Branch {
  address: string;
  categoryOrder: string[] | null;
  orderSetAtMs: number | null;
  orderCheckedAtMs: number | null;
  orderSetBy: string | null;
}

/** V1.4: a town the household shops in. The first one is the home town. */
export interface Town {
  id: string;
  name: string;
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
  /** V1.4: standing stop order per town (other than the home town), set in the plan */
  townOrder: Record<string, string[]>;
  /** Stops pushed to the end (the old "Später erledigen" before V1.8; still honoured, cleared when the trip ends) */
  deferred: string[];
  /** V1.8: the main store was put off this trip, so it can go anywhere in the order (until the trip ends or a reset) */
  mainFree: boolean;
  /** V1.8 "Heute auslassen": stops left out of this trip (their items stay on the list); cleared when the trip ends */
  skipped: string[];
  /** V1.6: people (uids) who are NOT on this list. Everyone else is – also anyone who joins the household later. */
  without: string[];
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
  /** "Woanders einkaufen": shopping the whole list at one store that isn't a stop of the route */
  spontaneous: boolean;
  /** V1.4: town of the trip (null without towns) */
  town: string | null;
}

export interface MemoryEntry {
  /** Before V1.9: one store for all lists (now only counts for the household's first list) */
  storeId: string | null;
  /** V1.9: remembered store per list (list id → store id; null = "automatic" chosen on purpose) */
  stores: Record<string, string | null>;
  /** Shared by all lists */
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

/** V1.5: someone in the household (households/{hid}/members/{uid}) */
export interface Member {
  uid: string;
  name: string;
  email: string;
  joinedAtMs: number;
}

/** V1.5: an invite code, valid once and for 7 days (households/{hid}/invites/{code}) */
export interface Invite {
  /** The code without the dash, e.g. "K7M4QX" */
  code: string;
  createdBy: string;
  createdAtMs: number;
  expiresAtMs: number;
  usedBy: string | null;
}
