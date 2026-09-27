import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import * as actions from '../data/actions';
import { setupOrdered } from '../lib/logic';
import { LogoTile, useHeaderHeight } from '../ui/kit';

/** Liste einrichten: create (step 1 of 2) or edit a list. */
export function ListSettings() {
  const app = useApp();
  const { draft, data, navigate, toast } = app;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [headRef, headH] = useHeaderHeight();
  if (!draft) return null;

  const isEdit = draft.mode === 'edit';
  const name = draft.name.trim();
  const editList = isEdit ? data.lists.find(l => l.id === draft.listId) : undefined;
  const selected = data.stores.filter(s => draft.storeIds.includes(s.id));
  const main = data.stores.find(s => s.id === draft.mainStoreId) || selected[0];
  const lastList = data.lists.length < 2;
  const noStores = isEdit && !draft.storeIds.some(id => data.stores.some(s => s.id === id));
  const editItems = editList ? data.itemsByList[editList.id] || [] : [];

  const cancel = () => { app.setDraft(null); app.back(paths.list); };
  const next = () => {
    if (!isEdit) { if (name) navigate(paths.listStores); return; }
    if (!editList || noStores) return;
    // Only write what was changed here, so a store edit on the other phone isn't overwritten with an old copy
    const known = new Set(data.stores.map(s => s.id));
    const storeIds = draft.storeIds.filter(id => known.has(id));
    const mainStoreId = draft.mainStoreId && storeIds.includes(draft.mainStoreId) ? draft.mainStoreId : storeIds[0] || null;
    const storeOrder = setupOrdered(data.stores, storeIds, mainStoreId, draft.storeOrder).map(s => s.id);
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    const patch: Parameters<typeof actions.updateList>[1] = {};
    if ((name || editList.name) !== editList.name) patch.name = name || editList.name;
    if (!same(storeIds, editList.storeIds)) patch.storeIds = storeIds;
    if (mainStoreId !== editList.mainStoreId) patch.mainStoreId = mainStoreId;
    if (!same(storeOrder, setupOrdered(data.stores, editList.storeIds, editList.mainStoreId, editList.storeOrder).map(s => s.id))) patch.storeOrder = storeOrder;
    if (Object.keys(patch).length) actions.updateList(editList.id, patch);
    app.setDraft(null);
    navigate(paths.list, true);
    toast('Änderungen gespeichert');
  };
  const del = () => {
    if (!editList || lastList) return;
    const rest = data.lists.filter(l => l.id !== editList.id);
    actions.deleteList(editList.id, editItems);
    app.setActiveList(rest[0].id);
    app.setDraft(null);
    navigate(paths.list, true);
    toast('„' + editList.name + '“ gelöscht');
  };

  const off = (!isEdit && !name) || noStores;
  return (
    <div className="screen">
      <div ref={headRef} className="glass-head" style={{ padding: 'calc(var(--safe-top) + 20px) 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '-6px 0 4px' }}>
          <button className="back-link" onClick={cancel}>‹ Abbrechen</button>
          {!isEdit && <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D' }}>Schritt 1 von 2</span>}
        </div>
        <h1 className="h1">{isEdit ? 'Liste bearbeiten' : 'Neue Einkaufsliste'}</h1>
      </div>
      <div className="scroll" style={{ padding: '0 20px calc(var(--safe-bottom) + 110px)', paddingTop: headH ? headH + 22 : 'calc(var(--safe-top) + 110px)' }}>
        <p style={{ margin: '0 0 22px', color: '#6F6055', fontSize: 15 }}>{isEdit ? 'Änderungen gelten für alle, mit denen du die Liste teilst.' : 'Gib ihr einen Namen. Danach wählst du die Läden.'}</p>
        <div className="section-label">Name</div>
        <input className="field" value={draft.name} onChange={e => { const v = e.target.value; app.setDraft(d => (d ? { ...d, name: v } : d)); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder="z. B. Auf dem Heimweg" enterKeyHint="done" />
        {isEdit && (
          <>
            <div className="section-label" style={{ margin: '24px 0 8px' }}>Läden</div>
            <div className="card" onClick={() => navigate(paths.listStores)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minHeight: 64 }}>
              <div style={{ display: 'flex', flexShrink: 0 }}>
                {selected.slice(0, 4).map((s, i) => (
                  <LogoTile key={s.id} store={s} size={36} radius={10} initialSize={15} style={{ marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px #fff' }} />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{selected.length + (selected.length === 1 ? ' Laden' : ' Läden')}</div>
                <div className="ellipsis" style={{ fontSize: 13, color: '#8A7A6D' }}>Hauptladen: {main ? main.name : '–'}</div>
              </div>
              <span style={{ color: '#8A7A6D', fontSize: 22, lineHeight: 1 }}>›</span>
            </div>
            <div style={{ marginTop: 28 }}>
              {!lastList && !confirmDelete && <button className="outline-danger" onClick={() => setConfirmDelete(true)}>Liste löschen</button>}
              {!lastList && confirmDelete && (
                <div className="card" style={{ border: '2px solid #E7C6B2', animation: 'toastIn .2s ease' }}>
                  <div style={{ fontWeight: 600 }}>„{editList?.name}“ löschen?</div>
                  <div style={{ fontSize: 13, color: '#8A7A6D', marginTop: 2 }}>{(editItems.length ? editItems.length + ' Artikel gehen verloren.' : 'Die Liste ist leer.') + ' Auch für ' + app.other.name + '.'}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, height: 46, border: 'none', borderRadius: 999, background: '#F3EADF', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Behalten</button>
                    <button onClick={del} style={{ flex: 1, height: 46, border: 'none', borderRadius: 999, background: '#B23A12', color: '#FBF5EE', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Löschen</button>
                  </div>
                </div>
              )}
              {lastList && <p style={{ fontSize: 13, color: '#8A7A6D', margin: '0 4px', textAlign: 'center' }}>Deine einzige Liste kann nicht gelöscht werden.</p>}
            </div>
          </>
        )}
      </div>
      <div className="bottom-fade" style={{ padding: '24px 20px calc(var(--safe-bottom) + 20px)' }}>
        <button className={'cta' + (off ? ' off' : '')} onClick={next}>{noStores ? 'Mindestens einen Laden wählen' : isEdit ? 'Änderungen speichern' : name ? 'Weiter zu den Läden' : 'Erst einen Namen eingeben'}</button>
      </div>
    </div>
  );
}
