// App shell: screens, input, persistence, the frame loop.

import { Game, DEATH_INFO, MUTATION_INFO } from './game.js';
import { MUTATIONS, BIOMES } from './course.js';
import { Renderer, FONT } from './render.js';
import { Sound } from './audio.js';
import { Haptics } from './feel.js';
import { loadSave, writeSave, pruneDaily } from './store.js';
import { dailySeed, utcDateKey } from './rng.js';
import { SKINS, skinById, drawDex } from './skins.js';

const $ = (sel) => document.querySelector(sel);

const save = loadSave();
const sound = new Sound();
sound.enabled = save.sound;
const haptics = new Haptics();
haptics.enabled = save.haptics;
const renderer = new Renderer($('#game'));

/** 'menu' | 'playing' | 'paused' | 'over' | 'skins' | 'help' */
let state = 'menu';
let game = null;
let lastMode = 'endless';
let lastResult = null;
let demo = makeDemo();

function makeDemo() {
  return new Game({
    mode: 'demo',
    seed: (Math.random() * 2 ** 32) >>> 0,
    autoplay: true,
    skin: save.skin,
    flags: { jumped: true, popped: true, perfect: true },
  });
}

function unlockedMutations() {
  return MUTATIONS.filter((k) => save.maxBiome >= MUTATION_INFO[k].unlock);
}

function formatDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ───────────────────────────── screens ─────────────────────────────

const SCREENS = ['menu', 'over', 'paused', 'skins', 'help'];

function show(name) {
  for (const s of SCREENS) $(`#screen-${s}`).classList.toggle('hidden', s !== name);
  $('#pause-btn').classList.toggle('hidden', name !== null);
  const focus = name && $(`#screen-${name} .btn.primary`);
  if (focus && matchMedia('(hover: hover)').matches) focus.focus({ preventScroll: true });
}

function refreshMenu() {
  const key = utcDateKey();
  const day = save.daily[key];
  $('#best-endless').textContent = save.bestEndless ? `Best ${save.bestEndless.toLocaleString('en-US')}` : 'New run';
  $('#daily-label').textContent = `${formatDay(key)}${day && day.best ? ` · best ${day.best.toLocaleString('en-US')}` : ''}`;
  $('#skins-count').textContent = `${save.owned.length} / ${SKINS.length}`;
  $('#goo-total').textContent = save.goo.toLocaleString('en-US');
  $('#sound-toggle').setAttribute('aria-pressed', String(save.sound));
  $('#haptics-toggle').setAttribute('aria-pressed', String(save.haptics));
}

function goMenu() {
  state = 'menu';
  game = null;
  demo = makeDemo();
  refreshMenu();
  show('menu');
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2200);
}

// ───────────────────────────── runs ─────────────────────────────

function startRun(mode) {
  lastMode = mode;
  const dateKey = utcDateKey();
  const day = save.daily[dateKey];
  const seed = mode === 'daily' ? dailySeed(dateKey) : crypto.getRandomValues(new Uint32Array(1))[0];
  game = new Game({
    mode,
    seed,
    // Daily Pop: every mutation is in play so the course is the same for everyone.
    mutationKinds: mode === 'daily' ? MUTATIONS : unlockedMutations(),
    audio: sound,
    feel: haptics,
    ghost: mode === 'daily' && day && day.ghost ? { frames: day.ghost, score: day.best } : null,
    flags: save.flags,
    skin: save.skin,
    onEnd: (res) => finishRun(res, mode, dateKey),
  });
  state = 'playing';
  show(null);
}

function finishRun(res, mode, dateKey) {
  lastResult = res;
  save.runs++;
  save.goo += res.goo;
  save.bestStreak = Math.max(save.bestStreak, res.maxStreak);
  const unlocks = [];

  const prevBiome = save.maxBiome;
  save.maxBiome = Math.max(save.maxBiome, res.maxBiome);
  for (const k of MUTATIONS) {
    const u = MUTATION_INFO[k].unlock;
    if (u > prevBiome && u <= save.maxBiome) unlocks.push(`New mutation unlocked: ${MUTATION_INFO[k].name}`);
  }
  if (res.maxBiome > prevBiome && res.maxBiome < BIOMES.length) unlocks.push(`New biome reached: ${BIOMES[res.maxBiome].name}`);
  if (res.maxStreak >= 20 && !save.owned.includes('golden')) {
    save.owned.push('golden');
    unlocks.push('Earn-only skin: Golden Pus');
  }

  let best;
  let isNew;
  if (mode === 'daily') {
    const day = save.daily[dateKey] || (save.daily[dateKey] = { best: 0, attempts: 0, ghost: null });
    day.attempts++;
    isNew = res.score > day.best;
    if (isNew) {
      day.best = res.score;
      day.ghost = res.frames;
    }
    best = day.best;
    pruneDaily(save);
  } else {
    isNew = res.score > save.bestEndless;
    if (isNew) save.bestEndless = res.score;
    best = save.bestEndless;
  }
  writeSave(save);

  const info = DEATH_INFO[res.cause] || DEATH_INFO.foam;
  $('#over-title').textContent = info.title;
  $('#over-sub').textContent = info.sub;
  $('#over-score').textContent = res.score.toLocaleString('en-US');
  const bestEl = $('#over-best');
  bestEl.textContent = '';
  if (isNew && res.score > 0) {
    const tag = document.createElement('span');
    tag.className = 'new';
    tag.textContent = 'NEW BEST';
    bestEl.append(tag);
  }
  bestEl.append(mode === 'daily' ? `Daily Pop ${formatDay(dateKey)} · best ${best.toLocaleString('en-US')}` : `Endless · best ${best.toLocaleString('en-US')}`);

  const stats = $('#over-stats');
  stats.textContent = '';
  const biomeName = BIOMES[res.maxBiome % BIOMES.length].name + (res.maxBiome >= BIOMES.length ? ` (loop ${Math.floor(res.maxBiome / BIOMES.length) + 1})` : '');
  for (const [k, v] of [
    ['Perfects', res.perfects],
    ['Best streak', res.maxStreak],
    ['Distance', `${res.distance.toLocaleString('en-US')} mm`],
    ['Reached', biomeName],
    ['Goo earned', `+${res.goo}`],
    ['Goo total', save.goo.toLocaleString('en-US')],
  ]) {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = String(v);
    div.append(dt, dd);
    stats.append(div);
  }
  const ul = $('#over-unlocks');
  ul.textContent = '';
  for (const u of unlocks) {
    const li = document.createElement('li');
    li.textContent = u;
    ul.append(li);
  }
  state = 'over';
  show('over');
}

async function share() {
  if (!lastResult) return;
  const r = lastResult;
  const what = r.mode === 'daily' ? `today's Daily Pop (${formatDay(utcDateKey())})` : 'Endless';
  const text = `I scored ${r.score.toLocaleString('en-US')} in ${what} on Zit Zoom: ${r.perfects} Perfects, best streak ${r.maxStreak}. Beat that!`;
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Zit Zoom', text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Copied to the clipboard');
  } catch {
    /* share sheet dismissed */
  }
}

function pause() {
  if (state !== 'playing') return;
  game.paused = true;
  game.release();
  state = 'paused';
  show('paused');
}

function resume() {
  if (state !== 'paused') return;
  game.paused = false;
  state = 'playing';
  show(null);
  lastFrame = performance.now();
}

// ───────────────────────────── skins ─────────────────────────────

function checkCollection() {
  const others = SKINS.filter((s) => s.id !== 'fullypopped');
  if (!save.owned.includes('fullypopped') && others.every((s) => save.owned.includes(s.id))) {
    save.owned.push('fullypopped');
    toast('Fully Popped! The whole collection is yours.');
  }
}

function renderSkins() {
  const grid = $('#skin-grid');
  grid.textContent = '';
  for (const s of SKINS) {
    const owned = save.owned.includes(s.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skin-card';
    if (save.skin === s.id) btn.classList.add('equipped');
    if (!owned) btn.classList.add('locked');
    if (!owned && !s.earn) btn.classList.add('price');
    const cnv = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cnv.width = 120 * dpr;
    cnv.height = 66 * dpr;
    const cx = cnv.getContext('2d');
    cx.setTransform(dpr * 1.55, 0, 0, dpr * 1.55, 62 * dpr, 52 * dpr);
    drawDex(cx, { skin: s, legPhase: 1, t: 0.4 });
    const name = document.createElement('b');
    name.textContent = s.name;
    const status = document.createElement('span');
    status.textContent = save.skin === s.id ? 'Equipped' : owned ? 'Tap to wear' : s.earn ? s.desc : `${s.price} goo`;
    btn.append(cnv, name, status);
    btn.addEventListener('click', () => {
      sound.ui();
      if (owned) {
        save.skin = s.id;
      } else if (s.earn) {
        toast(s.desc);
        return;
      } else if (save.goo >= s.price) {
        save.goo -= s.price;
        save.owned.push(s.id);
        save.skin = s.id;
        toast(`${s.name} unlocked`);
        checkCollection();
      } else {
        toast(`You need ${s.price - save.goo} more goo`);
        return;
      }
      writeSave(save);
      demo.skin = save.skin;
      renderSkins();
    });
    grid.append(btn);
  }
  $('#skins-goo').textContent = save.goo.toLocaleString('en-US');
  $('#collection-line').textContent = `Collection ${save.owned.length} / ${SKINS.length} · nothing is time-limited, nothing leaves`;
}

// ───────────────────────────── input ─────────────────────────────

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  sound.unlock();
  sound.ui();
  switch (btn.dataset.action) {
    case 'endless': startRun('endless'); break;
    case 'daily': startRun('daily'); break;
    case 'retry': startRun(lastMode); break;
    case 'menu': goMenu(); break;
    case 'skins': state = 'skins'; renderSkins(); show('skins'); break;
    case 'help': state = 'help'; show('help'); break;
    case 'resume': resume(); break;
    case 'quit': goMenu(); break;
    case 'share': share(); break;
  }
});

$('#sound-toggle').addEventListener('click', () => {
  save.sound = !save.sound;
  sound.enabled = save.sound;
  writeSave(save);
  refreshMenu();
});
$('#haptics-toggle').addEventListener('click', () => {
  save.haptics = !save.haptics;
  haptics.enabled = save.haptics;
  writeSave(save);
  refreshMenu();
  if (save.haptics) haptics.pulse('medium');
});
$('#pause-btn').addEventListener('pointerdown', (e) => e.stopPropagation());
$('#pause-btn').addEventListener('click', pause);

const activePointers = new Set();
const canvas = $('#game');
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'playing') return;
  e.preventDefault();
  sound.unlock();
  activePointers.add(e.pointerId);
  game.press();
});
const pointerEnd = (e) => {
  if (!activePointers.delete(e.pointerId)) return;
  if (state === 'playing' && activePointers.size === 0) game.release();
};
window.addEventListener('pointerup', pointerEnd);
window.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const TAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    return;
  }
  if (!TAP_KEYS.has(e.code)) return;
  if (state === 'playing') {
    e.preventDefault();
    if (e.repeat) return;
    sound.unlock();
    game.press();
  } else if (state === 'over' && e.code === 'Space') {
    e.preventDefault();
    sound.unlock();
    startRun(lastMode);
  }
});
window.addEventListener('keyup', (e) => {
  if (TAP_KEYS.has(e.code) && state === 'playing') game.release();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);
document.addEventListener('touchmove', (e) => { if (state === 'playing') e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('resize', () => renderer.resize());

// ───────────────────────────── loop ─────────────────────────────

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  let shown;
  if (state === 'playing' || state === 'over' || state === 'paused') {
    if (state !== 'paused') game.update(dt);
    shown = game;
  } else {
    demo.update(dt);
    if (demo.dead && demo.deathT > 1) demo = makeDemo();
    shown = demo;
  }
  renderer.draw(shown, state === 'paused' ? 0 : dt, { hud: state === 'playing' || state === 'paused' });
  requestAnimationFrame(frame);
}

// Debug/test hook (harmless in production): lets automated checks drive the game.
window.__zz = { get game() { return game; }, get state() { return state; }, save, startRun };

refreshMenu();
show('menu');
document.fonts.load(`700 20px ${FONT}`).finally(() => requestAnimationFrame(frame));
