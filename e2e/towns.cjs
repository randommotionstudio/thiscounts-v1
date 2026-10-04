// V1.4 towns: Netto in Prien and Frasdorf, a bakery only in Frasdorf, a trip in Frasdorf
const { chromium, SHOTS, BASE, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const auth = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const get = async p => (await fetch(H + p, { headers: auth })).json();
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Milch', 'Brot', 'Shampoo', 'Semmeln']) { await A.fill(IN, t); await A.press(IN, 'Enter'); }
  await A.click('button:has-text("Einsortieren")').catch(() => {}); await A.locator(IN).blur();
  await A.getByText('Brot', { exact: true }).click(); await A.locator('button', { hasText: /^Edeka$/ }).click();
  await A.getByText('Shampoo', { exact: true }).click(); await A.locator('button', { hasText: /^DM$/ }).click();
  await A.waitForTimeout(3600);
  await A.click('.tab:has-text("Plan")'); await A.waitForTimeout(300);
  ok(await A.locator('button[aria-label^="Ort wählen"]').count() === 0, 'one town: no town choice in the Plan');

  // --- Netto also in Frasdorf (first extra town: names the home town too) ---
  await A.click('.tab:has-text("Profil")'); await A.waitForTimeout(300);
  await A.locator('div', { hasText: /^NettoHochriesstraße/ }).last().click(); await A.waitForTimeout(300);
  await A.click('text=+ Filiale in einem anderen Ort');
  await A.fill('input[aria-label="Name des neuen Orts"]', 'Frasdorf');
  const guess = await A.inputValue('input[aria-label="Name des bisherigen Orts"]');
  ok(guess === 'Prien am Chiemsee', 'home town pre-filled from the addresses: ' + guess);
  await A.fill('input[aria-label="Name des bisherigen Orts"]', 'Prien');
  await A.screenshot({ path: SHOTS + '200-add-branch.png' });
  await A.click('button:has-text("Filiale hinzufügen")');
  await A.fill('input[aria-label="Adresse in Frasdorf"]', 'Hauptstraße 3, 83112 Frasdorf');
  await A.screenshot({ path: SHOTS + '201-store-branches.png' });
  await A.click('button:has-text("Laden speichern")'); await A.waitForTimeout(1000);
  const hh = await get('');
  const towns = hh.fields.towns.arrayValue.values.map(v => ({ id: v.mapValue.fields.id.stringValue, name: v.mapValue.fields.name.stringValue }));
  ok(towns.map(t => t.name).join(',') === 'Prien,Frasdorf', 'household towns: ' + towns.map(t => t.name).join(', '));
  const fr = towns[1].id;
  const netto = await get('/stores/netto');
  ok(netto.fields.branches.mapValue.fields[fr].mapValue.fields.address.stringValue === 'Hauptstraße 3, 83112 Frasdorf', 'Netto has a Frasdorf branch');
  await A.screenshot({ path: SHOTS + '205-profile-towns.png', fullPage: true });
  ok(await A.getByText('Prien · Frasdorf').count() === 1 && await A.getByText(/^\d+ Läden · Heimatort$/).count() === 1, 'Profile: Netto "Prien · Frasdorf", Orte section with Heimatort');

  // --- A bakery only in Frasdorf ---
  await A.click('button:has-text("Laden hinzufügen")'); await A.waitForTimeout(300);
  await A.fill('input[placeholder="z. B. Edeka"]', 'Bäckerei Huber');
  await A.locator('.sheet button', { hasText: /^Frasdorf$/ }).click();
  await A.click('button:has-text("Laden speichern")'); await A.waitForTimeout(800);
  const stores = (await get('/stores')).documents;
  const bk = stores.find(d => d.fields.name.stringValue === 'Bäckerei Huber');
  ok(bk && bk.fields.town.stringValue === fr, 'bakery belongs to Frasdorf');
  const bkId = bk.name.split('/').pop();
  // put it on the list and give Semmeln to it
  const L = await get('/lists/wocheneinkauf');
  const ids = L.fields.storeIds.arrayValue.values.map(v => v.stringValue);
  await fetch(H + '/lists/wocheneinkauf?updateMask.fieldPaths=storeIds', { method: 'PATCH', headers: auth, body: JSON.stringify({ fields: { storeIds: { arrayValue: { values: [...ids, bkId].map(s => ({ stringValue: s })) } } } }) });
  await A.click('.tab:has-text("Liste")'); await A.waitForTimeout(800);
  await A.getByText('Semmeln', { exact: true }).click(); await A.locator('button', { hasText: /^Bäckerei Huber$/ }).click(); await A.waitForTimeout(3600);

  // --- Plan in Prien (home) ---
  await A.click('.tab:has-text("Plan")'); await A.waitForTimeout(500);
  const chipA = A.locator('button[aria-label^="Ort wählen"]');
  ok(await chipA.textContent() === 'in Prien', 'Plan starts in the home town: ' + await chipA.textContent());
  const stopNames = async P => (await P.locator('.card .ellipsis[style*="font-weight: 600"]').allTextContents());
  let s1 = await stopNames(A);
  ok(s1.slice(0, 3).join(',') === 'Netto,Edeka,DM', 'Prien route: ' + s1.join(', '));
  let txt = await A.locator('.scroll').innerText();
  ok(/Gibt’s in Prien nicht/.test(txt) && /Bäckerei Huber/.test(txt) && /gibt’s in Frasdorf/.test(txt) && /Semmeln/.test(txt), 'Prien: Semmeln wait under "Gibt’s in Prien nicht" (bakery: gibt’s in Frasdorf)');

  // --- Switch to Frasdorf ---
  await chipA.click(); await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '202-town-sheet.png' });
  await A.locator('.sheet button', { hasText: /^Frasdorf/ }).click(); await A.waitForTimeout(600);
  ok(await A.getByText('Edeka und DM gibt’s in Frasdorf nicht').count() === 1, 'asked about stand-ins for Edeka and DM');
  await A.click('button:has-text("Nein, auf der Liste lassen")'); await A.waitForTimeout(400);
  ok(await chipA.textContent() === 'in Frasdorf', 'chip shows Frasdorf');
  s1 = await stopNames(A);
  txt = await A.locator('.scroll').innerText();
  ok(s1.slice(0, 2).join(',') === 'Netto,Bäckerei Huber' && /Hauptstraße 3, 83112 Frasdorf/.test(txt), 'Frasdorf route: Netto (Frasdorf address), Bäckerei Huber');
  ok(/Gibt’s in Frasdorf nicht/.test(txt) && /Brot/.test(txt) && /Shampoo/.test(txt), 'Edeka and DM items wait in Frasdorf');
  await A.screenshot({ path: SHOTS + '203-plan-frasdorf.png', fullPage: true });
  // B is unaffected (per person)
  await B.click('.tab:has-text("Plan")'); await B.waitForTimeout(800);
  ok(await B.locator('button[aria-label^="Ort wählen"]').textContent() === 'in Prien', 'Anna’s plan is still in Prien');

  // --- Trip in Frasdorf ---
  await A.click('button:has-text("Einkauf starten bei Netto")'); await A.waitForTimeout(800);
  ok(await A.getByText('Hauptstraße 3, 83112 Frasdorf').count() === 1, 'store mode shows the Frasdorf branch');
  ok(await A.getByText('Hilf mit, diese Filiale genauer zu machen').count() === 1, 'new branch: offer to set up its path');
  await B.click('.tab:has-text("Liste")'); await B.waitForTimeout(1200);
  ok(await B.getByText(/Netto Frasdorf · Stopp 1 von 2/).count() === 1, 'Anna’s live card: Netto Frasdorf · Stopp 1 von 2');
  // set up the Frasdorf path: Milchprodukte first, nothing else here
  await A.click('text=Hilf mit, diese Filiale genauer zu machen'); await A.waitForTimeout(400);
  ok(await A.getByText('Wie läufst du durch Netto Frasdorf?').count() === 1, 'path editor names the branch');
  for (const d of ['Milchprodukte', 'Backwaren']) await A.locator('button', { hasText: d }).last().click();
  await A.click('text=Ich bestätige, dass es diese Abteilungen in dieser Filiale nicht gibt.');
  await A.locator('.bottom-fade > button').last().click(); await A.waitForTimeout(800);
  const n2 = await get('/stores/netto');
  const brOrder = n2.fields.branches.mapValue.fields[fr].mapValue.fields.categoryOrder.arrayValue.values.map(v => v.stringValue);
  const homeOrder = n2.fields.categoryOrder.arrayValue.values.map(v => v.stringValue);
  ok(brOrder.join(',') === 'Milchprodukte,Backwaren', 'Frasdorf path saved on the branch: ' + brOrder.join(', '));
  ok(homeOrder[0] === 'Angebote' && homeOrder.length > 10, 'Prien path untouched (' + homeOrder.length + ' stops)');
  ok(/\/laden\/netto$/.test(A.url()) && await A.getByText('Aufbau der Filiale geändert?').count() === 1, 'back in Netto Frasdorf, now set up');
  await A.locator('[role=checkbox]', { has: A.getByText('Milch', { exact: true }) }).click();
  await A.locator('.bottom-fade button', { hasText: 'Weiter zu Bäckerei Huber' }).click(); await A.waitForTimeout(600);
  await A.locator('[role=checkbox]', { has: A.getByText('Semmeln', { exact: true }) }).click();
  await A.locator('.bottom-fade button', { hasText: 'Einkauf abschließen' }).click(); await A.waitForTimeout(1200);
  const left = (await get('/lists/wocheneinkauf/items')).documents.map(d => d.fields.name.stringValue).sort();
  ok(left.join(',') === 'Brot,Shampoo', 'after the Frasdorf trip Brot + Shampoo are still on the list: ' + left.join(', '));
  await A.click('.tab:has-text("Plan")'); await A.waitForTimeout(400);
  ok(await A.locator('button[aria-label^="Ort wählen"]').textContent() === 'in Prien', 'next trip starts in Prien again');
  // Woanders einkaufen lists stores per town
  await A.click('text=Woanders einkaufen …'); await A.waitForTimeout(300);
  const sheetTxt = await A.locator('.sheet').innerText();
  ok(/IN PRIEN|In Prien/i.test(sheetTxt) && /IN FRASDORF|In Frasdorf/i.test(sheetTxt), 'Woanders einkaufen: grouped by town');
  await A.screenshot({ path: SHOTS + '204-elsewhere-towns.png' });
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
