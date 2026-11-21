import type { Item } from '../../lib/types';

/** Items on the list without a store ("Offen · Laden wählen"): they only come along once a store is chosen – so
 *  they're shown at the top of the plan, before the trip starts, instead of being quietly left out */
export function UnassignedSection({ items, onPick }: { items: Item[]; onPick: (i: Item) => void }) {
  const one = items.length === 1;
  return (
    <div className="card" data-unassigned style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{one ? '1 Artikel ohne Laden' : items.length + ' Artikel ohne Laden'}</div>
        <div style={{ fontSize: 13, color: '#8A7A6D', textWrap: 'pretty' }}>{one ? 'Kommt erst mit, sobald ein Laden gewählt ist.' : 'Kommen erst mit, sobald ein Laden gewählt ist.'}</div>
      </div>
      {items.map(i => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600 }}>{i.name}</div>
            {i.qty && <div style={{ fontSize: 12, color: '#8A7A6D' }}>{i.qty}</div>}
          </div>
          {/* Same look as "Offen · Laden wählen" on the list */}
          <button onClick={() => onPick(i)} style={{ height: 36, padding: '0 14px', border: 'none', borderRadius: 999, background: '#2A1F17', color: '#FBF5EE', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Laden wählen</button>
        </div>
      ))}
    </div>
  );
}
