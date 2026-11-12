// Captures every sample screen at 1440 px and 390 px for comparison with design/screenshots.
// Usage: node tools/screenshots.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5180';
const out = process.argv[3] ?? 'test-results/screens';
mkdirSync(out, { recursive: true });

const screens = [
  ['01-landing', '/'],
  ['02-connect-github', '/connect'],
  ['03-choose-repositories', '/sample/setup/repositories'],
  ['04-today', '/sample/today'],
  ['05-all-work', '/sample/work'],
  ['06-repositories', '/sample/repositories'],
  ['07-repository', '/sample/repositories/lattice-db/lattice'],
  ['08-reviews', '/sample/reviews'],
  ['09-milestones', '/sample/milestones'],
  ['10-settings', '/sample/settings'],
];

const browser = await chromium.launch();
const overflow = [];
for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const [name, path] of screens) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (scroll > 0) overflow.push(`${name} @${width}: ${scroll}px`);
  }
  await page.close();
}
await browser.close();
console.log(overflow.length ? `Horizontal page scroll: ${overflow.join(', ')}` : 'No horizontal page scroll at any width.');
