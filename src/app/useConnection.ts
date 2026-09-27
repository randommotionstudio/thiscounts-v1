import { useEffect, useState } from 'react';

export type Conn = 'online' | 'offline' | 'syncing';

/** Show "Wird synchronisiert …" only if pending lasts longer than this, to avoid flicker. */
const SYNC_DELAY_MS = 1500;

export function useConnection(pending: boolean): Conn {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [slowSync, setSlowSync] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    if (!pending) { setSlowSync(false); return; }
    const t = setTimeout(() => setSlowSync(true), SYNC_DELAY_MS);
    return () => clearTimeout(t);
  }, [pending]);

  if (!online) return 'offline';
  return pending && slowSync ? 'syncing' : 'online';
}
