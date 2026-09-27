import { useState } from 'react';
import { LOGOS, logoUrl } from '../lib/logic';
import { Sheet } from '../ui/kit';

export interface StoreSheetState { mode: 'new' | 'edit'; id?: string; name: string; branch: string; logo: string | null }

/** "Neuer Laden" / "Laden bearbeiten" */
export function StoreSheet({ initial, onClose, onSave, onDelete }: {
  initial: StoreSheetState; onClose: () => void;
  onSave: (v: { name: string; branch: string; logo: string | null }) => void; onDelete?: () => void;
}) {
  const [sh, setSh] = useState(initial);
  const name = sh.name.trim();
  const options: (string | null)[] = [null, ...Object.keys(LOGOS)];
  return (
    <Sheet title={sh.mode === 'edit' ? 'Laden bearbeiten' : 'Neuer Laden'} sub="Die Filiale hilft nur beim Wiedererkennen." onClose={onClose} z={45} maxHeight="92%">
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: '0 -20px', padding: '0 20px' }}>
        <div className="section-label" style={{ margin: '20px 0 8px' }}>Name</div>
        <input className="field" value={sh.name} onChange={e => setSh({ ...sh, name: e.target.value })} placeholder="z. B. Edeka" />
        <div className="section-label" style={{ margin: '18px 0 8px' }}>Filiale / Adresse <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· optional</span></div>
        <input className="field" style={{ fontSize: 16, fontWeight: 400 }} value={sh.branch} onChange={e => setSh({ ...sh, branch: e.target.value })} placeholder="z. B. Königstraße 12" />
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
      <button onClick={() => name && onSave({ name, branch: sh.branch.trim(), logo: sh.logo })}
        style={{ marginTop: 16, width: '100%', height: 54, border: 'none', borderRadius: 999, background: name ? 'rgba(242,106,16,.86)' : '#F3EADF', color: '#2A1F17', fontSize: 17, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        {name ? 'Laden speichern' : 'Erst einen Namen eingeben'}
      </button>
      {sh.mode === 'edit' && onDelete && (
        <button onClick={onDelete} style={{ marginTop: 6, width: '100%', height: 44, border: 'none', background: 'none', color: '#B23A12', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Laden löschen</button>
      )}
    </Sheet>
  );
}
