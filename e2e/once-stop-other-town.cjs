// One-time stop at a store in Frasdorf while the plan is in Prien
const { chromium, SHOTS, phone, login, resetDb } = require('./lib.cjs');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const IN = 'input[placeholder^="z. B. 5 Bananen"]';
const H = 'http://127.0.0.1:8080/v1/projects/demo-thiscounts/databases/(default)/documents/households/main';
const auth = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const S = s => ({ stringValue: s }), T = { timestampValue: new Date().toISOString() };
(async () => {
  await resetDb();
  const browser = await chromium.launch();
  const { page: P } = await phone(browser);
  await login(P, 'michael@rieplhuber.com'); await P.waitForSelector('h1:has-text("Wocheneinkauf")', { timeout: 20000 });
  await P.waitForTimeout(2500); // let the first-login setup of the household finish
  await fetch(H + '?updateMask.fieldPaths=towns', { method: 'PATCH', headers: auth, body: JSON.stringify({ fields: { towns: { arrayValue: { values: [['tprien', 'Prien'], ['tfras', 'Frasdorf']].map(([id, name]) => ({ mapValue: { fields: { id: S(id), name: S(name) } } })) } } } }) });
  await fetch(H + '/stores?documentId=schuhbeck', { method: 'POST', headers: auth, body: JSON.stringify({ fields: { name: S('Bäcker Schuhbeck'), branch: S('Frasdorf'), logo: S('schuhbeck'), town: S('tfras'), createdAt: T } }) });
  for (const t of ['Brezen', 'Milch']) { await P.fill(IN, t); await P.press(IN, 'Enter'); }
  await P.click('button:has-text("Einsortieren")').catch(() => {}); await P.locator(IN).blur(); await P.waitForTimeout(800);
  await P.getByText('Brezen', { exact: true }).click(); await P.waitForTimeout(400); await P.screenshot({ path: SHOTS + '219-dbg.png' }); await P.click('button:has-text("+ Einmaliger Stopp")', { timeout: 5000 }); await P.waitForTimeout(300); await P.screenshot({ path: SHOTS + '219-dbg2.png' });
  await P.locator('.sheet').getByText('Bäcker Schuhbeck', { exact: true }).click(); await P.waitForTimeout(3600);

  await P.click('.tab:has-text("Plan")'); await P.waitForTimeout(500); await P.screenshot({ path: SHOTS + '219-dbg3.png' });
  const hh = await (await fetch(H, { headers: auth })).json(); console.log('   towns field:', JSON.stringify(hh.fields.towns || null).slice(0, 120));
  const txt = await P.locator('.scroll').innerText();
  ok(/in Prien/.test(await P.locator('button[aria-label^="Ort wählen"]').textContent()), 'Plan is in Prien');
  ok(!/Einmaliger Stopp/.test(txt.split('Gibt’s in Prien nicht')[0]) && /Gibt’s in Prien nicht/.test(txt) && /Bäcker Schuhbeck/.test(txt) && /gibt’s in Frasdorf/.test(txt) && /Brezen/.test(txt), 'Prien: no Schuhbeck stop; Brezen waits under "Gibt’s in Prien nicht" (gibt’s in Frasdorf)');
  ok(await P.getByText('Heute in Prien ersetzen …').count() === 0, 'no "ersetzen" offer – the one-time stop is never replaced');
  await P.screenshot({ path: SHOTS + '220-once-prien.png', fullPage: true });

  await P.locator('button[aria-label^="Ort wählen"]').click(); await P.locator('.sheet button', { hasText: /^Frasdorf/ }).click(); await P.waitForTimeout(500);
  const ask = await P.locator('.sheet').innerText().catch(() => '');
  ok(/Netto gibt’s in Frasdorf nicht/.test(ask) && /der Artikel/.test(ask) && !/Brezen/.test(ask.split('Ja, heute')[0].replace('Milch', '')), 'Frasdorf: asked only about Milch (Netto), 1 item');
  await P.click('button:has-text("Nein, auf der Liste lassen")'); await P.waitForTimeout(400);
  const names = await P.locator('.card > div:first-child .ellipsis[style*="font-weight: 600"]').allTextContents();
  ok(names[0] === 'Bäcker Schuhbeck', 'Frasdorf: Bäcker Schuhbeck is a stop: ' + names.join(', '));
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
