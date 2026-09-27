import { useCallback, useEffect, useState } from 'react';

/** The current screen lives in the URL, so reloads and the back button work. */
export type Route =
  | { name: 'list' }
  | { name: 'plan' }
  | { name: 'profile' }
  | { name: 'store'; stopId: string }
  | { name: 'missing'; stopId: string; itemId: string }
  | { name: 'listNew' }
  | { name: 'listEdit' }
  | { name: 'listStores' };

export const paths = {
  list: '/',
  plan: '/plan',
  profile: '/profil',
  store: (stopId: string) => '/laden/' + encodeURIComponent(stopId),
  missing: (stopId: string, itemId: string) => '/laden/' + encodeURIComponent(stopId) + '/fehlt/' + encodeURIComponent(itemId),
  listNew: '/liste/neu',
  listEdit: '/liste/bearbeiten',
  listStores: '/liste/laeden',
};

export function parseRoute(path: string): Route {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/plan') return { name: 'plan' };
  if (p === '/profil') return { name: 'profile' };
  if (p === '/liste/neu') return { name: 'listNew' };
  if (p === '/liste/bearbeiten') return { name: 'listEdit' };
  if (p === '/liste/laeden') return { name: 'listStores' };
  let m = p.match(/^\/laden\/([^/]+)\/fehlt\/([^/]+)$/);
  if (m) return { name: 'missing', stopId: decodeURIComponent(m[1]), itemId: decodeURIComponent(m[2]) };
  m = p.match(/^\/laden\/([^/]+)$/);
  if (m) return { name: 'store', stopId: decodeURIComponent(m[1]) };
  return { name: 'list' };
}

export function useRouter() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const f = () => setPath(location.pathname);
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  const navigate = useCallback((to: string, replace = false) => {
    if (to === location.pathname) return;
    const prev = replace ? (history.state && history.state.prev) || null : location.pathname;
    if (replace) history.replaceState({ prev }, '', to); else history.pushState({ prev }, '', to);
    setPath(to);
  }, []);
  /** Go back to `to` — with the real back step if we came from there, so the history doesn't pile up. */
  const back = useCallback((to: string) => {
    if (history.state && history.state.prev === to) history.back();
    else navigate(to, true);
  }, [navigate]);
  return { route: parseRoute(path), navigate, back };
}
