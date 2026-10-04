import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { useData, type Data } from '../data/DataProvider';
import { otherPerson, personFor, type Person } from '../config/household';
import { guessDeptFromName, storesInTown } from '../lib/logic';
import type { Item, List, Store, Town } from '../lib/types';
import { memoryId } from '../data/refs';
import { useConnection, type Conn } from './useConnection';
import { ask, holdForNextTrip } from './shopping';
import type { Route } from './router';

export interface ListDraft {
  mode: 'create' | 'edit';
  listId?: string;
  name: string;
  storeIds: string[];
  mainStoreId: string | null;
  storeOrder: string[];
}

export interface AppCtx {
  user: User;
  me: Person;
  other: Person;
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
}

const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
};

const LS_ACTIVE = 'thisCounts.activeList';
const LS_CURRENT = 'thisCounts.currentStop.';
const LS_TOWN = 'thisCounts.town.';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };

/** Matches the toastOut animation in styles.css */
const TOAST_FADE_MS = 280;

export function AppProvider({ user, route, navigate, back, children }: { user: User; route: Route; navigate: AppCtx['navigate']; back: AppCtx['back']; children: ReactNode }) {
  const data = useData();
  const conn = useConnection(data.pending);
  const [activeId, setActiveId] = useState<string | null>(() => lsGet(LS_ACTIVE));
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [draft, setDraft] = useState<ListDraft | null>(null);
  const [currentStops, setCurrentStops] = useState<Record<string, string | null>>({});
  const [townSel, setTownSel] = useState<Record<string, string | null>>({});
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

  const currentStop = list.id in currentStops ? currentStops[list.id] : lsGet(LS_CURRENT + list.id);
  const setCurrentStop = useCallback((id: string | null) => {
    setCurrentStops(m => ({ ...m, [list.id]: id }));
    lsSet(LS_CURRENT + list.id, id);
  }, [list.id]);

  // V1.4: the town of this trip. Unknown or deleted towns fall back to the home town.
  const towns = data.towns;
  const homeTown = towns.length >= 2 ? towns[0].id : null;
  const chosenTown = list.id in townSel ? townSel[list.id] : lsGet(LS_TOWN + list.id);
  const town = homeTown && chosenTown && towns.some(t => t.id === chosenTown) ? chosenTown : homeTown;
  const setTown = useCallback((id: string | null) => {
    setTownSel(m => ({ ...m, [list.id]: id }));
    lsSet(LS_TOWN + list.id, id);
  }, [list.id]);
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

  const value = useMemo<AppCtx>(() => {
    const allItems = Object.values(data.itemsByList).flat();
    // Two people share the household: the other one is whoever isn't me
    const otherUid = Object.keys(data.avatars).find(id => id !== user.uid)
      || Object.keys(data.sessions).find(id => id !== user.uid)
      || allItems.find(i => i.createdBy && i.createdBy !== user.uid)?.createdBy || null;
    const byId = new Map(data.stores.map(s => [s.id, s]));
    const mainStore = (list.mainStoreId && byId.get(list.mainStoreId)) || null;
    return {
      user, data,
      me: { ...personFor(user.email), avatar: data.avatars[user.uid] },
      other: { ...otherPerson(user.email), avatar: otherUid ? data.avatars[otherUid] : undefined },
      list, items, allItems,
      mainStore, mainName: mainStore ? mainStore.name : (data.stores[0]?.name || '–'),
      selectedStores: data.stores.filter(s => list.storeIds.includes(s.id)),
      setActiveList, toast, toastText, toastLeaving, route, navigate, back, conn, draft, setDraft, currentStop, setCurrentStop,
      guessDept: name => data.memory[memoryId(name)]?.category || guessDeptFromName(name),
      guessStore: name => data.memory[memoryId(name)]?.storeId || null,
      towns, town, townName: towns.find(t => t.id === town)?.name ?? null, setTown, townStores,
    };
  }, [user, data, list, items, setActiveList, toast, toastText, toastLeaving, route, navigate, back, conn, draft, currentStop, setCurrentStop, towns, town, setTown, townStores]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
