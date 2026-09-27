import { useState } from 'react';
import { dispOf, fmtNum, icon, qtyStr, stepQ, type Pick } from '../lib/logic';
import { CatIcon, Sheet } from '../ui/kit';

/** "Menge wählen": −/+ steppers and an editable number. */
export function QtySheet({ initial, dept, onClose, onSave }: { initial: Pick; dept: string; onClose: () => void; onSave: (qty: string) => void }) {
  const [pk, setPk] = useState(initial);
  // While typing we keep the raw text, so "1," can become "1,5".
  const [text, setText] = useState<string | null>(null);
  const d = dispOf(pk);
  const step = (dir: 1 | -1) => { setText(null); setPk(p => ({ ...p, qty: stepQ(p, dir), lockUnit: null })); };
  const onInput = (raw: string) => {
    setText(raw);
    const v = parseFloat(raw.replace(',', '.'));
    if (!isNaN(v)) setPk(p => ({ ...p, qty: Math.max(0, d.u === 'kg' ? v * 1000 : v), lockUnit: d.u }));
  };
  const valid = pk.qty > 0;
  const stepBtn = { width: 56, height: 56, border: 'none', borderRadius: 14, background: '#F3EADF', color: '#2A1F17', fontSize: 26, lineHeight: 1, cursor: 'pointer' } as const;

  return (
    <Sheet
      title={pk.name}
      sub={<span style={{ marginTop: 0 }}>Menge ändern</span>}
      onClose={onClose}
      head={<div style={{ width: 44, height: 44, borderRadius: 13, background: '#F3EADF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CatIcon src={icon(dept)} size={22} opacity={0.8} /></div>}
    >
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 18, padding: 8, boxShadow: '0 1px 0 #EADCCD' }}>
        <button style={stepBtn} onClick={() => step(-1)} aria-label="Weniger">−</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, minWidth: 0 }}>
          <input value={text ?? fmtNum(d.n)} onChange={e => onInput(e.target.value)} onBlur={() => setText(null)} inputMode="decimal"
            aria-label="Menge"
            style={{ width: 80, border: 'none', background: 'none', textAlign: 'right', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 34, color: '#2A1F17', outline: 'none', padding: 0 }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: '#6F6055' }}>{d.u}</span>
        </div>
        <button style={stepBtn} onClick={() => step(1)} aria-label="Mehr">+</button>
      </div>
      <button onClick={() => valid && onSave(qtyStr(pk.qty, pk.unit))}
        style={{ marginTop: 14, width: '100%', height: 56, border: 'none', borderRadius: 18, background: valid ? '#F3752E' : '#F3EADF', color: '#2A1F17', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
        {valid ? qtyStr(pk.qty, pk.unit) + ' speichern' : 'Menge eingeben'}
      </button>
    </Sheet>
  );
}
