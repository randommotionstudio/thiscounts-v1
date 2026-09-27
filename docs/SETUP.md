# Getting thisCounts online: your checklist

This is everything that needs your accounts. No programming, no installing anything. Claude does the code.

**What's already done in the code**
- The whole app (all screens from the prototype), offline support and live sync between the two phones
- The testers' data from the form: the 5 stores in Prien, Netto as the Hauptladen, the route A → B → C → D → E and the aisle order in every store. It's written to the database automatically the first time someone logs in, so there's no script to run.
- Hosting settings for Netlify (`netlify.toml`) and the database lock-down rules (`firestore.rules`)

---

## 1. Firebase (about 20 minutes)

At **console.firebase.google.com**:

1. **Create project** → name it `thiscounts-v1`. Analytics can be off.
2. **Build → Firestore Database → Create database** → *production mode* → location **europe-west3 (Frankfurt)**. The location can't be changed later.
3. **Build → Authentication → Get started** → enable **Email/Password**.
4. **Authentication → Users → Add user**, twice:
   - `michael@rieplhuber.com`
   - `annacvetkov@posteo.de`

   Make up a password for each and send it to the tester privately. **Don't send the passwords to Claude.**
5. **Firestore → Rules**: replace everything with the text below, then click **Publish**.
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null
           && request.auth.token.email in ['michael@rieplhuber.com', 'annacvetkov@posteo.de'];
       }
     }
   }
   ```
6. **Project settings (gear icon) → General → Your apps → `</>` (Web)**, register an app called `thisCounts`. You don't need Firebase Hosting.
   Firebase shows a block like `const firebaseConfig = { apiKey: "…", authDomain: "…", … }`. **Paste that block into the chat with Claude.** These values aren't secret; the rules from step 5 protect the data.

Claude then puts the values into `src/config/firebaseConfig.ts`, and the app is connected. ✅ Done.

## 2. Netlify (about 10 minutes)

1. At **app.netlify.com**: **Add new site → Import an existing project → GitHub** → pick `randommotionstudio/thiscounts-v1`.
2. **Branch to deploy:** `main`.
3. Build command and publish directory fill in automatically from `netlify.toml` (`npm run build`, `dist`). Click **Deploy**.
4. Netlify gives you an address like `https://thiscounts-v1.netlify.app`. You can rename it under **Site configuration → Change site name**.
5. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** → paste the Netlify address without `https://`.

From now on, every change that lands on `main` goes live automatically within a minute or two.

## 3. Test on two real phones (about 30 minutes)

Ideally one iPhone and one Android. Log in as each tester on one phone, install the app (see `TESTER_ANLEITUNG.md`), then:

| # | Do this | Expected |
|---|---|---|
| 1 | Phone A in airplane mode. Check off 5 items, add 2, press "Nicht gefunden" on one and move it, then finish the trip. Turn airplane mode off. | Phone B shows all changes within a few seconds. |
| 2 | Both phones offline. A changes the amount of an item, B changes its store. Both back online. | Both changes are there on both phones. |
| 3 | Phone A offline, add an item, swipe the app closed, open it again (still offline). Then go online. | The item is still there after reopening, and B gets it once A is online. |
| 4 | Phone A in airplane mode, open the app from the home screen. | The app opens and shows the lists. |
| 5 | Turn airplane mode on. | Within a second the pill "Offline · Änderungen werden gespeichert" appears at the top. |

Claude has already run these five checks automatically in a simulated browser, and they pass there. On real phones they confirm the real network and install behaviour.

## 4. Hand it to Michi and Anna

Send each of them the Netlify address, their password, and the file `docs/TESTER_ANLEITUNG.md` (German).

---

### If something goes wrong
- **Login fails only on the live site:** the Netlify address is missing from Firebase's *Authorized domains* (step 2.5).
- **"Das Konto … hat keinen Zugriff auf die Listen":** the rules from step 1.5 weren't published, or the email in Firebase has a typo.
- **The app doesn't update on the phone:** close it completely and open it again. The new version loads in the background and is used from the next start.
- **Adding a third person later:** add them in Firebase Authentication and in the rules (step 1.5), and tell Claude, because the email also appears in `src/config/household.ts`.
