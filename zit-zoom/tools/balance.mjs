// Balance check: runs the bot through the real simulation with human-like
// tap error and reports how long runs last and what ends them.
//
//   node tools/balance.mjs            # 40 seeds, σ = 15 / 30 / 45 ms
//   node tools/balance.mjs 100 0.03   # 100 seeds, σ = 30 ms only
//
// The bot is a proxy, not a player: it reads hazards by formula, so treat
// the numbers as relative (before vs. after a tuning change), not absolute.

import { Game } from '../js/game.js';

const seeds = Number(process.argv[2] || 40);
const errors = process.argv[3] ? [Number(process.argv[3])] : [0.015, 0.03, 0.045];

for (const botError of errors) {
  const rows = [];
  for (let s = 1; s <= seeds; s++) {
    const g = new Game({ seed: s * 7919, autoplay: true, flags: {}, botError });
    let misses = 0;
    const miss = g.miss.bind(g);
    g.miss = () => { misses++; miss(); };
    while (!g.ended && g.t < 400) g.update(1 / 60);
    rows.push({ ...g.result(), misses });
  }
  const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const median = [...rows].sort((a, b) => a.time - b.time)[Math.floor(rows.length / 2)].time;
  const causes = {};
  for (const r of rows) causes[r.cause || 'alive'] = (causes[r.cause || 'alive'] || 0) + 1;
  console.log(
    `σ=${Math.round(botError * 1000)} ms  median ${median.toFixed(0)} s  ` +
    `Perfects ${(100 * avg('perfects') / Math.max(1, avg('pops'))).toFixed(0)}%  ` +
    `best streak ${avg('maxStreak').toFixed(1)}  misses/min ${(avg('misses') / avg('time') * 60).toFixed(1)}  ` +
    `ended by ${JSON.stringify(causes)}`,
  );
}
