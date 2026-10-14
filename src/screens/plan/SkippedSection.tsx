import type { Item, Stop } from '../../lib/types';
import { LabeledRule, LogoTile } from '../../ui/kit';

/** V1.8 "Heute nicht": stops left out of this trip with "Heute auslassen" – their items stay on the list */
export function SkippedSection({ groups, onUndo }: {
  groups: { stop: Stop; items: Item[] }[];
  /** "Doch mitnehmen" (null while someone else is shopping) */
  onUndo: ((s: Stop) => void) | null;
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <LabeledRule style={{ margin: '0 4px 10px' }}>Heute nicht</LabeledRule>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(255,255,255,.6)' }}>
        {groups.map(g => (
          <div key={g.stop.id} data-skipped={g.stop.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {g.stop.custom
                ? <span style={{ width: 28, height: 28, borderRadius: 8, border: '2px dashed #F3752E', boxSizing: 'border-box', flexShrink: 0 }} />
                : <LogoTile store={g.stop} size={28} radius={8} initialSize={12} />}
              <div className="ellipsis" style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14 }}>{g.stop.name}</div>
              {onUndo && (
                <button onClick={() => onUndo(g.stop)} style={{ border: 'none', background: 'none', padding: '6px 0', color: '#C9581A', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Doch mitnehmen</button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {g.items.map(i => <span key={i.id} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 999, background: '#F3EADF', color: '#6F6055' }}>{i.name}</span>)}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 12, color: '#8A7A6D', textWrap: 'pretty' }}>Bleiben auf der Liste – beim nächsten Einkauf sind sie wieder dabei.</div>
      </div>
    </div>
  );
}
