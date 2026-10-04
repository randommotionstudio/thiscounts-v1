import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import { useTrip } from '../app/useTrip';
import * as actions from '../data/actions';
import { missingQty, movePatch, storeToStop } from '../lib/logic';
import type { Stop } from '../lib/types';
import { LogoTile } from '../ui/kit';
import { useCurrentStop } from './StoreScreen';

/** Artikel fehlt: move the item to another stop (optionally splitting it), or park it on the list. */
export function MissingScreen({ stopId, itemId }: { stopId: string; itemId: string }) {
  const app = useApp();
  const { list, items, toast } = app;
  const { route, townStores, temp } = useTrip();
  const cur = useCurrentStop(stopId);
  const [foundRaw, setFound] = useState(0);
  const done = useRef(false); // ignore a double tap while we leave the screen
  const mi = items.find(i => i.id === itemId) || null;
  const storePath = paths.store(cur.id);

  // The item is gone (e.g. deleted on the other phone) → back to the store
  useEffect(() => { if (!mi) app.back(storePath); }, [mi]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mi) return null;

  const curIdx = route.findIndex(s => s.id === cur.id);
  const later = route.slice(curIdx + 1);
  // Only stores with a branch in the trip's town
  const others = townStores.filter(s => list.storeIds.includes(s.id) && s.id !== cur.id).map(storeToStop);
  const primary: Stop | null = later[0] || others[0] || null;
  const q = missingQty(mi, foundRaw);

  const move = (target: Stop | null) => {
    if (!target || done.current) return;
    done.current = true;
    const split = q.found > 0 && q.found < q.qtyNum;
    // V1.4: a stand-in item (only here for this trip) moves on for this trip too – its usual store stays
    if (temp(mi) && !target.custom) {
      const keep = { storeId: mi.storeId, once: mi.once, onceStopName: mi.onceStopName, parked: false };
      const restId = actions.moveItem(mi, split ? keep : { checked: false, checkedBy: null }, split ? { foundQty: q.foundQtyText, restQty: q.restText } : null);
      app.moveForTrip([restId || mi.id], target.id);
      app.back(storePath);
      toast(split ? 'Rest von ' + mi.name + ' (' + q.restText + ') heute bei ' + target.name : mi.name + ' heute bei ' + target.name);
      return;
    }
    const patch = movePatch(target, list);
    // A moved item is still to be bought at its new stop
    actions.moveItem(mi, split ? patch : { ...patch, checked: false, checkedBy: null }, split ? { foundQty: q.foundQtyText, restQty: q.restText } : null);
    app.back(storePath);
    toast(split ? 'Rest von ' + mi.name + ' (' + q.restText + ') wandert zu ' + target.name : mi.name + ' wandert zu ' + target.name + ' · Plan aktualisiert');
  };
  const park = () => {
    if (done.current) return;
    done.current = true;
    // A stand-in item keeps its usual store and simply waits for the next trip
    if (temp(mi)) actions.keepOpenItemsOnList([mi]); else actions.parkItem(mi);
    app.back(storePath);
    toast(mi.name + ' ist zurück auf der Einkaufsliste');
  };

  const reason = (s: Stop, onRoute: boolean) => (onRoute ? 'Stopp ' + (route.findIndex(x => x.id === s.id) + 1) + ' · liegt ohnehin auf deiner Route' : s.branch || 'Nicht auf der heutigen Route');
  const alts = others.filter(s => !primary || s.id !== primary.id);
  const stepBtn = { width: 38, height: 38, border: 'none', borderRadius: '50%', background: '#fff', color: '#2A1F17', fontSize: 20, lineHeight: 1, cursor: 'pointer' } as const;

  return (
    <div className="screen">
      <div className="scroll" style={{ padding: 'calc(var(--safe-top) + 24px) 20px 16px' }}>
        <button className="back-link" onClick={() => app.back(storePath)}>‹ Zurück</button>
        <div style={{ fontSize: 13, color: '#8A7A6D', fontWeight: 600, marginTop: 8 }}>Nicht gefunden bei {cur.name}</div>
        <h1 className="h1" style={{ margin: '4px 0 6px' }}>{mi.name} woanders holen</h1>
        <p style={{ margin: '0 0 20px', color: '#6F6055', fontSize: 15 }}>Wir schlagen den nächsten Stopp auf deiner Route vor.</p>
        {q.maxFound > 0 && (
          <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Nur teilweise da?</div>
              <div style={{ fontSize: 13, color: '#8A7A6D' }}>Gebraucht: {q.totalText} · noch offen: {q.restText}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F3EADF', borderRadius: 999, padding: 3 }}>
              <button style={stepBtn} aria-label="Weniger gefunden" onClick={() => setFound(Math.max(Math.min(foundRaw, q.maxFound) - q.qtyStep, 0))}>−</button>
              <span style={{ minWidth: 28, padding: '0 4px', textAlign: 'center', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{q.foundText}</span>
              <button style={stepBtn} aria-label="Mehr gefunden" onClick={() => setFound(Math.min(Math.min(foundRaw, q.maxFound) + q.qtyStep, q.maxFound))}>+</button>
            </div>
          </div>
        )}
        {primary && (
          <>
            <div className="section-label">Empfehlung</div>
            <div className="card" style={{ padding: 16, border: '2px solid #F3752E' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <LogoTile store={primary} size={44} radius={12} initialSize={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{primary.name}</div>
                  <div style={{ fontSize: 13, color: '#8A7A6D' }}>{reason(primary, !!later[0])}</div>
                </div>
              </div>
              <button onClick={() => move(primary)} style={{ marginTop: 14, width: '100%', height: 50, border: 'none', borderRadius: 14, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {(q.found > 0 ? 'Rest (' + q.restText + ') zu ' : 'Zu ') + primary.name + ' verschieben'}
              </button>
            </div>
          </>
        )}
        {alts.length > 0 && (
          <>
            <div className="section-label" style={{ margin: '20px 0 8px' }}>Alternative</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alts.map(s => (
                <div key={s.id} onClick={() => move(s)} className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
                  <LogoTile store={s} size={44} radius={12} initialSize={18} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="ellipsis" style={{ fontSize: 13, color: '#8A7A6D' }}>{reason(s, false)}</div>
                  </div>
                  <span style={{ color: '#8A7A6D', fontSize: 22, lineHeight: 1 }}>›</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div style={{ padding: '12px 20px calc(var(--safe-bottom) + 20px)' }}>
        <button onClick={park} style={{ width: '100%', height: 50, border: '2px solid #2A1F17', borderRadius: 16, background: 'transparent', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Zurück auf die Einkaufsliste setzen</button>
      </div>
    </div>
  );
}
