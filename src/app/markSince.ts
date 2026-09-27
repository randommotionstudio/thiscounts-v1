import { useSyncExternalStore } from 'react';

/**
 * V1.1 "Neu-Markierung": items the other person added since you last *really* closed the app.
 * - hidden / pagehide → remember hiddenAt
 * - back after ≥ 10 min away (also as a cold start) → markSince = that hiddenAt
 * - short app switches (a quick look at WhatsApp) keep the markers
 * - very first launch → markSince = now, so nothing is marked
 */
const LS_HIDDEN = 'thisCounts.hiddenAt';
const LS_SINCE = 'thisCounts.markSince';
export const AWAY_MS = 10 * 60 * 1000;

const get = (k: string) => { try { const v = localStorage.getItem(k); return v == null ? null : Number(v); } catch { return null; } };
const set = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

/** markSince on app start (pure, for tests) */
export function markSinceAtStart(now: number, hiddenAt: number | null, stored: number | null): number {
  if (hiddenAt == null || !Number.isFinite(hiddenAt)) return now; // first launch: nothing is marked
  // Away only briefly (iOS often restarts a PWA even after a short switch, and updates reload it): keep the markers
  if (now - hiddenAt < AWAY_MS && stored != null && Number.isFinite(stored)) return stored;
  return hiddenAt;
}

let markSince = Date.now();
const listeners = new Set<() => void>();

function init() {
  markSince = markSinceAtStart(Date.now(), get(LS_HIDDEN), get(LS_SINCE));
  set(LS_SINCE, markSince);

  const onHide = () => set(LS_HIDDEN, Date.now());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { onHide(); return; }
    const h = get(LS_HIDDEN);
    if (h != null && Date.now() - h >= AWAY_MS) {
      markSince = h;
      set(LS_SINCE, markSince);
      listeners.forEach(f => f());
    }
  });
  window.addEventListener('pagehide', onHide);
}
if (typeof document !== 'undefined') init();

export function useMarkSince(): number {
  return useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f); }; }, () => markSince);
}
