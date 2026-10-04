import { tint } from '../lib/logic';
import type { Item, Store } from '../lib/types';
import { LogoTile, Sheet } from '../ui/kit';

/** The result of useTrip().previewIn(town): what stand-ins would do there */
export interface StandInPreview {
  missing: Item[];
  stores: Store[];
  stopOf: (it: Item) => string | null;
  temp: (it: Item) => { from: string | null; maybeNot: boolean } | null;
}

/**
 * V1.4: "Netto und Edeka gibt’s in Bernau nicht" – should their items go to stores there for this trip?
 * Shows where each item would go; dashed = that store probably doesn't have it.
 */
export function StandInSheet({ preview: p, townName, fromNames, onAnswer, onClose }: {
  preview: StandInPreview; townName: string; fromNames: string[]; onAnswer: (yes: boolean) => void; onClose: () => void;
}) {
  const groups = p.stores.map(s => ({ store: s, items: p.missing.filter(i => p.stopOf(i) === s.id) })).filter(g => g.items.length);
  const n = p.missing.length;
  return (
    <Sheet title={fromNames.join(' und ') + ' gibt’s in ' + townName + ' nicht'} sub={'Sollen ' + (n === 1 ? 'der Artikel' : 'die ' + n + ' Artikel') + ' bei diesem Einkauf in ' + townName + ' mit? Ihr gewohnter Laden bleibt.'} onClose={onClose} scrollBody>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {groups.map(g => (
          <div key={g.store.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoTile store={g.store} size={28} radius={8} initialSize={12} />
              <div className="ellipsis" style={{ fontWeight: 600, fontSize: 14 }}>{g.store.name}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {g.items.map(i => {
                const maybe = p.temp(i)?.maybeNot;
                return <span key={i.id} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 999, background: maybe ? 'transparent' : tint(i.category), border: maybe ? '1.5px dashed #D8CBBD' : 'none', color: maybe ? '#8A7A6D' : '#2A1F17' }}>{i.name}</span>;
              })}
            </div>
          </div>
        ))}
        {groups.some(g => g.items.some(i => p.temp(i)?.maybeNot)) && (
          <div style={{ fontSize: 12, color: '#8A7A6D', textWrap: 'pretty' }}>Gestrichelt: gibt’s dort laut eurem Weg vermutlich nicht – steht im Laden ganz unten.</div>
        )}
      </div>
      <button onClick={() => onAnswer(true)} style={{ marginTop: 20, width: '100%', height: 52, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Ja, heute dort einkaufen</button>
      <button onClick={() => onAnswer(false)} style={{ marginTop: 10, width: '100%', minHeight: 52, border: '2px solid #2A1F17', borderRadius: 999, background: 'transparent', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Nein, auf der Liste lassen</button>
    </Sheet>
  );
}
