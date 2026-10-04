// Shared helpers for the browser tests (see e2e/README.md).
const fs = require('fs');

// Playwright: a local install, PLAYWRIGHT_MODULE, or the global one in Claude's cloud environment
function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '@playwright/test', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
    try { return require(p); } catch { /* try the next one */ }
  }
  throw new Error('Playwright not found – run "npm i -D playwright" or set PLAYWRIGHT_MODULE');
}
const { chromium } = loadPlaywright();

const BASE = 'http://127.0.0.1:4173';
const SHOTS = __dirname + '/shots/';
fs.mkdirSync(SHOTS, { recursive: true });

/** A phone-sized browser page that prints the app's errors and warnings */
async function phone(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_INTERNET_DISCONNECTED|transport errored/.test(m.text())) console.log('[' + m.type() + ']', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  return { ctx, page };
}

async function login(page, email) {
  await page.goto(BASE + '/');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', 'test1234');
  await page.click('button:has-text("Anmelden")');
}

/** Empty the emulator's database – each test starts from a fresh household */
const resetDb = async () => { await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-thiscounts/databases/(default)/documents', { method: 'DELETE' }); };

const waitText = async (page, text, timeout = 10000) => { const t0 = Date.now(); await page.getByText(text, { exact: false }).first().waitFor({ timeout }); return Date.now() - t0; };

module.exports = { chromium, BASE, SHOTS, phone, login, resetDb, waitText };
