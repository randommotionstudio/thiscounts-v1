// Items without a store ("Offen · Laden wählen", e.g. after "… führt … nicht") used to be left out of the trip
// silently. Now, on the way from the list (or profile) to the plan, a store has to be chosen first; closing the
// choice stays where it was. Not during a trip.
const { chromium, SHOTS, phone, login, resetDb, waitText, REST } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const cards = async P => P.locator('.card .ellipsis[style*="font-weight: 600"]').allTextContents();
const park = async name => {
  const docs = (await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: owner })).json()).documents;
  const id = docs.find(d => d.fields.name.stringValue === name).name.split('/').pop();
  await fetch(REST + '/lists/wocheneinkauf/items/' + id + '?updateMask.fieldPaths=parked&updateMask.fieldPaths=storeId', { method: 'PATCH', headers: owner,
    body: JSON.stringify({ fields: { parked: { booleanValue: true }, storeId: { nullValue: null } } }) });
};
const onList = P => P.locator('h1:has-text("Wocheneinkauf")').count().then(n => n === 1);
const onPlan = P => P.locator('h1:text-is("Route")').count().then(n => n === 1);

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Bananen', 'Paprika', 'Milch', 'Brot']);
  await A.waitForTimeout(800);
  await park('Paprika');
  await waitText(A, 'Offen · Laden wählen');
  ok(await A.getByText('Schwarz markierte Artikel').count() === 0, 'list: no extra note, "Offen · Laden wählen" speaks for itself');

  // ---- The Plan tab asks for a store first ----
  await A.click('.tab:has-text("Plan")');
  await waitText(A, 'Wo gibt’s Paprika?'); await A.waitForTimeout(400);
  ok(await onList(A) && !(await onPlan(A)), 'tab "Plan": the store choice opens on the list, the plan waits');
  ok(await A.getByText('Ohne Laden kommt Paprika beim Einkauf nicht mit. Der Laden wird gemerkt.').count() === 1, 'it says why');
  const choices = await A.locator('.sheet button .ellipsis[style*="font-weight: 600"]').allTextContents();
  ok(choices.includes('Edeka') && choices.includes('Netto'), 'the list\'s stores to choose from: ' + choices.join(', '));
  await A.screenshot({ path: SHOTS + 'list-unassigned.png' });
  // closing: stay on the list
  await A.locator('.sheet [aria-label="Schließen"]').click(); await A.waitForTimeout(400);
  ok(await onList(A) && await A.getByText('Wo gibt’s Paprika?').count() === 0, 'closed → still on the list');

  // ---- "Einkaufsplan ansehen" too; picking a store goes on to the plan ----
  await A.click('.bottom-fade button.cta');
  await waitText(A, 'Wo gibt’s Paprika?');
  await A.locator('.sheet button', { hasText: 'Edeka' }).click();
  await A.waitForSelector('h1:text-is("Route")', { timeout: 5000 }).then(() => ok(true, 'store chosen → on to the plan'), () => ok(false, 'store chosen → on to the plan'));
  await waitText(A, 'Paprika kommt mit zu Edeka');
  ok(await A.locator('[data-unassigned]').count() === 0, 'no card in the plan');
  ok((await cards(A)).join(',') === 'Netto,Edeka' && await A.locator('.card', { hasText: 'Edeka' }).getByText('Paprika').count() === 1, 'Paprika is on the route at Edeka');
  await A.waitForTimeout(500);
  const mems = (await (await fetch(REST + '/memory', { headers: owner })).json()).documents || [];
  const m = mems.find(d => d.fields.name && d.fields.name.stringValue === 'paprika');
  ok(!!m && m.fields.stores.mapValue.fields.wocheneinkauf.stringValue === 'edeka', 'Edeka is remembered for Paprika');

  // ---- Two items, from the profile: one after the other ----
  await park('Milch'); await park('Brot');
  await A.click('.tab:has-text("Profil")'); await A.waitForTimeout(600);
  await A.click('.tab:has-text("Plan")');
  await A.locator('.sheet h2, .sheet [class*="title"], .sheet').filter({ hasText: 'Wo gibt’s' }).first().waitFor({ timeout: 5000 });
  ok(await A.getByText(/^Noch 2 Artikel ohne Laden\./).count() === 1 && !(await onPlan(A)), 'from Profil too: "Noch 2 Artikel ohne Laden"');
  const first = (await A.getByText(/^Wo gibt’s (Milch|Brot)\?$/).innerText()).match(/Milch|Brot/)[0];
  await A.locator('.sheet button', { hasText: 'REWE' }).click(); await A.waitForTimeout(500);
  const second = first === 'Milch' ? 'Brot' : 'Milch';
  ok(await A.getByText('Wo gibt’s ' + second + '?').count() === 1 && !(await onPlan(A)), 'then the second one: ' + second);
  await A.locator('.sheet button', { hasText: 'Netto' }).click();
  await A.waitForSelector('h1:text-is("Route")', { timeout: 5000 }).then(() => ok(true, 'both chosen → plan'), () => ok(false, 'both chosen → plan'));

  // ---- During a trip: no stop ----
  await A.click('button.cta:has-text("Einkauf starten")'); await A.waitForTimeout(800);
  await A.click('text=‹ Zum Plan'); await A.click('.tab:has-text("Liste")'); await A.waitForTimeout(400);
  await park('Bananen'); await waitText(A, 'Offen · Laden wählen');
  await A.click('.tab:has-text("Plan")');
  await A.waitForSelector('h1:text-is("Route")', { timeout: 5000 }).then(() => ok(true, 'during a trip the plan opens straight away'), () => ok(false, 'during a trip the plan opens straight away'));
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
