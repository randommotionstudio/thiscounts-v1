import { useSyncExternalStore } from 'react';

/**
 * V1.1 "Neu-Markierung": items the other person added since you last *really* closed the app.
 * - hidden / pagehide → remember hiddenAt
 * - cold start, or back after ≥ 10 min away → markSince = that hiddenAt
 * - short app switches (a quick look at WhatsApp) keep the markers
 * - very first launch → markSince = now, so nothing is marked
 */
const LS_HIDDEN = 'thisCounts.hiddenAt';
const LS_SINCE = 'thisCounts.markSince';
export const AWAY_MS = 10 * 60 * 1000;

const get = (k: string) => { try { const v = localStorage.getItem(k); return v == null ? null : Number(v); } catch { return null; } };
const set = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

let markSince = Date.now();
const listeners = new Set<() => void>();

function init() {
  const hiddenAt = get(LS_HIDDEN);
  markSince = hiddenAt != null && Number.isFinite(hiddenAt) ? hiddenAt : Date.now();
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
