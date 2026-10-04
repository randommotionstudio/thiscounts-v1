const { chromium, SHOTS, phone, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const add = async (P, t) => { await P.fill(IN, t); await P.press(IN, 'Enter'); await P.waitForTimeout(80); await P.locator(IN).blur(); };
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: A } = await phone(browser);
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Bananen', 'Brot', 'Milch']) await add(A, t);
  await A.click('.tab:has-text("Plan")'); await A.click('button:has-text("Einkauf starten bei Netto")');
  await check(A, 'Bananen'); await A.waitForTimeout(300);
  await A.click('button:has-text("Einkauf abschließen (2 offen)")');
  await A.getByText('Noch 2 Artikel offen').waitFor({ timeout: 3000 }).then(() => ok(true, 'popup at the last store'), () => ok(false, 'popup at the last store'));
  ok(await A.getByText(/mitnehmen/).count() === 0 && await A.getByText('Auf der Einkaufsliste lassen').count() === 1, 'only the "Auf der Einkaufsliste lassen" option');
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '112-last-store-sheet.png' });
  // closing with × keeps you in the store
  await A.click('button[aria-label="Schließen"]'); await A.waitForTimeout(200);
  ok(A.url().includes('/laden/netto'), '× keeps you in the store');
  await A.click('button:has-text("Einkauf abschließen (2 offen)")');
  await A.click('button:has-text("Auf der Einkaufsliste lassen")');
  await A.waitForTimeout(600);
  ok(new URL(A.url()).pathname === '/' && await A.getByText('Einkauf abgeschlossen · 1 Artikel erledigt').count() === 1, 'trip finished, back on the list');
  ok(await A.getByText('Brot', { exact: true }).count() === 1 && await A.getByText('Milch', { exact: true }).count() === 1 && await A.getByText('Bananen', { exact: true }).count() === 0, 'open items stay on the list, checked one is gone');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
