const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const REST = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const add = async (P, t) => { await P.fill(IN, t); await P.press(IN, 'Enter'); await P.waitForTimeout(80); await P.locator(IN).blur(); };
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
const itemDoc = async name => { const j = await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: { Authorization: 'Bearer owner' } })).json(); const d = (j.documents || []).find(x => x.fields.name.stringValue === name); return d && { nextTrip: d.fields.nextTrip.booleanValue, pending: d.fields.pendingDecision.booleanValue }; };
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, 'Bananen'); await add(A, 'Wasser');
  await A.getByText('Wasser', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await waitText(B, 'Wasser');
  // B finishes Netto, but leaves via the Plan instead of "Weiter zu …"
  await B.click('.tab:has-text("Plan")'); await B.click('button:has-text("Einkauf starten bei Netto")');
  await check(B, 'Bananen');
  await B.click('text=‹ Zum Plan');
  await B.click('button:has-text("Weiter einkaufen bei trinkgut")');
  await B.waitForTimeout(600);
  await add(A, 'Butter');
  await A.getByText('Anna ist schon bei trinkgut').waitFor({ timeout: 5000 }).then(() => ok(true, 'store left via the Plan counts as done → Rückfrage'), () => ok(false, 'Rückfrage after leaving via Plan'));
  // Question left open while B finishes the trip → sheet closes, item simply goes on the list
  await check(B, 'Wasser');
  await B.click('button:has-text("Einkauf abschließen")');
  await A.getByText('Anna ist schon bei trinkgut').waitFor({ state: 'detached', timeout: 8000 }).then(() => ok(true, 'sheet closes when the shopper finishes'), () => ok(false, 'sheet closes when the shopper finishes'));
  await A.waitForTimeout(800);
  const bu = await itemDoc('Butter');
  ok(bu && !bu.nextTrip && !bu.pending, 'Butter is a normal item afterwards (not held for another trip): ' + JSON.stringify(bu));

  // Held item from an unfinished trip comes back when a new trip starts
  await B.click('.tab:has-text("Plan")'); await B.click('button:has-text("Einkauf starten bei Netto")');
  await check(B, 'Butter');
  await B.click('button:has-text("Einkauf abschließen")').catch(() => {});
  await B.waitForTimeout(300);
  await add(A, 'Salz'); await add(A, 'Saft');
  await A.getByText('Saft', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await B.click('.tab:has-text("Plan")'); await B.click('button:has-text("Einkauf starten bei Netto")');
  await check(B, 'Salz'); await B.click('button:has-text("Weiter zu trinkgut")'); await B.waitForTimeout(500);
  await add(A, 'Senf');
  await A.getByText('Anna ist schon bei trinkgut').waitFor({ timeout: 5000 });
  await A.click('button:has-text("Beim nächsten Netto-Einkauf")'); await A.waitForTimeout(500);
  ok((await itemDoc('Senf')).nextTrip === true, 'Senf held for next trip');
  // Trip abandoned: B's session goes stale (backdate it), then B starts a new trip
  const old = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const sess = await (await fetch(REST + '/sessions', { headers: { Authorization: 'Bearer owner' } })).json();
  for (const d of sess.documents || []) await fetch('http://127.0.0.1:8080/v1/' + d.name + '?updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=startedAt', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { updatedAt: { timestampValue: old }, startedAt: { timestampValue: old } } }) });
  const B2 = await b.ctx.newPage(); await B.close();
  await B2.goto('http://127.0.0.1:4173/plan'); await B2.waitForSelector('text=Deine Route');
  await B2.locator('.card', { hasText: 'Netto' }).locator('button[title="Mehr"]').click().catch(() => {});
  await B2.click('button:has-text("Mit diesem Laden starten")').catch(async () => { await B2.click('button:has-text("Einkauf starten bei")'); });
  await B2.waitForTimeout(1200);
  ok((await itemDoc('Senf')).nextTrip === false, 'new trip after an abandoned one: held item is back');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
