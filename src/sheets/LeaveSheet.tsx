import { tint } from '../lib/logic';
import type { Item } from '../lib/types';
import { Sheet } from '../ui/kit';

/** Leaving a stop with items still open: take them along to the next stop, or leave them on the list */
export function LeaveSheet({ open, storeName, nextStopName, onAnswer, onClose }: {
  open: Item[]; storeName: string; nextStopName: string | null; onAnswer: (takeAlong: boolean) => void; onClose: () => void;
}) {
  return (
    <Sheet title={'Noch ' + open.length + ' Artikel offen'} sub={'Was soll mit den übrigen Artikeln von ' + storeName + ' passieren?'} onClose={onClose}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, maxHeight: 132, overflow: 'auto', flexShrink: 0 }}>
        {open.map(i => (
          <span key={i.id} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 999, background: tint(i.category), color: '#2A1F17' }}>{i.name}</span>
        ))}
      </div>
      {nextStopName && (
        <button onClick={() => onAnswer(true)} className="ellipsis" style={{ marginTop: 20, width: '100%', height: 52, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0, padding: '0 16px' }}>
          Alle zu {nextStopName} mitnehmen
        </button>
      )}
      {nextStopName ? (
        <button onClick={() => onAnswer(false)} style={{ marginTop: 10, width: '100%', minHeight: 52, border: '2px solid #2A1F17', borderRadius: 999, background: 'transparent', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          Auf der Einkaufsliste lassen
        </button>
      ) : (
        <button onClick={() => onAnswer(false)} style={{ marginTop: 20, width: '100%', height: 52, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          Auf der Einkaufsliste lassen
        </button>
      )}
      <div style={{ fontSize: 13, color: '#8A7A6D', textAlign: 'center', margin: '10px 8px 0', textWrap: 'pretty' }}>Sie behalten ihren Laden und sind beim nächsten Einkauf wieder dabei.</div>
    </Sheet>
  );
}
