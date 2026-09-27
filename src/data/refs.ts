import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { HOUSEHOLD_ID } from '../config/household';
import { normName } from '../lib/logic';

export const householdRef = () => doc(db, 'households', HOUSEHOLD_ID);
export const storesCol = () => collection(db, 'households', HOUSEHOLD_ID, 'stores');
export const listsCol = () => collection(db, 'households', HOUSEHOLD_ID, 'lists');
export const itemsCol = (listId: string) => collection(db, 'households', HOUSEHOLD_ID, 'lists', listId, 'items');
export const memoryCol = () => collection(db, 'households', HOUSEHOLD_ID, 'memory');
export const historyCol = () => collection(db, 'households', HOUSEHOLD_ID, 'history');
/** V1.1: one live shopping session per person */
export const sessionsCol = () => collection(db, 'households', HOUSEHOLD_ID, 'sessions');
export const sessionRef = (uid: string) => doc(sessionsCol(), uid);
/** V1.1: per-person settings */
export const usersCol = () => collection(db, 'users');
export const userRef = (uid: string) => doc(usersCol(), uid);

export const storeRef = (id: string) => doc(storesCol(), id);
export const listRef = (id: string) => doc(listsCol(), id);
export const itemRef = (listId: string, id: string) => doc(itemsCol(listId), id);
/** Remembered assignment per item name. The name is URI-encoded so "/" can't break the path. */
export const memoryId = (name: string) => encodeURIComponent(normName(name));
export const memoryRef = (name: string) => doc(memoryCol(), memoryId(name));

/** Client-generated ids, so creating things works offline. */
export const newId = (col: ReturnType<typeof collection>) => doc(col).id;
