// A category with everything checked closes to its title (green check, "N erledigt") after a short pause –
// shrinking, not jumping. A tap on the title opens it again; unchecking reopens it for good; finished again, it
// closes again.
const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const row = (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) });
const OBST = ['Bananen', 'Äpfel', 'Gurke', 'Tomaten'];
// Height of the item area of the category that holds `name` (0 = closed)
const area = (P, name) => row(P, name).evaluate(e => e.closest('[data-flip-h]').getBoundingClientRect().height);
const title = P => P.locator('button[aria-expanded]', { hasText: 'Obst' });

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, [...OBST, 'Milch', 'Joghurt']);
  await A.waitForTimeout(500);
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  await A.click('button.cta:has-text("Einkauf starten bei Netto")'); await waitText(A, 'Bananen'); await A.waitForTimeout(500);
  const milchY = (await A.getByText('Milchprodukte', { exact: false }).first().boundingBox()).y;

  // ---- Everything checked → after a pause it closes ----
  for (const n of OBST) { await row(A, n).click(); await A.waitForTimeout(150); }
  await A.waitForTimeout(300);
  ok(await area(A, 'Bananen') > 100 && await title(A).count() === 0, 'right after the last tap the category stays open');
  const anim = await A.evaluate(() => new Promise(res => {
    const t0 = performance.now();
    const tick = () => {
      const b = document.querySelector('button[aria-expanded="false"]');
      if (b) return res(document.getAnimations().length);
      if (performance.now() - t0 > 3000) return res(-1);
      requestAnimationFrame(tick);
    };
    tick();
  }));
  ok(anim > 0, 'after a pause it closes – shrinking, not jumping (' + anim + ' animations)');
  await A.waitForTimeout(500);
  ok(await area(A, 'Bananen') < 3, 'closed: only the title is left');
  ok(/4 erledigt/.test(await title(A).innerText()) && await title(A).locator('[aria-label="Erledigt"]').count() === 1, 'title: green check and "4 erledigt"');
  const milchY2 = (await A.getByText('Milchprodukte', { exact: false }).first().boundingBox()).y;
  ok(milchY2 < milchY - 150, 'the next category moved up (' + Math.round(milchY) + ' → ' + Math.round(milchY2) + ')');
  ok(await A.getByText('4 von 6').count() === 1, 'progress: 4 von 6');
  await A.screenshot({ path: SHOTS + 'store-collapsed.png' });

  // ---- A tap on the title opens it ----
  await title(A).click(); await A.waitForTimeout(500);
  ok(await area(A, 'Bananen') > 100 && await title(A).getAttribute('aria-expanded') === 'true', 'a tap on the title opens it again');
  await A.screenshot({ path: SHOTS + 'store-reopened.png' });
  // and closes it
  await title(A).click(); await A.waitForTimeout(500);
  ok(await area(A, 'Bananen') < 3, '… and another tap closes it');
  await title(A).click(); await A.waitForTimeout(500);

  // ---- Unchecking: not finished any more ----
  const head = await title(A).elementHandle();
  await row(A, 'Gurke').click(); await A.waitForTimeout(1500);
  ok(await title(A).count() === 0 && await area(A, 'Gurke') > 100, 'one unchecked → a normal category again');
  // the title row stays the same element and "erledigt" with its arrow only fades (removing it left a dot on iPhones)
  ok(await head.evaluate(e => e.isConnected && getComputedStyle(e.lastElementChild).opacity === '0'), 'the title row stays, "erledigt" and the arrow fade out');
  // finished again → closes again, although it had been opened by hand
  await row(A, 'Gurke').click(); await A.waitForTimeout(1500);
  ok(await area(A, 'Gurke') < 3 && await title(A).getAttribute('aria-expanded') === 'false', 'finished again → closes again');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
