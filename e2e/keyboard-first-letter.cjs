// Tester bug: the keyboard closed after the first letter. Typing filters the list, the browser scrolls up by
// itself – and any scroll closed the keyboard. Now only a finger dragging the list closes it.
const { chromium, SHOTS, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const auth = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const hist = (name, daysAgo) => fetch(H + '/history', { method: 'POST', headers: auth, body: JSON.stringify({ fields: {
  name: { stringValue: name }, qty: { nullValue: null }, storeId: { nullValue: null }, listId: { stringValue: 'wocheneinkauf' },
  completedAt: { timestampValue: new Date(Date.now() - daysAgo * 86400000).toISOString() } } }) });
const focused = P => P.evaluate(() => document.activeElement?.tagName === 'INPUT');

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const A = await ctx.newPage();
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const n of ['Kiwi', 'Eier', 'Käse', 'Sahne', 'Gurke', 'Joghurt']) { await hist(n, 3); await hist(n, 10); }
  for (const t of ['Brot', 'Milch', 'Tomaten', 'Nudeln', 'Reis', 'Zwiebeln', 'Knoblauch', 'Paprika', 'Zucchini', 'Möhren', 'Salat', 'Äpfel', 'Orangen', 'Mehl', 'Zucker', 'Kaffee', 'Tee', 'Wasser']) {
    await A.fill(IN, t); await A.press(IN, 'Enter'); await A.waitForTimeout(60);
  }
  await A.locator(IN).blur();

  for (const [label, pos] of [['at the top', 0], ['scrolled a bit', 300], ['scrolled to the end', 99999]]) {
    await A.reload(); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await A.waitForTimeout(1200);
    await A.evaluate(p => { document.querySelector('.scroll').scrollTop = p; }, pos); await A.waitForTimeout(300);
    await A.tap(IN); await A.waitForTimeout(800);
    await A.keyboard.type('K'); await A.waitForTimeout(400);
    ok(await focused(A), label + ': keyboard stays open after the first letter');
    await A.keyboard.type('a'); await A.waitForTimeout(300);
    ok(await focused(A) && await A.inputValue(IN) === 'Ka', label + ': typing goes on ("' + await A.inputValue(IN) + '")');
  }
  await A.screenshot({ path: SHOTS + 'keyboard-first-letter.png' });

  // Dragging the list with a finger still closes the keyboard
  await A.fill(IN, ''); await A.waitForTimeout(300);
  ok(await focused(A), 'field still focused before the drag');
  const cdp = await ctx.newCDPSession(A);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
  await touch('touchStart', 600); for (const y of [580, 550, 500, 450]) await touch('touchMove', y); await touch('touchEnd');
  await A.waitForTimeout(300);
  ok(!(await focused(A)), 'dragging the list closes the keyboard');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
