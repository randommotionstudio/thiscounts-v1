import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import { auth } from '../firebase';
import * as actions from '../data/actions';
import { StoreSheet, type StoreSheetState } from '../sheets/StoreSheet';
import { AvatarSheet } from '../sheets/AvatarSheet';
import { Avatar, LogoTile, Sheet, TabBar } from '../ui/kit';
import { guessTownName, townsOf } from '../lib/logic';
import type { Town } from '../lib/types';

/** Profil (reduced for V1): who you are, who you share with, and the household's stores. */
export function Profile() {
  const app = useApp();
  const { me, other, data, toast, navigate } = app;
  const [sheet, setSheet] = useState<StoreSheetState | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [townEdit, setTownEdit] = useState<{ town: Town; name: string } | null>(null);
  const multi = app.towns.length >= 2;
  const townUsed = (id: string) => data.stores.some(s => s.town === id || !!s.branches[id]);

  const save = (v: actions.StoreEdit) => {
    if (!sheet) return;
    const before = sheet.mode === 'edit' ? data.stores.find(s => s.id === sheet.id) || null : null;
    if (sheet.mode === 'edit' && !before) { setSheet(null); return; }
    actions.saveStore(v, before);
    toast(sheet.mode === 'new' ? '„' + v.name + '“ gespeichert' : 'Änderungen gespeichert');
    setSheet(null);
  };
  const editStore = (s: (typeof data.stores)[number]) => setSheet({
    mode: 'edit', id: s.id, name: s.name, branch: s.branch, logo: s.logo, town: s.town,
    branches: Object.fromEntries(Object.entries(s.branches).map(([t, b]) => [t, b.address])),
  });
  const saveTown = () => {
    if (!townEdit || !townEdit.name.trim()) return;
    actions.setTowns(app.towns.map(t => (t.id === townEdit.town.id ? { ...t, name: townEdit.name.trim() } : t)));
    setTownEdit(null);
    toast('Ort umbenannt');
  };
  const deleteTown = () => {
    if (!townEdit) return;
    actions.setTowns(app.towns.filter(t => t.id !== townEdit.town.id));
    if (app.town === townEdit.town.id) app.setTown(null);
    toast('„' + townEdit.town.name + '“ entfernt');
    setTownEdit(null);
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
            <button onClick={() => setAvatarOpen(true)} title="Profilbild ändern" aria-label="Profilbild ändern" style={{ position: 'relative', width: 54, height: 54, padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}>
              <Avatar person={me} size={54} label="" onDark />
              <span style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: '50%', background: '#FBF5EE', border: '2px solid #2A1F17', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 11, height: 11, display: 'block', opacity: 0.8, background: 'url(/icons/pencil.svg) center/11px no-repeat' }} />
              </span>
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 17 }}>{me.name}</div>
              <div className="ellipsis" style={{ fontSize: 13, color: '#C9B8A6' }}>{app.user.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid #4A3B2E' }}>
            <Avatar person={other} onDark />
            <span style={{ fontSize: 14, color: '#C9B8A6' }}>Teilt alle Listen mit <span style={{ color: '#FBF5EE', fontWeight: 600 }}>{other.name}</span></span>
          </div>
        </div>
        <div className="section-label" style={{ margin: '24px 0 8px' }}>Deine Läden</div>
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 0 #EADCCD', overflow: 'hidden' }}>
          {data.stores.map((s, i) => (
            <div key={s.id} onClick={() => editStore(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 62, boxSizing: 'border-box', borderTop: i ? '1px solid #F3EADF' : 'none', cursor: 'pointer' }}>
              <LogoTile store={s} size={38} radius={11} initialSize={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{multi ? townsOf(s, app.towns).map(t => t.name).join(' · ') : s.branch || 'Keine Adresse'}</div>
              </div>
              <span style={{ color: '#B9AA9C', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
        <button className="dashed-btn" style={{ marginTop: 12 }} onClick={() => setSheet({ mode: 'new', name: '', branch: '', logo: null })}><span className="plus-ring" /><span>Laden hinzufügen</span></button>
        <p className="hint" style={{ marginTop: 10 }}>Welche Läden eine Liste nutzt, legst du in der Liste fest.{multi ? '' : ' Gibt es einen Laden auch in einem anderen Ort, füge ihn beim Laden als weitere Filiale hinzu.'}</p>
        {multi && (
          <>
            <div className="section-label" style={{ margin: '24px 0 8px' }}>Orte</div>
            <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 0 #EADCCD', overflow: 'hidden' }}>
              {app.towns.map((t, i) => {
                const n = data.stores.filter(s => townsOf(s, app.towns).some(x => x.id === t.id)).length;
                return (
                  <div key={t.id} onClick={() => setTownEdit({ town: t, name: t.name })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 56, boxSizing: 'border-box', borderTop: i ? '1px solid #F3EADF' : 'none', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#8A7A6D' }}>{n + (n === 1 ? ' Laden' : ' Läden') + (i === 0 ? ' · Heimatort' : '')}</div>
                    </div>
                    <span style={{ color: '#B9AA9C', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>›</span>
                  </div>
                );
              })}
            </div>
            <p className="hint" style={{ marginTop: 10 }}>Jeder Einkauf startet im Heimatort. Im Plan wählst du, wo du heute einkaufst.</p>
          </>
        )}
        <div className="section-label" style={{ margin: '24px 0 8px' }}>Benachrichtigungen</div>
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 0 #EADCCD', overflow: 'hidden' }}>
          <div role="switch" aria-checked={data.notifyWhileShopping} onClick={() => actions.setNotifyWhileShopping(!data.notifyWhileShopping)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', minHeight: 64, boxSizing: 'border-box', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Beim Einkaufen</div>
              <div style={{ fontSize: 13, color: '#8A7A6D', textWrap: 'pretty' }}>Wenn jemand etwas hinzufügt, an dessen Abteilung du schon vorbei bist.</div>
            </div>
            <span style={{ width: 51, height: 31, borderRadius: 999, background: data.notifyWhileShopping ? '#F3752E' : '#D8CBBD', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
              <span style={{ position: 'absolute', left: 2, top: 2, width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(42,31,23,.2)', transform: `translateX(${data.notifyWhileShopping ? 20 : 0}px)`, transition: 'transform .2s', display: 'block' }} />
            </span>
          </div>
        </div>
        <button className="outline-danger" style={{ marginTop: 28 }} onClick={() => { signOut(auth); navigate('/', true); }}>Abmelden</button>
      </div>
      <div className="bottom-fade" style={{ paddingTop: 24, pointerEvents: 'none' }}>
        <TabBar active="profile" go={navigate} />
      </div>
      {avatarOpen && <AvatarSheet person={me} onClose={() => setAvatarOpen(false)} />}
      {sheet && <StoreSheet key={sheet.id || 'new'} initial={sheet} towns={app.towns} defaultTown={app.town} homeGuess={guessTownName(data.stores.map(s => s.branch))}
        store={sheet.id ? data.stores.find(s => s.id === sheet.id) || null : null} onClose={() => setSheet(null)} onSave={save} onDelete={del}
        onEditPath={(town, pending) => {
          const before = data.stores.find(s => s.id === sheet.id);
          if (!before) return;
          if (pending) actions.saveStore(pending, before); // keep what was changed in the sheet
          setSheet(null);
          navigate(paths.refine(before.id, town));
        }} />}
      {townEdit && (
        <Sheet title="Ort bearbeiten" onClose={() => setTownEdit(null)}>
          <div className="section-label" style={{ margin: '18px 0 8px' }}>Name</div>
          <input className="field" value={townEdit.name} onChange={e => setTownEdit({ ...townEdit, name: e.target.value })} aria-label="Name des Orts" />
          <button onClick={saveTown} style={{ marginTop: 16, width: '100%', height: 52, border: 'none', borderRadius: 999, background: townEdit.name.trim() ? '#F3752E' : '#F3EADF', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Speichern</button>
          {app.towns[0].id !== townEdit.town.id && !townUsed(townEdit.town.id) && (
            <button onClick={deleteTown} style={{ marginTop: 6, width: '100%', height: 44, border: 'none', background: 'none', color: '#B23A12', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Ort entfernen</button>
          )}
          {app.towns[0].id !== townEdit.town.id && townUsed(townEdit.town.id) && (
            <div style={{ fontSize: 12, color: '#8A7A6D', textAlign: 'center', margin: '10px 8px 0' }}>Entfernen geht, sobald kein Laden mehr eine Filiale hier hat.</div>
          )}
        </Sheet>
      )}
    </div>
  );
}
