// Store path editor from Profil → Laden bearbeiten
const { chromium, SHOTS, BASE, phone, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const auth = { Authorization: 'Bearer owner' };
const netto = async () => (await (await fetch(H + '/stores/netto', { headers: auth })).json()).fields;
const openNetto = async P => { await P.goto(BASE + '/profil'); await P.waitForTimeout(500); await P.locator('div', { hasText: /^Netto(Hochries|Prien)/ }).last().click(); await P.waitForTimeout(300); };
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: P } = await phone(browser);
  await login(P, 'michael@rieplhuber.com'); await P.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await P.waitForTimeout(1500);

  // --- one town ---
  await openNetto(P);
  const row = P.locator('.sheet button', { hasText: 'Abteilungs-Reihenfolge' });
  ok(await row.count() === 1 && /Eingerichtet · gespeichert heute/.test(await row.textContent()), 'sheet shows "Weg durch die Filiale": ' + (await row.textContent()).replace('›', ''));
  await P.locator('.sheet').getByText('Weg durch die Filiale').scrollIntoViewIfNeeded(); await P.screenshot({ path: SHOTS + '230-sheet-path.png' });
  await row.click(); await P.waitForTimeout(600);
  ok(/\/laden\/netto\/weg$/.test(P.url()) && await P.getByText('Was hat sich bei Netto geändert?').count() === 1, 'opens the path editor for Netto');
  ok(await P.getByText('‹ Zurück', { exact: true }).count() === 1, 'back link says "‹ Zurück" (not "in den Laden")');
  const before = (await netto()).categoryOrder.arrayValue.values.map(v => v.stringValue);
  await P.locator('button', { hasText: /^1Angebote$/ }).click(); await P.click('button[aria-label="Nach hinten"]'); await P.click('button:has-text("Fertig")');
  await P.locator('.bottom-fade > button').last().click(); await P.waitForTimeout(900);
  ok(/\/profil$/.test(P.url()), 'after saving: back in the profile');
  const after = (await netto()).categoryOrder.arrayValue.values.map(v => v.stringValue);
  ok(before[0] === 'Angebote' && after[0] === before[1] && after[1] === 'Angebote', 'path saved: ' + after.slice(0, 3).join(', '));

  // --- a second town, added in the sheet and opened right away (unsaved → saved first) ---
  await openNetto(P);
  await P.click('text=+ Filiale in einem anderen Ort');
  await P.fill('input[aria-label="Name des neuen Orts"]', 'Frasdorf'); await P.fill('input[aria-label="Name des bisherigen Orts"]', 'Prien');
  await P.click('button:has-text("Filiale hinzufügen")');
  const rows = await P.locator('.sheet button', { has: P.locator('div', { hasText: /eingerichtet|Eingerichtet/ }) }).allTextContents();
  ok(rows.some(t => t.startsWith('Prien') && /Eingerichtet/.test(t)) && rows.some(t => t.startsWith('Frasdorf') && /Noch nicht eingerichtet/.test(t)), 'one row per branch: ' + rows.map(t => t.replace('›', '')).join(' | '));
  await P.locator('.sheet button', { hasText: /^FrasdorfNoch nicht/ }).click(); await P.waitForTimeout(1200);
  ok(/\/laden\/netto\/weg\/t/.test(P.url()) && await P.getByText('Wie läufst du durch Netto Frasdorf?').count() === 1, 'unsaved branch got saved, editor opens for Netto Frasdorf (set-up mode)');
  for (const d of ['Milchprodukte', 'Getränke']) await P.locator('button', { hasText: d }).last().click();
  await P.click('text=Ich bestätige, dass es diese Abteilungen in dieser Filiale nicht gibt.');
  await P.locator('.bottom-fade > button').last().click(); await P.waitForTimeout(900);
  const n = await netto();
  const tid = Object.keys(n.branches.mapValue.fields)[0];
  ok(n.branches.mapValue.fields[tid].mapValue.fields.categoryOrder.arrayValue.values.map(v => v.stringValue).join(',') === 'Milchprodukte,Getränke', 'Frasdorf path saved on the branch');
  ok(n.categoryOrder.arrayValue.values[1].stringValue === 'Angebote', 'Prien path untouched');
  await openNetto(P);
  const rows2 = await P.locator('.sheet button', { hasText: /^Frasdorf/ }).textContent();
  ok(/Eingerichtet · gespeichert heute/.test(rows2), 'Frasdorf row now: ' + rows2.replace('›', ''));
  await P.locator('.sheet').getByText('Weg durch die Filiale').scrollIntoViewIfNeeded(); await P.screenshot({ path: SHOTS + '231-sheet-paths-towns.png' });
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
