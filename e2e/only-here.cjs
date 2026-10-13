// V1.8 "Nur hier einkaufen": a quick trip to one store; the tidied stop menu.
const { chromium, SHOTS, phone, login, resetDb, waitText, REST } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner' };
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
const toTrinkgut = async (P, name) => { await P.getByText(name, { exact: true }).click(); await P.locator('button', { hasText: /^trinkgut$/ }).click(); await P.waitForTimeout(200); };
const menuOf = async (P, store) => {
  await P.locator('.card', { hasText: store }).locator('button[title="Mehr"]').click(); await P.waitForTimeout(200);
  const t = await P.locator('.card', { hasText: store }).locator('[role=menuitem]').allTextContents();
  return t;
};
const items = async () => ((await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: owner })).json()).documents || []).map(d => d.fields.name.stringValue).sort();

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Bananen', 'Milch', 'Wasser', 'Rotwein']);
  await A.click('button:has-text("Einsortieren")');
  await toTrinkgut(A, 'Wasser'); await toTrinkgut(A, 'Rotwein');

  // ---- The tidied menu ----
  await A.click('.tab:has-text("Plan")'); await waitText(A, 'Deine Route');
  const tg = await menuOf(A, 'trinkgut');
  ok(tg.join(' | ') === 'Nur hier einkaufen · nur 2 Artikel | Alles hier einkaufen · alle 4 Artikel | Später erledigen', 'trinkgut menu: ' + tg.join(' | '));
  ok(await A.getByText('Mit diesem Laden starten').count() === 0, 'no "Mit diesem Laden starten" any more');
  ok(await A.getByText('Stattdessen hier starten').count() === 1, '"Stattdessen hier starten" stays on the card');
  await A.screenshot({ path: SHOTS + 'only-01-menu.png' });
  const nt = await menuOf(A, 'Netto');
  ok(nt[0] === 'Nur hier einkaufen · nur 2 Artikel', 'the next store offers "Nur hier einkaufen" too');

  // ---- Wine on the way home ----
  await A.locator('.card', { hasText: 'trinkgut' }).locator('button[title="Mehr"]').click(); await A.waitForTimeout(150);
  await A.locator('.card', { hasText: 'trinkgut' }).locator('button:has-text("Nur hier einkaufen")').click();
  await waitText(A, 'Nur dieser Laden');
  ok(/\/laden\/trinkgut$/.test(A.url()), 'opens trinkgut');
  ok(await A.getByText('Bananen', { exact: true }).count() === 0, 'only trinkgut items');
  ok(await A.locator('button:has-text("Einkauf abschließen")').count() === 1 && await A.getByText(/Weiter zu/).count() === 0, 'bottom button: "Einkauf abschließen", no "Weiter zu Netto"');
  await A.locator('button[title="Mehr"], button[aria-label="Mehr"]').last().click().catch(() => {});
  ok(await A.getByText('Diesen Laden überspringen').count() === 0, 'no "überspringen" on a one-store trip');
  await A.screenshot({ path: SHOTS + 'only-02-store.png' });
  await B.click('.tab:has-text("Plan")');
  await waitText(B, 'Michi kauft gerade ein.').then(() => ok(true, 'Anna sees Michi shopping (and waits)'), () => ok(false, 'Anna sees Michi shopping'));

  // Back in the plan mid-trip: just this stop, with a way back to the whole route
  await A.click('text=‹ Zum Plan'); await waitText(A, 'Deine Route');
  ok(await A.locator('.card').count() === 1, 'plan shows only trinkgut');
  ok(await A.getByText('Nur trinkgut – die anderen Läden bleiben für nächstes Mal.').count() === 1, 'note: the other stores stay for next time');
  ok(await A.locator('.bottom-fade button.cta:has-text("Weiter einkaufen bei trinkgut")').count() === 1, 'CTA: Weiter einkaufen bei trinkgut');
  await A.screenshot({ path: SHOTS + 'only-03-plan.png' });
  await A.click('button.cta:has-text("Weiter einkaufen bei trinkgut")');

  // Wine yes, water forgotten → leave it on the list, trip ends
  await check(A, 'Rotwein');
  await A.click('button:has-text("Einkauf abschließen")');
  await waitText(A, 'Noch 1 Artikel offen');
  ok(await A.getByText(/mitnehmen/).count() === 0, 'leave popup: no "mitnehmen" (nothing comes after)');
  await A.click('button:has-text("Auf der Einkaufsliste lassen")');
  await waitText(A, 'Einkauf bei trinkgut abgeschlossen · 1 erledigt').then(() => ok(true, 'toast: Einkauf bei trinkgut abgeschlossen · 1 erledigt'), () => ok(false, 'finish toast'));
  await A.waitForTimeout(800);
  ok(JSON.stringify(await items()) === JSON.stringify(['Bananen', 'Milch', 'Wasser']), 'Rotwein done; Bananen, Milch and Wasser stay: ' + (await items()).join(', '));
  await B.waitForTimeout(500);
  ok(await B.locator('.bottom-fade button.cta').isEnabled(), 'Anna can start again');

  // A normal trip afterwards: the whole route again
  await A.click('.tab:has-text("Plan")'); await waitText(A, 'Deine Route');
  ok(await A.locator('.card').count() === 2, 'next trip: whole route (Netto, trinkgut)');

  // "Ganze Route" turns a one-store trip back into the full trip
  await A.locator('.card', { hasText: 'trinkgut' }).locator('button[title="Mehr"]').click(); await A.waitForTimeout(150);
  await A.locator('.card', { hasText: 'trinkgut' }).locator('button:has-text("Nur hier einkaufen")').click();
  await waitText(A, 'Nur dieser Laden');
  await A.click('text=‹ Zum Plan'); await waitText(A, 'Deine Route');
  await A.click('button:has-text("Ganze Route")');
  await A.waitForTimeout(300);
  ok(await A.locator('.card').count() === 2, '"Ganze Route": both stores again');
  ok(await A.getByText(/^Nur trinkgut/).count() === 0, '… and the note is gone');

  // A finished stop: "Nochmal hierhin"
  await A.click('button.cta:has-text("Weiter einkaufen bei Netto")');
  await check(A, 'Bananen'); await check(A, 'Milch');
  await A.click('text=‹ Zum Plan'); await waitText(A, 'Deine Route');
  const done = await menuOf(A, 'Netto');
  ok(done.join(' | ') === 'Nochmal hierhin', 'finished store menu: "Nochmal hierhin" (' + done.join(' | ') + ')');
  await A.locator('.card', { hasText: 'Netto' }).locator('button:has-text("Nochmal hierhin")').click();
  ok(/\/laden\/netto$/.test(A.url()), '"Nochmal hierhin" opens Netto');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
