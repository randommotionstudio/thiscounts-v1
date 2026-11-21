// Course generator: the terrain (pimples), hazards and pickups ahead of Dex.
//
// The course is built from "fields": runs of 3–6 pimples close enough that
// every launch arc passes over several of them, separated by gaps that may
// hold a hazard. In the air the player picks which pimple to slam onto:
// red ones are bad landings, yellow ones launch big, some carry tweezers or
// cream. That choice is the game.
//
// Everything is generated in strict x order from one seeded RNG, so a seed
// always produces the same course no matter how the player plays. Decisions
// use only the RNG and basic arithmetic (no Math.sin etc.), which keeps the
// Daily Pop identical across browsers. Math.sin is only used for the
// cosmetic ground undulation, never to decide what goes where.

import { mulberry32 } from './rng.js';

export const BIOMES = [
  {
    key: 'forehead', name: 'Forehead', tagline: 'Whiteheads · tweezers · the fringe',
    slope: 5, bgTop: '#fff0e2', bgBottom: '#f7c9a9', tint: '#ffd9b8', tintAmt: 0,
  },
  {
    key: 'nose', name: 'Nose', tagline: 'Blackheads launch you low and fast',
    slope: 30, bgTop: '#ffe4dd', bgBottom: '#f0a69b', tint: '#f08a80', tintAmt: 0.2,
  },
  {
    key: 'chin', name: 'Chin', tagline: 'Stubble spikes · mosquitoes to bounce on',
    slope: 10, bgTop: '#f8e7d6', bgBottom: '#deae8e', tint: '#c98d6a', tintAmt: 0.1,
  },
  {
    key: 'back', name: 'Back', tagline: 'Cysts: land, hold, release at full charge',
    slope: 16, bgTop: '#efe8e3', bgBottom: '#d2b4a5', tint: '#e8c8b8', tintAmt: 0.1,
  },
  {
    key: 'armpit', name: 'Armpit', tagline: 'Sweaty and slippery: misses cost double',
    slope: 12, bgTop: '#eeecd2', bgBottom: '#c6bb8d', tint: '#d6c28e', tintAmt: 0.16,
  },
];

export const BIOME_LEN = 7200;
export const LOOP_LEN = BIOME_LEN * BIOMES.length;
/** The first stretch is a gentle tutorial: ripe whiteheads only, no hazards. */
export const TUTORIAL_END = 2400;
export const MUTATIONS = ['shell', 'wings', 'sticky', 'spores'];

export const PIMPLE_DIMS = {
  white: { w: [64, 80], h: [26, 32] },
  black: { w: [80, 92], h: [10, 12] },
  mini: { w: [42, 48], h: [16, 18] },
  cyst: { w: [126, 136], h: [42, 46] },
  volcano: { w: [200, 220], h: [80, 88] },
};

// What sits in the gap before each field, per biome.
const GAP_POOLS = [
  /* forehead */ [['none', 62], ['fringe', 28], ['mosquito', 10]],
  /* nose     */ [['none', 62], ['fringe', 18], ['mosquito', 20]],
  /* chin     */ [['none', 30], ['spikes', 38], ['mosquito', 32]],
  /* back     */ [['none', 50], ['spikes', 20], ['mosquito', 30]],
  /* armpit   */ [['none', 22], ['forest', 30], ['spikes', 28], ['mosquito', 20]],
];

// Pimple types inside a field, per biome. 'cluster' inserts three minis.
const TYPE_POOLS = [
  /* forehead */ [['white', 100]],
  /* nose     */ [['white', 52], ['black', 48]],
  /* chin     */ [['white', 50], ['black', 18], ['cluster', 32]],
  /* back     */ [['white', 72], ['cluster', 10], ['cyst', 18]],
  /* armpit   */ [['white', 52], ['black', 14], ['cluster', 18], ['cyst', 16]],
];

// Per-field hazard chances: [tweezers over one pimple, cream racing you to one, volcano field]
const FIELD_HAZARDS = [
  [0.18, 0, 0],
  [0.22, 0, 0],
  [0.2, 0, 0],
  [0.15, 0.35, 0.08],
  [0.25, 0.1, 0],
];

export function biomeAt(x) {
  const xx = Math.max(0, x);
  const tier = Math.floor(xx / LOOP_LEN);
  const lx = xx - tier * LOOP_LEN;
  const index = Math.min(BIOMES.length - 1, Math.floor(lx / BIOME_LEN));
  return { index, tier, into: lx - index * BIOME_LEN, overall: tier * BIOMES.length + index };
}

const smooth = (t) => t * t * (3 - 2 * t);

export class Course {
  constructor(seed, { mutationKinds = MUTATIONS } = {}) {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.ph1 = this.rng() * 6.2832;
    this.ph2 = this.rng() * 6.2832;
    this.pimples = [];
    this.hazards = [];
    this.pickups = [];
    this.genX = 380;
    this.nextId = 1;
    this.nextGroup = 1;
    this.fields = 0;
    this.mutationKinds = mutationKinds;
  }

  /** Height of the skin surface at x. Cosmetic undulation; flat at the start. */
  groundY(x) {
    if (x <= 0) return 0;
    const b = biomeAt(x);
    let amp = BIOMES[b.index].slope;
    const blend = Math.max(0, (b.into - (BIOME_LEN - 800)) / 800);
    if (blend > 0) amp += (BIOMES[(b.index + 1) % BIOMES.length].slope - amp) * smooth(blend);
    const ramp = Math.min(1, x / 900);
    return ramp * amp * (0.6 * Math.sin(x * 0.0042 + this.ph1) + 0.4 * Math.sin(x * 0.0011 + this.ph2));
  }

  /** Generate until the course reaches x. */
  ensure(x) {
    while (this.genX < x) this.emitField();
  }

  /** Drop everything that is well behind. */
  prune(minX) {
    this.pimples = this.pimples.filter((p) => p.x + p.w > minX);
    this.hazards = this.hazards.filter((z) => z.x + (z.w || 0) + 250 > minX);
    this.pickups = this.pickups.filter((k) => k.x + 100 > minX);
  }

  pick(weights) {
    let total = 0;
    for (const [, w] of weights) total += w;
    let r = this.rng() * total;
    for (const [k, w] of weights) {
      r -= w;
      if (r < 0) return k;
    }
    return weights[weights.length - 1][0];
  }

  /** Adds a pimple whose left edge is at `left`. Ripeness is fixed: 'red' | 'ripe' | 'over'. */
  addPimple(type, left, ripe = 'ripe', group = 0) {
    const r = this.rng;
    const d = PIMPLE_DIMS[type];
    const w = d.w[0] + r() * (d.w[1] - d.w[0]);
    const h = d.h[0] + r() * (d.h[1] - d.h[0]);
    const sporeOver = r() < 0.3;
    const x = left + w / 2;
    const p = { id: this.nextId++, type, x, w, h, base: this.groundY(x), ripe, state: 'idle', group, sporeOver };
    this.pimples.push(p);
    this.genX = x + w / 2;
    return p;
  }

  emitField() {
    const r = this.rng;
    const x0 = this.genX;
    const tut = x0 < TUTORIAL_END;
    const { index: b } = biomeAt(x0);
    const D = Math.min(2.5, x0 / LOOP_LEN);
    this.fields++;

    // ── the gap before the field ──
    let gap = tut ? 110 + r() * 50 : 150 + r() * 90 + D * 40;
    const gapKind = tut ? 'none' : this.pick(GAP_POOLS[b]);
    // The pimple right before a gap hazard is always a usable launch pad;
    // before hair it is always yellow (overripe): the big launch you need.
    const pad = this.pimples[this.pimples.length - 1];
    if (pad && gapKind !== 'none' && pad.state === 'idle') {
      if (gapKind === 'fringe' || gapKind === 'forest') {
        pad.type = 'white';
        pad.group = 0;
        pad.ripe = 'over';
      } else if (pad.ripe === 'red') {
        pad.ripe = 'ripe';
      }
    }
    switch (gapKind) {
      case 'spikes': {
        // Ingrown hairs fill the gap: don't come down here.
        gap = Math.min(gap, 210 + D * 20);
        const s = x0 + 18;
        const w = gap - 36;
        const spikes = [];
        for (let dx = 4; dx < w - 2; dx += 9 + r() * 7) spikes.push({ dx, h: 12 + r() * 12, lean: 0.3 + r() * 0.6 });
        this.hazards.push({ type: 'spikes', x: s, w, spikes });
        break;
      }
      case 'fringe':
      case 'forest': {
        // Hair to clear: launch high (back edge or a yellow pimple) from the field before.
        const big = gapKind === 'forest';
        const w = big ? 60 + r() * 50 : 30 + r() * 35;
        gap = Math.max(gap, w + 220);
        const start = x0 + Math.max(110, (gap - w) * 0.5);
        const hMin = big ? 100 : 35;
        const hMax = big ? 160 : 70;
        const stalks = [];
        for (let dx = 0; dx <= w; dx += 11 + r() * 8) {
          stalks.push({ dx, h: hMin + r() * (hMax - hMin), lean: (r() - 0.5) * 0.5, base: this.groundY(start + dx) });
        }
        this.hazards.push({ type: 'hair', x: start, w, stalks });
        break;
      }
      case 'mosquito': {
        // A wider gap with a mosquito hovering low over it, below your arc:
        // come down on it (slam) to bounce across.
        gap += 90;
        const mx = x0 + gap * 0.55;
        this.hazards.push({
          type: 'mosquito', x: mx, baseH: 55 + r() * 35, amp: 10 + r() * 8,
          freq: 0.5 + r() * 0.3, phase: r() * 6.2832, drift: 12 + r() * 14, t: -1, alive: true,
        });
        break;
      }
    }

    // ── special one-off fields ──
    const [twChance, creamChance, volcanoChance] = FIELD_HAZARDS[b];
    if (!tut && r() < volcanoChance) {
      this.addPimple('volcano', x0 + gap);
      this.genX += 600; // airborne bonus section
      this.maybeMutation(x0);
      return;
    }

    // ── the field ──
    const n = tut ? 3 + Math.floor(r() * 2) : 3 + Math.floor(r() * 4);
    const redP = tut ? 0 : Math.min(0.34, 0.1 + 0.1 * D + b * 0.02);
    const overP = tut ? 0 : 0.13;
    const field = [];
    let left = x0 + gap;
    for (let i = 0; i < n; i++) {
      const type = tut ? 'white' : this.pick(TYPE_POOLS[b]);
      const roll = r();
      if (type === 'cluster') {
        // Three minis in a tight row: chain small hops for a bonus.
        const group = this.nextGroup++;
        for (let k = 0; k < 3; k++) {
          const m = this.addPimple('mini', left, roll < redP && k === 1 ? 'red' : 'ripe', group);
          field.push(m);
          left = m.x + m.w / 2 + 34 + r() * 14;
        }
      } else {
        let ripe = 'ripe';
        if (type === 'white') ripe = roll < redP ? 'red' : roll > 1 - overP ? 'over' : 'ripe';
        const p = this.addPimple(type, left, ripe);
        field.push(p);
        left = p.x + p.w / 2 + 40 + r() * 55 - Math.min(D, 2) * 6;
      }
    }

    // ── hazards that make you choose a different pimple ──
    if (!tut && field.length >= 3 && r() < twChance) {
      const p = field[1 + Math.floor(r() * (field.length - 1))];
      this.hazards.push({ type: 'tweezers', x: p.x, p, base: this.groundY(p.x), period: 1.5 + r() * 0.5, phase: r(), t: 0 });
    }
    if (!tut && r() < creamChance) {
      const p = field[field.length - 1];
      if (p.ripe !== 'red') this.hazards.push({ type: 'cream', x: p.x, p, trigger: 520 + r() * 60, t: -1, fall: 1.1, done: false });
    }
    this.maybeMutation(x0);
  }

  maybeMutation(x0) {
    // Rare glowing bacteria floating at launch height.
    const r = this.rng;
    if (x0 > TUTORIAL_END + 400 && r() < 0.07) {
      const kr = r(), hr = r(), xr = r();
      const kinds = this.mutationKinds;
      if (kinds.length) {
        const x = this.genX - 60 - xr * 120;
        this.pickups.push({ type: 'mut', kind: kinds[Math.floor(kr * kinds.length)], x, y: this.groundY(x) + 140 + hr * 70, got: false });
      }
    }
  }
}
