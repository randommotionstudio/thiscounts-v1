import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { joinError, register } from '../app/join';
import { codeFromPath, formatCode, normalizeCode } from '../lib/people';
import { TextLink } from '../ui/kit';

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
  'auth/user-not-found': 'E-Mail oder Passwort stimmt nicht.',
  'auth/invalid-email': 'Diese E-Mail-Adresse sieht nicht richtig aus.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte einen Moment warten.',
  'auth/network-request-failed': 'Keine Verbindung. Für die erste Anmeldung wird Internet benötigt.',
  'auth/user-disabled': 'Dieser Zugang ist gesperrt.',
};

const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e);

/** Anmelden – or, V1.5, registering with an invite (opened from an invite link: /einladung/K7M4QX) */
export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>(() => (codeFromPath(location.pathname) ? 'register' : 'login'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState(() => { const c = codeFromPath(location.pathname); const n = c && normalizeCode(c); return n ? formatCode(n) : c || ''; });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const reg = mode === 'register';

  const login = () => {
    const e = email.trim();
    if (!e || !pw) return setErr('Bitte E-Mail und Passwort eingeben.');
    if (!emailOk(e)) return setErr('Diese E-Mail-Adresse sieht nicht richtig aus.');
    setErr('');
    setBusy(true);
    signInWithEmailAndPassword(auth, e, pw).catch((x: { code?: string }) => {
      setBusy(false);
      setPw('');
      setErr(ERRORS[x.code || ''] || 'Anmelden hat nicht geklappt. Bitte noch einmal versuchen.');
    });
  };
  const signUp = () => {
    const e = email.trim(), n = name.trim(), c = normalizeCode(code);
    if (!n) return setErr('Bitte einen Namen eingeben – so erscheint er für die anderen.');
    if (!e || !emailOk(e)) return setErr('Diese E-Mail-Adresse sieht nicht richtig aus.');
    if (pw.length < 6) return setErr('Das Passwort braucht mindestens 6 Zeichen.');
    if (!c) return setErr('Der Einladungscode hat 6 Zeichen, z. B. K7M-4QX.');
    if (!navigator.onLine) return setErr(joinError('timeout'));
    setErr('');
    setBusy(true);
    register(e, pw, n.slice(0, 40), c).catch((x: { code?: string }) => {
      setBusy(false);
      setErr(joinError(x && x.code));
    });
  };
  const submit = reg ? signUp : login;
  const onKey = (ev: React.KeyboardEvent) => { if (ev.key === 'Enter') submit(); };
  const switchMode = () => { setMode(reg ? 'login' : 'register'); setErr(''); };

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'calc(var(--safe-top) + 40px) 24px calc(var(--safe-bottom) + 40px)', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <img src="/brand/app-icon-v13-144.png" alt="thisCounts" style={{ width: 72, height: 72, borderRadius: 18, display: 'block', boxShadow: '0 8px 24px rgba(42,31,23,.14)' }} />
        <h1 className="h1" style={{ margin: '24px 0 6px' }}>{reg ? 'Registrieren' : 'Anmelden'}</h1>
        <p style={{ margin: '0 0 24px', color: '#6F6055', fontSize: 15, textWrap: 'pretty' }}>
          {reg ? 'Mit dem erhaltenen Einladungscode. Danach sind alle Listen des Haushalts sichtbar.' : 'Mit dem Zugang für den Test.'}
        </p>
        {reg && (
          <>
            <div className="section-label">Name</div>
            <input className="field" autoComplete="given-name" autoCapitalize="words" maxLength={40} value={name}
              onChange={e => { setName(e.target.value); setErr(''); }} onKeyDown={onKey} placeholder="So erscheint er für die anderen" />
            <div className="section-label" style={{ margin: '18px 0 8px' }}>E-Mail</div>
          </>
        )}
        {!reg && <div className="section-label">E-Mail</div>}
        <input className="field" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" value={email}
          onChange={e => { setEmail(e.target.value); setErr(''); }} onKeyDown={onKey} placeholder="name@beispiel.de" />
        <div className="section-label" style={{ margin: '18px 0 8px' }}>Passwort</div>
        <input className="field" type="password" autoComplete={reg ? 'new-password' : 'current-password'} value={pw}
          onChange={e => { setPw(e.target.value); setErr(''); }} onKeyDown={onKey} placeholder={reg ? 'Mindestens 6 Zeichen' : undefined} />
        {reg && (
          <>
            <div className="section-label" style={{ margin: '18px 0 8px' }}>Einladungscode</div>
            <input className="field" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={code} aria-label="Einladungscode"
              onChange={e => { setCode(e.target.value.toUpperCase()); setErr(''); }} onKeyDown={onKey} placeholder="z. B. K7M-4QX"
              style={{ letterSpacing: '.08em' }} />
          </>
        )}
        {err && <div role="alert" style={{ fontSize: 13, color: '#B23A12', margin: '10px 4px 0', textWrap: 'pretty' }}>{err}</div>}
        <button className="cta" style={{ marginTop: 24 }} onClick={submit} disabled={busy}>
          {reg ? (busy ? 'Registrieren …' : 'Registrieren') : (busy ? 'Anmelden …' : 'Anmelden')}
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <TextLink onClick={switchMode}>{reg ? 'Schon dabei? Anmelden' : 'Neu hier? Mit Einladung registrieren'}</TextLink>
        </div>
      </div>
    </div>
  );
}
