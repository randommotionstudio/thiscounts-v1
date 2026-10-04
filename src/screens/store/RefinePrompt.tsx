import { agoText } from '../../lib/logic';
import { TextLink } from '../../ui/kit';

/** The route glyph used on the "Filiale einrichten" cards */
export function RouteGlyph() {
  return (
    <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F3752E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ display: 'block' }}>
        <polyline points="4,20 9,8 17,18 23,7" fill="none" stroke="#2A1F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="18.5,7.5 23,7 23.5,11.5" fill="none" stroke="#2A1F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="4" cy="20" r="2.6" fill="#2A1F17" /><circle cx="9" cy="8" r="2.6" fill="#2A1F17" /><circle cx="17" cy="18" r="2.6" fill="#2A1F17" />
      </svg>
    </div>
  );
}

/**
 * V1.1 "Filiale einrichten" at the bottom of store mode:
 * offer (no path yet) · check (path older than CHECK_AFTER days) · cooldown (just a quiet link).
 */
export function RefinePrompt({ state, age, onRefine, onConfirm }: {
  state: 'offer' | 'check' | 'cooldown' | null; age: number | null; onRefine: () => void; onConfirm: () => void;
}) {
  if (state === 'cooldown') {
    return (
      <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
        <TextLink onClick={onRefine}>Aufbau der Filiale geändert?</TextLink>
      </div>
    );
  }
  if (state === 'check') {
    return (
      <div style={{ marginTop: 20, background: '#FDE4D1', borderRadius: 18, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RouteGlyph />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Stimmt dein Weg noch?</div>
            <div style={{ fontSize: 13, color: '#9C4412' }}>Gespeichert {agoText(age)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onConfirm} style={{ flex: 1, height: 44, borderRadius: 14, border: '2px solid #F3752E', background: 'transparent', color: '#2A1F17', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Passt noch</button>
          <button onClick={onRefine} style={{ flex: 1, height: 44, borderRadius: 14, border: 'none', background: '#F3752E', color: '#2A1F17', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Anpassen</button>
        </div>
      </div>
    );
  }
  if (state === 'offer') {
    return (
      <div onClick={onRefine} style={{ marginTop: 20, background: '#FDE4D1', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <RouteGlyph />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Hilf mit, diese Filiale genauer zu machen</div>
          <div style={{ fontSize: 13, color: '#9C4412' }}>Abteilungs-Reihenfolge antippen</div>
        </div>
        <span style={{ color: '#9C4412', fontSize: 20 }}>›</span>
      </div>
    );
  }
  return null;
}
