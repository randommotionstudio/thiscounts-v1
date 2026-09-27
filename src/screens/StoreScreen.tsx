import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import { useTrip } from '../app/useTrip';
import * as actions from '../data/actions';
import { icon, stopById, storeGroups, storeToStop, tint } from '../lib/logic';
import type { Stop } from '../lib/types';
import { CatIcon, ConnPill, LogoTile, RoundCheck } from '../ui/kit';

export function useCurrentStop(stopId: string): Stop {
  const app = useApp();
  const { route } = useTrip();
  return stopById(stopId, app.data.stores, app.items) || route[0] || (app.mainStore ? storeToStop(app.mainStore) : { id: stopId, name: '–', branch: '', logo: null, categoryOrder: null, custom: true });
}

/** Im-Laden-Modus: items grouped by the store's fixed path, with check-off and progress. */
export function StoreScreen({ stopId }: { stopId: string }) {
  const app = useApp();
  const { list, navigate, toast } = app;
  const { route, itemsAt, doneOf, goStore, finish } = useTrip();
  const [menu, setMenu] = useState(false);
  const cur = useCurrentStop(stopId);

  useEffect(() => { if (app.currentStop !== cur.id) app.setCurrentStop(cur.id); }, [cur.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const curIdx = route.findIndex(s => s.id === cur.id);
  const curItems = itemsAt(cur.id);
  const groups = storeGroups(curItems, cur.categoryOrder || app.data.defaultCategoryOrder);
  const doneCount = curItems.filter(i => i.checked).length;
  const allDone = curItems.length > 0 && doneCount === curItems.length;
  const openAfter = route.slice(curIdx + 1).find(s => !doneOf(s));
  const openBefore = curIdx > 0 ? route.slice(0, curIdx).find(s => !doneOf(s)) : undefined;
  const nextStop = openAfter || openBefore || null, nextIsBack = !openAfter && !!openBefore;
  const openAtNext = nextStop ? itemsAt(nextStop.id).filter(i => !i.checked).length : 0;
  const openHere = curItems.length - doneCount;
  const nextLabel = nextStop
    ? (nextIsBack ? 'Zurück zu ' : 'Weiter zu ') + nextStop.name + (nextIsBack ? ' (' + openAtNext + ' offen)' : allDone ? '' : ' (' + openHere + ' hier offen)')
    : allDone ? 'Einkauf abschließen' : 'Einkauf abschließen (' + openHere + ' offen)';

  const skipStore = () => {
    const rest = route.filter(s => s.id !== cur.id && !doneOf(s));
    actions.updateList(list.id, { deferred: [...list.deferred.filter(x => x !== cur.id), cur.id] });
    setMenu(false);
    if (rest.length) goStore(rest[0].id); else navigate(paths.plan);
    toast(cur.name + ' auf später verschoben');
  };

  return (
    <div className="screen">
      <div style={{ padding: 'calc(var(--safe-top) + 20px) 20px 12px', background: '#2A1F17', color: '#FBF5EE' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className="back-link" style={{ color: '#F8C5A0' }} onClick={() => navigate(paths.plan)}>‹ Zum Plan</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#C9B8A6' }}>Stopp {Math.max(curIdx, 0) + 1} von {route.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <LogoTile store={cur} size={44} radius={12} initialSize={18} bordered={false} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 26, lineHeight: 1.1, margin: '0 0 2px' }}>{cur.name}</h1>
            <div style={{ fontSize: 13, color: '#C9B8A6' }}>{cur.custom ? '' : cur.branch}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#4A3B2E', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#F3752E', borderRadius: 3, width: (curItems.length ? Math.round(doneCount / curItems.length * 100) : 100) + '%', transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{doneCount} von {curItems.length}</span>
        </div>
        {app.conn !== 'online' && <div style={{ display: 'flex', marginTop: 10 }}><ConnPill conn={app.conn} dark /></div>}
      </div>
      <div className="scroll" style={{ padding: '16px 20px calc(var(--safe-bottom) + 120px)' }}>
        {app.toastText && <div className="toast-inline">{app.toastText}</div>}
        <div style={{ fontSize: 13, color: '#8A7A6D', marginBottom: 12 }}>Sortiert nach dem Weg durch diese Filiale</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g, n) => (
            <div key={g.dept}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: tint(g.dept), color: '#2A1F17', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n + 1}</span>
                <CatIcon src={icon(g.dept)} size={16} opacity={0.7} label={g.label} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#6F6055', textTransform: 'uppercase', letterSpacing: '.05em' }}>{g.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.items.map(i => (
                  <div key={i.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 0 #EADCCD', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 14px', minHeight: 60, boxSizing: 'border-box' }}>
                    <div onClick={() => actions.setChecked(i, !i.checked)} role="checkbox" aria-checked={i.checked} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0, alignSelf: 'stretch' }}>
                      <RoundCheck on={i.checked} size={28} color="#3E9B5F" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 17, color: i.checked ? '#8A7A6D' : '#2A1F17', textDecoration: i.checked ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{i.name}</div>
                        {i.qty && <div style={{ fontSize: 12, color: '#8A7A6D' }}>{i.qty}</div>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); navigate(paths.missing(cur.id, i.id)); }} style={{ height: 40, padding: '0 12px', border: 'none', borderRadius: 12, background: '#F3EADF', color: '#6F6055', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Nicht gefunden</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!curItems.length && <div style={{ textAlign: 'center', color: '#8A7A6D', padding: '30px 0' }}>Hier ist nichts mehr zu holen.</div>}
      </div>
      <div className="bottom-fade" style={{ padding: '24px 20px calc(var(--safe-bottom) + 20px)' }}>
        {menu && (
          <div style={{ marginBottom: 10, background: 'rgba(255,253,250,.6)', WebkitBackdropFilter: 'blur(22px) saturate(1.6)', backdropFilter: 'blur(22px) saturate(1.6)', border: '1px solid rgba(255,255,255,.75)', borderRadius: 22, boxShadow: '0 12px 32px rgba(42,31,23,.16)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'toastIn .2s ease' }}>
            <button onClick={skipStore} style={{ textAlign: 'left', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', color: '#2A1F17' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Diesen Laden überspringen</div>
              <div style={{ fontSize: 13, color: '#8A7A6D' }}>Kommt ans Ende der Route – offene Artikel bleiben hier.</div>
            </button>
            <button onClick={() => navigate(paths.plan)} style={{ textAlign: 'left', height: 48, padding: '0 16px', border: 'none', borderTop: '1px solid #EADCCD', background: 'none', fontSize: 15, fontWeight: 600, color: '#2A1F17', cursor: 'pointer' }}>Zum Plan</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => (nextStop ? goStore(nextStop.id) : finish())} className="ellipsis" style={{ flex: 1, minWidth: 0, height: 56, borderRadius: 999, border: '1px solid rgba(255,255,255,.55)', background: allDone ? '#F3752E' : '#F3EADF', color: '#2A1F17', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 28px rgba(42,31,23,.18), inset 0 1px 0 rgba(255,255,255,.55)', padding: '0 16px' }}>{nextLabel}</button>
          <button onClick={() => setMenu(m => !m)} title="Mehr" style={{ width: 56, height: 56, border: '1px solid rgba(255,255,255,.75)', borderRadius: 999, background: 'rgba(255,253,250,.42)', WebkitBackdropFilter: 'blur(18px) saturate(1.5)', backdropFilter: 'blur(18px) saturate(1.5)', boxShadow: '0 10px 30px rgba(42,31,23,.16), inset 0 1px 0 rgba(255,255,255,.9)', color: '#2A1F17', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
