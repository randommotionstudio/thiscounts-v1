const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
async function serverDoc(name) {
  const r = await fetch('http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main/lists/wocheneinkauf/items', { headers: { Authorization: 'Bearer owner' } });
  const j = await r.json(); const d = (j.documents || []).find(x => x.fields.name.stringValue === name);
  return d ? JSON.stringify({ qty: d.fields.qty.stringValue, storeId: d.fields.storeId.stringValue || null, once: d.fields.once.booleanValue, upd: d.updateTime.slice(11, 23) }) : 'none';
}
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
async function add(p, list) { for (const t of list) { await p.fill(IN, t); await p.press(IN, 'Enter'); } await p.locator(IN).blur(); }
async function gone(page, text, timeout = 10000) { const t0 = Date.now(); await page.getByText(text, { exact: true }).first().waitFor({ state: 'detached', timeout }); return Date.now() - t0; }
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await add(A, ['5 Bananen', 'Milch 2 l', 'Brot', 'Käse', 'Butter', '10 Eier']);
  await waitText(B, 'Eier');
  await A.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await A.waitForTimeout(1500);

  // ---- 1. Phone A in airplane mode: check off 5, add 2, move 1, finish ----
  await a.ctx.setOffline(true);
  const t0 = Date.now();
  await A.getByText('Offline · Änderungen werden gespeichert').waitFor({ timeout: 3000 });
  ok(Date.now() - t0 < 1000, 'offline pill within 1 s (' + (Date.now() - t0) + ' ms)');
  await add(A, ['Zahnpasta', 'Saft']);
  await A.click('.tab:has-text("Plan")');
  await A.click('button:has-text("Einkauf starten bei Netto")');
  for (const n of ['Bananen', 'Milch', 'Käse', 'Butter', 'Eier']) await A.locator('[role=checkbox]', { has: A.getByText(n, { exact: true }) }).click();
  await A.screenshot({ path: SHOTS + '20-A-offline-store.png' });
  await A.locator('div:has(> div > div > div:text-is("Brot"))').locator('button:has-text("Nicht gefunden")').click();
  await A.waitForSelector('h1:has-text("Brot woanders holen")');
  await A.locator('button', { hasText: /verschieben$/ }).first().click();
  await A.waitForTimeout(300);
  await A.click('button:has-text("Einkauf abschließen")').catch(() => {});
  if (!(await A.getByText('Einkauf abgeschlossen').count())) { // next stop button reads "Weiter zu …" → finish from plan
    await A.click('button[title="Mehr"]'); await A.click('button:has-text("Zum Plan")');
  }
  await A.waitForTimeout(300);
  await A.screenshot({ path: SHOTS + '21-A-offline-after.png' });
  ok(await B.getByText('Bananen', { exact: true }).count() > 0, 'B does not see offline changes yet');
  await a.ctx.setOffline(false);
  const t1 = Date.now();
  await waitText(B, 'Zahnpasta', 15000);
  await waitText(B, 'Saft', 15000);
  console.log('   B sees new items after', Date.now() - t1, 'ms');
  await B.screenshot({ path: SHOTS + '22-B-after-sync.png', fullPage: true });
  await B.waitForTimeout(1500);
  const brotChip = await B.locator('div:has(> div > div > span:text-is("Brot"))').first().textContent();
  ok(/Edeka|DM/.test(brotChip), 'B sees Brot moved (' + brotChip.replace(/\s+/g, ' ').slice(0, 60) + ')');

  // ---- 2. both offline, different fields of the same item ----
  await A.waitForTimeout(3000);
  await A.goto('http://127.0.0.1:4173/'); await A.waitForSelector('h1:has-text("Wocheneinkauf")');
  await B.click('.tab:has-text("Liste")').catch(() => {});
  await a.ctx.setOffline(true); await b.ctx.setOffline(true);
  // A: qty of Saft → 2 Stück ; B: Saft → DM
  await A.locator('div:has(> div > div > span:text-is("Saft"))').locator('button[title="Menge ändern"]').click();
  await A.click('button[aria-label="Mehr"]'); await A.click('button:has-text("speichern")');
  console.log('   B url before', B.url(), 'srv', await serverDoc('Saft'), 'Brot', await serverDoc('Brot'));
  await B.getByText('Saft', { exact: true }).click();
  await B.waitForTimeout(200);
  await B.screenshot({ path: SHOTS + '24-B-saft-expanded.png' });
  console.log('   DM buttons on B:', await B.locator('button', { hasText: /^DM$/ }).count());
  await B.locator('button', { hasText: /^DM$/ }).click();
  await A.waitForTimeout(300);
  console.log('   B row offline:', (await B.locator('div:has(> div > div > span:text-is("Saft"))').first().textContent()).replace(/\s+/g,' '));
  console.log('   A row offline:', (await A.locator('div:has(> div > div > span:text-is("Saft"))').first().textContent()).replace(/\s+/g,' '));
  await a.ctx.setOffline(false); await b.ctx.setOffline(false);
  for (let k = 0; k < 6; k++) { await A.waitForTimeout(150); console.log('   srv', await serverDoc('Saft')); }
  for (let k = 0; k < 3; k++) { await A.waitForTimeout(1000); console.log('   t+' + (k+1) + 's A:', (await A.locator('div:has(> div > div > span:text-is("Saft"))').first().textContent()).replace(/\s+/g,' ').slice(0,50), '| B:', (await B.locator('div:has(> div > div > span:text-is("Saft"))').first().textContent()).replace(/\s+/g,' ').slice(0,50)); }
  for (const [P, who] of [[A, 'A'], [B, 'B']]) {
    const row = (await P.locator('div:has(> div > div > span:text-is("Saft"))').first().textContent()).replace(/\s+/g, ' ');
    ok(/2 Stück/.test(row) && /DM/.test(row), who + ' has both edits on Saft: ' + row.slice(0, 60));
  }

  // ---- 3. kill the app offline with pending writes, reopen offline, then sync ----
  await a.ctx.setOffline(true);
  await add(A, ['Kaffee']);
  await A.waitForTimeout(300);
  await A.close();
  const A2 = await a.ctx.newPage();
  A2.on('pageerror', e => console.log('[pageerror A2]', e.message));
  await A2.goto('http://127.0.0.1:4173/');
  await A2.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 15000 });
  ok(await A2.getByText('Kaffee', { exact: true }).count() > 0, 'reopened offline: pending item still there');
  ok(await B.getByText('Kaffee', { exact: true }).count() === 0, 'B does not have Kaffee yet');
  await a.ctx.setOffline(false);
  const t3 = Date.now();
  await waitText(B, 'Kaffee', 15000);
  ok(true, 'after reconnect B sees Kaffee (' + (Date.now() - t3) + ' ms)');

  // ---- 4. cold start in airplane mode ----
  await A2.close();
  await a.ctx.setOffline(true);
  const A3 = await a.ctx.newPage();
  A3.on('pageerror', e => console.log('[pageerror A3]', e.message));
  await A3.goto('http://127.0.0.1:4173/plan');
  await A3.waitForSelector('h1:has-text("Deine Route")', { timeout: 15000 });
  await A3.waitForTimeout(800);
  await A3.screenshot({ path: SHOTS + '23-A-coldstart-offline.png' });
  ok(await A3.getByText('Kaffee').count() > 0, 'cold start offline opens with data');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
