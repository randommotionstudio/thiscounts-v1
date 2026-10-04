const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const REST = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['5 Bananen', 'Milch 2 l', 'Butter', 'Mehl', 'Wasser 6 Flaschen']);
  await A.click('button:has-text("Einsortieren")');
  await A.getByText('Wasser', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await waitText(B, 'Wasser');
  await B.waitForTimeout(500);

  // ---- B: Neu-Markierung ----
  ok(await B.locator('[aria-label="Neu von Michi"]').count() === 5, 'B sees 5 "Neu von Michi" markers');
  ok(await A.locator('[aria-label^="Neu von"]').count() === 0, 'A sees no markers on own items');
  await B.screenshot({ path: SHOTS + '80-B-markers.png' });

  // ---- B shops at Netto ----
  await B.click('.tab:has-text("Plan")');
  await B.click('button:has-text("Einkauf starten bei Netto")');
  await B.waitForTimeout(300);
  ok(await B.getByText('Aufbau der Filiale geändert?').count() === 1, 'seeded store shows the edit link');
  for (const n of ['Bananen', 'Milch', 'Butter']) await check(B, n);
  await A.waitForTimeout(800);
  const card = await A.getByText('Anna kauft gerade ein').count();
  ok(card === 1, 'A sees live card "Anna kauft gerade ein"');
  ok((await A.getByText('Netto · Stopp 1 von 2').count()) === 1, 'live card sub: Netto · Stopp 1 von 2');
  await A.screenshot({ path: SHOTS + '81-A-livecard.png' });

  // R2: Sahne (Milchprodukte, passed) → banner on B
  await add(A, ['Sahne']);
  await B.getByText('Michi hat Sahne hinzugefügt').waitFor({ timeout: 8000 }).then(() => ok(true, 'B gets banner for Sahne (passed)'), () => ok(false, 'B gets banner for Sahne'));
  ok(await B.getByText('Neu · schon vorbei').count() === 1, 'Sahne tagged "Neu · schon vorbei"');
  ok(await A.getByText(/hat Sahne hinzugefügt|ist schon bei/).count() === 0, 'A (adder) gets nothing');
  // R3: Hefe (Backzutaten, ahead) → tag only
  await add(A, ['Hefe']);
  await waitText(B, 'Hefe');
  await B.waitForTimeout(400);
  ok(await B.getByText('Neu von Michi').count() >= 1, 'Hefe tagged "Neu von Michi"');
  ok(await B.getByText('Michi hat Hefe hinzugefügt').count() === 0, 'no banner for Hefe (still ahead)');
  await B.screenshot({ path: SHOTS + '82-B-banner-tags.png' });

  // B finishes Netto → Weiter zu trinkgut (Netto done)
  for (const n of ['Sahne', 'Hefe', 'Mehl']) await check(B, n);
  await B.screenshot({ path: SHOTS + '139-t8-before-weiter.png' });
  await B.click('button:has-text("Weiter zu trinkgut")');
  await B.waitForTimeout(600);
  await B.screenshot({ path: SHOTS + '139-t8-after-weiter.png' });
  ok(await A.getByText('trinkgut · Stopp 2 von 2 · Netto erledigt').count() === 1, 'live card: trinkgut · Stopp 2 von 2 · Netto erledigt');

  // R5 Rückfrage: A adds Käse (→ Netto, done) → mitnehmen
  await add(A, ['Käse']);
  await A.getByText('Anna ist schon bei trinkgut').waitFor({ timeout: 5000 }).then(() => ok(true, 'A gets Rückfrage'), () => ok(false, 'A gets Rückfrage'));
  await A.screenshot({ path: SHOTS + '83-A-rueckfrage.png' });
  ok(await B.getByText('Käse', { exact: true }).count() === 0, 'B does not see Käse while the question is open');
  await A.click('button:has-text("Bei trinkgut mitnehmen")');
  await waitText(B, 'Käse');
  ok(true, 'after "mitnehmen" Käse appears at trinkgut on B');
  // Quark → nächster Einkauf
  await add(A, ['Quark']);
  await A.getByText('Anna ist schon bei trinkgut').waitFor({ timeout: 5000 });
  await A.click('button:has-text("Beim nächsten Netto-Einkauf")');
  await A.waitForTimeout(800);
  ok(await B.getByText('Quark', { exact: true }).count() === 0, 'Quark (next trip) not in B store mode');

  // R2 at trinkgut after Rückfrage: check Wasser (Getränke done → Haushalt passed), A adds Spülmittel → mitnehmen → banner
  await check(B, 'Wasser');
  await B.waitForTimeout(400);
  await add(A, ['Spülmittel']);
  await A.getByText('Anna ist schon bei trinkgut').waitFor({ timeout: 5000 });
  await A.click('button:has-text("Bei trinkgut mitnehmen")');
  await B.getByText('Michi hat Spülmittel hinzugefügt').waitFor({ timeout: 8000 }).then(() => ok(true, 'banner after "mitnehmen" when category passed (R5 → R2)'), () => ok(false, 'banner after mitnehmen'));
  await B.screenshot({ path: SHOTS + '84-B-trinkgut.png' });

  // Profil switch off → no banner, tags still show
  await B.click('button[title="Mehr"]'); await B.click('button:has-text("Zum Plan")');
  await B.click('.tab:has-text("Profil")');
  await B.click('[role=switch]');
  await B.waitForTimeout(300);
  await B.screenshot({ path: SHOTS + '85-B-profil.png', fullPage: true });
  await B.click('.tab:has-text("Plan")');
  await B.click('button:has-text("Weiter einkaufen bei trinkgut")');
  await add(A, ['Klopapier']);
  await A.getByText('Anna ist schon bei trinkgut').waitFor({ timeout: 5000 });
  await A.click('button:has-text("Bei trinkgut mitnehmen")');
  await waitText(B, 'Klopapier');
  await B.waitForTimeout(500);
  ok(await B.getByText('Michi hat Klopapier hinzugefügt').count() === 0, 'switch off → no banner');
  ok(await B.getByText('Neu · schon vorbei').count() >= 1, 'switch off → tag still shows');

  // Finish → session gone, Quark back
  for (const n of ['Käse', 'Spülmittel', 'Klopapier']) await check(B, n);
  await B.click('button:has-text("Einkauf abschließen")');
  await B.waitForTimeout(800); await B.screenshot({ path: SHOTS + "154-t8-finish.png" });
  ok(await A.getByText('Anna kauft gerade ein').count() === 0, 'after finish the live card is gone');
  const q = await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: { Authorization: 'Bearer owner' } })).json();
  const quark = (q.documents || []).find(d => d.fields.name.stringValue === 'Quark');
  ok(quark && quark.fields.nextTrip.booleanValue === false, 'Quark is back on the next trip (nextTrip cleared)');
  const sess = await (await fetch(REST + '/sessions', { headers: { Authorization: 'Bearer owner' } })).json();
  ok(!(sess.documents || []).length, 'session deleted');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
