// V1.1 "Benachrichtigungen beim Einkaufen": this phone's shopping session.
// The session doc (households/{hid}/sessions/{uid}) tells the other phone where we are.
// A local copy is the source of truth on this device, so quick stop switches don't race the snapshot.
import * as actions from '../data/actions';
import { SESSION_STALE_MS } from '../lib/logic';
import type { Item, Session } from '../lib/types';

type Local = actions.SessionData & { touchedAt: number; orderKey: string };
let local: Local | null = null;

const fresh = (t: number) => Date.now() - t < SESSION_STALE_MS;
export const isLive = (s: Session | undefined | null) => !!s && fresh(s.updatedAtMs);

/**
 * Entering store mode at a stop: create or overwrite the session, keeping the trip's start and finished stores.
 * `doneStops` are stops on the route that are already completely checked (however they were left).
 * Returns the session and whether a new trip started.
 */
export function enterStore(
  listId: string, storeId: string, stopIndex: number, stopCount: number,
  existing: Session | undefined, doneStops: string[], orderKey: string, town: string | null = null, spontaneous = false,
) {
  const base = local && local.listId === listId && fresh(local.touchedAt)
    ? local
    : existing && existing.listId === listId && fresh(existing.updatedAtMs) ? { ...existing, orderKey: '' } : null;
  const keepPos = !!base && base.storeId === storeId && base.orderKey === orderKey;
  local = {
    listId, storeId, stopIndex, stopCount, orderKey, town, spontaneous,
    position: keepPos ? base!.position : 0,
    doneStoreIds: [...new Set([...(base ? base.doneStoreIds : []), ...doneStops])].filter(id => id !== storeId),
    startedAtMs: base ? base.startedAtMs : Date.now(),
    touchedAt: Date.now(),
  };
  const { touchedAt: _t, orderKey: _o, ...data } = local;
  actions.writeSession(data);
  return { session: local, newTrip: !base };
}

/**
 * On every check-off: keep the partner's view fresh; the position only moves forward
 * (unchecking doesn't move you back). A changed store order resets the floor.
 */
export function reportProgress(storeId: string, position: number, orderKey: string) {
  if (!local || local.storeId !== storeId) return;
  if (local.orderKey !== orderKey) { local.orderKey = orderKey; local.position = position; }
  local.position = Math.max(local.position, position);
  local.touchedAt = Date.now();
  actions.updateSession({ position: local.position });
}

/** Leaving a fully checked store via "Weiter zu …" */
export function markStoreDone(storeId: string) {
  if (!local || local.doneStoreIds.includes(storeId)) return;
  local.doneStoreIds = [...local.doneStoreIds, storeId];
  local.touchedAt = Date.now();
  actions.updateSession({ doneStoreIds: local.doneStoreIds });
}

/** "Einkauf abschließen" (the session doc itself is deleted by finishShopping) */
export function endLocalSession() { local = null; seenByStop.clear(); }

/** Item ids that already triggered a banner — never twice. */
export const notifiedItems = new Set<string>();

/**
 * Items already evaluated for a banner, per trip and stop. Kept outside the screen, so an item that
 * arrives while you're on "Nicht gefunden" is still checked when you come back to the store.
 */
const seenByStop = new Map<string, Set<string>>();
export function seenSet(startedAtMs: number, stopId: string, seed: () => string[]): Set<string> {
  const key = startedAtMs + '|' + stopId;
  let s = seenByStop.get(key);
  if (!s) { s = new Set(seed()); seenByStop.set(key, s); }
  return s;
}

/** The item currently shown in the Rückfrage sheet on this phone (not auto-resolved). */
export const ask = { openItemId: null as string | null };

/**
 * Resolve a Rückfrage as "Beim nächsten Einkauf" — but only hold the item back if that trip is
 * still running. If the shopper already finished (or went stale), it simply goes on the list.
 */
export function holdForNextTrip(item: Item, sessions: Record<string, Session>, myUid: string) {
  const shopper = Object.values(sessions).find(s => s.uid !== myUid && s.listId === item.listId && isLive(s));
  const tripRunning = !!shopper && item.createdAtMs >= shopper.startedAtMs;
  actions.updateItem(item, tripRunning ? { pendingDecision: false, nextTrip: true } : { pendingDecision: false });
}
