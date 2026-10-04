import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  type DocumentData, type DocumentSnapshot, type QuerySnapshot, type Timestamp, limit, onSnapshot, orderBy, query,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { ALL_DEPTS, UNKNOWN, isLegacyOrder, upgradeCategory, upgradeOrder } from '../lib/logic';
import type { HistoryEntry, Item, List, MemoryEntry, Session, Store } from '../lib/types';
import { historyCol, householdRef, itemsCol, listsCol, memoryCol, sessionsCol, storesCol, userRef, usersCol } from './refs';
import { normalizeAvatar, type AvatarPref } from '../lib/avatar';
import { seedDefaultList, seedHousehold } from './seed';
import { onWritesChange, writesInFlight } from './write';

export interface Data {
  /** false until the household is known (first login only — afterwards it comes from the cache) */
  ready: boolean;
  /** Firestore refused access (account not in the rules) */
  denied: boolean;
  defaultCategoryOrder: string[];
  stores: Store[];
  lists: List[];
  itemsByList: Record<string, Item[]>;
  memory: Record<string, MemoryEntry & { id: string }>;
  history: HistoryEntry[];
  /** V1.1: live shopping sessions by uid (stale ones included; filter with SESSION_STALE_MS) */
  sessions: Record<string, Session>;
  /** The sessions snapshot has arrived (from cache or server) */
  sessionsReady: boolean;
  /** V1.1: Profil → "Beim Einkaufen" */
  notifyWhileShopping: boolean;
  /** V1.2: everyone's profile picture by uid (missing → initial on orange) */
  avatars: Record<string, AvatarPref>;
  /** Local changes that haven't reached the server yet */
  pending: boolean;
}

const DataContext = createContext<Data | null>(null);

export function useData(): Data {
  const d = useContext(DataContext);
  if (!d) throw new Error('useData outside DataProvider');
  return d;
}

const ms = (t: unknown, fallback = 0) => (t && typeof (t as Timestamp).toMillis === 'function' ? (t as Timestamp).toMillis() : fallback);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const str = (v: unknown) => (typeof v === 'string' ? v : null);
const opts = { serverTimestamps: 'estimate' as const };

const toStore = (d: DocumentSnapshot<DocumentData>): Store => {
  const x = d.data(opts) || {};
  return { id: d.id, name: x.name || '', branch: x.branch || '', logo: str(x.logo), categoryOrder: Array.isArray(x.categoryOrder) ? upgradeOrder(strArr(x.categoryOrder), !x.pathVersion) : null,
    orderSetAtMs: x.orderSetAt ? ms(x.orderSetAt, Date.now()) : null, orderCheckedAtMs: x.orderCheckedAt ? ms(x.orderCheckedAt, Date.now()) : null, orderSetBy: str(x.orderSetBy),
    createdAtMs: ms(x.createdAt, Date.now()) };
};
const toList = (d: DocumentSnapshot<DocumentData>): List => {
  const x = d.data(opts) || {};
  return {
    id: d.id, name: x.name || '', storeIds: strArr(x.storeIds), mainStoreId: str(x.mainStoreId), storeOrder: strArr(x.storeOrder),
    tripOrder: Array.isArray(x.tripOrder) ? strArr(x.tripOrder) : null, deferred: strArr(x.deferred), createdAtMs: ms(x.createdAt, Date.now()),
  };
};
const toItem = (listId: string, d: DocumentSnapshot<DocumentData>): Item => {
  const x = d.data(opts) || {};
  return {
    id: d.id, listId, name: x.name || '', qty: str(x.qty), category: upgradeCategory(x.category || UNKNOWN, x.name || ''), storeId: str(x.storeId),
    once: !!x.once, onceStopName: str(x.onceStopName), parked: !!x.parked, checked: !!x.checked, checkedBy: str(x.checkedBy),
    createdBy: str(x.createdBy), createdAtMs: ms(x.createdAt, Date.now()),
    pendingDecision: !!x.pendingDecision, nextTrip: !!x.nextTrip,
  };
};

export function DataProvider({ user, children }: { user: User; children: ReactNode }) {
  const [hh, setHh] = useState<{ exists: boolean; order: string[] } | null>(null);
  const [denied, setDenied] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [itemsByList, setItemsByList] = useState<Record<string, Item[]>>({});
  const [memory, setMemory] = useState<Data['memory']>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [sessionsReady, setSessionsReady] = useState(false);
  const [notifyWhileShopping, setNotify] = useState(true);
  const [myAvatar, setMyAvatar] = useState<AvatarPref>(normalizeAvatar(null));
  const [otherAvatars, setOtherAvatars] = useState<Record<string, AvatarPref>>({});
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const seeded = useRef(false);
  const listSeeded = useRef(false);
  const [listsGone, setListsGone] = useState(false);
  const openWrites = useSyncExternalStore(onWritesChange, writesInFlight);

  const track = (key: string, snap: QuerySnapshot | DocumentSnapshot) => {
    const p = snap.metadata.hasPendingWrites;
    setPendingMap(m => (m[key] === p ? m : { ...m, [key]: p }));
  };
  const onErr = (e: { code?: string }) => {
    console.warn('[thisCounts] listener error', e);
    if (e.code === 'permission-denied') setDenied(true);
  };

  // Household + the collections that don't depend on anything else
  useEffect(() => {
    const u1 = onSnapshot(householdRef(), { includeMetadataChanges: true }, snap => {
      track('household', snap);
      if (snap.exists()) {
        const order = strArr(snap.data()?.defaultCategoryOrder);
        setHh({ exists: true, order: order.length ? upgradeOrder(order, isLegacyOrder(order)) : ALL_DEPTS });
      } else if (!snap.metadata.fromCache && !seeded.current) {
        // The server confirms there's no household yet → first login ever: set everything up.
        seeded.current = true;
        seedHousehold(user.uid);
      }
    }, onErr);
    const u2 = onSnapshot(storesCol(), { includeMetadataChanges: true }, snap => {
      track('stores', snap);
      setStores(snap.docs.map(toStore).sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id)));
    }, onErr);
    const u3 = onSnapshot(listsCol(), { includeMetadataChanges: true }, snap => {
      track('lists', snap);
      setListsGone(snap.empty && !snap.metadata.fromCache);
      setLists(snap.docs.map(toList).sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id)));
    }, onErr);
    const u4 = onSnapshot(memoryCol(), { includeMetadataChanges: true }, snap => {
      track('memory', snap);
      const m: Data['memory'] = {};
      snap.docs.forEach(d => {
        const x = d.data(), cat = str(x.category);
        m[d.id] = { id: d.id, storeId: str(x.storeId), category: cat && upgradeCategory(cat, str(x.name) || d.id) };
      });
      setMemory(m);
    }, onErr);
    const u5 = onSnapshot(query(historyCol(), orderBy('completedAt', 'desc'), limit(500)), { includeMetadataChanges: true }, snap => {
      track('history', snap);
      setHistory(snap.docs.map(d => {
        const x = d.data(opts);
        return { id: d.id, name: x.name || '', qty: str(x.qty), storeId: str(x.storeId), listId: x.listId || '', completedAtMs: ms(x.completedAt) };
      }));
    }, onErr);
    const u6 = onSnapshot(sessionsCol(), snap => {
      const m: Record<string, Session> = {};
      snap.docs.forEach(d => {
        const x = d.data(opts);
        m[d.id] = {
          uid: d.id, listId: x.listId || '', storeId: x.storeId || '', position: typeof x.position === 'number' ? x.position : 0,
          doneStoreIds: strArr(x.doneStoreIds), stopIndex: x.stopIndex || 0, stopCount: x.stopCount || 0,
          startedAtMs: ms(x.startedAt, Date.now()), updatedAtMs: ms(x.updatedAt, Date.now()), spontaneous: !!x.spontaneous,
        };
      });
      setSessions(m);
      setSessionsReady(true);
    }, onErr);
    const u7 = onSnapshot(userRef(user.uid), snap => {
      setNotify(snap.get('notifyWhileShopping') !== false);
      setMyAvatar(normalizeAvatar(snap.get('avatar')));
    }, onErr);
    // Everyone's avatar. Needs the V1.2 rules (users readable by the household); with older rules
    // this just fails quietly and the others keep the default avatar.
    const u8 = onSnapshot(usersCol(), snap => {
      const m: Record<string, AvatarPref> = {};
      snap.docs.forEach(d => { m[d.id] = normalizeAvatar(d.get('avatar')); });
      setOtherAvatars(m);
    }, e => console.warn('[thisCounts] avatars not readable (update firestore.rules)', e));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, [user.uid]);

  // Every list got deleted (e.g. on both phones while offline) → start a fresh one instead of hanging.
  useEffect(() => {
    if (hh?.exists && listsGone && !listSeeded.current) { listSeeded.current = true; seedDefaultList(); }
  }, [hh, listsGone]);

  // Items: one listener per list
  const listIds = lists.map(l => l.id).join('|');
  useEffect(() => {
    const ids = listIds ? listIds.split('|') : [];
    const unsubs = ids.map(id => onSnapshot(itemsCol(id), { includeMetadataChanges: true }, snap => {
      track('items:' + id, snap);
      const items = snap.docs.map(d => toItem(id, d)).sort((a, b) => b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id));
      setItemsByList(m => ({ ...m, [id]: items }));
    }, onErr));
    setItemsByList(m => Object.fromEntries(Object.entries(m).filter(([k]) => ids.includes(k))));
    setPendingMap(m => Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('items:') || ids.includes(k.slice(6)))));
    return () => unsubs.forEach(u => u());
  }, [listIds]);

  const value = useMemo<Data>(() => ({
    ready: !!hh && lists.length > 0,
    denied,
    defaultCategoryOrder: hh?.order || ALL_DEPTS,
    stores, lists, itemsByList, memory, history, sessions, sessionsReady, notifyWhileShopping,
    avatars: { ...otherAvatars, [user.uid]: myAvatar },
    pending: openWrites > 0 || Object.values(pendingMap).some(Boolean),
  }), [hh, denied, stores, lists, itemsByList, memory, history, sessions, sessionsReady, notifyWhileShopping, otherAvatars, myAvatar, user.uid, pendingMap, openWrites]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
