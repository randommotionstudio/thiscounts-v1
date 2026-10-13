import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { useData, type Data } from '../data/DataProvider';
import { otherTester, personFor, type Person } from '../config/household';
import { SESSION_STALE_MS } from '../lib/logic';
import { joinNames } from '../lib/people';
import { guessDeptFromName, storesInTown } from '../lib/logic';
import type { Item, List, Session, Store, Town } from '../lib/types';
import { memoryId } from '../data/refs';
import { useConnection, type Conn } from './useConnection';
import { ask, holdForNextTrip } from './shopping';
import { lsGet, lsSet } from './localStore';
import { useTripState } from './useTripState';
import type { Route } from './router';

export interface ListDraft {
  mode: 'create' | 'edit';
  listId?: string;
  name: string;
  storeIds: string[];
  mainStoreId: string | null;
  storeOrder: string[];
  /** V1.6: who is not on the list */
  without: string[];
}

export interface AppCtx {
  user: User;
  me: Person;
  /** V1.5: everyone else in the household */
  others: Person[];
  /** "Anna", "Anna und Tom", "Anna, Tom und Lea" */
  othersLabel: string;
  /** V1.6: everyone else on a list (people the app can't tell apart yet count as on it) */
  othersOn: (list: Pick<List, 'without'>) => Person[];
  /** V1.5: who someone is, by account (e.g. who added an item) */
  personOf: (uid: string | null | undefined) => Person;
  /** V1.5: someone else shopping on the active list right now (only one person shops at a time) */
  shopper: (Session & { person: Person }) | null;
  data: Data;
  /** The active list (per device) and its items */
  list: List;
  items: Item[];
  allItems: Item[];
  mainStore: Store | null;
  mainName: string;
  selectedStores: Store[];
  setActiveList: (id: string) => void;
  toast: (text: string) => void;
  toastText: string | null;
  /** True during the short fade-out before the toast is removed */
  toastLeaving: boolean;
  route: Route;
  navigate: (to: string, replace?: boolean) => void;
  back: (to: string) => void;
  conn: Conn;
  draft: ListDraft | null;
  setDraft: (d: ListDraft | null | ((d: ListDraft | null) => ListDraft | null)) => void;
  /** Stop you're shopping at right now (per device) */
  currentStop: string | null;
  setCurrentStop: (id: string | null) => void;
  guessDept: (name: string) => string;
  guessStore: (name: string) => string | null;
  /** V1.4: the household's towns (first = home); fewer than two → no town choice anywhere */
  towns: Town[];
  /** V1.4: the town of this trip (per device and list); null without towns */
  town: string | null;
  townName: string | null;
  setTown: (id: string | null) => void;
  /** V1.4: the stores of the trip's town, each with that town's branch (address, path) */
  townStores: Store[];
  /** V1.4: this trip, items of stores missing in the town go to stand-in stores there */
  standIn: boolean;
  setStandIn: (on: boolean) => void;
  /** V1.4: temporary moves for this trip (item id → store id); never changes the item itself */
  tripMoves: Record<string, string>;
  moveForTrip: (itemIds: string[], storeId: string) => void;
  /** V1.8 "Nur hier einkaufen": this trip is just this stop (per device and list) */
  onlyStop: string | null;
  /** V1.8: stops of this trip in the order this phone went there */
  visited: string[];
  startOnly: (stopId: string) => void;
  endOnly: () => void;
}

const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
};

const LS_ACTIVE = 'thisCounts.activeList';

/** Matches the toastOut animation in styles.css */
const TOAST_FADE_MS = 280;

export function AppProvider({ user, route, navigate, back, children }: { user: User; route: Route; navigate: AppCtx['navigate']; back: AppCtx['back']; children: ReactNode }) {
  const data = useData();
  const conn = useConnection(data.pending);
  const [activeId, setActiveId] = useState<string | null>(() => lsGet(LS_ACTIVE));
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [draft, setDraft] = useState<ListDraft | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const list = data.lists.find(l => l.id === activeId) || data.lists[0];
  const items = data.itemsByList[list.id] || [];

  const setActiveList = useCallback((id: string) => { setActiveId(id); lsSet(LS_ACTIVE, id); }, []);

  const toast = useCallback((text: string) => {
    clearTimeout(toastTimer.current);
    setToastText(text);
    setToastLeaving(false);
    toastTimer.current = setTimeout(() => {
      setToastLeaving(true); // fade out (.toast-leaving), then remove
      toastTimer.current = setTimeout(() => { setToastText(null); setToastLeaving(false); }, TOAST_FADE_MS);
    }, 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // This phone's current trip (stop, town, stand-ins, temporary moves) – per list
  const { trip, setStop: setCurrentStop, setTown, setStandIn, moveForTrip, startOnly, endOnly } = useTripState(list.id);
  const currentStop = trip.stop;

  // V1.4: the town of this trip. Unknown or deleted towns fall back to the home town.
  const towns = data.towns;
  const homeTown = towns.length >= 2 ? towns[0].id : null;
  const town = homeTown && trip.town && towns.some(t => t.id === trip.town) ? trip.town : homeTown;
  const townStores = useMemo(() => storesInTown(data.stores, towns, town), [data.stores, towns, town]);

  // Someone finished the trip (checked items are gone) → no current stop any more on this phone either
  const checkedCount = items.filter(i => i.checked).length;
  const prevChecked = useRef({ listId: list.id, n: checkedCount });
  useEffect(() => {
    const p = prevChecked.current;
    if (p.listId === list.id && p.n > 0 && checkedCount === 0 && currentStop) setCurrentStop(null);
    prevChecked.current = { listId: list.id, n: checkedCount };
  }, [list.id, checkedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // A Rückfrage left unanswered (app closed, sheet gone) counts as "Beim nächsten Einkauf"
  useEffect(() => {
    Object.values(data.itemsByList).flat()
      .filter(i => i.pendingDecision && i.createdBy === user.uid && i.id !== ask.openItemId)
      .forEach(i => holdForNextTrip(i, data.sessions, user.uid));
  }, [data.itemsByList, data.sessions, user.uid]);

  // A live session counts for SESSION_STALE_MS after its last activity: re-check every minute
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  const value = useMemo<AppCtx>(() => {
    const allItems = Object.values(data.itemsByList).flat();
    // V1.5: names come from the member entries. Until both original testers have one, the other tester
    // is whoever else shows up (avatar, session, items) – as before, when there were only two people.
    const me: Person = { ...personFor(user.email), ...(data.members[user.uid] ? { name: data.members[user.uid].name } : {}), uid: user.uid, avatar: data.avatars[user.uid] };
    const known = Object.values(data.members).filter(m => m.uid !== user.uid)
      .sort((a, b) => a.joinedAtMs - b.joinedAtMs)
      .map((m): Person => ({ uid: m.uid, email: m.email, name: m.name, avatar: data.avatars[m.uid] }));
    const tester = otherTester(user.email);
    const legacy = tester && !known.some(p => p.email === tester.email) ? tester : null;
    const legacyUid = legacy ? (Object.keys(data.avatars).find(id => id !== user.uid && !data.members[id])
      || Object.keys(data.sessions).find(id => id !== user.uid && !data.members[id])
      || allItems.find(i => i.createdBy && i.createdBy !== user.uid && !data.members[i.createdBy])?.createdBy || undefined) : undefined;
    const others = legacy ? [{ ...legacy, uid: legacyUid, avatar: legacyUid ? data.avatars[legacyUid] : undefined }, ...known] : known;
    const personOf = (id: string | null | undefined): Person => {
      if (!id) return { email: '', name: 'Jemand' };
      if (id === user.uid) return me;
      const p = others.find(o => o.uid === id);
      if (p) return p;
      // Not known yet (e.g. a tester without a member entry, before their first change shows up)
      if (legacy) return { ...legacy, uid: id, avatar: data.avatars[id] };
      return { uid: id, email: '', name: 'Jemand', avatar: data.avatars[id] };
    };
    const live = Object.values(data.sessions)
      .filter(s => s.uid !== user.uid && s.listId === list.id && now - s.updatedAtMs < SESSION_STALE_MS)
      .sort((a, b) => a.startedAtMs - b.startedAtMs)[0];
    const byId = new Map(data.stores.map(s => [s.id, s]));
    const mainStore = (list.mainStoreId && byId.get(list.mainStoreId)) || null;
    return {
      user, data,
      me, others, othersLabel: joinNames(others.map(o => o.name)), personOf,
      othersOn: l => others.filter(o => !o.uid || !l.without.includes(o.uid)),
      shopper: live ? { ...live, person: personOf(live.uid) } : null,
      list, items, allItems,
      mainStore, mainName: mainStore ? mainStore.name : (data.stores[0]?.name || '–'),
      selectedStores: data.stores.filter(s => list.storeIds.includes(s.id)),
      setActiveList, toast, toastText, toastLeaving, route, navigate, back, conn, draft, setDraft, currentStop, setCurrentStop,
      guessDept: name => data.memory[memoryId(name)]?.category || guessDeptFromName(name),
      guessStore: name => data.memory[memoryId(name)]?.storeId || null,
      towns, town, townName: towns.find(t => t.id === town)?.name ?? null, setTown, townStores,
      standIn: trip.standIn, setStandIn, tripMoves: trip.moves, moveForTrip,
      onlyStop: trip.only, visited: trip.visited, startOnly, endOnly,
    };
  }, [now, user, data, list, items, setActiveList, toast, toastText, toastLeaving, route, navigate, back, conn, draft, currentStop, setCurrentStop, towns, town, setTown, townStores, trip, setStandIn, moveForTrip, startOnly, endOnly]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
