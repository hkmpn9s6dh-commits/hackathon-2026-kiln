/**
 * End-to-end: the built client, the real store, a fake Redis.
 *
 *   node scripts/e2e.mjs [--keep]
 *
 * Exits non-zero on the first thing that is not true.
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..');
const PORT = 4319;
const KEEP = process.argv.includes('--keep');

const CHROME =
  process.env.KILN_CHROME ??
  'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';

const VIEW = { width: 1000, height: 560 };

function slotPoint(canvasBox, slot) {
  const chamber = { mouth: { x: 92, w: 258 }, body: { x: 384, w: 250 }, tail: { x: 668, w: 246 } }[slot.zone];
  const shelf = [252, 352, 452][slot.row];
  const logicalX = chamber.x + chamber.w / 2;
  const logicalY = shelf - 48;
  const scale = Math.min(canvasBox.width / VIEW.width, canvasBox.height / VIEW.height);
  const dx = (canvasBox.width - VIEW.width * scale) / 2;
  const dy = (canvasBox.height - VIEW.height * scale) / 2;
  return { x: canvasBox.x + dx + logicalX * scale, y: canvasBox.y + dy + logicalY * scale };
}

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  const mark = ok ? 'ok  ' : 'FAIL';
  process.stdout.write(`${mark} ${name}${detail ? ` — ${detail}` : ''}\n`);
  if (!ok) process.exitCode = 1;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [join(root, 'scripts', 'dev-server.mjs'), '--port', String(PORT), '--seed'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, KILN_NOW: '2026-11-14T09:00:00Z' },
});

const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    if (serverLog.join('').includes('kiln dev server')) return;
    await wait(100);
  }
  throw new Error(`dev server did not start:\n${serverLog.join('')}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await mkdir(join(root, 'shots'), { recursive: true });

  // --- the feed card -------------------------------------------------
  await page.goto(`http://127.0.0.1:${PORT}/splash.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.card h1');
  check('splash renders the wordmark', (await page.locator('.card h1').innerText()) === 'KILN');
  const splashStatus = await page.locator('.card .status').innerText();
  check('splash shows how full the kiln is', /pieces in|°C/.test(splashStatus), splashStatus);
  await page.screenshot({ path: join(root, 'shots', '01-card.png') });

  // --- the game: pick a ware, pick a shelf ---------------------------
  await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wares .ware');
  check('three wares are offered', (await page.locator('.wares .ware').count()) === 3);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  check('the kiln canvas has a real size', Boolean(box && box.width > 300 && box.height > 150), JSON.stringify(box));

  await page.locator('.wares .ware').first().click();
  const kilnState = await page.evaluate(async () => (await fetch('/api/state')).json());
  const slot = kilnState.kiln.slots.find((s) => s.id === 'body-1');
  const point = slotPoint(box, slot);
  await page.mouse.click(point.x, point.y);
  await wait(120);
  check('picking a shelf updates the note', (await page.locator('.stage-note').innerText()).includes('Kiln body'));

  // --- stoking --------------------------------------------------------
  await page.getByRole('button', { name: /Stoke the fire/ }).click();
  await page.waitForSelector('.stoke-track');
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Space');
    await wait(260);
  }
  const marks = await page.locator('.mark').count();
  check('three strokes are recorded', marks === 3);
  await page.screenshot({ path: join(root, 'shots', '02-stoke.png') });

  // --- opening --------------------------------------------------------
  await page.getByRole('button', { name: /Open the kiln/ }).click();
  await page.waitForSelector('.stamp .grade', { timeout: 15000 });
  const grade = await page.locator('.stamp .grade').innerText();
  check('a grade comes back', /Fine|Sound|Underfired|Overfired|Kiln transmutation/.test(grade), grade);
  const figs = await page.locator('.figure .v').allInnerTexts();
  check('the result shows the numbers', figs.length === 3, figs.join(' / '));
  await page.screenshot({ path: join(root, 'shots', '03-result.png') });

  // --- one piece a day ------------------------------------------------
  const second = await page.evaluate(async () => {
    const res = await fetch('/api/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wareId: 'jar', slotId: 'tail-0', taps: [1, 1, 1], guestId: 'e2etest01' }),
    });
    return res.json();
  });
  check('the server refuses a second piece', second.already === true, `already=${second.already}`);

  // --- the yard -------------------------------------------------------
  await page.getByRole('button', { name: /See the yard/ }).click();
  await page.waitForSelector('.piece-row');
  const rows = await page.locator('.piece-row').count();
  check('the yard lists the pieces that are in', rows >= 4, `${rows} rows`);
  await page.screenshot({ path: join(root, 'shots', '04-yard.png') });

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await context.close();
} catch (error) {
  check('e2e completed without throwing', false, String(error));
  process.stdout.write(`\n--- dev server log ---\n${serverLog.join('')}\n`);
} finally {
  if (browser) await browser.close();
  if (!KEEP) server.kill();
}

const failed = checks.filter((c) => !c.ok);
process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed\n`);
if (failed.length > 0) process.exitCode = 1;
