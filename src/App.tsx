import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, isConfigured } from './firebase';
import { DataProvider, useData } from './data/DataProvider';
import { AppProvider, useApp } from './app/AppContext';
import { useRouter } from './app/router';
import { Login } from './screens/Login';
import { ListScreen } from './screens/ListScreen';
import { PlanScreen } from './screens/PlanScreen';
import { StoreScreen } from './screens/StoreScreen';
import { MissingScreen } from './screens/MissingScreen';
import { ListSettings } from './screens/ListSettings';
import { StoresSetup } from './screens/StoresSetup';
import { Profile } from './screens/Profile';

function Frame({ children }: { children: ReactNode }) {
  return <div className="frame"><div className="app">{children}</div></div>;
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, boxSizing: 'border-box', textAlign: 'center', fontSize: 15, color: '#8A7A6D' }}>{children}</div>;
}

/** "Lade deine Listen …" — only visible on the very first login, while the first data arrives. */
function Loading() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 400); return () => clearTimeout(t); }, []);
  return <Centered>{show ? 'Lade deine Listen …' : null}</Centered>;
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (!isConfigured) {
    return <Frame><Centered><img src="/brand/app-icon-144.png" alt="" style={{ width: 72, height: 72, borderRadius: 18 }} />thisCounts ist noch nicht mit der Datenbank verbunden.</Centered></Frame>;
  }
  return (
    <Frame>
      {user === undefined ? null : user === null ? <Login /> : (
        <DataProvider key={user.uid} user={user}>
          <Main user={user} {...router} />
        </DataProvider>
      )}
    </Frame>
  );
}

function Main({ user, route, navigate, back }: { user: User } & ReturnType<typeof useRouter>) {
  const data = useData();
  if (data.denied) {
    return (
      <Centered>
        <div>Das Konto {user.email} hat keinen Zugriff auf die Listen.</div>
        <button className="outline-danger" style={{ maxWidth: 280 }} onClick={() => signOut(auth)}>Abmelden</button>
      </Centered>
    );
  }
  if (!data.ready) return <Loading />;
  return (
    <AppProvider user={user} route={route} navigate={navigate} back={back}>
      <Screens />
    </AppProvider>
  );
}

function Screens() {
  const app = useApp();
  const r = app.route;
  const needsDraft = r.name === 'listNew' || r.name === 'listEdit' || r.name === 'listStores';
  const missingDraft = needsDraft && !app.draft;
  // A settings screen without a draft (e.g. after a reload) → back to the list
  useEffect(() => { if (missingDraft) app.navigate('/', true); }, [missingDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  let screen: ReactNode = null;
  switch (r.name) {
    case 'list': screen = <ListScreen />; break;
    case 'plan': screen = <PlanScreen />; break;
    case 'profile': screen = <Profile />; break;
    case 'store': screen = <StoreScreen key={r.stopId} stopId={r.stopId} />; break;
    case 'missing': screen = <MissingScreen key={r.itemId} stopId={r.stopId} itemId={r.itemId} />; break;
    case 'listNew': case 'listEdit': screen = app.draft ? <ListSettings /> : null; break;
    case 'listStores': screen = app.draft ? <StoresSetup /> : null; break;
  }
  const floatToast = app.toastText && ['plan', 'profile', 'listNew', 'listEdit', 'listStores'].includes(r.name);
  return (
    <>
      {screen}
      {floatToast && <div className="toast-float">{app.toastText}</div>}
    </>
  );
}
