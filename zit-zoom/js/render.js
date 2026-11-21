// Canvas renderer. Everything is drawn procedurally; no image assets.

import { BIOMES, BIOME_LEN, biomeAt } from './course.js';
import { ripeness, pimpleHeight, headHalf, FOAM_MAX_GAP, MUTATION_INFO, MUTATION_TIME, CRAWLER_R } from './game.js';
import { drawDex, skinById } from './skins.js';
import { hash32 } from './rng.js';

export const FONT = '"Fredoka", ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
// World units visible across (at least). Portrait phones zoom in a little and
// move Dex further left, so the look-ahead stays similar on every screen.
const VIEW_W_LANDSCAPE = 540;
const VIEW_W_PORTRAIT = 430;
const VIEW_H_MIN = 400;

// Skin tones per loop of the body: a new tone each time Endless loops.
const TONES = [
  { top: '#f5c4a1', deep: '#d68f6e' },
  { top: '#d99a6c', deep: '#ad6e48' },
  { top: '#a86d48', deep: '#7c4b30' },
  { top: '#74462e', deep: '#4f2d1c' },
];

const hexCache = new Map();
function rgb(hex) {
  let v = hexCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, v);
  }
  return v;
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (a, alpha = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${alpha})`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function biomeColors(bi, tone) {
  const top = lerp3(rgb(tone.top), rgb(bi.tint), bi.tintAmt);
  const deep = lerp3(rgb(tone.deep), rgb(bi.tint), bi.tintAmt * 0.6);
  const bgTop = lerp3(rgb(bi.bgTop), rgb(tone.top), 0.18);
  const bgBottom = lerp3(rgb(bi.bgBottom), rgb(tone.deep), 0.28);
  return { top, deep, bgTop, bgBottom };
}

function paletteAt(x) {
  const b = biomeAt(x);
  const tone = TONES[b.tier % TONES.length];
  const cur = biomeColors(BIOMES[b.index], tone);
  let t = clamp((b.into - (BIOME_LEN - 700)) / 700, 0, 1);
  if (t <= 0) return cur;
  t = t * t * (3 - 2 * t);
  const nextTone = b.index === BIOMES.length - 1 ? TONES[(b.tier + 1) % TONES.length] : tone;
  const nxt = biomeColors(BIOMES[(b.index + 1) % BIOMES.length], nextTone);
  return {
    top: lerp3(cur.top, nxt.top, t), deep: lerp3(cur.deep, nxt.deep, t),
    bgTop: lerp3(cur.bgTop, nxt.bgTop, t), bgBottom: lerp3(cur.bgBottom, nxt.bgBottom, t),
  };
}

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { game: null, y: 0 };
    this.safe = { top: 0, bottom: 0, left: 0, right: 0 };
    this.resize();
  }

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    const portrait = H > W * 1.1;
    this.scale = Math.min(W / (portrait ? VIEW_W_PORTRAIT : VIEW_W_LANDSCAPE), H / VIEW_H_MIN);
    this.viewW = W / this.scale;
    this.viewH = H / this.scale;
    this.dexX = portrait ? 0.17 : 0.22;
    this.groundLine = this.viewH * (portrait ? 0.62 : 0.76);
    const probe = document.getElementById('safe-probe');
    if (probe) {
      const cs = getComputedStyle(probe);
      this.safe = {
        top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0,
      };
    }
  }

  X(wx) { return wx - this.camX; }
  Y(wy) { return this.groundLine - (wy - this.camY); }

  draw(game, dt, { hud = true } = {}) {
    const ctx = this.ctx;
    if (this.cam.game !== game) this.cam = { game, y: 0 };
    const d = game.dex;
    const vw = this.viewW;
    const vh = this.viewH;
    const gl = this.groundLine;
    this.camX = d.x - vw * this.dexX;
    const targetY = Math.max(0, d.y - (gl - vh * 0.24));
    this.cam.y += (targetY - this.cam.y) * Math.min(1, dt * 7);
    this.camY = this.cam.y;

    const k = this.scale * this.dpr;
    const sh = game.shake;
    const ox = (Math.random() - 0.5) * sh;
    const oy = (Math.random() - 0.5) * sh;
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);

    const pal = paletteAt(d.x + vw * 0.3);
    const t = game.t;
    const pulse = 0;
    this.drawBackground(ctx, pal, game);
    this.drawGround(ctx, pal, game);
    this.drawDecals(ctx, game);
    this.drawPimples(ctx, game, pulse, pal);
    this.drawHazards(ctx, game);
    this.drawPickups(ctx, game, t);
    this.drawPreview(ctx, game);
    this.drawGhost(ctx, game);
    this.drawDexNow(ctx, game);
    this.drawParticles(ctx, game);
    this.drawFoam(ctx, game);
    this.drawWorldTexts(ctx, game);

    // screen space (CSS px)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSplats(ctx, game);
    if (game.flash > 0) {
      ctx.fillStyle = `rgba(255,255,240,${game.flash * 0.45})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (game.hurt > 0) {
      const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
      g.addColorStop(0, 'rgba(200,30,40,0)');
      g.addColorStop(1, `rgba(200,30,40,${game.hurt * 0.5})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (hud) this.drawHud(ctx, game, pulse);
  }

  // ───────────────────────────── world ─────────────────────────────

  drawBackground(ctx, pal, game) {
    const vw = this.viewW;
    const vh = this.viewH;
    const g = ctx.createLinearGradient(0, 0, 0, this.groundLine + 40);
    g.addColorStop(0, css(pal.bgTop));
    g.addColorStop(1, css(pal.bgBottom));
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, vw + 40, vh + 40);

    // out-of-focus bokeh, parallax
    const par = 0.25;
    const offX = this.camX * par;
    const cell = 150;
    const i0 = Math.floor(offX / cell) - 1;
    const i1 = Math.floor((offX + vw) / cell) + 1;
    for (let i = i0; i <= i1; i++) {
      const h = hash32(i * 31 + 7);
      const x = i * cell - offX + (h % 120);
      const y = this.groundLine * (0.08 + ((h >>> 8) % 1000) / 1000 * 0.7) + this.camY * 0.25;
      const r = 16 + ((h >>> 18) % 46);
      ctx.fillStyle = `rgba(255,255,255,${0.08 + ((h >>> 4) % 10) / 90})`;
      ell(ctx, x, y, r, r);
      ctx.fill();
    }

    // a soft far skin hill
    const par2 = 0.5;
    ctx.fillStyle = css(lerp3(pal.bgBottom, pal.top, 0.45), 0.55);
    ctx.beginPath();
    ctx.moveTo(-20, vh + 20);
    for (let sx = -20; sx <= vw + 40; sx += 24) {
      const wx = (this.camX + sx) * par2;
      const y = this.groundLine - 34 + this.camY * 0.5 - 26 * Math.sin(wx * 0.006) - 14 * Math.sin(wx * 0.017 + 1.3);
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(vw + 40, vh + 20);
    ctx.closePath();
    ctx.fill();
  }

  drawGround(ctx, pal, game) {
    const c = game.course;
    const vw = this.viewW;
    const vh = this.viewH;
    const step = 10;
    const pts = [];
    for (let sx = -20; sx <= vw + 30; sx += step) pts.push([sx, this.Y(c.groundY(this.camX + sx))]);

    ctx.beginPath();
    ctx.moveTo(-20, vh + 40);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(vw + 30, vh + 40);
    ctx.closePath();
    const top = this.Y(0) - 40;
    const g = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, vh));
    g.addColorStop(0, css(pal.top));
    g.addColorStop(0.35, css(lerp3(pal.top, pal.deep, 0.55)));
    g.addColorStop(1, css(pal.deep));
    ctx.fillStyle = g;
    ctx.fill();

    // surface sheen
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1.5) : ctx.moveTo(x, y + 1.5)));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // pores, creases, biome details
    const b = biomeAt(this.camX + vw * 0.5);
    const cell = 34;
    const i0 = Math.floor(this.camX / cell) - 1;
    const i1 = Math.floor((this.camX + vw) / cell) + 1;
    const dark = css(pal.deep, 0.55);
    for (let i = i0; i <= i1; i++) {
      const h = hash32(i * 13 + b.tier * 977);
      const wx = i * cell + (h % 28);
      const sy = this.Y(c.groundY(wx));
      const sx = this.X(wx);
      if (h % 4 === 0) {
        ctx.fillStyle = dark;
        ell(ctx, sx, sy + 3.5, 3.4, 1.3);
        ctx.fill();
      }
      if (h % 7 === 1) {
        ctx.strokeStyle = css(pal.deep, 0.18);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const dy = 18 + ((h >>> 5) % 60);
        ctx.moveTo(sx - 16, sy + dy);
        ctx.quadraticCurveTo(sx, sy + dy - 5, sx + 18, sy + dy + 2);
        ctx.stroke();
      }
      const bi = biomeAt(wx).index;
      if (bi === 2 && h % 3 === 0) { // chin stubble
        ctx.strokeStyle = 'rgba(60,40,30,0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sx + 6, sy + 1);
        ctx.lineTo(sx + 9, sy - 4);
        ctx.stroke();
      } else if (bi === 3 && h % 5 === 0) { // freckles on the back
        ctx.fillStyle = css(pal.deep, 0.35);
        ell(ctx, sx + 10, sy + 12 + (h >>> 9) % 20, 3, 2.2);
        ctx.fill();
      } else if (bi === 4 && h % 3 === 0) { // sweat beads
        const r = 2.5 + ((h >>> 6) % 3);
        ctx.fillStyle = 'rgba(220,240,255,0.65)';
        ell(ctx, sx + 8, sy - r + 0.5, r, r);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ell(ctx, sx + 7, sy - r - 0.6, r * 0.35, r * 0.35);
        ctx.fill();
      } else if (bi === 0 && h % 9 === 2) { // fine vellus hair
        ctx.strokeStyle = 'rgba(120,80,60,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 3, sy - 8, sx + 8, sy - 11);
        ctx.stroke();
      }
    }
  }

  drawDecals(ctx, game) {
    for (const s of game.decals) {
      const sx = this.X(s.x);
      if (sx < -20 || sx > this.viewW + 20) continue;
      ctx.globalAlpha = clamp(s.life / 2, 0, 0.9);
      ctx.fillStyle = s.color;
      ell(ctx, sx, this.Y(s.y) + 0.5, s.r * 1.3, s.r * 0.45);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawPimples(ctx, game, pulse, pal) {
    const vw = this.viewW;
    const stuck = game.dex.stuck;
    for (const p of game.course.pimples) {
      const sx = this.X(p.x);
      if (sx < -p.w || sx > vw + p.w) continue;
      const st = ripeness(p);
      // A gentle, unsynchronised glisten on ripe pimples (purely cosmetic).
      const shimmer = 0.3 * (0.5 + 0.5 * Math.sin(game.t * 3.2 + p.id * 1.9));
      this.drawPimple(ctx, p, st, pulse + shimmer, game, stuck && stuck.p === p ? stuck : null, pal);
    }
  }

  /** The aiming aid: a drop line and a marker where a slam right now would land. */
  drawPreview(ctx, game) {
    const pv = game.landingPreview();
    if (!pv) return;
    const COLORS = {
      perfect: '255,216,74', great: '255,255,255', ok: '255,170,110', cyst: '255,255,255',
      red: '255,90,90', danger: '255,59,59', skin: '255,255,255', stomp: '198,255,122',
    };
    const c = COLORS[pv.kind];
    const x = this.X(pv.x);
    const y0 = this.Y(game.dex.y) - 2;
    const y1 = this.Y(pv.y);
    const strong = pv.kind !== 'skin';
    ctx.save();
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${c},${strong ? 0.75 : 0.35})`;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1 - 5);
    ctx.stroke();
    ctx.setLineDash([]);
    if (pv.kind === 'danger' || pv.kind === 'red') {
      ctx.strokeStyle = `rgba(${c},0.95)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 7, y1 - 9);
      ctx.lineTo(x + 7, y1 + 1);
      ctx.moveTo(x + 7, y1 - 9);
      ctx.lineTo(x - 7, y1 + 1);
      ctx.stroke();
    } else {
      if (pv.kind === 'perfect') {
        const g = ctx.createRadialGradient(x, y1 - 3, 1, x, y1 - 3, 22);
        g.addColorStop(0, 'rgba(255,230,120,0.75)');
        g.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = g;
        ell(ctx, x, y1 - 3, 22, 14);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${c},${strong ? 0.95 : 0.4})`;
      ctx.lineWidth = pv.kind === 'perfect' ? 3.5 : 2.5;
      ell(ctx, x, y1 - 2, pv.kind === 'perfect' ? 11 : 9, pv.kind === 'perfect' ? 4.5 : 3.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPimple(ctx, p, st, pulse, game, stuck, pal) {
    const X = this.X(p.x);
    const Y = this.Y(p.base) + 1;
    const hw = p.w / 2;
    if (st === 'popped') {
      const age = game.t - (p.popT || 0);
      ctx.fillStyle = 'rgba(170,50,50,0.35)';
      ell(ctx, X, Y + 1, hw * 0.8, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,25,35,0.6)';
      ell(ctx, X, Y + 1, hw * 0.32, 2.6);
      ctx.fill();
      if (age < 3) {
        ctx.fillStyle = `rgba(255,240,190,${0.8 * (1 - age / 3)})`;
        for (let i = 0; i < 4; i++) {
          ell(ctx, X - hw * 0.5 + i * hw * 0.33, Y - 1, 3.5, 2);
          ctx.fill();
        }
      }
      return;
    }
    const ripeish = st === 'ripe' || st === 'over';
    let hh = pimpleHeight(p, st);
    let sxk = 1;
    let syk = 1;
    if (ripeish) {
      syk = 1 + 0.13 * pulse;
      sxk = 1 + 0.05 * pulse;
    }
    let jx = 0;
    if (stuck && stuck.kind === 'cyst') {
      syk += stuck.charge * 0.3;
      sxk += stuck.charge * 0.08;
      jx = stuck.charge >= 1 ? (Math.random() - 0.5) * 3 : 0;
    }
    const rx = hw * sxk;
    const ry = hh * syk;
    const cx = X + jx;

    // inflamed halo
    if (p.type !== 'black') {
      ctx.fillStyle = st === 'shrunk' ? 'rgba(225,120,110,0.18)' : 'rgba(225,80,80,0.3)';
      ell(ctx, cx, Y + 2, hw * 1.3, 7);
      ctx.fill();
    }

    const dome = () => {
      ctx.beginPath();
      ctx.ellipse(cx, Y, Math.max(0.1, rx), Math.max(0.1, ry), 0, Math.PI, Math.PI * 2);
      ctx.closePath();
    };
    const radial = (stops) => {
      const g = ctx.createRadialGradient(cx - rx * 0.3, Y - ry * 0.85, 1, cx, Y - ry * 0.2, rx * 1.25);
      stops.forEach(([o, c]) => g.addColorStop(o, c));
      return g;
    };
    const spec = (sx, sy, a = 0.8) => {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ell(ctx, sx, sy, Math.max(2, rx * 0.12), Math.max(1.4, ry * 0.08), -0.4);
      ctx.fill();
    };

    switch (p.type) {
      case 'black': {
        dome();
        ctx.fillStyle = radial([[0, css(lerp3(pal.top, [255, 255, 255], 0.2))], [1, css(pal.deep)]]);
        ctx.fill();
        ctx.fillStyle = '#2b1c16';
        ell(ctx, cx, Y - ry * 0.8, rx * 0.36, ry * 0.55);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ell(ctx, cx - rx * 0.12, Y - ry * 1.0, rx * 0.12, 1.2);
        ctx.fill();
        if (ripeish) {
          ctx.strokeStyle = `rgba(255,255,255,${0.45 * pulse})`;
          ctx.lineWidth = 2;
          dome();
          ctx.stroke();
        }
        return;
      }
      case 'cyst': {
        dome();
        ctx.fillStyle = radial([[0, '#f2a2b6'], [0.5, '#c45772'], [1, '#86304a']]);
        ctx.fill();
        ctx.fillStyle = 'rgba(110,30,60,0.45)';
        ell(ctx, cx, Y - ry * 0.55, rx * 0.4, ry * 0.3);
        ctx.fill();
        spec(cx - rx * 0.35, Y - ry * 0.78);
        if (stuck) {
          ctx.strokeStyle = stuck.charge >= 1 ? 'rgba(255,240,120,0.95)' : 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 3;
          dome();
          ctx.stroke();
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * pulse})`;
          ctx.lineWidth = 2.5;
          dome();
          ctx.stroke();
        }
        return;
      }
      case 'volcano': {
        dome();
        ctx.fillStyle = radial([[0, '#f4ad8e'], [0.6, '#d0664f'], [1, '#97392c']]);
        ctx.fill();
        const g = ctx.createRadialGradient(cx, Y - ry, 1, cx, Y - ry, rx * 0.4);
        g.addColorStop(0, '#fffbe0');
        g.addColorStop(0.5, '#ffd34d');
        g.addColorStop(1, 'rgba(255,170,40,0)');
        ctx.fillStyle = g;
        ell(ctx, cx, Y - ry * 0.97, rx * 0.4, 12 + 4 * pulse);
        ctx.fill();
        ctx.fillStyle = '#ffe16a';
        for (let i = -1; i <= 1; i++) {
          ell(ctx, cx + i * rx * 0.18, Y - ry * (0.8 - Math.abs(i) * 0.12), 3, 9 + i * 2);
          ctx.fill();
        }
        // steam
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let i = 0; i < 3; i++) {
          const a = (game.t * 0.6 + i / 3) % 1;
          ell(ctx, cx + Math.sin(a * 8 + i) * 8, Y - ry - 10 - a * 60, 8 + a * 10, 6 + a * 8);
          ctx.fill();
        }
        return;
      }
    }

    // whitehead / mini
    if (st === 'red') {
      dome();
      ctx.fillStyle = radial([[0, '#ff9c8c'], [0.55, '#e05b52'], [1, '#b53b3b']]);
      ctx.fill();
      spec(cx - rx * 0.3, Y - ry * 0.7, 0.55);
      return;
    }
    if (st === 'shrunk') {
      dome();
      ctx.fillStyle = 'rgba(240,170,160,0.9)';
      ctx.fill();
      ctx.fillStyle = 'rgba(250,250,248,0.95)';
      ell(ctx, cx, Y - ry * 0.8, rx * 0.9, ry * 0.9 + 3);
      ctx.fill();
      return;
    }
    dome();
    ctx.fillStyle = radial([[0, '#ffb6a6'], [0.5, '#ec7b6c'], [1, '#c4524a']]);
    ctx.fill();
    const over = st === 'over';
    const capY = Y - ry * (over ? 0.68 : 0.72);
    // The head is drawn exactly as wide as the Perfect zone.
    const capRx = headHalf(p) * sxk * (over ? 1.12 : 1.05);
    const capRy = ry * (over ? 0.5 : 0.38);
    const g = ctx.createRadialGradient(cx - capRx * 0.3, capY - capRy * 0.4, 1, cx, capY, capRx);
    if (over) {
      g.addColorStop(0, '#fff6b0');
      g.addColorStop(0.6, '#f5cf3e');
      g.addColorStop(1, '#d9a21e');
    } else {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.65, '#fff3d0');
      g.addColorStop(1, '#efcf98');
    }
    ctx.fillStyle = g;
    ell(ctx, cx, capY, capRx, capRy);
    ctx.fill();
    if (over) {
      ctx.fillStyle = '#efc434';
      ell(ctx, cx + capRx * 0.6, capY + capRy * 0.9, 2.2, 4);
      ctx.fill();
    }
    spec(cx - rx * 0.28, Y - ry * 0.8, 0.9);
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * pulse})`;
    ctx.lineWidth = 1 + 2.4 * pulse;
    dome();
    ctx.stroke();
  }

  drawHazards(ctx, game) {
    const vw = this.viewW;
    const c = game.course;
    for (const z of c.hazards) {
      const sx = this.X(z.x);
      if (sx > vw + 300 || sx + (z.w || 0) < -300) continue;
      switch (z.type) {
        case 'spikes': {
          for (const s of z.spikes) {
            const wx = z.x + s.dx;
            const bx = this.X(wx);
            const by = this.Y(c.groundY(wx)) + 1;
            ctx.fillStyle = 'rgba(220,70,70,0.55)';
            ell(ctx, bx, by + 1, 5, 2.4);
            ctx.fill();
            ctx.strokeStyle = '#2e1d16';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(bx - 3, by + 2);
            ctx.quadraticCurveTo(bx + s.lean * 4, by - s.h * 0.7, bx + s.lean * 9, by - s.h);
            ctx.stroke();
          }
          break;
        }
        case 'hair': {
          ctx.lineCap = 'round';
          for (const s of z.stalks) {
            const bx = this.X(z.x + s.dx);
            const by = this.Y(s.base) + 2;
            const tipX = bx + s.lean * s.h * 0.5;
            const tipY = by - s.h;
            ctx.strokeStyle = '#3a2a20';
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + s.lean * s.h * 0.1, by - s.h * 0.6, tipX, tipY);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bx - 1, by - 4);
            ctx.quadraticCurveTo(bx - 1 + s.lean * s.h * 0.1, by - s.h * 0.6, tipX - 1, tipY + 4);
            ctx.stroke();
            ctx.fillStyle = 'rgba(90,50,40,0.5)';
            ell(ctx, bx, by + 1, 4, 2);
            ctx.fill();
          }
          break;
        }
        case 'tweezers': {
          if (z.tip === undefined) break;
          const by = this.Y(z.base);
          const prog = z.shadow || 0;
          // the tell: a shadow that grows and darkens before each snap
          ctx.fillStyle = `rgba(40,20,20,${0.1 + 0.35 * prog})`;
          ell(ctx, sx, by + 1, 10 + 26 * prog, 3 + 3 * prog);
          ctx.fill();
          if (prog > 0 && !z.closed && z.tip > 300) {
            ctx.strokeStyle = `rgba(220,40,40,${0.7 * prog})`;
            ctx.lineWidth = 2;
            ell(ctx, sx, by + 1, 14 + 26 * prog, 5 + 3 * prog);
            ctx.stroke();
          }
          const tip = z.tip ?? 360;
          const tipY = by - tip;
          const topY = tipY - 150; // drawn long; only the tips (bottom 70) pinch
          const open = z.closed ? 2 : 13;
          const metal = ctx.createLinearGradient(sx - 16, 0, sx + 16, 0);
          metal.addColorStop(0, '#8d97a6');
          metal.addColorStop(0.45, '#eef2f7');
          metal.addColorStop(1, '#7c8696');
          ctx.fillStyle = metal;
          ctx.strokeStyle = '#59616e';
          ctx.lineWidth = 1.5;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(sx + side * 3, topY);
            ctx.lineTo(sx + side * 9, topY + 30);
            ctx.lineTo(sx + side * (open + 4), tipY - 6);
            ctx.lineTo(sx + side * open, tipY);
            ctx.lineTo(sx + side * (open - 1), tipY - 8);
            ctx.lineTo(sx + side * 1, topY + 30);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = '#c9cfd8';
          ell(ctx, sx, topY + 4, 6, 6);
          ctx.fill();
          ctx.stroke();
          if (z.gummed > game.t) {
            // gummed shut with goo
            ctx.fillStyle = '#f6d84e';
            ctx.strokeStyle = '#c99a1e';
            ctx.lineWidth = 1.2;
            ell(ctx, sx, tipY - 12, 12, 16);
            ctx.fill();
            ctx.stroke();
            ell(ctx, sx + 3, tipY + 4, 4, 7);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,252,220,0.9)';
            ell(ctx, sx - 4, tipY - 18, 3, 4);
            ctx.fill();
          }
          break;
        }
        case 'crawler': {
          if (z.cx === undefined) break;
          const bx = this.X(z.cx);
          if (bx < -40 || bx > this.viewW + 40) break;
          const by = this.Y(z.cy);
          const R = CRAWLER_R;
          if (!z.alive) {
            const k = z.deadT || 0;
            if (k > 1.5) break;
            ctx.globalAlpha = 1 - k / 1.5;
            ctx.fillStyle = '#8fd16a';
            ell(ctx, bx, by - 2, R * 1.7, 3.5);
            ctx.fill();
            ctx.fillStyle = '#5e9e43';
            ell(ctx, bx + 5, by - 3, 3, 1.5);
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
          }
          const t = game.t * 9 + z.x;
          const chew = z.eating ? Math.abs(Math.sin(game.t * 14)) : 0;
          // cilia
          ctx.strokeStyle = '#4f8a35';
          ctx.lineWidth = 1.4;
          ctx.lineCap = 'round';
          for (let i = 0; i < 7; i++) {
            const a = Math.PI * (0.15 + i * 0.12);
            const wig = Math.sin(t + i) * 2.5;
            ctx.beginPath();
            ctx.moveTo(bx + Math.cos(a) * R * 0.9, by - R - Math.sin(-a) * R * 0.9 + R * 0.95);
            ctx.lineTo(bx + Math.cos(a) * (R + 5) + wig, by - R + R * 0.95 + Math.sin(a) * 6);
            ctx.stroke();
          }
          for (let i = 0; i < 9; i++) {
            const a = -Math.PI * (0.1 + i * 0.1);
            const wig = Math.sin(t * 0.7 + i * 1.3) * 2;
            ctx.beginPath();
            ctx.moveTo(bx + Math.cos(a) * R, by - R + Math.sin(a) * R);
            ctx.lineTo(bx + Math.cos(a) * (R + 4 + wig), by - R + Math.sin(a) * (R + 4 + wig));
            ctx.stroke();
          }
          // body
          const g = ctx.createRadialGradient(bx - 4, by - R - 5, 1, bx, by - R, R * 1.2);
          g.addColorStop(0, '#c9f59f');
          g.addColorStop(0.6, '#8fd16a');
          g.addColorStop(1, '#5e9e43');
          ctx.fillStyle = g;
          ctx.strokeStyle = '#3f7a2a';
          ctx.lineWidth = 1.6;
          ell(ctx, bx, by - R, R * (1 + chew * 0.08), R * (1 - chew * 0.1));
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(63,122,42,0.45)';
          ell(ctx, bx + 5, by - R + 5, 2.6, 2);
          ctx.fill();
          ell(ctx, bx + 7, by - R - 4, 1.8, 1.5);
          ctx.fill();
          // angry eyes, looking at Dex (left)
          for (const ex of [-6, 0]) {
            ctx.fillStyle = '#ffffff';
            ell(ctx, bx + ex, by - R - 3, 3.4, 3.8);
            ctx.fill();
            ctx.fillStyle = '#1d2a12';
            ell(ctx, bx + ex - 1.2, by - R - 2.5, 1.6, 1.9);
            ctx.fill();
          }
          ctx.strokeStyle = '#1d2a12';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx - 9, by - R - 8);
          ctx.lineTo(bx - 3.5, by - R - 6);
          ctx.moveTo(bx + 3, by - R - 6.5);
          ctx.lineTo(bx - 1.5, by - R - 7.5);
          ctx.stroke();
          // mouth: chomping while it eats a pimple
          ctx.fillStyle = '#3a1d1d';
          ell(ctx, bx - 4, by - R + 4, 3.5, 0.8 + chew * 2.6);
          ctx.fill();
          break;
        }
        case 'mosquito': {
          if (z.t < 0 || z.mx === undefined) break;
          let mx = this.X(z.mx);
          let my = this.Y(z.my);
          if (!z.alive) {
            const dt = z.deadT || 0;
            if (dt > 1.2) break;
            my += dt * dt * 300;
            ctx.globalAlpha = 1 - dt / 1.2;
          }
          ctx.save();
          ctx.translate(mx, my);
          if (!z.alive) ctx.rotate(2.6);
          const flap = Math.sin(game.t * 60);
          ctx.fillStyle = 'rgba(210,230,240,0.55)';
          ctx.strokeStyle = 'rgba(120,140,160,0.7)';
          ctx.lineWidth = 0.8;
          for (const s of [-1, 1]) {
            ell(ctx, 2, -8, 11, 3.5 + flap * 1.5, s * 0.5 - 0.3);
            ctx.fill();
            ctx.stroke();
          }
          ctx.strokeStyle = '#3b3030';
          ctx.lineWidth = 1.1;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-2 + i * 4, 2);
            ctx.lineTo(-8 + i * 5, 14);
            ctx.lineTo(-10 + i * 5, 20);
            ctx.stroke();
          }
          ctx.fillStyle = '#4a3c38';
          ell(ctx, 6, -1, 13, 4.5, -0.15);
          ctx.fill();
          ctx.fillStyle = '#6b5550';
          for (let i = 0; i < 3; i++) {
            ell(ctx, 10 - i * 5, -1.5, 1.2, 3.8, -0.15);
            ctx.fill();
          }
          ctx.fillStyle = '#3a2d2a';
          ell(ctx, -8, 0, 5, 5);
          ctx.fill();
          ctx.fillStyle = '#d23a3a';
          ell(ctx, -9.5, -1, 2, 2);
          ctx.fill();
          ctx.strokeStyle = '#2a201e';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(-12, 2);
          ctx.lineTo(-20, 10);
          ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case 'cream': {
          if (z.t < 0 || z.done) break;
          const p = z.p;
          const top = p.base + p.h;
          const k = clamp(z.t / z.fall, 0, 1);
          const wy = top + 560 * (1 - k * k);
          const bx = this.X(p.x);
          const byy = this.Y(wy);
          ctx.fillStyle = `rgba(60,40,40,${0.1 + 0.3 * k})`;
          ell(ctx, bx, this.Y(p.base) + 2, 10 + 22 * k, 3 + 2 * k);
          ctx.fill();
          ctx.fillStyle = '#fbfaf6';
          ctx.strokeStyle = 'rgba(160,170,190,0.8)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx, byy - 30);
          ctx.quadraticCurveTo(bx + 16, byy - 6, bx + 12, byy + 4);
          ctx.quadraticCurveTo(bx, byy + 14, bx - 12, byy + 4);
          ctx.quadraticCurveTo(bx - 16, byy - 6, bx, byy - 30);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,1)';
          ell(ctx, bx - 4, byy - 6, 3, 5, 0.3);
          ctx.fill();
          ctx.fillStyle = '#6fb3d9';
          ctx.font = `600 7px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText('CREAM', bx, byy + 3);
          break;
        }
      }
    }
  }

  drawPickups(ctx, game, t) {
    for (const k of game.course.pickups) {
      if (k.got) continue;
      const sx = this.X(k.x);
      if (sx < -40 || sx > this.viewW + 40) continue;
      const sy = this.Y(k.y + Math.sin(t * 3 + k.x) * 6);
      const info = MUTATION_INFO[k.kind];
      const col = rgb(info.color);
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 34);
      g.addColorStop(0, css(col, 0.7));
      g.addColorStop(1, css(col, 0));
      ctx.fillStyle = g;
      ell(ctx, sx, sy, 34, 34);
      ctx.fill();
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(t * 2 + k.x) * 0.5);
      ctx.strokeStyle = css(col, 0.9);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-14, -3 + i * 3);
        ctx.quadraticCurveTo(-20, -6 + i * 3 + Math.sin(t * 12 + i) * 3, -26, -2 + i * 3);
        ctx.stroke();
      }
      roundRect(ctx, -14, -7, 28, 14, 7);
      ctx.fillStyle = css(lerp3(col, [255, 255, 255], 0.4));
      ctx.fill();
      ctx.strokeStyle = css(lerp3(col, [0, 0, 0], 0.35));
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = css(lerp3(col, [0, 0, 0], 0.45));
      ctx.font = `700 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.name.split(' ')[0].toUpperCase().slice(0, 5), 0, 0.5);
      ctx.restore();
    }
    for (const gb of game.gooBlobs) {
      if (gb.got) continue;
      const sx = this.X(gb.x);
      if (sx < -20 || sx > this.viewW + 20) continue;
      const sy = this.Y(gb.y + Math.sin(t * 4 + gb.bob) * 4);
      ctx.fillStyle = '#ffe36e';
      ctx.strokeStyle = '#d8a72a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 10);
      ctx.quadraticCurveTo(sx + 8, sy - 1, sx + 6, sy + 4);
      ctx.quadraticCurveTo(sx, sy + 9, sx - 6, sy + 4);
      ctx.quadraticCurveTo(sx - 8, sy - 1, sx, sy - 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fffbe0';
      ell(ctx, sx - 2, sy - 1, 1.6, 2.4);
      ctx.fill();
    }
  }

  drawGhost(ctx, game) {
    const f = game.ghost && game.ghost.frames;
    if (!f || game.dead) return;
    const i = Math.floor(game.t * 30) * 2;
    if (i + 1 >= f.length) return;
    const gx = f[i];
    const gy = f[i + 1];
    const sx = this.X(gx);
    if (sx < -60 || sx > this.viewW + 60) return;
    ctx.save();
    ctx.translate(sx, this.Y(gy));
    drawDex(ctx, { skin: skinById('classic'), ghost: true, alpha: 0.4, legPhase: game.t * 30 });
    ctx.restore();
    ctx.fillStyle = 'rgba(80,120,200,0.75)';
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('YOUR BEST', sx, this.Y(gy) - 34);
  }

  drawDexNow(ctx, game) {
    const d = game.dex;
    const X = this.X(d.x);
    const Y = this.Y(d.y);
    // shadow on the skin
    const gy = game.surfaceAt(d.x).y;
    const hAbove = Math.max(0, d.y - gy);
    ctx.fillStyle = `rgba(60,30,20,${0.25 * clamp(1 - hAbove / 400, 0.2, 1)})`;
    ell(ctx, X, this.Y(gy) + 1, 16 * clamp(1 - hAbove / 600, 0.4, 1), 3);
    ctx.fill();

    let angle = 0;
    let squash = d.squash * 0.8;
    let look = 0;
    if (game.dead) {
      angle = Math.min(3.14, game.deathT * 8);
      squash = 0.6;
    } else if (d.stuck) {
      squash = d.stuck.kind === 'cyst' ? 0.3 + d.stuck.charge * 0.5 : 0.5;
      look = -0.5;
    } else if (d.slamming) {
      angle = 0.45;
      squash = -0.45;
      look = -1;
    } else if (!d.grounded) {
      angle = -clamp(d.vy / 1500, -0.5, 0.55);
      squash = -clamp(Math.abs(d.vy) / 2500, 0, 0.25);
      look = clamp(d.vy / 600, -1, 1);
    }
    ctx.save();
    ctx.translate(X, Y);
    if (game.invuln > 0 && Math.floor(game.t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    drawDex(ctx, {
      skin: skinById(game.skin), legPhase: d.legPhase, squash, angle, look,
      mut: game.mut && game.mut.kind, t: game.t,
    });
    ctx.restore();

    if (d.stuck && d.stuck.kind === 'cyst') {
      const c = d.stuck.charge;
      const full = c >= 1;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ell(ctx, X, Y - 14, 30, 30);
      ctx.stroke();
      ctx.strokeStyle = full ? '#fff36b' : '#ffffff';
      ctx.beginPath();
      ctx.arc(X, Y - 14, 30, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2);
      ctx.stroke();
      if (full) {
        ctx.fillStyle = '#fff36b';
        ctx.font = `700 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('LET GO!', X, Y - 52);
      }
    }
  }

  drawParticles(ctx, game) {
    for (const s of game.shots) {
      const x = this.X(s.x);
      const y = this.Y(s.y);
      const a = Math.atan2(-s.vy, s.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,236,150,0.45)';
      ell(ctx, -s.r * 1.6, 0, s.r * 2.2, s.r * 0.7);
      ctx.fill();
      ctx.fillStyle = '#ffe680';
      ctx.strokeStyle = '#d8a72a';
      ctx.lineWidth = 1.2;
      ell(ctx, 0, 0, s.r * 1.25, s.r);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fffbe0';
      ell(ctx, s.r * 0.3, -s.r * 0.35, s.r * 0.35, s.r * 0.25);
      ctx.fill();
      ctx.restore();
    }
    for (const p of game.particles) {
      ctx.globalAlpha = p.puff ? clamp(p.life * 2, 0, 1) : 1;
      ctx.fillStyle = p.color;
      ell(ctx, this.X(p.x), this.Y(p.y), p.r, p.r);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFoam(ctx, game) {
    const vh = this.viewH;
    const fx = this.X(game.foamX);
    const t = game.t;
    if (fx < -40) {
      // Off-screen: a faint mist at the left edge, stronger as it nears.
      const gap = game.foamGap;
      const a = clamp(1 - (gap - this.viewW * this.dexX) / 420, 0, 0.8);
      if (a > 0.02) {
        const g = ctx.createLinearGradient(0, 0, 40, 0);
        g.addColorStop(0, `rgba(235,246,255,${a * 0.7})`);
        g.addColorStop(1, 'rgba(235,246,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, 60, vh + 40);
        for (let i = 0; i < 10; i++) {
          const h = hash32(i * 53 + 11);
          const r = 4 + (h % 9);
          const y = ((h >>> 6) % 1000) / 1000 * vh;
          const bx = -r * 0.4 + Math.sin(t * 3 + i) * 2 + a * 10;
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ell(ctx, bx, y, r, r);
          ctx.fill();
          ctx.strokeStyle = `rgba(140,190,230,${a * 0.6})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      return;
    }
    const edge = (y) => fx + Math.sin(y * 0.045 + t * 4) * 9 + Math.sin(y * 0.12 - t * 6) * 5;
    const g = ctx.createLinearGradient(fx - 220, 0, fx, 0);
    g.addColorStop(0, '#d6eafc');
    g.addColorStop(1, '#f7fbff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-40, -20);
    for (let y = -20; y <= vh + 20; y += 14) ctx.lineTo(edge(y), y);
    ctx.lineTo(-40, vh + 20);
    ctx.closePath();
    ctx.fill();
    // bubbles along the edge
    for (let i = 0; i < 26; i++) {
      const h = hash32(i * 101);
      const y = ((h % 1000) / 1000) * (vh + 40) - 20;
      const r = 8 + (h >>> 10) % 18;
      const wob = Math.sin(t * (2 + (h % 5)) + i) * 3;
      const bx = edge(y) - r * 0.5 + wob;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ell(ctx, bx, y, r + wob * 0.3, r);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,190,230,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(190,225,255,0.9)';
      ell(ctx, bx - r * 0.35, y - r * 0.35, r * 0.22, r * 0.16, -0.5);
      ctx.fill();
    }
    // rising bubbles inside
    ctx.strokeStyle = 'rgba(150,195,235,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const h = hash32(i * 977 + 3);
      const r = 3 + (h % 6);
      const y = vh + 20 - ((t * (40 + (h % 50)) + (h % 700)) % (vh + 60));
      const bx = fx - 20 - ((h >>> 8) % 200);
      ell(ctx, bx, y, r, r);
      ctx.stroke();
    }
  }

  drawWorldTexts(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const tx of game.texts) {
      const k = tx.t / tx.life;
      const pop = tx.t < 0.08 ? 0.6 + tx.t * 5 : 1;
      ctx.globalAlpha = clamp(1.6 - k * 1.6, 0, 1);
      ctx.font = `700 ${tx.size * pop}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(90,30,30,0.6)';
      // drift along with the camera a little so texts stay readable
      // keep the whole word on screen
      const half = ctx.measureText(tx.text).width / 2 + 4;
      const x = clamp(this.X(tx.x + (game.dex.x - tx.dx0) * 0.65), half, this.viewW - half);
      const y = this.Y(tx.y);
      ctx.strokeText(tx.text, x, y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // ───────────────────────────── screen space ─────────────────────────────

  drawSplats(ctx, game) {
    const m = Math.min(this.W, this.H);
    for (const s of game.splats) {
      const a = clamp(s.life / 1, 0, 1) * 0.88;
      const x = s.x * this.W;
      const y = s.y * this.H;
      const r = s.r * m;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#f2d24c';
      ell(ctx, x, y, r, r * 0.9);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const h = hash32(Math.floor(s.seed) + i * 17);
        const ang = (h % 628) / 100;
        const d = r * (0.8 + (h >>> 9) % 50 / 100);
        const rr = r * (0.22 + (h >>> 3) % 25 / 100);
        ell(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr, rr);
        ctx.fill();
      }
      const drip = (1 - s.life / s.max) * r * 1.5;
      roundRect(ctx, x - r * 0.15, y, r * 0.3, r * 0.6 + drip, r * 0.15);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,210,0.8)';
      ell(ctx, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.16, -0.6);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  hudText(ctx, text, x, y, size, color, align = 'left', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.15);
    ctx.strokeStyle = 'rgba(110,40,40,0.45)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawHud(ctx, game, pulse) {
    const W = this.W;
    const H = this.H;
    const s = this.safe;
    const top = s.top + 14;
    const left = s.left + 16;
    const right = W - s.right - 16;

    // score + distance
    this.hudText(ctx, game.score.toLocaleString('en-US'), left, top + 28, 30, '#ffffff', 'left', 700);
    this.hudText(ctx, `${Math.floor(game.distance).toLocaleString('en-US')} mm`, left, top + 48, 14, 'rgba(255,255,255,0.92)', 'left', 600);
    if (game.ghost && game.ghost.score) {
      this.hudText(ctx, `Today's best ${game.ghost.score.toLocaleString('en-US')}`, left, top + 66, 12, 'rgba(230,240,255,0.95)', 'left', 600);
    }

    // foam gauge
    const gy = top + (game.ghost ? 78 : 60);
    const gw = 112;
    const danger = clamp(1 - game.foamGap / FOAM_MAX_GAP, 0, 1);
    roundRect(ctx, left, gy, gw, 10, 5);
    ctx.fillStyle = 'rgba(60,30,30,0.3)';
    ctx.fill();
    const col = danger > 0.7 ? '#ff5a5a' : danger > 0.45 ? '#ffc04d' : '#bfe6ff';
    roundRect(ctx, left, gy, Math.max(10, gw * danger), 10, 5);
    ctx.fillStyle = col;
    ctx.fill();
    this.hudText(ctx, 'FOAM', left + gw + 8, gy + 9, 11, danger > 0.7 ? '#ffd0d0' : 'rgba(255,255,255,0.9)', 'left', 700);

    // goo (left of the pause button)
    const gooX = right - 52;
    this.hudText(ctx, `${game.gooEarned}`, gooX, top + 24, 20, '#fff2a8', 'right', 700);
    ctx.fillStyle = '#ffe36e';
    ctx.strokeStyle = '#c9961f';
    ctx.lineWidth = 1.5;
    const bx = gooX - ctx.measureText(`${game.gooEarned}`).width - 14;
    ctx.beginPath();
    ctx.moveTo(bx, top + 8);
    ctx.quadraticCurveTo(bx + 8, top + 18, bx + 6, top + 22);
    ctx.quadraticCurveTo(bx, top + 28, bx - 6, top + 22);
    ctx.quadraticCurveTo(bx - 8, top + 18, bx, top + 8);
    ctx.fill();
    ctx.stroke();

    // streak
    const cx = W / 2;
    if (game.streak > 0) {
      const mult = game.multiplier;
      const colr = mult >= 4 ? '#ff7ad9' : mult >= 3 ? '#ffb84d' : mult >= 2 ? '#fff36b' : '#ffffff';
      this.hudText(ctx, `${game.streak} STREAK${mult > 1 ? `  ×${mult}` : ''}`, cx, top + 30, 20, colr, 'center', 700);
    }

    // mutation chip
    if (game.mut) {
      const info = MUTATION_INFO[game.mut.kind];
      const w = 150;
      const y = top + 74;
      roundRect(ctx, cx - w / 2, y, w, 22, 11);
      ctx.fillStyle = 'rgba(40,20,30,0.45)';
      ctx.fill();
      roundRect(ctx, cx - w / 2, y, w * clamp(game.mut.t / MUTATION_TIME, 0, 1), 22, 11);
      ctx.fillStyle = info.color;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      this.hudText(ctx, info.name.toUpperCase(), cx, y + 16, 13, '#ffffff', 'center', 700);
    }

    // biome banner
    if (game.banner) {
      const b = game.banner;
      const a = clamp(Math.min(b.t / 0.3, (3 - b.t) / 0.5), 0, 1);
      ctx.globalAlpha = a;
      const y = H * 0.27;
      this.hudText(ctx, b.title, cx, y, 40, '#ffffff', 'center', 700);
      this.hudText(ctx, b.sub, cx, y + 26, 15, 'rgba(255,255,255,0.95)', 'center', 600);
      ctx.globalAlpha = 1;
    }

    // big centre texts (streak tiers, mutations)
    let by = H * 0.4;
    for (const bt of game.bigTexts) {
      const k = bt.t / bt.life;
      const a = clamp(Math.min(bt.t / 0.1, (1 - k) / 0.25), 0, 1);
      const sc = bt.t < 0.12 ? 0.7 + bt.t * 2.5 : 1;
      ctx.globalAlpha = a;
      this.hudText(ctx, bt.text, cx, by, 34 * sc, bt.color, 'center', 700);
      if (bt.sub) this.hudText(ctx, bt.sub, cx, by + 24, 15, '#ffffff', 'center', 600);
      ctx.globalAlpha = 1;
      by += bt.sub ? 60 : 44;
    }

    // tutorial hint
    if (game.hint) {
      ctx.font = `600 17px ${FONT}`;
      const tw = ctx.measureText(game.hint).width;
      const w = Math.min(W - 32, tw + 36);
      const y = H - s.bottom - 92;
      roundRect(ctx, cx - w / 2, y, w, 40, 20);
      ctx.fillStyle = 'rgba(60,25,35,0.62)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(game.hint, cx, y + 21, W - 48);
    }
  }
}

