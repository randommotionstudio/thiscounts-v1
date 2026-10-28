import { useApp } from '../app/AppContext';
import { ConnPill } from './kit';

/**
 * The confirmation message ("Reihenfolge zurückgesetzt" …), always dark. It sits just above the screen's bottom area
 * (main button / tab bar) – place it as the first child of `.bottom-fade` – so it never covers a button,
 * and it floats, so nothing on the screen shifts when it appears.
 * With `conn`, the offline / syncing indicator stays right above the bottom area and toasts stack above it,
 * so the indicator never moves when a toast comes or goes.
 */
export function Toast({ conn: withConn }: { conn?: boolean }) {
  const { toastText, toastLeaving, conn } = useApp();
  const showConn = withConn && conn !== 'online';
  if (!toastText && !showConn) return null;
  return (
    <div style={{ position: 'absolute', left: 20, right: 20, bottom: 'calc(100% - 14px)', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', zIndex: 60 }}>
      {toastText && (
        <div role="status" className={'toast-float' + (toastLeaving ? ' toast-leaving' : '')} style={{ position: 'static' }}>
          {toastText}
        </div>
      )}
      {showConn && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ display: 'flex', borderRadius: 999, boxShadow: '0 2px 10px rgba(42,31,23,.14)' }}><ConnPill conn={conn} /></span>
        </div>
      )}
    </div>
  );
}
