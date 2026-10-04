import { useMemo } from 'react';
import * as actions from '../data/actions';
import { onTrip, storesInTown, tripPlan } from '../lib/logic';
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
  const { list, items, data, townStores, town, towns, standIn, tripMoves } = app;
  return useMemo(() => {
    // Another town than home: its own stop order (set in the plan), falling back to the usual one
    const orderIn = (t: string | null) => (t && towns.length >= 2 && t !== towns[0].id ? list.townOrder[t] || list.storeOrder : undefined);
    const plan = tripPlan(items, list, data.stores, townStores, { order: orderIn(town), standIn, moves: tripMoves });
    const { route, stopOf } = plan;
    /** What a trip in another town would look like with stand-ins – for the question when switching */
    const previewIn = (t: string) => {
      const ts = storesInTown(data.stores, towns, t);
      const without = tripPlan(items, list, data.stores, ts, { order: orderIn(t) });
      const withIn = tripPlan(items, list, data.stores, ts, { order: orderIn(t), standIn: true });
      // Only what stand-ins would take: one-time stops at a store elsewhere keep waiting for that store
      return { missing: without.unavailable.filter(i => !i.once), stopOf: withIn.stopOf, temp: withIn.temp, stores: ts };
    };
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
    return { route, itemsAt, doneOf, nextStore, goStore, finish, stopOf, temp: plan.temp, unavailable: plan.unavailable, townStores, previewIn, orderIn };
  }, [app, list, items, data.stores, townStores, town, towns, standIn, tripMoves]);
}
