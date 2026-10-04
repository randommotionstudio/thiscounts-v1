const { chromium, SHOTS, phone, login, resetDb, waitText } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const add = async (P, t) => { await P.fill(IN, t); await P.press(IN, 'Enter'); await P.waitForTimeout(80); await P.locator(IN).blur(); };
const check = async (P, name) => P.locator('[role=checkbox]', { has: P.getByText(name, { exact: true }) }).click();
// Every avatar circle for a person: background color + whether it shows the pizza icon (mask)
const avatarsOf = P => P.evaluate(() => [...document.querySelectorAll('span')].filter(s => s.style.borderRadius === '50%' && s.style.fontFamily.includes('--display'))
  .map(s => ({ bg: getComputedStyle(s).backgroundColor, icon: !!s.querySelector('span[style*="mask"]') && (s.querySelector('span[style*="mask"]').style.webkitMaskImage || s.querySelector('span[style*="mask"]').style.maskImage || '').includes('pizza'), text: s.textContent, size: s.style.width })));
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const a = await phone(browser), b = await phone(browser);
  const A = a.page, B = b.page;
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await login(B, 'annacvetkov@posteo.de'); await B.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  // Default: initial on orange everywhere
  const def = (await avatarsOf(A))[0];
  ok(def && def.bg === 'rgb(243, 117, 46)' && def.text === 'A', 'default avatar: initial on orange (' + JSON.stringify(def) + ')');

  // B (Anna) picks the pizza icon, then Espresso
  await B.click('.tab:has-text("Profil")');
  await B.click('button[aria-label="Profilbild ändern"]');
  await B.waitForTimeout(300);
  await B.screenshot({ path: SHOTS + '100-B-avatar-sheet.png' });
  await B.click('button[aria-label="Pizza"]');
  await B.click('button[aria-label="Espresso"]');
  await B.waitForTimeout(300);
  ok(await B.locator('button[aria-label="Pizza"][aria-pressed="true"]').count() === 1 && await B.locator('button[aria-label="Espresso"][aria-pressed="true"]').count() === 1, 'grid + color selection reflect the choice');
  await B.screenshot({ path: SHOTS + '101-B-avatar-picked.png' });
  await B.click('button:has-text("Fertig")');
  // Back to initials keeps the color, then pizza again
  await B.click('button[aria-label="Profilbild ändern"]');
  await B.click('button[aria-label="Initialen"]'); await B.waitForTimeout(200);
  const init = (await avatarsOf(B)).find(x => x.size === '96px');
  ok(init && init.bg === 'rgb(42, 31, 23)' && init.text === 'A', 'switching to Initialen keeps Espresso');
  await B.click('button[aria-label="Pizza"]'); await B.click('button:has-text("Fertig")');

  // A sees Anna's avatar: header + Profil row
  await A.waitForTimeout(1500);
  const hdr = (await avatarsOf(A))[0];
  ok(hdr && hdr.bg === 'rgb(42, 31, 23)' && hdr.icon, 'A list header shows Anna as pizza on espresso');
  // markers: B adds items → A sees markers with B's avatar
  await B.click('.tab:has-text("Liste")');
  await add(B, 'Brot'); await add(B, 'Milch');
  await waitText(A, 'Milch'); await A.waitForTimeout(300);
  const markers = (await avatarsOf(A)).filter(x => x.size === '20px');
  ok(markers.length === 2 && markers.every(m => m.icon && m.bg === 'rgb(42, 31, 23)'), 'Neu-Markierung dots use Anna\'s avatar (' + markers.length + ')');
  // B shops → A's live card; A adds a passed item → B's banner shows Michi (default orange M); Rückfrage shows Anna
  await B.click('.tab:has-text("Plan")'); await B.click('button:has-text("Einkauf starten bei Netto")');
  await check(B, 'Brot'); await check(B, 'Milch');
  await A.getByText('Anna kauft gerade ein').waitFor({ timeout: 5000 });
  const live = (await avatarsOf(A)).filter(x => x.size === '32px');
  ok(live.length === 1 && live[0].icon, 'live card shows Anna\'s avatar');
  await A.screenshot({ path: SHOTS + '102-A-livecard-avatar.png' });
  // A picks an avatar too (Karotte on Mint) → B's banner uses it
  await A.click('.tab:has-text("Profil")'); await A.click('button[aria-label="Profilbild ändern"]');
  await A.click('button[aria-label="Karotte"]'); await A.click('button[aria-label="Mint"]'); await A.click('button:has-text("Fertig")');
  await A.screenshot({ path: SHOTS + '103-A-profil.png' });
  const row = (await avatarsOf(A)).filter(x => x.size === '28px');
  ok(row.length >= 1 && row[0].icon, 'Profil "Teilt alle Listen mit Anna" row shows Anna\'s avatar');
  await A.click('.tab:has-text("Liste")');
  await add(A, 'Sahne');
  await B.getByText('Michi hat Sahne hinzugefügt').waitFor({ timeout: 8000 });
  const ban = (await avatarsOf(B)).filter(x => x.size === '36px');
  ok(ban.length === 1 && ban[0].bg === 'rgb(221, 240, 227)' && !ban[0].icon, 'store banner shows Michi\'s carrot on mint');
  const carrot = await B.evaluate(() => [...document.querySelectorAll('span[style*="mask"]')].some(s => (s.style.webkitMaskImage || s.style.maskImage || '').includes('carrot')));
  ok(carrot, 'banner uses the carrot icon');
  await B.screenshot({ path: SHOTS + '104-B-banner-avatar.png' });
  // persists after reload
  await B.reload(); await B.waitForTimeout(1500);
  await B.goto('http://127.0.0.1:4173/profil'); await B.waitForTimeout(800);
  const me = (await avatarsOf(B)).find(x => x.size === '54px');
  ok(me && me.icon && me.bg === 'rgb(42, 31, 23)', 'choice persists after reload');
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
