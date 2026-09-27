import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { useApp } from '../app/AppContext';
import { auth } from '../firebase';
import * as actions from '../data/actions';
import { StoreSheet, type StoreSheetState } from '../sheets/StoreSheet';
import { Avatar, LogoTile, TabBar } from '../ui/kit';

/** Profil (reduced for V1): who you are, who you share with, and the household's stores. */
export function Profile() {
  const app = useApp();
  const { me, other, data, toast, navigate } = app;
  const [sheet, setSheet] = useState<StoreSheetState | null>(null);

  const save = (v: { name: string; branch: string; logo: string | null }) => {
    if (!sheet) return;
    if (sheet.mode === 'new') { actions.createStore(v); toast('„' + v.name + '“ gespeichert'); }
    else if (sheet.id) { actions.updateStore(sheet.id, v); toast('Änderungen gespeichert'); }
    setSheet(null);
  };
  const del = () => {
    const s = sheet && data.stores.find(x => x.id === sheet.id);
    if (!s) return;
    const block = data.lists.find(l => l.storeIds.length === 1 && l.storeIds[0] === s.id);
    setSheet(null);
    if (block) { toast(s.name + ' ist der einzige Laden von „' + block.name + '“'); return; }
    actions.deleteStore(s.id, data.lists, data.itemsByList, data.memory);
    toast('„' + s.name + '“ gelöscht');
  };

  return (
    <div className="screen">
      <div className="glass-head" style={{ padding: 'calc(var(--safe-top) + 20px) 20px 10px' }}>
        <h1 className="h1">Profil</h1>
      </div>
      <div className="scroll" style={{ padding: 'calc(var(--safe-top) + 76px) 20px calc(var(--safe-bottom) + 96px)' }}>
        <div style={{ background: '#2A1F17', color: '#FBF5EE', borderRadius: 22, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar person={me} size={54} fontSize={22} display />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 17 }}>{me.name}</div>
              <div className="ellipsis" style={{ fontSize: 13, color: '#C9B8A6' }}>{app.user.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid #4A3B2E' }}>
            <Avatar person={other} />
            <span style={{ fontSize: 14, color: '#C9B8A6' }}>Teilt alle Listen mit <span style={{ color: '#FBF5EE', fontWeight: 600 }}>{other.name}</span></span>
          </div>
        </div>
        <div className="section-label" style={{ margin: '24px 0 8px' }}>Deine Läden</div>
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 0 #EADCCD', overflow: 'hidden' }}>
          {data.stores.map((s, i) => (
            <div key={s.id} onClick={() => setSheet({ mode: 'edit', id: s.id, name: s.name, branch: s.branch, logo: s.logo })}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 62, boxSizing: 'border-box', borderTop: i ? '1px solid #F3EADF' : 'none', cursor: 'pointer' }}>
              <LogoTile store={s} size={38} radius={11} initialSize={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{s.branch || 'Keine Adresse'}</div>
              </div>
              <span style={{ color: '#B9AA9C', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
        <button className="dashed-btn" style={{ marginTop: 12 }} onClick={() => setSheet({ mode: 'new', name: '', branch: '', logo: null })}><span className="plus-ring" /><span>Laden hinzufügen</span></button>
        <p className="hint" style={{ marginTop: 10 }}>Welche Läden eine Liste nutzt, legst du in der Liste fest.</p>
        <button className="outline-danger" style={{ marginTop: 28 }} onClick={() => { signOut(auth); navigate('/', true); }}>Abmelden</button>
      </div>
      <div className="bottom-fade" style={{ paddingTop: 24, pointerEvents: 'none' }}>
        <TabBar active="profile" go={navigate} />
      </div>
      {sheet && <StoreSheet key={sheet.id || 'new'} initial={sheet} onClose={() => setSheet(null)} onSave={save} onDelete={del} />}
    </div>
  );
}
