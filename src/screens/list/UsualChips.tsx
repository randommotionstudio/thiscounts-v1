import { icon, tint, type Chip } from '../../lib/logic';
import { CatIcon } from '../../ui/kit';

const ACC = '#F3752E', SOFT = '#FDE4D1', INK = '#2A1F17';
/** Chips shown before "+ … mehr" */
export const CHIP_LIM = 6;

/** "Üblich auf deiner Liste": tap a chip to add (or remove again) the item with its usual amount */
export function UsualChips({ pool, searching, showAll, isOn, deptOf, onToggle, onToggleAll, keepFocus }: {
  pool: Chip[]; searching: boolean; showAll: boolean;
  isOn: (c: Chip) => boolean; deptOf: (name: string) => string;
  onToggle: (c: Chip) => void; onToggleAll: () => void;
  /** Keeps the keyboard open while tapping chips */
  keepFocus: (e: React.MouseEvent) => void;
}) {
  return (
    <div style={{ marginTop: 12, animation: 'toastIn .2s ease' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 4px 8px' }}>{searching ? 'Aus deinen üblichen Artikeln' : 'Üblich auf deiner Liste'}</div>
      {/* Capped height: the header can't scroll, so a long list must never grow over the bottom buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: '34vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {pool.slice(0, showAll ? pool.length : CHIP_LIM).map(c => {
          const on = isOn(c), d = deptOf(c.name);
          return (
            <button key={c.name} onMouseDown={keepFocus} onClick={() => onToggle(c)} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 13px 0 5px', borderRadius: 999, border: `1px solid ${on ? ACC : 'rgba(255,255,255,.95)'}`, background: on ? SOFT : 'rgba(255,255,255,.75)', color: INK, fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(42,31,23,.05)', whiteSpace: 'nowrap' }}>
              {on
                ? <span style={{ width: 28, height: 28, borderRadius: '50%', background: ACC, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 800, animation: 'pop .25s ease' }}>✓</span>
                : <span style={{ width: 28, height: 28, borderRadius: '50%', background: tint(d), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CatIcon src={icon(d)} size={15} opacity={0.8} /></span>}
              <span>{c.name}</span>
              {c.qty && <span style={{ color: '#8A7A6D', fontWeight: 500, fontSize: 13 }}>{c.qty}</span>}
            </button>
          );
        })}
        {!searching && pool.length > CHIP_LIM && (
          <button onMouseDown={keepFocus} onClick={onToggleAll} style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1px dashed #B8A696', background: 'transparent', color: '#6F6055', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {showAll ? 'Weniger' : '+ ' + (pool.length - CHIP_LIM) + ' mehr'}
          </button>
        )}
      </div>
    </div>
  );
}
