// Tester bugs: (1) the "Wird synchronisiert …" / "Offline" indicator pushed the list down, so a tap landed on the
// item below – now it floats on the header edge and nothing moves. (2) Unchecking every checked item ended the trip.
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

  // ---- The indicator doesn't move anything (list, plan, store) ----
  const still = async (label, target) => {
    const before = await target.boundingBox();
    await a.ctx.setOffline(true);
    await A.getByText(PILL).waitFor({ timeout: 3000 });
    await A.waitForTimeout(300);
    const after = await target.boundingBox();
    ok(Math.abs(before.y - after.y) < 1, label + ': the indicator appears, nothing moves (' + Math.round(before.y) + ' → ' + Math.round(after.y) + ')');
    return () => a.ctx.setOffline(false);
  };
  let online = await still('Liste', A.getByText('Bananen', { exact: true }));
  await A.screenshot({ path: SHOTS + 'sync-pill-list.png' });
  await online(); await A.waitForTimeout(500);

  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  online = await still('Plan', A.locator('.card').first());
  await A.screenshot({ path: SHOTS + 'sync-pill-plan.png' });
  await online(); await A.waitForTimeout(500);

  await A.click('button.cta:has-text("Einkauf starten bei Netto")');
  await waitText(A, 'Bananen');
  const milch = row(A, 'Milch');
  const box = await milch.boundingBox();
  online = await still('Laden', milch);
  // The tap aimed at Milch (where it was before) checks Milch, not the item below
  await A.touchscreen.tap(box.x + 60, box.y + box.height / 2); await A.waitForTimeout(300);
  ok(await isChecked(A, 'Milch') && !(await isChecked(A, 'Brot')) && !(await isChecked(A, 'Bananen')), 'the tap meant for Milch checks Milch');
  await A.screenshot({ path: SHOTS + 'sync-pill-store.png' });
  await online(); await A.waitForTimeout(800);

  // ---- Unchecking everything doesn't end the trip ----
  await row(A, 'Bananen').click(); await A.waitForTimeout(300);
  await row(A, 'Milch').click(); await A.waitForTimeout(300);
  await row(A, 'Bananen').click(); await A.waitForTimeout(1000);
  ok(!(await isChecked(A, 'Milch')) && !(await isChecked(A, 'Bananen')), 'all ticks undone');
  ok(/\/laden\/netto$/.test(A.url()), 'still in the store: ' + A.url());
  ok(await A.getByText('Stopp 1 von 1').count() === 1, 'trip goes on: "Stopp 1 von 1"');
  await A.click('text=‹ Zum Plan'); await A.waitForSelector('h1:text-is("Route")');
  ok(await A.locator('.bottom-fade button.cta:has-text("Weiter einkaufen bei Netto")').count() === 1, 'plan: "Weiter einkaufen bei Netto"');
  await A.click('button.cta:has-text("Weiter einkaufen bei Netto")');
  await row(A, 'Brot').click();
  await A.click('button:has-text("Einkauf abschließen")');
  await waitText(A, 'Noch 2 Artikel offen'); await A.click('button:has-text("Auf der Einkaufsliste lassen")');
  await waitText(A, 'abgeschlossen').then(() => ok(true, 'finishing still works'), () => ok(false, 'finishing still works'));
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
