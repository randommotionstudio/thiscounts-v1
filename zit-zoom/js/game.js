// The simulation: Dex, pops, the foam wall, hazards, mutations, scoring.
// World units: x grows to the right, y grows upwards, the skin is y ≈ 0.
// All numbers are starting values to tune in playtests (see GDD).

import { Course, biomeAt, BIOMES, CLOCK_DIST, MUTATIONS } from './course.js';

export const GRAVITY = 2000;
export const JUMP_VY = 720;
export const POP_VY = 900;
export const MIN_SPEED = 250;
export const START_SPEED = 330;
export const MAX_SPEED = 820;
const DECAY_AIR = 12;
const DECAY_GROUND = 34;

/** The throb: every ripe pimple pulses on this beat (≈143 BPM). */
export const BEAT = 0.42;
/** Timing windows around the top of the pulse. Same size all game. */
export const PERFECT_WIN = 0.05;
export const GREAT_WIN = 0.105;
/** A ground-pound always takes the same time, so it is easy to time. */
export const POUND_TIME = 0.09;
const POUND_DRIFT = 0.3;

export const DEX_R = 15;
const FOAM_START_GAP = 330;
export const FOAM_MAX_GAP = 800;
const FOAM_BASE = 235;
const FOAM_RAMP = 3;
const FOAM_CAP = 600;
export const CYST_CHARGE = 0.9;
const CYST_OVERHOLD = 0.7;
export const MUTATION_TIME = 10;
export const UNITS_PER_MM = 40;
const MISS_LOSS = 70;
/** Tweezers: shadow until T[0], pinch down to T[1], closed to T[2], back up (harmless) by T[3]. */
export const TWEEZER_T = [0.5, 0.6, 0.95, 1.2];
export const TWEEZER_LEN = 115;
const TWEEZER_HOVER = 360;

export const GRADE_INFO = {
  perfect: { label: 'PERFECT', points: 100, goo: 3, color: '#fff36b' },
  great: { label: 'GREAT', points: 50, goo: 2, color: '#8ff0ff' },
  ok: { label: 'OK', points: 20, goo: 1, color: '#ffffff' },
};

export const MUTATION_INFO = {
  shell: { name: 'Hard Shell', desc: 'Absorbs one hit · a Miss cracks it', color: '#f0b54a', unlock: 0 },
  wings: { name: 'Wings', desc: 'Tap while rising to flap once', color: '#9fd8ff', unlock: 1 },
  sticky: { name: 'Sticky Legs', desc: 'Hold to stick · release on the throb', color: '#9be36b', unlock: 2 },
  spores: { name: 'Spore Cloud', desc: 'Pops ripen the next pimples', color: '#c58cff', unlock: 3 },
};

export const DEATH_INFO = {
  foam: { title: 'FOAMED!', sub: 'The face wash caught up with you.' },
  tweezers: { title: 'PLUCKED!', sub: 'Watch the shadow: speed through or launch past.' },
  hair: { title: 'TANGLED!', sub: 'Back-edge pops launch you over hair.' },
  spikes: { title: 'SPIKED!', sub: 'Ingrown hairs: chain your pops over them.' },
  mosquito: { title: 'BITTEN!', sub: 'Slam mosquitoes from above for a bounce.' },
};

export function multiplierFor(streak) {
  return streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
}

/** 'red' | 'ripe' | 'over' | 'popped' | 'shrunk' */
export function ripeness(p) {
  if (p.state !== 'idle') return p.state;
  if (p.type !== 'white' && p.type !== 'mini') return 'ripe';
  const c = Math.max(0, p.clock);
  if (c < p.ripeAt) return 'red';
  if (c >= p.overAt) return 'over';
  return 'ripe';
}

export function pimpleHeight(p, st) {
  if (st === 'red') return p.h * 0.55;
  if (st === 'over') return p.h * 1.18;
  if (st === 'shrunk') return p.h * 0.22;
  return p.h;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const noop = () => {};
const SILENT = new Proxy({}, { get: () => noop });

export class Game {
  constructor(o = {}) {
    this.mode = o.mode || 'endless';
    this.seed = o.seed >>> 0;
    this.audio = o.audio || SILENT;
    this.feel = o.feel || SILENT;
    this.flags = o.flags || {};
    this.skin = o.skin || 'classic';
    this.autoplay = !!o.autoplay;
    this.onEnd = o.onEnd || noop;
    this.ghost = o.ghost || null;
    this.course = new Course(this.seed, { mutationKinds: o.mutationKinds || MUTATIONS });

    this.t = 0;
    this.dex = {
      x: 0, y: this.course.groundY(0), vx: START_SPEED, vy: 0,
      grounded: true, pounding: false, launched: false, flapUsed: false,
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
    this.target = null;

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
    this.lastBeat = -1;
    this.biomeOverall = -1;
    this.maxOverall = 0;
    this.rec = [];
    this.recT = 0;
    this.pruneT = 0;
    this.botRelease = false;
  }

  get distance() { return Math.max(0, this.dex.x) / UNITS_PER_MM; }
  get score() { return Math.floor(this.distance) + this.popPoints; }
  get multiplier() { return multiplierFor(this.streak); }
  get foamGap() { return this.dex.x - this.foamX; }

  /** Signed time to the nearest throb: negative = early, positive = late. */
  beatOffset(t = this.t) {
    const ph = t % BEAT;
    return ph <= BEAT / 2 ? ph : ph - BEAT;
  }

  gradeNow() {
    const o = Math.abs(this.beatOffset());
    return o <= PERFECT_WIN ? 'perfect' : o <= GREAT_WIN ? 'great' : 'ok';
  }

  // ───────────────────────────── input ─────────────────────────────

  press() {
    this.pressed = true;
    if (this.dead || this.paused) return;
    const d = this.dex;
    if (d.stuck) {
      if (d.stuck.kind === 'cyst') d.stuck.charging = true;
      return;
    }
    if (d.grounded) return this.jump();
    if (this.mut && this.mut.kind === 'wings' && !d.flapUsed && d.vy > 0 && !d.pounding) {
      d.flapUsed = true;
      d.vy = 680;
      this.audio.flap();
      this.feel.pulse('light');
      this.puff(d.x, d.y + 10, 8, 'rgba(220,240,255,0.9)');
      return;
    }
    if (!d.pounding) this.pound();
  }

  release() {
    this.pressed = false;
    const s = this.dex.stuck;
    if (s && (s.kind === 'sticky' || s.charging)) this.releaseStuck();
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

  pound() {
    const d = this.dex;
    const s = this.surfaceAt(d.x + d.vx * POUND_DRIFT * POUND_TIME);
    d.pounding = true;
    d.vy = -Math.max(1100, (d.y - s.y) / POUND_TIME);
    this.audio.pound();
  }

  // ───────────────────────────── loop ─────────────────────────────

  update(realDt) {
    if (this.paused) return;
    realDt = Math.min(realDt, 0.05);
    let scale = 1;
    if (this.slowT > 0) {
      this.slowT -= realDt;
      scale = 0.25;
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
    const c = this.course;
    c.ensure(d.x + 2600);

    const beat = Math.floor(this.t / BEAT);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      this.audio.throb(beat % 4 === 0);
    }

    this.target = null;
    for (const p of c.pimples) {
      if (p.clock >= 0) p.clock += h;
      else if (p.x - d.x < CLOCK_DIST) p.clock = 0;
      if (!this.target && p.state === 'idle' && p.x + p.w * 0.35 > d.x && p.x - d.x < 600) {
        const st = ripeness(p);
        if (st === 'ripe' || st === 'over') this.target = p;
      }
    }

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
    d.x += (d.pounding ? d.vx * POUND_DRIFT : d.vx) * h;
    d.legPhase += h * (d.grounded ? d.vx * 0.09 : 8);
    if (d.grounded) {
      d.y = this.surfaceAt(d.x).y;
      return;
    }
    if (!d.pounding) d.vy -= GRAVITY * h;
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
      if (dx < -hw - 4 || dx > hw + 4) continue;
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
    const pounded = d.pounding;
    d.pounding = false;
    d.grounded = true;
    d.vy = 0;
    d.squash = 1;
    const p = s.pimple;
    const st = p ? ripeness(p) : 'skin';
    if (p && (st === 'ripe' || st === 'over')) {
      const u = clamp((d.x - p.x) / (p.w / 2), -1, 1);
      if (p.type === 'cyst') return this.stick(p, 'cyst', u);
      if (this.mut && this.mut.kind === 'sticky' && this.pressed && p.type !== 'volcano') return this.stick(p, 'sticky', u);
      return this.pop(p, this.gradeNow(), u, st);
    }
    if (p && st === 'red') return this.bump(p);
    // Bare skin (or a crater, or a creamed pimple).
    if (this.mut && this.mut.kind === 'wings') this.endMutation('lost');
    if (pounded || d.launched) this.miss();
    else this.audio.land();
    d.launched = false;
  }

  pop(p, grade, u, st, charge = 0) {
    const d = this.dex;
    const info = GRADE_INFO[grade];
    const gf = grade === 'perfect' ? 1 : grade === 'great' ? 0.75 : 0.38;
    let vy;
    let dvx;
    switch (p.type) {
      case 'black':
        vy = 440 * (0.6 + 0.4 * gf);
        dvx = 130 * gf - 20 * (1 - gf);
        break;
      case 'mini':
        vy = 520 * (0.7 + 0.3 * gf);
        dvx = grade === 'perfect' ? 20 : 0;
        break;
      case 'cyst':
        vy = 700 + 800 * charge;
        dvx = 30 + 170 * charge;
        break;
      case 'volcano':
        vy = 1450;
        dvx = 140;
        break;
      default: {
        // Landing position sets the launch angle: back edge high, front edge flat and fast.
        const a = 1 - u * (u < 0 ? 0.28 : 0.32);
        vy = POP_VY * gf * a;
        dvx = (grade === 'perfect' ? 55 : grade === 'great' ? 25 : -10) + u * 75 * gf;
      }
    }
    if (st === 'over') {
      vy *= 1.35;
      dvx += 40;
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
    this.spawnGoo(p.x + u * p.w * 0.3, top, grade === 'perfect' ? 34 : grade === 'great' ? 20 : 10, st === 'over');
    this.addText(info.label, d.x, top + 46, info.color, grade === 'perfect' ? 30 : 24);
    if (grade !== 'perfect' && p.type !== 'cyst') {
      this.addText(this.beatOffset() < 0 ? 'early' : 'late', d.x, top + 22, 'rgba(255,255,255,0.85)', 15);
    }
    if (grade === 'perfect') {
      this.slowT = 0.12;
      this.flash = 0.8;
      this.shake = 9;
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
      this.edgeHintT = 4.5;
    }
    if (this.mut && this.mut.kind === 'spores') this.sporeRipen(p);
    if (p.type === 'volcano') this.erupt = { p, n: 4, t: 0 };

    p.state = 'popped';
    p.popT = this.t;
    d.vy = vy;
    d.vx = clamp(d.vx + dvx, MIN_SPEED, MAX_SPEED);
    d.grounded = false;
    d.launched = true;
    d.flapUsed = false;
    d.y += 0.5;
  }

  bump(p) {
    const d = this.dex;
    d.vy = 360;
    d.grounded = false;
    d.launched = true;
    this.streak = 0;
    this.addText('UNRIPE', d.x, p.base + p.h + 34, '#ffb0a0', 20);
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
    d.stuck = { p, kind, u, t: 0, charge: 0, full: 0, charging: kind === 'cyst' && this.pressed };
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
    if (s.kind === 'cyst') {
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
    } else if (s.t > 2.5) {
      this.releaseStuck();
    }
  }

  releaseStuck(overheld = false) {
    const d = this.dex;
    const s = d.stuck;
    if (!s) return;
    d.stuck = null;
    if (s.kind === 'cyst') {
      const c = overheld ? 0.45 : s.charge;
      const grade = overheld ? 'ok' : c >= 0.999 ? 'perfect' : c >= 0.7 ? 'great' : 'ok';
      if (overheld) this.addText('HELD TOO LONG', d.x, d.y + 90, '#ffc2b8', 16);
      this.pop(s.p, grade, s.u, 'ripe', c);
    } else {
      this.pop(s.p, this.gradeNow(), s.u, ripeness(s.p));
    }
  }

  sporeRipen(from) {
    let n = 0;
    for (const q of this.course.pimples) {
      if (n >= 3) break;
      if (q === from || q.x <= from.x || q.state !== 'idle') continue;
      if (q.type !== 'white' && q.type !== 'mini') continue;
      n++;
      q.clock = Math.max(q.clock, 0);
      q.ripeAt = Math.min(q.ripeAt, q.clock);
      if (q.sporeOver && q.type === 'white') q.overAt = q.clock;
      else q.overAt = Math.max(q.overAt, q.clock + 2.5);
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
          if (z.t < 0) {
            const dist = z.x - d.x;
            const eta = d.stuck ? Infinity : dist / Math.max(1, d.vx);
            if (dist > -20 && (eta < z.lead || dist < 300)) z.t = 0;
            else break;
          }
          z.t += h;
          // shadow (the tell) → pinch down → closed → back up
          let tip = TWEEZER_HOVER;
          if (z.t < TWEEZER_T[0]) tip = TWEEZER_HOVER;
          else if (z.t < TWEEZER_T[1]) tip = TWEEZER_HOVER * (1 - (z.t - TWEEZER_T[0]) / (TWEEZER_T[1] - TWEEZER_T[0]));
          else if (z.t < TWEEZER_T[2]) tip = 0;
          else if (z.t < TWEEZER_T[3]) tip = TWEEZER_HOVER * ((z.t - TWEEZER_T[2]) / (TWEEZER_T[3] - TWEEZER_T[2]));
          z.tip = tip;
          z.closed = z.t >= TWEEZER_T[1] && z.t < TWEEZER_T[2];
          if (z.t >= TWEEZER_T[1] && !z.snapped) {
            z.snapped = true;
            this.audio.snip();
          }
          if (z.t >= TWEEZER_T[0] && z.t < TWEEZER_T[2] && Math.abs(cx - z.x) < 12 + DEX_R * 0.8 &&
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
            if (z.x - d.x < 700) z.t = 0;
            else break;
          }
          z.t += h;
          z.mx = z.x - z.drift * z.t;
          z.my = c.groundY(z.mx) + z.baseH + z.amp * Math.sin(z.t * z.freq * 6.2832 + z.phase);
          const dx = cx - z.mx;
          const dy = cy - z.my;
          if (dx * dx + dy * dy < (DEX_R + 13) * (DEX_R + 13)) {
            if (!d.grounded && d.vy < 0 && cy > z.my + 3) {
              z.alive = false;
              z.deadT = 0;
              d.vy = 600;
              d.pounding = false;
              d.launched = true;
              d.flapUsed = false;
              this.popPoints += 50 * this.multiplier;
              this.gooEarned += 1;
              this.addText('SQUISH', z.mx, z.my + 30, '#e8ffb0', 20);
              this.audio.squish();
              this.feel.pulse('medium');
              this.puff(z.mx, z.my, 10, 'rgba(120,40,40,0.8)');
            } else {
              this.hit('mosquito');
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
      if (dx * dx + dy * dy < 38 * 38) {
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
      if (dx * dx + dy * dy < 36 * 36) {
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
    else if (!f.popped) hint = 'Tap again in the air to slam down on a pimple';
    else if (!f.perfect) hint = 'Slam right on the throb for a PERFECT';
    else if (this.edgeHintT > 0) hint = 'Front edge: fast and flat · Back edge: high';
    this.hint = hint;
  }

  // ───────────────────────────── attract-mode bot ─────────────────────────────

  botThink() {
    const d = this.dex;
    if (this.botRelease) {
      this.botRelease = false;
      this.release();
    }
    if (d.stuck) {
      if (d.stuck.kind === 'cyst') {
        if (!this.pressed && d.stuck.charge < 1) this.press();
        else if (d.stuck.charge >= 1) this.release();
      }
      return;
    }
    const hz = this.course.hazards;
    const tw = hz.find((z) => z.type === 'tweezers' && z.t >= 0 && z.t < TWEEZER_T[2] && z.x > d.x - 10);
    const tgt = this.target;
    if (d.grounded) {
      if (tw) {
        // jump so the apex lands on the pinch
        const eta = (tw.x - d.x) / d.vx;
        if (eta < JUMP_VY / GRAVITY + 0.03) this.botTap();
        return;
      }
      const danger = hz.some((z) => (z.type === 'spikes' || z.type === 'hair') && z.x - d.x < 80 && z.x - d.x > 0);
      if (danger || (tgt && tgt.x - d.x < 240 && tgt.x - d.x > 50)) this.botTap();
      return;
    }
    if (d.pounding || !tgt) return;
    if (tw && tw.x - d.x < 160 && tw.x > tgt.x - tgt.w) return; // stay airborne over the tweezers
    const dx = tgt.x - d.x;
    const hw = tgt.w / 2;
    // Hair just after this pimple? Land on the back edge for a high launch.
    const hairNext = hz.some((z) => z.type === 'hair' && z.x > tgt.x && z.x - tgt.x < 320);
    const lo = hairNext ? hw * 0.25 : -hw * 0.9;
    const hi = hairNext ? hw * 1.0 : hw * 1.0;
    const toBeat = BEAT - (this.t % BEAT);
    const inWindow = dx > lo && dx < hi;
    if (inWindow && Math.abs(toBeat - POUND_TIME) < 0.012) this.botTap();
    else if (dx < lo + hw * 0.1 && dx > -hw && d.vy < 0) this.botTap();
  }

  botTap() {
    this.press();
    this.botRelease = true;
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
