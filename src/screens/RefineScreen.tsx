import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import * as actions from '../data/actions';
import { REF_UNIVERSE, agoText, ageDays, icon, storeOrderInfo } from '../lib/logic';
import { useHeaderHeight } from '../ui/kit';

const ACC = '#F3752E', SOFT = '#FDE4D1', LINE = '#EADCCD', PALE = '#F3EADF', INK = '#2A1F17';

function Arrow() {
  return (
    <span style={{ height: 44, display: 'flex', alignItems: 'center' }}>
      <svg width="30" height="16" viewBox="0 0 30 16" style={{ display: 'block' }}>
        <line x1="1" y1="8" x2="24" y2="8" stroke="#F3752E" strokeWidth="3" strokeLinecap="round" />
        <polyline points="18,2 26,8 18,14" fill="none" stroke="#F3752E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** The expected walk through a store (asset from the design prototype). */
function StorePathIllustration() {
  return (
    <svg viewBox="0 0 320 200" style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Erwarteter Weg durch die Filiale">
      <rect x="8" y="8" width="304" height="184" rx="12" fill="#FBF5EE" />
      <path d="M312 88 V20 Q312 8 300 8 H20 Q8 8 8 20 V180 Q8 192 20 192 H300 Q312 192 312 180 V154" fill="none" stroke="#D8CBBD" strokeWidth="3" strokeLinecap="round" />
      <path d="M210 46 V120 H312" fill="none" stroke="#D8CBBD" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="41" y="68" width="8" height="90" rx="4" fill="#EADCCD" />
      <rect x="82" y="68" width="8" height="90" rx="4" fill="#EADCCD" />
      <rect x="123" y="68" width="8" height="90" rx="4" fill="#EADCCD" />
      <rect x="164" y="68" width="8" height="90" rx="4" fill="#EADCCD" />
      <rect x="224" y="54" width="12" height="32" rx="4" fill="#C9B8A6" />
      <rect x="250" y="54" width="12" height="32" rx="4" fill="#C9B8A6" />
      <rect x="276" y="54" width="12" height="32" rx="4" fill="#C9B8A6" />
      <rect x="228" y="147" width="68" height="13" rx="4" fill="#EADCCD" />
      <path d="M318 140 H230 Q222 140 222 148 V160 Q222 168 230 168 H286 Q292 168 292 174 Q292 180 286 180 H197 Q189 180 189 172 V61 Q189 53 181 53 H155.5 Q147.5 53 147.5 61 V172 Q147.5 180 139.5 180 H114.5 Q106.5 180 106.5 172 V61 Q106.5 53 98.5 53 H73.5 Q65.5 53 65.5 61 V172 Q65.5 180 57.5 180 H32 Q24 180 24 172 V34 Q24 26 32 26 H261 Q269 26 269 34 V92 Q269 100 277 100 H318" fill="none" stroke="#F3752E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="none" stroke="#F3752E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M146 20 L152 26 L146 32" /><path d="M18 116 L24 110 L30 116" /><path d="M100.5 116 L106.5 110 L112.5 116" />
        <path d="M183 126 L189 120 L195 126" /><path d="M262 134 L256 140 L262 146" /><path d="M291 94 L297 100 L291 106" />
      </g>
      <circle cx="318" cy="140" r="4" fill="#F3752E" />
      <g fontSize="9" fontWeight="600" fill="#8A7A6D" fontFamily="inherit">
        <text x="240" y="44" textAnchor="middle">Kasse</text>
        <text x="306" y="132" textAnchor="end">Eingang</text>
        <text x="264" y="112" textAnchor="end">Ausgang</text>
        <text x="262" y="156.5" textAnchor="middle" fontSize="7.5" fill="#6F6055">Obst &amp; Gemüse</text>
      </g>
    </svg>
  );
}

/** V1.1 Feature A: "Filiale einrichten / anpassen" — the walking order of the categories in a store. */
export function RefineScreen({ stopId }: { stopId: string }) {
  const app = useApp();
  const { data, toast, other } = app;
  const store = data.stores.find(s => s.id === stopId) || null;
  const storePath = paths.store(stopId);
  const [headRef, headH] = useHeaderHeight();

  const orderInfo = store ? storeOrderInfo(store) : null;
  const isEdit = !!orderInfo && orderInfo.isSet;
  const base = isEdit ? (store!.categoryOrder || data.defaultCategoryOrder).filter(d => REF_UNIVERSE.includes(d)) : [];
  const [order, setOrder] = useState<string[]>(base);
  const [pick, setPick] = useState<string | null>(null);
  const [guide, setGuide] = useState(!isEdit);
  const [noneOk, setNoneOk] = useState(isEdit);

  // A free-text stop or a deleted store has nothing to set up
  useEffect(() => { if (!store) app.back(storePath); }, [store]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!store) return null;

  const placed = order.length;
  const open = REF_UNIVERSE.filter(d => !order.includes(d));
  const changed = order.join('|') !== base.join('|');
  const ready = placed > 0 && (open.length === 0 || noneOk);
  const canSave = ready && (!isEdit || changed);
  const saveLabel = isEdit && !changed ? 'Noch keine Änderung' : !placed ? 'Erste Abteilung antippen' : !ready ? 'Alle Abteilungen einordnen' : isEdit ? 'Änderungen speichern' : 'Reihenfolge speichern';
  const pickIdx = pick ? order.indexOf(pick) : -1;
  const age = ageDays(orderInfo!.checkedAtMs, Date.now());

  const swap = (dir: -1 | 1) => {
    const i = pickIdx, j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
  };
  const save = () => {
    if (!canSave) return;
    actions.saveStoreOrder(store, order);
    app.back(storePath);
    toast(isEdit ? 'Weg bei ' + store.name + ' aktualisiert' : store.name + ' nutzt jetzt deinen Weg – auch für ' + other.name);
  };

  const chip = (d: string, on: boolean, num: number | '+') => {
    const picked = pick === d;
    return (
      <button key={d} onClick={() => (on ? setPick(p => (p === d ? null : d)) : (setOrder(o => [...o, d]), setPick(null)))} style={{
        height: 44, flexShrink: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 14px 0 8px', borderRadius: 999,
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        border: `2px solid ${picked ? INK : on ? ACC : LINE}`, background: on ? SOFT : '#fff', color: INK,
      }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: on ? ACC : 'transparent', color: on ? INK : '#8A7A6D', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</span>
        <span role="img" aria-label={d} style={{ width: 16, height: 16, display: 'block', flexShrink: 0, opacity: 0.7, background: `url(${icon(d)}) center/16px no-repeat` }} />
        {d}
      </button>
    );
  };
  const pickBtn = (disabled: boolean) => ({ width: 44, height: 44, borderRadius: '50%', border: 'none', background: disabled ? '#3D3129' : '#5A4A3E', color: '#FBF5EE', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' } as const);

  return (
    <div className="screen">
      <div ref={headRef} className="glass-head" style={{ padding: 'calc(var(--safe-top) + 14px) 20px 12px' }}>
        <button className="back-link" style={{ margin: '0 0 2px' }} onClick={() => app.back(storePath)}>‹ Zurück in den Laden</button>
        <h1 className="h1" style={{ fontSize: 26, margin: '2px 0 2px', textWrap: 'pretty' }}>{isEdit ? 'Was hat sich bei ' + store.name + ' geändert?' : 'Wie läufst du durch ' + store.name + '?'}</h1>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#8A7A6D' }}>{store.branch}</div>
      </div>
      <div className="scroll" style={{ padding: '0 20px calc(var(--safe-bottom) + 200px)', paddingTop: (headH || 150) + 16 }}>
        <p style={{ margin: '0 0 16px', color: '#6F6055', fontSize: 15, textWrap: 'pretty' }}>
          {isEdit
            ? 'Gespeichert ' + agoText(age) + '. Tippe eine Abteilung an, um sie zu verschieben oder zu entfernen.'
            : 'Tippe alle Abteilungen in der Reihenfolge an, in der du sie durchläufst. Bisher nutzen wir die Standard-Reihenfolge von ' + store.name + '.'}
        </p>
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 0 #EADCCD', marginBottom: 20 }}>
          <button onClick={() => setGuide(g => !g)} style={{ width: '100%', minHeight: 48, padding: '12px 14px', border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: INK }}>Bitte diesem Weg folgen</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#C9581A', flexShrink: 0 }}>{guide ? 'Ausblenden' : 'Anzeigen'}</span>
          </button>
          {guide && (
            <div style={{ padding: '0 14px 12px', marginTop: -6 }}>
              <p style={{ margin: '4px 0 12px', fontSize: 13, lineHeight: 1.45, color: '#6F6055', textWrap: 'pretty' }}>Jeder läuft anders – damit alle Angaben vergleichbar sind, gehen wir von diesem Weg aus: vom Eingang an Obst &amp; Gemüse vorbei, Gang für Gang in Schlangenlinien, zum Schluss zur Kasse.</p>
              <StorePathIllustration />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28, marginBottom: 4, paddingRight: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em' }}>Dein Weg</span>
          {(isEdit ? changed : placed > 0) && (
            <button onClick={() => { setOrder([...base]); setPick(null); }} style={{ border: 'none', background: 'none', padding: '6px 0', color: '#C9581A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{isEdit ? 'Ursprüngliche Reihenfolge' : 'Zurücksetzen'}</button>
          )}
        </div>
        <div style={{ fontSize: 13, color: '#6F6055', marginBottom: 12, textWrap: 'pretty' }}>{placed ? 'Tippe eine nummerierte Abteilung an, um sie zu verschieben.' : 'Die Kasse setzen wir automatisch ans Ende.'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {order.map((d, i) => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', maxWidth: '100%' }}>
              {i === 0 && <Arrow />}
              {chip(d, true, i + 1)}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            {!placed && <Arrow />}
            <div aria-label="Kasse, immer am Ende" style={{ height: 44, padding: '0 14px 0 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, border: '2px dashed #C9B8A6', background: PALE, color: '#6F6055', boxSizing: 'border-box' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: LINE, color: '#6F6055', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{placed + 1}</span>
              <span style={{ width: 16, height: 16, display: 'block', flexShrink: 0, opacity: 0.6, background: 'url(/icons/receipt.svg) center/16px no-repeat' }} />Kasse
            </div>
            <Arrow />
          </div>
        </div>
        {open.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em', margin: '26px 0 12px' }}>Noch nicht eingeordnet · {open.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{open.map(d => chip(d, false, '+'))}</div>
            <label style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, minHeight: 44, boxSizing: 'border-box', borderRadius: 16, background: noneOk ? SOFT : PALE, cursor: 'pointer' }}>
              <input type="checkbox" checked={noneOk} onChange={() => setNoneOk(v => !v)} style={{ width: 22, height: 22, margin: 0, flexShrink: 0, accentColor: '#F3752E', cursor: 'pointer' }} />
              <span style={{ fontSize: 14, lineHeight: 1.4, color: INK, textWrap: 'pretty' }}>Ich bestätige, dass es diese Abteilungen in dieser Filiale nicht gibt.</span>
            </label>
          </>
        )}
      </div>
      <div className="bottom-fade" style={{ display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', padding: '24px 20px max(14px, calc(var(--safe-bottom) + 6px))' }}>
        {pick && pickIdx >= 0 && (
          <div style={{ pointerEvents: 'auto', minHeight: 64, boxSizing: 'border-box', background: 'rgba(42,31,23,.92)', WebkitBackdropFilter: 'blur(18px) saturate(1.5)', backdropFilter: 'blur(18px) saturate(1.5)', borderRadius: 24, padding: '10px 10px 10px 18px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 30px rgba(42,31,23,.25)', animation: 'toastIn .2s ease' }}>
            <div style={{ flex: 1, minWidth: 0, color: '#FBF5EE' }}>
              <div style={{ fontSize: 12, color: '#C9B8A6' }}>Stopp {pickIdx + 1}</div>
              <div className="ellipsis" style={{ fontSize: 15, fontWeight: 600 }}>{pick}</div>
            </div>
            <button onClick={() => swap(-1)} disabled={pickIdx <= 0} aria-label="Nach vorne" style={pickBtn(pickIdx <= 0)}>‹</button>
            <button onClick={() => swap(1)} disabled={pickIdx >= placed - 1} aria-label="Nach hinten" style={pickBtn(pickIdx >= placed - 1)}>›</button>
            <button onClick={() => { setOrder(o => o.filter(x => x !== pick)); setPick(null); }} aria-label="Entfernen" style={{ ...pickBtn(false), background: '#C9581A' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBF5EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
            </button>
            <button onClick={() => setPick(null)} style={{ height: 44, padding: '0 10px', border: 'none', background: 'none', color: '#FBF5EE', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Fertig</button>
          </div>
        )}
        <button onClick={save} style={{
          pointerEvents: 'auto', width: '100%', height: 56, border: 'none', borderRadius: 999, WebkitBackdropFilter: 'blur(10px) saturate(2)', backdropFilter: 'blur(10px) saturate(2)',
          background: canSave ? 'rgba(242,106,16,.86)' : 'rgba(216,203,189,.72)', color: canSave ? INK : '#8A7A6D', fontSize: 17, fontWeight: 700, cursor: 'pointer',
          boxShadow: canSave ? '0 10px 28px rgba(243,117,46,.28), inset 0 1px 0 rgba(255,255,255,.45), inset 0 0 0 1px rgba(255,255,255,.18)' : 'inset 0 0 0 1px rgba(255,255,255,.4)',
        }}>{saveLabel}</button>
      </div>
    </div>
  );
}
