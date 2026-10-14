import { useApp } from '../app/AppContext';

/**
 * The confirmation message ("Reihenfolge zurückgesetzt" …). It sits just above the screen's bottom area
 * (main button / tab bar) – place it as the first child of `.bottom-fade` – so it never covers a button,
 * and it floats, so nothing on the screen shifts when it appears.
 */
export function Toast({ dark = false }: { dark?: boolean }) {
  const { toastText, toastLeaving } = useApp();
  if (!toastText) return null;
  return (
    <div role="status" className={(dark ? 'toast-float' : 'toast-inline toast-overlay') + (toastLeaving ? ' toast-leaving' : '')}
      style={{ position: 'absolute', left: 20, right: 20, top: 'auto', bottom: 'calc(100% - 14px)' }}>
      {toastText}
    </div>
  );
}
