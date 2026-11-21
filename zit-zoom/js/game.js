// The simulation: Dex, pops, the foam wall, hazards, mutations, scoring.
// World units: x grows to the right, y grows upwards, the skin is y ≈ 0.
// All numbers are starting values to tune in playtests.
//
// Core skill: in the air, pick a pimple and slam down onto its head.
// The slam drops Dex straight down, so where you tap is where you land
// (the game shows the landing spot). Head = Perfect, dome = Great,
// rim = OK. Difficulty comes from speed: the head passes faster.

import { Course, biomeAt, BIOMES, MUTATIONS } from './course.js';

export const GRAVITY = 2000;
export const JUMP_VY = 720;
export const POP_VY = 820;
export const MIN_SPEED = 280;
export const START_SPEED = 340;
export const MAX_SPEED = 640;
const DECAY_AIR = 6;
const DECAY_GROUND = 30;

/** The slam: a fixed, short drop with no forward drift. */
export const SLAM_TIME = 0.07;
/** Landing zones, as a fraction of the pimple's half-width (Perfect never narrower than PERFECT_MIN). */
export const PERFECT_FRAC = 0.32;
export const PERFECT_MIN = 12;
export const GREAT_FRAC = 0.84;

export const DEX_R = 15;
const FOAM_START_GAP = 340;
export const FOAM_MAX_GAP = 800;
const FOAM_BASE = 255;
const FOAM_RAMP = 2.6;
const FOAM_CAP = 600;
export const CYST_CHARGE = 0.9;
const CYST_OVERHOLD = 0.7;
export const MUTATION_TIME = 10;
export const UNITS_PER_MM = 40;
const MISS_LOSS = 60;

/** Tweezers snap over one pimple on a loop: [shadow from, pinch from, closed from, lift from] as fractions of the cycle. */
export const TWEEZER_PHASES = [0.25, 0.5, 0.58, 0.8];
export const TWEEZER_LEN = 70;
const TWEEZER_HOVER = 360;

export const GRADE_INFO = {
  perfect: { label: 'PERFECT', points: 100, goo: 3, color: '#fff36b' },
  great: { label: 'GREAT', points: 50, goo: 2, color: '#8ff0ff' },
  ok: { label: 'OK', points: 20, goo: 1, color: '#ffffff' },
};

export const MUTATION_INFO = {
  shell: { name: 'Hard Shell', desc: 'Absorbs one hit · a Miss cracks it', color: '#f0b54a', unlock: 0 },
  wings: { name: 'Wings', desc: 'Tap while rising to flap once', color: '#9fd8ff', unlock: 1 },
  sticky: { name: 'Sticky Legs', desc: 'Hold to stick and charge · let go to launch', color: '#9be36b', unlock: 2 },
  spores: { name: 'Spore Cloud', desc: 'Pops ripen the next pimples', color: '#c58cff', unlock: 3 },
};

export const DEATH_INFO = {
  foam: { title: 'FOAMED!', sub: 'Chain Perfects to build speed and push the foam back.' },
  tweezers: { title: 'PLUCKED!', sub: 'Tweezers snap on a loop: pick another pimple or wait for the lift.' },
  hair: { title: 'TANGLED!', sub: 'Before hair, slam a yellow pimple or the back edge for height.' },
  spikes: { title: 'SPIKED!', sub: 'Never come down between pimples over ingrown hairs.' },
  mosquito: { title: 'BITTEN!', sub: 'Come down on mosquitoes from above: they bounce you across gaps.' },
};

export function multiplierFor(streak) {
  return streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
}

/** 'red' | 'ripe' | 'over' | 'popped' | 'shrunk' */
export function ripeness(p) {
  return p.state !== 'idle' ? p.state : p.ripe;
}

export function pimpleHeight(p, st) {
  if (st === 'red') return p.h * 0.6;
  if (st === 'over') return p.h * 1.18;
  if (st === 'shrunk') return p.h * 0.22;
  return p.h;
}

/** Half-width of the Perfect zone (the head). */
export function headHalf(p) {
  return Math.max(PERFECT_MIN, (p.w / 2) * PERFECT_FRAC);
}

/** Grade for landing on pimple p at x: 'perfect' | 'great' | 'ok'. */
export function gradeAt(p, x) {
  const dx = Math.abs(x - p.x);
  if (dx <= headHalf(p)) return 'perfect';
  if (dx <= (p.w / 2) * GREAT_FRAC) return 'great';
  return 'ok';
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const noop = () => {};
const SILENT = new Proxy({}, { get: () => noop });
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

export class Game {
  constructor(o = {}) {
    this.mode = o.mode || 'endless';
    this.seed = o.seed >>> 0;
    this.audio = o.audio || SILENT;
    this.feel = o.feel || SILENT;
    this.flags = o.flags || {};
    this.skin = o.skin || 'classic';
    this.autoplay = !!o.autoplay;
    /** Attract-mode bot aim error, in seconds of travel (≈ human tap jitter). */
    this.botError = o.botError ?? 0.012;
    this.onEnd = o.onEnd || noop;
    this.ghost = o.ghost || null;
    this.course = new Course(this.seed, { mutationKinds: o.mutationKinds || MUTATIONS });

    this.t = 0;
    this.dex = {
      x: 0, y: this.course.groundY(0), vx: START_SPEED, vy: 0,
      grounded: true, slamming: false, launched: false, flapUsed: false,
      stuck: null, squash: 0, legPhase: 0,
    };
    this.foamX = -FOAM_START_GAP;
    this.foamSpeed = FOAM_BASE;

    this.streak = 0;
    this.maxStreak = 0;
    this.popPoints = 0;
    this.perfects = 0;
    this.pops = 0;
    this.gooEarned = 0;
    this.groupPops = new Map();

    this.mut = null;
    this.invuln = 0;
    this.erupt = null;

    this.slowT = 0;
    this.flash = 0;
    this.hurt = 0;
    this.shake = 0;
    this.particles = [];
    this.decals = [];
    this.texts = [];
    this.bigTexts = [];
    this.splats = [];
    this.gooBlobs = [];
    this.banner = null;
    this.hint = null;
    this.edgeHintT = 0;

    this.pressed = false;
    this.paused = false;
    this.dead = false;
    this.ended = false;
    this.deathT = 0;
    this.cause = null;
    this.biomeOverall = -1;
    this.maxOverall = 0;
    this.rec = [];
    this.recT = 0;
    this.pruneT = 0;
    this.bot = { plan: null, release: false };
  }

  get distance() { return Math.max(0, this.dex.x) / UNITS_PER_MM; }
  get score() { return Math.floor(this.distance) + this.popPoints; }
  get multiplier() { return multiplierFor(this.streak); }
  get foamGap() { return this.dex.x - this.foamX; }

  // ───────────────────────────── input ─────────────────────────────

  press() {
    this.pressed = true;
    if (this.dead || this.paused) return;
    const d = this.dex;
    if (d.stuck) {
      d.stuck.charging = true;
      return;
    }
    if (d.grounded) return this.jump();
    if (this.mut && this.mut.kind === 'wings' && !d.flapUsed && d.vy > 0 && !d.slamming) {
      d.flapUsed = true;
      d.vy = 680;
      this.audio.flap();
      this.feel.pulse('light');
      this.puff(d.x, d.y + 10, 8, 'rgba(220,240,255,0.9)');
      return;
    }
    if (!d.slamming) this.slam();
  }

  release() {
    this.pressed = false;
    const s = this.dex.stuck;
    if (s && s.charging) this.releaseStuck();
  }

  jump() {
    const d = this.dex;
    d.grounded = false;
    d.vy = JUMP_VY;
    d.launched = false;
    d.flapUsed = false;
    d.y += 0.5;
    this.flags.jumped = true;
    this.audio.jump();
    this.feel.pulse('light');
  }

  slam() {
    const d = this.dex;
    const s = this.surfaceAt(d.x);
    d.slamming = true;
    d.vy = -Math.max(900, (d.y - s.y) / SLAM_TIME);
    this.audio.pound();
  }

  /** Where Dex would land if he slammed right now, and how it would go. */
  landingPreview() {
    const d = this.dex;
    if (d.grounded || d.stuck || this.dead) return null;
    const s = this.surfaceAt(d.x);
    let kind = 'skin';
    const p = s.pimple;
    if (p) {
      const st = ripeness(p);
      if (st === 'ripe' || st === 'over') kind = p.type === 'cyst' ? 'cyst' : gradeAt(p, d.x);
      else if (st === 'red') kind = 'red';
    }
    if (kind === 'skin' || kind === 'red') {
      for (const z of this.course.hazards) {
        if (z.type === 'spikes' && d.x > z.x - 3 && d.x < z.x + z.w + 3) kind = 'danger';
        if (z.type === 'hair' && d.x > z.x - 12 && d.x < z.x + z.w + 12) kind = 'danger';
      }
    }
    for (const z of this.course.hazards) {
      if (z.type === 'tweezers' && z.danger && Math.abs(d.x - z.x) < 26) kind = 'danger';
      if (z.type === 'mosquito' && z.alive && z.mx !== undefined && Math.abs(d.x - z.mx) < DEX_R + 12 && z.my < d.y + DEX_R) {
        return { x: d.x, y: z.my + 6, kind: 'stomp', pimple: null };
      }
    }
    return { x: d.x, y: s.y, kind, pimple: p };
  }

  // ───────────────────────────── loop ─────────────────────────────

  update(realDt) {
    if (this.paused) return;
    realDt = Math.min(realDt, 0.05);
    let scale = 1;
    if (this.slowT > 0) {
      this.slowT -= realDt;
      scale = 0.3;
    }
    const dt = realDt * scale;
    this.flash = Math.max(0, this.flash - realDt * 5);
    this.hurt = Math.max(0, this.hurt - realDt * 2);
    this.shake = Math.max(0, this.shake - realDt * 40);

    if (!this.dead) {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      for (let i = 0; i < n && !this.dead; i++) this.step(h);
      this.updateHint(realDt);
    } else {
      this.deathT += realDt;
      if (this.deathT > 1.2 && !this.ended) {
        this.ended = true;
        this.onEnd(this.result());
      }
    }
    this.updateFx(dt, realDt);
    this.pruneT -= realDt;
    if (this.pruneT <= 0) {
      this.pruneT = 0.5;
      this.course.prune(this.dex.x - 1500);
    }
  }

  step(h) {
    this.t += h;
    const d = this.dex;
    this.course.ensure(d.x + 2600);

    if (this.invuln > 0) this.invuln -= h;
    if (this.mut) {
      this.mut.t -= h;
      if (this.mut.t <= 0) this.endMutation();
    }
    if (this.autoplay) this.botThink();

    if (d.stuck) this.updateStuck(h);
    else this.moveDex(h);
    if (this.dead) return;
    this.updateFoam(h);
    if (this.dead) return;
    this.updateHazards(h);
    if (this.dead) return;
    this.updatePickups();
    this.updateEruption(h);

    const b = biomeAt(d.x);
    if (b.overall !== this.biomeOverall) {
      this.biomeOverall = b.overall;
      this.maxOverall = Math.max(this.maxOverall, b.overall);
      const bi = BIOMES[b.index];
      this.banner = {
        title: bi.name.toUpperCase(),
        sub: b.tier > 0 && b.index === 0 ? `Loop ${b.tier + 1} · the foam gets faster` : bi.tagline,
        t: 0,
      };
    }

    this.recT += h;
    while (this.recT >= 1 / 30) {
      this.recT -= 1 / 30;
      this.rec.push(Math.round(d.x), Math.round(d.y));
    }
  }

  moveDex(h) {
    const d = this.dex;
    const slippery = biomeAt(d.x).index === 4;
    const decay = d.grounded ? DECAY_GROUND * (slippery ? 1.5 : 1) : DECAY_AIR;
    d.vx = Math.max(MIN_SPEED, d.vx - decay * h);
    if (!d.slamming) d.x += d.vx * h; // the slam goes straight down
    d.legPhase += h * (d.grounded ? d.vx * 0.09 : 8);
    if (d.grounded) {
      d.y = this.surfaceAt(d.x).y;
      return;
    }
    if (!d.slamming) d.vy -= GRAVITY * h;
    d.y += d.vy * h;
    const s = this.surfaceAt(d.x);
    if (d.y <= s.y) {
      d.y = s.y;
      if (d.vy <= 0) this.land(s);
    }
  }

  /** Highest surface under x: skin, or the dome of an unpopped pimple. */
  surfaceAt(x) {
    let y = this.course.groundY(x);
    let pimple = null;
    for (const p of this.course.pimples) {
      const hw = p.w / 2;
      const dx = x - p.x;
      if (dx < -hw - 3 || dx > hw + 3) continue;
      const st = ripeness(p);
      if (st === 'popped') continue;
      const k = Math.min(0.95, Math.abs(dx) / hw);
      const top = p.base + pimpleHeight(p, st) * Math.sqrt(1 - k * k);
      if (top > y) {
        y = top;
        pimple = p;
      }
    }
    return { y, pimple };
  }

  land(s) {
    const d = this.dex;
    const slammed = d.slamming;
    d.slamming = false;
    d.grounded = true;
    d.vy = 0;
    d.squash = 1;
    const p = s.pimple;
    const st = p ? ripeness(p) : 'skin';
    if (p && (st === 'ripe' || st === 'over')) {
      const u = clamp((d.x - p.x) / (p.w / 2), -1, 1);
      if (p.type === 'cyst') return this.stick(p, 'cyst', u);
      if (this.mut && this.mut.kind === 'sticky' && this.pressed && p.type !== 'volcano') return this.stick(p, 'sticky', u);
      let grade = gradeAt(p, d.x);
      // Only a slam can be Perfect: drifting down onto a pimple is at best Great.
      if (!slammed && grade === 'perfect') grade = 'great';
      return this.pop(p, grade, u, st);
    }
    if (p && st === 'red') return this.bump(p);
    // Bare skin (or a crater, or a creamed pimple).
    if (this.mut && this.mut.kind === 'wings') this.endMutation('lost');
    if (slammed || d.launched) this.miss();
    else this.audio.land();
    d.launched = false;
  }

  pop(p, grade, u, st, charge = 0) {
    const d = this.dex;
    const info = GRADE_INFO[grade];
    const gf = grade === 'perfect' ? 1 : grade === 'great' ? 0.82 : 0.45;
    // Off-centre landings tilt the launch: back edge high, front edge flat and fast.
    const tilt = grade === 'perfect' ? 0 : u;
    let vy;
    let dvx;
    switch (p.type) {
      case 'black':
        vy = 470 * (0.65 + 0.35 * gf);
        dvx = 90 * gf - 25 * (1 - gf);
        break;
      case 'mini':
        vy = 560 * (0.7 + 0.3 * gf);
        dvx = grade === 'perfect' ? 15 : grade === 'great' ? 0 : -15;
        break;
      case 'cyst':
        vy = 700 + 800 * charge;
        dvx = 30 + 150 * charge;
        break;
      case 'volcano':
        vy = 1450;
        dvx = 120;
        break;
      default: {
        vy = POP_VY * gf * (1 - tilt * 0.3);
        dvx = (grade === 'perfect' ? 20 : grade === 'great' ? 6 : -15) + tilt * 40;
      }
    }
    if (charge && p.type !== 'cyst') vy *= 1 + 0.5 * charge; // Sticky Legs charge
    if (st === 'over') {
      vy *= 1.4;
      dvx += 30;
      this.addSplatter();
    }

    const prevMult = multiplierFor(this.streak);
    if (grade === 'perfect') {
      this.streak++;
      this.perfects++;
    } else if (grade === 'ok') {
      this.streak = 0;
    }
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    const mult = multiplierFor(this.streak);
    const typeBonus = p.type === 'cyst' ? 2 : p.type === 'volcano' ? 3 : 1;
    this.popPoints += Math.round(info.points * (st === 'over' ? 1.5 : 1) * typeBonus * mult);
    this.gooEarned += info.goo + (this.streak >= 10 ? 1 : 0) + (st === 'over' ? 1 : 0);
    this.pops++;

    const top = p.base + pimpleHeight(p, st);
    this.spawnGoo(p.x, top, grade === 'perfect' ? 34 : grade === 'great' ? 20 : 10, st === 'over');
    this.addText(info.label, d.x, top + 46, info.color, grade === 'perfect' ? 30 : 24);
    if (grade !== 'perfect' && p.type !== 'cyst' && p.type !== 'mini') {
      const hint = u < 0 ? 'back edge: high' : 'front edge: fast';
      this.addText(hint, d.x, top + 22, 'rgba(255,255,255,0.85)', 14);
    }
    if (grade === 'perfect') {
      this.slowT = 0.08;
      this.flash = 0.7;
      this.shake = 8;
      this.feel.pulse('heavy');
    } else if (grade === 'great') {
      this.shake = 4;
      this.feel.pulse('medium');
    } else {
      this.feel.pulse('light');
    }
    this.audio.pop(grade);
    if (mult > prevMult) {
      this.addBigText(`×${mult} STREAK`, '#fff36b');
      this.audio.streak(mult);
    }

    if (p.type === 'mini') {
      const n = (this.groupPops.get(p.group) || 0) + 1;
      this.groupPops.set(p.group, n);
      if (n === 3) {
        this.popPoints += 300 * mult;
        this.gooEarned += 3;
        this.addText('CLUSTER BONUS', d.x, top + 80, '#ffd1f0', 20);
      }
    }
    if (p.type === 'cyst') this.flags.cyst = true;
    this.flags.popped = true;
    if (grade === 'perfect' && !this.flags.perfect) {
      this.flags.perfect = true;
      this.edgeHintT = 5;
    }
    if (this.mut && this.mut.kind === 'spores') this.sporeRipen(p);
    if (p.type === 'volcano') this.erupt = { p, n: 4, t: 0 };

    p.state = 'popped';
    p.popT = this.t;
    this.bot.plan = null;
    d.vy = vy;
    d.vx = clamp(d.vx + dvx, MIN_SPEED, MAX_SPEED);
    d.grounded = false;
    d.launched = true;
    d.flapUsed = false;
    d.y += 0.5;
  }

  bump(p) {
    const d = this.dex;
    d.vy = 330;
    d.grounded = false;
    d.launched = true;
    d.vx = Math.max(MIN_SPEED, d.vx - 30);
    this.streak = 0;
    this.addText('NOT RIPE', d.x, p.base + p.h + 34, '#ffb0a0', 20);
    this.audio.squish();
    this.feel.pulse('light');
  }

  miss() {
    const d = this.dex;
    const slippery = biomeAt(d.x).index === 4;
    this.streak = 0;
    d.vx = Math.max(MIN_SPEED, d.vx - MISS_LOSS * (slippery ? 2 : 1));
    this.addText(slippery ? 'SLIP!' : 'MISS', d.x, d.y + 52, '#ffc2b8', 22);
    this.audio.thud();
    this.feel.pulse('light');
    this.shake = Math.max(this.shake, 3);
    this.puff(d.x, d.y + 2, 6, 'rgba(255,235,220,0.8)');
    if (this.mut && this.mut.kind === 'shell') this.endMutation('cracked');
  }

  stick(p, kind, u) {
    const d = this.dex;
    d.stuck = { p, kind, u, t: 0, charge: 0, full: 0, charging: this.pressed, grade: gradeAt(p, d.x) };
    d.grounded = true;
    d.vy = 0;
    this.audio.squish();
    this.feel.pulse('medium');
  }

  updateStuck(h) {
    const d = this.dex;
    const s = d.stuck;
    s.t += h;
    d.y = this.surfaceAt(d.x).y;
    d.legPhase += h * 30;
    if (this.pressed && s.charging) {
      const before = s.charge;
      s.charge = Math.min(1, s.charge + h / CYST_CHARGE);
      if (before < 1 && s.charge >= 1) {
        this.feel.pulse('medium');
        this.audio.ready();
      }
      if (s.charge >= 1) {
        s.full += h;
        if (s.full > CYST_OVERHOLD) this.releaseStuck(true);
      }
    } else if (!s.charging && s.t > 0.6) {
      this.releaseStuck();
    }
  }

  releaseStuck(overheld = false) {
    const d = this.dex;
    const s = d.stuck;
    if (!s) return;
    d.stuck = null;
    if (overheld) this.addText('HELD TOO LONG', d.x, d.y + 90, '#ffc2b8', 16);
    const c = overheld ? 0.45 : s.charge;
    if (s.kind === 'cyst') {
      const grade = overheld ? 'ok' : c >= 0.999 ? 'perfect' : c >= 0.7 ? 'great' : 'ok';
      this.pop(s.p, grade, s.u, 'ripe', c);
    } else {
      this.pop(s.p, s.grade, s.u, ripeness(s.p), c);
    }
  }

  sporeRipen(from) {
    let n = 0;
    for (const q of this.course.pimples) {
      if (n >= 3) break;
      if (q === from || q.x <= from.x || q.state !== 'idle') continue;
      if (q.type !== 'white' && q.type !== 'mini') continue;
      n++;
      q.ripe = q.sporeOver && q.type === 'white' ? 'over' : 'ripe';
      this.puff(q.x, q.base + q.h, 10, 'rgba(197,140,255,0.8)');
    }
  }

  updateFoam(h) {
    const tier = biomeAt(this.dex.x).tier;
    this.foamSpeed = Math.min(FOAM_CAP + tier * 30, FOAM_BASE + FOAM_RAMP * this.t + tier * 25);
    this.foamX += this.foamSpeed * h;
    const gap = this.dex.x - this.foamX;
    if (gap > FOAM_MAX_GAP) this.foamX = this.dex.x - FOAM_MAX_GAP;
    else if (gap <= 0) this.die('foam');
  }

  updateHazards(h) {
    const d = this.dex;
    const cx = d.x;
    const cy = d.y + DEX_R;
    const c = this.course;
    for (const z of c.hazards) {
      if (z.x > d.x + 1500) continue;
      switch (z.type) {
        case 'tweezers': {
          // A loop you can read from afar: shadow, snap, hold, lift.
          const ph = (this.t / z.period + z.phase) % 1;
          const [P0, P1, P2, P3] = TWEEZER_PHASES;
          let tip = TWEEZER_HOVER;
          if (ph >= P1 && ph < P2) tip = TWEEZER_HOVER * (1 - (ph - P1) / (P2 - P1));
          else if (ph >= P2 && ph < P3) tip = 0;
          else if (ph >= P3) tip = TWEEZER_HOVER * ((ph - P3) / (1 - P3));
          z.tip = tip;
          z.shadow = ph < P0 ? 0 : ph < P1 ? (ph - P0) / (P1 - P0) : ph < P3 ? 1 : 1 - (ph - P3) / (1 - P3);
          z.closed = ph >= P2 && ph < P3;
          z.danger = ph >= P1 - 0.06 && ph < P3;
          const near = Math.abs(z.x - d.x) < 500;
          if (near && ph >= P2 && !z.snapped) {
            z.snapped = true;
            this.audio.snip();
          }
          if (ph < P2) z.snapped = false;
          // They only pinch at skin level: flying over them is always safe.
          if (ph >= P1 && ph < P3 && tip < 60 && Math.abs(cx - z.x) < 12 + DEX_R * 0.8 &&
              cy + DEX_R * 0.7 > z.base + tip && cy - DEX_R * 0.7 < z.base + tip + TWEEZER_LEN) {
            this.hit('tweezers');
          }
          break;
        }
        case 'hair': {
          if (cx + DEX_R < z.x || cx - DEX_R > z.x + z.w) break;
          for (const st of z.stalks) {
            const sx = z.x + st.dx;
            if (Math.abs(cx - sx) < DEX_R * 0.7 + 2 && cy - DEX_R * 0.7 < st.base + st.h) {
              this.hit('hair');
              break;
            }
          }
          break;
        }
        case 'spikes': {
          if (cx > z.x - 3 && cx < z.x + z.w + 3 && d.y < c.groundY(cx) + 12) this.hit('spikes');
          break;
        }
        case 'mosquito': {
          if (!z.alive) {
            if (z.deadT !== undefined) z.deadT += h;
            break;
          }
          if (z.t < 0) {
            if (z.x - d.x < 800) z.t = 0;
            else break;
          }
          z.t += h;
          z.mx = z.x - z.drift * z.t;
          z.my = c.groundY(z.mx) + z.baseH + z.amp * Math.sin(z.t * z.freq * 6.2832 + z.phase);
          const dx = cx - z.mx;
          const dy = cy - z.my;
          if (dx * dx + dy * dy < (DEX_R + 15) * (DEX_R + 15)) {
            if (!d.grounded && (d.vy < 0 || d.slamming) && cy > z.my - 8) {
              // Stomp: a free bounce that keeps the streak alive.
              z.alive = false;
              z.deadT = 0;
              d.vy = 760;
              d.slamming = false;
              d.launched = true;
              d.flapUsed = false;
              d.vx = Math.min(MAX_SPEED, d.vx + 20);
              this.bot.plan = null;
              this.popPoints += 75 * this.multiplier;
              this.gooEarned += 2;
              this.flags.stomped = true;
              this.addText('SQUISH!', z.mx, z.my + 34, '#e8ffb0', 22);
              this.audio.squish();
              this.feel.pulse('medium');
              this.shake = 5;
              this.puff(z.mx, z.my, 12, 'rgba(160,50,50,0.85)');
            } else if (!z.bonkT || this.t - z.bonkT > 0.6) {
              // From below or the side it knocks you down: costs speed and the streak.
              z.bonkT = this.t;
              d.vy = Math.min(d.vy, -250);
              d.slamming = false;
              d.launched = true;
              d.vx = Math.max(MIN_SPEED, d.vx - 60);
              this.streak = 0;
              this.hurt = 0.4;
              this.shake = 6;
              this.addText('BZZT!', z.mx, z.my + 30, '#ffb0a0', 20);
              this.audio.thud();
              this.feel.pulse('medium');
            }
          }
          break;
        }
        case 'cream': {
          if (z.done) break;
          if (z.t < 0) {
            if (z.p.state === 'idle' && z.p.x - d.x < z.trigger) z.t = 0;
            else break;
          }
          z.t += h;
          if (z.t >= z.fall) {
            z.done = true;
            if (z.p.state === 'idle') {
              z.p.state = 'shrunk';
              this.addText('CREAMED', z.p.x, z.p.base + 60, '#ffffff', 16);
            }
            this.audio.splat();
          }
          break;
        }
      }
      if (this.dead) return;
    }
  }

  hit(cause) {
    if (this.invuln > 0 || this.dead) return;
    if (this.mut && this.mut.kind === 'shell') {
      this.endMutation('cracked');
      this.invuln = 1;
      this.shake = 10;
      this.hurt = 0.6;
      this.feel.pulse('heavy');
      this.audio.crack();
      return;
    }
    this.die(cause);
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.cause = cause;
    this.deathT = 0;
    const d = this.dex;
    d.stuck = null;
    this.hurt = 1;
    this.shake = 12;
    this.audio.death(cause);
    this.feel.pulse('heavy');
    this.spawnGoo(d.x, d.y + 12, 22, false);
  }

  updatePickups() {
    const d = this.dex;
    const cx = d.x;
    const cy = d.y + DEX_R;
    for (const k of this.course.pickups) {
      if (k.got) continue;
      const dx = cx - k.x;
      const dy = cy - k.y;
      if (dx * dx + dy * dy < 40 * 40) {
        k.got = true;
        this.mut = { kind: k.kind, t: MUTATION_TIME };
        const info = MUTATION_INFO[k.kind];
        this.addBigText(info.name.toUpperCase(), info.color, info.desc);
        this.audio.pickup();
        this.feel.pulse('medium');
        this.puff(k.x, k.y, 16, info.color);
      }
    }
    for (const g of this.gooBlobs) {
      if (g.got) continue;
      const dx = cx - g.x;
      const dy = cy - g.y;
      if (dx * dx + dy * dy < 38 * 38) {
        g.got = true;
        this.gooEarned += 1;
        this.popPoints += 15 * this.multiplier;
        this.audio.goo();
      }
    }
  }

  endMutation(reason) {
    if (!this.mut) return;
    const d = this.dex;
    if (reason === 'cracked') this.addText('SHELL CRACKED', d.x, d.y + 80, '#f0b54a', 18);
    if (reason === 'lost') this.addText('WINGS LOST', d.x, d.y + 80, '#9fd8ff', 16);
    this.mut = null;
  }

  updateEruption(h) {
    const e = this.erupt;
    if (!e) return;
    e.t -= h;
    if (e.t > 0) return;
    e.n--;
    e.t = 0.3;
    const top = e.p.base + e.p.h;
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.35 + Math.random() * 0.3);
      const sp = 500 + Math.random() * 600;
      this.particles.push({
        x: e.p.x, y: top, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 3 + Math.random() * 5, life: 1.6, color: Math.random() < 0.5 ? '#ffe27a' : '#fff6cf',
      });
    }
    const d = this.dex;
    for (let i = 0; i < 4; i++) {
      const tau = 0.25 + Math.random() * 0.9;
      const px = d.x + d.vx * tau;
      let py = d.y + (d.grounded ? 0 : d.vy * tau - 0.5 * GRAVITY * tau * tau);
      py += (Math.random() - 0.5) * 50;
      if (py > this.course.groundY(px) + 60) this.gooBlobs.push({ x: px, y: py, got: false, bob: Math.random() * 6 });
    }
    this.audio.erupt();
    this.shake = Math.max(this.shake, 5);
    if (e.n <= 0) this.erupt = null;
  }

  // ───────────────────────────── feedback ─────────────────────────────

  spawnGoo(x, y, n, over) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.08 + 0.84 * Math.random());
      const sp = 180 + Math.random() * 480;
      const color = over
        ? (Math.random() < 0.5 ? '#f6d340' : '#ffe98a')
        : (Math.random() < 0.6 ? '#fff4d6' : '#f7dc8f');
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 4, life: 1.4, color });
    }
  }

  puff(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 140;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 60, r: 2 + Math.random() * 3, life: 0.5, color, puff: true });
    }
  }

  addText(text, x, y, color, size) {
    this.texts.push({ text, x, y, color, size, t: 0, life: 0.9, dx0: this.dex.x });
  }

  addBigText(text, color, sub) {
    this.bigTexts.push({ text, color, sub, t: 0, life: sub ? 2.2 : 1.2 });
  }

  addSplatter() {
    // Covers part of the view ahead for a few seconds: the price of a mega launch.
    for (let i = 0; i < 3; i++) {
      this.splats.push({
        x: 0.45 + Math.random() * 0.5, y: 0.12 + Math.random() * 0.5,
        r: 0.08 + Math.random() * 0.07, life: 3, max: 3, seed: Math.random() * 1000,
      });
    }
    this.audio.splat();
  }

  updateFx(dt, realDt) {
    const g = this.course;
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      p.vy -= (p.puff ? 200 : 1500) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const gy = g.groundY(p.x);
      if (!p.puff && p.y <= gy && p.vy < 0) {
        if (this.decals.length < 140) this.decals.push({ x: p.x, y: gy, r: p.r * 1.7, life: 6, color: p.color });
        ps.splice(i, 1);
      } else if (p.life <= 0) {
        ps.splice(i, 1);
      }
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      this.decals[i].life -= dt;
      if (this.decals[i].life <= 0) this.decals.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += realDt;
      t.y += 50 * realDt;
      if (t.t > t.life) this.texts.splice(i, 1);
    }
    for (let i = this.bigTexts.length - 1; i >= 0; i--) {
      const t = this.bigTexts[i];
      t.t += realDt;
      if (t.t > t.life) this.bigTexts.splice(i, 1);
    }
    for (let i = this.splats.length - 1; i >= 0; i--) {
      this.splats[i].life -= realDt;
      if (this.splats[i].life <= 0) this.splats.splice(i, 1);
    }
    if (this.banner) {
      this.banner.t += realDt;
      if (this.banner.t > 3) this.banner = null;
    }
    const d = this.dex;
    d.squash = Math.max(0, d.squash - realDt * 6);
    if (!this.dead && this.foamGap < 260 && Math.random() < realDt * 8) this.audio.bubble();
  }

  updateHint(realDt) {
    if (this.autoplay) return;
    const f = this.flags;
    this.edgeHintT = Math.max(0, this.edgeHintT - realDt);
    const d = this.dex;
    let hint = null;
    if (d.stuck && d.stuck.kind === 'cyst' && !f.cyst) hint = 'Hold… and let go at full charge!';
    else if (!f.jumped) hint = 'Tap to jump';
    else if (!f.popped) hint = 'Tap in the air to slam straight down onto a pimple';
    else if (!f.perfect) hint = 'Slam when the marker turns gold: right on the head';
    else if (this.edgeHintT > 0) hint = 'Skip red pimples · yellow ones launch you high';
    this.hint = hint;
  }

  // ───────────────────────────── attract-mode bot ─────────────────────────────
  // Plays like a decent human: picks a pimple, then taps with a little
  // random timing error (botError seconds). Also used to sanity-check balance.

  botThink() {
    const d = this.dex;
    const bot = this.bot;
    if (bot.release) {
      bot.release = false;
      this.release();
    }
    if (d.stuck) {
      if (!this.pressed && d.stuck.charge < 1) this.press();
      else if (d.stuck.charge >= 1) this.release();
      return;
    }
    const hz = this.course.hazards;
    if (d.grounded) {
      bot.plan = null;
      const next = this.course.pimples.find((p) => p.state === 'idle' && p.ripe !== 'red' && p.x > d.x + 40);
      const danger = hz.some((z) => (z.type === 'spikes' || z.type === 'hair') && z.x - d.x < 70 && z.x - d.x > 0);
      if (danger || (next && next.x - d.x < 230)) this.botTap();
      return;
    }
    if (d.slamming) return;
    if (!bot.plan) bot.plan = this.botPlan();
    const plan = bot.plan;
    if (plan && d.x >= plan.tapX) {
      bot.plan = { tapX: Infinity };
      this.botTap();
    }
  }

  botPlan() {
    const d = this.dex;
    // Where would a free fall come down?
    let x = d.x;
    let y = d.y;
    let vy = d.vy;
    const dt = 1 / 60;
    for (let i = 0; i < 180; i++) {
      vy -= GRAVITY * dt;
      x += d.vx * dt;
      y += vy * dt;
      if (vy < 0 && y <= this.surfaceAt(x).y) break;
    }
    const landX = x;
    const hz = this.course.hazards;
    const hairAhead = (px) => hz.some((z) => z.type === 'hair' && z.x > px && z.x - px < 420);
    let best = null;
    let bestScore = -Infinity;
    for (const p of this.course.pimples) {
      if (p.state !== 'idle' || p.x < d.x + 10 || p.x > landX) continue;
      if (p.ripe === 'red') continue;
      const tw = hz.find((z) => z.type === 'tweezers' && z.p === p);
      if (tw) {
        const eta = (p.x - d.x) / d.vx;
        const ph = ((this.t + eta) / tw.period + tw.phase) % 1;
        if (ph > TWEEZER_PHASES[1] - 0.12 && ph < TWEEZER_PHASES[3] + 0.02) continue;
      }
      let score = p.x;
      if (hairAhead(p.x)) score += p.ripe === 'over' ? 500 : -300;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      const hairNext = hairAhead(best.x) && best.ripe !== 'over';
      const aim = hairNext ? best.x - best.w * 0.3 : best.x;
      return { tapX: aim + gauss() * this.botError * d.vx };
    }
    const m = hz.find((z) => z.type === 'mosquito' && z.alive && z.mx > d.x && z.mx < landX + 60);
    if (m) return { tapX: m.mx - 4 + gauss() * this.botError * d.vx };
    return { tapX: Infinity };
  }

  botTap() {
    this.press();
    this.bot.release = true;
  }

  result() {
    return {
      mode: this.mode,
      score: this.score,
      distance: Math.floor(this.distance),
      perfects: this.perfects,
      maxStreak: this.maxStreak,
      pops: this.pops,
      goo: this.gooEarned,
      maxBiome: this.maxOverall,
      cause: this.cause,
      time: this.t,
      frames: this.rec,
    };
  }
}
