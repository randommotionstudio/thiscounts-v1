import { tint } from '../../lib/logic';
import type { Item, Stop } from '../../lib/types';
import { LogoTile, UpDown } from '../../ui/kit';

const ACC = '#F3752E', LINE = '#EADCCD', PALE = '#F3EADF', INK = '#2A1F17';

const menuBtn = (first: boolean) => ({ textAlign: 'left' as const, height: 48, padding: '0 14px', border: 'none', borderTop: first ? 'none' : '1px solid #EADCCD', background: 'none', fontSize: 15, fontWeight: 600, color: INK, cursor: 'pointer' });

function Dots({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title="Mehr" className="dots" style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: 'none', color: '#6F6055', cursor: 'pointer', flexShrink: 0, marginRight: -8, padding: 0 }}>
      <span /><span /><span />
    </button>
  );
}

/** One stop of the route: number, logo, the items as chips (dashed = only here for this trip), menu or sort arrows */
export function StopCard({ stop: s, idx, items, done, isCur, isNext, insteadOf, menuOpen, onToggleMenu, sort, onStart, onAllHere, onDefer }: {
  stop: Stop; idx: number; items: Item[]; done: boolean; isCur: boolean; isNext: boolean;
  /** For stand-in items: the store they're here instead of */
  insteadOf: (i: Item) => string | null;
  menuOpen: boolean; onToggleMenu: () => void;
  /** While sorting the route: the arrows (null = not sorting) */
  sort: { isMain: boolean; onUp: () => void; onDown: () => void; noUp: boolean; noDown: boolean } | null;
  onStart: () => void; onAllHere: (() => void) | null; onDefer: () => void;
}) {
  const toggle = (e: React.MouseEvent) => { e.stopPropagation(); onToggleMenu(); };
  const status = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, padding: '3.5px 10px', borderRadius: 999, border: `1.5px solid ${done ? '#B9DFC4' : LINE}`, color: done ? '#2E6B41' : '#6F6055', whiteSpace: 'nowrap' }}>{done ? 'Erledigt' : items.length + ' Artikel'}</span>
      {items.map(i => {
        const from = insteadOf(i);
        return (
          <span key={i.id} title={from ? 'statt ' + from : undefined} style={{ fontSize: 13, padding: from ? '3.5px 8.5px' : '5px 10px', borderRadius: 999, background: i.checked ? PALE : tint(i.category), color: i.checked ? '#8A7A6D' : INK, textDecoration: i.checked ? 'line-through' : 'none', border: from ? '1.5px dashed rgba(42,31,23,.35)' : 'none' }}>{i.name}</span>
        );
      })}
    </div>
  );
  if (s.custom) {
    return (
      <div className="card" style={{ border: '2px solid #fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: done ? '#B9DFC4' : isCur ? ACC : PALE, border: '2px dashed #F3752E', boxSizing: 'border-box', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>?</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: '#8A7A6D' }}>Einmaliger Stopp</div>
          </div>
          <Dots onClick={toggle} />
        </div>
        {menuOpen && (
          <div style={{ marginTop: 10, background: '#FBF5EE', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <button onClick={onStart} style={menuBtn(true)}>Mit diesem Stopp starten</button>
          </div>
        )}
        {status}
      </div>
    );
  }
  return (
    <div className="card" style={{ border: '2px solid #fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: done ? '#B9DFC4' : isCur ? ACC : PALE, boxShadow: !done && isNext && !isCur ? 'inset 0 0 0 2px ' + ACC : 'none', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{idx + 1}</div>
        <LogoTile store={s} size={36} radius={10} initialSize={15} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
          <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>
        </div>
        {!sort && <Dots onClick={toggle} />}
        {sort && !sort.isMain && <UpDown onUp={sort.onUp} onDown={sort.onDown} noUp={sort.noUp} noDown={sort.noDown} />}
        {sort && sort.isMain && <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', flexShrink: 0 }}>immer zuerst</span>}
      </div>
      {menuOpen && !sort && (
        <div style={{ marginTop: 10, background: '#FBF5EE', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <button onClick={onStart} style={menuBtn(true)}>Mit diesem Laden starten</button>
          {onAllHere && (
            <button onClick={onAllHere} style={menuBtn(false)}>Alles hier einkaufen <span style={{ color: '#8A7A6D', fontWeight: 500 }}>· nur ein Stopp</span></button>
          )}
          <button onClick={onDefer} style={menuBtn(false)}>Später erledigen</button>
        </div>
      )}
      {status}
      {!done && !isNext && (
        <button onClick={onStart} style={{ marginTop: 12, width: '100%', height: 44, border: '2px solid #EADCCD', borderRadius: 14, background: '#fff', color: INK, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Stattdessen hier starten</button>
      )}
    </div>
  );
}
