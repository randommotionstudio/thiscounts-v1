// Items without a store ("Offen · Laden wählen") used to be left out of the trip silently. The plan now shows them
// at the top ("1 Artikel ohne Laden") with "Laden wählen"; picking a store puts the item on the route and
// remembers it. The old note on the list is gone.
const { chromium, SHOTS, phone, login, resetDb, waitText, REST } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
const cards = async P => P.locator('.card:not([data-unassigned]) .ellipsis[style*="font-weight: 600"]').allTextContents();

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Bananen', 'Paprika', 'Milch']);
  await A.waitForTimeout(800);
  // Paprika lost its store ("… führt Paprika nicht")
  const docs = (await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: owner })).json()).documents;
  const pap = docs.find(d => d.fields.name.stringValue === 'Paprika').name.split('/').pop();
  await fetch(REST + '/lists/wocheneinkauf/items/' + pap + '?updateMask.fieldPaths=parked&updateMask.fieldPaths=storeId', { method: 'PATCH', headers: owner,
    body: JSON.stringify({ fields: { parked: { booleanValue: true }, storeId: { nullValue: null } } }) });
  await waitText(A, 'Offen · Laden wählen');
  ok(await A.getByText('Schwarz markierte Artikel').count() === 0, 'list: no extra note, "Offen · Laden wählen" speaks for itself');

  await A.click('.tab:has-text("Plan")'); await A.waitForSelector('h1:text-is("Route")');
  const box = A.locator('[data-unassigned]');
  ok(await box.count() === 1 && /1 Artikel ohne Laden/.test(await box.innerText()) && /Paprika/.test(await box.innerText()), 'plan: "1 Artikel ohne Laden · Paprika" at the top');
  const top = (await box.boundingBox()).y, firstStop = (await A.locator('.card:not([data-unassigned])').first().boundingBox()).y;
  ok(top < firstStop, 'above the route, so it is seen before starting');
  ok((await cards(A)).join(',') === 'Netto', 'the route itself: only Netto');
  await A.screenshot({ path: SHOTS + 'plan-unassigned.png' });

  await box.locator('button:has-text("Laden wählen")').click();
  await waitText(A, 'Wo gibt’s Paprika?');
  const choices = await A.locator('.sheet button .ellipsis[style*="font-weight: 600"]').allTextContents();
  ok(choices.includes('Edeka') && choices.includes('Netto'), 'the list\'s stores to choose from: ' + choices.join(', '));
  await A.waitForTimeout(500); await A.screenshot({ path: SHOTS + 'plan-unassigned-pick.png' });
  await A.locator('.sheet button', { hasText: 'Edeka' }).click();
  await waitText(A, 'Paprika kommt mit zu Edeka');
  await A.waitForTimeout(500);
  ok(await A.locator('[data-unassigned]').count() === 0, 'the card is gone');
  ok((await cards(A)).join(',') === 'Netto,Edeka' && await A.locator('.card', { hasText: 'Edeka' }).getByText('Paprika').count() === 1, 'Paprika is on the route at Edeka');
  await A.waitForTimeout(500);
  const mems = (await (await fetch(REST + '/memory', { headers: owner })).json()).documents || [];
  const m = mems.find(d => d.fields.name && d.fields.name.stringValue === 'paprika');
  ok(!!m && m.fields.stores.mapValue.fields.wocheneinkauf.stringValue === 'edeka', 'Edeka is remembered for Paprika');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
