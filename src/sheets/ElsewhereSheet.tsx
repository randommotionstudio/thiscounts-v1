import { storesInTown } from '../lib/logic';
import type { Store, Town } from '../lib/types';
import { LogoTile, Sheet, TextLink } from '../ui/kit';

/** "Woanders einkaufen": pick any store (grouped by town, the trip's town first) for a spontaneous trip */
export function ElsewhereSheet({ stores, towns, currentTown, onPick, onNewStore, onClose }: {
  stores: Store[]; towns: Town[]; currentTown: string | null;
  onPick: (storeId: string, townId: string | null) => void; onNewStore: () => void; onClose: () => void;
}) {
  const groups = towns.length >= 2 ? [...towns].sort((a, b) => (a.id === currentTown ? -1 : b.id === currentTown ? 1 : 0)) : [null];
  return (
    <Sheet title="Woanders einkaufen" sub="Du siehst deine ganze Liste in diesem Laden. Was du nicht abhakst, bleibt bei seinem Laden." onClose={onClose} scrollBody>
      {groups.map(t => (
        <div key={t ? t.id : 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {t && <div className="section-label" style={{ margin: '4px 4px 0' }}>In {t.name}</div>}
          {(t ? storesInTown(stores, towns, t.id) : stores).map(s => (
            <button key={s.id} onClick={() => onPick(s.id, t ? t.id : currentTown)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '10px 12px', minHeight: 60, border: '2px solid #EADCCD', borderRadius: 16, background: '#fff', color: '#2A1F17', cursor: 'pointer' }}>
              <LogoTile store={s} size={36} radius={10} initialSize={15} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>
              </div>
              <span style={{ color: '#8A7A6D', fontSize: 20 }}>›</span>
            </button>
          ))}
        </div>
      ))}
      <TextLink onClick={onNewStore} style={{ marginTop: 10, alignSelf: 'center' }}>Laden fehlt? Neu anlegen</TextLink>
    </Sheet>
  );
}
