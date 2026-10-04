import { useState } from 'react';
import { LOGOS, agoText, ageDays, logoUrl, storeOrderInfo, storesInTown } from '../lib/logic';
import type { Store, Town } from '../lib/types';
import { newTownId, type StoreEdit } from '../data/actions';
import { Sheet, TextLink } from '../ui/kit';

export interface StoreSheetState {
  mode: 'new' | 'edit'; id?: string; name: string; branch: string; logo: string | null;
  /** V1.4: town of the store's own branch (null = home town) */
  town?: string | null;
  /** V1.4: branches in other towns: town id → address */
  branches?: Record<string, string>;
}

const chip = (on: boolean) => ({
  height: 36, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  border: `2px solid ${on ? '#F3752E' : '#EADCCD'}`, background: on ? '#FDE4D1' : '#fff', color: '#2A1F17',
});

/**
 * "Neuer Laden" / "Laden bearbeiten".
 * V1.4: the same store in other towns ("Filialen"): each with its own address and, later, its own path.
 * The first branch in another town also names the household's existing town (the home town).
 */
export function StoreSheet({ initial, towns, defaultTown = null, homeGuess = '', store = null, onClose, onSave, onDelete, onEditPath }: {
  initial: StoreSheetState; towns: Town[]; defaultTown?: string | null; homeGuess?: string;
  /** The saved store (edit mode) – for the status of its paths */
  store?: Store | null;
  onClose: () => void; onSave: (v: StoreEdit) => void; onDelete?: () => void;
  /** V1.4: open the path editor for a branch (null town = no towns); `pending` = unsaved changes to save first */
  onEditPath?: (town: string | null, pending: StoreEdit | null) => void;
}) {
  const [sh, setSh] = useState(() => ({ ...initial, town: initial.town ?? (initial.mode === 'new' ? defaultTown : null), branches: { ...(initial.branches || {}) } }));
  const [newTowns, setNewTowns] = useState<Town[]>([]);
  const [adding, setAdding] = useState<{ town: string | 'new'; name: string; home: string } | null>(null);
  const name = sh.name.trim();
  const options: (string | null)[] = [null, ...Object.keys(LOGOS)];

  // Towns as they will be after saving (with the ones created here)
  const allTowns: Town[] = [...towns, ...newTowns];
  const multi = allTowns.length >= 2;
  const homeId = allTowns[0]?.id ?? null;
  const baseTown = sh.town ?? homeId;
  const townName = (id: string | null) => allTowns.find(t => t.id === id)?.name || '';
  const freeTowns = allTowns.filter(t => t.id !== baseTown && !(t.id in sh.branches));

  const startAdding = () => setAdding({ town: freeTowns[0]?.id ?? 'new', name: '', home: homeGuess });
  const addBranch = () => {
    if (!adding) return;
    let t = adding.town;
    if (t === 'new') {
      const nm = adding.name.trim();
      if (!nm || (!allTowns.length && !adding.home.trim())) return;
      const created: Town[] = [];
      if (!allTowns.length) created.push({ id: newTownId(), name: adding.home.trim() }); // the existing town becomes the home town
      const town = { id: newTownId(), name: nm };
      created.push(town);
      setNewTowns(n => [...n, ...created]);
      t = town.id;
    }
    setSh(s => ({ ...s, branches: { ...s.branches, [t]: '' } }));
    setAdding(null);
  };
  const removeBranch = (t: string) => setSh(s => { const b = { ...s.branches }; delete b[t]; return { ...s, branches: b }; });

  const buildEdit = (): StoreEdit => ({
    name, branch: sh.branch.trim(), logo: sh.logo,
    town: sh.town && sh.town !== homeId ? sh.town : null,
    branches: Object.fromEntries(Object.entries(sh.branches).map(([t, a]) => [t, a.trim()])),
    towns: newTowns.length ? allTowns : null,
  });
  const save = () => { if (name) onSave(buildEdit()); };
  // Anything changed in the sheet since it opened?
  const dirty = () => {
    const e = buildEdit(), b = initial.branches || {};
    return !!e.towns || e.name !== initial.name.trim() || e.branch !== initial.branch.trim() || e.logo !== initial.logo
      || JSON.stringify(Object.entries(e.branches).sort()) !== JSON.stringify(Object.entries(b).map(([t, a]) => [t, a.trim()]).sort());
  };

  // V1.4: "Weg durch die Filiale" – one row per branch, with whether its path is set up
  const pathRows = (multi ? [baseTown, ...Object.keys(sh.branches)] : [null]).map(t => {
    // The store's own branch is the saved store itself (also while its towns are only being created here);
    // other branches only count once they're saved in a saved town
    const p = !store ? undefined
      : !multi || (t === baseTown && towns.length < 2) ? store
      : towns.length >= 2 && towns.some(x => x.id === t) ? storesInTown([store], towns, t).find(x => x.id === store.id) : undefined;
    const info = p ? storeOrderInfo(p) : null;
    return {
      town: t, title: multi ? townName(t) : 'Abteilungs-Reihenfolge',
      status: info && info.isSet ? 'Eingerichtet · gespeichert ' + agoText(ageDays(info.checkedAtMs, Date.now())) : 'Noch nicht eingerichtet',
    };
  });

  const newTownName = adding && adding.town === 'new' ? adding.name.trim() : '';
  const canAdd = !!adding && (adding.town !== 'new' || (!!newTownName && (allTowns.length > 0 || !!adding.home.trim())));

  return (
    <Sheet title={sh.mode === 'edit' ? 'Laden bearbeiten' : 'Neuer Laden'} sub="Die Filiale hilft nur beim Wiedererkennen." onClose={onClose} z={45} maxHeight="92%">
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: '0 -20px', padding: '0 20px' }}>
        <div className="section-label" style={{ margin: '20px 0 8px' }}>Name</div>
        <input className="field" value={sh.name} onChange={e => setSh({ ...sh, name: e.target.value })} placeholder="z. B. Edeka" />
        {multi && sh.mode === 'new' && (
          <>
            <div className="section-label" style={{ margin: '18px 0 8px' }}>Ort</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allTowns.filter(t => !(t.id in sh.branches)).map(t => (
                <button key={t.id} onClick={() => setSh({ ...sh, town: t.id })} aria-pressed={baseTown === t.id} style={chip(baseTown === t.id)}>{t.name}</button>
              ))}
            </div>
          </>
        )}
        <div className="section-label" style={{ margin: '18px 0 8px' }}>
          {multi ? 'Filiale in ' + townName(baseTown) : 'Filiale / Adresse'} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· {multi ? 'Adresse, ' : ''}optional</span>
        </div>
        <input className="field" style={{ fontSize: 16, fontWeight: 400 }} value={sh.branch} onChange={e => setSh({ ...sh, branch: e.target.value })} placeholder="z. B. Königstraße 12" />

        {Object.keys(sh.branches).map(t => (
          <div key={t}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 8px' }}>
              <div className="section-label" style={{ margin: 0 }}>Filiale in {townName(t)} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· Adresse, optional</span></div>
              <button onClick={() => removeBranch(t)} style={{ border: 'none', background: 'none', color: '#B23A12', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 0' }}>Entfernen</button>
            </div>
            <input className="field" style={{ fontSize: 16, fontWeight: 400 }} value={sh.branches[t]} onChange={e => setSh({ ...sh, branches: { ...sh.branches, [t]: e.target.value } })} placeholder={'z. B. Hauptstraße 3, ' + townName(t)} aria-label={'Adresse in ' + townName(t)} />
          </div>
        ))}

        {!adding && (
          <TextLink onClick={startAdding} style={{ marginTop: 12, padding: '8px 0', minHeight: 40 }}>+ Filiale in einem anderen Ort</TextLink>
        )}
        {adding && (
          <div style={{ marginTop: 16, background: '#F3EADF', borderRadius: 18, padding: '14px 14px 12px' }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{name || 'Dieser Laden'} auch in …</div>
            {freeTowns.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {freeTowns.map(t => <button key={t.id} onClick={() => setAdding({ ...adding, town: t.id })} aria-pressed={adding.town === t.id} style={chip(adding.town === t.id)}>{t.name}</button>)}
                <button onClick={() => setAdding({ ...adding, town: 'new' })} aria-pressed={adding.town === 'new'} style={chip(adding.town === 'new')}>+ Neuer Ort</button>
              </div>
            )}
            {adding.town === 'new' && (
              <>
                <input className="field" style={{ marginTop: 10, fontSize: 16 }} value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} placeholder="Name des Orts, z. B. Frasdorf" aria-label="Name des neuen Orts" />
                {!allTowns.length && (
                  <>
                    <div style={{ fontSize: 13, color: '#6F6055', margin: '12px 2px 6px', textWrap: 'pretty' }}>Und wie heißt der Ort, in dem eure bisherigen Läden sind?</div>
                    <input className="field" style={{ fontSize: 16 }} value={adding.home} onChange={e => setAdding({ ...adding, home: e.target.value })} placeholder="z. B. Prien" aria-label="Name des bisherigen Orts" />
                  </>
                )}
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setAdding(null)} style={{ flex: 1, height: 44, borderRadius: 14, border: '2px solid #D8CBBD', background: 'transparent', color: '#2A1F17', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={addBranch} disabled={!canAdd} style={{ flex: 1, height: 44, borderRadius: 14, border: 'none', background: canAdd ? '#F3752E' : '#E3D5C6', color: '#2A1F17', fontSize: 14, fontWeight: 700, cursor: canAdd ? 'pointer' : 'default' }}>Filiale hinzufügen</button>
            </div>
          </div>
        )}

        {sh.mode === 'edit' && onEditPath && (
          <>
            <div className="section-label" style={{ margin: '22px 0 8px' }}>Weg durch die Filiale</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pathRows.map(r => (
                <button key={r.town || 'only'} onClick={() => name && onEditPath(r.town, dirty() ? buildEdit() : null)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '10px 14px', minHeight: 58, border: '2px solid #EADCCD', borderRadius: 16, background: '#fff', color: '#2A1F17', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: r.status.startsWith('Noch') ? '#C9581A' : '#8A7A6D' }}>{r.status}</div>
                  </div>
                  <span style={{ color: '#8A7A6D', fontSize: 20 }}>›</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#8A7A6D', margin: '8px 4px 0', textWrap: 'pretty' }}>Beim Einkaufen geht's auch direkt im Laden: unten „Aufbau der Filiale geändert?“.</div>
          </>
        )}

        <div className="section-label" style={{ margin: '18px 0 8px' }}>Logo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 8 }}>
          {options.map(k => {
            const on = (sh.logo || null) === k, L = k ? LOGOS[k] : null;
            return (
              <button key={k || 'none'} title={L ? L.label : 'Kein Logo'} onClick={() => setSh({ ...sh, logo: k })} style={{
                aspectRatio: '1', minHeight: 48, borderRadius: 14, border: `2px solid ${on ? '#F3752E' : '#EADCCD'}`, background: '#fff',
                boxSizing: 'border-box', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                {L
                  ? <span className="logo-img" style={{ width: L.size, height: L.size, maxWidth: '70%', maxHeight: '70%', borderRadius: L.radius, backgroundImage: `url(${logoUrl(k!)})` }} />
                  : <span className="logo-initial" style={{ fontSize: 20 }}>{(name || '?').charAt(0).toUpperCase()}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: '#8A7A6D', margin: '8px 4px 0' }}>Ohne Logo zeigen wir den Anfangsbuchstaben.</div>
      </div>
      <button onClick={save}
        style={{ marginTop: 16, width: '100%', height: 54, border: 'none', borderRadius: 999, background: name ? 'rgba(242,106,16,.86)' : '#F3EADF', color: '#2A1F17', fontSize: 17, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        {name ? 'Laden speichern' : 'Erst einen Namen eingeben'}
      </button>
      {sh.mode === 'edit' && onDelete && (
        <button onClick={onDelete} style={{ marginTop: 6, width: '100%', height: 44, border: 'none', background: 'none', color: '#B23A12', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Laden löschen</button>
      )}
    </Sheet>
  );
}
