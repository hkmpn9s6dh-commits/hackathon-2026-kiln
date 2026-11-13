/**
 * Screenshots for the proof folder and the submission copy.
 *
 *   node scripts/shot.mjs
 *
 * Six frames on desktop, two on a phone. No assertions here except that the
 * phone does not scroll sideways — measure-ui.mjs owns the rest.
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = 4323;
const CHROME =
  process.env.KILN_CHROME ??
  'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';

const server = spawn(process.execPath, [join(root, 'scripts', 'dev-server.mjs'), '--port', String(PORT), '--seed'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, KILN_NOW: '2026-11-14T09:00:00Z' },
});
const log = [];
server.stdout.on('data', (d) => log.push(String(d)));
server.stderr.on('data', (d) => log.push(String(d)));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 120 && !log.join('').includes('kiln dev server'); i += 1) await wait(100);

await mkdir(join(root, 'shots'), { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function desktop() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/splash.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.card h1');
  await wait(400);
  await page.screenshot({ path: join(root, 'shots', '01-card.png') });

  await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wares .ware');
  await wait(600);
  await page.screenshot({ path: join(root, 'shots', '02-select.png') });

  await page.locator('.wares .ware').nth(1).click();
  const box = await page.locator('canvas').boundingBox();
  const scale = Math.min(box.width / 1000, box.height / 560);
  const dx = (box.width - 1000 * scale) / 2;
  const dy = (box.height - 560 * scale) / 2;
  await page.mouse.click(box.x + dx + 509 * scale, box.y + dy + 304 * scale);
  await wait(300);
  await page.screenshot({ path: join(root, 'shots', '03-placed.png') });

  await page.getByRole('button', { name: /Stoke the fire/ }).click();
  await page.waitForSelector('.stoke-track');
  await page.keyboard.press('Space');
  await wait(300);
  await page.keyboard.press('Space');
  await wait(300);
  await page.keyboard.press('Space');
  await wait(300);
  await page.screenshot({ path: join(root, 'shots', '04-stoke.png') });

  await page.getByRole('button', { name: /Open the kiln/ }).click();
  await page.waitForSelector('.stamp .grade', { timeout: 15000 });
  await wait(700);
  await page.screenshot({ path: join(root, 'shots', '05-result.png') });

  await page.getByRole('button', { name: /See the yard/ }).click();
  await page.waitForSelector('.piece-row');
  await wait(400);
  await page.screenshot({ path: join(root, 'shots', '06-yard.png') });
  await context.close();
}

async function phone() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'networkidle' });
  // The desktop pass already fired today's piece for this dev user, so the phone
  // may open straight onto the result. Both are valid states to photograph.
  await page.waitForSelector('.wares .ware, .stamp .grade');
  await wait(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) {
    process.stdout.write(`phone overflows horizontally by ${overflow}px\n`);
    process.exitCode = 1;
  }
  await page.screenshot({ path: join(root, 'shots', '07-phone.png') });
  if ((await page.locator('.wares .ware').count()) > 0) {
    await page.locator('.wares .ware').first().click();
    await wait(250);
    await page.screenshot({ path: join(root, 'shots', '08-phone-picked.png') });
  }
  await context.close();
}

try {
  await desktop();
  await phone();
} finally {
  await browser.close();
  server.kill();
}

process.stdout.write('shots written to shots/\n');
