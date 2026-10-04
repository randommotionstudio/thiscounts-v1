const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); } await p.locator(IN).blur(); }
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  A.on('console', () => {}); 
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['5 Bananen', 'Brot', 'Hafermilch 2 l']);
  await waitText(B, 'Hafermilch');

  // Offline: finish a whole trip
  await a.ctx.setOffline(true);
  await A.click('.tab:has-text("Plan")');
  await A.click('button:has-text("Einkauf starten bei Netto")');
  for (const n of ['Bananen', 'Hafermilch']) await A.getByText(n, { exact: true }).click();
  await A.locator('div:has(> div > div > div:text-is("Brot"))').locator('button:has-text("Nicht gefunden")').click();
  await A.click('button:has-text("Zurück auf die Einkaufsliste setzen")');
  await A.waitForTimeout(200);
  await A.screenshot({ path: SHOTS + '30-A-after-park.png' });
  await A.click('button:has-text("Einkauf abschließen")');
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '31-A-finished-offline.png' });
  ok(await B.getByText('Bananen', { exact: true }).count() > 0, 'B still has Bananen while A offline');
  await a.ctx.setOffline(false);
  await B.getByText('Bananen', { exact: true }).waitFor({ state: 'detached', timeout: 15000 });
  ok(true, 'B: finished items removed after sync');
  await B.waitForTimeout(500);
  await B.screenshot({ path: SHOTS + '32-B-after-finish.png' });
  const brotB = (await B.locator('div:has(> div > div > span:text-is("Brot"))').first().textContent()).replace(/\s+/g, ' ');
  ok(/Offen · Laden wählen/.test(brotB), 'B: Brot is parked: ' + brotB);
  // usual chips from history: focus input
  await A.click(IN);
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '33-A-chips-history.png' });
  // Bought on one trip only: not a standing suggestion, but offered while typing
  ok(await A.locator('button:has(span:text-is("Hafermilch"))').count() === 0, 'Hafermilch (1 trip) is not a usual chip yet');
  await A.fill(IN, 'Hafer'); await A.waitForTimeout(300);
  ok(await A.locator('button:has(span:text-is("Hafermilch"))').count() > 0, 'typing "Hafer" offers Hafermilch from history');
  await A.fill(IN, '');
  await A.locator(IN).blur();

  // Category sheet: Brot → Frühstück (remembered)
  await A.locator('div:has(> div > div > span:text-is("Brot"))').locator('button[title="Kategorie ändern"]').click();
  await A.waitForTimeout(200);
  await A.screenshot({ path: SHOTS + '34-A-dept-sheet.png' });
  await A.click('button:has-text("Frühstück")');
  await add(A, ['Bananen']);
  await A.click('button:has-text("Einsortieren")');
  // Qty sheet
  await A.locator('div:has(> div > div > span:text-is("Bananen"))').locator('button[title="Menge ändern"]').click();
  await A.click('button[aria-label="Mehr"]'); await A.click('button[aria-label="Mehr"]');
  await A.screenshot({ path: SHOTS + '35-A-qty-sheet.png' });
  await A.click('button:has-text("speichern")');
  await add(A, ['Zahnpasta', 'Wasser']);
  // Duplicate → opens qty sheet
  await A.fill(IN, 'bananen');
  await A.waitForTimeout(200);
  await A.screenshot({ path: SHOTS + '36-A-search-dup.png' });
  await A.press(IN, 'Enter');
  await A.waitForTimeout(200);
  ok(await A.getByText('Menge ändern').count() > 0, 'duplicate entry opens the quantity sheet');
  await A.click('button[aria-label="Schließen"]');
  // Assign Wasser → trinkgut, Zahnpasta → DM, then plan sorting
  await A.getByText('Wasser', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await A.getByText('Zahnpasta', { exact: true }).click(); await A.locator('button', { hasText: /^DM$/ }).click();
  await A.click('.tab:has-text("Plan")');
  await A.click('button:has-text("Ändern")');
  await A.waitForTimeout(200);
  await A.screenshot({ path: SHOTS + '37-A-plan-sort.png' });
  // move trinkgut up
  await A.locator('.card:has-text("trinkgut")').locator('button[title="Nach oben"]').click();
  await A.click('button:has-text("Fertig")');
  await A.waitForTimeout(300);
  const order = await A.locator('.card .ellipsis').allTextContents();
  ok(order.join('|').indexOf('trinkgut') < order.join('|').indexOf('DM'), 'trip order: trinkgut before DM');
  await A.screenshot({ path: SHOTS + '38-A-plan-trip.png' });
  // Defer Netto via menu → goes to end
  await A.locator('.card:has-text("Netto")').locator('button[title="Mehr"]').click();
  await A.waitForTimeout(150);
  await A.screenshot({ path: SHOTS + '39-A-plan-menu.png' });
  await A.click('button:has-text("Später erledigen")');
  await A.waitForTimeout(300);
  const order2 = (await A.locator('.card .ellipsis').allTextContents()).filter(t => /Netto|DM|trinkgut/.test(t) && t.length < 12);
  ok(order2[order2.length - 1] === 'Netto', 'deferred Netto is last: ' + order2.join(' → '));
  await A.click('button:has-text("Zurücksetzen")');

  // Create a new list
  await A.click('.tab:has-text("Liste")');
  await A.click('h1:has-text("Wocheneinkauf")');
  await A.waitForTimeout(200);
  await A.screenshot({ path: SHOTS + '40-A-list-menu.png' });
  await A.click('button:has-text("Neue Liste erstellen")');
  await A.fill('input[placeholder="z. B. Auf dem Heimweg"]', 'Getränke');
  await A.screenshot({ path: SHOTS + '41-A-new-list.png' });
  await A.click('button:has-text("Weiter zu den Läden")');
  await A.locator('.card:has-text("trinkgut")').click();
  await A.locator('.card:has-text("REWE")').click();
  await A.locator('.card:has-text("Edeka")').click();
  await A.click('button:has-text("Laden hinzufügen")');
  await A.fill('input[placeholder="z. B. Edeka"]', 'Apotheke am Markt');
  await A.screenshot({ path: SHOTS + '42-A-new-store-sheet.png' });
  await A.click('button:has-text("Laden speichern")');
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '43-A-stores-setup.png', fullPage: true });
  await A.click('button:has-text("„Getränke“ erstellen")');
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '44-A-new-list-created.png' });
  ok(await A.locator('h1:has-text("Getränke")').count() === 1, 'new list is active');
  await A.goBack(); await A.waitForTimeout(600);
  ok(new URL(A.url()).pathname === '/' && await A.locator('h1:has-text("Wocheneinkauf")').count() === 0, 'back after creating skips the setup screens: ' + A.url());
  await A.goForward().catch(() => {}); await A.waitForTimeout(300);
  if (new URL(A.url()).pathname !== '/') { await A.goto('http://127.0.0.1:4173/'); }
  await A.waitForSelector('h1:has-text("Getränke")');
  // B sees new list in menu
  await B.click('h1:has-text("Wocheneinkauf")');
  await waitText(B, 'Getränke');
  ok(true, 'B sees the new list');
  await B.screenshot({ path: SHOTS + '45-B-list-menu.png' });
  await B.click('div[style*="inset: 0"] >> nth=0').catch(() => {});

  // Edit list: rename + delete
  await A.click('h1:has-text("Getränke")');
  await A.locator('button[title="Liste bearbeiten"]').nth(1).click();
  await A.screenshot({ path: SHOTS + '46-A-edit-list.png' });
  // zero-store guard: deselect all stores, go back → cannot save
  await A.click('div.card:has-text("Läden")');
  for (const n of ['Edeka', 'REWE', 'trinkgut', 'Apotheke am Markt']) await A.locator('.card', { hasText: n }).first().click();
  await A.click('button:has-text("Zurück")');
  await A.waitForTimeout(200);
  ok(await A.getByText('Mindestens einen Laden wählen').count() > 0, 'edit: cannot save a list without stores');
  await A.click('button:has-text("Mindestens einen Laden wählen")');
  ok(await A.getByText('Liste bearbeiten').count() > 0, 'still on edit screen');
  await A.click('button:has-text("Liste löschen")');
  await A.screenshot({ path: SHOTS + '47-A-delete-confirm.png' });
  await A.click('button:has-text("Löschen")');
  await A.waitForTimeout(300);
  ok(await A.locator('h1:has-text("Wocheneinkauf")').count() === 1, 'after delete, back on Wocheneinkauf');

  // Profile
  await A.click('.tab:has-text("Profil")');
  await A.waitForTimeout(200);
  await A.screenshot({ path: SHOTS + '48-A-profile.png', fullPage: true });
  await A.click('div:text-is("Apotheke am Markt")');
  await A.screenshot({ path: SHOTS + '49-A-edit-store.png' });
  await A.click('button:has-text("Laden löschen")');
  await A.waitForTimeout(300);
  ok(await A.getByText('Apotheke am Markt', { exact: true }).count() === 0, 'store deleted');

  // Denied account
  const c = await phone(browser);
  await login(c.page, 'fremd@example.com');
  await c.page.waitForTimeout(3000);
  await c.page.screenshot({ path: SHOTS + '50-denied.png' });
  ok(await c.page.getByText('keinen Zugriff').count() > 0, 'foreign account is denied');
  // wrong password
  const d = await phone(browser);
  await d.page.goto('http://127.0.0.1:4173/');
  await d.page.fill('input[type=email]', 'michael@rieplhuber.com'); await d.page.fill('input[type=password]', 'falsch');
  await d.page.click('button:has-text("Anmelden")');
  await d.page.waitForTimeout(1500);
  await d.page.screenshot({ path: SHOTS + '51-wrong-pw.png' });
  ok(await d.page.getByText('stimmt nicht').count() > 0, 'wrong password message');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
