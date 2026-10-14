// V1.8 trip order: the trip follows the order you actually shop in ("Hier starten"), the order row with a movable
// main store, and "Heute auslassen" (plan and store).
const { chromium, SHOTS, phone, login, resetDb, waitText, REST } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner' };
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
const assign = async (P, name, store) => { await P.getByText(name, { exact: true }).click(); await P.locator('button', { hasText: new RegExp('^' + store + '$') }).click(); await P.waitForTimeout(200); };
const cards = async P => (await P.locator('.card:not(:has([data-skipped])) .ellipsis[style*="font-weight: 600"]').allTextContents());
const bottom = P => P.locator('.bottom-fade button.ellipsis').first();
const menu = async (P, store) => { await P.locator('.card', { hasText: store }).locator('button[title="Mehr"]').click(); await P.waitForTimeout(150); return P.locator('.card', { hasText: store }).locator('[role=menuitem]').allTextContents(); };
const pick = (P, store, label) => P.locator('.card', { hasText: store }).locator('[role=menuitem]', { hasText: label }).click();
const names = async () => ((await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: owner })).json()).documents || []).map(d => d.fields.name.stringValue).sort();

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Kamillentee', 'Laktosefreie Milch', 'Crispy Choccies']);
  await A.click('button:has-text("Einsortieren")');
  await assign(A, 'Crispy Choccies', 'REWE');

  // ---- No buttons on the cards; "Hier starten" at the second store ----
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  ok((await cards(A)).join(',') === 'Netto,REWE', 'planned: Netto, REWE');
  ok(await A.getByText('Stattdessen hier starten').count() === 0 && await A.locator('.card > button').count() === 0, 'no buttons on the cards');
  const m = await menu(A, 'REWE');
  ok(m.join(' | ') === 'Hier starten | Nur hier einkaufen · nur 1 Artikel | Alles hier einkaufen · alle 3 Artikel | Heute auslassen', 'menu: ' + m.join(' | '));
  await pick(A, 'REWE', 'Hier starten');
  await waitText(A, 'Crispy Choccies');
  ok(await A.getByText('Stopp 1 von 2').count() === 1, 'REWE is "Stopp 1 von 2"');
  ok(/^Weiter zu Netto/.test(await bottom(A).innerText()), 'bottom: "' + (await bottom(A).innerText()) + '"');
  await A.click('text=‹ Zum Plan'); await A.waitForSelector('h1:text-is("Route")');
  ok((await cards(A)).join(',') === 'REWE,Netto', 'plan follows the trip: REWE, Netto');
  ok((await menu(A, 'Netto'))[0] === 'Jetzt hierhin', 'during the trip: "Jetzt hierhin"');
  await A.click('button.cta:has-text("Weiter einkaufen bei REWE")');
  await check(A, 'Crispy Choccies');
  await A.click('button:has-text("Weiter zu Netto")');
  await waitText(A, 'Kamillentee');
  ok(await A.getByText('Stopp 2 von 2').count() === 1, 'Netto is "Stopp 2 von 2"');
  await check(A, 'Kamillentee'); await check(A, 'Laktosefreie Milch');
  await A.click('button:has-text("Einkauf abschließen")');
  await waitText(A, 'Einkauf abgeschlossen');

  // ---- The order row with two stores; the main store moves too ----
  await add(A, ['Pfefferminztee', 'Crispy Choccies']);
  await A.click('button:has-text("Einsortieren")').catch(() => {});
  await assign(A, 'Crispy Choccies', 'REWE');
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  ok(await A.locator('button:has-text("Reihenfolge ändern")').count() === 1 && await A.locator('button:has-text("Woanders einkaufen")').count() === 1, 'two stores: chips "Reihenfolge ändern" and "Woanders einkaufen" under the route');
  ok(await A.getByText('Reihenfolge ·').count() === 0, 'no order row at the top any more');
  await A.click('button:has-text("Ändern")');
  const netto = A.locator('.card', { hasText: 'Netto' });
  ok(await netto.getByText('Hauptladen · immer zuerst').count() === 1 && await netto.locator('button[title="Nach unten"]').count() === 1, 'Netto: arrows and "Hauptladen · immer zuerst"');
  await netto.locator('button[title="Nach unten"]').click(); await A.waitForTimeout(400);
  ok((await cards(A)).join(',') === 'REWE,Netto', 'Netto moved down: REWE, Netto');
  ok(await netto.getByText('Hauptladen · heute verschoben').count() === 1, 'note: "Hauptladen · heute verschoben"');
  ok(await A.locator('.bottom-fade button.cta').innerText() === 'Fertig', 'while sorting, the big button is "Fertig"');
  ok(await A.locator('button:has-text("Reihenfolge ändern")').count() === 0, 'chips hidden while sorting');
  await netto.locator('button[title="Nach oben"]').click(); await A.waitForTimeout(400);
  ok((await cards(A)).join(',') === 'Netto,REWE', 'and back up: Netto, REWE');
  ok(await A.locator('button:has-text("Fertig")').count() === 1, 'still sorting ("Fertig" there)');
  await A.screenshot({ path: SHOTS + 'order-02-sorting.png' });
  await netto.locator('button[title="Nach unten"]').click(); await A.waitForTimeout(300);
  await A.click('button:has-text("Fertig")');
  ok(await A.locator('button[title="Nach oben"]').count() === 0, 'sort mode ends');
  ok(await A.getByText('Reihenfolge für heute geändert').count() === 1, 'note under the route: "Reihenfolge für heute geändert"');
  await A.screenshot({ path: SHOTS + 'order-04-note.png' });
  await A.click('button:has-text("Zurücksetzen")'); await A.waitForTimeout(400);
  const tb = await A.locator('[role=status]', { hasText: 'Reihenfolge zurückgesetzt' }).boundingBox(), cb = await A.locator('.bottom-fade button.cta').boundingBox();
  ok(tb && cb && tb.y + tb.height <= cb.y, 'toast sits above the main button (' + Math.round(tb.y + tb.height) + ' ≤ ' + Math.round(cb.y) + ')');
  await A.screenshot({ path: SHOTS + 'order-05-toast.png' });
  ok((await cards(A)).join(',') === 'Netto,REWE', '"Zurücksetzen": Netto first again');
  await A.click('button:has-text("Ändern")');
  ok(await netto.getByText('Hauptladen · immer zuerst').count() === 1, '… "immer zuerst" again');
  ok(await A.getByText('Reihenfolge für heute geändert').count() === 0, '… and the note is gone');
  await A.click('button:has-text("Fertig")');

  // ---- Heute auslassen (plan) ----
  await A.click('.tab:has-text("Liste")'); await add(A, ['Joghurt']); await assign(A, 'Joghurt', 'Edeka');
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  ok((await cards(A)).join(',') === 'Netto,Edeka,REWE', 'planned: Netto, Edeka, REWE');
  const r = await menu(A, 'REWE');
  ok(r[r.length - 1] === 'Heute auslassen', '"Heute auslassen" is the last option');
  await pick(A, 'REWE', 'Heute auslassen'); await A.waitForTimeout(400);
  ok((await cards(A)).join(',') === 'Netto,Edeka', 'REWE left out: Netto, Edeka');
  ok(await A.locator('[data-skipped="rewe"]').getByText('Crispy Choccies').count() === 1, '"Heute nicht": REWE with Crispy Choccies');
  await A.screenshot({ path: SHOTS + 'order-03-skipped.png', fullPage: true });
  await A.click('button:has-text("Doch mitnehmen")'); await A.waitForTimeout(400);
  ok((await cards(A)).join(',') === 'Netto,Edeka,REWE' && await A.getByText('Heute nicht').count() === 0, '"Doch mitnehmen": REWE is back');
  await menu(A, 'REWE'); await pick(A, 'REWE', 'Heute auslassen'); await A.waitForTimeout(300);
  await A.click('button.cta:has-text("Einkauf starten bei Netto")');
  await check(A, 'Pfefferminztee');
  ok(/^Weiter zu Edeka/.test(await bottom(A).innerText()), 'after Netto: "Weiter zu Edeka" (not REWE)');
  await A.click('button:has-text("Weiter zu Edeka")');
  await check(A, 'Joghurt');
  await A.click('button:has-text("Einkauf abschließen")');
  await waitText(A, 'Einkauf abgeschlossen'); await A.waitForTimeout(600);
  ok(JSON.stringify(await names()) === JSON.stringify(['Crispy Choccies']), 'Crispy Choccies stays on the list');
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  ok((await cards(A)).join(',') === 'REWE' && await A.getByText('Heute nicht').count() === 0, 'next trip: REWE is back on the route');

  // ---- Heute auslassen (in the store: closed, too crowded …) ----
  await A.click('.tab:has-text("Liste")'); await add(A, ['Brot']);
  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  await A.click('button.cta:has-text("Einkauf starten bei Netto")');
  await waitText(A, 'Brot');
  await A.locator('.bottom-fade button[title="Mehr"], .bottom-fade button[aria-label="Mehr"]').last().click();
  await A.click('button:has-text("Heute auslassen")');
  await waitText(A, 'Crispy Choccies');
  ok(/\/laden\/rewe$/.test(A.url()), 'left out in the store → on to REWE');
  await A.click('text=‹ Zum Plan'); await A.waitForSelector('h1:text-is("Route")');
  ok(await A.locator('[data-skipped="netto"]').getByText('Brot').count() === 1, 'plan: "Heute nicht: Netto · Brot"');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
