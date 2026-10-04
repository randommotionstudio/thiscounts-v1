import { storesInTown } from '../lib/logic';
import type { Store, Town } from '../lib/types';
import { Sheet } from '../ui/kit';

const ACC = '#F3752E', INK = '#2A1F17';

/** V1.4 "Wo kaufst du heute ein?" – the town of this trip */
export function TownSheet({ towns, current, stores, onPick, onClose }: {
  towns: Town[]; current: string | null; stores: Store[]; onPick: (townId: string) => void; onClose: () => void;
}) {
  return (
    <Sheet title="Wo kaufst du heute ein?" sub={'Gilt nur für dich und nur für diesen Einkauf. Danach geht’s wieder in ' + towns[0]?.name + ' los.'} onClose={onClose} scrollBody>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {towns.map(t => {
          const here = storesInTown(stores, towns, t.id), on = t.id === current;
          return (
            <button key={t.id} onClick={() => onPick(t.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', minHeight: 62, border: `2px solid ${on ? ACC : '#EADCCD'}`, borderRadius: 16, background: on ? '#FDE4D1' : '#fff', color: INK, cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{here.length + (here.length === 1 ? ' Laden' : ' Läden') + (here.length ? ' · ' + here.map(s => s.name).join(', ') : '')}</div>
              </div>
              {on && <span style={{ width: 24, height: 24, borderRadius: '50%', background: ACC, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="check-tick" style={{ borderColor: INK }} /></span>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
