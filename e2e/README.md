# Browser tests

End-to-end tests that drive the real app in Chromium (phone-sized) against the Firebase **emulator** – never against the live database. Most tests use two phones at once (Michi and Anna) to check syncing, live cards and Rückfragen.

## Run

```bash
npm run e2e                     # all tests
bash e2e/run.sh towns stand-ins # only some (file names without .cjs)
```

The runner starts the Firestore/Auth emulator (unless one is already running on :8080), builds the app against it, serves it on :4173, creates the three test accounts and runs the tests one after another. Every test starts with an empty database.

**Needs:** Node ≥ 20, Java (the Firestore emulator is a Java program) and Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`; in Claude's cloud environment both are already there).

Screenshots and logs end up in `e2e/shots/` (not committed).

## Known flake

`offline-sync` – "reopened offline: pending item still there" sometimes fails because the test browser closes before the offline write reaches its local storage. It also happens on older versions; a second run passes.

## The tests

| File | What it checks |
|---|---|
| basic-flow | List, shopping, finishing on two phones; parking; usual chips; remembered categories; a foreign account is refused |
| offline-sync | Offline pill, changes made offline sync afterwards, reopening the app offline |
| live-shopping | "Neu von …" markers, the partner's live card, the late-item banner, Rückfrage |
| rueckfrage-edge-cases | Rückfrage after leaving a store via the plan; the question closes when the shopper finishes |
| leave-popup / leave-popup-last-stop | Leaving a store with open items: take along or leave on the list |
| swipe-delete | Swipe to delete on the list |
| avatar | Profile picture picker and its colours everywhere |
| markers-and-offline-path | "Neu von …" markers survive app restarts; a store path saved offline reaches the server |
| category-upgrade | Data in the pre-V1.3 format (Gewürze & Saucen …) shows the new categories and store paths |
| category-picker | 24 categories, nothing cut off or on 3 lines (also on a 4" phone) |
| usual-chips | Suggestions: only often-bought, at most 12, never covering the navigation |
| toast-overlay-and-saved-paths | Messages float (no tap shifts), seeded stores open their saved path |
| toast-fade | Messages fade out |
| store-logos | Müller and Mix Markt in the logo picker |
| store-path-setup | Setting up a store's path, the partner's store re-sorts |
| path-from-profile | Editing paths from Profil → Laden bearbeiten, also for a branch just added |
| spontaneous-trip / spontaneous-path-editor | "Woanders einkaufen" |
| towns | Branches in Prien and Frasdorf, choosing the town, the trip there |
| stand-ins | Bernau: items of missing stores go to stand-in stores by department and town order |
| once-stop-other-town | A one-time stop at a store in another town waits and is never replaced |
