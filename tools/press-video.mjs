// Cuts the trailer and its short versions from the clips and stills that
// tools/press-shots.mjs makes (record those first: `node tools/press-shots.mjs clips`).
// The cutting happens in tools/trailer.html, in the browser, which encodes the MP4.
//
//   npm run dev   (in another terminal)
//   PLAYWRIGHT=/path/to/playwright/index.mjs node tools/press-video.mjs [trailer social vertical] [--url http://localhost:5183]
//
// Writes press-shots/video/<cut>.mp4.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const i = args.indexOf('--url');
const URL = i >= 0 ? args.splice(i, 2)[1] : 'http://localhost:5183';
const cuts = args.length ? args : ['trailer', 'social', 'vertical'];
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
for (const cut of cuts) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('  console:', m.text()));
  await page.goto(`${URL}/tools/trailer.html?cut=${cut}`);
  await page.waitForFunction(() => window.__ready);
  const started = Date.now();
  const timer = setInterval(async () => {
    const p = await page.evaluate(() => window.__progress ?? 0).catch(() => 0);
    process.stdout.write(`\r  ${cut}: ${Math.round(p * 100)}%   `);
  }, 5000);
  const { size, seconds, audio } = await page.evaluate(() => window.__render());
  clearInterval(timer);
  const parts = [];
  for (let k = 0; k < size; k += 4 << 20) parts.push(Buffer.from(await page.evaluate(([k, n]) => window.__chunk(k, n), [k, 4 << 20]), 'base64'));
  writeFileSync(join('press-shots/video', `${cut}.mp4`), Buffer.concat(parts));
  console.log(`\r  ${cut}.mp4 · ${seconds.toFixed(1)} s · ${(size / 1048576).toFixed(1)} MB · ${audio} · ${Math.round((Date.now() - started) / 1000)} s to cut`);
  await page.close();
}
await browser.close();
