/**
 * Writes are fire-and-forget: they land in the local cache immediately and Firestore
 * sends them when there is a connection. The UI never waits for them.
 * "Delete beats edit": an update replayed onto an item the other person deleted fails
 * with not-found — that is expected and ignored.
 */
export function report(p: Promise<unknown>) {
  p.catch((e: { code?: string }) => {
    if (e && e.code === 'not-found') return;
    console.warn('[thisCounts] write failed', e);
  });
}
