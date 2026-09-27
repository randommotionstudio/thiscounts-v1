// Household setup for the V1 test. Taken from the filled-in TESTER_FORM.
import { ALL_DEPTS } from '../lib/logic';

export const HOUSEHOLD_ID = 'main';

export interface Person {
  email: string;
  name: string;
  /** V1.2: chosen profile picture (set at runtime from users/{uid}.avatar) */
  avatar?: import('../lib/avatar').AvatarPref;
}

/** The two test accounts. Must match firestore.rules. */
export const PEOPLE: Person[] = [
  { email: 'michael@rieplhuber.com', name: 'Michi' },
  { email: 'annacvetkov@posteo.de', name: 'Anna' },
];

const norm = (e: string | null | undefined) => (e || '').trim().toLowerCase();

export function personFor(email: string | null | undefined): Person {
  const p = PEOPLE.find(x => x.email === norm(email));
  if (p) return p;
  const name = (email || '?').split('@')[0];
  return { email: email || '', name: name.charAt(0).toUpperCase() + name.slice(1) };
}

export function otherPerson(email: string | null | undefined): Person {
  return PEOPLE.find(x => x.email !== norm(email)) || PEOPLE[0];
}

// ---------- Seed data (written once, the first time someone logs in) ----------

/** Store columns A–E of the form, in the order the testers shop them (A → B → C → D → E). */
export const SEED_STORES = [
  { id: 'netto', name: 'Netto', branch: 'Hochriesstraße 54, 83209 Prien am Chiemsee', logo: 'netto' },
  { id: 'edeka', name: 'Edeka', branch: 'Hochriesstraße 54, 83209 Prien am Chiemsee', logo: 'edeka' },
  { id: 'dm', name: 'DM', branch: 'Systemformstraße 1, 83209 Prien am Chiemsee', logo: 'dm' },
  { id: 'rewe', name: 'REWE', branch: 'Hochriesstraße 62, 83209 Prien am Chiemsee', logo: 'rewe' },
  { id: 'trinkgut', name: 'trinkgut', branch: 'Bernauer Str. 32, 83209 Prien am Chiemsee', logo: 'trinkgut' },
] as const;

export const SEED_MAIN_STORE = 'netto';

/**
 * Aisle order per store, exactly as in the form (1 = right behind the entrance).
 * Columns: Netto, Edeka, DM, REWE, trinkgut. null = the store doesn't carry it.
 */
const _ = null;
export const FORM_AISLES: [string, (number | null)[]][] = [
  ['Obst & Gemüse',     [1,  1,  _,  2,  _]],
  ['Backwaren',         [3,  13, 9,  3,  4]],
  ['Fleisch & Fisch',   [12, 11, _,  6,  _]],
  ['Wurst & Käse',      [11, 5,  _,  4,  _]],
  ['Milchprodukte',     [13, 4,  _,  5,  _]],
  ['Tiefkühl',          [19, 12, _,  19, _]],
  ['Nudeln & Reis',     [15, 7,  8,  9,  _]],
  ['Konserven',         [16, 9,  7,  10, _]],
  ['Gewürze & Saucen',  [2,  2,  5,  8,  _]],
  ['Backzutaten',       [14, 8,  6,  11, _]],
  ['Kaffee & Tee',      [9,  10, 10, 12, _]],
  ['Getränke',          [18, 18, 14, 17, 2]],
  ['Süßwaren & Snacks', [10, 3,  12, 18, 3]],
  ['Frühstück',         [8,  6,  11, 7,  _]],
  ['Drogerie',          [4,  14, 2,  13, _]],
  ['Haushalt',          [5,  15, 1,  14, 1]],
  ['Baby',              [6,  16, 4,  15, _]],
  ['Tiernahrung',       [7,  17, 3,  16, _]],
  ['Sonstiges',         [17, 19, 13, 1,  _]],
];

export function seedCategoryOrder(column: number): string[] {
  return FORM_AISLES
    .filter(([, nums]) => nums[column] != null)
    .sort((a, b) => (a[1][column] as number) - (b[1][column] as number))
    .map(([dept]) => dept);
}

export const DEFAULT_CATEGORY_ORDER = ALL_DEPTS;
