// V1.1 "Benachrichtigungen beim Einkaufen": this phone's shopping session.
// The session doc (households/{hid}/sessions/{uid}) tells the other phone where we are.
// A local copy is the source of truth on this device, so quick stop switches don't race the snapshot.
import * as actions from '../data/actions';
import { SESSION_STALE_MS } from '../lib/logic';
import type { Session } from '../lib/types';

let local: (actions.SessionData & { touchedAt: number }) | null = null;

const fresh = (t: number) => Date.now() - t < SESSION_STALE_MS;

/** Entering store mode at a stop: create or overwrite the session, keeping the trip's start and finished stores. */
export function enterStore(listId: string, storeId: string, stopIndex: number, stopCount: number, existing: Session | undefined) {
  const base = local && local.listId === listId && fresh(local.touchedAt)
    ? local
    : existing && existing.listId === listId && fresh(existing.updatedAtMs) ? { ...existing } : null;
  local = {
    listId, storeId, stopIndex, stopCount,
    position: base && base.storeId === storeId ? base.position : 0,
    doneStoreIds: base ? base.doneStoreIds.filter(id => id !== storeId) : [],
    startedAtMs: base ? base.startedAtMs : Date.now(),
    touchedAt: Date.now(),
  };
  const { touchedAt: _t, ...data } = local;
  actions.writeSession(data);
  return local;
}

export const currentSession = () => local;

/** Position only moves forward within a stop (unchecking doesn't move you back). */
export function setPosition(storeId: string, position: number) {
  if (!local || local.storeId !== storeId || position <= local.position) return;
  local.position = position;
  local.touchedAt = Date.now();
  actions.updateSession({ position });
}

/** Leaving a fully checked store via "Weiter zu …" */
export function markStoreDone(storeId: string) {
  if (!local || local.doneStoreIds.includes(storeId)) return;
  local.doneStoreIds = [...local.doneStoreIds, storeId];
  local.touchedAt = Date.now();
  actions.updateSession({ doneStoreIds: local.doneStoreIds });
}

/** "Einkauf abschließen" (the session doc itself is deleted by finishShopping) */
export function endLocalSession() { local = null; }

/** Item ids that already triggered a banner — never twice. */
export const notifiedItems = new Set<string>();

/** The item currently shown in the Rückfrage sheet on this phone (not auto-resolved). */
export const ask = { openItemId: null as string | null };
