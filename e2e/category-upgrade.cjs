// V1.3 categories: data in the pre-V1.3 format (as in production) is shown with the new categories
const { chromium, SHOTS, BASE, phone, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const DOCS = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents';
const H = DOCS + '/households/main';
const auth = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const arr = a => ({ arrayValue: { values: a.map(s => ({ stringValue: s })) } });
const patch = (path, fields) => fetch(path + '?' + Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&'),
  { method: 'PATCH', headers: auth, body: JSON.stringify({ fields }) }).then(r => { if (!r.ok) throw new Error('patch ' + r.status); });
// Netto's path as seeded before V1.3 (straight from the tester form)
const OLD_NETTO = ['Obst & Gemüse', 'Gewürze & Saucen', 'Backwaren', 'Drogerie', 'Haushalt', 'Baby', 'Tiernahrung', 'Frühstück', 'Kaffee & Tee',
  'Süßwaren & Snacks', 'Wurst & Käse', 'Fleisch & Fisch', 'Milchprodukte', 'Backzutaten', 'Nudeln & Reis', 'Konserven', 'Sonstiges', 'Getränke', 'Tiefkühl'];

(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: A } = await phone(browser);
  await login(A, 'michael@rieplhuber.com'); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Salz', 'Senf', 'Eier', 'Quark']) { await A.fill(IN, t); await A.press(IN, 'Enter'); }
  await A.click('button:has-text("Einsortieren")').catch(() => {}); await A.locator(IN).blur();
  await A.waitForTimeout(2500);

  // Turn the database into the old format
  const lists = await (await fetch(H + '/lists', { headers: auth })).json();
  const listId = lists.documents[0].name.split('/').pop();
  const items = (await (await fetch(H + '/lists/' + listId + '/items', { headers: auth })).json()).documents;
  const byName = n => items.find(d => d.fields.name.stringValue === n).name.split('/').pop();
  for (const [n, cat] of [['Salz', 'Gewürze & Saucen'], ['Senf', 'Gewürze & Saucen'], ['Eier', 'Milchprodukte'], ['Quark', 'Milchprodukte']])
    await patch(H + '/lists/' + listId + '/items/' + byName(n), { category: { stringValue: cat } });
  await fetch(H + '/stores/netto?updateMask.fieldPaths=categoryOrder&updateMask.fieldPaths=pathVersion', { method: 'PATCH', headers: auth, body: JSON.stringify({ fields: { categoryOrder: arr(OLD_NETTO) } }) });
  await fetch(H + '/stores/trinkgut?updateMask.fieldPaths=categoryOrder&updateMask.fieldPaths=pathVersion', { method: 'PATCH', headers: auth, body: JSON.stringify({ fields: { categoryOrder: arr(['Haushalt', 'Getränke', 'Süßwaren & Snacks', 'Backwaren']) } }) });
  await patch(H + '/memory/ketchup', { name: { stringValue: 'ketchup' }, category: { stringValue: 'Gewürze & Saucen' } });
  await A.reload(); await A.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 }); await A.waitForTimeout(1200);

  // List screen: section headers
  const heads = await A.locator('.scroll').innerText();
  ok(/GEWÜRZE|Gewürze/.test(heads) && /SAUCEN|Saucen/.test(heads) && /EIER|Eier/.test(heads) && !/Gewürze & Saucen/i.test(heads), 'list shows Gewürze, Saucen and Eier sections, no "Gewürze & Saucen"');
  await A.screenshot({ path: SHOTS + '150-cats-list.png' });

  // Remembered "Gewürze & Saucen" for ketchup → Saucen
  await A.fill(IN, 'Ketchup'); await A.press(IN, 'Enter'); await A.locator(IN).blur(); await A.waitForTimeout(800);
  const k = (await (await fetch(H + '/lists/' + listId + '/items', { headers: auth })).json()).documents.find(d => d.fields.name.stringValue === 'Ketchup');
  ok(k && k.fields.category.stringValue === 'Saucen', 'remembered old category for Ketchup becomes Saucen: ' + (k && k.fields.category.stringValue));

  // Category picker has the new ones
  await A.locator('[aria-label^="Kategorie"], button[title^="Kategorie"]').first().click().catch(() => {});
  let sheet = await A.getByText(/Wo findet man/).count();
  if (!sheet) { await A.getByText('Senf', { exact: true }).locator('xpath=ancestor::*[.//span[@role="img"] or .//img][1]').locator('span[role=img], img').first().click().catch(() => {}); sheet = await A.getByText(/Wo findet man/).count(); }
  if (sheet) {
    const t = await A.locator('.sheet').innerText();
    ok(['Angebote', 'Eier', 'Gewürze', 'Saucen'].every(x => t.includes(x)) && !t.includes('Gewürze & Saucen'), 'category picker lists Angebote, Eier, Gewürze, Saucen');
    await A.screenshot({ path: SHOTS + '151-cats-picker.png' });
    await A.locator('.sheet button', { hasText: /^Angebote$/ }).click(); await A.waitForTimeout(600);
  } else ok(false, 'could not open the category picker');

  // Store mode: Netto follows the upgraded path
  await A.goto(BASE + '/laden/netto'); await A.waitForTimeout(1200);
  const st = await A.locator('.scroll').innerText();
  const pos = n => st.search(new RegExp(n, 'i'));
  console.log('   store text order:', ['Angebote', 'Gewürze', 'Saucen', 'Milchprodukte', 'Eier'].map(n => n + '@' + pos(n)).join(' '));
  ok(pos('Angebote') >= 0 && pos('Angebote') < pos('Gewürze') && pos('Gewürze') < pos('Saucen') && pos('Saucen') < pos('Milchprodukte') && pos('Milchprodukte') < pos('Eier'),
    'store mode: Angebote → Gewürze → Saucen → … Milchprodukte → Eier');
  await A.screenshot({ path: SHOTS + '152-cats-store.png' });

  // Store path editor shows the upgraded saved path
  await A.click('text=Aufbau der Filiale geändert?'); await A.waitForTimeout(500);
  const chips = await A.locator('button:has(span:text-matches("^[0-9]+$"))').allTextContents();
  console.log('   path:', chips.slice(0, 6).join(' | '), '…', chips.slice(12, 16).join(' | '));
  ok(/^1.*Angebote/.test(chips[0]) && /^2.*Obst/.test(chips[1]) && /^3.*Gewürze/.test(chips[2]) && /^4.*Saucen/.test(chips[3]), 'path editor: 1 Angebote, 2 Obst & Gemüse, 3 Gewürze, 4 Saucen');
  ok(chips.some(c => /Milchprodukte/.test(c)) && chips.findIndex(c => /Eier/.test(c)) === chips.findIndex(c => /Milchprodukte/.test(c)) + 1, 'Eier right after Milchprodukte');
  ok((await A.locator('.bottom-fade > button').last().textContent()) === 'Noch keine Änderung', 'unchanged → "Noch keine Änderung"');
  const idx = n => chips.findIndex(c => c.replace(/^\d+/, '') === n);
  ok(idx('Kühltheke') === idx('Eier') + 1, 'Kühltheke right after Eier');
  ok(idx('Wein & Spirituosen') === idx('Getränke') + 1, 'Wein & Spirituosen right after Getränke');
  // trinkgut (old path without "Gewürze & Saucen") gets the new stops too
  await A.goto(BASE + '/laden/trinkgut/weg'); await A.waitForTimeout(600);
  const tg = (await A.locator('button:has(span:text-matches("^[0-9]+$"))').allTextContents()).map(c => c.replace(/^\d+/, ''));
  ok(tg.join('|') === 'Angebote|Haushalt|Getränke|Wein & Spirituosen|Süßwaren & Snacks|Backwaren', 'trinkgut path: ' + tg.join(' → '));
  // A path saved now is kept exactly: drop Angebote by moving it to the end isn't possible, so save Netto with Angebote moved behind Obst
  await A.goto(BASE + '/laden/netto/weg'); await A.waitForTimeout(600);
  await A.locator('button', { hasText: /^1Angebote$/ }).click();
  await A.click('button[aria-label="Nach hinten"]'); await A.click('button:has-text("Fertig")');
  await A.locator('.bottom-fade > button').last().click(); await A.waitForTimeout(1200);
  const sn = await (await fetch(H + "/stores/netto", { headers: auth })).json();
  const saved = sn.fields.categoryOrder.arrayValue.values.map(v => v.stringValue);
  ok(sn.fields.pathVersion && saved[0] === 'Obst & Gemüse' && saved[1] === 'Angebote', 'saved path is stamped and stored as arranged: ' + saved.slice(0, 3).join(', '));
  await A.reload(); await A.waitForTimeout(1200); await A.goto(BASE + '/laden/netto/weg'); await A.waitForTimeout(800);
  const again = (await A.locator('button:has(span:text-matches("^[0-9]+$"))').allTextContents()).map(c => c.replace(/^\d+/, ''));
  ok(again[0] === 'Obst & Gemüse' && again[1] === 'Angebote', 'after reload the saved path is not "upgraded" again');
  await A.screenshot({ path: SHOTS + '153-cats-path.png', fullPage: true });
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
