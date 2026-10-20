// V1.9: the store remembered for an item is per list; the category stays shared by all lists.
const { chromium, SHOTS, phone, login, resetDb, waitText, REST } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(150); } await p.locator(IN).blur(); }
const storeOf = async (listId, name) => {
  const docs = (await (await fetch(REST + '/lists/' + listId + '/items', { headers: owner })).json()).documents || [];
  const d = docs.find(x => x.fields.name.stringValue === name);
  return d ? (d.fields.storeId.stringValue ?? null) : 'missing';
};
const switchTo = async (P, id, title) => { await P.evaluate(i => localStorage.setItem('thisCounts.activeList', i), id); await P.reload(); await P.waitForSelector('h1:has-text("' + title + '")', { timeout: 20000 }); };

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  // An assignment from before V1.9 (one store for all lists) and a second list
  await fetch(REST + '/memory/wasser', { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { name: { stringValue: 'wasser' }, storeId: { stringValue: 'trinkgut' } } }) });
  await fetch(REST + '/lists/getraenke', { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: {
    name: { stringValue: 'Getränke' }, storeIds: { arrayValue: { values: ['netto', 'rewe', 'trinkgut'].map(s => ({ stringValue: s })) } }, mainStoreId: { stringValue: 'netto' },
    storeOrder: { arrayValue: { values: [{ stringValue: 'rewe' }, { stringValue: 'trinkgut' }] } }, tripOrder: { nullValue: null }, deferred: { arrayValue: {} },
    createdAt: { timestampValue: new Date().toISOString() } } }) });
  await A.reload(); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await A.waitForTimeout(800);

  // The old assignment still works on the first list …
  await add(A, ['Wasser']);
  await A.waitForTimeout(600);
  ok(await storeOf('wocheneinkauf', 'Wasser') === 'trinkgut', 'Wocheneinkauf: Wasser → trinkgut (from before)');
  // … but not on the other list
  await switchTo(A, 'getraenke', 'Getränke');
  await add(A, ['Wasser', 'Saft']);
  await A.waitForTimeout(600);
  ok(await storeOf('getraenke', 'Wasser') === null, 'Getränke: Wasser is automatic, not trinkgut');

  // Saft → REWE on Getränke …
  await A.click('button:has-text("Einsortieren")').catch(() => {});
  await A.getByText('Saft', { exact: true }).click(); await A.locator('button', { hasText: /^REWE$/ }).click();
  await waitText(A, 'Gemerkt: Saft künftig bei REWE');
  ok(true, 'toast: "Gemerkt: Saft künftig bei REWE"');
  let mem = {};
  for (let k = 0; k < 20 && !(mem.fields && mem.fields.stores); k++) { await A.waitForTimeout(250); mem = await (await fetch(REST + '/memory/saft', { headers: owner })).json(); }
  ok(mem.fields.stores.mapValue.fields.getraenke.stringValue === 'rewe' && !mem.fields.storeId, 'remembered for Getränke only');
  // … stays on Getränke …
  await fetch(REST + '/lists/getraenke/items/' + (await (async () => { const d = (await (await fetch(REST + '/lists/getraenke/items', { headers: owner })).json()).documents.find(x => x.fields.name.stringValue === 'Saft'); return d.name.split('/').pop(); })()), { method: 'DELETE', headers: owner });
  await A.waitForTimeout(600);
  await add(A, ['Saft']);
  await A.waitForTimeout(600);
  ok(await storeOf('getraenke', 'Saft') === 'rewe', 'Getränke: Saft again → REWE');
  // … and doesn't leak into Wocheneinkauf
  await switchTo(A, 'wocheneinkauf', 'Wocheneinkauf');
  await add(A, ['Saft']);
  await A.waitForTimeout(600);
  ok(await storeOf('wocheneinkauf', 'Saft') === null, 'Wocheneinkauf: Saft is automatic, not REWE');

  // The category is still shared
  const cat = async (listId, name) => ((await (await fetch(REST + '/lists/' + listId + '/items', { headers: owner })).json()).documents || []).find(x => x.fields.name.stringValue === name).fields.category.stringValue;
  ok(await cat('wocheneinkauf', 'Saft') === await cat('getraenke', 'Saft'), 'category of Saft is the same on both lists (' + await cat('wocheneinkauf', 'Saft') + ')');
  await A.screenshot({ path: SHOTS + 'store-memory.png' });
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
