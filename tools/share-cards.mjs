// Photographs every page's branded share card (1200×630) into public/share/,
// from the list tools/build-site.ts writes. Each card is tools/share-card.html
// with the game's own ship model on it. Run with: npm run cards
//
// Needs Playwright and a Chrome: npx playwright install chromium. Set
// PLAYWRIGHT to its module path if it isn't installed in this project.

import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const cards = JSON.parse(readFileSync(join(root, 'tools/share-cards.json'), 'utf8'));
const only = process.argv.slice(2); // optional: just these files
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
page.on('pageerror', (e) => console.error('Card error:', e.message));
mkdirSync(join(root, 'public/share'), { recursive: true });

for (const c of cards) {
  if (only.length && !only.includes(c.file)) continue;
  const q = new URLSearchParams({ ship: c.ship, kicker: c.kicker, title: c.title, sub: c.sub, ...(c.paint ? { paint: JSON.stringify(c.paint) } : {}) });
  await page.goto(`${base}tools/share-card.html?${q}`);
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(root, 'public/share', c.file), type: 'jpeg', quality: 86 });
  console.log('Card:', c.file);
}
await browser.close();
await server.close();
