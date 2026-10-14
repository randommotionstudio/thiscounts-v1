// V1.5: joining the household with an invite code.
// While an account is being created and the invite redeemed, the app must stay on the registration
// screen: the data listeners would otherwise start too early and be refused ("kein Zugriff").
import { useSyncExternalStore } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getDocFromServer } from 'firebase/firestore';
import { auth } from '../firebase';
import { redeemInvite } from '../data/actions';
import { memberRef } from '../data/refs';

let joining = false;
const subs = new Set<() => void>();
const setJoining = (v: boolean) => { joining = v; subs.forEach(f => f()); };
export const useJoining = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => joining);

export const JOIN_ERRORS: Record<string, string> = {
  'permission-denied': 'Dieser Einladungscode gilt nicht (mehr) – vielleicht wurde er schon benutzt oder ist abgelaufen. Bitte einen neuen anfordern.',
  'timeout': 'Keine Verbindung. Für die Registrierung wird Internet benötigt.',
  'auth/network-request-failed': 'Keine Verbindung. Für die Registrierung wird Internet benötigt.',
  'unavailable': 'Keine Verbindung. Für die Registrierung wird Internet benötigt.',
  'auth/invalid-email': 'Diese E-Mail-Adresse sieht nicht richtig aus.',
  'auth/weak-password': 'Das Passwort braucht mindestens 6 Zeichen.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte einen Moment warten.',
  'auth/operation-not-allowed': 'Registrieren ist gerade nicht möglich.',
  'auth/admin-restricted-operation': 'Registrieren ist gerade nicht möglich.',
  'existing-account': 'Mit dieser E-Mail gibt es schon einen Zugang, aber das Passwort passt nicht. Bitte anmelden oder das Passwort prüfen.',
};
export const joinError = (code: string | undefined) => JOIN_ERRORS[code || ''] || 'Das hat nicht geklappt. Bitte noch einmal versuchen.';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject({ code: 'timeout' }), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/** Already in the household (e.g. registering again with an existing account)? */
async function isMember(u: User) {
  try { return (await getDocFromServer(memberRef(u.uid))).exists(); } catch { return false; }
}

/**
 * "Registrieren": creates the account (or signs in, if one with this email and password exists)
 * and joins with the code. On failure everything is undone and the error code is thrown.
 */
export async function register(email: string, password: string, name: string, code: string) {
  setJoining(true);
  // (an object, so TypeScript keeps the type in the catch block)
  const st: { user: User | null; created: boolean } = { user: null, created: false };
  try {
    try {
      st.user = (await createUserWithEmailAndPassword(auth, email, password)).user;
      st.created = true;
    } catch (e) {
      if ((e as { code?: string }).code !== 'auth/email-already-in-use') throw e;
      try { st.user = (await signInWithEmailAndPassword(auth, email, password)).user; } catch { throw { code: 'existing-account' }; }
    }
    const user = st.user!;
    if (st.created || !(await isMember(user))) await withTimeout(redeemInvite(user.uid, email, name, code), 20000);
    history.replaceState(null, '', '/');
    setJoining(false);
  } catch (e) {
    // A new account that couldn't join is removed again, so the email stays free for the next try
    if (st.user && st.created) await st.user.delete().catch(() => signOut(auth));
    else if (st.user) await signOut(auth);
    setJoining(false);
    throw e;
  }
}

/** An existing account without access joins with a code (from the "kein Zugriff" screen). Reloads on success. */
export async function joinWithCode(user: User, name: string, code: string) {
  await withTimeout(redeemInvite(user.uid, user.email || '', name, code), 20000);
  location.replace('/');
}
