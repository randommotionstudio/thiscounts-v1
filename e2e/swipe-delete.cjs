const { chromium, SHOTS, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  // iPhone 12 mini size, real touch input
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const A = await ctx.newPage();
  A.on('pageerror', e => console.log('[pageerror]', e.message));
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  const names = ['Bananen', 'Brot', 'Milch', 'Butter', 'Käse', 'Joghurt', 'Nudeln', 'Reis', 'Mehl', 'Zucker', 'Kaffee', 'Tee', 'Wasser', 'Saft'];
  for (const t of names) { await A.fill(IN, t); await A.press(IN, 'Enter'); }
  await A.click('button:has-text("Einsortieren")'); await A.locator(IN).blur(); await A.waitForTimeout(400);
  await A.evaluate(() => { window.__log = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(t, e => window.__log.push(t + '@' + (e.target && e.target.tagName) + (e.target && e.target.textContent ? '(' + e.target.textContent.slice(0, 12) + ')' : '')), true); });
  const log = async label => console.log('   ' + label + ' → ' + await A.evaluate(() => { const x = window.__log.join(' | '); window.__log = []; return x; }));
  const cdp = await ctx.newCDPSession(A);
  const touch = async (pts) => { // pts: [[x,y],...]; start, moves, end
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const [x, y] of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await A.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await A.waitForTimeout(350);
  };
  const rowBox = async name => (await A.locator('div:has(> div > div > span:text-is("' + name + '"))').first().boundingBox());
  const center = async name => { await A.locator('div:has(> div > div > span:text-is("' + name + '"))').first().evaluate(el => el.scrollIntoView({ block: 'center' })); await A.waitForTimeout(250); return rowBox(name); };
  const delVisible = async name => { const b = await A.locator('button[aria-label="' + name + ' löschen"]').boundingBox(); const r = await rowBox(name); return { btn: b, row: r }; };
  ok(await A.getByText('×', { exact: true }).count() === 0, 'no × buttons in the rows anymore');

  // 1. horizontal swipe left on "Brot" reveals Löschen, store options stay closed
  let r = await center('Brot');
  const y = r.y + r.height / 2;
  await touch([[r.x + r.width - 40, y], [r.x + r.width - 60, y + 1], [r.x + r.width - 90, y + 2], [r.x + r.width - 130, y + 2], [r.x + r.width - 160, y + 3]]);
  r = await rowBox('Brot');
  ok(r.x < 20 - 60, 'row slid left after swipe (x=' + Math.round(r.x) + ')');
  ok(await A.getByText('Automatisch (Netto)').count() === 0, 'swipe did not open the store options');
  await log('swipe Brot');
  await A.screenshot({ path: SHOTS + '120-swipe-revealed.png' });

  // 2. a second row swipe closes the first
  let r2 = await center('Milch'); const y2 = r2.y + r2.height / 2;
  await touch([[r2.x + r2.width - 40, y2], [r2.x + r2.width - 80, y2], [r2.x + r2.width - 140, y2], [r2.x + r2.width - 170, y2]]);
  await log('swipe Milch');
  const bx = (await rowBox('Brot')).x, mx = (await rowBox('Milch')).x;
  ok(bx > 15 && mx < -40, 'only one row open at a time (Brot x=' + Math.round(bx) + ', Milch x=' + Math.round(mx) + ')');

  // 3. tap on the open row closes it (no store options)
  r2 = await rowBox('Milch');
  await touch([[r2.x + 120, r2.y + r2.height / 2]]);
  ok((await rowBox('Milch')).x > 15 && await A.getByText('Automatisch (Netto)').count() === 0, 'tap on open row just closes it');

  // 4. short swipe (less than half) snaps back
  r = await center('Butter'); const y3 = r.y + r.height / 2;
  await touch([[r.x + r.width - 40, y3], [r.x + r.width - 55, y3], [r.x + r.width - 70, y3]]);
  ok((await rowBox('Butter')).x > 15, 'short swipe snaps back closed');

  // 5. vertical drag scrolls the list and does not open a row
  const sc = () => A.evaluate(() => document.querySelector('.scroll').scrollTop);
  const before = await sc();
  r = await rowBox('Käse');
  await touch([[r.x + 150, r.y + 30], [r.x + 152, r.y + 10], [r.x + 153, r.y - 30], [r.x + 154, r.y - 90], [r.x + 154, r.y - 160]]);
  const after = await sc();
  ok(after > before + 50, 'vertical drag scrolls the list (' + before + ' → ' + after + ')');
  ok(await A.locator('button[aria-hidden="false"]').count() === 0, 'no row opened while scrolling');

  await A.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; }); await A.waitForTimeout(300);
  // 6. normal tap still opens store options
  r = await center('Reis');
  await touch([[r.x + 150, r.y + r.height / 2]]);
  ok(await A.getByText('Automatisch (Netto)').count() === 1, 'plain tap still opens the store options');
  await touch([[r.x + 150, r.y + r.height / 2 - 0]]); // close again

  // 7. swipe + tap Löschen deletes; tap elsewhere closes
  r = await center('Zucker'); const y5 = r.y + r.height / 2;
  await touch([[r.x + r.width - 40, y5], [r.x + r.width - 90, y5], [r.x + r.width - 150, y5], [r.x + r.width - 170, y5]]);
  await A.click('input[placeholder^="z. B. 5 Bananen"]'); await A.locator(IN).blur(); await A.waitForTimeout(300);
  ok((await rowBox('Zucker')).x > 15, 'tap elsewhere closes the open row');
  await touch([[r.x + r.width - 40, y5], [r.x + r.width - 90, y5], [r.x + r.width - 150, y5], [r.x + r.width - 170, y5]]);
  const b = await A.locator('button[aria-label="Zucker löschen"]').boundingBox();
  await touch([[b.x + b.width / 2, b.y + b.height / 2]]);
  await A.waitForTimeout(400);
  ok(await A.getByText('Zucker', { exact: true }).count() === 0, 'tapping Löschen deletes the item');
  // 8. mouse drag also works (desktop)
  await A.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; }); await A.waitForTimeout(300);
  r = await center('Brot'); console.log('   Brot row for mouse test at y', Math.round(r.y));
  await A.mouse.move(r.x + r.width - 30, r.y + r.height / 2); await A.mouse.down();
  for (const dx of [20, 60, 110, 150]) await A.mouse.move(r.x + r.width - 30 - dx, r.y + r.height / 2);
  await A.mouse.up(); await A.waitForTimeout(350);
  ok((await rowBox('Brot')).x < -40, 'mouse drag reveals too (x=' + Math.round((await rowBox('Brot')).x) + ')');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
