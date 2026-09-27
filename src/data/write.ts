/**
 * Writes are fire-and-forget: they land in the local cache immediately and Firestore
 * sends them when there is a connection. The UI never waits for them.
 * "Delete beats edit": an update replayed onto an item the other person deleted fails
 * with not-found — that is expected and ignored.
 *
 * A write's promise settles only once the server has it, so counting the open ones
 * tells us whether anything is still waiting to sync (including deletes, which
 * snapshot metadata doesn't report).
 */
let inFlight = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());

export function report(p: Promise<unknown>) {
  inFlight++;
  emit();
  p.catch((e: { code?: string }) => {
    if (e && e.code === 'not-found') return;
    console.warn('[thisCounts] write failed', e);
  }).finally(() => { inFlight--; emit(); });
}

export const writesInFlight = () => inFlight;
export function onWritesChange(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
