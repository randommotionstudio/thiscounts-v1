const { chromium, SHOTS, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  for (const [w, h] of [[375, 812], [320, 568]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const P = await ctx.newPage();
    await login(P, 'michael@rieplhuber.com'); await P.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
    if (w === 375) for (const t of ['Rotwein', 'Tofu']) { await P.fill(IN, t); await P.press(IN, 'Enter'); }
    await P.locator(IN).blur(); await P.waitForTimeout(800);
    if (w === 375) {
      const txt = await P.locator('.scroll').innerText();
      ok(/Wein & Spirituosen/i.test(txt) && /Kühltheke/i.test(txt), 'Rotwein → Wein & Spirituosen, Tofu → Kühltheke');
    }
    await P.locator('button[title="Kategorie ändern"]').first().click(); await P.waitForTimeout(600);
    const res = await P.evaluate(() => [...document.querySelectorAll('.sheet button > span:last-child')].map(s => {
      const cs = getComputedStyle(s), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
      return { t: s.textContent, lines: Math.round(s.getBoundingClientRect().height / lh), cut: s.scrollWidth > s.clientWidth + 1 || s.getBoundingClientRect().right > s.parentElement.getBoundingClientRect().right - 2 };
    }));
    const tiles = res.length;
    const bad = res.filter(r => r.lines > 2 || r.cut);
    console.log('   ' + w + 'px: ' + tiles + ' tiles; 2-line: ' + res.filter(r => r.lines === 2).map(r => r.t).join(', '));
    ok(tiles === 24, w + 'px: 24 categories (even)');
    ok(!bad.length, w + 'px: nothing cut off or on 3 lines' + (bad.length ? ': ' + JSON.stringify(bad) : ''));
    await P.locator('.sheet button', { hasText: 'Wein' }).scrollIntoViewIfNeeded();
    await P.screenshot({ path: SHOTS + '175-picker-' + w + '.png' });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
