// The list scrolls far enough that the last item never stops under the offline / sync indicator (or the button).
const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const OFF = 'Offline · Änderungen werden gespeichert';
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  const many = ['Bananen', 'Äpfel', 'Tomaten', 'Gurke', 'Brot', 'Brötchen', 'Milch', 'Joghurt', 'Käse', 'Butter', 'Nudeln', 'Reis', 'Kaffee', 'Tee', 'Wasser', 'Mehl', 'Zucker', 'Eier', 'Salz', 'Senf'];
  for (const t of many) { await A.fill(IN, t); await A.press(IN, 'Enter'); await A.waitForTimeout(50); }
  await A.locator(IN).blur(); await A.waitForTimeout(800);
  await A.click('button:has-text("Einsortieren")').catch(() => {});
  // give REWE, Edeka, trinkgut a few items so the plan is long
  const assign = async (n, s) => { await A.getByText(n, { exact: true }).click(); await A.locator('button', { hasText: new RegExp('^' + s + '$') }).click(); await A.waitForTimeout(150); };
  await assign('Wasser', 'trinkgut'); await assign('Kaffee', 'REWE'); await assign('Tee', 'Edeka'); await assign('Salz', 'ALDI').catch(() => {});
  const measure = async (label, lastSel, btnSel) => {
    await A.evaluate(() => { const s = document.querySelector('.scroll'); s.scrollTop = s.scrollHeight; }); await A.waitForTimeout(300);
    const last = await A.evaluate(sel => { const els = [...document.querySelectorAll(sel)]; return els[els.length - 1].getBoundingClientRect().bottom; }, lastSel);
    const btn = await A.locator(btnSel).first().boundingBox();
    await a.ctx.setOffline(true); await A.getByText(OFF).waitFor({ timeout: 3000 }); await A.waitForTimeout(300);
    const bar = await A.getByText(OFF).locator('..').boundingBox();
    ok(btn.y - last >= 20, label + ': at the end of the list, the last item stops above the button (gap ' + Math.round(btn.y - last) + ')');
    ok(bar.y - last >= 20, label + ': … and above the indicator (gap ' + Math.round(bar.y - last) + ')');
    await A.screenshot({ path: SHOTS + 'end-space-' + label + '.png' });
    await a.ctx.setOffline(false); await A.waitForTimeout(600);
  };
  await measure('list', '.scroll [style*="overflow: hidden"]', '.bottom-fade button.cta');
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  await measure('plan', '.scroll .card, .scroll button', '.bottom-fade button.cta');
  await A.click('button.cta:has-text("Einkauf starten")'); await waitText(A, 'Bananen'); await A.waitForTimeout(800);
  await measure('store', '.scroll [role=checkbox], .scroll button', '.bottom-fade button.ellipsis');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
