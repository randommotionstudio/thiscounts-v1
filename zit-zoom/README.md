# Zit Zoom: browser proof of concept

**Live:** https://zit-zoom.netlify.app (public, no login)

A playable browser version of the Zit Zoom GDD (21 Nov 2026), built to test the biggest risk first: **does the pop feel good?** Two playtest rounds have already reshaped the core loop; see [Changelog](#changelog) and [Differences from the GDD](#differences-from-the-gdd).

It's a static site with no build step, no dependencies, no backend and no third-party requests. Plain ES modules and Canvas 2D.

## Run locally

```bash
cd zit-zoom
python3 -m http.server 8000   # any static server works; ES modules need http://, not file://
# open http://localhost:8000
```

- Tests (Node 20+): `node --test tests/*.test.mjs`
- Balance check: `node tools/balance.mjs`. The bot plays the real simulation with human-like tap error (σ in ms) and reports run length, Perfect rate and what ended each run. Use it to compare before and after a tuning change. It's a proxy, not a player.

## Deployment

The live site is the Netlify project **`zit-zoom`** in the *random motion* team: https://app.netlify.com/projects/zit-zoom

It is deployed by **manual upload** of this folder, not connected to Git, so **pushing does not update the live site**. To publish a change, either:

- re-run a manual deploy of the `zit-zoom` folder (Netlify CLI `netlify deploy --prod` from this folder, or Netlify Drop), or
- link this repository to the project in the Netlify dashboard (continuous deployment settings) with **Base directory = `zit-zoom`** and the production branch of your choice. After that, every push that touches this folder deploys.

`netlify.toml` here sets security headers (including a strict Content-Security-Policy) and skips Git-triggered deploys when nothing in this folder changed. The thisCounts site at the repo root is a separate Netlify project and is unaffected.

## How it plays

| Area | In the browser PoC |
| --- | --- |
| Controls | Auto-run. Tap = jump; tap in the air = slam straight down (no forward drift); hold on cysts and with Sticky Legs. Keyboard: Space / ↑ / W, P or Esc to pause |
| Aiming | A marker under Dex shows exactly where a slam lands: **gold** = the head (Perfect), white = dome (Great), orange = rim (OK), **red ✕** = danger (spikes, hair, snapping tweezers), green = something to stomp |
| Pop grading | Head = Perfect, dome = Great, rim = OK. The drawn white head is exactly the Perfect zone. Zones never shrink; difficulty comes from speed. Only a slam can be Perfect (drifting down onto a pimple is at best Great) |
| Launch | Perfect = biggest launch and +speed. Off-centre tilts it: back edge = higher, front edge = faster. Yellow (overripe) = ×1.4 launch plus a goo splatter on screen for 3 s |
| Terrain | Groups ("fields") of 3–6 pimples so every launch arc passes over several: you pick your landing. Gaps between fields may hold spikes, hair or a low mosquito |
| Ripeness | Fixed per pimple and visible from afar: red (not ripe: weak bounce, streak reset), white, yellow. The pimple before hair is always yellow; the one before spikes or a mosquito gap is never red |
| Streak | Perfects and stomps +1; Great keeps it; OK, Miss, red bump and a mosquito knock reset it. ×2 at 5, ×3 at 10, ×4 at 20 |
| Goo spray | Perfects and yellow pops fire goo a short way ahead (~150–250 units): it knocks out bacteria and mosquitoes, gums tweezers shut for 3.5 s and blocks falling cream |
| Foam wall | Speeds up over the run; your speed pushes it back (gauge in the HUD). Misses cost speed |
| Opening | Hand-built first ~14 s, one new idea per field: plain whiteheads → a red one to skip → first bacterium (~5 s) → mosquito gap + yellow → hair → spikes + tweezers → bacterium eating a pimple. Then the random biome pools take over |
| Hints | Basic control hints until you've jumped, popped and hit a Perfect; afterwards a one-line hint the **first time** each new thing scrolls into view (stored per player) |
| Pimple types | Whitehead, Blackhead (low and fast), Cluster (3 minis, bonus for all 3), Cyst (land, hold, release at full charge; over-holding is penalised), Zit Volcano (huge launch, airborne Goo section) |
| Enemies | **Bacteria** crawl over the skin towards you and eat the first pimple they reach (1.6 s). Land on them: squash, bounce, counts like a Perfect. Any airborne touch with your feet above their middle counts. Walking into one ends the run. **Mosquitoes** hover low over gaps: land on them to bounce across; touching one from below knocks you down (speed and streak lost) but doesn't end the run |
| Hazards | **Tweezers** snap on a loop over one pimple (shadow tell; only pinch at skin level, flying over is safe). **Hair** (forehead fringe, armpit forest) in gaps. **Ingrown-hair spikes** fill some gaps. **Acne cream** drops onto a pimple and shrinks it unless you pop it first. **Sweat** (armpit): misses cost double |
| Mutations | 10 s each: Hard Shell (absorbs one hit; a Miss cracks it), Wings (tap while rising to flap once; lost on bare skin), Sticky Legs (hold on landing to stick and charge, release to launch higher), Spore Cloud (pops ripen the next 3 pimples, some go yellow). Endless unlocks them by reaching biomes; the Daily Pop always uses all four |
| World | Forehead → Nose → Chin → Back → Armpit (7,200 units each), then loops with a new skin tone and faster foam |
| Modes | Endless; Daily Pop (same course for everyone from the UTC date, best score per day, ghost of your best run that day) |
| Economy | Goo from pops and stomps; a fixed, finishable skin collection (8) with two earn-only prestige skins (Golden Pus: 20-Perfect streak; Fully Popped: own all others). No real-money purchases in the PoC |
| Feel | Slow-mo flash on Perfects, screen shake, goo particles and decals, synthesised Web Audio sounds, haptics |

**Not in the PoC yet:** bosses (Pore Strip, Magnifying Mirror, Washcloth), Skin Charts, Game Center leaderboards and achievements, StoreKit, iCloud sync, clip sharing. Scores and saves live in `localStorage` on the device.

## Differences from the GDD

Things to fold back into the GDD, or to revert, after playtesting:

| GDD | PoC | Why |
| --- | --- | --- |
| Perfect = landing at the top of a visible/audible pulse | Perfect = landing on the head; a landing marker shows where | Beat timing combined with positioning made many Perfects impossible (playtest 1) |
| Ground-pound (implied forward momentum) | Slam drops straight down | Where you tap is where you land |
| Pimples ripen as they scroll towards you | Ripeness is fixed per pimple | Readable from afar, so you can plan a route |
| Landing position sets angle (front fast, back high) for every pop | Only off-centre (non-Perfect) landings tilt the launch | The head is the Perfect zone, so a Perfect is always centred |
| Mosquito: a hit ends the run | Touch from below = knock-down (speed + streak), not death | They hover in the launch arc; deaths felt unfair |
| Sticky Legs: release exactly when you choose | Hold to stick and charge, release to launch higher | There is no pulse to time a release against |
| Mutations unlock via Skin Chart badges | Unlock by reaching biomes | Skin Charts aren't built |
| (not in GDD) | **Bacteria** enemy, **goo spray** from Perfects, hand-built opening, first-sighting hints, yellow pad before hair, fields of pimples | Playtest 2: the slam needed more uses and the start was empty |

## Changelog

### Playtest 2: "still doesn't do enough with the mechanic; the first 15 s are empty"
- Hand-built opening: one new idea per field, first enemy at ~5 s.
- One-time hints when each new thing first appears.
- Bacteria: moving slam targets that eat pimples; walking into them is fatal.
- Goo spray from Perfects and yellow pops: a Perfect also clears your path.
- Stomps (bacteria, mosquitoes) count towards the streak.
- Smaller overripe splatter; floating texts stay on screen.

### Playtest 1: "timing too hard, chaining impossible, feels like a pimple-popper simulator"

| Was | Now | Why |
| --- | --- | --- |
| Perfect = land on a global beat (±50 ms) while also over the pimple | Perfect = slam onto the head; marker shows where you'll land | Two constraints at once; the beat was abstract |
| Ground-pound drifted forward | Slam drops straight down | Where you tap is where you land |
| One pimple at a time, random spacing | Fields of 3–6 pimples under every arc | Chaining is always possible; picking a target is the decision |
| Ripeness changed over time | Fixed, readable colours | Lets you plan a route |
| Hazards were mostly obstacles | Hazards change which pimple you pick | Gives the pop mechanic decisions |
| Red pads before hair or spikes possible | Pad before a gap hazard is always usable (yellow before hair) | Some layouts were unwinnable |

### Balance at each step (`tools/balance.mjs`, 40 seeds, bot with σ = 30 ms tap error)

| Version | Median run | Perfects | Avg best streak |
| --- | --- | --- | --- |
| Initial (beat timing)* | ~15–18 s | ~35% | ~2 |
| After playtest 1 | ~40 s | ~55% | ~13 |
| After playtest 2 | ~40 s | ~55% | ~13 (deaths now spread across all hazards) |

\* Measured with an earlier, simpler bot without the tap-error model, so only roughly comparable.

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
| `js/course.js` | Deterministic course generator: biomes, the hand-built `OPENING`, fields, gap hazards, per-biome pools. Decisions use only the RNG and plain arithmetic, so the Daily Pop is identical across browsers |
| `js/game.js` | The simulation: physics, slam and grading, foam, hazards, bacteria, goo spray, mutations, scoring, hints, the bot. **All tuning constants are at the top** |
| `js/render.js` | Procedural canvas art, camera, landing marker, HUD |
| `js/skins.js` | Skin catalogue and the Dex drawing |
| `js/audio.js`, `js/feel.js` | Sound and haptics |
| `js/store.js` | Save data (`localStorage` key `zitzoom.save.v1`; clear it to see the hints again) |
| `js/main.js` | Screens, input, frame loop |
| `tests/course.test.mjs` | Determinism (golden RNG values), opening, layout sanity, launch-pad rules |
| `tools/balance.mjs` | Bot-driven balance report |

## What to look for in playtests

- Landing zones (`PERFECT_FRAC`, `GREAT_FRAC` in `js/game.js`) and speed (`MAX_SPEED`, Perfect speed bonus): do misses feel like your own fault?
- Is choosing a pimple in each arc a real decision, or is the nearest gold one always right?
- Bacteria: readable and fair? Does saving a pimple from one feel good?
- Goo spray: is the payoff for Perfects noticeable, or does it trivialise enemies?
- The opening: does each idea land before the next one arrives? Are the hints enough?
- Tweezers are the most common bot killer: do they feel fair to a human?
- Foam pressure (`FOAM_BASE`, `FOAM_RAMP`) vs. speed economy (`DECAY_*`).
- Portrait vs. landscape: both work. Portrait zooms in and moves Dex left to keep the look-ahead.
- Gross-out level: currently cartoony goo, no realism.
