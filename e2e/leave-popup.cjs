const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const REST = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const add = async (P, t) => { await P.fill(IN, t); await P.press(IN, 'Enter'); await P.waitForTimeout(80); await P.locator(IN).blur(); };
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
const docs = async () => { const j = await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: { Authorization: 'Bearer owner' } })).json(); return Object.fromEntries((j.documents || []).map(d => [d.fields.name.stringValue, { storeId: d.fields.storeId.stringValue || null, nextTrip: d.fields.nextTrip.booleanValue, checked: d.fields.checked.booleanValue }])); };
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: A } = await phone(browser);
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Bananen', 'Brot', 'Milch', 'Butter', 'Wasser']) await add(A, t);
  await A.click('button:has-text("Einsortieren")');
  await A.getByText('Wasser', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();

  // --- Trip 1: grab two things at Netto, leave the rest on the list ---
  await A.click('.tab:has-text("Plan")'); await A.click('button:has-text("Einkauf starten bei Netto")');
  await check(A, 'Bananen'); await check(A, 'Milch');
  await A.click('button:has-text("Weiter zu trinkgut")');
  await A.getByText('Noch 2 Artikel offen').waitFor({ timeout: 3000 }).then(() => ok(true, 'sheet: Noch 2 Artikel offen'), () => ok(false, 'sheet appears'));
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '110-leave-sheet.png' });
  ok(await A.getByText('Alle zu trinkgut mitnehmen').count() === 1 && await A.getByText('Auf der Einkaufsliste lassen').count() === 1, 'both options shown');
  await A.click('button:has-text("Auf der Einkaufsliste lassen")');
  await A.waitForTimeout(400);
  ok(A.url().includes('/laden/trinkgut') && await A.getByText('2 Artikel bleiben auf der Einkaufsliste').count() === 1, 'went on to trinkgut with toast');
  await check(A, 'Wasser'); await A.waitForTimeout(400);
  const lbl = await A.locator('button', { hasText: /Einkauf abschließen/ }).first().textContent();
  ok(lbl === 'Einkauf abschließen', 'at trinkgut the trip can be finished (no "Zurück zu Netto"): ' + lbl);
  let d = await docs();
  ok(d.Brot.storeId === null && d.Brot.nextTrip === true && d.Butter.nextTrip === true, 'Brot/Butter kept their store (automatic → Netto) and are off this trip');
  await A.click('button:has-text("Einkauf abschließen")');
  await A.waitForTimeout(600);
  d = await docs();
  ok(d.Brot && d.Butter && !d.Brot.nextTrip && !d.Butter.nextTrip && !d.Bananen && !d.Milch, 'after finishing: Brot & Butter back on the list, checked items gone');
  const brotRow = (await A.locator('div:has(> div > div > span:text-is("Brot"))').first().textContent()).replace(/\s+/g, ' ');
  ok(/Netto/.test(brotRow), 'Brot still shows its store on the list: ' + brotRow);

  // --- Trip 2: take them along to the next store ---
  await add(A, 'Saft'); await A.getByText('Saft', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await A.click('.tab:has-text("Plan")'); await A.click('button:has-text("Einkauf starten bei Netto")');
  await check(A, 'Brot');
  await A.click('button:has-text("Weiter zu trinkgut")');
  await A.getByText('Noch 1 Artikel offen').waitFor({ timeout: 3000 });
  await A.click('button:has-text("Alle zu trinkgut mitnehmen")');
  await A.waitForTimeout(500);
  ok(await A.getByText('Butter wandert zu trinkgut').count() === 1 && await A.locator('[role=checkbox]', { has: A.getByText('Butter', { exact: true }) }).count() === 1, 'Butter now at trinkgut');
  await A.screenshot({ path: SHOTS + '111-moved-along.png' });
  d = await docs();
  ok(d.Butter.storeId === 'trinkgut' && !d.Butter.nextTrip, 'Butter moved to trinkgut in the data');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
