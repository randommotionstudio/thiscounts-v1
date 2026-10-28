// Tester bugs: (1) the "Wird synchronisiert …" / "Offline" indicator pushed the list down, so a tap landed on the
// item below – now it floats above the main button, toasts stack above it, nothing moves. (2) Unchecking every
// checked item ended the trip. (3) The ⋯ menus (store, plan) only closed with ⋯ – now a tap anywhere else closes
// them, and that tap does nothing else.
const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const row = (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) });
const isChecked = async (P, name) => (await row(P, name).getAttribute('aria-checked')) === 'true';
const PILL = 'Offline · Änderungen werden gespeichert';

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Bananen', 'Milch', 'Brot']);
  await A.waitForTimeout(500);

  // ---- The indicator: above the main button, moves nothing (list, plan, store) ----
  const pill = () => A.getByText(PILL).boundingBox();
  const still = async (label, target, button) => {
    const before = await target.boundingBox();
    await a.ctx.setOffline(true);
    await A.getByText(PILL).waitFor({ timeout: 3000 });
    await A.waitForTimeout(400);
    const after = await target.boundingBox();
    ok(Math.abs(before.y - after.y) < 1, label + ': the indicator appears, nothing moves (' + Math.round(before.y) + ' → ' + Math.round(after.y) + ')');
    const p = await pill(), b = await button.boundingBox();
    ok(p.y + p.height <= b.y && b.y - (p.y + p.height) < 30, label + ': it sits just above the main button (' + Math.round(p.y + p.height) + ' ≤ ' + Math.round(b.y) + ')');
    return () => a.ctx.setOffline(false);
  };
  let online = await still('Liste', A.getByText('Bananen', { exact: true }), A.locator('.bottom-fade button.cta'));
  // A toast while offline: stacks above the indicator, which stays put
  const p0 = await pill();
  await A.click('button:has-text("Einsortieren")');
  await A.getByText('Milch', { exact: true }).click(); await A.locator('button', { hasText: /^REWE$/ }).click();
  const toast = A.locator('[role=status]', { hasText: 'Gemerkt' });
  await toast.waitFor({ timeout: 3000 }); await A.waitForTimeout(400);
  const t = await toast.boundingBox(), p1 = await pill();
  ok(Math.abs(p0.y - p1.y) < 1, 'a toast appears: the indicator stays where it is');
  ok(t.y + t.height <= p1.y, 'the toast stacks above the indicator (' + Math.round(t.y + t.height) + ' ≤ ' + Math.round(p1.y) + ')');
  await A.screenshot({ path: SHOTS + 'sync-pill-list.png' });
  await online(); await A.waitForTimeout(500);
  ok(await A.getByText(PILL).count() === 0, 'back online: the indicator is gone');

  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  online = await still('Plan', A.locator('.card').first(), A.locator('.bottom-fade button.cta'));
  await A.screenshot({ path: SHOTS + 'sync-pill-plan.png' });
  await online(); await A.waitForTimeout(500);

  // ---- Plan ⋯ menu: a tap elsewhere closes it ----
  const menuItems = () => A.locator('[role=menuitem]').count();
  await A.locator('.card', { hasText: 'REWE' }).locator('button[title="Mehr"]').click(); await A.waitForTimeout(200);
  ok(await menuItems() > 0, 'plan: ⋯ opens the menu');
  await A.touchscreen.tap(200, 64); await A.waitForTimeout(300); // on the header, away from the menu
  ok(await menuItems() === 0, 'plan: a tap elsewhere closes it');
  await A.locator('.card', { hasText: 'REWE' }).locator('button[title="Mehr"]').click(); await A.waitForTimeout(200);
  await A.locator('.card', { hasText: 'Netto' }).locator('button[title="Mehr"]').click(); await A.waitForTimeout(200);
  ok(await A.locator('.card', { hasText: 'Netto' }).locator('[role=menuitem]').count() > 0 && await A.locator('.card', { hasText: 'REWE' }).locator('[role=menuitem]').count() === 0, 'plan: ⋯ of another store switches to its menu');
  await A.locator('.card', { hasText: 'Netto' }).locator('button[title="Mehr"]').click(); await A.waitForTimeout(200);
  ok(await menuItems() === 0, 'plan: ⋯ again still closes it');

  await A.click('button.cta:has-text("Einkauf starten bei Netto")');
  await waitText(A, 'Bananen');
  const brot = row(A, 'Brot');
  const box = await brot.boundingBox();
  online = await still('Laden', brot, A.locator('.bottom-fade button.ellipsis').first());
  // The tap aimed at Brot (where it was before) checks Brot, not another item
  await A.touchscreen.tap(box.x + 60, box.y + box.height / 2); await A.waitForTimeout(300);
  ok(await isChecked(A, 'Brot') && !(await isChecked(A, 'Bananen')), 'the tap meant for Brot checks Brot');
  await A.screenshot({ path: SHOTS + 'sync-pill-store.png' });
  await online(); await A.waitForTimeout(800);

  // ---- Store ⋯ menu: a tap elsewhere closes it, and only closes it ----
  const more = A.locator('.bottom-fade button[title="Mehr"]');
  await more.click(); await A.waitForTimeout(250);
  ok(await A.locator('button:has-text("Heute auslassen")').count() === 1, 'store: ⋯ opens the menu');
  const bb = await row(A, 'Bananen').boundingBox();
  await A.touchscreen.tap(bb.x + 60, bb.y + bb.height / 2); await A.waitForTimeout(300);
  ok(await A.locator('button:has-text("Heute auslassen")').count() === 0, 'store: a tap elsewhere closes it');
  ok(!(await isChecked(A, 'Bananen')), '… without checking the item that was tapped');
  await more.click(); await A.waitForTimeout(250);
  await more.click(); await A.waitForTimeout(250);
  ok(await A.locator('button:has-text("Heute auslassen")').count() === 0, 'store: ⋯ again still closes it');

  // ---- Unchecking everything doesn't end the trip ----
  await row(A, 'Bananen').click(); await A.waitForTimeout(300);
  await row(A, 'Brot').click(); await A.waitForTimeout(300);
  await row(A, 'Bananen').click(); await A.waitForTimeout(1000);
  ok(!(await isChecked(A, 'Brot')) && !(await isChecked(A, 'Bananen')), 'all ticks undone');
  ok(/\/laden\/netto$/.test(A.url()), 'still in the store: ' + A.url());
  ok(await A.getByText('Stopp 1 von 2').count() === 1, 'trip goes on: "Stopp 1 von 2"');
  await A.click('text=‹ Zum Plan'); await A.waitForSelector('h1:text-is("Route")');
  ok(await A.locator('.bottom-fade button.cta:has-text("Weiter einkaufen bei Netto")').count() === 1, 'plan: "Weiter einkaufen bei Netto"');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
