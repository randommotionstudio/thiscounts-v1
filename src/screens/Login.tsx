import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
  'auth/user-not-found': 'E-Mail oder Passwort stimmt nicht.',
  'auth/invalid-email': 'Diese E-Mail-Adresse sieht nicht richtig aus.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte warte einen Moment.',
  'auth/network-request-failed': 'Keine Verbindung. Für die erste Anmeldung brauchst du Internet.',
  'auth/user-disabled': 'Dieser Zugang ist gesperrt.',
};

export function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const login = () => {
    const e = email.trim();
    if (!e || !pw) return setErr('Bitte E-Mail und Passwort eingeben.');
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Diese E-Mail-Adresse sieht nicht richtig aus.');
    setErr('');
    setBusy(true);
    signInWithEmailAndPassword(auth, e, pw).catch((x: { code?: string }) => {
      setBusy(false);
      setPw('');
      setErr(ERRORS[x.code || ''] || 'Anmelden hat nicht geklappt. Bitte versuch es nochmal.');
    });
  };
  const onKey = (ev: React.KeyboardEvent) => { if (ev.key === 'Enter') login(); };

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'calc(var(--safe-top) + 40px) 24px calc(var(--safe-bottom) + 40px)', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <img src="/brand/app-icon-v13-144.png" alt="thisCounts" style={{ width: 72, height: 72, borderRadius: 18, display: 'block', boxShadow: '0 8px 24px rgba(42,31,23,.14)' }} />
        <h1 className="h1" style={{ margin: '24px 0 6px' }}>Anmelden</h1>
        <p style={{ margin: '0 0 24px', color: '#6F6055', fontSize: 15, textWrap: 'pretty' }}>Mit dem Zugang, den du für den Test bekommen hast.</p>
        <div className="section-label">E-Mail</div>
        <input className="field" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" value={email}
          onChange={e => { setEmail(e.target.value); setErr(''); }} onKeyDown={onKey} placeholder="name@beispiel.de" />
        <div className="section-label" style={{ margin: '18px 0 8px' }}>Passwort</div>
        <input className="field" type="password" autoComplete="current-password" value={pw}
          onChange={e => { setPw(e.target.value); setErr(''); }} onKeyDown={onKey} />
        {err && <div style={{ fontSize: 13, color: '#B23A12', margin: '10px 4px 0' }}>{err}</div>}
        <button className="cta" style={{ marginTop: 24 }} onClick={login} disabled={busy}>{busy ? 'Anmelden …' : 'Anmelden'}</button>
      </div>
    </div>
  );
}
