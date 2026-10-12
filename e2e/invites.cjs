// V1.5: inviting people – registration with a link or a typed code, the rules behind it, names everywhere.
const { chromium, BASE, SHOTS, phone, login, resetDb, waitText, REST, AUTH, idToken, commit, getStatus } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const DOC = 'projects/demo-thiscounts/databases/(default)/documents/households/main';
const run = Date.now().toString(36);
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); await p.waitForTimeout(80); } await p.locator(IN).blur(); }
async function signUp(email) {
  await fetch(AUTH + ':signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'test1234', returnSecureToken: true }) });
  return idToken(email);
}
const ts = ms => ({ timestampValue: new Date(ms).toISOString() });
const joinWrites = (uid, email, code) => [
  { update: { name: DOC + '/members/' + uid, fields: { name: { stringValue: 'Rest' }, email: { stringValue: email }, invite: { stringValue: code }, joinedAt: ts(Date.now()) } }, currentDocument: { exists: false } },
  { update: { name: DOC + '/invites/' + code, fields: { usedBy: { stringValue: uid }, usedAt: ts(Date.now()) } }, updateMask: { fieldPaths: ['usedBy', 'usedAt'] } },
];
const putInvite = (code, expiresMs, createdBy = 'x') => fetch(REST + '/invites/' + code, { method: 'PATCH', headers: owner,
  body: JSON.stringify({ fields: { createdBy: { stringValue: createdBy }, createdAt: ts(Date.now()), expiresAt: ts(expiresMs), usedBy: { nullValue: null }, usedAt: { nullValue: null } } }) });
const doc = async path => (await fetch(REST + path, { headers: owner })).json();

async function newInvite(P) {
  await P.click('button:has-text("Jemanden einladen")');
  const el = P.locator('[data-code]');
  await el.waitFor();
  return el.getAttribute('data-code');
}

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser);
  const A = a.page;
  await a.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['Brot']);

  // ---- The original testers get their member entry on their own ----
  await A.waitForTimeout(800);
  const michi = await idToken('michael@rieplhuber.com');
  const m = await doc('/members/' + michi.uid);
  ok(m.fields && m.fields.name.stringValue === 'Michi', 'Michi has a member entry with the name "Michi"');

  // ---- Profile: members and a new invite ----
  await A.click('.tab:has-text("Profil")');
  await waitText(A, 'Mitglieder');
  ok(await A.getByText('Michi · Du').count() === 1, 'profile lists "Michi · Du"');
  ok(await A.getByText('Teilt alle Listen mit Anna').count() === 1, 'still shared with Anna (before Anna opens the new version)');
  const code1 = await newInvite(A);
  ok(/^[A-Z2-9]{6}$/.test(code1 || ''), 'invite sheet shows a 6-character code (' + code1 + ')');
  ok(await A.getByText(code1.slice(0, 3) + '-' + code1.slice(3)).count() >= 1, 'code shown as XXX-XXX');
  await A.click('button:has-text("Code kopieren")');
  await A.waitForTimeout(300);
  ok((await A.evaluate(() => navigator.clipboard.readText())) === code1.slice(0, 3) + '-' + code1.slice(3), '"Code kopieren" copies the code');
  await A.screenshot({ path: SHOTS + 'inv-01-sheet.png' });
  await A.click('.sheet-close');
  await A.waitForTimeout(300);
  ok(await A.locator('[data-invite="' + code1 + '"]').count() === 1, 'open invite listed in the profile');
  const inv = await doc('/invites/' + code1);
  const days = (Date.parse(inv.fields.expiresAt.timestampValue) - Date.now()) / 864e5;
  ok(days > 6.9 && days < 7.1, 'invite is valid for 7 days');

  // ---- Rules: what an outsider can't do ----
  const fremd = await idToken('fremd@example.com');
  ok(await getStatus(fremd.token, '/invites/' + code1) === 403, 'outsider cannot read invite codes');
  ok(await getStatus(fremd.token, '/lists/wocheneinkauf') === 403, 'outsider cannot read lists');
  ok(await commit(fremd.token, joinWrites(fremd.uid, 'fremd@example.com', 'ZZZZZZ')) !== 200, 'joining with a made-up code is refused');
  await putInvite('EXP222', Date.now() - 60000);
  ok(await commit(fremd.token, joinWrites(fremd.uid, 'fremd@example.com', 'EXP222')) === 403, 'joining with an expired code is refused');
  ok(await commit(fremd.token, [joinWrites(fremd.uid, 'fremd@example.com', code1)[0]]) === 403, 'a member entry without using the invite is refused');
  ok(await commit(michi.token, [{ update: { name: DOC + '/invites/LONG22', fields: { createdBy: { stringValue: michi.uid }, createdAt: ts(Date.now()), expiresAt: ts(Date.now() + 30 * 864e5), usedBy: { nullValue: null }, usedAt: { nullValue: null } } } }]) === 403, 'an invite valid for 30 days is refused');
  // A valid code works exactly once (control for the refusals above)
  await putInvite('ONCE22', Date.now() + 864e5);
  const r1 = await signUp('rest-' + run + '@example.com'), r2 = await signUp('rest2-' + run + '@example.com');
  ok(await commit(r1.token, joinWrites(r1.uid, 'rest@example.com', 'ONCE22')) === 200, 'a valid code lets someone join');
  ok(await getStatus(r1.token, '/lists/wocheneinkauf') === 200, '… who can then read the lists');
  ok(await commit(r2.token, joinWrites(r2.uid, 'rest2@example.com', 'ONCE22')) === 403, 'the same code a second time is refused');
  await fetch(REST + '/members/' + r1.uid, { method: 'DELETE', headers: owner });

  // ---- Registering from the invite link ----
  const c = await phone(browser), C = c.page;
  const tom = 'tom-' + run + '@example.com';
  await C.goto(BASE + '/einladung/' + code1);
  await waitText(C, 'Registrieren');
  ok(await C.locator('input[aria-label="Einladungscode"]').inputValue() === code1.slice(0, 3) + '-' + code1.slice(3), 'invite link opens the registration with the code filled in');
  await C.fill('input[autocomplete="given-name"]', 'Tom');
  await C.fill('input[type=email]', tom);
  await C.fill('input[type=password]', 'test1234');
  await C.screenshot({ path: SHOTS + 'inv-02-register.png' });
  await C.click('button.cta:has-text("Registrieren")');
  await C.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }).then(() => ok(true, 'Tom registers and sees the list'), () => ok(false, 'Tom registers and sees the list'));
  ok(await C.getByText('Brot', { exact: true }).count() === 1, 'Tom sees what Michi put on the list');
  ok(new URL(C.url()).pathname === '/', 'invite path is gone from the address bar');
  ok(await C.getByText('keinen Zugriff').count() === 0, 'no "kein Zugriff" flash');
  await A.waitForTimeout(800);
  ok(await A.locator('[data-invite="' + code1 + '"]').count() === 0, 'used invite disappears from the profile');
  ok(await A.getByText('Teilt alle Listen mit Anna und Tom').count() === 1, 'Michi now shares with "Anna und Tom"');
  await A.screenshot({ path: SHOTS + 'inv-03-profile.png', fullPage: true });

  // Tom's items carry his name
  await add(C, ['Honig']);
  await A.click('.tab:has-text("Liste")');
  await waitText(A, 'Honig');
  await A.waitForTimeout(400);
  ok(await A.locator('[aria-label="Neu von Tom"]').count() === 1, 'Michi sees "Neu von Tom"');
  ok(await A.locator('[title="Geteilt mit Anna und Tom"]').count() === 1, 'list header: shared with Anna and Tom');

  // ---- A used code: refused, and the new account is removed again ----
  const d = await phone(browser), D = d.page;
  const lea = 'lea-' + run + '@example.com';
  await D.goto(BASE + '/einladung/' + code1);
  await D.fill('input[autocomplete="given-name"]', 'Lea');
  await D.fill('input[type=email]', lea);
  await D.fill('input[type=password]', 'test1234');
  await D.click('button.cta:has-text("Registrieren")');
  await waitText(D, 'gilt nicht (mehr)', 15000).then(() => ok(true, 'used code → "Dieser Einladungscode gilt nicht (mehr)"'), () => ok(false, 'used code shows an error'));
  ok(await D.locator('h1:has-text("Registrieren")').count() === 1, 'stays on the registration screen');
  ok(!(await idToken(lea)), 'the half-made account was removed again');
  await D.screenshot({ path: SHOTS + 'inv-04-used.png' });

  // ---- Withdrawing an invite ----
  await A.click('.tab:has-text("Profil")');
  const code2 = await newInvite(A);
  await A.click('button:has-text("Einladung zurückziehen")');
  await A.waitForTimeout(500);
  ok(await A.locator('[data-invite="' + code2 + '"]').count() === 0, 'withdrawn invite is gone');
  ok(!(await doc('/invites/' + code2)).fields, '… also from the database');

  // ---- Typing the code by hand on the login screen ----
  const code3 = await newInvite(A);
  await A.click('.sheet-close');
  await D.goto(BASE + '/');
  await D.click('button:has-text("Neu hier? Mit Einladung registrieren")');
  await D.fill('input[autocomplete="given-name"]', 'Lea');
  await D.fill('input[type=email]', lea);
  await D.fill('input[type=password]', 'test1234');
  await D.fill('input[aria-label="Einladungscode"]', code3.slice(0, 3).toLowerCase() + ' ' + code3.slice(3).toLowerCase());
  await D.click('button.cta:has-text("Registrieren")');
  await D.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }).then(() => ok(true, 'typed code (lower case, with a space) works'), () => ok(false, 'typed code works'));

  // ---- An account without access joins from the "kein Zugriff" screen ----
  const code4 = await newInvite(A);
  await A.click('.sheet-close');
  const f = await phone(browser), F = f.page;
  await login(F, 'fremd@example.com');
  await waitText(F, 'keinen Zugriff', 15000);
  await F.click('button:has-text("Mit Einladungscode beitreten")');
  await F.fill('input[aria-label="Dein Name"]', 'Fremd');
  await F.fill('input[aria-label="Einladungscode"]', code4);
  await F.screenshot({ path: SHOTS + 'inv-05-denied-join.png' });
  await F.click('button:has-text("Beitreten")');
  await F.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }).then(() => ok(true, 'existing account joins with a code'), () => ok(false, 'existing account joins with a code'));
  await A.waitForTimeout(800);
  ok(await A.getByText('Teilt alle Listen mit Anna, Tom, Lea und Fremd').count() === 1, 'Michi shares with "Anna, Tom, Lea und Fremd"');
  await A.screenshot({ path: SHOTS + 'inv-06-four.png', fullPage: true });
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
