# Handoff: thisCounts V1 — shared shopping list, offline-first web app

## 1. Overview

thisCounts is a shopping list that sorts items **by store** and, inside a store, **by the path through the store** (category order). Two people share lists. One of them fills the list at home, and either of them uses it while shopping.

V1 is a **real, installable web app (PWA)** for **two fixed test users**. It must work reliably in supermarkets with bad reception. That makes **offline-first sync a hard requirement**, not a nice-to-have.

### In scope (V1)
- Log in (2 fixed accounts)
- Multiple lists, shared by both users (create / rename / delete / switch)
- Stores added **manually**, with a store selection and a **Hauptladen** (main store) per list
- A **fixed stop order** per list ("Meine Reihenfolge"), plus a per-trip reorder on the plan
- **Einmalige Stopps** (one-time stops): send a single item to a store that isn't in the list's set, or to a free-text stop (e.g. "Apotheke")
- Einkaufsliste: add via text with quantity parsing, "usual items" chips, quantity sheet, category sheet, store assignment, and remembered assignments
- Einkaufsplan: stops, per-stop menu, per-trip sorting, manual stops
- Im-Laden-Modus: items grouped and sorted by the store's **fixed** category order, with check-off and progress
- Artikel fehlt: move the item to another stop (optionally splitting the quantity), or park it back on the list
- Live sync between both phones, full offline support, and a visible offline/pending state

### Out of scope (V1) — remove from the UI
- Map, geolocation, distances, walking times, "Kürzester Weg" ordering, "Weitere Läden in der Nähe laden", "Auf der Karte suchen"
- Angebote (tab, plan banner, offer-linked items, prices)
- Invites, family, guests, contacts picker, share hints
- Notifications
- Points, rewards, status levels, "Filiale verfeinern", the "Belohnung" screen, and the "Hilf mit…" card in store mode
- Most of Profil and Einstellungen (see §6.9)

---

## 2. About the design files

`prototype/thisCounts V1.dc.html` is a **design reference built in HTML**: a clickable prototype of exactly the V1 scope, with fake, in-memory data. Out-of-scope screens are already removed and the new V1 pieces (login, "Neuer Laden" sheet, reduced Profil, offline pill) are designed in it. It is **not production code**, so don't ship or port it line by line. Rebuild the app in a proper stack (§3), using the prototype for look, copy and behavior.

To view it, open `prototype/thisCounts V1.dc.html` in a browser (it loads `support.js` next to it). The logic lives in the `<script data-dc-script>` block at the bottom. Its method and variable names are cited throughout this doc (e.g. `route()`, `effStore()`), so you can look up the exact reference behavior.

**Fidelity: high.** Colors, type, spacing, radii, copy and interactions are final. Recreate them faithfully. All UI copy is German. Keep it verbatim unless this README says otherwise.

---

## 3. Recommended stack

| Concern | Recommendation | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Simple, fast, matches the prototype's component model |
| Backend / sync | **Firebase Firestore** with `persistentLocalCache` (IndexedDB) + `persistentMultipleTabManager` | Offline reads/writes, a write queue and realtime listeners out of the box. This is the cheapest way to hit the offline requirement. |
| Auth | Firebase Auth, email + password, 2 accounts created in the console | No sign-up flow needed; the session persists offline |
| PWA | `vite-plugin-pwa` (Workbox), precache the app shell, icons, logos and fonts | The app must **start** offline, not just keep working |
| Fonts | Self-host via `@fontsource/bricolage-grotesque` and `@fontsource/dm-sans` | Google Fonts won't load offline |
| Hosting | Netlify (already used for this project) | — |

**Alternative:** Supabase + a local IndexedDB store + a hand-written outbox. It works, but you'd build the offline queue, replay and reconciliation yourself (+2–3 days). Only choose it if there's a strong reason.

**Estimate:** about 1 week for one developer, including offline sync.

---

## 4. Data model (Firestore)

Everything lives under a single household that both users belong to. **All IDs are client-generated** (`doc(collection(...)).id`), so creating things works offline.

```
households/{hid}
  name: string
  members: [uid, uid]
  defaultCategoryOrder: string[]          // see §8.3, used when a store has none

households/{hid}/stores/{storeId}
  name: string                            // "Edeka"
  branch: string                          // "Edeka Färber · Königstraße 12"
  logo: string | null                     // key of a bundled logo: "edeka" | "lidl" | … | null
  categoryOrder: string[] | null          // fixed path through this store; null → household default
  createdAt, updatedAt

households/{hid}/lists/{listId}
  name: string                            // "Wocheneinkauf"
  storeIds: string[]                      // stores selected for this list
  mainStoreId: string | null              // "Hauptladen" — always first stop; default for unassigned items
  storeOrder: string[]                    // "Meine Reihenfolge" — standing order of the non-main stores
  tripOrder: string[] | null              // per-trip override from the plan ("nur für diesen Einkauf")
  deferred: string[]                      // stops pushed to the end ("Später erledigen" / "überspringen")
  createdAt, updatedAt

households/{hid}/lists/{listId}/items/{itemId}
  name: string                            // "Bananen"
  qty: string | null                      // display string, German format: "5 Stück", "500 g", "1,5 l"
  category: string                        // one of ALL_DEPTS or "Unbekannt"
  storeId: string | null                  // null = automatic → main store
  once: boolean                           // true = one-time stop (store outside the list's set)
  onceStopName: string | null             // free-text one-time stop ("Apotheke"); storeId is null then
  parked: boolean                         // "Zurück auf die Einkaufsliste" — open, no store, black chip
  checked: boolean
  checkedBy: uid | null
  createdBy: uid
  createdAt, updatedAt                    // serverTimestamp()

households/{hid}/memory/{normalizedName}  // "Gemerkt" — remembered per item name (lowercase, trimmed)
  storeId: string | null
  category: string | null

households/{hid}/history/{id}             // written on "Einkauf abschließen", feeds the "usual" chips
  name, qty, storeId, listId, completedAt
```

**Local-only state** (per device, not synced): current screen, `currentStoreId` in store mode, expanded row, open sheets, the "Gerade hinzugefügt" set, toast, and plan sort-mode on/off.

**Seed data:** create the household, the 2 users, one list "Wocheneinkauf", and the stores the testers actually use, each with a `categoryOrder`. Use the prototype's `SEED_STORES[].depts` as a starting point (§8.3). Write this as a seed script, not by hand.

---

## 5. Sync, offline and conflicts

### Rules
1. **Offline-first.** Every read comes from `onSnapshot` listeners on the local cache. Every write goes to the local cache immediately, and the UI never waits for the network. Don't use `await` on writes for UI flow: fire and forget, and let Firestore queue them.
2. **Last change wins, per field.** Always update **individual fields** with `updateDoc(ref, { checked: true, checkedBy, updatedAt })`. Never overwrite whole documents with `setDoc` without `merge`. This way, one user checking an item off and the other changing its quantity don't clobber each other.
3. **Delete beats edit.** If A deletes an item while B edits it offline, the item stays deleted. This is acceptable for V1: catch and ignore the `not-found` error on B's replayed update.
4. **Arrays** (`storeIds`, `storeOrder`, `tripOrder`, `deferred`) are written as whole arrays (last write wins). Use `arrayUnion`/`arrayRemove` where the operation is a pure add or remove (`storeIds`, `deferred`).
5. **App shell offline.** A cold start without network must open the app, show the last known data, and allow full use.

### Offline / pending indicator (new UI, required)
- Source: `navigator.onLine` + `online`/`offline` events, plus `snapshot.metadata.hasPendingWrites` via `includeMetadataChanges: true` on the lists and items listeners.
- States:
  - **Online + synced:** nothing shown.
  - **Offline:** a small pill in the glass header, right of the city/meta line on Liste and Plan, and in the dark header in store mode: `Offline · Änderungen werden gespeichert`.
  - **Online + pending writes:** `Wird synchronisiert …`. Show it only if pending lasts > 1.5 s, to avoid flicker.
- Pill styling (match the existing chips): height 24px, radius 999px, padding 0 10px, 12px/600 DM Sans. Light headers: bg `#F3EADF`, text `#6F6055`. Store-mode dark header: bg `#4A3B2E`, text `#F8C5A0`. Add a 6px dot before the text: `#C9581A` offline, `#8A7A6D` syncing.

### Test protocol (must pass before handing to testers)
- Phone A in airplane mode: check off 5 items, add 2, move 1 to another stop, finish at a stop. Turn airplane mode off, and B sees all changes within a few seconds.
- A and B both offline, both edit different fields of the same item, then go online. Both changes survive.
- Kill the app while offline with pending writes, reopen offline (writes still pending, UI shows them), then go online and they sync.
- Cold start in airplane mode after the first install: the app opens with data.

---

## 6. Screens

Global frame: one column, `max-width: 520px`, centered on `#EFE4D8`. The app surface is `#FBF5EE`. Respect `env(safe-area-inset-*)` everywhere, as the prototype does. Base type: DM Sans 16px / 1.4, color `#2A1F17`.

Common patterns (reuse them as components):
- **Glass header** (absolute, top): bg `rgba(251,245,238,.78)`, `backdrop-filter: blur(30px) saturate(1.8)`, bottom hairline `0 0.5px 0 rgba(42,31,23,.14)`, padding `safe-top+20px 20px 10–14px`. H1 in Bricolage Grotesque 30px/700, line-height 1.1, letter-spacing −0.4px. Content scrolls underneath with a top padding equal to the header height (the prototype measures it with a ResizeObserver: `headRef`).
- **Card**: bg `#fff`, radius 18px (list rows 16px), shadow `0 1px 0 #EADCCD`, padding 14px 16px. Selected state: `border: 2px solid #F3752E` (unselected `2px solid #fff`, `box-sizing: border-box`).
- **Section label**: 13px/600, `#8A7A6D`, uppercase, letter-spacing .06em, margin 24px 0 8px.
- **Primary CTA** (floating bottom): height 56px, radius 999px, bg `rgba(242,106,16,.86)` + `backdrop-filter: blur(10px) saturate(2)`, 17px/700 `#2A1F17`. Shadow `0 10px 28px rgba(243,117,46,.28), inset 0 1px 0 rgba(255,255,255,.45), inset 0 0 0 1px rgba(255,255,255,.18)`. Disabled look: bg `rgba(243,234,223,.86)` with a label that explains why (e.g. "Noch keine Artikel").
- **Bottom sheet**: dimmer `rgba(42,31,23,.35)`, sheet bg `#FBF5EE`, radius `26px 26px 0 0`, shadow `0 -10px 30px rgba(42,31,23,.18)`, grab handle 40×4 `#D8CBBD`, close button 36px circle `#F3EADF` with "×" `#6F6055`, title Bricolage 22px/700. Enter animation `toastIn .25s ease`.
- **Toast**: bg `#DDF0E3`, text `#1E5A34`, radius 14px, padding 10px 14px, 14px/600, `toastIn .3s`. Auto-hide after 3200 ms. It sits at the top of the scroll content.
- **Tab bar** (glass pill, bottom): V1 tabs are **Liste · Plan · Profil**. Remove Angebote. Active tab: color `#C9581A`, bg `rgba(224,122,44,.14)`. Inactive: `#8A7A6D`.
- **Up/down reorder buttons**: 40px circles, `#F3EADF`, chevron made of CSS borders. Disabled state has opacity .35.

### 6.1 Login (new, minimal)
Not in the prototype. Use a centered column on `#FBF5EE`: the app logo (`assets/brand/logo.png`), H1 "Anmelden", fields E-Mail and Passwort (styled like the "Name" input in Liste einrichten: 54px, radius 18px, white, focus border `#F3752E`), and a primary CTA "Anmelden". Error text is 13px `#B23A12`. After the first login, the session persists and there's no login again, even offline.

### 6.2 Einstieg / "Deine Läden" (store selection for a list)
Prototype: screen `start`. Opened from Liste einrichten → Läden, or as step 2 of creating a list.
- **Keep:** header "Deine Läden" with the subline "Wir sortieren deine Liste nach Läden und nach dem Weg durch die Filiale." Also keep the back row with the step text ("Schritt 2 von 2 · {Name}" or "Läden für „{Name}“").
- **Remove:** the Standort card, "Weitere Läden in der Nähe laden", "Auf der Karte suchen", distances in the store sublines (show `branch` only), and the "Kürzester Weg / Meine Reihenfolge" segmented control.
- **Lieblingsläden:** all household stores as selectable cards (logo tile 44px, name, `branch`, round check). Tapping toggles membership in `list.storeIds`. "Als Hauptladen festlegen" is a link on selected, non-main stores. The main store gets an orange "Hauptladen" pill. When the main store is deselected, the first remaining selected store becomes main (`storeOptions[].toggle`).
- **New: "+ Laden hinzufügen"** in place of the removed map button (same dashed-button style: min-height 52px, `1.5px dashed #D8CBBD`, radius 18px). It opens a bottom sheet "Neuer Laden" with:
  - Name (required)
  - Filiale / Adresse (optional, becomes `branch`)
  - Logo picker: a row of the bundled logos + "Keins". With no logo, show the initial in Bricolage 700 `#C9581A`, as the prototype does for `noLogo`.
  - CTA "Laden speichern"

  New stores get `categoryOrder: null`, which falls back to the default order.
- Hint text: "Artikel ohne Zuordnung landen automatisch beim Hauptladen."
- **"Reihenfolge der Stopps"** (shown when ≥ 2 non-main stores are selected): rows with a number badge, logo, name, and up/down buttons. The main store is row 1, labeled "immer zuerst", with no buttons. It writes `list.storeOrder`. Hint: "Diese Reihenfolge gilt für jeden Einkauf. Der Hauptladen bleibt immer vorn." (`orderRows`, `moveSetup`).
- CTA: "Fertig" (edit) / "„{Name}“ erstellen" (create; disabled label "Mindestens einen Laden wählen").

### 6.3 Liste einrichten (create / edit list)
Prototype: screen `listSettings`.
- **Keep:** the Name field, the Läden row (edit mode; stacked logos, "{n} Läden", "Hauptladen: {name}"), and "Liste löschen" with inline confirmation ("„{Name}“ löschen?", "Behalten" / "Löschen"). Your only list can't be deleted: "Deine einzige Liste kann nicht gelöscht werden."
- **Remove:** the whole "Teilen mit" section (family, guests, contacts, share hint). Every list is automatically visible to both users.
- **Copy changes:**
  - Create intro → "Gib ihr einen Namen. Danach wählst du die Läden."
  - Edit intro stays "Änderungen gelten für alle, mit denen du die Liste teilst."
  - Header: "Schritt 1 von 2" stays.
- CTA labels as in the prototype: "Erst einen Namen eingeben" (disabled) → "Weiter zu den Läden" → then Einstieg. In edit mode the CTA is "Änderungen speichern".

### 6.4 Einkaufsliste (main screen)
Prototype: screen `list`.
- **Header:** the meta line shows the offline pill (§5) instead of the city. Below it, the list name as a button with a chevron, which opens the **"Deine Listen"** dropdown (rows: check, name, "{n} Artikel", pencil → edit; then "Neue Liste erstellen"). On the right is the other user's avatar: an initial on a colored circle, using the `AV_COLORS` palette. Fix the colors per user in the seed.
  - Meta text in the list rows: "{n} Artikel · mit {Vorname des anderen}".
- **Input:** a pill field with placeholder "z. B. 5 Bananen, 500 g Mehl …" and a round "+" (`#2A1F17`). Enter or + adds the item.
  - Quantity parsing: `parseEntry()`. It accepts a leading or trailing number + unit (`UNIT_RE` / `UNIT_MAP`), outputs German formatting ("1,5 l"), and converts ≥ 1000 g to kg.
  - If the name is already on the list, open the quantity sheet for that item instead of duplicating it.
  - Category = remembered `memory.category` → otherwise the regex guess (`DEPT_GUESS`) → otherwise "Unbekannt".
  - Store = remembered `memory.storeId` → otherwise `null` (automatic).
- **Typing filters the list:** a section "Schon auf der Liste" shows matches. On an exact match, show the hint "Enter öffnet die Menge – so steht es nicht doppelt drauf." With no match, show the card "„{Name}“ ist noch nicht auf der Liste" with "Kommt zu {Kategorie}" / "Kategorie wählst du danach" and a "Hinzufügen" button.
- **"Üblich auf deiner Liste" chips:** shown while the input is focused, or when the list is empty. Show 6, then "+ {n} mehr" / "Weniger". Tapping adds the item with its usual quantity. Tapping again (✓ state) removes it. **In V1 the chips come from `history`:** the top item names of the last 4 weeks by count, using the latest quantity, and excluding items already on the list. With no history yet, fall back to the prototype's `USUAL` list.
- **Sections:** "Gerade hinzugefügt · {n}" (orange title, "Einsortieren" button that clears it; local only). Then one section per category in `ALL_DEPTS` order, with "Kategorie fehlt" first (orange).
- **Item row** (card radius 16, min-height 56):
  - Category icon tile 38px on the category tint. Tapping it opens the **"Kategorie wählen" sheet**, which writes `item.category` and `memory.category` for all items with that name. Toast: "Gemerkt: „{Name}“ → {Kategorie}".
  - Name 600.
  - Subline: quantity button with a pencil icon (opens the **"Menge wählen" sheet**: −/+ steppers, editable number, CTA "{qty} speichern"; step logic `pickFor()` / `stepQ()`), then "· {Kategorie}" or "· Kategorie wählen" (orange).
  - Store chip on the right:
    - **Automatic:** transparent, `1px dashed #B8A696`, with a small "A" dot, text = main store name
    - **Assigned:** bg `#F3EADF`
    - **One-time:** bg `#FDE4D1`, text `#9A3F0C`, with a "1×" badge
    - **Parked:** bg `#2A1F17`, text `#FBF5EE`, "Offen · Laden wählen"
  - "×" deletes the item.
- **Tap a row to expand the store options:** "Automatisch ({Hauptladen})", one pill per selected store, and the current one-time stop if any. Selecting one writes `item.storeId`, `once:false`, `parked:false` and the memory entry. Toasts: "Gemerkt: {Name} holst du künftig bei {Laden}" / "{Name} wird wieder automatisch zugeordnet" (`setStore()`).
- **"+ Einmaliger Stopp"** (dashed pill in the expanded row) opens the one-time stop sheet (§6.5).
- **Empty state:** "Deine Liste ist leer" / "Tipp etwas ein oder wähle aus deinen üblichen Artikeln."
- **Footnotes:** parked hint "Schwarz markierte Artikel waren nicht verfügbar – wähle einen Laden für die nächste Runde." and the tip "Tipp: Artikel antippen, um den Laden zu ändern. Ohne Zuordnung → {Hauptladen} (Hauptladen)."
- **Floating CTA:** "Einkaufsplan ansehen · {n} Artikel" / disabled "Noch keine Artikel".

### 6.5 Einmaliger Stopp (bottom sheet) — new feature, keep fully
Prototype: `once` state, `assignOnce()`, `addOnceText()`, sheet "Einmaliger Stopp".
- Title "Einmaliger Stopp", sub "Nur für „{Artikel}“ – danach verschwindet der Stopp wieder."
- **Free text:** an input with placeholder "Wohin? z. B. Apotheke" + "Hinzufügen" (disabled while empty; Enter submits). It sets `storeId:null, once:true, onceStopName:text, parked:false`.
- **"Oder ein Laden"** (relabel from "Oder ein Laden in der Nähe"; there's no geo): household stores **not** selected for this list, as cards (logo, name, branch). Tapping sets `storeId, once:true, onceStopName:null`.
- **Remove** "Auf der Karte suchen" and the map step.
- Toast: "Einmaliger Stopp: {Artikel} holst du diesmal bei {Stopp}".
- One-time assignments **don't** write `memory`.
- **Grouping rule (V1 decision):** free-text stops with the same name (case-insensitive, trimmed) are **one** stop. The prototype creates a new stop per entry.
- A one-time stop disappears once none of its items remain (they were checked and the trip finished, deleted, or reassigned).

### 6.6 Einkaufsplan ("Deine Route")
Prototype: screen `plan`, `route()`, `stops`, `orderUi`, `manualUi`.
- **Header meta:** "{n} Stopps" + offline pill. Remove the km and minutes.
- **Remove** the illustrated map card and the offer banner.
- **Parked note:** "{Namen} wartet/warten auf der Liste ohne Laden."
- **Order row** (when ≥ 2 sortable stops): "Reihenfolge · **deine Reihenfolge** | **nur für diesen Einkauf**". There's "Zurücksetzen" when a trip order exists (toast "Reihenfolge zurückgesetzt"). The "Ändern" / "Fertig" toggle (Fertig = bg `#F3752E`) switches the stop cards into sort mode:
  - Up/down on each stop
  - The main stop shows "immer zuerst" and can't move
  - Moving writes `list.tripOrder` and clears `deferred` (`moveTrip()`)
- **Stop cards (numbered):**
  - Badge 30px: `#F3EADF` open, `#F3752E` current, `#B9DFC4` done. The next open stop gets an inset orange ring.
  - Logo, name, `branch`
  - "⋯" menu with:
    - "Mit diesem Laden starten"
    - "Alles hier einkaufen · nur ein Stopp" (moves all non-parked items here and opens store mode; toast "Alle {n} Artikel jetzt bei {Laden} · nur ein Stopp")
    - "Später erledigen" (adds to `deferred`; toast "{Laden} ans Ende der Route verschoben")
  - Status pill: "{n} Artikel" / "Erledigt" (green)
  - Item chips on the category tint; checked items are struck through on `#F3EADF`
  - "Stattdessen hier starten" on open stops that aren't next
- **One-time stops** go below a divider "Ohne feste Reihenfolge". The badge shows "?" with a `2px dashed #F3752E` border. The sub is "Einmaliger Stopp". They can't be sorted; otherwise they behave like stops.
- **CTA:** "Einkauf starten bei {nächster}" / "Weiter einkaufen bei {nächster}" / "Einkauf abschließen".

**Route order (`route()`), exact:**
1. Stops = selected stores **plus** stores targeted by one-time items, keeping only those with ≥ 1 non-parked item at them. An item's effective stop (`effStore()`) is its `storeId` if it is `once` or in `list.storeIds`; otherwise the main store.
2. Sort the non-custom stops by `tripOrder ?? storeOrder` (unknown ids go last, stable).
3. Move the main store to the front.
4. Move `deferred` stops to the end, in deferral order.
5. Append the free-text one-time stops.

### 6.7 Im-Laden-Modus
Prototype: screen `store`.
- **Dark header** `#2A1F17`: "‹ Zum Plan" (`#F8C5A0`), "Stopp {n} von {m}", white logo tile 44px, store name (Bricolage 26px/700), branch (`#C9B8A6`), progress bar (6px, track `#4A3B2E`, fill `#F3752E`, width transition .3s) and "{done} von {total}". Add the offline pill (§5).
- **Subline:** "Sortiert nach dem Weg durch diese Filiale".
- **Groups follow the store's `categoryOrder ?? household.defaultCategoryOrder`.** Categories not in the order are appended; "Unbekannt" becomes "Noch einsortieren". Each group gets a numbered tinted badge, an icon and an uppercase label.
- **Item row** (min-height 60): a 28px round check (checked `#3E9B5F` with a white tick), name 17px/600 (checked: `#8A7A6D` + line-through), quantity sub, and "Nicht gefunden" → Artikel fehlt. A tap toggles `checked` / `checkedBy`. It's synced, so the other phone sees it live.
- **Empty state:** "Hier ist nichts mehr zu holen."
- **Remove** the "Hilf mit, diese Filiale genauer zu machen" card.
- **Bottom:**
  - Main button: "Weiter zu {X} ({n} hier offen)" / "Zurück zu {X} ({n} offen)" / "Einkauf abschließen" (+ " ({n} offen)"). Its bg is `#F3752E` when the stop is fully done, otherwise `#F3EADF`.
  - "⋯" menu: "Diesen Laden überspringen" (sub "Kommt ans Ende der Route – offene Artikel bleiben hier."; toast "{Laden} auf später verschoben") and "Zum Plan".
  - The next-stop logic is `nextStop` / `nextIsBack` in the prototype.
- **Einkauf abschließen** (`finishShopping()`):
  - Write a `history` entry for each checked item
  - Delete the checked items
  - Reset `tripOrder:null`, `deferred:[]`
  - Go to the list; toast "Einkauf abgeschlossen · {n} Artikel erledigt"
  - Unchecked items stay.
  - This affects both users. That's acceptable for V1.

### 6.8 Artikel fehlt
Prototype: screen `missing`, `move()`, `parkItem()`.
- Back "‹ Zurück", meta "Nicht gefunden bei {Laden}", H1 "{Artikel} woanders holen".
- **Copy change:** sub → "Wir schlagen den nächsten Stopp auf deiner Route vor."
- **"Nur teilweise da?"** card (only for numeric quantities): stepper for the amount found, "Gebraucht: {x} · noch offen: {y}". Moving with a partial amount **splits** the item: the original keeps the found amount and is checked, and a new item takes the rest at the target store.
- **Empfehlung:** the next stop on the route after the current one. If there is none, use the first other selected store. Show logo, name and the reason "Stopp {n} · liegt ohnehin auf deiner Route". CTA "Zu {Laden} verschieben" / "Rest ({y}) zu {Laden} verschieben". Toasts: "{Artikel} wandert zu {Laden} · Plan aktualisiert" / "Rest von {Artikel} ({y}) wandert zu {Laden}".
- **Alternative:** the list's other selected stores (not current, not the recommended one) as tappable cards, showing name + branch only.
- **Remove** distance and price pills, the price rows, and the info box about prices.
- **Bottom:** outline button "Zurück auf die Einkaufsliste setzen" sets `parked:true, storeId:null`. Toast: "{Artikel} ist zurück auf der Einkaufsliste".

### 6.9 Profil (reduced)
One screen: avatar (initial) + name, a "Läden verwalten" row (household stores: add / rename / delete, and set the logo; use the "Neuer Laden" sheet for editing), and "Abmelden" (outline, `#B23A12`). No settings, family, points or rewards.

### Screen map (prototype → V1)
| Prototype screen / sheet | V1 |
|---|---|
| Einstieg | Keep, trimmed (§6.2) |
| Laden auf Karte suchen | Remove → "Neuer Laden" sheet |
| Einkaufsliste, Liste wechseln | Keep (§6.4) |
| Kategorie wählen, Menge wählen | Keep |
| Einmaliger Stopp | Keep, without the map step (§6.5) |
| Liste einrichten | Keep, without sharing (§6.3) |
| Einkaufsplan | Keep, without map/offers/distances (§6.6) |
| Im-Laden-Modus | Keep, without the refine card (§6.7) |
| Artikel fehlt | Keep, without prices/distances (§6.8) |
| Filiale verfeinern, Belohnung | Remove |
| Angebote | Remove |
| Profil, Einstellungen, Kontakte wählen, Familie, Avatar | Replace with the reduced Profil (§6.9) |

---

## 7. Interactions and states
- **Navigation:** the tab bar switches Liste / Plan / Profil. Store mode and Artikel fehlt are full-screen with back links. Keep the current screen in the URL (e.g. `/plan`, `/store/:storeId`) so reloads and the back button work.
- **Leaving the list** clears "Gerade hinzugefügt", the chip state and the input (`go()`).
- **Hit targets** ≥ 44px. `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`.
- **Animations:**
  - `toastIn` (opacity 0→1, translateY 8px→0) at .2–.3s ease for toasts, sheets and menus
  - `pop` (scale .6→1.08→1) at .25s on chip check
  - Progress bar width transition .3s
  - Chevron rotate .2s
- **Keyboard (list input):** blur the input when the list is scrolled more than 500 ms after focus (`onListScroll`). Chips use `onMouseDown preventDefault` so tapping them doesn't blur the input.
- **Validation:** list name required, store name required, one-time stop text required, at least one store per list.
- **Loading:** after the first sync, never show spinners; data comes from the cache. The only loading state is the very first login (while the initial snapshot loads): centered, 15px `#8A7A6D` text "Lade deine Listen …".

---

## 8. Design tokens

### 8.1 Colors
| Token | Hex | Use |
|---|---|---|
| bg | `#FBF5EE` | App surface, sheets |
| bg-outer | `#EFE4D8` | Behind the 520px column |
| ink | `#2A1F17` | Text, dark buttons, store header |
| accent | `#F3752E` | Selection borders, badges, progress |
| accent-cta | `rgba(242,106,16,.86)` | Floating CTAs |
| accent-text | `#C9581A` | Links, back buttons, warnings-lite |
| accent-soft | `#FDE4D1` | Selected fill, one-time chip, Unbekannt tint |
| accent-deep | `#9A3F0C` / `#9C4412` | Text on accent-soft |
| pale | `#F3EADF` | Secondary buttons, tracks, pills |
| line | `#EADCCD` | Card shadow line, unselected borders |
| line-strong | `#D8CBBD` | Dashed buttons, empty checks, grab handle |
| muted | `#8A7A6D` | Secondary text |
| muted-2 | `#6F6055` | Body-secondary text |
| muted-3 | `#B9AA9C` / `#B8A696` | "×" delete, auto-chip dash |
| dark-2 | `#4A3B2E` | Progress track on dark |
| dark-muted | `#C9B8A6` | Secondary text on dark |
| dark-link | `#F8C5A0` | Links on dark |
| success | `#3E9B5F` | Checked item |
| success-soft | `#DDF0E3` / text `#1E5A34` | Toast |
| success-done | `#B9DFC4` / text `#2E6B41` | "Erledigt" |
| danger | `#B23A12` / border `#E7C6B2` | Delete / logout |

**Category tints (by zone):**
- Fresh (Obst & Gemüse, Backwaren, Fleisch & Fisch): `oklch(0.93 0.045 140)`
- Chilled (Wurst & Käse, Milchprodukte, Tiefkühl): `oklch(0.93 0.035 235)`
- Dry (Frühstück, Nudeln & Reis, Konserven, Gewürze & Saucen, Backzutaten, Kaffee & Tee, Getränke, Süßwaren & Snacks): `oklch(0.93 0.05 80)`
- Non-food (Drogerie, Haushalt, Baby, Tiernahrung): `oklch(0.93 0.035 300)`
- Unbekannt / Angebote: `#FDE4D1`
- Everything else: `#F3EADF`

**Avatar colors:** `#F3752E`/`#2A1F17`, `#FDE4D1`/`#9C4412`, `#DDF0E3`/`#1E5A34`, `#2A1F17`/`#FBF5EE`, `#E6DACB`/`#6F6055`.

### 8.2 Typography
- **Display:** Bricolage Grotesque (500/600/700).
  - H1 30px/700, lh 1.1, ls −0.4px
  - Store name 26px/700
  - Sheet title 22px/700
  - Empty-state title 19px/600
- **UI:** DM Sans (400/500/600, 700 for CTAs).
  - Base 16px/1.4
  - Row name 16px/600 (store mode 17px/600)
  - Secondary 13px
  - Meta 12px/600
  - Section label 13px/600, uppercase, ls .06em (in-list group titles 12px)
  - Tab label 11px/600

### 8.3 Categories and default order
- **`ALL_DEPTS`** (list section order and the category picker): Obst & Gemüse, Backwaren, Fleisch & Fisch, Wurst & Käse, Milchprodukte, Tiefkühl, Nudeln & Reis, Konserven, Gewürze & Saucen, Backzutaten, Kaffee & Tee, Getränke, Süßwaren & Snacks, Frühstück, Drogerie, Haushalt, Baby, Tiernahrung, Sonstiges.
  - Drop "Angebote" in V1.
  - "Unbekannt" is the "not yet categorized" value.
- **`household.defaultCategoryOrder`:** use `ALL_DEPTS`.
- **Per-store `categoryOrder`:** seed from the prototype's `SEED_STORES[].depts` (after `withExtras()`, which inserts Fleisch & Fisch, Süßwaren & Snacks and Drogerie at relative positions). Adjust with the testers once.
- **Category icons** (`DEPT_ICON` → `icons/*.svg`): Obst & Gemüse apple, Backwaren wheat, Fleisch & Fisch fish, Wurst & Käse cheese, Milchprodukte milk, Tiefkühl snowflake, Nudeln & Reis soup, Konserven cylinder, Gewürze & Saucen flame, Backzutaten wheat, Kaffee & Tee coffee, Getränke cup-soda, Süßwaren & Snacks cookie, Frühstück croissant, Drogerie droplet, Haushalt spray-can, Baby baby, Tiernahrung paw-print, Sonstiges shopping-basket, Unbekannt help.
- **Category guessing:** port `DEPT_GUESS` (regex → category) as is.

### 8.4 Radii, spacing, shadows
- **Radii:** 999 (pills, CTAs, tab bar), 26 (sheet top), 24 (dropdown menu), 18 (cards, inputs), 16 (list rows), 14 (inner panels, toast), 12–13 (icon tiles), 10 (small logo tiles).
- **Spacing:** screen side padding 20px. Card padding 14×16. Gaps are 6/8/10/12/16/22 (section gap on the list is 22px).
- **Shadows:**
  - Card: `0 1px 0 #EADCCD`
  - CTA: `0 10px 28px rgba(243,117,46,.28)` + insets (see §6)
  - Tab bar: `0 10px 30px rgba(42,31,23,.16), inset 0 1px 0 rgba(255,255,255,.9), inset 0 -1px 0 rgba(42,31,23,.05)` on `rgba(255,253,250,.42)` + `blur(18px) saturate(1.5)` with a `1px solid rgba(255,255,255,.75)` border
  - Sheet: `0 -10px 30px rgba(42,31,23,.18)`
  - Dropdown: `0 18px 44px rgba(42,31,23,.22)`

---

## 9. Assets
All bundled in `prototype/`:
- `assets/logos/*.png`: store logos (aldi, denns, dm, edeka, kaufland, lidl, netto, norma, penny, rewe, schuhbeck, trinkgut). Per-logo display size and radius inside the tile are in the prototype's `LOGOS` registry, keyed by `store.logo`. Reuse it as is.
- `icons/*.svg`: category and UI icons (Lucide-style line icons).
- `assets/brand/app-icon.png`, `assets/brand/logo.png`, `uploads/App_Icon.png`: app icon (PWA manifest 192/512 + apple-touch-icon) and wordmark.
- PWA manifest: name "thisCounts", `theme_color` / `background_color` `#FBF5EE`, `display: standalone`, portrait.

---

## 10. Acceptance criteria
1. Both test users log in once on their phones, install to the home screen, and stay logged in.
2. An item added on phone A appears on phone B within ~2 s while both are online.
3. A full trip (plan → each stop → check off → "Nicht gefunden" → move / split / park → "Einkauf abschließen") works entirely in airplane mode and syncs correctly afterwards (§5 test protocol).
4. The offline pill appears within 1 s of losing the connection and disappears once pending writes are flushed.
5. Stop order follows §6.6 exactly, including the main store first, deferred stops last, trip order vs. standing order, and one-time stops below the divider.
6. Store mode groups follow the store's fixed category order.
7. Remembered store and category assignments apply to newly added items with the same name, for both users.
8. No UI from the out-of-scope list (§1) is reachable.

## 11. Suggested build order
1. Project setup, PWA shell, fonts and tokens; Firebase init with persistent cache; login; seed script.
2. Data layer: typed hooks per collection (`useLists`, `useItems(listId)`, `useStores`), all writes as field-level updates, and the pending/offline state.
3. Einkaufsliste with all sheets.
4. Stores: Einstieg, "Neuer Laden", Liste einrichten.
5. Plan with route logic + one-time stops, then store mode, then Artikel fehlt.
6. Profil, offline pill polish, the §5 test protocol on two real phones (iOS Safari + Android Chrome), and deploy to Netlify.

## 12. Files in this bundle
- `README.md`: this document
- `GETTING_STARTED.md`: plain-English setup steps, from creating the accounts to installing the app on the testers' phones
- `prototype/thisCounts V1.dc.html`: clickable V1 design reference. Tweaks: `startScreen` (jump to a screen) and `connection` (online / offline / syncing, to preview the offline pill)
- `prototype/support.js`: runtime needed to open the prototype in a browser
- `prototype/icons/`, `prototype/assets/logos/`, `prototype/assets/brand/`, `prototype/uploads/App_Icon.png`: assets
