// V1.9: one-time stops (e.g. "Apotheke") can be moved between the stores in "Reihenfolge ändern".
const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(150); } await p.locator(IN).blur(); }
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
const cards = async P => (await P.locator('.card:not(:has([data-skipped])) .ellipsis[style*="font-weight: 600"]').allTextContents());
const bottom = P => P.locator('.bottom-fade button.ellipsis').first();

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Bananen', 'Crispy Choccies', 'Pflaster']);
  await A.click('button:has-text("Einsortieren")').catch(() => {});
  await A.getByText('Crispy Choccies', { exact: true }).click(); await A.locator('button', { hasText: /^REWE$/ }).click(); await A.waitForTimeout(300);
  await A.getByText('Pflaster', { exact: true }).click(); await A.click('button:has-text("+ Einmaliger Stopp")');
  await A.fill('input[placeholder^="Wohin?"]', 'Apotheke'); await A.click('.sheet button:has-text("Hinzufügen")');
  await A.waitForTimeout(500);

  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  ok((await cards(A)).join(',') === 'Netto,REWE,Apotheke', 'planned: Netto, REWE, then Apotheke');
  ok(await A.getByText('Ohne feste Reihenfolge').count() === 1, 'Apotheke under "Ohne feste Reihenfolge"');
  const ring = () => A.locator('.card', { hasText: 'Apotheke' }).locator('div[style*="dashed"]').count();
  ok(await ring() === 1, 'unplaced: dashed ring around "?"');
  await A.click('button:has-text("Reihenfolge ändern")');
  const apo = A.locator('.card', { hasText: 'Apotheke' });
  ok(await apo.locator('button[title="Nach oben"]').count() === 1, 'while sorting, Apotheke has arrows too');
  await apo.locator('button[title="Nach oben"]').click(); await A.waitForTimeout(400);
  ok((await cards(A)).join(',') === 'Netto,Apotheke,REWE', 'moved up: Netto, Apotheke, REWE');
  ok(await A.getByText('Ohne feste Reihenfolge').count() === 0, '"Ohne feste Reihenfolge" is gone');
  await A.screenshot({ path: SHOTS + 'once-order-sorting.png' });
  await A.click('.bottom-fade button.cta:has-text("Fertig")');
  ok(await apo.getByText('2', { exact: true }).count() === 1, 'Apotheke is stop 2');
  ok(await ring() === 0, 'placed: no dashed ring any more');
  ok(await A.getByText('Reihenfolge für heute geändert').count() === 1, 'note: "Reihenfolge für heute geändert"');
  await A.screenshot({ path: SHOTS + 'once-order-plan.png' });

  // The trip follows it
  await A.click('button.cta:has-text("Einkauf starten bei Netto")');
  await check(A, 'Bananen');
  ok(/^Weiter zu Apotheke/.test(await bottom(A).innerText()), 'after Netto: "' + (await bottom(A).innerText()) + '"');
  await A.click('button:has-text("Weiter zu Apotheke")');
  ok(await A.getByText('Stopp 2 von 3').count() === 1, 'Apotheke is "Stopp 2 von 3"');
  await check(A, 'Pflaster');
  ok(/^Weiter zu REWE/.test(await bottom(A).innerText()), 'then: "' + (await bottom(A).innerText()) + '"');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
