import { Timestamp, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_CATEGORY_ORDER, PEOPLE, SEED_MAIN_STORE, SEED_STORES, seedCategoryOrder,
} from '../config/household';
import { householdRef, listRef, storeRef } from './refs';
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
