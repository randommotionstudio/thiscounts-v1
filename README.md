# thisCounts V1.2

**Live:** https://thiscounts.netlify.app

A shared shopping list for two people that sorts items **by store** and, inside a store, **by the path through the store**. It's an installable web app (PWA) that works fully offline and syncs live between both phones.

- **Setting it up (accounts, hosting, testing):** [`docs/SETUP.md`](docs/SETUP.md)
- **Guide for the testers (German):** [`docs/TESTER_ANLEITUNG.md`](docs/TESTER_ANLEITUNG.md)
- **Design handoff and prototype:** [`docs/design-handoff/`](docs/design-handoff/) (V1 spec) [`docs/design-handoff-v1.1/`](docs/design-handoff-v1.1/) (V1.1 delta: store setup, new-item markers, notifications while shopping) and [`docs/design-handoff-v1.2/`](docs/design-handoff-v1.2/) (V1.2: profile picture picker)

## Stack

React 19 + TypeScript + Vite, Firebase Auth (email/password) and Firestore with a persistent IndexedDB cache, and `vite-plugin-pwa` for the offline app shell. Fonts are self-hosted. It's hosted on Netlify (`netlify.toml`).

## Code map

| Path | What |
|---|---|
| `src/lib/logic.ts` | Pure app logic ported from the prototype: quantity parsing, category guessing, `route()`, store groups, usual chips, "Artikel fehlt" amounts. Unit-tested in `logic.test.ts`. |
| `src/config/household.ts` | The two testers, and the seed stores + aisle order from the tester form |
| `src/config/firebaseConfig.ts` | Firebase web config (not secret) |
| `src/data/` | Firestore listeners (`DataProvider`), all writes (`actions.ts`), first-login seeding (`seed.ts`) |
| `src/app/` | App context (active list, toasts, list draft), URL router, offline/sync state, V1.1 shopping session (`shopping.ts`) and new-item markers (`markSince.ts`) |
| `src/screens/`, `src/sheets/`, `src/ui/` | Screens, bottom sheets, shared UI pieces |
| `firestore.rules` | Only the two tester emails may read or write |

**Sync rules:** every read comes from `onSnapshot` on the local cache. Writes are fire-and-forget field-level updates, never awaited and never whole-document overwrites, so both people's edits survive. A delete wins over an offline edit.

## Develop

```bash
npm install
npm test            # logic unit tests
npm run build       # typecheck + production build
```

Run against the local Firebase emulator (needs Java 21 and `firebase-tools`):

```bash
firebase emulators:start --only auth,firestore --project demo-thiscounts
VITE_USE_EMULATOR=1 npm run dev
```

Create emulator users via the Auth emulator REST API (`accounts:signUp`) with the tester emails. The first login seeds the household automatically.
