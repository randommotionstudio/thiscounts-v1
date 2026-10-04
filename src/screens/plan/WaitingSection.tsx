import type { Item, Store } from '../../lib/types';
import { LabeledRule, LogoTile } from '../../ui/kit';

/** V1.4 "Gibt’s in Frasdorf nicht": items whose store has no branch in the trip's town, by store */
export function WaitingSection({ groups, townName, elsewhere, onReplace }: {
  groups: { store: Store; items: Item[] }[]; townName: string | null;
  /** Other towns that have the store */
  elsewhere: (s: Store) => string[];
  /** "Heute in … ersetzen …" (null = nothing to replace) */
  onReplace: (() => void) | null;
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <LabeledRule style={{ margin: '0 4px 10px' }}>Gibt’s in {townName} nicht</LabeledRule>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(255,255,255,.6)' }}>
        {groups.map(g => {
          const where = elsewhere(g.store);
          return (
            <div key={g.store.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogoTile store={g.store} size={28} radius={8} initialSize={12} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600, fontSize: 14 }}>{g.store.name}</div>
                  {where.length > 0 && <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>gibt’s in {where.join(', ')}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {g.items.map(i => <span key={i.id} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 999, background: '#F3EADF', color: '#6F6055' }}>{i.name}</span>)}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 12, color: '#8A7A6D', textWrap: 'pretty' }}>Bleiben auf der Liste, bis du wieder dort einkaufst.</div>
        {onReplace && (
          <button onClick={onReplace} style={{ height: 40, border: '2px solid #EADCCD', borderRadius: 12, background: '#fff', color: '#2A1F17', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Heute in {townName} ersetzen …</button>
        )}
      </div>
    </div>
  );
}
