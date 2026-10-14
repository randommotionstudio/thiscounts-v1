// V1.5: one person shops at a time – while someone is on a trip with a list, nobody else can start one.
const { chromium, SHOTS, phone, login, resetDb, waitText, REST } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
const cta = P => P.locator('.bottom-fade button.cta');

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Bananen', 'Milch', 'Wasser']);
  await A.click('button:has-text("Einsortieren")');
  await A.getByText('Wasser', { exact: true }).click(); await A.locator('button', { hasText: /^trinkgut$/ }).click();
  await waitText(B, 'Wasser');

  // Nobody shops: Michi could start
  await A.click('.tab:has-text("Plan")');
  ok(await cta(A).isEnabled(), 'before: "Einkauf starten" is enabled');

  // Anna starts → Michi is locked out
  await B.click('.tab:has-text("Plan")');
  await B.click('button:has-text("Einkauf starten bei Netto")');
  await check(B, 'Bananen');
  await waitText(A, 'Anna kauft gerade ein.');
  ok(await cta(A).isDisabled(), 'while Anna shops: Michi\'s "Einkauf starten" is greyed out');
  ok(await A.getByText('Du kannst starten, sobald der Einkauf abgeschlossen ist.').count() === 1, 'message: "Du kannst starten, sobald der Einkauf abgeschlossen ist."');
  ok(await A.getByText('Stattdessen hier starten').count() === 0, 'no "Stattdessen hier starten"');
  ok(await A.getByText('Woanders einkaufen').count() === 0, 'no "Woanders einkaufen"');
  await A.locator('button[aria-label="Mehr"], button[title="Mehr"]').first().click().catch(() => {});
  ok(await A.getByText('Mit diesem Laden starten').count() === 0, 'no "Mit diesem Laden starten" in the stop menu');
  await A.screenshot({ path: SHOTS + 'lock-01-locked.png' });
  ok(await cta(B).count() === 0 || await B.locator('button:has-text("Weiter zu trinkgut")').count() === 1, 'Anna herself carries on as usual');

  // A forgotten trip: 90 minutes without activity → the lock lifts
  const sess = await (await fetch(REST + '/sessions', { headers: owner })).json();
  const annaSession = sess.documents[0].name.split('/').pop();
  await fetch(REST + '/sessions/' + annaSession + '?updateMask.fieldPaths=updatedAt', { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { updatedAt: { timestampValue: new Date(Date.now() - 91 * 60000).toISOString() } } }) });
  await A.waitForTimeout(800);
  ok(await cta(A).isEnabled(), 'after 90 minutes without activity the lock lifts');
  ok(await A.getByText('Anna kauft gerade ein.').count() === 0, '… and the message is gone');

  // Anna carries on (fresh activity) → locked again; she finishes → free again
  await check(B, 'Milch');
  await waitText(A, 'Anna kauft gerade ein.');
  ok(await cta(A).isDisabled(), 'Anna is active again → locked again');
  await B.click('button:has-text("Weiter zu trinkgut")');
  await check(B, 'Wasser');
  await B.click('button:has-text("Einkauf abschließen")');
  await A.waitForTimeout(800);
  ok(await A.getByText('Anna kauft gerade ein.').count() === 0, 'Anna finished → message gone');
  await A.click('.tab:has-text("Liste")');
  await add(A, ['Butter']);
  await A.click('.tab:has-text("Plan")');
  ok(await cta(A).isEnabled() && /Einkauf starten bei Netto/.test(await cta(A).innerText()), 'after Anna\'s trip Michi can start');

  // Michi shops → Anna is locked; Michi himself is not
  await cta(A).click();
  await A.waitForTimeout(300);
  await check(A, 'Butter');
  await B.click('.tab:has-text("Plan")').catch(() => {});
  await waitText(B, 'Michi kauft gerade ein.');
  ok(await cta(B).isDisabled(), 'and now Anna waits for Michi');
  await B.screenshot({ path: SHOTS + 'lock-02-other-way.png' });
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
