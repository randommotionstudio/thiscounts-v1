// All writes. Field-level updates only (last change wins per field), never whole-document
// overwrites, so two people editing different fields of the same item don't clobber each other.
import {
  Timestamp, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { normName, onTrip } from '../lib/logic';
import type { Item, List, MemoryEntry, Store } from '../lib/types';
import {
  historyCol, itemRef, itemsCol, listRef, listsCol, memoryCol, memoryRef, newId, sessionRef, storeRef, storesCol, userRef,
} from './refs';
import { report } from './write';

const uid = () => auth.currentUser?.uid ?? null;
const stamp = () => ({ updatedAt: serverTimestamp() });

type ItemPatch = Partial<Pick<Item, 'name' | 'qty' | 'category' | 'storeId' | 'once' | 'onceStopName' | 'parked' | 'checked' | 'checkedBy' | 'pendingDecision' | 'nextTrip'>>;

// ---------- Items ----------

export function addItem(listId: string, data: { name: string; qty: string | null; category: string; storeId: string | null; pendingDecision?: boolean }, presetId?: string): string {
  const id = presetId || newId(itemsCol(listId));
  report(setDoc(itemRef(listId, id), {
    name: data.name, qty: data.qty, category: data.category, storeId: data.storeId,
    once: false, onceStopName: null, parked: false, checked: false, checkedBy: null,
    pendingDecision: !!data.pendingDecision, nextTrip: false,
    createdBy: uid(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  return id;
}

export function updateItem(item: Pick<Item, 'listId' | 'id'>, patch: ItemPatch) {
  report(updateDoc(itemRef(item.listId, item.id), { ...patch, ...stamp() }));
}

export function deleteItem(item: Pick<Item, 'listId' | 'id'>) {
  report(deleteDoc(itemRef(item.listId, item.id)));
}

export function setChecked(item: Item, checked: boolean) {
  updateItem(item, { checked, checkedBy: checked ? uid() : null });
}

/** setStore(): fixed store (or null = automatic) + remembered for this name */
export function setItemStore(item: Item, storeId: string | null) {
  updateItem(item, { storeId, once: false, onceStopName: null, parked: false });
  report(setDoc(memoryRef(item.name), { name: normName(item.name), storeId }, { merge: true }));
}

/** setDept(): category for every item with this name, remembered for next time */
export function setCategoryForName(allItems: Item[], name: string, category: string) {
  const key = normName(name);
  // Separate writes, not a batch: one item deleted on the other phone must not undo the rest.
  allItems.filter(i => normName(i.name) === key).forEach(i => updateItem(i, { category }));
  report(setDoc(memoryRef(name), { name: key, category }, { merge: true }));
}

/** assignOnce(): one-time stop — a free-text place or a store outside the list. Not remembered. */
export function assignOnce(item: Item, target: { text: string } | { storeId: string }) {
  updateItem(item, 'text' in target
    ? { storeId: null, once: true, onceStopName: target.text, parked: false }
    : { storeId: target.storeId, once: true, onceStopName: null, parked: false });
}

/** "Artikel fehlt": move to another stop, optionally splitting off the rest. */
export function moveItem(item: Item, patch: ItemPatch, split: { foundQty: string; restQty: string } | null) {
  if (!split) { updateItem(item, patch); return; }
  const batch = writeBatch(db);
  batch.update(itemRef(item.listId, item.id), { qty: split.foundQty, checked: true, checkedBy: uid(), ...stamp() });
  const id = newId(itemsCol(item.listId));
  batch.set(itemRef(item.listId, id), {
    name: item.name, category: item.category, storeId: null, once: false, onceStopName: null, parked: false,
    ...patch, qty: split.restQty, checked: false, checkedBy: null,
    createdBy: uid(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  report(batch.commit());
}

export function parkItem(item: Item) {
  updateItem(item, { parked: true, storeId: null, once: false, onceStopName: null, checked: false, checkedBy: null });
}

/** "Alles hier einkaufen · nur ein Stopp" */
export function allHere(items: Item[], list: List, storeId: string) {
  const once = !list.storeIds.includes(storeId);
  items.filter(onTrip).forEach(i => updateItem(i, { storeId, once, onceStopName: null }));
}

/** "Einkauf abschließen": history for checked items, delete them, reset the trip. */
export function finishShopping(list: List, items: Item[]) {
  const batch = writeBatch(db);
  const now = Timestamp.now();
  items.filter(i => i.checked).forEach(i => {
    batch.set(doc(historyCol()), { name: i.name, qty: i.qty, storeId: i.storeId, listId: list.id, completedAt: now });
    batch.delete(itemRef(i.listId, i.id));
  });
  // Sets and deletes can't fail on a missing document, so this batch is safe; the list update goes separately.
  report(batch.commit());
  updateList(list.id, { tripOrder: null, deferred: [] });
  // Items held back for "next time" are back on the next trip
  items.filter(i => !i.checked && i.nextTrip).forEach(i => updateItem(i, { nextTrip: false }));
  endSession();
}

// ---------- V1.1: shopping session ----------

export interface SessionData {
  listId: string; storeId: string; position: number; doneStoreIds: string[];
  stopIndex: number; stopCount: number; startedAtMs: number;
}

/** Create or overwrite my session (entering store mode, switching stops) */
export function writeSession(s: SessionData) {
  const me = uid();
  if (!me) return;
  const { startedAtMs, ...rest } = s;
  report(setDoc(sessionRef(me), { ...rest, startedAt: Timestamp.fromMillis(startedAtMs), updatedAt: serverTimestamp() }));
}

export function updateSession(patch: Partial<Pick<SessionData, 'position' | 'doneStoreIds'>>) {
  const me = uid();
  if (!me) return;
  report(updateDoc(sessionRef(me), { ...patch, updatedAt: serverTimestamp() }));
}

export function endSession() {
  const me = uid();
  if (me) report(deleteDoc(sessionRef(me)));
}

export function setNotifyWhileShopping(on: boolean) {
  const me = uid();
  if (me) report(setDoc(userRef(me), { notifyWhileShopping: on }, { merge: true }));
}

// ---------- V1.1: Filiale einrichten ----------

export function saveStoreOrder(store: Store, order: string[]) {
  report(updateDoc(storeRef(store.id), {
    categoryOrder: order,
    orderCheckedAt: serverTimestamp(),
    orderSetBy: uid(),
    ...(store.orderSetAtMs == null ? { orderSetAt: serverTimestamp() } : {}),
    ...stamp(),
  }));
}

/** "Passt noch" */
export function confirmStoreOrder(storeId: string) {
  report(updateDoc(storeRef(storeId), { orderCheckedAt: serverTimestamp(), ...stamp() }));
}

// ---------- Lists ----------

export interface ListDraftData { name: string; storeIds: string[]; mainStoreId: string | null; storeOrder: string[] }

export function createList(data: ListDraftData): string {
  const id = newId(listsCol());
  report(setDoc(listRef(id), {
    ...data, tripOrder: null, deferred: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  return id;
}

export function updateList(listId: string, patch: Partial<Pick<List, 'name' | 'storeIds' | 'mainStoreId' | 'storeOrder' | 'tripOrder' | 'deferred'>>) {
  report(updateDoc(listRef(listId), { ...patch, ...stamp() }));
}

export function deleteList(listId: string, items: Item[]) {
  const batch = writeBatch(db);
  items.forEach(i => batch.delete(itemRef(listId, i.id)));
  batch.delete(listRef(listId));
  report(batch.commit());
}

// ---------- Stores ----------

export function createStore(data: { name: string; branch: string; logo: string | null }): string {
  const id = newId(storesCol());
  report(setDoc(storeRef(id), {
    ...data, categoryOrder: null, orderSetAt: null, orderCheckedAt: null, orderSetBy: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  return id;
}

export function updateStore(id: string, patch: Partial<Pick<Store, 'name' | 'branch' | 'logo'>>) {
  report(updateDoc(storeRef(id), { ...patch, ...stamp() }));
}

/** deleteStore(): remove the store everywhere; its items fall back to automatic. */
export function deleteStore(storeId: string, lists: List[], itemsByList: Record<string, Item[]>, memory: Record<string, MemoryEntry & { id: string }>) {
  for (const l of lists) {
    if (l.storeIds.includes(storeId) || l.storeOrder.includes(storeId) || (l.tripOrder || []).includes(storeId) || l.deferred.includes(storeId)) {
      const storeIds = l.storeIds.filter(x => x !== storeId);
      updateList(l.id, {
        storeIds,
        mainStoreId: l.mainStoreId === storeId ? storeIds[0] || null : l.mainStoreId,
        storeOrder: l.storeOrder.filter(x => x !== storeId),
        tripOrder: l.tripOrder ? l.tripOrder.filter(x => x !== storeId) : null,
        deferred: l.deferred.filter(x => x !== storeId),
      });
    }
    (itemsByList[l.id] || []).filter(i => i.storeId === storeId).forEach(i => updateItem(i, { storeId: null, once: false }));
  }
  Object.values(memory).filter(m => m.storeId === storeId).forEach(m => report(updateDoc(doc(memoryCol(), m.id), { storeId: null })));
  report(deleteDoc(storeRef(storeId)));
}
