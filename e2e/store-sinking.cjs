// While shopping, checked items move to the bottom of their category – after a short pause (never while tapping),
// travelling there. "Nicht gefunden" → back on the list keeps the store; ⋯ "… führt … nicht" clears it.
// Toasts sit under sheets.
const { chromium, SHOTS, phone, login, resetDb, waitText, REST } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner' };
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const row = (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) });
// Item names in the order the store screen shows them (one category here)
const order = P => P.evaluate(() => { const g = document.querySelector('.scroll [data-flip^="dept:"]').parentElement; return [...g.querySelectorAll('[data-flip]')].filter(e => !e.dataset.flip.startsWith('dept:')).map(e => e.innerText.split('\n')[0]); });

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Bananen', 'Äpfel', 'Gurke', 'Tomaten', 'Paprika', 'Kiwi']);
  // Gurke explicitly at Netto, so the app remembers that
  await A.click('button:has-text("Einsortieren")').catch(() => {});
  await A.getByText('Gurke', { exact: true }).click(); await A.locator('button', { hasText: /^Netto$/ }).click();
  await A.waitForTimeout(800);
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  await A.click('button.cta:has-text("Einkauf starten bei Netto")'); await waitText(A, 'Kiwi'); await A.waitForTimeout(500);
  const start = await order(A);
  ok(start.length >= 4 && !start.includes('Kiwi'), 'one category with several items: ' + start.join(', '));

  // ---- Checked items stay while tapping, then travel down ----
  const first = start[0];
  await row(A, first).click(); await A.waitForTimeout(300);
  ok(JSON.stringify(await order(A)) === JSON.stringify(start), 'right after the tap the checked item stays in place');
  // still tapping: another tap 600 ms later restarts the pause
  await A.waitForTimeout(300);
  await row(A, start[1]).click(); await A.waitForTimeout(600);
  ok(JSON.stringify(await order(A)) === JSON.stringify(start), 'while tapping on, nothing moves');
  // the pause: both travel to the bottom – animated, not jumping
  const moved = await A.evaluate(() => new Promise(res => {
    const t0 = performance.now(), before = document.querySelector('.scroll [data-flip]:not([data-flip^="dept:"])').innerText;
    const tick = () => {
      const now = document.querySelector('.scroll [data-flip]:not([data-flip^="dept:"])').innerText;
      if (now !== before) return res({ after: performance.now() - t0, animating: document.getAnimations().length });
      if (performance.now() - t0 > 3000) return res(null);
      requestAnimationFrame(tick);
    };
    tick();
  }));
  ok(!!moved && moved.animating > 0, 'after a short pause they move – travelling (' + (moved && moved.animating) + ' rows animated)');
  await A.waitForTimeout(500);
  const after = await order(A);
  ok(JSON.stringify(after) === JSON.stringify([...start.slice(2), start[0], start[1]]), 'checked ones at the bottom, open ones on top in their order: ' + after.join(', '));
  await A.screenshot({ path: SHOTS + 'store-sinking.png' });
  // Every item takes the shortest way. Unchecking the topmost checked one: it is already right above the others
  const [t, g, x, y] = start; // after the two checks: x, y open – t, g checked
  await row(A, t).click(); await A.waitForTimeout(1500);
  let now = await order(A);
  ok(JSON.stringify(now) === JSON.stringify([x, y, t, g]), 'unchecking the topmost checked item: it stays where it is (' + now.join(', ') + ')');
  // Checking: it goes right below the open ones, above the ones checked before
  await row(A, x).click(); await A.waitForTimeout(1500);
  now = await order(A);
  ok(JSON.stringify(now) === JSON.stringify([y, t, x, g]), 'checking: lands at the top of the checked ones (' + now.join(', ') + ')');
  // Unchecking the bottom one: up past the checked ones only, to the end of the open ones
  await row(A, g).click(); await A.waitForTimeout(1500);
  now = await order(A);
  ok(JSON.stringify(now) === JSON.stringify([y, t, g, x]), 'unchecking the bottom one: only up to the end of the open ones (' + now.join(', ') + ')');

  // ---- "Nicht gefunden" → back on the list keeps the store ----
  const missing = async name => {
    await A.locator('.scroll [data-flip]', { has: A.getByText(name, { exact: true }) }).locator('button:has-text("Nicht gefunden")').click();
    await waitText(A, name + ' woanders holen');
  };
  await missing('Kiwi');
  await A.click('button:has-text("Zurück auf die Liste")');
  await waitText(A, 'Kiwi ist zurück auf der Einkaufsliste');
  ok(await row(A, 'Kiwi').waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false), 'Kiwi is off this trip');
  // the toast is covered by a sheet that opens on top (leave popup)
  await A.locator('.bottom-fade button.ellipsis').first().click();
  await waitText(A, 'Artikel offen'); await A.waitForTimeout(400);
  const tb = await A.locator('[role=status]', { hasText: 'Kiwi ist zurück' }).boundingBox();
  const toastOnTop = await A.evaluate(([x, y]) => {
    const t = [...document.querySelectorAll('[role=status]')].find(e => e.textContent.includes('Kiwi ist zurück'));
    for (let e = t; e; e = e.parentElement) e.style.pointerEvents = 'auto';
    const el = document.elementFromPoint(x, y);
    return !!el && t.contains(el);
  }, [tb.x + tb.width / 2, tb.y + tb.height / 2]);
  ok(!toastOnTop, 'a toast sits under the popup, never on its buttons');
  await A.screenshot({ path: SHOTS + 'toast-under-sheet.png' });
  await A.locator('[aria-label="Schließen"]').last().click().catch(() => {});
  await A.waitForTimeout(400);
  await A.click('text=‹ Zum Plan'); await A.click('.tab:has-text("Liste")'); await A.waitForTimeout(500);
  const kiwiRow = A.locator('div', { has: A.getByText('Kiwi', { exact: true }) }).filter({ hasText: 'Netto' }).last();
  ok(await kiwiRow.count() > 0 && await A.getByText('Laden wählen', { exact: true }).count() === 0, 'on the list Kiwi still has its store (Netto), no "Laden wählen"');

  // ---- ⋯ "Netto führt Gurke nicht" → no store, and Netto isn't suggested for it any more ----
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  await A.click('.bottom-fade button.cta'); await waitText(A, 'Gurke');
  await missing('Gurke');
  await A.click('button[title="Mehr"]'); await A.waitForTimeout(200);
  ok(await A.locator('[role=menuitem]').innerText().then(t => t.startsWith('Netto führt Gurke nicht')), 'menu: "Netto führt Gurke nicht"');
  await A.screenshot({ path: SHOTS + 'missing-menu.png' });
  await A.touchscreen.tap(200, 120); await A.waitForTimeout(250);
  ok(await A.locator('[role=menuitem]').count() === 0, 'a tap elsewhere closes the menu');
  await A.click('button[title="Mehr"]'); await A.waitForTimeout(200);
  await A.click('[role=menuitem]');
  await waitText(A, 'Gurke ist zurück auf der Einkaufsliste · Laden wählen');
  await A.waitForTimeout(800);
  const mems = (await (await fetch(REST + '/memory', { headers: owner })).json()).documents || [];
  const mem = mems.find(d => d.fields.name && d.fields.name.stringValue === 'gurke') || {};
  const st = mem.fields && mem.fields.stores && mem.fields.stores.mapValue.fields.wocheneinkauf;
  ok(!!st && 'nullValue' in st, 'Netto is no longer remembered for Gurke on this list');
  await A.click('text=‹ Zum Plan'); await A.click('.tab:has-text("Liste")'); await A.waitForTimeout(500);
  ok(await A.getByText('Laden wählen', { exact: true }).count() === 1, 'on the list: Gurke "Laden wählen"');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
