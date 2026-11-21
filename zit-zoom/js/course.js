// Course generator: the terrain (pimples), hazards and pickups ahead of Dex.
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
    key: 'chin', name: 'Chin', tagline: 'Clusters, stubble and mosquitoes',
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
/** Pimples start ripening once they are this close to Dex (world units). */
export const CLOCK_DIST = 900;
/** The first stretch is a gentle tutorial: ripe whiteheads only. */
export const TUTORIAL_END = 2200;
export const MUTATIONS = ['shell', 'wings', 'sticky', 'spores'];

export const PIMPLE_DIMS = {
  white: { w: [62, 80], h: [26, 32] },
  black: { w: [84, 96], h: [10, 12] },
  mini: { w: [40, 46], h: [16, 18] },
  cyst: { w: [126, 136], h: [42, 46] },
  volcano: { w: [200, 220], h: [80, 88] },
};

// Pattern weights per biome. Each biome introduces its own pimple type and hazards.
const POOLS = [
  /* forehead */ [['white', 74], ['tweezers', 12], ['fringe', 10]],
  /* nose     */ [['white', 38], ['black', 32], ['blackpair', 12], ['tweezers', 14]],
  /* chin     */ [['white', 26], ['black', 12], ['cluster', 24], ['spikes', 16], ['mosquito', 14], ['tweezers', 8]],
  /* back     */ [['white', 24], ['cyst', 24], ['cluster', 8], ['cream', 16], ['mosquito', 10], ['volcano', 5], ['tweezers', 8]],
  /* armpit   */ [['white', 22], ['black', 8], ['cluster', 8], ['cyst', 8], ['forest', 18], ['spikes', 14], ['mosquito', 10], ['tweezers', 8]],
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
    this.genX = 420;
    this.nextId = 1;
    this.nextGroup = 1;
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
    while (this.genX < x) this.emitPattern();
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

  addPimple(type, x, opts = {}) {
    const r = this.rng;
    const d = PIMPLE_DIMS[type];
    const w = d.w[0] + r() * (d.w[1] - d.w[0]);
    const h = d.h[0] + r() * (d.h[1] - d.h[0]);
    const roll = r(), a = r(), b = r();
    const sporeOver = r() < 0.3;
    let ripeAt = 0;
    let overAt = Infinity;
    if (type === 'white' || type === 'mini') {
      const D = x / LOOP_LEN;
      const deep = biomeAt(x).index >= 2 ? 0.06 : 0;
      const unripe = !opts.ripe && roll < Math.min(0.5, 0.1 + 0.2 * D + deep);
      if (unripe) {
        ripeAt = 1.3 + a * 1.4;
        overAt = ripeAt + 1.6 + b * 1.2;
      } else {
        overAt = 2.4 + a * 1.8;
      }
      if (opts.ripe && x < TUTORIAL_END) overAt = Infinity; // keep the tutorial clean
      if (type === 'mini') overAt = Infinity;
    }
    const p = {
      id: this.nextId++, type, x, w, h, base: this.groundY(x),
      ripeAt, overAt, clock: -1, state: 'idle', group: opts.group || 0, sporeOver,
    };
    this.pimples.push(p);
    this.genX = x + w / 2;
    return p;
  }

  emitPattern() {
    const r = this.rng;
    const x0 = this.genX;
    if (x0 < TUTORIAL_END) {
      this.addPimple('white', x0 + 175 + r() * 50, { ripe: true });
      return;
    }
    const { index } = biomeAt(x0);
    const D = Math.min(2.5, x0 / LOOP_LEN);
    const g = 130 + r() * 110 + D * 40;
    const kind = this.pick(POOLS[index]);

    switch (kind) {
      case 'white':
        this.addPimple('white', x0 + g + 36);
        break;
      case 'black':
        this.addPimple('black', x0 + g + 45);
        break;
      case 'blackpair': {
        const a = this.addPimple('black', x0 + g + 45);
        this.addPimple('black', a.x + 210 + r() * 50);
        break;
      }
      case 'cluster': {
        // Spacing roughly one throb apart at cruising speed: a rhythm section.
        const group = this.nextGroup++;
        const s = 160 + r() * 22;
        const a = this.addPimple('mini', x0 + g + 22, { group });
        const b = this.addPimple('mini', a.x + s, { group });
        this.addPimple('mini', b.x + s, { group });
        break;
      }
      case 'cyst': {
        this.addPimple('cyst', x0 + g + 86);
        this.genX += 120;
        break;
      }
      case 'volcano': {
        const v = this.addPimple('volcano', x0 + g + 165);
        this.genX = v.x + 640; // airborne bonus section
        break;
      }
      case 'tweezers': {
        const p = this.addPimple('white', x0 + g + 36);
        const tx = r() < 0.5 ? p.x : x0 + g * 0.5;
        // They aim at Dex: the pinch is timed for when Dex would arrive at his current speed.
        this.hazards.push({ type: 'tweezers', x: tx, base: this.groundY(tx), lead: 0.76 + r() * 0.08, t: -1, tip: 360 });
        break;
      }
      case 'fringe':
      case 'forest': {
        const p = this.addPimple('white', x0 + g + 36, { ripe: true });
        const big = kind === 'forest';
        // Close enough to the pimple that its launch arc is still rising over the hair.
        const start = p.x + (big ? 130 + r() * 40 : 105 + r() * 35);
        const w = big ? 70 + r() * 60 : 30 + r() * 40;
        const hMin = big ? 100 : 35;
        const hMax = big ? 165 : 70;
        const stalks = [];
        for (let dx = 0; dx <= w; dx += 11 + r() * 8) {
          stalks.push({ dx, h: hMin + r() * (hMax - hMin), lean: (r() - 0.5) * 0.5, base: this.groundY(start + dx) });
        }
        this.hazards.push({ type: 'hair', x: start, w, stalks });
        this.genX = start + w + 30;
        break;
      }
      case 'spikes': {
        const p = this.addPimple('white', x0 + g + 36, { ripe: true });
        const s = p.x + p.w / 2 + 25 + r() * 20;
        const w = 60 + r() * 90 + Math.min(D, 2) * 20;
        const spikes = [];
        for (let dx = 4; dx < w - 2; dx += 9 + r() * 7) spikes.push({ dx, h: 12 + r() * 12, lean: 0.3 + r() * 0.6 });
        this.hazards.push({ type: 'spikes', x: s, w, spikes });
        this.genX = s + w + 20;
        break;
      }
      case 'mosquito': {
        const p = this.addPimple('white', x0 + g + 36);
        this.hazards.push({
          type: 'mosquito', x: p.x + 170 + r() * 90, baseH: 95 + r() * 80, amp: 30 + r() * 30,
          freq: 0.5 + r() * 0.4, phase: r() * 6.2832, drift: 30 + r() * 40, t: -1, alive: true,
        });
        break;
      }
      case 'cream': {
        const p = this.addPimple('white', x0 + g + 36, { ripe: true });
        this.hazards.push({ type: 'cream', x: p.x, p, trigger: 470 + r() * 60, t: -1, fall: 1.05, done: false });
        break;
      }
    }

    // Mutation pickups: rare glowing bacteria floating at launch height.
    if (x0 > 2600 && r() < 0.05) {
      const kr = r(), hr = r(), xr = r();
      const kinds = this.mutationKinds;
      if (kinds.length) {
        const x = this.genX + 50 + xr * 60;
        this.pickups.push({ type: 'mut', kind: kinds[Math.floor(kr * kinds.length)], x, y: this.groundY(x) + 150 + hr * 90, got: false });
      }
    }
  }
}
