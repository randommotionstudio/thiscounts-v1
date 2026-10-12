// V1.6: who is on which list – choosing people per list, what the database lets through, late joiners, per-list suggestions.
const { chromium, SHOTS, phone, login, resetDb, waitText, REST, AUTH, idToken, commit, getStatus } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const DOC = 'projects/demo-thiscounts/databases/(default)/documents/households/main';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const run = Date.now().toString(36);
const ts = ms => ({ timestampValue: new Date(ms).toISOString() });

async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
/** An account that is already in the household (as if it had joined with an invite) */
async function member(email, name) {
  await fetch(AUTH + ':signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'test1234', returnSecureToken: true }) });
  const t = await idToken(email);
  await fetch(REST + '/members/' + t.uid, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { name: { stringValue: name }, email: { stringValue: email }, invite: { stringValue: 'TEST22' }, joinedAt: ts(Date.now()) } }) });
  return t;
}
const hist = (name, listId, daysAgo) => fetch(REST + '/history', { method: 'POST', headers: owner, body: JSON.stringify({ fields: {
  name: { stringValue: name }, qty: { nullValue: null }, storeId: { nullValue: null }, listId: { stringValue: listId }, completedAt: ts(Date.now() - daysAgo * 864e5) } }) });
const listDoc = async id => (await fetch(REST + '/lists/' + id, { headers: owner })).json();
const menuNames = async P => { await P.click('.glass-head h1'); await P.waitForTimeout(250); const n = await P.locator('button span.ellipsis[style*="font-size: 16"]').allTextContents(); await P.mouse.click(10, 830); await P.waitForTimeout(200); return n; };

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser), c = await phone(browser);
  const A = a.page, B = b.page, C = c.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  const tomEmail = 'tom-' + run + '@example.com';
  const tom = await member(tomEmail, 'Tom');
  await login(C, tomEmail); await C.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  ok(true, 'Tom (joined later) is on the existing list "Wocheneinkauf"');
  await A.waitForTimeout(500);

  // ---- Michi makes "Baumarkt" for Anna and himself ----
  await A.click('h1:has-text("Wocheneinkauf")');
  await A.click('button:has-text("Neue Liste erstellen")');
  await A.fill('input[placeholder="z. B. Auf dem Heimweg"]', 'Baumarkt');
  await waitText(A, 'Wer ist dabei');
  ok(await A.locator('[role=checkbox][aria-label="Tom"][aria-checked=true]').count() === 1, 'new list: everyone is ticked at first');
  await A.click('[role=checkbox][aria-label="Tom"]');
  ok(await A.locator('[role=checkbox][aria-label="Tom"][aria-checked=false]').count() === 1, 'Tom unticked');
  await A.screenshot({ path: SHOTS + 'lp-01-who.png', fullPage: true });
  await A.click('button:has-text("Weiter zu den Läden")');
  await A.locator('.card:has-text("REWE")').click();
  await A.click('button:has-text("„Baumarkt“ erstellen")');
  await waitText(A, 'geteilt mit Anna');
  ok(await A.getByText('„Baumarkt“ ist startklar · geteilt mit Anna').count() === 1, 'toast: "geteilt mit Anna" (not Tom)');
  await add(A, ['Schrauben']);
  const listId = (await (await fetch(REST + '/lists', { headers: owner })).json()).documents.map(d => d.name.split('/').pop()).find(id => id !== 'wocheneinkauf');
  ok(JSON.stringify((await listDoc(listId)).fields.without.arrayValue.values.map(v => v.stringValue)) === JSON.stringify([tom.uid]), 'stored: Tom is not on Baumarkt');
  ok(await A.locator('[title="Geteilt mit Anna"]').count() === 1, 'Baumarkt header: shared with Anna only');

  // ---- Who sees it ----
  await B.waitForTimeout(800);
  ok((await menuNames(B)).includes('Baumarkt'), 'Anna has Baumarkt in her lists');
  ok(!(await menuNames(C)).includes('Baumarkt'), 'Tom does not see Baumarkt');
  ok(await C.getByText('Schrauben').count() === 0, 'Tom never sees its items');

  // ---- What the database lets through ----
  const anna = await idToken('annacvetkov@posteo.de');
  ok(await getStatus(anna.token, '/lists/' + listId + '/items') === 200, 'Anna can read Baumarkt items');
  ok(await getStatus(tom.token, '/lists/' + listId + '/items') === 403, 'Tom cannot read Baumarkt items (database)');
  ok(await commit(tom.token, [{ update: { name: DOC + '/lists/' + listId + '/items/x1', fields: { name: { stringValue: 'Hack' } } } }]) === 403, 'Tom cannot add items to Baumarkt');
  ok(await commit(tom.token, [{ update: { name: DOC + '/lists/' + listId, fields: { without: { arrayValue: {} } } }, updateMask: { fieldPaths: ['without'] } }]) === 403, 'Tom cannot put himself back on Baumarkt');
  ok(await getStatus(tom.token, '/lists/wocheneinkauf/items') === 200, 'Tom still reads Wocheneinkauf');
  // Someone who joins now is on Baumarkt too
  const lea = await member('lea-' + run + '@example.com', 'Lea');
  ok(await getStatus(lea.token, '/lists/' + listId + '/items') === 200, 'Lea (joins later) is on Baumarkt automatically');

  // ---- Per-list suggestions ----
  for (const d of [3, 10]) { await hist('Milch', 'wocheneinkauf', d); await hist('Dübel', listId, d); }
  await A.reload(); await A.waitForSelector('h1:has-text("Baumarkt")', { timeout: 20000 }); await A.waitForTimeout(1200);
  const chips = async () => { await A.focus(IN); await A.waitForTimeout(300); const t = await A.locator('.glass-head button:has(> span + span)').allTextContents(); await A.locator(IN).blur(); return t; };
  const bm = await chips();
  ok(bm.some(t => t.includes('Dübel')) && !bm.some(t => t.includes('Milch')), 'Baumarkt suggests Dübel, not Milch: ' + bm.join(', '));
  await A.click('h1:has-text("Baumarkt")'); await A.click('button:has-text("Wocheneinkauf")'); await A.waitForTimeout(600);
  const wk = await chips();
  ok(wk.some(t => t.includes('Milch')) && !wk.some(t => t.includes('Dübel')), 'Wocheneinkauf suggests Milch, not Dübel: ' + wk.join(', '));

  // ---- Remembered store/category is shared by all lists ----
  await A.click('h1:has-text("Wocheneinkauf")'); await A.click('button:has-text("Baumarkt")'); await A.waitForTimeout(400);
  await add(A, ['Akkuschrauber']);
  const catBtn = A.locator('div[style*="min-height: 56px"]', { has: A.getByText('Akkuschrauber', { exact: true }) }).locator('button[title="Kategorie ändern"]');
  await catBtn.click(); await A.locator('button', { hasText: /^Haushalt$/ }).first().click(); await A.waitForTimeout(300);
  await A.click('h1:has-text("Baumarkt")'); await A.click('button:has-text("Wocheneinkauf")'); await A.waitForTimeout(400);
  await add(A, ['Akkuschrauber']);
  await A.waitForTimeout(300);
  ok(await A.locator('[role=img][aria-label="Haushalt"]').count() >= 1, 'a category remembered on Baumarkt is used on Wocheneinkauf too');

  // ---- Putting Tom on, then off again while he looks at it ----
  await A.click('h1:has-text("Wocheneinkauf")'); await A.click('button:has-text("Baumarkt")'); await A.waitForTimeout(300);
  await A.click('h1:has-text("Baumarkt")');
  await A.locator('button[title="Liste bearbeiten"]').nth(1).click();
  await waitText(A, 'Wer ist dabei');
  await A.click('[role=checkbox][aria-label="Tom"]');
  await A.click('button:has-text("Änderungen speichern")');
  await C.waitForTimeout(1200);
  ok((await menuNames(C)).includes('Baumarkt'), 'Tom ticked again → Baumarkt appears for him');
  await C.click('.glass-head h1'); await C.click('button:has-text("Baumarkt")');
  await waitText(C, 'Schrauben').then(() => ok(true, '… with its items'), () => ok(false, 'Tom sees Baumarkt items'));
  await A.click('h1:has-text("Baumarkt")');
  await A.locator('button[title="Liste bearbeiten"]').nth(1).click();
  await A.click('[role=checkbox][aria-label="Tom"]');
  await A.click('button:has-text("Änderungen speichern")');
  await C.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 8000 }).then(() => ok(true, 'taken off while looking at it → Tom is back on Wocheneinkauf'), () => ok(false, 'Tom switched back to Wocheneinkauf'));
  ok(await C.getByText('keinen Zugriff').count() === 0, 'no "kein Zugriff" for Tom');
  await C.screenshot({ path: SHOTS + 'lp-02-tom-after.png' });

  // ---- On no list at all → a list of your own ----
  await A.click('h1:has-text("Baumarkt")'); await A.click('button:has-text("Wocheneinkauf")'); await A.waitForTimeout(300);
  await A.click('h1:has-text("Wocheneinkauf")');
  await A.locator('button[title="Liste bearbeiten"]').nth(0).click();
  await A.click('[role=checkbox][aria-label="Tom"]');
  await A.click('button:has-text("Änderungen speichern")');
  await C.waitForSelector('h1:has-text("Meine Liste")', { timeout: 15000 }).then(() => ok(true, 'Tom on no list → he gets "Meine Liste"'), () => ok(false, 'Tom gets "Meine Liste"'));
  await A.waitForTimeout(800);
  ok(!(await menuNames(A)).includes('Meine Liste'), 'Michi does not see Tom\'s own list');
  await A.screenshot({ path: SHOTS + 'lp-03-michi-menu.png' });
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
