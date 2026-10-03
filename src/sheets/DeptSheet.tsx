import { ALL_DEPTS, icon, tint } from '../lib/logic';
import { CatIcon, Sheet } from '../ui/kit';

/** "Kategorie wählen" */
export function DeptSheet({ name, current, onClose, onPick }: { name: string; current: string; onClose: () => void; onPick: (d: string) => void }) {
  return (
    <Sheet title={<>Wo findet man „{name}“?</>} sub="Wir merken uns die Kategorie für das nächste Mal." onClose={onClose} scrollBody>
      <div className="dept-grid">
        {ALL_DEPTS.map((d, i) => {
          const on = current === d;
          return (
            <button key={d} onClick={() => onPick(d)} style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '8px 10px', minHeight: 52,
              border: `2px solid ${on ? '#F3752E' : '#EADCCD'}`, borderRadius: 14, background: on ? '#FDE4D1' : '#fff', color: '#2A1F17', cursor: 'pointer',
              gridColumn: ALL_DEPTS.length % 2 && i === ALL_DEPTS.length - 1 ? '1 / -1' : 'auto',
            }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: tint(d), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CatIcon src={icon(d)} size={16} opacity={0.8} />
              </span>
              <span style={{ fontWeight: 600, fontSize: 14, minWidth: 0 }}>{d}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
