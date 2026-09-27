import { Timestamp, getDocsFromServer, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_CATEGORY_ORDER, PEOPLE, SEED_MAIN_STORE, SEED_STORES, seedCategoryOrder,
} from '../config/household';
import { householdRef, listRef, storeRef, storesCol } from './refs';
import { report } from './write';

/**
 * Creates the household, the testers' stores and the first list.
 * Runs once: only when the server confirms that no household exists yet.
 * All ids are fixed, so two phones seeding at the same moment write identical data.
 */
export function seedHousehold(uid: string) {
  const batch = writeBatch(db);
  const base = Date.now();
  SEED_STORES.forEach((s, i) => {
    batch.set(storeRef(s.id), {
      name: s.name, branch: s.branch, logo: s.logo, categoryOrder: seedCategoryOrder(i),
      createdAt: Timestamp.fromMillis(base + i), updatedAt: serverTimestamp(),
    });
  });
  const ids = SEED_STORES.map(s => s.id as string);
  batch.set(listRef('wocheneinkauf'), {
    name: 'Wocheneinkauf',
    storeIds: ids,
    mainStoreId: SEED_MAIN_STORE,
    storeOrder: ids.filter(id => id !== SEED_MAIN_STORE),
    tripOrder: null,
    deferred: [],
    createdAt: Timestamp.fromMillis(base), updatedAt: serverTimestamp(),
  });
  batch.set(householdRef(), {
    name: 'Zuhause',
    members: PEOPLE.map(p => p.email),
    defaultCategoryOrder: DEFAULT_CATEGORY_ORDER,
    seededBy: uid,
    createdAt: serverTimestamp(),
  });
  report(batch.commit());
}

/** A fresh "Wocheneinkauf" with all stores — only used when every list has been deleted. */
export function seedDefaultList() {
  getDocsFromServer(storesCol()).then(snap => {
    const ids = snap.docs
      .map(d => ({ id: d.id, t: (d.get('createdAt') as Timestamp | undefined)?.toMillis() ?? 0 }))
      .sort((a, b) => a.t - b.t)
      .map(x => x.id);
    const main = ids.includes(SEED_MAIN_STORE) ? SEED_MAIN_STORE : ids[0] || null;
    report(setDoc(listRef('wocheneinkauf'), {
      name: 'Wocheneinkauf', storeIds: ids, mainStoreId: main, storeOrder: ids.filter(id => id !== main),
      tripOrder: null, deferred: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }).catch(e => console.warn('[thisCounts] could not create a list', e));
}
