import type { Store } from '../lib/types';
import { LogoTile, Sheet } from '../ui/kit';

/** A store for an item that has none (on the way to the plan) – remembered for it, like choosing on the list */
export function StorePickSheet({ itemName, sub, stores, onPick, onClose }: {
  itemName: string; sub: string; stores: Store[]; onPick: (storeId: string) => void; onClose: () => void;
}) {
  return (
    <Sheet title={'Wo gibt’s ' + itemName + '?'} sub={sub} onClose={onClose} scrollBody>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {stores.map(s => (
          <button key={s.id} onClick={() => onPick(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '10px 12px', minHeight: 60, border: '2px solid #EADCCD', borderRadius: 16, background: '#fff', color: '#2A1F17', cursor: 'pointer' }}>
            <LogoTile store={s} size={36} radius={10} initialSize={15} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>
            </div>
            <span style={{ color: '#8A7A6D', fontSize: 20 }}>›</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
