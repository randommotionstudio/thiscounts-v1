import { tint } from '../../lib/logic';
import type { Item, Stop } from '../../lib/types';
import { LogoTile, UpDown } from '../../ui/kit';

const ACC = '#F3752E', LINE = '#EADCCD', PALE = '#F3EADF', INK = '#2A1F17';

const menuBtn = (first: boolean) => ({ textAlign: 'left' as const, minHeight: 48, padding: '10px 14px', border: 'none', borderTop: first ? 'none' : '1px solid #EADCCD', background: 'none', fontSize: 15, fontWeight: 600, color: INK, cursor: 'pointer' });

type MenuEntry = { label: string; sub?: string; onClick: () => void };

/** The stop's ⋯ menu */
function Menu({ entries }: { entries: MenuEntry[] }) {
  return (
    <div role="menu" style={{ marginTop: 10, background: '#FBF5EE', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {entries.map((e, i) => (
        <button key={e.label} role="menuitem" onClick={e.onClick} style={menuBtn(i === 0)}>
          {e.label}{e.sub && <span style={{ color: '#8A7A6D', fontWeight: 500 }}> · {e.sub}</span>}
        </button>
      ))}
    </div>
  );
}

function Dots({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title="Mehr" className="dots" style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: 'none', color: '#6F6055', cursor: 'pointer', flexShrink: 0, marginRight: -8, padding: 0 }}>
      <span /><span /><span />
    </button>
  );
}

/** One stop of the route: number, logo, the items as chips (dashed = only here for this trip), menu or sort arrows */
export function StopCard({ stop: s, idx, items, done, loose, isCur, isNext, running, insteadOf, menuOpen, onToggleMenu, sort, onStart, onOnly, onAllHere, allCount, onSkip }: {
  stop: Stop; idx: number; items: Item[]; done: boolean; isCur: boolean; isNext: boolean;
  /** V1.9: a one-time stop without a place in the order yet ("Ohne feste Reihenfolge") – shows "?" instead of a number */
  loose: boolean;
  /** A trip is under way on this phone ("Jetzt hierhin" instead of "Hier starten") */
  running: boolean;
  /** For stand-in items: the store they're here instead of */
  insteadOf: (i: Item) => string | null;
  menuOpen: boolean; onToggleMenu: () => void;
  /** While sorting the route: the arrows (null = not sorting) */
  sort: { fixed: string | null; note: string | null; onUp: () => void; onDown: () => void; noUp: boolean; noDown: boolean } | null;
  /** null while someone else is shopping (V1.5: one person at a time) */
  onStart: (() => void) | null;
  /** V1.8 "Nur hier einkaufen": a trip with just this stop (null = not offered) */
  onOnly: (() => void) | null;
  /** "Alles hier einkaufen": all open items to this stop (null = not offered); allCount = how many */
  onAllHere: (() => void) | null; allCount: number;
  /** V1.8 "Heute auslassen": off this trip, the items stay on the list (null = not offered) */
  onSkip: (() => void) | null;
}) {
  const toggle = (e: React.MouseEvent) => { e.stopPropagation(); onToggleMenu(); };
  const open = items.filter(i => !i.checked).length;
  const only: MenuEntry[] = onOnly && !done ? [{ label: 'Nur hier einkaufen', sub: 'nur ' + open + ' Artikel', onClick: onOnly }] : [];
  // A finished stop: back in, e.g. for something forgotten
  const again: MenuEntry[] = onStart && done ? [{ label: 'Nochmal hierhin', onClick: onStart }] : [];
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
  // V1.8: every option lives in the ⋯ menu (no buttons on the card)
  const entries: MenuEntry[] = done ? again : [
    ...(onStart && !isCur ? [{ label: running ? 'Jetzt hierhin' : 'Hier starten', onClick: onStart }] : []),
    ...only,
    ...(onAllHere ? [{ label: 'Alles hier einkaufen', sub: 'alle ' + allCount + ' Artikel', onClick: onAllHere }] : []),
    ...(onSkip ? [{ label: 'Heute auslassen', onClick: onSkip }] : []),
  ];
  if (s.custom) {
    return (
      <div className="card" style={{ border: '2px solid #fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: done ? '#B9DFC4' : isCur ? ACC : PALE, border: loose ? '2px dashed #F3752E' : 'none', boxShadow: !loose && !done && isNext && !isCur ? 'inset 0 0 0 2px ' + ACC : 'none', boxSizing: 'border-box', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{loose ? '?' : idx + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: '#8A7A6D' }}>Einmaliger Stopp</div>
          </div>
          {!sort && entries.length > 0 && <Dots onClick={toggle} />}
          {sort && !sort.fixed && <UpDown onUp={sort.onUp} onDown={sort.onDown} noUp={sort.noUp} noDown={sort.noDown} />}
          {sort && sort.fixed && <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', flexShrink: 0 }}>{sort.fixed}</span>}
        </div>
        {menuOpen && !sort && entries.length > 0 && <Menu entries={entries} />}
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
          {sort && sort.note
            ? <div style={{ fontSize: 12, color: '#8A7A6D', textWrap: 'pretty' }}>{sort.note}</div>
            : <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>}
        </div>
        {!sort && entries.length > 0 && <Dots onClick={toggle} />}
        {sort && !sort.fixed && <UpDown onUp={sort.onUp} onDown={sort.onDown} noUp={sort.noUp} noDown={sort.noDown} />}
        {sort && sort.fixed && <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', flexShrink: 0 }}>{sort.fixed}</span>}
      </div>
      {menuOpen && !sort && entries.length > 0 && <Menu entries={entries} />}
      {status}
    </div>
  );
}
