import { useState } from 'react';
import type { Store } from '../lib/types';
import { LogoTile, Sheet } from '../ui/kit';

/** "Einmaliger Stopp": send one item to a free-text place or a store that isn't on the list. */
export function OnceSheet({ itemName, suggestions, stores, currentStoreId, onClose, onText, onStore }: {
  itemName: string; suggestions: string[]; stores: Store[]; currentStoreId: string | null;
  onClose: () => void; onText: (t: string) => void; onStore: (s: Store) => void;
}) {
  const [text, setText] = useState('');
  const t = text.trim();
  const submit = () => { if (t) onText(t); };
  return (
    <Sheet title="Einmaliger Stopp" sub={<>Nur für „{itemName}“ – danach verschwindet der Stopp wieder.</>} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexShrink: 0 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder="Wohin? z. B. Apotheke" enterKeyHint="done"
          style={{ flex: 1, minWidth: 0, height: 48, border: 'none', borderRadius: 14, background: '#fff', boxShadow: '0 1px 0 #EADCCD', padding: '0 16px', fontSize: 16, color: '#2A1F17', outline: 'none', boxSizing: 'border-box' }} />
        <button onClick={submit} disabled={!t} style={{ height: 48, padding: '0 18px', border: 'none', borderRadius: 14, background: t ? '#F3752E' : '#F3EADF', color: '#2A1F17', fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Hinzufügen</button>
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, flexShrink: 0 }}>
          {suggestions.map(n => (
            <button key={n} onClick={() => onText(n)} style={{ height: 36, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid #EADCCD', background: '#fff', color: '#2A1F17' }}>{n}</button>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 4px 8px', flexShrink: 0 }}>Oder ein Laden</div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stores.map(s => (
          <div key={s.id} onClick={() => onStore(s)} style={{ background: '#fff', borderRadius: 16, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 0 #EADCCD', border: `2px solid ${currentStoreId === s.id ? '#F3752E' : '#fff'}`, boxSizing: 'border-box', cursor: 'pointer', minHeight: 60 }}>
            <LogoTile store={s} size={36} radius={10} initialSize={15} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="ellipsis" style={{ fontSize: 13, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>
            </div>
          </div>
        ))}
        {!stores.length && (
          <div style={{ fontSize: 14, color: '#8A7A6D', padding: '4px 4px 8px', textWrap: 'pretty' }}>Alle deine Läden sind schon auf dieser Liste. Neue Läden legst du im Profil an.</div>
        )}
      </div>
    </Sheet>
  );
}
