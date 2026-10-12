import { formatCode, invitePath, untilLabel } from '../lib/people';
import { Sheet } from '../ui/kit';

/** The message that goes out with "Link teilen" / "Code kopieren" */
export function inviteMessage(code: string, expiresAtMs: number) {
  return 'Mach mit bei unseren Einkaufslisten in thisCounts: ' + location.origin + invitePath(code)
    + '\nOder registrier dich in der App mit dem Code ' + formatCode(code) + ' (gültig ' + untilLabel(expiresAtMs) + ').';
}

/** V1.5 "Jemanden einladen": one code for one person, valid for 7 days */
export function InviteSheet({ code, expiresAtMs, onShare, onCopy, onWithdraw, onClose }: {
  code: string; expiresAtMs: number; onShare: () => void; onCopy: () => void; onWithdraw: () => void; onClose: () => void;
}) {
  const expired = expiresAtMs <= Date.now();
  return (
    <Sheet title="Jemanden einladen" sub="Mit dem Code kann sich eine Person registrieren und sieht dann alle Listen." onClose={onClose} z={45}>
      <div style={{ marginTop: 18, background: '#fff', borderRadius: 18, boxShadow: '0 1px 0 #EADCCD', padding: '18px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em' }}>Einladungscode</div>
        <div data-code={code} style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 34, letterSpacing: '.08em', margin: '6px 0 4px', userSelect: 'all' }}>{formatCode(code)}</div>
        <div style={{ fontSize: 13, color: expired ? '#B23A12' : '#8A7A6D' }}>{expired ? 'Abgelaufen' : 'Gültig ' + untilLabel(expiresAtMs) + ' · für eine Person'}</div>
      </div>
      {!expired && (
        <>
          <button className="cta" style={{ marginTop: 16, flexShrink: 0 }} onClick={onShare}>Link teilen</button>
          <button onClick={onCopy} style={{ marginTop: 8, width: '100%', height: 48, border: 'none', borderRadius: 999, background: '#F3EADF', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Code kopieren</button>
        </>
      )}
      <button onClick={onWithdraw} style={{ marginTop: 6, width: '100%', height: 44, border: 'none', background: 'none', color: '#B23A12', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
        {expired ? 'Entfernen' : 'Einladung zurückziehen'}
      </button>
    </Sheet>
  );
}
