// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Course, LOOP_LEN, TUTORIAL_END, PIMPLE_DIMS } from '../js/course.js';
import { dailySeed, mulberry32 } from '../js/rng.js';

function layout(seed, until = LOOP_LEN * 2) {
  const c = new Course(seed);
  c.ensure(until);
  return {
    pimples: c.pimples.map((p) => [p.type, p.x.toFixed(6), p.w.toFixed(6), p.ripeAt.toFixed(6)]),
    hazards: c.hazards.map((z) => [z.type, z.x.toFixed(6)]),
    pickups: c.pickups.map((k) => [k.kind, k.x.toFixed(6)]),
  };
}

test('mulberry32 is stable (golden values)', () => {
  const r = mulberry32(12345);
  // If these change, every Daily Pop course changes with them.
  assert.deepEqual([r(), r(), r()].map((v) => Math.round(v * 1e9)), [979728268, 306752264, 484205422]);
  assert.equal(dailySeed('2026-11-21'), 1862585478);
});

test('the same seed always builds the same course', () => {
  const seed = dailySeed('2026-11-21');
  assert.deepEqual(layout(seed), layout(seed));
});

test('different days build different courses', () => {
  assert.notDeepEqual(layout(dailySeed('2026-11-21')).pimples.slice(0, 40), layout(dailySeed('2026-11-22')).pimples.slice(0, 40));
});

test('generating in small steps equals generating at once', () => {
  const seed = 987654321;
  const a = new Course(seed);
  a.ensure(LOOP_LEN);
  const b = new Course(seed);
  for (let x = 0; x < LOOP_LEN; x += 37) b.ensure(x);
  b.ensure(LOOP_LEN);
  assert.equal(a.pimples.length, b.pimples.length);
  a.pimples.forEach((p, i) => assert.equal(p.x, b.pimples[i].x));
});

test('the tutorial stretch is only ripe whiteheads', () => {
  const c = new Course(42);
  c.ensure(TUTORIAL_END);
  const early = c.pimples.filter((p) => p.x < TUTORIAL_END);
  assert.ok(early.length >= 6);
  for (const p of early) {
    assert.equal(p.type, 'white');
    assert.equal(p.ripeAt, 0);
  }
  assert.equal(c.hazards.filter((z) => z.x < TUTORIAL_END).length, 0);
});

test('pimples never overlap and gaps stay jumpable', () => {
  for (const seed of [1, 2, 3, 99, dailySeed('2026-12-24')]) {
    const c = new Course(seed);
    c.ensure(LOOP_LEN * 2);
    const ps = [...c.pimples].sort((a, b) => a.x - b.x);
    for (let i = 1; i < ps.length; i++) {
      const gap = ps[i].x - ps[i].w / 2 - (ps[i - 1].x + ps[i - 1].w / 2);
      assert.ok(gap > 20, `seed ${seed}: pimples overlap at x=${ps[i].x.toFixed(0)}`);
      assert.ok(gap < 1000, `seed ${seed}: gap too big at x=${ps[i].x.toFixed(0)}`);
    }
    for (const p of ps) {
      const d = PIMPLE_DIMS[p.type];
      assert.ok(p.w >= d.w[0] && p.w <= d.w[1]);
    }
  }
});

test('every biome introduces its own pimple type', () => {
  const c = new Course(7);
  c.ensure(LOOP_LEN);
  const seen = (from, to) => new Set(c.pimples.filter((p) => p.x >= from && p.x < to).map((p) => p.type));
  const L = LOOP_LEN / 5;
  assert.deepEqual([...seen(0, L)], ['white']);
  assert.ok(seen(L, 2 * L).has('black'));
  assert.ok(seen(2 * L, 3 * L).has('mini'));
  assert.ok(seen(3 * L, 4 * L).has('cyst'));
});
