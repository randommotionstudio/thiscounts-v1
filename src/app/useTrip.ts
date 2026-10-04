import { useMemo } from 'react';
import * as actions from '../data/actions';
import { onTrip, tripPlan } from '../lib/logic';
import type { Item, Stop } from '../lib/types';
import { useApp } from './AppContext';
import { paths } from './router';
import { endLocalSession } from './shopping';

/**
 * Route + per-stop helpers shared by the plan, store mode and "Artikel fehlt".
 * V1.4: everything is for the trip's town – only stores with a branch there are stops; items of the
 * others wait on the list (`unavailable`).
 */
export function useTrip() {
  const app = useApp();
  const { list, items, data, townStores } = app;
  return useMemo(() => {
    const plan = tripPlan(items, list, data.stores, townStores);
    const { route, stopOf } = plan;
    const itemsAt = (id: string): Item[] => items.filter(i => onTrip(i) && stopOf(i) === id);
    const doneOf = (s: Stop) => itemsAt(s.id).every(i => i.checked);
    const nextStore = route.find(s => !doneOf(s)) || null;
    const goStore = (id: string) => { app.setCurrentStop(id); app.navigate(paths.store(id)); };
    const finish = (message?: (done: number) => string) => {
      const done = items.filter(i => i.checked).length;
      actions.finishShopping(list, items);
      endLocalSession();
      app.setCurrentStop(null);
      app.setTown(null); // the next trip starts in the home town again
      app.navigate(paths.list, true);
      app.toast(message ? message(done) : 'Einkauf abgeschlossen · ' + done + ' Artikel erledigt');
    };
    return { route, itemsAt, doneOf, nextStore, goStore, finish, stopOf, unavailable: plan.unavailable, townStores };
  }, [app, list, items, data.stores, townStores]);
}
