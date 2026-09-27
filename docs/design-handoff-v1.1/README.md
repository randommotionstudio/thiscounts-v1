# Handoff: thisCounts V1.1: three features on top of the live V1

## 1. Overview

V1 is live and stable. V1.1 adds **three features** that were left out of V1. **Everything else stays exactly as it is in V1.** This document only describes the changes. Keep reading the V1 README for the rest (stack, sync rules, tokens, screens).

| # | Feature | Where |
|---|---|---|
| A | **Filiale einrichten / anpassen**: set up the walking order of the categories in a store, and edit it later. Includes the automatic 60-day check-back. | Store mode → new full screen |
| B | **Neu-Markierung**: a small avatar on items the other person added since you last closed the app | Einkaufsliste rows |
| C | **Benachrichtigungen beim Einkaufen**: while someone is shopping, the other person's additions reach them. They are notified only if it matters (they have already passed that category). **In-app only, no system push.** | Store mode, Liste header, Profil |

**Heads-up, Backwaren icon:** Backwaren uses `icons/bread.svg` everywhere (list tile, chips, category sheet, store-mode groups, the new refine chips). Frühstück keeps `croissant.svg`. The V1 prototype already did this, so just check that the live app matches. Older files (e.g. the Partner Demo) still show the croissant for Backwaren; ignore them.

**Heads-up, new app icon:** replace the app icon everywhere (PWA manifest 192/512, apple-touch-icon, favicon) with `prototype/assets/brand/app-icon.png` (2048px master). Ready-made sizes: `app-icon-512.png`, `app-icon-192.png`, `app-icon-180.png` (apple-touch-icon). **Favicon:** `favicon.ico` (16/32/48 in one file) plus `favicon-32.png` and `favicon-16.png`. These are cropped tighter around the glyph so it stays legible in browser tabs. Head tags: `<link rel="icon" href="/favicon.ico" sizes="any">`, `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`, `<link rel="apple-touch-icon" href="/app-icon-180.png">`. It's full-bleed and square with no transparency, so iOS/Android apply their own corner mask. Set `purpose: "any maskable"` in the manifest. Bump the icon filenames or add a query string so installed PWAs pick up the change.

**Still out of scope:** points, rewards, status levels and the "Belohnung" screen. Feature A ships **without any points** ("+50 Punkte" etc. is removed from all copy). Angebote, map/geo, invites and family also stay out.

---

## 2. Design reference

`prototype/thisCounts V1.1.dc.html` is the V1 prototype with only the V1.1 changes added. Open it in a browser (it needs `support.js` next to it). The logic is in the `<script data-dc-script>` block. Method names cited below (`posInfo()`, `goRefine()`, `partnerAdd()`, `afterJanaAdd()`) point there.

**Tweaks (prototype only, not app UI).** They simulate the other phone, because a prototype has only one:
- `startScreen`: now also `refine`
- `connection`: as in V1
- `partner` (Markus): `zu Hause` / `kauft bei Edeka ein` / `bei Lidl, Edeka erledigt`. This drives the adder-side UI (you are Jana, adding at home).
- `markusAdds`: pick an item and "Markus" adds it right now. This drives the shopper-side UI (you are Jana, in store mode).

**Demo path for the shopper-side banner:** open store mode at Edeka. Check off Cornflakes, Milch, Joghurt and Butter. Then set `markusAdds` → "Sahne · Milchprodukte". Milchprodukte is behind you, so the banner appears. Now pick "Hefe · Backzutaten": Backzutaten is still ahead, so Hefe just shows up with the tag "Neu von Markus" and there's no banner.

There is **no demo entry in the app** (no "Zwei Handys" row in the settings). Build the real behavior described below.

Fidelity is high, as in V1: copy, colors and spacing are final. All UI copy is German. Keep it verbatim.

---

## 3. Feature A: Filiale einrichten / anpassen

### 3.1 Concept
Each store has a fixed category order (`stores/{id}.categoryOrder`, already in V1). Until now it came from the seed. In V1.1 a user walks the store once and taps the categories in the order they pass them (**setup**). Later they can **edit** it. A **cool-down** decides how prominently the app asks.

The order lives on the household's store, so **it applies to both users**.

### 3.2 Data (additions to `households/{hid}/stores/{storeId}`)
```
categoryOrder: string[] | null      // existing. Now written by the user. Never contains "Kasse" or "Sonstiges".
orderSetAt: Timestamp | null        // NEW. null = never set up by a user → setup flow
orderCheckedAt: Timestamp | null    // NEW. last save OR last "Passt noch"; drives the cool-down
orderSetBy: uid | null              // NEW. informational
```
**Migration:** set `orderSetAt: null` and `orderCheckedAt: null` on all existing stores. **Do not touch `categoryOrder`.** The orders you already seeded in the live app stay exactly as they are. Store mode keeps sorting by them until someone sets the store up or edits it in the app.

**Prototype demo values only:** in the prototype, Lidl is marked "set up 2 weeks ago" and Rewe "5 months ago", just to show the cool-down and check-back states. Their orders are the unchanged V1 seed. Don't copy these ages into the live data.

### 3.3 Entry points in store mode (below the item groups)
They are not shown for free-text one-time stops (`once:` stops without a store document).

| State | Condition | UI |
|---|---|---|
| **Setup offer** | `orderSetAt == null` | Card on `#FDE4D1`, radius 18. Orange 38px icon tile with the route glyph. Title "Hilf mit, diese Filiale genauer zu machen", sub "Abteilungs-Reihenfolge antippen" (`#9C4412`), "›". The whole card is tappable. |
| **Cool-down** | age of `orderCheckedAt` < **60 days** | Only a quiet centered text link "Aufbau der Filiale geändert?" (14px `#6F6055`, underlined `#C9B8A6`, min-height 44) |
| **Check-back** | age ≥ **60 days** | Card: title "Stimmt dein Weg noch?", sub "Gespeichert {vor X Wochen/Monaten}". Two buttons: "Passt noch" (outline `#F3752E`) and "Anpassen" (filled `#F3752E`) |

- Age text is `agoText()`: heute / gestern / vor n Tagen (< 14) / vor n Wochen (< 60) / vor n Monaten.
- **"Passt noch"** sets `orderCheckedAt = now`. Toast: "Danke! Weg bei {Laden} bestätigt". The card then switches to the cool-down link.
- `CHECK_AFTER = 60` days. Make it a constant.

### 3.4 Screen "Filiale einrichten" (prototype: `isRefine`, `goRefine()`)
Full screen. It uses the same glass header pattern as the other screens, measured with a ResizeObserver (`refHeadRef`).

- **Header:** "‹ Zurück in den Laden" (back to store mode, nothing saved). The H1 (26px) is:
  - Setup: "Wie läufst du durch {Laden}?"
  - Edit: "Was hat sich bei {Laden} geändert?"
  
  Below the H1, the branch (13px/600 `#8A7A6D`).
- **Intro:**
  - Setup: "Tippe alle Abteilungen in der Reihenfolge an, in der du sie durchläufst. Bisher nutzen wir die Standard-Reihenfolge von {Laden}."
  - Edit: "Gespeichert {agoText}. Tippe eine Abteilung an, um sie zu verschieben oder zu entfernen."
- **Guide card "Bitte diesem Weg folgen":** collapsible ("Ausblenden" / "Anzeigen"). It is **open in setup** and **closed in edit**. It contains the explanatory text and the store-path illustration. Take the SVG verbatim from the prototype; it's an existing asset.
- **"Dein Weg":**
  - Placed chips in order: 44px pills with a number badge (orange), the category icon and the name. An orange arrow sits before the first chip.
  - After the last chip comes a fixed dashed chip "Kasse" (receipt icon, number = n+1, not tappable), followed by an arrow.
  - Hint: "Die Kasse setzen wir automatisch ans Ende." (nothing placed yet) / "Tippe eine nummerierte Abteilung an, um sie zu verschieben." (after that)
  - Reset link on the right of the label: "Zurücksetzen" in setup (shown when ≥ 1 placed), "Ursprüngliche Reihenfolge" in edit (shown when changed).
- **"Noch nicht eingeordnet · {n}":** all of `ALL_DEPTS` except "Sonstiges" that aren't placed yet, as chips with a "+" badge. Tapping one appends it to the path.
- **Checkbox:** "Ich bestätige, dass es diese Abteilungen in dieser Filiale nicht gibt." It is required to save while chips are still unplaced. It is pre-checked in edit. The label background is `#FDE4D1` when checked, `#F3EADF` when not.
- **Pick bar:** tapping a placed chip selects it (ink border). A dark floating bar appears above the CTA: "Stopp {n}" / {Name}, then ‹ (move earlier), › (move later), a trash button (remove, `#C9581A` circle) and "Fertig". Disabled arrows use bg `#3D3129`.
- **CTA** (floating, 56px pill):

  | State | Label | Enabled |
  |---|---|---|
  | nothing placed | "Erste Abteilung antippen" | no |
  | chips open and not confirmed | "Alle Abteilungen einordnen" | no |
  | edit, unchanged | "Noch keine Änderung" | no |
  | setup, ready | "Reihenfolge speichern" | yes |
  | edit, changed | "Änderungen speichern" | yes |

  Disabled look: bg `rgba(216,203,189,.72)`, text `#8A7A6D`.
- **Save:**
  - Write `categoryOrder` (placed chips, without Kasse), `orderCheckedAt = now`, `orderSetBy = uid`, and `orderSetAt = now` if it was null.
  - Return to store mode. The groups re-sort immediately.
  - Toast (setup): "{Laden} nutzt jetzt deinen Weg – auch für {Vorname des anderen}"
  - Toast (edit): "Weg bei {Laden} aktualisiert"
- **Edit prefill:** the current `categoryOrder` (filtered to known categories).
- **Store-mode sorting:** categories that were confirmed as missing, or are otherwise not in the order, are appended at the end, as in V1.

---

## 4. Feature B: Neu-Markierung (items added by the other person)

### 4.1 Rule
On the Einkaufsliste, an item shows the other user's avatar next to its name if:
- `createdBy !== me`, **and**
- `createdAt > markSince`

### 4.2 `markSince` (per device, localStorage)
- On `visibilitychange → hidden` and on `pagehide`, write `thisCounts.hiddenAt = now`.
- On app start, and on `visibilitychange → visible`:
  - If the app was hidden **≥ 10 minutes** (or this is a cold start), set `markSince = previous hiddenAt` and store it as `thisCounts.markSince`.
  - Shorter app switches do **not** reset the markers. Otherwise, a quick look at WhatsApp would wipe them.
- On first ever launch (no value), set `markSince = now`, so no markers show.
- `markSince` stays fixed for the whole session. Markers therefore remain visible while the app is open, including for items the other person adds live.

### 4.3 UI
- Item name row: the name (600, truncates with an ellipsis) and, 8px to its right, a **20px avatar circle** in the other user's avatar colors (Markus: bg `#DDF0E3`, text `#1E5A34`). It shows the initial at 10px/700. Set `title` / `aria-label` "Neu von {Vorname}".
- Only on the Liste screen. Plan and store mode have their own "new" treatment (§5.5).
- Only **creation** counts. Edits, moves and check-offs by the other person don't mark the item.

---

## 5. Feature C: Benachrichtigungen beim Einkaufen

This is the behavior specified in "Partner Demo", now built for real.

### 5.1 Shopping session (new, synced)
```
households/{hid}/sessions/{uid}
  listId: string
  storeId: string                  // store the shopper is in right now (store mode)
  position: number                 // index into that store's category order, see §5.2
  doneStoreIds: string[]           // stores the shopper finished and left on this trip
  stopIndex, stopCount: number     // for "Stopp 1 von 3"
  startedAt: Timestamp
  updatedAt: Timestamp
```
**Writing the session:**
- Create or overwrite it when entering store mode.
- Update it on every check-off (`position`), when switching stops, and when leaving a fully checked store via "Weiter zu …" (add it to `doneStoreIds`).

**Ending it:** delete it on "Einkauf abschließen". Treat it as **stale** (ignore it everywhere) if `updatedAt` is older than 90 minutes.

**Firestore rules:** members of the household can read all sessions and write only their own.

### 5.2 "Where is the shopper?" (`posInfo()`)
The shopper's position is derived from check-offs, with no location needed:
1. Take the store's effective category order (`categoryOrder` + categories of items there that aren't in it, appended).
2. `k` = the highest order index of any **checked** item at this store.
3. `position = k + 1` if every item in category `k` is checked, otherwise `k`. With nothing checked, `position = 0`.
   - **Ignore items created by someone else after `session.startedAt`** when checking whether category `k` is complete. Otherwise, an item added behind the shopper would reopen the category and move the position backwards. This would contradict the notification just sent.
   - Also keep `position` **monotonic per store** within a session: it never decreases (unchecking an item doesn't move you back).

`position` is internal. It is **not** shown as a marker in the UI.
4. A category is **passed** if its index < `position`.

### 5.3 Rules

| # | Situation | Result |
|---|---|---|
| R1 | Whoever adds an item | never gets a notification |
| R2 | The item lands at the store the shopper is in, and its category is **passed** | Shopper sees the **in-app banner** |
| R3 | The item lands at the store the shopper is in, and its category is **still ahead** | **Silent.** It appears on their path with the tag "Neu von {Name}" |
| R4 | The item lands at a store **not visited yet** on this trip | Silent (normal sync) |
| R5 | The item lands at a store in the shopper's `doneStoreIds` | The **adder** gets a Rückfrage (§5.4) |
| R6 | Shopper has turned off "Beim Einkaufen" in Profil | No banner. Tags still show |

"Lands at" means the item's effective stop (`effStore()`, V1 §6.6).

### 5.4 Adder side (the person at home)

**Live card** in the Liste header, between the title row and the input. It shows whenever another member has a non-stale session on **this** list.
- Dark card `#2A1F17`, radius 16, padding 10×12.
- Avatar 32px with a green online dot (`#3E9B5F`, 11px, 2px ink ring).
- Title "{Name} kauft gerade ein" (14px/600).
- Sub: "{Laden} · Stopp {i} von {n}" + " · {erledigter Laden} erledigt" if `doneStoreIds` isn't empty (12px `#C9B8A6`).
- White 32px logo tile on the right.

**No confirmation bar on the sender side.** Adding an item while someone is shopping shows no toast (not for R2/R3, and not after the Rückfrage).

**Rückfrage (R5):** a bottom sheet that can't be dismissed by tapping the dimmer.
- Avatar 44px with the current store's logo as a 24px badge.
- Title "{Name} ist schon bei {aktueller Laden}".
- Body "Bei {Ziel-Laden} ist er für heute fertig. Soll er {Artikel} bei {aktueller Laden} mitnehmen?"
- Primary "Bei {aktueller Laden} mitnehmen": sets `storeId = current store`, and `once: true` if that store isn't in `list.storeIds`. **No `memory` write.** R2/R3 then apply.
- Secondary (outline) "Beim nächsten {Ziel-Laden}-Einkauf": sets `nextTrip: true`. The shopper gets nothing.
- **Offline-safe write:** create the item immediately with `pendingDecision: true`. It is **excluded from everyone's current trip** until it's resolved. If the sheet is left unresolved (app closed, 2 min timeout), resolve to "nächster Einkauf".
- The store label on the list item shows the store name as usual (e.g. "Edeka"), with no extra "Rückfrage" or "nächstes Mal" label, whether the question is still open or answered.

**New item fields:**
- `pendingDecision: boolean` (default false)
- `nextTrip: boolean` (default false). Excluded from the current trip's route and store mode. Cleared on "Einkauf abschließen".

### 5.5 Shopper side (store mode)

**In-app banner** (R2): it sits in the floating bottom area, directly above the "Weiter zu …" button.
- Dark `#2A1F17`, radius 20, shadow `0 14px 34px rgba(42,31,23,.3)`, animation `toastIn .3s`.
- Avatar 36px, title 15px/700, body 13px `#C9B8A6`, and a 36px "×" (bg `rgba(251,245,238,.12)`).
- Copy: title "{Name} hat {Artikel} hinzugefügt", body "{Kategorie} hast du schon hinter dir – noch mal kurz zurück?"
- It stays until dismissed. A newer notification replaces it. It clears when leaving store mode.

Groups look exactly as in V1. Passed categories are **not** dimmed or marked.

**New items** (created by someone else after `session.startedAt`, unchecked):
- 2px `#F3752E` border on the row
- Tag under the name: "Neu von {Name}" (bg `#FDE4D1`, text `#9C4412`) or, if the category is passed, "Neu · schon vorbei" (bg `#F3752E`, text ink). 12px/700, radius 999, `pop` animation.

**How it's delivered:** entirely client-side, with no Cloud Functions and no FCM. The shopper's app already listens to the list's items (V1). When a new item arrives from someone else, the app applies R2/R3 against its own session (`posInfo()`) and shows the banner or the tag. Dedupe by `itemId`, so the same item never triggers twice.

The banner only appears while the app is open in store mode. That's intended: no system notifications, so no permission prompt and no service-worker push.

**Offline shopper:** items arrive when the phone reconnects. The app re-checks R2 at that moment. If the category is no longer passed, or the trip has ended, it shows only the tag or nothing.

### 5.6 Profil: new section "Benachrichtigungen" (between "Deine Läden" and "Abmelden")
- One card row "Beim Einkaufen", sub "Wenn jemand etwas hinzufügt, an dessen Abteilung du schon vorbei bist."
- A 51×31 switch: on = `#F3752E`, off = `#D8CBBD`.
- It writes `users/{uid}.notifyWhileShopping` (default `true`).

### 5.7 Hosting / plan
Everything runs on Firestore listeners, which the V1 setup already has. **It stays on the free Spark plan.** No Blaze, no Cloud Functions, no VAPID keys.

---

## 6. Changes to the V1 data model (summary)
```
stores/{id}:       + orderSetAt, orderCheckedAt, orderSetBy
items/{id}:        + pendingDecision, nextTrip
sessions/{uid}:    NEW (§5.1)
users/{uid}:       + notifyWhileShopping (bool, default true)
localStorage:      thisCounts.hiddenAt, thisCounts.markSince
```
The route (`route()`) and store mode now **exclude** items with `pendingDecision` or `nextTrip`. "Einkauf abschließen" additionally clears `nextTrip` on the remaining items and deletes the own session.

## 7. Acceptance criteria
1. **Setup and edit:**
   - A store that was never set up shows the setup card.
   - After saving, both phones sort that store by the new order within ~2 s.
   - The store then shows only the quiet link.
   - If `orderCheckedAt` is set 61 days back in the console, the check-back card appears. "Passt noch" returns it to the link.
2. The refine CTA disables exactly as in the §3.4 table. Kasse is always last and never stored.
3. **Markers:** items A added while B's app was closed ≥ 10 min show A's avatar on B's list. They stay while B uses the app, and disappear after B closes the app for ≥ 10 min and reopens it. B's own items never show a marker.
4. **Shopping rules:**
   - With B in store mode at Edeka, having checked everything up to Milchprodukte: A adds "Sahne". B gets the in-app banner. A gets nothing.
   - A adds "Hefe" (Backzutaten, still ahead). No notification for B; the item appears with "Neu von A".
5. **Rückfrage:** with B done at Edeka and now at Lidl, A adding an Edeka item opens the Rückfrage.
   - "mitnehmen" moves it to Lidl, and R2/R3 apply.
   - "nächster Einkauf" keeps it off B's trip and without notification. It is back on the next trip.
6. The Profil switch off → no banner. Tags still show.
7. No system notification permission is ever requested.
8. Everything from the V1 offline test protocol still passes. Refine saves and Rückfrage decisions made offline sync correctly afterwards.

## 8. Suggested build order (≈ 2–3 days)
1. Data fields + migration script (`orderSetAt/orderCheckedAt` null on existing stores).
2. Feature A: entry states in store mode, then the refine screen, then save/confirm.
3. Feature B: `markSince` handling + avatar in the list rows.
4. Feature C:
   1. Sessions (write, stale handling)
   2. Position (internal) + tags
   3. Live card
   4. Rückfrage with `pendingDecision`
   5. In-app banner
   6. Profil section
5. Test on two real phones (§7).

## 9. Files in this bundle
- `README.md`: this document (delta to V1)
- `prototype/thisCounts V1.1.dc.html`: clickable reference (V1 + these features). See the Tweaks in §2.
- `prototype/support.js`, `prototype/icons/`, `prototype/assets/`, `prototype/uploads/`: same as V1, except the **new app icon** (`assets/brand/app-icon*.png`, `uploads/App_Icon.png`). `icons/receipt.svg` is used for the Kasse chip.
