const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const REST = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const cta = P => P.locator('.bottom-fade > button').last();
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Bananen', 'Brot', 'Milch', 'Wasser']) { await A.fill(IN, t); await A.press(IN, 'Enter'); }
  await waitText(B, 'Wasser');
  // Seeded stores count as set up since V1.3 → give Netto no path, so the setup flow is tested
  await fetch(REST + '/stores/netto?updateMask.fieldPaths=categoryOrder&updateMask.fieldPaths=orderSetAt&updateMask.fieldPaths=orderCheckedAt', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { categoryOrder: { nullValue: null }, orderSetAt: { nullValue: null }, orderCheckedAt: { nullValue: null } } }) });
  await A.waitForTimeout(600);
  for (const P of [A, B]) { await P.click('.tab:has-text("Plan")'); await P.click('button:has-text("Einkauf starten bei Netto")'); }
  const groupsOf = P => P.locator('span[style*="uppercase"]').allTextContents();
  console.log('   Netto groups before:', (await groupsOf(B)).join(' → '));
  await A.click('text=Hilf mit, diese Filiale genauer zu machen');
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '90-A-refine-setup.png' });
  ok((await cta(A).textContent()) === 'Erste Abteilung antippen', 'CTA: Erste Abteilung antippen');
  for (const d of ['Getränke', 'Milchprodukte', 'Obst & Gemüse', 'Backwaren']) await A.locator('button', { hasText: d }).last().click();
  ok((await cta(A).textContent()) === 'Alle Abteilungen einordnen', 'CTA: Alle Abteilungen einordnen');
  // pick Obst & Gemüse (3rd) and move it to the front twice
  await A.locator('button', { hasText: 'Obst & Gemüse' }).first().click();
  await A.screenshot({ path: SHOTS + '91-A-refine-pick.png' });
  await A.click('button[aria-label="Nach vorne"]'); await A.click('button[aria-label="Nach vorne"]');
  await A.click('button:has-text("Fertig")');
  await A.click('text=Ich bestätige, dass es diese Abteilungen in dieser Filiale nicht gibt.');
  ok((await cta(A).textContent()) === 'Reihenfolge speichern', 'CTA: Reihenfolge speichern');
  await A.screenshot({ path: SHOTS + '92-A-refine-ready.png', fullPage: true });
  await cta(A).click();
  await A.waitForTimeout(500);
  ok(await A.getByText('Netto nutzt jetzt deinen Weg – auch für Anna').count() === 1, 'toast: Netto nutzt jetzt deinen Weg – auch für Anna');
  const t0 = Date.now();
  await B.waitForFunction(() => [...document.querySelectorAll('span')].filter(s => s.style.textTransform === 'uppercase').map(s => s.textContent)[0] === 'Obst & Gemüse', null, { timeout: 5000 }).catch(() => {});
  const after = await groupsOf(B);
  console.log('   Netto groups on B after:', after.join(' → '), '(' + (Date.now() - t0) + ' ms)');
  ok(after.join('|') === 'Obst & Gemüse|Getränke|Milchprodukte|Backwaren', 'B re-sorted by the new order');
  const st = await (await fetch(REST + '/stores/netto', { headers: { Authorization: 'Bearer owner' } })).json();
  ok(JSON.stringify(st.fields.categoryOrder.arrayValue.values.map(v => v.stringValue)) === JSON.stringify(['Obst & Gemüse', 'Getränke', 'Milchprodukte', 'Backwaren']) && !!st.fields.orderSetAt.timestampValue, 'stored order has no Kasse, orderSetAt set');
  ok(await A.getByText('Aufbau der Filiale geändert?').count() === 1, 'cool-down link after saving');
  // edit mode: unchanged → disabled
  await A.click('text=Aufbau der Filiale geändert?');
  ok((await cta(A).textContent()) === 'Noch keine Änderung', 'edit CTA: Noch keine Änderung');
  ok(await A.getByText(/^Gespeichert heute\./).count() === 1, 'edit intro: Gespeichert heute');
  await A.click('text=‹ Zurück in den Laden');
  // 61 days back → check-back card
  const old = new Date(Date.now() - 61 * 86400000).toISOString();
  await fetch(REST + '/stores/netto?updateMask.fieldPaths=orderCheckedAt', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { orderCheckedAt: { timestampValue: old } } }) });
  await A.getByText('Stimmt dein Weg noch?').waitFor({ timeout: 5000 }).then(() => ok(true, 'check-back card after 61 days'), () => ok(false, 'check-back card'));
  ok(await A.getByText('Gespeichert vor 2 Monaten').count() === 1, 'check-back sub: Gespeichert vor 2 Monaten');
  await A.screenshot({ path: SHOTS + '93-A-checkback.png' });
  await A.click('button:has-text("Passt noch")');
  await A.waitForTimeout(400);
  ok(await A.getByText('Aufbau der Filiale geändert?').count() === 1 && await A.getByText('Danke! Weg bei Netto bestätigt').count() === 1, '"Passt noch" → toast + back to the link');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
