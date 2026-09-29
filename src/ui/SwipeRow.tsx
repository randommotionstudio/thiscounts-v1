import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Width of the revealed "Löschen" button */
export const SWIPE_W = 88;
/** Movement (px) before we decide between a horizontal swipe and vertical scrolling */
const DECIDE = 8;

/**
 * iOS-style swipe to delete: swipe the row left to reveal a red "Löschen" button, tap it to delete.
 * Two deliberate steps — a long swipe does not delete. Vertical scrolling stays with the browser
 * (touch-action: pan-y); a swipe never counts as a tap on the row.
 */
export function SwipeRow({ open, onOpen, onClose, onDelete, deleteLabel, children }: {
  open: boolean; onOpen: () => void; onClose: () => void; onDelete: () => void; deleteLabel: string; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null); // live offset while dragging
  const g = useRef({ id: -1, x: 0, y: 0, base: 0, mode: '' as '' | 'h' | 'v', swiped: false });

  // Tapping anywhere else closes the open row
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open, onClose]);

  const offset = drag ?? (open ? -SWIPE_W : 0);

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, base: open ? -SWIPE_W : 0, mode: '', swiped: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    if (e.pointerId !== s.id || s.mode === 'v') return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.mode) {
      if (Math.abs(dx) > DECIDE && Math.abs(dx) > Math.abs(dy)) {
        s.mode = 'h';
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(dy) > DECIDE) { s.mode = 'v'; return; } else return;
    }
    let x = Math.min(0, s.base + dx);
    if (x < -SWIPE_W) x = -SWIPE_W + (x + SWIPE_W) * 0.3; // a little rubber band past the button
    setDrag(x);
  };
  const end = (e: React.PointerEvent) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    s.id = -1;
    if (s.mode !== 'h') return;
    s.swiped = true;
    const x = drag ?? s.base;
    setDrag(null);
    if (x < -SWIPE_W / 2) onOpen(); else onClose();
  };
  const cancel = () => { g.current.id = -1; setDrag(null); };

  return (
    <div ref={root} style={{ position: 'relative', overflow: 'hidden' }}>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        aria-label={deleteLabel} tabIndex={open ? 0 : -1} aria-hidden={!open}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: SWIPE_W, border: 'none', padding: 0, background: '#B23A12', color: '#FBF5EE',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBF5EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
        </svg>
        Löschen
      </button>
      <div
        onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}
        onClickCapture={e => {
          // The swipe itself, or a tap while the row is open, only moves the row — it doesn't open the store options
          // (Some browsers send a click right after the swipe ends — that one must not close the row again.)
          if (g.current.swiped) { e.stopPropagation(); e.preventDefault(); g.current.swiped = false; return; }
          if (open) { e.stopPropagation(); e.preventDefault(); onClose(); }
        }}
        style={{
          position: 'relative', background: '#fff', transform: `translateX(${offset}px)`, touchAction: 'pan-y',
          transition: drag == null ? 'transform .25s ease' : 'none', userSelect: drag == null ? undefined : 'none', WebkitUserSelect: drag == null ? undefined : 'none',
        }}>
        {children}
      </div>
    </div>
  );
}
