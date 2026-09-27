# Handoff: thisCounts V1.2: profile picture picker

## 1. Overview

V1.1 is the base. V1.2 adds **one feature**: the user picks their profile picture as **initials or an icon**, plus a **color**. **Everything else stays exactly as in V1.1.** This document only describes the change. For everything else (stack, sync, tokens, screens, V1.1 features), read the V1 and V1.1 READMEs.

**No photo upload.** Only initials or one of 11 icons, each in one of 4 colors.

---

## 2. Design reference

`prototype/thisCounts V1.2.dc.html` is the V1.1 prototype with only this change added. Open it in a browser (it needs `support.js` next to it). The logic is in the `<script data-dc-script>` block. Look for `AV_ICONS`, `AV_COLORS`, `avVals()`, `setMeAv()`, and the `meAv` / `avIcons` / `avColors` values in `renderVals()`.

These files are **design references in HTML**, not production code. Rebuild them in the live app's existing stack and patterns.

Fidelity is high: copy, colors, sizes and spacing are final. All UI copy is German. Keep it verbatim.

To demo: set the Tweak `startScreen` → `profile`, then tap the avatar.

---

## 3. Data

```
users/{uid}.avatar: {
  kind: 'initial' | 'icon',      // default 'initial'
  icon: string | null,           // one of AV_ICONS, only used when kind == 'icon'
  color: 0 | 1 | 2 | 3           // index into AV_COLORS, default 0
}
```
- Changes save **immediately** on every tap (no draft state). "Fertig" only closes the sheet.
- Switching `kind` keeps `color`. Switching back to initials keeps the last `icon` in the doc (harmless).
- The initial is always the first letter of the user's first name (`first[0]`), never stored.
- Missing `avatar` field → treat as `{ kind: 'initial', color: 0 }`. No migration needed.
- The prototype persists in localStorage (`thisCounts.v12.avatar`) only because it has no backend. The app writes to Firestore; it must work offline like every other user write.

### Where the avatar shows
The avatar is the user's identity for **everyone in the household**. Everywhere V1/V1.1 renders a person's avatar circle (the Profil card, the "Teilt alle Listen mit …" row, the Neu-Markierung dot on list items (V1.1 §4.3), the live shopping card and Rückfrage (V1.1 §5.4), the store-mode banner (V1.1 §5.5)) must read that person's `users/{uid}.avatar` and render it with the rules in §5. Today these use hard-coded colors (e.g. Markus `#DDF0E3` / `#1E5A34`); replace those with the stored avatar.

---

## 4. Constants

**Icons** (`AV_ICONS`, in this order, German `title` / `aria-label` in brackets):
`apple` (Apfel), `carrot` (Karotte), `cherry` (Kirschen), `egg` (Ei), `fish` (Fisch), `pizza` (Pizza), `cookie` (Keks), `coffee` (Kaffee), `cup-soda` (Limo), `soup` (Suppe), `milk` (Milch).
Files: `prototype/icons/{name}.svg` (Lucide-style line icons, already in the V1 icon set).

**Colors** (`AV_COLORS`, index → bg / fg, name used as `title`):

| # | Name | bg | fg (initial / icon) |
|---|---|---|---|
| 0 | Orange | `#F3752E` | `#2A1F17` |
| 1 | Pfirsich | `#FDE4D1` | `#9C4412` |
| 2 | Mint | `#DDF0E3` | `#1E5A34` |
| 3 | Espresso | `#2A1F17` | `#FBF5EE` |

**Selection ring:** `box-shadow: 0 0 0 2px #FBF5EE, 0 0 0 4px #F3752E`.
**Unselected ring:** `box-shadow: 0 0 0 1px #EADCCD`.

---

## 5. Avatar rendering (all sizes)

A circle (`border-radius: 50%`) with `background: color.bg`.
- **kind = initial:** the first-name initial, centered, Bricolage Grotesque 700, `color: color.fg`. Font size ≈ 40% of the diameter (54px → 22px, 96px → 40px, 20px → 10px).
- **kind = icon:** the icon SVG, tinted with `color.fg` (prototype uses a CSS mask with `background-color: fg`; any tinting method is fine), centered, **55%** of the diameter (52% in the 96px preview).

---

## 6. UI

### 6.1 Profil card (change)
The 54px avatar in the dark Profil card becomes a **button** (`title` "Profilbild ändern") that opens the sheet.
- Avatar per §5, initial at 22px.
- **Edit badge:** 24px circle at `right: -3px; bottom: -3px`, bg `#FBF5EE`, 2px `#2A1F17` border (box-sizing border-box), with `icons/pencil.svg` at 11px, opacity .8.
- Hit area: the full 54px circle.

### 6.2 Bottom sheet "Profilbild" (new)
Same sheet pattern as the other V1.1 sheets (Kategorie wählen, Neuer Laden):
- Dimmer `rgba(42,31,23,.35)`, tap to close. z-index above the tab bar.
- Sheet bg `#FBF5EE`, radius `26px 26px 0 0`, padding `14px 20px calc(safe-area-bottom + 24px)`, shadow `0 -10px 30px rgba(42,31,23,.18)`, entry animation `toastIn .25s ease` (opacity 0 → 1, translateY 8px → 0).
- Grabber: 40×4, radius 2, `#D8CBBD`, 16px below.

Contents, top to bottom:
1. **Header row:** title "Profilbild" (Bricolage Grotesque 700, 22px, line-height 1.1); sub "So sehen dich alle, mit denen du Listen teilst." (13px `#8A7A6D`, 4px top). On the right a 36px close "×" (bg `#F3EADF`, color `#6F6055`, 20px).
2. **Preview:** centered 96px avatar per §5 (initial 40px), shadow `0 8px 24px rgba(42,31,23,.14)`, 18px top margin. Updates live.
3. **Label** "Initialen oder Icon": 13px/600 `#8A7A6D`, uppercase, letter-spacing .06em, margin `20px 0 10px`.
4. **Grid:** 6 columns (`repeat(6, minmax(0,1fr))`), gap 10px, square cells (`aspect-ratio: 1`, min 44px), all circles. 12 cells in 2 rows:
   - Cell 1: **Initialen**, shows the user's initial (Bricolage 700, 18px).
   - Cells 2–12: the 11 icons (icon 50% of the cell).
   - **Selected cell:** bg = current color's bg, glyph = its fg, selection ring.
   - **Unselected cell:** bg `#fff`, glyph `#6F6055`, unselected ring.
   - Exactly one cell is selected at any time.
5. **Label** "Farbe" (same style as 3).
6. **Color swatches:** row of 4 circles, 44px, gap 14px, 2px left padding. Filled with each color's bg. Selected one gets the selection ring, others the unselected ring.
7. **"Fertig"** button: full width, 54px, pill, bg `#F3752E`, text `#2A1F17` 17px/700, 22px top margin. Closes the sheet.

### 6.3 Interactions
- Tap "Initialen" → `kind = 'initial'`.
- Tap an icon → `kind = 'icon'`, `icon = name`.
- Tap a color → `color = index` (applies to whichever kind is active).
- Every tap writes immediately; the Profil card, preview and grid update at once. Other household members see the new avatar via the normal user-doc listener.
- Close via "×", "Fertig" or the dimmer. No confirmation, no toast.

### 6.4 Accessibility
- Every grid cell and swatch: `aria-label` (icon name, "Initialen", color name), `aria-pressed` for the selected one.
- The avatar button in the Profil card: `aria-label` "Profilbild ändern".
- All targets ≥ 44px.

---

## 7. Acceptance criteria
1. A user without `avatar` shows their initial on orange everywhere.
2. Tapping the Profil avatar opens the sheet; the preview, grid selection and color selection match the stored avatar.
3. Choosing an icon, then a color, updates the preview and the Profil card immediately and persists after reload.
4. Switching back to "Initialen" keeps the chosen color.
5. On the other household member's phone, the new avatar appears within ~2 s everywhere that user is shown (list markers, live card, banner, Profil "Teilt alle Listen mit").
6. Changes made offline sync afterwards.
7. No photo upload option exists.

## 8. Files in this bundle
- `README.md`: this document (delta to V1.1)
- `prototype/thisCounts V1.2.dc.html`: clickable reference (V1.1 + the picker)
- `prototype/support.js`, `prototype/icons/`, `prototype/assets/`, `prototype/uploads/`: same as V1.1. Uses `icons/pencil.svg` and the 11 avatar icons listed in §4.
