// Pure app logic, ported from the design prototype (thisCounts V1.dc.html).
// Names in comments refer to the prototype's methods so behaviour can be compared.
import type { HistoryEntry, Item, List, Stop, Store } from './types';

export const UNKNOWN = 'Unbekannt';

export const ALL_DEPTS = [
  'Obst & Gemüse', 'Backwaren', 'Fleisch & Fisch', 'Wurst & Käse', 'Milchprodukte', 'Tiefkühl',
  'Nudeln & Reis', 'Konserven', 'Gewürze & Saucen', 'Backzutaten', 'Kaffee & Tee', 'Getränke',
  'Süßwaren & Snacks', 'Frühstück', 'Drogerie', 'Haushalt', 'Baby', 'Tiernahrung', 'Sonstiges',
];

export const LOGOS: Record<string, { label: string; size: string; radius: string }> = {
  edeka: { label: 'Edeka', size: '80%', radius: '2px' },
  lidl: { label: 'Lidl', size: '78%', radius: '18%' },
  rewe: { label: 'Rewe', size: '76%', radius: '18%' },
  aldi: { label: 'Aldi Süd', size: '73%', radius: '3px' },
  netto: { label: 'Netto', size: '82%', radius: '0' },
  penny: { label: 'Penny', size: '76%', radius: '18%' },
  norma: { label: 'Norma', size: '82%', radius: '2px' },
  kaufland: { label: 'Kaufland', size: '76%', radius: '0' },
  dm: { label: 'dm', size: '82%', radius: '0' },
  schuhbeck: { label: 'Der Bäcker Schuhbeck', size: '86%', radius: '0' },
  trinkgut: { label: 'trinkgut', size: '86%', radius: '0' },
  denns: { label: 'Denns BioMarkt', size: '80%', radius: '50%' },
};

export const logoUrl = (key: string) => '/logos/' + key + '.png';

// ---------- Quantities ----------

const UNIT_RE = '(g|kg|l|ml|st(?:ü|ue)ck|stk|pck|packung(?:en)?|becher|flaschen?|dosen?|x)';
const UNIT_MAP: Record<string, string> = {
  g: 'g', kg: 'kg', l: 'l', ml: 'ml', stk: 'Stück', 'stück': 'Stück', stueck: 'Stück', pck: 'Pck.',
  packung: 'Pck.', packungen: 'Pck.', becher: 'Becher', flasche: 'Flaschen', flaschen: 'Flaschen',
  dose: 'Dosen', dosen: 'Dosen', x: 'Stück', '': 'Stück',
};

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
export const qtyStr = (q: number, u: string) => (u === 'g' && q >= 1000 ? fmtNum(q / 1000) + ' kg' : fmtNum(q) + ' ' + u);

const fmtQty = (n: string, u: string | undefined) => {
  const un = UNIT_MAP[(u || '').toLowerCase()] || u || 'Stück';
  const v = parseFloat(n.replace(',', '.'));
  return un === 'g' && v >= 1000 ? qtyStr(v, 'g') : n.replace('.', ',') + ' ' + un;
};

/** "5 Bananen", "Mehl 500 g", "1.5l Milch" → { name, qty } */
export function parseEntry(text: string): { name: string; qty: string | null } {
  const t = text.trim().replace(/\s+/g, ' ');
  let m = t.match(new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*' + UNIT_RE + '?\\.?\\s+(.+)$', 'i'));
  if (m) return { name: cap(m[3]), qty: fmtQty(m[1], m[2]) };
  m = t.match(new RegExp('^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*' + UNIT_RE + '?\\.?$', 'i'));
  if (m) return { name: cap(m[1]), qty: fmtQty(m[2], m[3]) };
  return { name: cap(t), qty: null };
}

export interface UsualDef { name: string; qty: number; unit: string; step: number; ladder?: number[] }

const EGG_LADDER = [1, 2, 4, 6, 8, 10, 12, 16];
export const USUAL: UsualDef[] = [
  { name: 'Milch', qty: 1, unit: 'l', step: 0.5 }, { name: 'Brot', qty: 1, unit: 'Stück', step: 1 },
  { name: 'Eier', qty: 10, unit: 'Stück', step: 1, ladder: EGG_LADDER }, { name: 'Bananen', qty: 5, unit: 'Stück', step: 1 },
  { name: 'Butter', qty: 250, unit: 'g', step: 250 }, { name: 'Käse', qty: 200, unit: 'g', step: 100 },
  { name: 'Nudeln', qty: 500, unit: 'g', step: 250 }, { name: 'Tomaten', qty: 500, unit: 'g', step: 250 },
  { name: 'Joghurt', qty: 4, unit: 'Becher', step: 1 }, { name: 'Kaffee', qty: 500, unit: 'g', step: 250 },
  { name: 'Äpfel', qty: 1, unit: 'kg', step: 0.1 },
];

/** State of the "Menge wählen" sheet. qty is always in the base unit (g, not kg). */
export interface Pick {
  name: string;
  qty: number;
  unit: string;
  step: number;
  ladder?: number[];
  lockUnit: string | null;
  editId: string;
}

/** pickFor() */
export function pickFor(it: { id: string; name: string; qty: string | null }): Pick {
  const m = (it.qty || '').match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  let qty = m ? parseFloat(m[1].replace(',', '.')) : 1;
  let unit = (m && m[2]) || 'Stück';
  const wasKg = unit === 'kg';
  if (wasKg) { qty = Math.round(qty * 1000); unit = 'g'; }
  const usual = USUAL.find(u => u.name.toLowerCase() === it.name.toLowerCase() && (u.unit === 'kg' ? 'g' : u.unit) === unit);
  const step = usual ? (usual.unit === 'kg' ? usual.step * 1000 : usual.step) : wasKg ? 500 : ({ g: 100, ml: 100, l: 0.5 } as Record<string, number>)[unit] || 1;
  return { name: it.name, qty, unit, step, ladder: usual && usual.ladder, lockUnit: null, editId: it.id };
}

/** dispOf() — how the sheet shows the amount (g ≥ 1000 → kg) */
export const dispOf = (pk: Pick) =>
  pk.unit === 'g' && (pk.lockUnit === 'kg' || (!pk.lockUnit && pk.qty >= 1000)) ? { n: pk.qty / 1000, u: 'kg' } : { n: pk.qty, u: pk.unit };

/** stepQ() */
export function stepQ(pk: Pick, dir: 1 | -1): number {
  const q = pk.qty, L = pk.ladder;
  if (L) {
    const top = L[L.length - 1];
    if (dir > 0) return q >= top ? Math.floor(q / 4) * 4 + 4 : L.find(x => x > q)!;
    return q > top ? Math.max(top, Math.ceil(q / 4) * 4 - 4) : ([...L].reverse().find(x => x < q) ?? L[0]);
  }
  return dir > 0 ? Math.round((q + pk.step) * 1000) / 1000 : Math.max(pk.step, Math.round((q - pk.step) * 1000) / 1000);
}

// ---------- Categories ----------

const DEPT_GUESS: [string, string][] = [
  // Checked first, so e.g. "Zahnpasta" doesn't end up under "pasta" (Nudeln & Reis)
  ['zahnpasta|zahnbürste|zahnseide', 'Drogerie'],
  ['brot|brötchen|toast', 'Backwaren'],
  ['wurst|schinken|salami|aufschnitt|käse|gouda|mozzarella|feta', 'Wurst & Käse'],
  ['hack|fleisch|hähnchen|steak|lachs|fisch', 'Fleisch & Fisch'],
  ['apfel|äpfel|banane|tomate|gurke|salat|obst|gemüse|zwiebel|kartoffel', 'Obst & Gemüse'],
  ['milch|joghurt|butter|quark|sahne|(^|[^a-zäöü])eier', 'Milchprodukte'],
  ['müsli|cornflakes|haferflocken|marmelade|honig|nutella|aufstrich', 'Frühstück'],
  ['nudel|spaghetti|pasta|penne|reis|couscous|bulgur', 'Nudeln & Reis'],
  ['dose|konserve|mais|kichererbsen|bohnen|linsen|passierte', 'Konserven'],
  ['chips|schoko|gummibär|kekse|nüsse|bonbon|süßigkeit|cracker|salzstangen', 'Süßwaren & Snacks'],
  ['salz|pfeffer|gewürz|ketchup|senf|mayo|sauce|soße|essig|öl|brühe|paprikapulver', 'Gewürze & Saucen'],
  ['mehl|zucker|backpulver|hefe', 'Backzutaten'],
  ['kaffee|tee', 'Kaffee & Tee'],
  ['wasser|saft|cola|bier|wein', 'Getränke'],
  ['pizza|eis|tiefkühl', 'Tiefkühl'],
  ['windeln|babybrei|feuchttücher|schnuller', 'Baby'],
  ['katzenfutter|hundefutter|tierfutter|katzenstreu|leckerli', 'Tiernahrung'],
  ['klopapier|toilettenpapier|küchenrolle|waschmittel|spülmittel|müllbeutel|reiniger|schwamm|alufolie|backpapier', 'Haushalt'],
  ['shampoo|zahnpasta|zahnbürste|duschgel|seife|deo|creme|ibuprofen|pflaster', 'Drogerie'],
];

/** Key used for remembered assignments ("Gemerkt"): lowercase, trimmed */
export const normName = (name: string) => name.trim().toLowerCase();

export function guessDeptFromName(name: string): string {
  const n = normName(name);
  const hit = DEPT_GUESS.find(([re]) => new RegExp(re).test(n));
  return hit ? hit[1] : UNKNOWN;
}

const DEPT_ICON: Record<string, string> = {
  'Obst & Gemüse': 'apple', 'Milchprodukte': 'milk', 'Backzutaten': 'wheat', 'Kaffee & Tee': 'coffee',
  'Getränke': 'cup-soda', 'Tiefkühl': 'snowflake', 'Backwaren': 'bread', 'Fleisch & Fisch': 'fish',
  'Süßwaren & Snacks': 'cookie', 'Drogerie': 'droplet', 'Sonstiges': 'shopping-basket', 'Frühstück': 'croissant',
  'Nudeln & Reis': 'soup', 'Konserven': 'cylinder', 'Gewürze & Saucen': 'flame', 'Wurst & Käse': 'cheese',
  'Haushalt': 'spray-can', 'Baby': 'baby', 'Tiernahrung': 'paw-print',
};

const ZONES: [string, string[]][] = [
  ['oklch(0.93 0.045 140)', ['Obst & Gemüse', 'Backwaren', 'Fleisch & Fisch']],
  ['oklch(0.93 0.035 235)', ['Wurst & Käse', 'Milchprodukte', 'Tiefkühl']],
  ['oklch(0.93 0.05 80)', ['Frühstück', 'Nudeln & Reis', 'Konserven', 'Gewürze & Saucen', 'Backzutaten', 'Kaffee & Tee', 'Getränke', 'Süßwaren & Snacks']],
  ['oklch(0.93 0.035 300)', ['Drogerie', 'Haushalt', 'Baby', 'Tiernahrung']],
];

export const tint = (d: string) => (d === UNKNOWN ? '#FDE4D1' : (ZONES.find(z => z[1].includes(d)) || ['#F3EADF'])[0]);
export const icon = (d: string) => (d === UNKNOWN ? '/icons/help.svg' : '/icons/' + (DEPT_ICON[d] || 'shopping-basket') + '.svg');

// ---------- Stops and route ----------

export const onceKey = (n: string) => 'once:' + n.trim().toLowerCase();

/** On the current trip: not parked, not waiting for a Rückfrage answer, not pushed to the next trip */
export const onTrip = (i: { parked: boolean; pendingDecision?: boolean; nextTrip?: boolean }) => !i.parked && !i.pendingDecision && !i.nextTrip;

/** effStore(): the stop an item is picked up at */
export function effStore(it: Item, list: List, storeIds: Set<string>): string | null {
  if (it.once && it.onceStopName) return onceKey(it.onceStopName);
  if (it.storeId && (it.once || list.storeIds.includes(it.storeId)) && storeIds.has(it.storeId)) return it.storeId;
  return list.mainStoreId;
}

export const storeToStop = (s: Store): Stop => ({ id: s.id, name: s.name, branch: s.branch, logo: s.logo, categoryOrder: s.categoryOrder, custom: false });

/** sById(): resolve a stop id (real store or "once:…") */
export function stopById(id: string | null, stores: Store[], items: Item[]): Stop | null {
  if (!id) return null;
  if (id.startsWith('once:')) {
    const it = items.find(i => i.once && i.onceStopName && onceKey(i.onceStopName) === id);
    return { id, name: it ? it.onceStopName!.trim() : id.slice(5), branch: 'Einmaliger Stopp', logo: null, categoryOrder: null, custom: true };
  }
  const s = stores.find(x => x.id === id);
  return s ? storeToStop(s) : null;
}

const sortByOrder = <T extends { id: string }>(arr: T[], ord: string[]) => {
  const ix = (id: string) => { const k = ord.indexOf(id); return k < 0 ? 999 : k; };
  return arr.map((s, i) => [s, i] as const).sort((a, b) => ix(a[0].id) - ix(b[0].id) || a[1] - b[1]).map(x => x[0]);
};

/**
 * route(): the ordered stops of the current trip.
 * 1. selected stores + stores targeted by one-time items, only those with ≥ 1 non-parked item
 * 2. sorted by tripOrder ?? storeOrder  3. main store first  4. deferred last  5. free-text stops appended
 */
export function route(items: Item[], list: List, stores: Store[]): Stop[] {
  const storeIds = new Set(stores.map(s => s.id));
  const ids = new Set(items.filter(onTrip).map(i => effStore(i, list, storeIds)).filter((x): x is string => !!x));
  let o = stores.filter(s => ids.has(s.id));
  const ord = list.tripOrder || list.storeOrder;
  if (ord && ord.length) o = sortByOrder(o, ord);
  o = [...o.filter(s => s.id === list.mainStoreId), ...o.filter(s => s.id !== list.mainStoreId)];
  const d = list.deferred || [];
  o = [...o.filter(s => !d.includes(s.id)), ...d.map(id => o.find(s => s.id === id)).filter((s): s is Store => !!s)];
  const custom = [...ids].filter(id => id.startsWith('once:')).map(id => stopById(id, stores, items)!);
  return [...o.map(storeToStop), ...custom];
}

/** setupOrdered(): selected non-main stores in "Meine Reihenfolge" */
export function setupOrdered(stores: Store[], storeIds: string[], mainStoreId: string | null, storeOrder: string[]): Store[] {
  return sortByOrder(stores.filter(s => storeIds.includes(s.id) && s.id !== mainStoreId), storeOrder);
}

/** moveSetup(): new storeOrder after moving a store up/down, or null if not possible */
export function moveInOrder(ids: string[], id: string, dir: -1 | 1, min = 0): string[] | null {
  const i = ids.indexOf(id), j = i + dir;
  if (i < min || j < min || j >= ids.length) return null;
  const r = [...ids];
  [r[i], r[j]] = [r[j], r[i]];
  return r;
}

/** Category groups in store mode, following the store's fixed path. */
/** The store's order plus categories of items there that aren't in it (appended, "Unbekannt" last). */
export function effectiveOrder(items: { category: string }[], order: string[]): string[] {
  const deptOrder = [...order, ...[...new Set(items.map(i => i.category))].filter(d => !order.includes(d) && d !== UNKNOWN)];
  if (items.some(i => i.category === UNKNOWN) && !deptOrder.includes(UNKNOWN)) deptOrder.push(UNKNOWN);
  return deptOrder;
}

export function storeGroups<T extends { category: string }>(items: T[], order: string[]) {
  return effectiveOrder(items, order)
    .map(d => ({ dept: d, label: d === UNKNOWN ? 'Noch einsortieren' : d, items: items.filter(i => i.category === d) }))
    .filter(g => g.items.length);
}

// ---------- "Üblich auf deiner Liste" chips ----------

export interface Chip { name: string; qty: string | null }

const HISTORY_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;

/**
 * The usual items: most-bought names of the last 4 weeks (latest quantity),
 * topped up with the prototype's defaults so there is always something to tap.
 */
export function usualChips(history: HistoryEntry[], now: number): Chip[] {
  const recent = history.filter(h => now - h.completedAtMs <= HISTORY_WINDOW_MS);
  const byName = new Map<string, { name: string; qty: string | null; count: number; last: number }>();
  for (const h of recent) {
    const k = normName(h.name);
    const e = byName.get(k);
    if (!e) byName.set(k, { name: h.name.trim(), qty: h.qty, count: 1, last: h.completedAtMs });
    else {
      e.count++;
      if (h.completedAtMs >= e.last) { e.last = h.completedAtMs; e.qty = h.qty; e.name = h.name.trim(); }
    }
  }
  const fromHistory = [...byName.values()].sort((a, b) => b.count - a.count || b.last - a.last).map(e => ({ name: e.name, qty: e.qty }));
  const seen = new Set(fromHistory.map(c => normName(c.name)));
  const defaults = USUAL.filter(u => !seen.has(normName(u.name))).map(u => ({ name: u.name, qty: qtyStr(u.qty, u.unit) }));
  return [...fromHistory, ...defaults];
}

// ---------- "Artikel fehlt": partial amounts ----------

export function missingQty(item: { name: string; qty: string | null } | null, foundRaw: number) {
  const qtyM = ((item && item.qty) || '').match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  const qtyNum = qtyM ? parseFloat(qtyM[1].replace(',', '.')) : 0;
  const qtyUnit = qtyM ? qtyM[2] : '';
  const unitL = qtyUnit.toLowerCase();
  const usualM = item && USUAL.find(u => u.name.toLowerCase() === item.name.toLowerCase() && u.unit === qtyUnit);
  let qtyStep = unitL === 'g' || unitL === 'ml' ? (qtyNum >= 1000 ? 250 : qtyNum >= 300 ? 100 : 50) : unitL === 'kg' || unitL === 'l' ? (qtyNum >= 2 ? 0.5 : 0.25) : 1;
  if (usualM && usualM.step < qtyNum && usualM.step <= qtyStep * 2.5) qtyStep = usualM.step;
  const maxFound = Math.max(0, Math.ceil(qtyNum / qtyStep - 1) * qtyStep);
  const found = Math.round(Math.min(foundRaw, maxFound) * 100) / 100;
  const rest = Math.round((qtyNum - found) * 100) / 100;
  return {
    qtyNum, qtyUnit, qtyStep, maxFound, found, rest,
    restText: fmtNum(rest) + ' ' + qtyUnit,
    foundText: qtyStep === 1 ? fmtNum(found) : fmtNum(found) + ' ' + qtyUnit,
    totalText: fmtNum(qtyNum) + ' ' + qtyUnit,
    foundQtyText: fmtNum(found) + ' ' + qtyUnit,
  };
}

// ---------- V1.1: where is the shopper? (posInfo) ----------

/**
 * The shopper's position in a store, derived from check-offs (no location needed).
 * k = highest order index of any checked item; position = k + 1 if category k is complete, else k.
 * Items someone else added during this trip (`lateFromOther`) don't reopen a category.
 * `floor` keeps the position monotonic within a session.
 */
export function posInfo(
  items: { category: string; checked: boolean; lateFromOther?: boolean }[],
  order: string[],
  floor = 0,
) {
  const deptOrder = effectiveOrder(items, order);
  const dIdx = (d: string) => { const k = deptOrder.indexOf(d); return k < 0 ? deptOrder.length : k; };
  let pos = 0;
  const chk = items.filter(i => i.checked);
  if (chk.length) {
    const k = Math.max(...chk.map(i => dIdx(i.category))), d = deptOrder[k];
    pos = items.filter(i => i.category === d && !i.lateFromOther).every(i => i.checked) ? k + 1 : k;
  }
  pos = Math.max(pos, floor);
  return { deptOrder, pos, passed: (d: string) => dIdx(d) < pos };
}

// ---------- V1.1: Filiale einrichten ----------

/** Days after the last save / "Passt noch" before the app asks again */
export const CHECK_AFTER = 60;
/** Everything a user can place on the path ("Sonstiges" and "Kasse" never go in) */
export const REF_UNIVERSE = ALL_DEPTS.filter(d => d !== 'Sonstiges');
export const DAY_MS = 24 * 60 * 60 * 1000;
export const ageDays = (ms: number | null, now: number) => (ms == null ? null : Math.max(0, Math.floor((now - ms) / DAY_MS)));
/** agoText(): heute / gestern / vor n Tagen / vor n Wochen / vor n Monaten */
export const agoText = (a: number | null) =>
  a == null ? '' : a === 0 ? 'heute' : a === 1 ? 'gestern' : a < 14 ? 'vor ' + a + ' Tagen' : a < 60 ? 'vor ' + Math.round(a / 7) + ' Wochen' : 'vor ' + Math.round(a / 30) + ' Monaten';

/** Sessions older than this are ignored everywhere */
export const SESSION_STALE_MS = 90 * 60 * 1000;
