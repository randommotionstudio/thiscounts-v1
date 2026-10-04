// Usual chips: only often-bought, max 12, and the expanded chips never cover the navigation (iPhone 12 mini)
const { chromium, SHOTS, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const auth = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const DAY = 86400000;
const hist = (name, qty, daysAgo) => fetch(H + '/history', { method: 'POST', headers: auth, body: JSON.stringify({ fields: {
  name: { stringValue: name }, qty: qty ? { stringValue: qty } : { nullValue: null }, storeId: { nullValue: null }, listId: { stringValue: 'wocheneinkauf' },
  completedAt: { timestampValue: new Date(Date.now() - daysAgo * DAY).toISOString() } } }) }).then(r => { if (!r.ok) throw new Error('hist ' + r.status); });

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const A = await ctx.newPage();
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  // 16 items bought on 2-3 trips, 14 one-offs (like the testers' history)
  const often = ['Kiwi', 'Eier', 'Schinken', 'Käse', 'Tortellini Spinat Ricotta Füllung', 'Hackfleisch', 'Sahne', 'Birne', 'Süßkartoffel',
    'Bananen', 'Gurke', 'Mandelmilch', 'Joghurt', 'Butter', 'Milch', 'Brot'];
  const once = ['Kondome', 'Feuchttücher zum Wickeln', 'Balea Cremeseife', 'Sebamed Duschgel', 'Head & Shoulders', 'Feuchttücher Toilettenspülbar',
    'Toilettenpapier', 'Mehl', 'Ketchup', 'Äpfel', 'Zimt', 'Oliven', 'Rucola', 'Lachs'];
  for (const [i, n] of often.entries()) { await hist(n, null, 3); await hist(n, null, 10); if (i < 4) await hist(n, null, 17); }
  for (const n of once) await hist(n, null, 5);
  await A.reload(); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await A.waitForTimeout(1500);

  const chipNames = async () => (await A.locator('.glass-head button:has(> span + span)').allTextContents());
  const more = A.locator('button', { hasText: /^\+ \d+ mehr$/ });
  ok(await more.count() === 1, 'collapsed: "+ … mehr" shown: ' + (await more.textContent().catch(() => '-')));
  ok((await more.textContent()) === '+ 6 mehr', 'at most 12 suggestions (6 + 6 mehr)');
  await more.click(); await A.waitForTimeout(400);
  const shown = await chipNames();
  console.log('   expanded:', shown.length, 'chips');
  ok(shown.length === 12, '12 chips when expanded');
  ok(!shown.some(t => /Kondome|Head & Shoulders|Duschgel/.test(t)), 'one-off items are not suggested');
  ok(/^Kiwi|^Eier|^Schinken|^Käse/.test(shown[0]), 'most-bought first: ' + shown.slice(0, 4).join(', '));
  await A.screenshot({ path: SHOTS + '160-chips-expanded.png' });

  // Navigation still reachable: what's under the middle of the Plan tab?
  const tab = await A.locator('.tab:has-text("Plan")').boundingBox();
  const hit = await A.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.tab')); }, [tab.x + tab.width / 2, tab.y + tab.height / 2]);
  ok(hit && tab.y + tab.height <= 812, 'tab bar visible and on top');
  const head = await A.locator('.glass-head').boundingBox();
  const cta = await A.locator('.bottom-fade .cta').boundingBox();
  ok(head.y + head.height <= cta.y, 'header ends above the bottom button (' + Math.round(head.y + head.height) + ' ≤ ' + Math.round(cta.y) + ')');
  await A.locator('.tab:has-text("Plan")').click(); await A.waitForTimeout(500);
  ok(/\/plan$/.test(A.url()), 'tapping "Plan" works');

  // Same on a tiny screen with the full list: chips scroll inside, nav stays
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const B = await ctx2.newPage();
  await login(B, 'michael@rieplhuber.com'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await B.waitForTimeout(1200);
  await B.locator('button', { hasText: /^\+ \d+ mehr$/ }).click(); await B.waitForTimeout(400);
  const h2 = await B.locator('.glass-head').boundingBox(), c2 = await B.locator('.bottom-fade .cta').boundingBox();
  ok(h2.y + h2.height <= c2.y, 'small screen (iPhone SE 1): header still ends above the bottom button');
  await B.screenshot({ path: SHOTS + '161-chips-small.png' });
  await ctx2.close();

  // Typing still finds things bought once
  const ctx3 = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const C = await ctx3.newPage();
  await login(C, 'michael@rieplhuber.com'); await C.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await C.waitForTimeout(1200);
  await C.fill(IN, 'Head'); await C.waitForTimeout(300);
  ok(await C.locator('.glass-head button', { hasText: 'Head & Shoulders' }).count() === 1, 'typing "Head" suggests Head & Shoulders (bought once)');
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
