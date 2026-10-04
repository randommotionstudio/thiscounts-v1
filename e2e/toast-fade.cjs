const { chromium, SHOTS, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const A = await ctx.newPage();
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Bananen', 'Brot', 'Wasser']) { await A.fill(IN, t); await A.press(IN, 'Enter'); }
  await A.click('button:has-text("Einsortieren")'); await A.locator(IN).blur();
  await A.getByText('Wasser', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await A.waitForTimeout(3700);
  await A.click('.tab:has-text("Plan")'); await A.click('button:has-text("Einkauf starten bei Netto")');
  await A.locator('[role=checkbox]', { has: A.getByText('Bananen', { exact: true }) }).click();
  await A.click('button:has-text("Weiter zu trinkgut")');
  await A.click('button:has-text("Auf der Einkaufsliste lassen")');
  const t = A.locator('.toast-overlay'); await t.waitFor({ timeout: 3000 });
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 4200) {
    const o = await A.evaluate(() => { const e = document.querySelector('.toast-overlay'); return e ? +getComputedStyle(e).opacity : null; });
    samples.push([Date.now() - t0, o]); await A.waitForTimeout(40);
  }
  const mid = samples.filter(([, o]) => o != null && o > 0.05 && o < 0.95 && samples.indexOf([, o]) === -1);
  const fadingSamples = samples.filter(([ms, o]) => ms > 2500 && o != null && o > 0.05 && o < 0.95);
  console.log('   fade samples:', JSON.stringify(fadingSamples));
  ok(fadingSamples.length >= 2, 'green toast fades out gradually');
  ok(samples[samples.length - 1][1] === null, 'toast removed afterwards');
  // dark toast on the profile screen
  await A.goto('http://127.0.0.1:4173/profil'); await A.waitForTimeout(500);
  await browser.close();
})();
