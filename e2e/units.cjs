// Typing items with written-out units ("2 Liter Laktosefreie Milch") and the +/- amount sheet
const { chromium, SHOTS, phone, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: P } = await phone(browser);
  await login(P, 'michael@rieplhuber.com'); await P.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['2 Liter Laktosefreie Milch', '500 Gramm Mehl', '1 Glas Honig', 'Orangensaft 1,5 Liter']) { await P.fill(IN, t); await P.press(IN, 'Enter'); }
  await P.locator(IN).blur(); await P.waitForTimeout(1500);
  const docs = (await (await fetch(H + '/lists/wocheneinkauf/items', { headers: { Authorization: 'Bearer owner' } })).json()).documents || [];
  const got = Object.fromEntries(docs.map(d => [d.fields.name.stringValue, d.fields.qty.stringValue]));
  ok(got['Laktosefreie Milch'] === '2 l', '"2 Liter Laktosefreie Milch" → Laktosefreie Milch, 2 l: ' + JSON.stringify(got['Laktosefreie Milch']));
  ok(got['Mehl'] === '500 g', '"500 Gramm Mehl" → 500 g');
  ok(got['Honig'] === '1 Glas', '"1 Glas Honig" → 1 Glas');
  ok(got['Orangensaft'] === '1,5 l', '"Orangensaft 1,5 Liter" → 1,5 l');
  ok(!Object.keys(got).some(n => /^(Liter|Gramm|Glas)\b/.test(n)), 'no unit left in a name: ' + Object.keys(got).join(', '));
  await P.screenshot({ path: SHOTS + 'units-list.png' });
  // +/- in the amount sheet: 1 Glas → 2 Gläser
  await P.getByText('1 Glas', { exact: true }).click(); await P.waitForTimeout(400);
  await P.locator('.sheet button', { hasText: '+' }).first().click(); await P.waitForTimeout(200);
  const save = await P.locator('.sheet button', { hasText: 'speichern' }).textContent();
  ok(save === '2 Gläser speichern', 'stepping up: ' + save);
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
