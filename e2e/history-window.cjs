// The history grows with every trip; the app only loads the 8 weeks the suggestions look at, so opening the app
// doesn't get slower the longer it's used. Suggestions stay the same.
const { chromium, phone, login, resetDb, DOCS } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const DAY = 86400000;
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const H = 'projects/demo-thiscounts/databases/(default)/documents/households/main/history/';
const entry = (id, name, daysAgo) => ({ update: { name: H + id, fields: {
  name: { stringValue: name }, qty: { nullValue: null }, storeId: { nullValue: null }, listId: { stringValue: 'wocheneinkauf' },
  completedAt: { timestampValue: new Date(Date.now() - daysAgo * DAY).toISOString() } } } });
const commit = async writes => { const r = await fetch(DOCS + ':commit', { method: 'POST', headers: owner, body: JSON.stringify({ writes }) }); if (!r.ok) throw new Error('commit ' + r.status + ' ' + await r.text()); };
// History documents in the phone's local copy (Firestore's IndexedDB cache)
const cached = P => P.evaluate(() => new Promise((res, rej) => {
  const open = indexedDB.open('firestore/[DEFAULT]/demo-thiscounts/main');
  open.onerror = () => rej(open.error);
  open.onsuccess = () => {
    const db = open.result, store = [...db.objectStoreNames].find(n => n.startsWith('remoteDocuments'));
    let n = 0; const c = db.transaction(store).objectStore(store).openCursor();
    c.onsuccess = () => { const cur = c.result; if (!cur) return res(n); if (JSON.stringify(cur.key).includes('history')) n++; cur.continue(); };
    c.onerror = () => rej(c.error);
  };
}));

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  // A year of shopping: 1,000 purchases older than 8 weeks (Lebkuchen often, but only last winter) …
  for (let b = 0; b < 4; b++) {
    const writes = [];
    for (let i = 0; i < 250; i++) { const k = b * 250 + i; writes.push(entry('old' + k, k % 50 === 0 ? 'Lebkuchen' : 'Altes ' + (k % 120), 60 + (k % 300))); }
    await commit(writes);
  }
  // … and the last weeks: Kiwi and Eier on two trips, Zimt once
  await commit([entry('r1', 'Kiwi', 3), entry('r2', 'Kiwi', 10), entry('r3', 'Eier', 3), entry('r4', 'Eier', 17), entry('r5', 'Zimt', 5)]);
  await A.reload(); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await A.waitForTimeout(2500);

  const n = await cached(A);
  ok(n === 5, 'only the last 8 weeks are loaded: ' + n + ' of 1005 history entries on the phone');
  const chips = await A.locator('.glass-head button:has(> span + span)').allTextContents();
  ok(chips.some(t => t.startsWith('Kiwi')) && chips.some(t => t.startsWith('Eier')), 'suggestions as before: Kiwi, Eier (' + chips.join(', ') + ')');
  ok(!chips.some(t => /Lebkuchen|Altes/.test(t)), 'nothing from long ago');
  // While typing, things bought once lately are offered too
  await A.fill('input[placeholder^="z. B. 5 Bananen"]', 'Zi'); await A.waitForTimeout(400);
  ok(await A.locator('.glass-head button', { hasText: 'Zimt' }).count() === 1, 'typing "Zi" still offers Zimt');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
