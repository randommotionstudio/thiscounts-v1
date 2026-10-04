// "Woanders einkaufen": spontaneous trip with the whole list at any store
const { chromium, SHOTS, BASE, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const auth = { Authorization: 'Bearer owner' };
const itemDocs = async () => ((await (await fetch(H + '/lists/wocheneinkauf/items', { headers: auth })).json()).documents || []);
const byName = async n => { const d = (await itemDocs()).find(x => x.fields.name.stringValue === n); return d && d.fields; };
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Milch', 'Brot', 'Shampoo', 'Wasser']) { await A.fill(IN, t); await A.press(IN, 'Enter'); }
  await A.click('button:has-text("Einsortieren")').catch(() => {}); await A.locator(IN).blur();
  await A.getByText('Shampoo', { exact: true }).click(); await A.locator('button', { hasText: /^DM$/ }).click();
  await A.getByText('Wasser', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await A.waitForTimeout(3600);

  // Plan: quiet link, sheet with all stores
  await A.click('.tab:has-text("Plan")'); await A.waitForTimeout(400);
  const link = A.locator('button', { hasText: 'Woanders einkaufen …' });
  ok(await link.count() === 1, 'Plan shows "Woanders einkaufen …"');
  const fs = await link.evaluate(e => getComputedStyle(e).fontSize + ' ' + getComputedStyle(e).backgroundColor);
  ok(/^14px rgba\(0, 0, 0, 0\)/.test(fs), 'it is a small text link, not a button: ' + fs);
  await link.scrollIntoViewIfNeeded(); await A.screenshot({ path: SHOTS + '190-plan-link.png' });
  await link.click(); await A.waitForTimeout(400);
  const rows = await A.locator('.sheet button:has(.logo-tile)').allTextContents();
  ok(rows.length === 5 && rows.some(t => t.startsWith('Edeka')) && rows.some(t => t.startsWith('REWE')), 'sheet lists all stores (5): ' + rows.map(t => t.split(/[A-ZÄÖÜ][a-zäöü]+straße|Hoch|Syst|Bern/)[0]).join(', '));
  await A.screenshot({ path: SHOTS + '191-elsewhere-sheet.png' });
  // A store that isn't set up yet: create ALDI right here
  await A.click('text=Laden fehlt? Neu anlegen'); await A.waitForTimeout(300);
  await A.fill('input[placeholder="z. B. Edeka"]', 'ALDI'); await A.click('button[title="Aldi Süd"]');
  await A.click('button:has-text("Laden speichern")'); await A.waitForTimeout(1200);
  ok(/\/spontan\//.test(A.url()), 'new store → straight into the spontaneous trip: ' + A.url().replace(BASE, ''));
  ok(await A.locator('h1', { hasText: 'ALDI' }).count() === 1 && await A.getByText('Spontaner Einkauf').count() === 1, 'header: ALDI · Spontaner Einkauf');
  const names = await A.locator('[role=checkbox]').allTextContents();
  ok(['Milch', 'Brot', 'Shampoo', 'Wasser'].every(n => names.some(t => t.startsWith(n))), 'the whole list is here: ' + names.length + ' items');
  ok(await A.getByText('Nicht gefunden').count() === 0, 'no "Nicht gefunden" buttons');
  await A.screenshot({ path: SHOTS + '192-spontaneous-aldi.png' });

  // Partner sees it
  await B.waitForTimeout(800);
  ok(await B.getByText('ALDI · spontan, mit der ganzen Liste').count() === 1, 'partner live card: ALDI · spontan');

  const check = n => A.locator('[role=checkbox]', { has: A.getByText(n, { exact: true }) }).click();
  await check('Milch'); await check('Brot'); await A.waitForTimeout(400);
  // Step out to the plan and come back
  await A.click('text=‹ Zum Plan'); await A.waitForTimeout(400);
  const cta = await A.locator('.cta').textContent();
  ok(cta === 'Weiter einkaufen bei ALDI', 'Plan CTA while the spontaneous trip runs: ' + cta);
  await A.locator('.cta').click(); await A.waitForTimeout(500);
  ok(/\/spontan\//.test(A.url()), 'back in the spontaneous trip');
  ok(await A.locator('.bottom-fade button').last().textContent() === 'Einkauf abschließen', 'CTA: Einkauf abschließen');
  await A.locator('.bottom-fade button').last().click(); await A.waitForTimeout(1200);
  const toast = await A.locator('[role=status]').allTextContents();
  ok(toast.some(t => t === 'Einkauf bei ALDI abgeschlossen · 2 erledigt · 2 bleiben auf der Liste'), 'toast: ' + toast.join(' | '));
  const docs = await itemDocs();
  ok(!docs.some(d => ['Milch', 'Brot'].includes(d.fields.name.stringValue)), 'Milch and Brot are done (off the list)');
  const sh = await byName('Shampoo'), wa = await byName('Wasser');
  ok(sh && sh.storeId.stringValue === 'dm' && wa && wa.storeId.stringValue === 'trinkgut', 'Shampoo stays with DM, Wasser with trinkgut');
  const sess = await (await fetch(H + '/sessions', { headers: auth })).json();
  ok(!(sess.documents || []).length, 'session ended');
  await B.waitForTimeout(800);
  ok(await B.getByText('kauft gerade ein').count() === 0, 'partner live card gone');

  // trinkgut has a set-up path → departments it doesn't carry go to the bottom
  await A.fill(IN, 'Milch'); await A.press(IN, 'Enter'); await A.locator(IN).blur(); await A.waitForTimeout(600);
  await A.click('.tab:has-text("Plan")'); await A.click('text=Woanders einkaufen …'); await A.waitForTimeout(300);
  await A.locator('.sheet button:has(.logo-tile)', { hasText: 'trinkgut' }).click(); await A.waitForTimeout(900);
  const txt = await A.locator('.scroll').innerText();
  const cut = txt.indexOf("Gibt's hier vermutlich nicht");
  ok(cut > 0 && txt.indexOf('Wasser') < cut && txt.indexOf('Shampoo') > cut && txt.lastIndexOf('Milch') > cut, 'trinkgut: Wasser on the path, Shampoo + Milch under "Gibt\'s hier vermutlich nicht"');
  await A.screenshot({ path: SHOTS + '193-spontaneous-trinkgut.png', fullPage: true });
  // Nothing checked → "Ohne Einkauf zurück" ends the trip without touching anything
  ok(await A.locator('.bottom-fade button').last().textContent() === 'Ohne Einkauf zurück', 'nothing checked → "Ohne Einkauf zurück"');
  await A.locator('.bottom-fade button').last().click(); await A.waitForTimeout(800);
  ok(/\/plan$/.test(A.url()) && (await A.locator('.cta').textContent()).startsWith('Einkauf starten bei'), 'back on the plan, normal route again');
  ok((await itemDocs()).length === 3, 'all 3 items still on the list');
  // Reload in the middle of a spontaneous trip keeps you there
  await A.click('text=Woanders einkaufen …'); await A.locator('.sheet button:has(.logo-tile)', { hasText: 'Edeka' }).click(); await A.waitForTimeout(600);
  await A.reload(); await A.waitForTimeout(1500);
  ok(/\/spontan\/edeka$/.test(A.url()) && await A.getByText('Spontaner Einkauf').count() === 1, 'reload keeps the spontaneous trip');
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
