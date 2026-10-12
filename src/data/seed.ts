import { Timestamp, getDocsFromServer, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from 'firebase/auth';
import {
  DEFAULT_CATEGORY_ORDER, PEOPLE, SEED_MAIN_STORE, SEED_STORES, isTesterEmail, personFor, seedCategoryOrder,
} from '../config/household';
import { householdRef, listRef, memberRef, storeRef, storesCol } from './refs';
import { PATH_VERSION } from '../lib/logic';
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
      name: s.name, branch: s.branch, logo: s.logo, categoryOrder: seedCategoryOrder(i), pathVersion: PATH_VERSION,
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

/**
 * A fresh "Wocheneinkauf" with all stores — used when every list has been deleted,
 * or (V1.6) as your own list when you were taken off all the others.
 */
export function seedDefaultList(listId = 'wocheneinkauf', name = 'Wocheneinkauf', without: string[] = []) {
  getDocsFromServer(storesCol()).then(snap => {
    const ids = snap.docs
      .map(d => ({ id: d.id, t: (d.get('createdAt') as Timestamp | undefined)?.toMillis() ?? 0 }))
      .sort((a, b) => a.t - b.t)
      .map(x => x.id);
    const main = ids.includes(SEED_MAIN_STORE) ? SEED_MAIN_STORE : ids[0] || null;
    report(setDoc(listRef(listId), {
      name, storeIds: ids, mainStoreId: main, storeOrder: ids.filter(id => id !== main),
      tripOrder: null, deferred: [], without, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }).catch(e => console.warn('[thisCounts] could not create a list', e));
}

/** V1.5: the two original testers get a member entry (with their name) without an invite */
export function joinAsTester(user: User) {
  if (!isTesterEmail(user.email)) return;
  report(setDoc(memberRef(user.uid), { name: personFor(user.email).name, email: (user.email || '').toLowerCase(), joinedAt: serverTimestamp(), invite: null }));
}

/** V1.6: you're on no list any more → "Meine Liste", only for you (fixed id, so two phones don't make two) */
export function seedOwnList(uid: string, others: string[]) {
  seedDefaultList('eigene-' + uid, 'Meine Liste', others);
}
