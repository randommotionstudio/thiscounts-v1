// "Neu von …" markers across app restarts, and a store path saved offline reaching the server
const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const add = async (P, t) => { await P.fill(IN, t); await P.press(IN, 'Enter'); await P.locator(IN).blur(); };
const marker = (P, name) => P.locator('div:has(> span:text-is("' + name + '")) [aria-label="Neu von Michi"]').count();
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page; let B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, 'Brot'); await waitText(B, 'Brot'); await B.waitForTimeout(300);
  ok(await marker(B, 'Brot') === 1, 'marker while B has the app open');
  // B closes the app; A adds Kaffee meanwhile; B reopens (cold start)
  await B.close(); await A.waitForTimeout(300);
  await add(A, 'Kaffee'); await A.waitForTimeout(500);
  B = await b.ctx.newPage(); await B.goto('http://127.0.0.1:4173/'); await B.waitForSelector('text=Kaffee');
  await B.waitForTimeout(300);
  ok(await marker(B, 'Kaffee') === 1 && await marker(B, 'Brot') === 1, 'quick restart keeps all markers');
  // Now B is away for 11 minutes: close, backdate hiddenAt, reopen
  await B.close(); await add(A, 'Tee'); await A.waitForTimeout(400);
  B = await b.ctx.newPage(); await B.goto('http://127.0.0.1:4173/'); await B.waitForSelector('text=Tee');
  await B.evaluate(() => { localStorage.setItem('thisCounts.hiddenAt', String(Date.now() - 11 * 60 * 1000 - 5000)); });
  // (the page itself just loaded, so simulate the next cold start)
  await B.close(); B = await b.ctx.newPage();
  await B.addInitScript(() => { const h = Number(localStorage.getItem('thisCounts.hiddenAt')); if (Date.now() - h < 60000) localStorage.setItem('thisCounts.hiddenAt', String(Date.now() - 11 * 60 * 1000)); });
  await B.goto('http://127.0.0.1:4173/'); await B.waitForSelector('text=Tee'); await B.waitForTimeout(300);

  // Offline refine save syncs afterwards. Seeded stores count as set up, so give Edeka no path first (→ setup mode).
  await fetch('http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main/stores/edeka?updateMask.fieldPaths=categoryOrder&updateMask.fieldPaths=orderSetAt&updateMask.fieldPaths=orderCheckedAt', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { categoryOrder: { nullValue: null }, orderSetAt: { nullValue: null }, orderCheckedAt: { nullValue: null } } }) });
  await A.waitForTimeout(1000);
  await a.ctx.setOffline(true);
  await A.goto('http://127.0.0.1:4173/laden/edeka/weg').catch(() => {});
  await A.waitForSelector('text=Dein Weg', { timeout: 10000 });
  for (const d of ['Backwaren', 'Frühstück']) await A.locator('button', { hasText: d }).last().click();
  await A.click('text=Ich bestätige, dass es diese Abteilungen in dieser Filiale nicht gibt.');
  await A.click('button:has-text("Reihenfolge speichern")');
  await A.waitForTimeout(300);
  await a.ctx.setOffline(false);
  let ord = null;
  for (let k = 0; k < 20 && !ord; k++) {
    await A.waitForTimeout(500);
    const st = await (await fetch('http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main/stores/edeka', { headers: { Authorization: 'Bearer owner' } })).json();
    const v = st.fields.categoryOrder && st.fields.categoryOrder.arrayValue && st.fields.categoryOrder.arrayValue.values;
    if (v && v.length === 2) ord = v.map(x => x.stringValue).join(', ');
  }
  ok(ord === 'Backwaren, Frühstück', 'refine saved offline reaches the server: ' + ord);
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
