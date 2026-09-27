# Getting thisCounts V1 running: step by step

This is the practical checklist, from "nothing" to "two people using the app on their phones". The README covers **what** to build. This file covers **how to get it running**.

You'll need about half a day for steps 1–4. Building the app itself (step 5) is the main work, roughly a week.

---

## What you need before you start

- A computer with **Node.js 20 or newer** and **Git** installed
- A **GitHub** account (for the code)
- A **Google account** (for Firebase, the backend)
- A **Netlify** account (for hosting). The project already has one, so ask for access.
- Email addresses for the **two test users**
- Two real phones for testing: ideally one iPhone and one Android

Everything used here has a free tier that is plenty for two users. No credit card is needed.

---

## Step 1: Set up the backend (Firebase)

Firebase stores the lists and keeps both phones in sync, including when they're offline.

1. Go to **console.firebase.google.com** and click **Create project**. Name it `thiscounts-v1`. You can turn Google Analytics off.
2. In the project, go to **Build → Firestore Database → Create database**.
   - Choose **production mode**.
   - Choose the location **europe-west3 (Frankfurt)**. This can't be changed later.
3. Go to **Build → Authentication → Get started**, then enable **Email/Password** as the sign-in method.
4. Still in Authentication, open the **Users** tab and click **Add user** twice, once for each tester. Pick a password for each and send it to them privately. There is no sign-up screen in the app, so this is the only way accounts get created.
5. Copy the **User UID** of both users. You'll need them in step 3.
6. Go to **Project settings (gear icon) → General → Your apps**, click the **Web** icon (`</>`), and register an app called `thisCounts`. Firebase shows a config block with `apiKey`, `projectId` and so on. Keep this page open. You'll need these values in step 2.

### Lock down the database
In **Firestore → Rules**, replace everything with the rules below and click **Publish**. They make sure only the two household members can read or write anything.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /households/{hid}/{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid in get(/databases/$(db)/documents/households/$(hid)).data.members;
    }
    match /households/{hid} {
      allow read: if request.auth != null && request.auth.uid in resource.data.members;
    }
  }
}
```

---

## Step 2: Create the app project on your computer

1. Create a new GitHub repository called `thiscounts-v1` and clone it.
2. Inside it, create a React + TypeScript app with Vite:
   ```
   npm create vite@latest . -- --template react-ts
   npm install
   npm install firebase @fontsource/bricolage-grotesque @fontsource/dm-sans
   npm install -D vite-plugin-pwa
   ```
3. Create a file called **`.env.local`** in the project root and paste in the values from step 1.6:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
   Make sure `.env.local` is listed in `.gitignore`. It should be by default.
4. Copy the assets from this bundle into the app's `public/` folder:
   - `prototype/icons/` → `public/icons/`
   - `prototype/assets/logos/` → `public/logos/`
   - `prototype/uploads/App_Icon.png` → `public/app-icon.png`
5. Turn on offline storage when Firebase starts. This one setting is what makes the app work without reception:
   ```ts
   import { initializeApp } from 'firebase/app';
   import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

   const app = initializeApp({ /* values from import.meta.env */ });
   export const db = initializeFirestore(app, {
     localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
   });
   ```
6. Run `npm run dev` and open the address it shows. You should see the default Vite page.

---

## Step 3: Put the starting data in the database

The app needs a household, the two users in it, a first list and the stores. Do this with a small script, so it can be re-run if something goes wrong.

1. In Firebase, go to **Project settings → Service accounts → Generate new private key**. This downloads a JSON file.
   - Save it as `scripts/service-account.json`.
   - Add `scripts/service-account.json` to `.gitignore`. **Never commit this file.** It gives full access to the database.
2. Install the admin library: `npm install -D firebase-admin tsx`
3. Write `scripts/seed.ts`. It should create:
   - `households/main` with `members: [UID_1, UID_2]` (from step 1.5) and `defaultCategoryOrder` (the `ALL_DEPTS` list, README §8.3)
   - One document under `households/main/stores/` per store the testers actually shop at. Each gets a name, branch, logo key and `categoryOrder`, taken from `SEED_STORES` in the prototype.
   - One list, "Wocheneinkauf", with those stores selected and one of them as the Hauptladen
4. Run it with `npx tsx scripts/seed.ts`, then check the **Firestore → Data** tab to confirm it's all there.

**Before you run the seed script,** send the testers `TESTER_FORM.txt` from this bundle. It asks for their email addresses, the stores they use (including the Hauptladen) and the rough aisle order in each store.

---

## Step 4: Put it online (Netlify)

Do this early, even with an unfinished app, so the testers' phones can reach it over HTTPS. Installing to the home screen requires HTTPS.

1. Add a file `public/_redirects` containing this one line, so reloading a page like `/plan` doesn't show a 404:
   ```
   /*  /index.html  200
   ```
2. Push the code to GitHub.
3. In Netlify, go to **Add new site → Import from Git**, pick the repo, and set:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. In **Site settings → Environment variables**, add the same six `VITE_FIREBASE_...` values from `.env.local`.
5. Deploy. Netlify gives you an address like `thiscounts-v1.netlify.app`.
6. Back in Firebase, go to **Authentication → Settings → Authorized domains** and add that Netlify address. Without this, login fails on the live site.

From now on, every push to GitHub updates the live app automatically.

---

## Step 5: Build the app

Follow the README from **§11 Suggested build order**. Open `prototype/thisCounts V1.dc.html` in a browser next to your code and match it screen by screen.

A few things that are easy to get wrong:
- **Never make the screen wait for the database** when saving. Write and move on; Firebase queues the change if the phone is offline.
- **Update single fields, not whole documents** (README §5). This is what keeps both users' changes from overwriting each other.
- **Make the app shell work offline** with `vite-plugin-pwa`. Set it to precache everything, including icons, logos and fonts. Otherwise the app won't even open without reception.
- **Use the self-hosted fonts** (`@fontsource/...`), not Google Fonts links, for the same reason.

---

## Step 6: Test offline before anyone else sees it

Go through the **test protocol in README §5** on two real phones. The short version:

1. Put phone A in airplane mode, go "shopping" (check off items, move one, finish a stop), then turn the network back on. Phone B should show everything within a few seconds.
2. Take both phones offline, edit the same item differently on each, then bring both back online. Both edits should survive.
3. Close the app while offline, reopen it offline, then go online. Nothing should be lost.
4. With airplane mode on, open the app from the home screen. It should start and show the lists.

Don't hand the app out until all four pass.

---

## Step 7: Hand it to the two testers

Send each tester their email and password, plus these install instructions:

- **iPhone:** open the link in **Safari** (not Chrome), tap the **Share** button, then **Zum Home-Bildschirm**.
- **Android:** open the link in **Chrome**, tap the **⋮** menu, then **App installieren** (or **Zum Startbildschirm hinzufügen**).

They log in once and stay logged in, even offline.

---

## If something goes wrong

- **Login fails only on the live site:** the Netlify address is missing from Firebase's authorized domains (step 4.6).
- **"Missing or insufficient permissions":** the user's UID isn't in `members` on the household, or the rules weren't published (step 1).
- **Changes don't show up on the other phone:** check that both users belong to the same household, and that the app listens with `onSnapshot` rather than loading data once.
- **The app doesn't open offline:** the service worker isn't precaching the shell. Check the `vite-plugin-pwa` settings, and test with a production build (`npm run build && npm run preview`), not the dev server.
- **Adding a third user later:** add them in Firebase Authentication, then add their UID to `members`. No code change needed.
