import { describe, expect, it } from 'vitest';
import {
  ALL_DEPTS, UNKNOWN, effStore, guessDeptFromName, missingQty, moveInOrder, parseEntry, pickFor, route,
  stepQ, storeGroups, usualChips,
} from './logic';
import type { Item, List, Store } from './types';
import { FORM_AISLES, seedCategoryOrder } from '../config/household';

const store = (id: string, i: number): Store => ({ id, name: id.toUpperCase(), branch: '', logo: null, categoryOrder: null, orderSetAtMs: null, orderCheckedAtMs: null, orderSetBy: null, createdAtMs: i, town: null, branches: {}, branchTown: null });
const STORES = ['a', 'b', 'c', 'd', 'x'].map(store);
const list = (p: Partial<List> = {}): List => ({
  id: 'l', name: 'L', storeIds: ['a', 'b', 'c', 'd'], mainStoreId: 'a', storeOrder: ['b', 'c', 'd'],
  tripOrder: null, deferred: [], createdAtMs: 0, ...p,
});
let n = 0;
const item = (p: Partial<Item> = {}): Item => ({
  id: 'i' + ++n, listId: 'l', name: 'X', qty: null, category: UNKNOWN, storeId: null, once: false,
  onceStopName: null, parked: false, checked: false, checkedBy: null, createdBy: null, createdAtMs: n, pendingDecision: false, nextTrip: false, ...p,
});

describe('parseEntry', () => {
  it('parses leading and trailing quantities', () => {
    expect(parseEntry('5 Bananen')).toEqual({ name: 'Bananen', qty: '5 Stück' });
    expect(parseEntry('500 g Mehl')).toEqual({ name: 'Mehl', qty: '500 g' });
    expect(parseEntry('mehl 1500g')).toEqual({ name: 'Mehl', qty: '1,5 kg' });
    expect(parseEntry('1.5 l Milch')).toEqual({ name: 'Milch', qty: '1,5 l' });
    expect(parseEntry('2 Flaschen Wasser')).toEqual({ name: 'Wasser', qty: '2 Flaschen' });
    expect(parseEntry('  butter ')).toEqual({ name: 'Butter', qty: null });
  });
});

describe('categories', () => {
  it('guesses by regex', () => {
    expect(guessDeptFromName('Vollkornbrot')).toBe('Backwaren');
    expect(guessDeptFromName('Katzenfutter')).toBe('Tiernahrung');
    expect(guessDeptFromName('Glühbirne')).toBe(UNKNOWN);
    expect(guessDeptFromName('Zahnpasta')).toBe('Drogerie');
    expect(guessDeptFromName('Pasta')).toBe('Nudeln & Reis');
    expect(guessDeptFromName('Eier')).toBe('Eier');
    expect(guessDeptFromName('Bio-Eier')).toBe('Eier');
    expect(guessDeptFromName('Eiernudeln')).toBe('Nudeln & Reis');
    expect(guessDeptFromName('Milch')).toBe('Milchprodukte');
    expect(guessDeptFromName('Pfeffer')).toBe('Gewürze');
    expect(guessDeptFromName('Brühe')).toBe('Gewürze');
    expect(guessDeptFromName('Ketchup')).toBe('Saucen');
    expect(guessDeptFromName('Olivenöl')).toBe('Saucen');
    expect(guessDeptFromName('Tofu')).toBe('Kühltheke');
    expect(guessDeptFromName('Kartoffelsalat')).toBe('Kühltheke');
    expect(guessDeptFromName('Nudelsalat')).toBe('Kühltheke');
    expect(guessDeptFromName('Rotwein')).toBe('Wein & Spirituosen');
    expect(guessDeptFromName('Wein')).toBe('Wein & Spirituosen');
    expect(guessDeptFromName('Bier')).toBe('Getränke');
    expect(guessDeptFromName('Weißbier')).toBe('Getränke');
    expect(guessDeptFromName('Sekt')).toBe('Wein & Spirituosen');
    expect(guessDeptFromName('Gin')).toBe('Wein & Spirituosen');
    expect(guessDeptFromName('Schweinefilet')).toBe('Fleisch & Fisch');
    expect(guessDeptFromName('Bierschinken')).toBe('Wurst & Käse');
    expect(guessDeptFromName('Mineralwasser')).toBe('Getränke');
    expect(guessDeptFromName('Ingwer')).toBe(UNKNOWN);
  });
});

describe('V1.3 category upgrade', () => {
  it('splits old "Gewürze & Saucen" items by name', () => {
    expect(upgradeCategory('Gewürze & Saucen', 'Senf')).toBe('Saucen');
    expect(upgradeCategory('Gewürze & Saucen', 'Salz')).toBe('Gewürze');
    expect(upgradeCategory('Gewürze & Saucen', 'Irgendwas')).toBe('Gewürze');
  });
  it('moves eggs out of Milchprodukte, leaves everything else', () => {
    expect(upgradeCategory('Milchprodukte', 'Eier')).toBe('Eier');
    expect(upgradeCategory('Milchprodukte', 'Quark')).toBe('Milchprodukte');
    expect(upgradeCategory('Backwaren', 'Eier')).toBe('Backwaren');
    expect(upgradeCategory('Saucen', 'Salz')).toBe('Saucen');
  });
  it('old store paths: split in place, Eier + Kühltheke after Milchprodukte, Wein after Getränke, Angebote first', () => {
    expect(upgradeOrder(['Obst & Gemüse', 'Gewürze & Saucen', 'Milchprodukte', 'Getränke'], true))
      .toEqual(['Angebote', 'Obst & Gemüse', 'Gewürze', 'Saucen', 'Milchprodukte', 'Eier', 'Kühltheke', 'Getränke', 'Wein & Spirituosen']);
  });
  it('an old path without "Gewürze & Saucen" (trinkgut) is upgraded too', () => {
    expect(upgradeOrder(['Haushalt', 'Getränke', 'Backwaren'], true)).toEqual(['Angebote', 'Haushalt', 'Getränke', 'Wein & Spirituosen', 'Backwaren']);
  });
  it('upgrading twice changes nothing more', () => {
    const once = upgradeOrder(['Gewürze & Saucen', 'Milchprodukte', 'Getränke'], true);
    expect(upgradeOrder(once, true)).toEqual(once);
  });
  it('paths saved since V1.3 stay exactly as they are', () => {
    const o = ['Obst & Gemüse', 'Saucen', 'Milchprodukte', 'Getränke'];
    expect(upgradeOrder(o, false)).toBe(o);
  });
  it('household default: legacy only if it still has "Gewürze & Saucen"', () => {
    expect(isLegacyOrder(['Gewürze & Saucen'])).toBe(true);
    expect(isLegacyOrder(ALL_DEPTS)).toBe(false);
  });
  it('wine and beer filed under Getränke move to Wein & Spirituosen', () => {
    expect(upgradeCategory('Getränke', 'Rotwein')).toBe('Wein & Spirituosen');
    expect(upgradeCategory('Getränke', 'Apfelsaft')).toBe('Getränke');
    expect(upgradeCategory('Getränke', 'Bier')).toBe('Getränke');
  });
});

describe('route', () => {
  it('main first, then standing order, only stops with items', () => {
    const items = [item({ storeId: 'd' }), item({ storeId: 'b' }), item()];
    expect(route(items, list(), STORES).map(s => s.id)).toEqual(['a', 'b', 'd']);
  });
  it('trip order overrides standing order, main stays first', () => {
    const items = [item({ storeId: 'd' }), item({ storeId: 'b' }), item()];
    expect(route(items, list({ tripOrder: ['d', 'a', 'b'] }), STORES).map(s => s.id)).toEqual(['a', 'd', 'b']);
  });
  it('deferred go last in deferral order, free-text stops after them', () => {
    const items = [item({ storeId: 'b' }), item({ storeId: 'c' }), item(), item({ once: true, onceStopName: ' Apotheke' }), item({ once: true, onceStopName: 'apotheke ' })];
    const r = route(items, list({ deferred: ['c', 'a'] }), STORES);
    expect(r.map(s => s.id)).toEqual(['b', 'c', 'a', 'once:apotheke']);
    expect(r[3]).toMatchObject({ name: 'Apotheke', custom: true });
  });
  it('one-time store outside the list set is a stop; unselected store without once → main', () => {
    const l = list();
    const ids = new Set(STORES.map(s => s.id));
    expect(effStore(item({ storeId: 'x', once: true }), l, ids)).toBe('x');
    expect(effStore(item({ storeId: 'x' }), l, ids)).toBe('a');
    expect(route([item({ storeId: 'x', once: true })], l, STORES).map(s => s.id)).toEqual(['x']);
  });
  it('parked items create no stops', () => {
    expect(route([item({ parked: true })], list(), STORES)).toEqual([]);
  });
});

describe('moveInOrder', () => {
  it('swaps and respects bounds', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(['a', 'b', 'c'], 'b', -1, 1)).toBeNull();
    expect(moveInOrder(['a', 'b', 'c'], 'c', 1)).toBeNull();
  });
});

describe('quantities', () => {
  it('pickFor + stepQ', () => {
    const p = pickFor({ id: '1', name: 'Eier', qty: '10 Stück' });
    expect(stepQ(p, 1)).toBe(12);
    expect(stepQ(p, -1)).toBe(8);
    const k = pickFor({ id: '2', name: 'Äpfel', qty: '1 kg' });
    expect(k).toMatchObject({ qty: 1000, unit: 'g', step: 100 });
  });
  it('missingQty splits', () => {
    const m = missingQty({ name: 'Bananen', qty: '5 Stück' }, 2);
    expect(m).toMatchObject({ qtyNum: 5, found: 2, rest: 3, restText: '3 Stück', maxFound: 4 });
    expect(missingQty({ name: 'Mehl', qty: null }, 0).maxFound).toBe(0);
  });
});

describe('store groups', () => {
  it('follow the fixed order, unknown categories appended', () => {
    const g = storeGroups([{ category: 'Getränke' }, { category: UNKNOWN }, { category: 'Haushalt' }, { category: 'Baby' }], ['Haushalt', 'Getränke']);
    expect(g.map(x => x.label)).toEqual(['Haushalt', 'Getränke', 'Baby', 'Noch einsortieren']);
  });
});

describe('usual chips', () => {
  const now = Date.now(), DAY = 86400000;
  const h = (name: string, qty: string, ago: number) => ({ id: name + ago + Math.random(), name, qty, storeId: null, listId: 'l', completedAtMs: now - ago });
  it('only items bought on 2+ trips, most trips first, latest quantity; then defaults', () => {
    const { usual } = usualChips([
      h('Hafermilch', '1 l', 9 * DAY), h('Hafermilch', '2 l', 2 * DAY), h('Hafermilch', '1 l', 20 * DAY),
      h('Kiwi', '3 Stück', 3 * DAY), h('Kiwi', '3 Stück', 10 * DAY),
      h('Kondome', '1 Pck.', 4 * DAY),
    ], now);
    expect(usual[0]).toEqual({ name: 'Hafermilch', qty: '2 l' });
    expect(usual[1]).toEqual({ name: 'Kiwi', qty: '3 Stück' });
    expect(usual.some(c => c.name === 'Kondome')).toBe(false);
    expect(usual[2].name).toBe('Milch'); // first default
  });
  it('one trip counts once, even if the item was split across two stores', () => {
    const { usual } = usualChips([h('Käse', '100 g', DAY), h('Käse', '100 g', DAY)], now);
    expect(usual.some(c => c.name === 'Käse' && c.qty === '100 g')).toBe(false);
  });
  it('things bought once are only offered while typing; older than 8 weeks are forgotten', () => {
    const { all } = usualChips([h('Kondome', '1 Pck.', 4 * DAY), h('Alt', '1 Stück', 60 * DAY), h('Alt', '1 Stück', 70 * DAY)], now);
    expect(all.some(c => c.name === 'Kondome')).toBe(true);
    expect(all.some(c => c.name === 'Alt')).toBe(false);
  });
  it('defaults are not doubled when the household already buys them', () => {
    const { usual, all } = usualChips([h('Milch', '2 l', DAY)], now);
    expect(usual.filter(c => c.name === 'Milch')).toHaveLength(0);
    expect(all.filter(c => c.name === 'Milch')).toEqual([{ name: 'Milch', qty: '2 l' }]);
  });
});

describe('seed aisles from the tester form', () => {
  it('each column is a permutation of 1..n', () => {
    for (let c = 0; c < 5; c++) {
      const nums = FORM_AISLES.map(r => r[1][c]).filter((x): x is number => x != null).sort((a, b) => a - b);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
    }
  });
  it('Netto order starts with Angebote, Obst & Gemüse, Gewürze, Saucen, Backwaren', () => {
    expect(seedCategoryOrder(0).slice(0, 5)).toEqual(['Angebote', 'Obst & Gemüse', 'Gewürze', 'Saucen', 'Backwaren']);
    expect(seedCategoryOrder(0)).toContain('Eier');
    expect(seedCategoryOrder(4)).toEqual(['Angebote', 'Haushalt', 'Getränke', 'Wein & Spirituosen', 'Süßwaren & Snacks', 'Backwaren']);
  });
  it('every category after the upgrade is a known one', () => {
    for (let c = 0; c < 5; c++) seedCategoryOrder(c).forEach(d => expect(ALL_DEPTS).toContain(d));
  });
});

// ---------- V1.1 ----------
import { agoText, posInfo, route as route2 } from './logic';

describe('V1.1 posInfo', () => {
  const order = ['Obst & Gemüse', 'Backwaren', 'Milchprodukte', 'Getränke'];
  it('nothing checked → position 0', () => {
    expect(posInfo([{ category: 'Milchprodukte', checked: false }], order).pos).toBe(0);
  });
  it('category complete → next one; incomplete → stays', () => {
    const items = [{ category: 'Obst & Gemüse', checked: true }, { category: 'Milchprodukte', checked: true }, { category: 'Milchprodukte', checked: false }];
    const p = posInfo(items, order);
    expect(p.pos).toBe(2);
    expect(p.passed('Backwaren')).toBe(true);
    expect(p.passed('Milchprodukte')).toBe(false);
    items[2].checked = true;
    expect(posInfo(items, order).pos).toBe(3);
  });
  it('items someone else added later do not reopen a category', () => {
    const p = posInfo([{ category: 'Milchprodukte', checked: true }, { category: 'Milchprodukte', checked: false, lateFromOther: true }], order);
    expect(p.pos).toBe(3);
    expect(p.passed('Milchprodukte')).toBe(true);
  });
  it('is monotonic with a floor', () => {
    expect(posInfo([{ category: 'Obst & Gemüse', checked: false }], order, 3).pos).toBe(3);
  });
});

describe('V1.1 agoText', () => {
  it('formats ages', () => {
    expect([0, 1, 5, 14, 30, 61, 150].map(agoText)).toEqual(['heute', 'gestern', 'vor 5 Tagen', 'vor 2 Wochen', 'vor 4 Wochen', 'vor 2 Monaten', 'vor 5 Monaten']);
  });
});

describe('V1.1 trip exclusions', () => {
  it('pendingDecision and nextTrip items create no stops', () => {
    const l = list();
    expect(route2([item({ storeId: 'b', nextTrip: true }), item({ storeId: 'c', pendingDecision: true })], l, STORES)).toEqual([]);
  });
});

import { markSinceAtStart } from '../app/markSince';
describe('V1.1 markSince', () => {
  const M = 60 * 1000;
  it('first launch marks nothing', () => { expect(markSinceAtStart(1000 * M, null, null)).toBe(1000 * M); });
  it('quick restart keeps the stored value', () => { expect(markSinceAtStart(1000 * M, 998 * M, 900 * M)).toBe(900 * M); });
  it('back after >= 10 min: since the app was closed', () => { expect(markSinceAtStart(1000 * M, 985 * M, 900 * M)).toBe(985 * M); });
});

import { normalizeAvatar } from './avatar';
describe('V1.2 avatar', () => {
  it('missing → initial on orange', () => { expect(normalizeAvatar(undefined)).toEqual({ kind: 'initial', icon: null, color: 0 }); });
  it('keeps a valid icon and color', () => { expect(normalizeAvatar({ kind: 'icon', icon: 'pizza', color: 3 })).toEqual({ kind: 'icon', icon: 'pizza', color: 3 }); });
  it('initial keeps the last icon (harmless)', () => { expect(normalizeAvatar({ kind: 'initial', icon: 'egg', color: 2 })).toEqual({ kind: 'initial', icon: 'egg', color: 2 }); });
  it('rejects junk', () => { expect(normalizeAvatar({ kind: 'icon', icon: 'rocket', color: 9 })).toEqual({ kind: 'initial', icon: null, color: 0 }); });
});

import { movePatch } from './logic';
describe('movePatch', () => {
  it('store on the list / outside it / free-text stop', () => {
    const l = { storeIds: ['a', 'b'] };
    expect(movePatch({ id: 'b', name: 'B', branch: '', logo: null, categoryOrder: null, custom: false }, l)).toMatchObject({ storeId: 'b', once: false });
    expect(movePatch({ id: 'x', name: 'X', branch: '', logo: null, categoryOrder: null, custom: false }, l)).toMatchObject({ storeId: 'x', once: true });
    expect(movePatch({ id: 'once:apotheke', name: 'Apotheke', branch: '', logo: null, categoryOrder: null, custom: true }, l)).toMatchObject({ storeId: null, once: true, onceStopName: 'Apotheke' });
  });
});

import { storeOrderInfo } from './logic';
import { isLegacyOrder, upgradeCategory, upgradeOrder } from './logic';
describe('storeOrderInfo', () => {
  const base = { orderSetAtMs: null, orderCheckedAtMs: null, categoryOrder: null, createdAtMs: 1000 };
  it('no path → setup offer', () => { expect(storeOrderInfo(base)).toEqual({ isSet: false, checkedAtMs: null }); });
  it('path from the tester form → set up since creation', () => { expect(storeOrderInfo({ ...base, categoryOrder: ['Backwaren'] })).toEqual({ isSet: true, checkedAtMs: 1000 }); });
  it('saved in the app → its own dates', () => { expect(storeOrderInfo({ ...base, categoryOrder: ['Backwaren'], orderSetAtMs: 5000, orderCheckedAtMs: 7000 })).toEqual({ isSet: true, checkedAtMs: 7000 }); });
});

// ---------- V1.4 Towns ----------
import { mainInTown, storesInTown, townsOf, tripPlan } from './logic';
import type { Town } from './types';

describe('towns', () => {
  const towns: Town[] = [{ id: 'prien', name: 'Prien' }, { id: 'frasdorf', name: 'Frasdorf' }];
  const mk = (id: string, i: number, p: Partial<Store> = {}): Store => ({ ...store(id, i), ...p });
  const fr = { address: 'Hauptstr. 1, Frasdorf', categoryOrder: ['Getränke', 'Milchprodukte'], orderSetAtMs: 5, orderCheckedAtMs: 5, orderSetBy: 'u' };
  const stores = [
    mk('netto', 0, { branch: 'Prien', categoryOrder: ['Obst & Gemüse'], branches: { frasdorf: fr } }),
    mk('edeka', 1), mk('dm', 2),
    mk('baecker', 3, { town: 'frasdorf', branch: 'Bäcker Frasdorf' }),
  ];
  const l = list({ storeIds: ['netto', 'edeka', 'dm', 'baecker'], mainStoreId: 'netto', storeOrder: ['edeka', 'dm', 'baecker'] });
  const its = [item({ name: 'Milch', storeId: null }), item({ name: 'Brot', storeId: 'edeka' }), item({ name: 'Shampoo', storeId: 'dm' }), item({ name: 'Semmel', storeId: 'baecker' })];

  it('without a second town nothing changes', () => {
    expect(storesInTown(stores, [towns[0]], 'prien')).toBe(stores);
    expect(storesInTown(stores, [], null)).toBe(stores);
  });
  it('each town sees its own branches', () => {
    expect(storesInTown(stores, towns, 'prien').map(s => s.id)).toEqual(['netto', 'edeka', 'dm']);
    const f = storesInTown(stores, towns, 'frasdorf');
    expect(f.map(s => s.id)).toEqual(['netto', 'baecker']);
    expect(f[0]).toMatchObject({ branch: 'Hauptstr. 1, Frasdorf', categoryOrder: ['Getränke', 'Milchprodukte'], branchTown: 'frasdorf' });
    expect(f[1]).toMatchObject({ branch: 'Bäcker Frasdorf', branchTown: null });
  });
  it('townsOf lists where a store has branches', () => {
    expect(townsOf(stores[0], towns).map(t => t.id)).toEqual(['prien', 'frasdorf']);
    expect(townsOf(stores[1], towns).map(t => t.id)).toEqual(['prien']);
    expect(townsOf(stores[3], towns).map(t => t.id)).toEqual(['frasdorf']);
  });
  it('trip in Prien: the bakery items wait', () => {
    const t = tripPlan(its, l, stores, storesInTown(stores, towns, 'prien'));
    expect(t.route.map(s => s.id)).toEqual(['netto', 'edeka', 'dm']);
    expect(t.unavailable.map(i => i.name)).toEqual(['Semmel']);
  });
  it('trip in Frasdorf: Netto there, Edeka and DM items wait', () => {
    const t = tripPlan(its, l, stores, storesInTown(stores, towns, 'frasdorf'));
    expect(t.route.map(s => s.id)).toEqual(['netto', 'baecker']);
    expect(t.route[0].categoryOrder).toEqual(['Getränke', 'Milchprodukte']);
    expect(t.unavailable.map(i => i.name).sort()).toEqual(['Brot', 'Shampoo']);
    expect(t.stopOf(its[0])).toBe('netto');
  });
  it('no Hauptladen in town → the first store of the usual order there takes its items', () => {
    const noNettoThere = stores.map(s => (s.id === 'netto' ? { ...s, branches: {} } : s));
    const ts = storesInTown(noNettoThere, towns, 'frasdorf');
    expect(mainInTown(l, ts)).toBe('baecker');
    const t = tripPlan(its, l, noNettoThere, ts);
    expect(t.route.map(s => s.id)).toEqual(['baecker']);
    expect(t.stopOf(its[0])).toBe('baecker'); // Milch (Hauptladen) → bakery's the main store here
  });
  it('one-time free-text stops exist everywhere', () => {
    const once = item({ name: 'Aspirin', once: true, onceStopName: 'Apotheke' });
    const t = tripPlan([once], l, stores, storesInTown(stores, towns, 'frasdorf'));
    expect(t.route.map(s => s.id)).toEqual(['once:apotheke']);
  });
});
