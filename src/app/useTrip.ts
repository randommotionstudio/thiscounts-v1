import { useMemo } from 'react';
import * as actions from '../data/actions';
import { effStore, onTrip, route as buildRoute } from '../lib/logic';
import type { Item, Stop } from '../lib/types';
import { useApp } from './AppContext';
import { paths } from './router';
import { endLocalSession } from './shopping';

/** Route + per-stop helpers shared by the plan, store mode and "Artikel fehlt". */
export function useTrip() {
  const app = useApp();
  const { list, items, data } = app;
  return useMemo(() => {
    const storeIds = new Set(data.stores.map(s => s.id));
    const route = buildRoute(items, list, data.stores);
    const itemsAt = (id: string): Item[] => items.filter(i => onTrip(i) && effStore(i, list, storeIds) === id);
    const doneOf = (s: Stop) => itemsAt(s.id).every(i => i.checked);
    const nextStore = route.find(s => !doneOf(s)) || null;
    const goStore = (id: string) => { app.setCurrentStop(id); app.navigate(paths.store(id)); };
    const finish = (message?: (done: number) => string) => {
      const done = items.filter(i => i.checked).length;
      actions.finishShopping(list, items);
      endLocalSession();
      app.setCurrentStop(null);
      app.navigate(paths.list, true);
      app.toast(message ? message(done) : 'Einkauf abgeschlossen · ' + done + ' Artikel erledigt');
    };
    return { route, itemsAt, doneOf, nextStore, goStore, finish, storeIds };
  }, [app, list, items, data.stores]);
}
