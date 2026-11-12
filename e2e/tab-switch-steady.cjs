// Tester report: after a tab switch the content jumped a few pixels for a split second. The header was measured
// one frame late, so the first frame used an estimate. Now the content lands in its place right away.
const { chromium, phone, login, resetDb } = require('./lib.cjs');
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Bananen', 'Milch', 'Brot']) { await A.fill(IN, t); await A.press(IN, 'Enter'); await A.waitForTimeout(60); }
  await A.locator(IN).blur(); await A.waitForTimeout(800);
  // Record the content's top edge on every frame after a tab switch
  const rec = async tab => {
    await A.evaluate(() => {
      window.__f = []; let n = 0;
      const tick = () => { const s = document.querySelector('.scroll'); window.__f.push(s ? getComputedStyle(s).paddingTop : '-'); if (++n < 12) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await A.click('.tab:has-text("' + tab + '")'); await A.waitForTimeout(500);
    const f = await A.evaluate(() => window.__f);
    // One change is the switch itself; any further change is a jump
    const changes = f.filter(v => v !== '-').filter((v, i, arr) => i > 0 && v !== arr[i - 1]).length;
    console.log((changes <= 1 ? 'PASS ' : 'FAIL ') + tab + ': content lands in place without a jump (' + f.join(' ') + ')');
  };
  for (let i = 0; i < 3; i++) { await rec('Plan'); await rec('Profil'); await rec('Liste'); }
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
