import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import * as actions from '../data/actions';
import { moveInOrder, setupOrdered } from '../lib/logic';
import type { Store } from '../lib/types';
import { StoreSheet } from '../sheets/StoreSheet';
import { LogoTile, RoundCheck, UpDown, useHeaderHeight } from '../ui/kit';

/** Einstieg / "Deine Läden": which stores a list uses, the Hauptladen and the stop order. */
export function StoresSetup() {
  const app = useApp();
  const { draft, setDraft, data, navigate, toast } = app;
  const [newStore, setNewStore] = useState(false);
  const [headRef, headH] = useHeaderHeight();
  if (!draft) return null;

  const isCreate = draft.mode === 'create';
  const name = draft.name.trim();
  const noSel = !draft.storeIds.length;
  const setupOrd = setupOrdered(data.stores, draft.storeIds, draft.mainStoreId, draft.storeOrder);
  const mainS = draft.mainStoreId && draft.storeIds.includes(draft.mainStoreId) ? data.stores.find(s => s.id === draft.mainStoreId) : undefined;

  const toggle = (s: Store) => setDraft(d => {
    if (!d) return d;
    const sel = d.storeIds.includes(s.id);
    const storeIds = sel ? d.storeIds.filter(x => x !== s.id) : [...d.storeIds, s.id];
    // Deselecting the main store makes the first remaining selected store the main one
    const mainStoreId = d.mainStoreId && storeIds.includes(d.mainStoreId) ? d.mainStoreId : data.stores.find(x => storeIds.includes(x.id))?.id || null;
    return { ...d, storeIds, mainStoreId };
  });
  const move = (id: string, dir: -1 | 1) => {
    const next = moveInOrder(setupOrd.map(s => s.id), id, dir);
    if (next) setDraft(d => (d ? { ...d, storeOrder: next } : d));
  };
  const back = () => app.back(isCreate ? paths.listNew : paths.listEdit);
  const cta = () => {
    if (noSel) return;
    if (!isCreate) { back(); return; }
    const id = actions.createList({ name, storeIds: draft.storeIds, mainStoreId: draft.mainStoreId, storeOrder: setupOrd.map(s => s.id) });
    app.setActiveList(id);
    setDraft(null);
    navigate(paths.list, true);
    toast('„' + name + '“ ist startklar · geteilt mit ' + app.other.name);
  };

  const rows = [...(mainS ? [{ s: mainS, isMain: true }] : []), ...setupOrd.map(s => ({ s, isMain: false }))];

  return (
    <div className="screen">
      <div ref={headRef} className="glass-head" style={{ padding: 'calc(var(--safe-top) + 20px) 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '-6px 0 6px' }}>
          <button className="back-link" onClick={back} style={{ flexShrink: 0 }}>‹ Zurück</button>
          <span className="ellipsis" style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', minWidth: 0 }}>{isCreate ? 'Schritt 2 von 2 · ' + name : 'Läden für „' + name + '“'}</span>
        </div>
        <h1 className="h1" style={{ margin: '0 0 6px' }}>Deine Läden</h1>
        <p style={{ margin: 0, color: '#6F6055', fontSize: 15 }}>Wir sortieren deine Liste nach Läden und nach dem Weg durch die Filiale.</p>
      </div>
      <div className="scroll" style={{ padding: '0 20px calc(var(--safe-bottom) + 110px)', paddingTop: headH ? headH + 20 : 'calc(var(--safe-top) + 203px)' }}>
        <div className="section-label">Lieblingsläden</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.stores.map(s => {
            const sel = draft.storeIds.includes(s.id), isMain = sel && draft.mainStoreId === s.id;
            return (
              <div key={s.id} onClick={() => toggle(s)} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: `2px solid ${sel ? '#F3752E' : '#fff'}`, minHeight: 64 }}>
                <LogoTile store={s} size={44} radius={12} initialSize={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    {isMain && <span style={{ fontSize: 11, fontWeight: 700, background: '#F3752E', color: '#2A1F17', borderRadius: 999, padding: '2px 8px' }}>Hauptladen</span>}
                  </div>
                  <div className="ellipsis" style={{ fontSize: 13, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>
                  {sel && !isMain && (
                    <button onClick={e => { e.stopPropagation(); setDraft(d => (d ? { ...d, mainStoreId: s.id } : d)); }} style={{ marginTop: 6, border: 'none', background: 'none', padding: '4px 0', color: '#C9581A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Als Hauptladen festlegen</button>
                  )}
                </div>
                <RoundCheck on={sel} />
              </div>
            );
          })}
        </div>
        <button className="dashed-btn" style={{ marginTop: 12 }} onClick={() => setNewStore(true)}><span className="plus-ring" /><span>Laden hinzufügen</span></button>
        <p className="hint">Artikel ohne Zuordnung landen automatisch beim Hauptladen.</p>
        {setupOrd.length >= 2 && (
          <>
            <div className="section-label" style={{ margin: '28px 0 8px' }}>Reihenfolge der Stopps</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r, idx) => {
                const i = r.isMain ? -1 : idx - (mainS ? 1 : 0);
                return (
                  <div key={r.s.id} style={{ background: '#fff', borderRadius: 16, padding: '8px 10px 8px 12px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 0 #EADCCD', minHeight: 56, boxSizing: 'border-box' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: r.isMain ? '#F3752E' : '#F3EADF', color: '#2A1F17', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{idx + 1}</div>
                    <LogoTile store={r.s} size={34} radius={10} initialSize={15} />
                    <div className="ellipsis" style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{r.s.name}</div>
                    {r.isMain
                      ? <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', flexShrink: 0 }}>immer zuerst</span>
                      : <UpDown onUp={() => move(r.s.id, -1)} onDown={() => move(r.s.id, 1)} noUp={i === 0} noDown={i === setupOrd.length - 1} />}
                  </div>
                );
              })}
            </div>
            <p className="hint" style={{ marginTop: 10 }}>Diese Reihenfolge gilt für jeden Einkauf. Der Hauptladen bleibt immer vorn.</p>
          </>
        )}
      </div>
      <div className="bottom-fade" style={{ padding: '24px 20px calc(var(--safe-bottom) + 20px)' }}>
        <button className={'cta' + (noSel ? ' off' : '')} onClick={cta}>{noSel ? 'Mindestens einen Laden wählen' : isCreate ? '„' + name + '“ erstellen' : 'Fertig'}</button>
      </div>
      {newStore && (
        <StoreSheet initial={{ mode: 'new', name: '', branch: '', logo: null }} onClose={() => setNewStore(false)}
          onSave={v => {
            const id = actions.createStore(v);
            setDraft(d => (d ? { ...d, storeIds: [...d.storeIds, id], mainStoreId: d.mainStoreId || id } : d));
            setNewStore(false);
            toast('„' + v.name + '“ gespeichert und ausgewählt');
          }} />
      )}
    </div>
  );
}
