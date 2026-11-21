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
| Core loop | Auto-run, tap = jump, tap in air = ground-pound (fixed 0.09 s drop so it's easy to time), hold on cysts |
| Pop timing | Global throb at ≈143 BPM: pimples pulse, the HUD light pulses, an approach ring closes on the next target. Perfect ±50 ms, Great ±105 ms, same size all game |
| Landing position | Front edge = flat and fast, back edge = high but slower |
| Ripeness | Red (bump, no pop) → whitehead → overripe (mega launch + screen splatter). Ripening starts as pimples approach, so your speed decides what you arrive at |
| Streak | ×2 at 5, ×3 at 10, ×4 at 20; Great keeps the streak, OK and Miss reset it |
| Foam wall | Speeds up over the run; your speed pushes it back; gauge in the HUD |
| Pimple types | Whitehead, Blackhead, Cluster (+ bonus for all 3), Cyst (hold, release at full charge, over-hold penalty), Zit Volcano (airborne Goo section) |
| Hazards | Tweezers (shadow tell, they aim at your arrival time), fringe and hair forest, ingrown hairs, mosquitoes (stomp them), acne cream, sweat (misses cost double) |
| Mutations | Hard Shell, Wings, Sticky Legs, Spore Cloud, each 10 s with its catch. Unlocked by reaching biomes (Skin Charts aren't built yet) |
| World | Forehead → Nose → Chin → Back → Armpit, then loops with a new skin tone |
| Modes | Endless; Daily Pop (same course for everyone from the UTC date, best score per day, ghost of your best run) |
| Economy | Goo from pops; a fixed, finishable skin collection (8) with two earn-only prestige skins. No real-money purchases in the PoC |
| Feel | Slow-mo flash, screen shake, goo particles and decals, synthesised Web Audio sounds, haptics |

**Not in the PoC yet:** bosses (Pore Strip, Magnifying Mirror, Washcloth), Skin Charts, Game Center leaderboards and achievements, StoreKit, iCloud sync and clip sharing. Scores and saves live in `localStorage` on the device.

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

- Timing windows (`PERFECT_WIN`, `GREAT_WIN`, `BEAT` in `js/game.js`): do misses feel like your own fault?
- Launch-angle split: is the front vs. back edge choice readable and worth making?
- Foam pressure (`FOAM_BASE`, `FOAM_RAMP`) vs. speed economy (`DECAY_*`, Perfect/Great speed bonus).
- Portrait vs. landscape: both work here. Portrait zooms in and moves Dex left to keep the look-ahead.
- Gross-out level: currently cartoony goo, no realism.
