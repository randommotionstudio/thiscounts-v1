// The launch screen (app icon on beige) shows from the first moment and stays until the first screen is complete:
// when it fades, the other person's avatar, the items and the suggestions are already final – nothing fills in
// afterwards. At most 1.5 s, logged out straight to the login, and it works offline.
const { chromium, phone, login, resetDb, REST, SHOTS } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const DAY = 86400000;
const hist = (name, daysAgo) => fetch(REST + '/history', { method: 'POST', headers: owner, body: JSON.stringify({ fields: {
  name: { stringValue: name }, qty: { nullValue: null }, storeId: { nullValue: null }, listId: { stringValue: 'wocheneinkauf' },
  completedAt: { timestampValue: new Date(Date.now() - daysAgo * DAY).toISOString() } } }) });

// Watches the launch screen from the very start of the page: when it appeared, and what the screen showed the
// moment it began to fade
const WATCH = () => {
  const t0 = performance.now();
  const shot = () => ({
    head: (document.querySelector('.glass-head') || {}).innerHTML || '',
    list: (document.querySelector('.scroll') || {}).innerText || '',
  });
  window.__launch = { seenAt: null, fadeAt: null, at: null };
  const check = () => {
    const el = document.getElementById('launch');
    if (el && window.__launch.seenAt === null) window.__launch.seenAt = performance.now() - t0;
    if (el && el.classList.contains('out') && window.__launch.fadeAt === null) { window.__launch.fadeAt = performance.now() - t0; window.__launch.at = shot(); }
  };
  new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  check();
};

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), A = a.page, b = await phone(browser), B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  // Anna has her own avatar, the list has items, and there are suggestions
  // (her member entry is written by her phone a moment after logging in)
  let anna = null;
  for (let i = 0; i < 50 && !anna; i++) {
    const docs = (await (await fetch(REST + '/members', { headers: owner })).json()).documents || [];
    const m = docs.find(d => d.fields.email && d.fields.email.stringValue === 'annacvetkov@posteo.de');
    if (m) anna = m.name.split('/').pop(); else await A.waitForTimeout(200);
  }
  await fetch(REST.replace(/households\/main$/, 'users/') + anna + '?updateMask.fieldPaths=avatar', { method: 'PATCH', headers: owner,
    body: JSON.stringify({ fields: { avatar: { mapValue: { fields: { kind: { stringValue: 'icon' }, icon: { stringValue: 'cherry' }, color: { stringValue: 'mint' } } } } } }) });
  for (const n of ['Kiwi', 'Eier', 'Käse', 'Sahne']) { await hist(n, 3); await hist(n, 10); }
  for (const t of ['Bananen', 'Milch', 'Brot']) { await A.fill(IN, t); await A.press(IN, 'Enter'); await A.waitForTimeout(60); }
  await A.locator(IN).blur(); await A.waitForTimeout(1500);
  await A.addInitScript(WATCH);

  const open = async label => {
    const t = Date.now();
    await A.reload();
    await A.waitForFunction(() => !document.getElementById('launch'), null, { timeout: 5000 });
    const gone = Date.now() - t;
    const r = await A.evaluate(() => window.__launch);
    await A.waitForTimeout(1500);
    const final = await A.evaluate(() => ({ head: document.querySelector('.glass-head').innerHTML, list: document.querySelector('.scroll').innerText }));
    ok(r.seenAt !== null && r.seenAt < 50, label + ': the launch screen is there from the first moment');
    ok(gone < 2000 && r.fadeAt !== null && r.fadeAt <= 1600, label + ': gone after ' + Math.round(r.fadeAt) + ' ms (at most 1.5 s)');
    ok(!!r.at && r.at.head === final.head, label + ': when it fades, the header (avatars, suggestions) is already final');
    ok(!!r.at && r.at.list === final.list, label + ': … and so are the items');
  };
  await open('Online');
  ok(await A.getByText('Bananen', { exact: true }).count() === 1, 'the list with its items');
  const annaAv = await A.locator('[title^="Geteilt mit"] [style*="#DDF0E3"], [title^="Geteilt mit"] [style*="rgb(221, 240, 227)"]').count();
  ok(annaAv > 0, "Anna's own avatar (mint) is shown");

  await a.ctx.setOffline(true);
  await open('Offline');
  await a.ctx.setOffline(false);

  // An empty list shows the suggestions right away – they too are complete when the launch screen fades
  const items = (await (await fetch(REST + '/lists/wocheneinkauf/items', { headers: owner })).json()).documents || [];
  for (const it of items) await fetch('http://127.0.0.1:8080/v1/' + it.name, { method: 'DELETE', headers: owner });
  await A.waitForTimeout(1000);
  await open('Empty list');
  const at = await A.evaluate(() => window.__launch.at.head);
  ok(['Kiwi', 'Eier', 'Käse', 'Sahne'].every(n => at.includes(n)), 'all suggestions are there when it fades');

  // Logged out: straight to the login screen
  const c = await phone(browser), C = c.page;
  await C.addInitScript(WATCH);
  await C.goto('http://127.0.0.1:4173/');
  await C.waitForSelector('button:has-text("Anmelden")', { timeout: 10000 });
  await C.waitForFunction(() => !document.getElementById('launch'), null, { timeout: 3000 }).then(() => ok(true, 'logged out: the login screen follows right away'), () => ok(false, 'logged out: launch screen still there'));
  const rc = await C.evaluate(() => window.__launch);
  ok(rc.fadeAt !== null && rc.fadeAt < 1000, 'logged out: gone after ' + Math.round(rc.fadeAt) + ' ms');

  // What it looks like
  const d = await phone(browser), D = d.page;
  await D.route('**/src/**', r => r.abort()); await D.route('**/assets/*.js', r => r.abort());
  await D.goto('http://127.0.0.1:4173/'); await D.waitForTimeout(500);
  await D.screenshot({ path: SHOTS + 'launch-screen.png' });
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
