import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { useData, type Data } from '../data/DataProvider';
import { otherPerson, personFor, type Person } from '../config/household';
import { guessDeptFromName } from '../lib/logic';
import type { Item, List, Store } from '../lib/types';
import { memoryId } from '../data/refs';
import { useConnection, type Conn } from './useConnection';
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
}

const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
};

const LS_ACTIVE = 'thisCounts.activeList';
const LS_CURRENT = 'thisCounts.currentStop.';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };

export function AppProvider({ user, route, navigate, back, children }: { user: User; route: Route; navigate: AppCtx['navigate']; back: AppCtx['back']; children: ReactNode }) {
  const data = useData();
  const conn = useConnection(data.pending);
  const [activeId, setActiveId] = useState<string | null>(() => lsGet(LS_ACTIVE));
  const [toastText, setToastText] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListDraft | null>(null);
  const [currentStops, setCurrentStops] = useState<Record<string, string | null>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const list = data.lists.find(l => l.id === activeId) || data.lists[0];
  const items = data.itemsByList[list.id] || [];

  const setActiveList = useCallback((id: string) => { setActiveId(id); lsSet(LS_ACTIVE, id); }, []);

  const toast = useCallback((text: string) => {
    clearTimeout(toastTimer.current);
    setToastText(text);
    toastTimer.current = setTimeout(() => setToastText(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const currentStop = list.id in currentStops ? currentStops[list.id] : lsGet(LS_CURRENT + list.id);
  const setCurrentStop = useCallback((id: string | null) => {
    setCurrentStops(m => ({ ...m, [list.id]: id }));
    lsSet(LS_CURRENT + list.id, id);
  }, [list.id]);

  // Someone finished the trip (checked items are gone) → no current stop any more on this phone either
  const checkedCount = items.filter(i => i.checked).length;
  const prevChecked = useRef({ listId: list.id, n: checkedCount });
  useEffect(() => {
    const p = prevChecked.current;
    if (p.listId === list.id && p.n > 0 && checkedCount === 0 && currentStop) setCurrentStop(null);
    prevChecked.current = { listId: list.id, n: checkedCount };
  }, [list.id, checkedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<AppCtx>(() => {
    const allItems = Object.values(data.itemsByList).flat();
    const byId = new Map(data.stores.map(s => [s.id, s]));
    const mainStore = (list.mainStoreId && byId.get(list.mainStoreId)) || null;
    return {
      user, me: personFor(user.email), other: otherPerson(user.email), data,
      list, items, allItems,
      mainStore, mainName: mainStore ? mainStore.name : (data.stores[0]?.name || '–'),
      selectedStores: data.stores.filter(s => list.storeIds.includes(s.id)),
      setActiveList, toast, toastText, route, navigate, back, conn, draft, setDraft, currentStop, setCurrentStop,
      guessDept: name => data.memory[memoryId(name)]?.category || guessDeptFromName(name),
      guessStore: name => data.memory[memoryId(name)]?.storeId || null,
    };
  }, [user, data, list, items, setActiveList, toast, toastText, route, navigate, back, conn, draft, currentStop, setCurrentStop]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
