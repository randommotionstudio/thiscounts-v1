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
    const { stopOf } = plan;
    // V1.8 "Nur hier einkaufen": the trip is just that stop (if it's still on the route)
    const onlyStop = app.onlyStop ? plan.route.find(s => s.id === app.onlyStop) || null : null;
    // The trip follows the order you actually go: stops you've been to first (e.g. after "Stattdessen hier starten"),
    // then the rest as planned
    const planned = onlyStop ? [onlyStop] : plan.route;
    const been = app.visited.map(id => planned.find(s => s.id === id)).filter((s): s is Stop => !!s);
    const route = [...been, ...planned.filter(s => !been.includes(s))];
    /** "Nur hier einkaufen": start a trip with just this stop */
    const goOnly = (id: string) => { app.startOnly(id); app.navigate(paths.store(id)); };
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
    return { route, fullRoute: plan.route, onlyStop, goOnly, itemsAt, doneOf, nextStore, goStore, finish, stopOf, temp: plan.temp, unavailable: plan.unavailable, townStores, previewIn, orderIn };
  }, [app, list, items, data.stores, townStores, town, towns, standIn, tripMoves]);
}
