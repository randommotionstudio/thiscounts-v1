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
  ok(await A.getByText('Ein neuer Einkauf ist möglich, sobald dieser abgeschlossen ist.').count() === 1, 'message: "Ein neuer Einkauf ist möglich, sobald dieser abgeschlossen ist."');
  ok(await A.getByText('Stattdessen hier starten').count() === 0, 'no "Stattdessen hier starten"');
  ok(await A.getByText('Woanders einkaufen').count() === 0, 'no "Woanders einkaufen"');
  await A.locator('button[aria-label="Mehr"], button[title="Mehr"]').first().click().catch(() => {});
  ok(await A.getByText('Mit diesem Laden starten').count() === 0, 'no "Mit diesem Laden starten" in the stop menu');
  await A.screenshot({ path: SHOTS + 'lock-01-locked.png' });
  ok(await cta(B).count() === 0 || await B.locator('button:has-text("Weiter zu trinkgut")').count() === 1, 'Anna herself carries on as usual');

  // A forgotten trip (the overnight report): Anna checks off everything at Netto but never taps on.
  await check(B, 'Milch');
  await A.waitForTimeout(800);
  const items = async () => ((await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: owner })).json()).documents || []).map(d => d.fields.name.stringValue).sort();
  const history = async () => ((await (await fetch(REST + '/history', { headers: owner })).json()).documents || []).map(d => d.fields.name.stringValue).sort();
  ok(JSON.stringify(await items()) === JSON.stringify(['Bananen', 'Milch', 'Wasser']), 'while Anna is active nothing is closed');
  // … 90 minutes without activity:
  const sess = await (await fetch(REST + '/sessions', { headers: owner })).json();
  const annaSession = sess.documents[0].name.split('/').pop();
  await fetch(REST + '/sessions/' + annaSession + '?updateMask.fieldPaths=updatedAt', { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { updatedAt: { timestampValue: new Date(Date.now() - 91 * 60000).toISOString() } } }) });
  await A.locator('[role=status]', { hasText: 'Der Einkauf von Anna wurde automatisch abgeschlossen' }).waitFor({ timeout: 8000 })
    .then(() => ok(true, 'Michi sees: "Der Einkauf von Anna wurde automatisch abgeschlossen"'), () => ok(false, 'toast about the closed trip'));
  await A.screenshot({ path: SHOTS + 'lock-03-auto-closed.png' });
  await A.waitForTimeout(1500); // Anna's phone may close it at the same time – that must not count twice
  ok(JSON.stringify(await items()) === JSON.stringify(['Wasser']), 'the checked items are off the list: ' + (await items()).join(', '));
  ok(JSON.stringify(await history()) === JSON.stringify(['Bananen', 'Milch']), 'and in the history exactly once: ' + (await history()).join(', '));
  ok(await A.getByText('Anna kauft gerade ein.').count() === 0 && await cta(A).isEnabled(), 'the lock lifts');
  ok(await A.locator('.card').count() === 1 && /Einkauf starten bei trinkgut/.test(await cta(A).innerText()), 'Michi starts a normal trip: "' + (await cta(A).innerText()) + '"');

  // Anna's phone, still open on Netto, goes back to the plan instead of shopping on (and locking Michi again)
  await B.waitForURL(/\/plan$/, { timeout: 8000 }).then(() => ok(true, 'Anna\'s open phone returns to the plan'), () => ok(false, 'Anna\'s phone returns to the plan: ' + B.url()));
  await A.waitForTimeout(1500);
  ok(await A.getByText('Anna kauft gerade ein.').count() === 0 && await cta(A).isEnabled(), 'Michi stays unlocked');
  // Anna opens the app hours later where she left it (store screen, trip expired on her phone too) → plan, no lock
  await B.evaluate(() => localStorage.setItem('thisCounts.trip.wocheneinkauf', JSON.stringify({ stop: 'netto', town: null, standIn: false, moves: {}, only: null, visited: ['netto'], touchedAt: Date.now() - 2 * 3600000 })));
  await B.goto('http://127.0.0.1:4173/laden/netto');
  await B.waitForURL(/\/plan$/, { timeout: 8000 }).then(() => ok(true, 'reopened on an expired trip → plan'), () => ok(false, 'reopened on an expired trip → plan: ' + B.url()));
  await A.waitForTimeout(1500);
  ok(await A.getByText('Anna kauft gerade ein.').count() === 0 && await cta(A).isEnabled(), '… and Michi is still unlocked');

  // Michi shops → Anna is locked; Michi himself is not
  await cta(A).click();
  await check(A, 'Wasser');
  await B.goto('http://127.0.0.1:4173/plan');
  await waitText(B, 'Michi kauft gerade ein.');
  ok(await cta(B).isDisabled(), 'and now Anna waits for Michi');
  await B.screenshot({ path: SHOTS + 'lock-02-other-way.png' });
  // Michi finishes properly → Anna is free again
  await A.click('button:has-text("Einkauf abschließen")');
  await B.waitForTimeout(1000);
  ok(await B.getByText('Michi kauft gerade ein.').count() === 0, 'Michi finished → Anna can start again');
  ok(JSON.stringify(await history()) === JSON.stringify(['Bananen', 'Milch', 'Wasser']), 'history: Bananen, Milch, Wasser');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
