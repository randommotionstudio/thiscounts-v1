// V1.8 fixes: the trip follows the order you actually shop in ("Stattdessen hier starten"), and sorting the route
// never gets stuck (main store put off with "Später erledigen").
const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
const assign = async (P, name, store) => { await P.getByText(name, { exact: true }).click(); await P.locator('button', { hasText: new RegExp('^' + store + '$') }).click(); await P.waitForTimeout(200); };
const cards = async P => (await P.locator('.card .ellipsis[style*="font-weight: 600"]').allTextContents());
const bottom = P => P.locator('.bottom-fade button.ellipsis').first();

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Kamillentee', 'Laktosefreie Milch', 'Crispy Choccies']);
  await A.click('button:has-text("Einsortieren")');
  await assign(A, 'Crispy Choccies', 'REWE');

  // ---- Bug 1: "Stattdessen hier starten" at the second store ----
  await A.click('.tab:has-text("Plan")'); await waitText(A, 'Deine Route');
  ok((await cards(A)).join(',') === 'Netto,REWE', 'planned: Netto, REWE');
  await A.locator('.card', { hasText: 'REWE' }).locator('button:has-text("Stattdessen hier starten")').click();
  await waitText(A, 'Crispy Choccies');
  ok(await A.getByText('Stopp 1 von 2').count() === 1, 'REWE is "Stopp 1 von 2" (was 2 von 2)');
  ok(/^Weiter zu Netto/.test(await bottom(A).innerText()), 'bottom: "' + (await bottom(A).innerText()) + '" (was "Zurück zu Netto")');
  await A.screenshot({ path: SHOTS + 'order-01-rewe-first.png' });
  // In the plan mid-trip: REWE first, and the big button continues there
  await A.click('text=‹ Zum Plan'); await waitText(A, 'Deine Route');
  ok((await cards(A)).join(',') === 'REWE,Netto', 'plan follows the trip: REWE, Netto');
  ok(/Weiter einkaufen bei REWE/.test(await A.locator('.bottom-fade button.cta').innerText()), 'plan CTA: Weiter einkaufen bei REWE');
  await A.click('button.cta:has-text("Weiter einkaufen bei REWE")');
  await check(A, 'Crispy Choccies');
  await A.click('button:has-text("Weiter zu Netto")');
  await waitText(A, 'Kamillentee');
  ok(await A.getByText('Stopp 2 von 2').count() === 1, 'Netto is "Stopp 2 von 2"');
  ok(/^Einkauf abschließen/.test(await bottom(A).innerText()), 'last stop: "' + (await bottom(A).innerText()) + '"');
  await check(A, 'Kamillentee'); await check(A, 'Laktosefreie Milch');
  await A.click('button:has-text("Einkauf abschließen")');
  await waitText(A, 'Einkauf abgeschlossen');

  // ---- Bug 2: main store put off, then sorting ----
  await add(A, ['Pfefferminztee', 'Haferflocken', 'Crispy Choccies', 'Joghurt']);
  await A.click('button:has-text("Einsortieren")').catch(() => {});
  await assign(A, 'Crispy Choccies', 'REWE'); await assign(A, 'Joghurt', 'Edeka');
  await A.click('.tab:has-text("Plan")'); await waitText(A, 'Deine Route');
  ok((await cards(A)).join(',') === 'Netto,Edeka,REWE', 'planned: Netto, Edeka, REWE');
  await A.locator('.card', { hasText: 'Netto' }).locator('button[title="Mehr"]').click();
  await A.locator('.card', { hasText: 'Netto' }).locator('button:has-text("Später erledigen")').click();
  await A.waitForTimeout(300);
  ok((await cards(A)).join(',') === 'Edeka,REWE,Netto', 'Netto put off: Edeka, REWE, Netto');
  await A.click('button:has-text("Ändern")');
  ok(await A.locator('.card', { hasText: 'Netto' }).getByText('später', { exact: true }).count() === 1, 'sorting: Netto is marked "später" (no arrows)');
  await A.locator('.card', { hasText: 'REWE' }).locator('button[title="Nach oben"]').click();
  await A.waitForTimeout(400);
  ok((await cards(A)).join(',') === 'REWE,Edeka,Netto', 'REWE moved up; Netto stays last: ' + (await cards(A)).join(','));
  ok(await A.locator('button:has-text("Fertig")').count() === 1, '"Fertig" is still there');
  await A.screenshot({ path: SHOTS + 'order-02-sorting.png' });
  await A.click('button:has-text("Fertig")');
  ok(await A.locator('button[title="Nach oben"]').count() === 0, 'sort mode ends');
  ok(await A.locator('.card button[title="Mehr"]').count() === 3, 'every card has its menu again');

  // Only two stores, main put off: nothing to sort → no sort mode at all (the stuck screen from the report)
  await A.locator('.card', { hasText: 'Edeka' }).locator('button[title="Mehr"]').click();
  await A.locator('.card', { hasText: 'Edeka' }).locator('button:has-text("Alles hier einkaufen")').click().catch(() => {});
  await A.goto('http://127.0.0.1:4173/plan'); await waitText(A, 'Deine Route');
  ok(await A.locator('button[title="Nach oben"]').count() === 0, 'never stuck in sort mode');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
