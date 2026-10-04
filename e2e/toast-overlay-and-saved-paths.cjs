const { chromium, SHOTS, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const REST = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const A = await ctx.newPage();
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Bananen', 'Brot', 'Wasser', 'Saft', 'Chips', 'Cola']) { await A.fill(IN, t); await A.press(IN, 'Enter'); }
  await A.click('button:has-text("Einsortieren")'); await A.locator(IN).blur();
  for (const n of ['Wasser', 'Saft', 'Chips', 'Cola']) { await A.getByText(n, { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click(); }
  await A.waitForTimeout(3500);
  const check = n => A.locator('[role=checkbox]', { has: A.getByText(n, { exact: true }) }).click();

  // --- Bug: leave Brot on the list → notification at trinkgut must not shift the rows ---
  await A.click('.tab:has-text("Plan")'); await A.click('button:has-text("Einkauf starten bei Netto")');
  await check('Bananen');
  await A.click('button:has-text("Weiter zu trinkgut")');
  await A.click('button:has-text("Auf der Einkaufsliste lassen")');
  await A.getByText('Brot bleibt auf der Einkaufsliste').waitFor({ timeout: 3000 });
  await A.waitForTimeout(400);
  await A.screenshot({ path: SHOTS + '130-toast-overlay.png' });
  const yOf = async n => Math.round((await A.locator('[role=checkbox]', { has: A.getByText(n, { exact: true }) }).boundingBox()).y);
  const before = { Wasser: await yOf('Wasser'), Chips: await yOf('Chips') };
  // interact while the notification is visible: scroll a little
  await A.evaluate(() => { document.querySelector('.scroll').scrollTop = 30; }); await A.waitForTimeout(200);
  const scrolled = { Wasser: await yOf('Wasser'), Chips: await yOf('Chips') };
  await A.getByText('Brot bleibt auf der Einkaufsliste').waitFor({ state: 'detached', timeout: 6000 });
  await A.waitForTimeout(300);
  const after = { Wasser: await yOf('Wasser'), Chips: await yOf('Chips') };
  ok(after.Wasser === scrolled.Wasser && after.Chips === scrolled.Chips, 'rows do not move when the notification disappears (' + JSON.stringify(scrolled) + ' → ' + JSON.stringify(after) + ')');
  // tap the middle of "Chips" → Chips gets checked, not the item below
  const b = await A.locator('[role=checkbox]', { has: A.getByText('Chips', { exact: true }) }).boundingBox();
  await A.touchscreen.tap(b.x + 60, b.y + b.height / 2); await A.waitForTimeout(400);
  const checkedNames = await A.locator('[role=checkbox][aria-checked="true"]').allTextContents();
  ok(checkedNames.length === 1 && checkedNames[0].startsWith('Chips'), 'tap after the notification checks the tapped item: ' + JSON.stringify(checkedNames));
  // also on the list screen: notification floats, rows stay put
  await A.click('text=‹ Zum Plan'); await A.click('.tab:has-text("Liste")'); await A.waitForTimeout(500);

  // --- Request: stores from the tester form show the edit path ---
  await A.click('.tab:has-text("Plan")');
  await A.locator('.card', { hasText: 'Netto' }).locator('button[title="Mehr"]').click().catch(() => {});
  await A.click('button:has-text("Mit diesem Laden starten")').catch(async () => A.goto('http://127.0.0.1:4173/laden/netto'));
  await A.goto('http://127.0.0.1:4173/laden/netto'); await A.waitForTimeout(800);
  ok(await A.getByText('Aufbau der Filiale geändert?').count() === 1 && await A.getByText('Hilf mit, diese Filiale genauer zu machen').count() === 0, 'Netto shows "Aufbau der Filiale geändert?"');
  await A.click('text=Aufbau der Filiale geändert?'); await A.waitForTimeout(400);
  ok(await A.getByText('Was hat sich bei Netto geändert?').count() === 1, 'opens in edit mode');
  const chips = (await A.locator('button:has(span:text-matches("^[0-9]+$"))').allTextContents()).slice(0, 4);
  console.log('   first placed chips:', chips.join(' | '));
  ok(/^1.*Angebote/.test(chips[0]) && /^2.*Obst/.test(chips[1]) && /^3.*Gewürze/.test(chips[2]) && /^4.*Saucen/.test(chips[3]), 'shows the saved Netto path from the tester form');
  ok((await A.locator('.bottom-fade > button').last().textContent()) === 'Noch keine Änderung', 'nothing changed yet → "Noch keine Änderung"');
  await A.screenshot({ path: SHOTS + '131-netto-edit.png', fullPage: false });
  const introOk = await A.getByText(/^Gespeichert (heute|gestern|vor \d+ Tagen)\./).count();
  ok(introOk === 1, 'intro says when it was saved');
  // new store without a path still gets the setup offer
  await A.goto('http://127.0.0.1:4173/profil'); await A.click('button:has-text("Laden hinzufügen")');
  await A.fill('input[placeholder="z. B. Edeka"]', 'Bioladen'); await A.click('button:has-text("Laden speichern")'); await A.waitForTimeout(500);
  const st = await (await fetch(REST + '/stores', { headers: { Authorization: 'Bearer owner' } })).json();
  const bio = st.documents.find(d => d.fields.name.stringValue === 'Bioladen').name.split('/').pop();
  await A.goto('http://127.0.0.1:4173/laden/' + bio + '/weg'); await A.waitForTimeout(600);
  ok(await A.getByText('Wie läufst du durch Bioladen?').count() === 1, 'a new store without a path still opens in setup mode');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
