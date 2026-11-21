# Zit Zoom: browser proof of concept

A playable browser version of the Zit Zoom GDD (21 Nov 2026), built to test the biggest risk first: **does the pop feel good?**

It's a static site with no build step, no dependencies, no backend and no third-party requests. Plain ES modules and Canvas 2D.

## Run locally

```bash
cd zit-zoom
python3 -m http.server 8000   # any static server works; ES modules need http://, not file://
# open http://localhost:8000
```

Tests (Node 20+): `node --test tests/*.test.mjs`

## Deploy to Netlify

Create a **new** Netlify site from this repository with:

| Setting | Value |
| --- | --- |
| Base directory | `zit-zoom` |
| Build command | *(read from `zit-zoom/netlify.toml`, nothing to build)* |
| Publish directory | `zit-zoom` |

`zit-zoom/netlify.toml` sets security headers and skips deploys when nothing in this folder changed. The thisCounts site at the repo root is unaffected. You can also drag the `zit-zoom` folder onto Netlify Drop.

## What's in the prototype

| GDD area | In the browser PoC |
| --- | --- |
| Core loop | Auto-run, tap = jump, tap in air = slam straight down (no drift), hold on cysts. A marker under Dex shows exactly where a slam lands: gold = head |
| Pop grading | **Aim, not a beat** (changed after the first playtest, see below): head = Perfect, dome = Great, rim = OK. Zones never shrink; difficulty comes from speed |
| Terrain | Fields of 3–6 pimples so every launch passes over several: you pick your landing. Gaps between fields hold spikes, hair or a mosquito |
| Landing position | Missing the head tilts the launch: back edge = higher, front edge = faster |
| Ripeness | Fixed per pimple and visible from afar: red (don't land), white, yellow (mega launch + screen splatter). The pad before hair is always yellow |
| Streak | ×2 at 5, ×3 at 10, ×4 at 20; Great keeps the streak, OK and Miss reset it |
| Foam wall | Speeds up over the run; your speed pushes it back; gauge in the HUD |
| Pimple types | Whitehead, Blackhead, Cluster (+ bonus for all 3), Cyst (hold, release at full charge, over-hold penalty), Zit Volcano (airborne Goo section) |
| Opening | Hand-built first ~14 s: one new idea per group of pimples (skip a red one, first bacterium at ~5 s, mosquito bounce, hair + yellow pad, spike gap, tweezers). A short hint explains each new thing the first time it scrolls into view |
| Bacteria | Crawl over the skin towards you and eat the first pimple they reach. Land on them (squash = bounce, counts like a Perfect); walk into them and the run ends |
| Goo spray | Perfects and yellow pops spray goo a short way ahead: it knocks out bacteria and mosquitoes, gums tweezers shut for 3.5 s and blocks falling cream |
| Hazards | Tweezers snapping on a loop over one pimple (shadow tell; only dangerous at skin level), fringe and hair forest, ingrown-hair spikes in gaps, mosquitoes (land on them to bounce; touching from below knocks you down), acne cream racing you to a pimple, sweat (misses cost double) |
| Mutations | Hard Shell, Wings, Sticky Legs, Spore Cloud, each 10 s with its catch. Unlocked by reaching biomes (Skin Charts aren't built yet) |
| World | Forehead → Nose → Chin → Back → Armpit, then loops with a new skin tone |
| Modes | Endless; Daily Pop (same course for everyone from the UTC date, best score per day, ghost of your best run) |
| Economy | Goo from pops; a fixed, finishable skin collection (8) with two earn-only prestige skins. No real-money purchases in the PoC |
| Feel | Slow-mo flash, screen shake, goo particles and decals, synthesised Web Audio sounds, haptics |

**Not in the PoC yet:** bosses (Pore Strip, Magnifying Mirror, Washcloth), Skin Charts, Game Center leaderboards and achievements, StoreKit, iCloud sync and clip sharing. Scores and saves live in `localStorage` on the device.

## Changed after playtest 1

Feedback: timing was too hard, chaining pops felt impossible, and it played like a pimple-popper simulator rather than a game.

| Was | Now | Why |
| --- | --- | --- |
| Perfect = land on a global beat (±50 ms) while also being over the pimple | Perfect = slam onto the head; a marker shows where you'll land | Two constraints at once made many Perfects impossible; the beat was abstract |
| Ground-pound drifted forward | Slam drops straight down | Where you tap is where you land |
| One pimple at a time, random spacing | Fields of 3–6 pimples under every arc | Chaining is always possible; picking a target is the decision |
| Ripeness changed over time | Fixed, readable colours | Lets you plan a route |
| Hazards were mostly obstacles | Hazards change which pimple you pick (tweezers, cream, spikes in gaps, yellow pad before hair, mosquito stepping stones) | Gives the pop mechanic decisions |

### Playtest 2

Feedback: much better, but the game still didn't do enough with the mechanic, made worse by an empty first 15 seconds. Added a hand-built opening, bacteria (moving targets that make you slam to save a pimple), and goo spray, so a Perfect also clears your path. Stomps on mosquitoes and bacteria now count towards the streak.

This departs from the GDD's "pulse" timing. Bot runs with human-like tap error (σ = 30 ms) now last a median of ~40 s, land ~55% Perfects and reach streaks of 10+. The previous design couldn't chain past 1.

## Browser stand-ins for the Apple frameworks

| iOS (GDD) | Browser PoC |
| --- | --- |
| SpriteKit | Canvas 2D, fixed-step simulation at 240 Hz |
| Core Haptics | Vibration API (Android); on iPhone Safari the native `switch` checkbox trick gives a light tick on taps only |
| AVAudioEngine | Web Audio, all sounds synthesised |
| iCloud / CloudKit | `localStorage` |
| Game Center | Local best score per mode and day |

## Code map

| File | What |
| --- | --- |
| `js/rng.js` | Seeded RNG (Mulberry32), string hash, UTC date key → daily seed |
| `js/course.js` | Deterministic course generator: biomes, pimples, hazards, pickups. Decisions use only the RNG and plain arithmetic, so the Daily Pop is identical across browsers |
| `js/game.js` | The simulation: physics, pop grading, foam, hazards, mutations, scoring, attract-mode bot. **All tuning constants are at the top** |
| `js/render.js` | Procedural canvas art, camera, HUD |
| `js/skins.js` | Skin catalogue and the Dex drawing |
| `js/audio.js`, `js/feel.js` | Sound and haptics |
| `js/store.js` | Save data |
| `js/main.js` | Screens, input, frame loop |
| `tests/course.test.mjs` | Determinism and course sanity tests |

## What to look for in playtests

These map to the GDD's open questions:

- Landing zones (`PERFECT_FRAC`, `GREAT_FRAC` in `js/game.js`) and speed (`MAX_SPEED`, Perfect speed bonus): do misses feel like your own fault?
- Launch-angle split: is the front vs. back edge choice readable and worth making?
- Foam pressure (`FOAM_BASE`, `FOAM_RAMP`) vs. speed economy (`DECAY_*`, Perfect/Great speed bonus).
- Portrait vs. landscape: both work here. Portrait zooms in and moves Dex left to keep the look-ahead.
- Gross-out level: currently cartoony goo, no realism.
