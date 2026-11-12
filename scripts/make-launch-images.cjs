// Makes the iPhone launch images (public/launch/) from the launch screen in index.html, so the phone's own launch
// screen and the app's look exactly the same. Run after changing the launch screen or the app icon:
//   node scripts/make-launch-images.cjs
// It also prints the <link> tags for index.html.
const fs = require('fs');
const path = require('path');
const { chromium } = require('../e2e/lib.cjs');

// Portrait iPhone screens: CSS width × height @ pixel ratio
const SCREENS = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3], [390, 844, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3], [420, 912, 3],
];
const root = path.join(__dirname, '..');

(async () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]*>/g, '')
    .replace(/src="\/(brand\/[^"]+\.png)"/g, (_, f) => 'src="data:image/png;base64,' + fs.readFileSync(path.join(root, 'public', f)).toString('base64') + '"');
  fs.mkdirSync(path.join(root, 'public/launch'), { recursive: true });
  const browser = await chromium.launch();
  const tags = [];
  for (const [w, h, d] of SCREENS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: d });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.querySelector('#launch img').decode());
    const name = `launch-${w}x${h}@${d}.png`;
    await page.screenshot({ path: path.join(root, 'public/launch', name) });
    await page.close();
    tags.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)" href="/launch/${name}" />`);
  }
  await browser.close();
  console.log(tags.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
