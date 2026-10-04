const { chromium, BASE, phone, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: A } = await phone(browser);
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await A.fill(IN, 'Milch'); await A.press(IN, 'Enter'); await A.locator(IN).blur(); await A.waitForTimeout(600);
  await A.click('.tab:has-text("Plan")'); await A.click('text=Woanders einkaufen …');
  await A.locator('.sheet button:has(.logo-tile)', { hasText: 'REWE' }).click(); await A.waitForTimeout(700);
  await A.click('text=Aufbau der Filiale geändert?'); await A.waitForTimeout(500);
  ok(/\/laden\/rewe\/weg$/.test(A.url()), 'path editor opens');
  await A.click('text=‹ Zurück in den Laden'); await A.waitForTimeout(600);
  ok(/\/spontan\/rewe$/.test(A.url()), 'back returns to the spontaneous trip: ' + A.url().replace(BASE, ''));
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
