// V1.4 stand-ins: a trip in Bernau (DM, ALDI, Denns) with items for Netto, Edeka and DM
const { chromium, SHOTS, BASE, phone, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const auth = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const get = async p => (await fetch(H + p, { headers: auth })).json();
const patch = (p, fields) => fetch(H + p + '?' + Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&'), { method: 'PATCH', headers: auth, body: JSON.stringify({ fields }) }).then(r => { if (!r.ok) return r.text().then(t => { throw new Error(p + ' ' + t); }); });
const S = s => ({ stringValue: s }), A = a => ({ arrayValue: { values: a.map(S) } }), T = { timestampValue: new Date().toISOString() };
const path = order => ({ categoryOrder: A(order), orderSetAt: T, orderCheckedAt: T, pathVersion: { integerValue: '3' } });
const items = async () => Object.fromEntries(((await get('/lists/wocheneinkauf/items')).documents || []).map(d => [d.fields.name.stringValue, d.fields]));
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: P } = await phone(browser);
  await login(P, 'michael@rieplhuber.com'); await P.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  for (const t of ['Milch', 'Brot', 'Tofu', 'Kaffee', 'Shampoo']) { await P.fill(IN, t); await P.press(IN, 'Enter'); }
  await P.click('button:has-text("Einsortieren")').catch(() => {}); await P.locator(IN).blur();
  for (const [n, st] of [['Brot', 'Edeka'], ['Tofu', 'Edeka'], ['Kaffee', 'Edeka'], ['Shampoo', 'DM']]) { await P.getByText(n, { exact: true }).click(); await P.locator('button', { hasText: new RegExp('^' + st + '$') }).click(); }
  await P.waitForTimeout(3700);
  // Towns + stores in Bernau (set up directly)
  await patch('', { towns: { arrayValue: { values: [['tprien', 'Prien'], ['tbernau', 'Bernau']].map(([id, name]) => ({ mapValue: { fields: { id: S(id), name: S(name) } } })) } } });
  await patch('/stores/dm', { branches: { mapValue: { fields: { tbernau: { mapValue: { fields: { address: S('Bahnhofstr. 1, 83233 Bernau'), ...path(['Drogerie', 'Haushalt']) } } } } } } });
  const mkStore = (id, name, logo, order) => fetch(H + '/stores?documentId=' + id, { method: 'POST', headers: auth, body: JSON.stringify({ fields: { name: S(name), branch: S(name + ' Bernau'), logo: logo ? S(logo) : { nullValue: null }, town: S('tbernau'), createdAt: T, ...path(order) } }) });
  await mkStore('aldi', 'ALDI', 'aldi', ['Obst & Gemüse', 'Milchprodukte', 'Backwaren']);
  await mkStore('denns', 'Denns', 'denns', ['Kühltheke', 'Milchprodukte']);
  const L = await get('/lists/wocheneinkauf');
  await patch('/lists/wocheneinkauf', { storeIds: A([...L.fields.storeIds.arrayValue.values.map(v => v.stringValue), 'aldi', 'denns']) });
  await P.waitForTimeout(800);

  // --- Switch to Bernau → the question ---
  await P.click('.tab:has-text("Plan")'); await P.waitForTimeout(500);
  await P.locator('button[aria-label^="Ort wählen"]').click(); await P.locator('.sheet button', { hasText: /^Bernau/ }).click(); await P.waitForTimeout(500);
  ok(await P.getByText('Netto und Edeka gibt’s in Bernau nicht').count() === 1, 'asked: "Netto und Edeka gibt’s in Bernau nicht"');
  const sheet = await P.locator('.sheet').innerText();
  console.log('   preview:', sheet.replace(/\n+/g, ' | ').slice(0, 260));
  await P.screenshot({ path: SHOTS + '210-standin-ask.png' });
  await P.click('button:has-text("Ja, heute dort einkaufen")'); await P.waitForTimeout(500);
  const names = async () => (await P.locator('.card > div:first-child .ellipsis[style*="font-weight: 600"]').allTextContents());
  let r = await names();
  ok(r.join(',') === 'DM,ALDI,Denns', 'default order (DM is in the usual order, ALDI/Denns after): ' + r.join(', '));
  const chipsOf = async store => (await P.locator('.card', { has: P.locator('.ellipsis', { hasText: new RegExp('^' + store + '$') }) }).locator('span[style*="border-radius: 999"]').allTextContents());
  ok((await chipsOf('ALDI')).join(',').includes('Milch') && (await chipsOf('ALDI')).join(',').includes('Brot'), 'ALDI gets Milch (Netto) and Brot (Edeka)');
  ok((await chipsOf('Denns')).some(t => t === 'Tofu'), 'Denns gets Tofu (Kühltheke – ALDI has none)');
  ok((await chipsOf('DM')).some(t => t === 'Kaffee') && (await chipsOf('DM')).some(t => t === 'Shampoo'), 'Kaffee (nobody has it) goes to the first store, DM; Shampoo to DM Bernau');
  ok(await P.getByText(/Heute statt Netto, Edeka/).count() === 1, 'note: "Heute statt Netto, Edeka – ihr gewohnter Laden bleibt."');
  await P.screenshot({ path: SHOTS + '211-standin-plan.png', fullPage: true });

  // --- Put ALDI first (remembered for Bernau) ---
  await P.click('button:has-text("Ändern")');
  await P.locator('.card', { has: P.locator('.ellipsis', { hasText: /^ALDI$/ }) }).locator('button[aria-label="Nach oben"], button:has(.chev-up)').first().click();
  await P.click('button:has-text("Fertig")'); await P.waitForTimeout(700);
  r = await names();
  ok(r[0] === 'ALDI', 'ALDI first now: ' + r.join(', '));
  const L2 = await get('/lists/wocheneinkauf');
  const to = L2.fields.townOrder.mapValue.fields.tbernau.arrayValue.values.map(v => v.stringValue);
  ok(to[0] === 'aldi' && !L2.fields.tripOrder?.arrayValue, 'order saved for Bernau: ' + to.join(', '));
  ok((await chipsOf('ALDI')).some(t => t === 'Kaffee'), 'Kaffee follows the order: now ALDI');
  ok(await P.getByText('Reihenfolge · für Bernau').count() + await P.getByText(/für Bernau/).count() >= 1, 'label: Reihenfolge für Bernau');

  // --- At ALDI ---
  await P.locator('.cta').click(); await P.waitForTimeout(800);
  ok(await P.locator('h1', { hasText: 'ALDI' }).count() === 1, 'trip starts at ALDI');
  const st = await P.locator('.scroll').innerText();
  const cut = st.indexOf('Gibt\'s hier vermutlich nicht');
  ok(/statt Netto/.test(st) && /statt Edeka/.test(st), 'items say "statt Netto" / "statt Edeka"');
  ok(cut > 0 && st.indexOf('Kaffee') > cut && st.indexOf('Milch') < cut && st.indexOf('Brot') < cut, 'Kaffee under "Gibt’s hier vermutlich nicht", Milch + Brot above');
  await P.screenshot({ path: SHOTS + '212-standin-aldi.png', fullPage: true });
  await P.locator('[role=checkbox]', { has: P.getByText('Milch', { exact: true }) }).click(); await P.waitForTimeout(300);
  await P.locator('.bottom-fade button').first().click(); await P.waitForTimeout(400); // Weiter zu … (2 hier offen)
  const take = P.locator('.sheet button', { hasText: /^Alle zu / });
  const takeTxt = await take.textContent();
  await take.click(); await P.waitForTimeout(800);
  let its = await items();
  ok(its.Brot.storeId.stringValue === 'edeka' && its.Kaffee.storeId.stringValue === 'edeka', '"' + takeTxt + '" moves them only for this trip (still Edeka)');
  const here = await P.locator('[role=checkbox]').allTextContents();
  ok(here.some(t => t.startsWith('Brot')) && here.some(t => t.startsWith('Kaffee')), 'they are at the next stop now: ' + here.map(t => t.split('statt')[0]).join(', '));
  // check everything here, then the rest
  for (const n of here.map(t => t.replace(/\d.*$|statt.*$/, '').trim())) await P.locator('[role=checkbox]', { has: P.getByText(n, { exact: true }) }).click();
  await P.waitForTimeout(400);
  for (let k = 0; k < 3; k++) {
    const btn = P.locator('.bottom-fade button').first(); const t = await btn.textContent();
    if (/^Einkauf abschließen$/.test(t)) { await btn.click(); break; }
    if (/^Weiter zu/.test(t)) { await btn.click(); await P.waitForTimeout(600); for (const c of await P.locator('[role=checkbox][aria-checked="false"]').all()) await c.click(); await P.waitForTimeout(400); continue; }
    break;
  }
  await P.waitForTimeout(1200);
  its = await items();
  ok(Object.keys(its).length === 0, 'everything bought, list empty: ' + Object.keys(its).join(', '));
  await P.click('.tab:has-text("Plan")'); await P.waitForTimeout(400);
  ok(await P.locator('button[aria-label^="Ort wählen"]').textContent() === 'in Prien', 'next trip back in Prien');

  // --- "Nein" keeps them waiting; they can be replaced later from the plan ---
  for (const t of ['Butter']) { await P.click('.tab:has-text("Liste")'); await P.fill(IN, t); await P.press(IN, 'Enter'); await P.locator(IN).blur(); }
  await P.waitForTimeout(600); await P.click('.tab:has-text("Plan")'); await P.waitForTimeout(300);
  await P.locator('button[aria-label^="Ort wählen"]').click(); await P.locator('.sheet button', { hasText: /^Bernau/ }).click(); await P.waitForTimeout(400);
  await P.click('button:has-text("Nein, auf der Liste lassen")'); await P.waitForTimeout(400);
  ok(/Gibt’s in Bernau nicht/.test(await P.locator('.scroll').innerText()), '"Nein": Butter waits under "Gibt’s in Bernau nicht"');
  await P.click('button:has-text("Heute in Bernau ersetzen …")'); await P.waitForTimeout(300);
  await P.click('button:has-text("Ja, heute dort einkaufen")'); await P.waitForTimeout(400);
  ok((await chipsOf('ALDI')).some(t => t === 'Butter'), 'replaced later from the plan: Butter at ALDI');
  await P.click('button:has-text("Aufheben")'); await P.waitForTimeout(400);
  ok(/Gibt’s in Bernau nicht/.test(await P.locator('.scroll').innerText()), '"Aufheben" undoes it');
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
