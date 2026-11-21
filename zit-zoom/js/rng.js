// Deterministic helpers. Only integer maths and IEEE-754 basic arithmetic,
// so every browser and device produces the same sequence. The Daily Pop
// depends on this: one seed from the UTC date, one course for everyone.

/** Mulberry32: tiny, fast, good enough for level generation. Returns [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → uint32. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer hash for decoration (pores, bokeh) that must not flicker. */
export function hash32(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** "2026-11-21" for the given moment, in UTC. */
export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function dailySeed(dateKey) {
  return hashString('zit-zoom/daily-pop/' + dateKey);
}
