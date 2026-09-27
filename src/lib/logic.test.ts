import { describe, expect, it } from 'vitest';
import {
  ALL_DEPTS, UNKNOWN, effStore, guessDeptFromName, missingQty, moveInOrder, parseEntry, pickFor, route,
  stepQ, storeGroups, usualChips,
} from './logic';
import type { Item, List, Store } from './types';
import { FORM_AISLES, seedCategoryOrder } from '../config/household';

const store = (id: string, i: number): Store => ({ id, name: id.toUpperCase(), branch: '', logo: null, categoryOrder: null, orderSetAtMs: null, orderCheckedAtMs: null, orderSetBy: null, createdAtMs: i });
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
    expect(guessDeptFromName('Eier')).toBe('Milchprodukte');
    expect(guessDeptFromName('Bio-Eier')).toBe('Milchprodukte');
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
  it('history first by count, then defaults', () => {
    const now = Date.now();
    const h = (name: string, qty: string, ago: number) => ({ id: name + ago, name, qty, storeId: null, listId: 'l', completedAtMs: now - ago });
    const chips = usualChips([h('Hafermilch', '1 l', 1000), h('Hafermilch', '2 l', 10), h('Milch', '1 l', 5), h('Alt', '1 Stück', 40 * 86400000)], now);
    expect(chips[0]).toEqual({ name: 'Hafermilch', qty: '2 l' });
    expect(chips[1]).toEqual({ name: 'Milch', qty: '1 l' });
    expect(chips.filter(c => c.name === 'Milch')).toHaveLength(1);
    expect(chips.some(c => c.name === 'Alt')).toBe(false);
  });
});

describe('seed aisles from the tester form', () => {
  it('each column is a permutation of 1..n', () => {
    for (let c = 0; c < 5; c++) {
      const nums = FORM_AISLES.map(r => r[1][c]).filter((x): x is number => x != null).sort((a, b) => a - b);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
    }
  });
  it('Netto order starts with Obst & Gemüse, Gewürze, Backwaren', () => {
    expect(seedCategoryOrder(0).slice(0, 3)).toEqual(['Obst & Gemüse', 'Gewürze & Saucen', 'Backwaren']);
    expect(seedCategoryOrder(4)).toEqual(['Haushalt', 'Getränke', 'Süßwaren & Snacks', 'Backwaren']);
    expect(FORM_AISLES.map(r => r[0])).toEqual(ALL_DEPTS);
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
