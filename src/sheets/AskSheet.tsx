import type { Person } from '../config/household';
import type { Stop } from '../lib/types';
import { Avatar, LogoTile } from '../ui/kit';

/** V1.1 Rückfrage: added for a store the other person already finished today – take it along at their current stop? */
export function AskSheet({ other, itemName, from, at, onAnswer }: {
  other: Person; itemName: string; from: Stop; at: Stop; onAnswer: (takeAlong: boolean) => void;
}) {
  return (
    <div className="sheet-layer" style={{ zIndex: 50 }}>
      <div className="sheet-dim" />
      <div className="sheet">
        <div className="grab" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
            <Avatar person={other} size={44} />
            <span style={{ position: 'absolute', right: -5, bottom: -5, display: 'flex', borderRadius: 7, border: '2px solid #FBF5EE' }}>
              <LogoTile store={at} size={20} radius={5} initialSize={11} bordered={false} />
            </span>
          </span>
          <div className="sheet-title" style={{ flex: 1, minWidth: 0 }}>{other.name} ist schon bei {at.name}</div>
        </div>
        <p style={{ margin: '12px 0 18px', fontSize: 15, color: '#6F6055', textWrap: 'pretty' }}>
          Bei {from.name} ist {other.name} für heute fertig. Soll {other.name} {itemName} bei {at.name} mitnehmen?
        </p>
        <button onClick={() => onAnswer(true)} style={{ width: '100%', height: 52, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>Bei {at.name} mitnehmen</button>
        <button onClick={() => onAnswer(false)} style={{ marginTop: 10, width: '100%', minHeight: 52, border: '2px solid #2A1F17', borderRadius: 999, background: 'transparent', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Beim nächsten {from.name}-Einkauf</button>
      </div>
    </div>
  );
}
