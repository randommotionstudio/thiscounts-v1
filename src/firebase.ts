import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseConfig } from './config/firebaseConfig';

/** Local development against the Firebase emulator: `VITE_USE_EMULATOR=1 npm run dev` */
export const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

export const isConfigured = useEmulator || !!firebaseConfig.apiKey;

const app = initializeApp(useEmulator ? { apiKey: 'demo-key', projectId: 'demo-thiscounts', authDomain: 'localhost' } : isConfigured ? firebaseConfig : { apiKey: 'unset', projectId: 'unset' });

// The session is kept on the device, so there is no second login — also offline.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });

// Offline-first: every read comes from the local IndexedDB cache, writes are queued there.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulator) {
  const host = import.meta.env.VITE_EMULATOR_HOST || location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
