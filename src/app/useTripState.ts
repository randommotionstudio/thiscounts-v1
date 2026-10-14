import { useCallback, useMemo, useState } from 'react';
import { lsGet, lsSet } from './localStore';

/**
 * What this phone remembers about the current trip, per list. It survives reloads and belongs to this
 * person only (two people can shop in different towns at the same time).
 */
export interface TripState {
  /** Stop you're shopping at right now ("spontan:<id>" during "Woanders einkaufen") */
  stop: string | null;
  /** V1.4: chosen town; null = home town */
  town: string | null;
  /** V1.4: stand-in stores for stores missing in the town */
  standIn: boolean;
  /** V1.4: temporary moves for this trip: item id → store id (never changes the item itself) */
  moves: Record<string, string>;
  /** V1.8 "Nur hier einkaufen": a trip with just this stop and its items (null = the whole route) */
  only: string | null;
  /** V1.8: the stops of this trip in the order you went there (the trip follows it, e.g. after "Hier starten" at another store) */
  visited: string[];
}

const KEY = 'thisCounts.trip.';
// Before V1.4's cleanup the trip lived under three keys; read them once so a trip in progress survives the update
const OLD = { stop: 'thisCounts.currentStop.', town: 'thisCounts.town.', extra: 'thisCounts.tripExtra.' };

const parse = (raw: string | null): Partial<TripState> | null => { try { const v = JSON.parse(raw || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const clean = (v: Partial<TripState>): TripState => ({
  stop: typeof v.stop === 'string' ? v.stop : null,
  town: typeof v.town === 'string' ? v.town : null,
  standIn: !!v.standIn,
  moves: v.moves && typeof v.moves === 'object' ? v.moves : {},
  only: typeof v.only === 'string' ? v.only : null,
  visited: Array.isArray(v.visited) ? v.visited.filter((x): x is string => typeof x === 'string') : [],
});

function read(listId: string): TripState {
  const v = parse(lsGet(KEY + listId));
  if (v) return clean(v);
  const extra = parse(lsGet(OLD.extra + listId)) || {};
  return clean({ stop: lsGet(OLD.stop + listId), town: lsGet(OLD.town + listId), standIn: extra.standIn, moves: extra.moves });
}

function write(listId: string, t: TripState) {
  const empty = !t.stop && !t.town && !t.standIn && !Object.keys(t.moves).length && !t.only && !t.visited.length;
  lsSet(KEY + listId, empty ? null : JSON.stringify(t));
  for (const k of Object.values(OLD)) lsSet(k + listId, null);
}

export function useTripState(listId: string) {
  const [byList, setByList] = useState<Record<string, TripState>>({});
  const stored = useMemo(() => read(listId), [listId]);
  const trip = byList[listId] ?? stored;

  const update = useCallback((f: (t: TripState) => TripState) => {
    setByList(m => {
      const next = f(m[listId] ?? read(listId));
      write(listId, next);
      return { ...m, [listId]: next };
    });
  }, [listId]);

  // Going anywhere but the "Nur hier" stop (or ending the trip) ends "Nur hier"
  // Ending the trip (null) forgets where you've been
  const visit = (t: TripState, stop: string | null) => (!stop ? [] : t.visited.includes(stop) ? t.visited : [...t.visited, stop]);
  const setStop = useCallback((stop: string | null) => update(t => ({ ...t, stop, only: stop && stop === t.only ? t.only : null, visited: visit(t, stop) })), [update]);
  const startOnly = useCallback((stop: string) => update(t => ({ ...t, stop, only: stop, visited: visit(t, stop) })), [update]);
  const endOnly = useCallback(() => update(t => ({ ...t, only: null })), [update]);
  // Stand-ins and temporary moves belong to one trip in one town: a new town (or the end of the trip) clears them
  const setTown = useCallback((town: string | null) => update(t => ({ ...t, town, standIn: false, moves: {} })), [update]);
  const setStandIn = useCallback((on: boolean) => update(t => ({ ...t, standIn: on, moves: on ? t.moves : {} })), [update]);
  const moveForTrip = useCallback((itemIds: string[], storeId: string) =>
    update(t => ({ ...t, moves: { ...t.moves, ...Object.fromEntries(itemIds.map(id => [id, storeId])) } })), [update]);

  return { trip, setStop, setTown, setStandIn, moveForTrip, startOnly, endOnly };
}

