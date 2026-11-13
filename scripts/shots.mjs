/**
 * The submission stills, captured from the real build.
 *
 * Starts the local preview on a throwaway data file, plays a full round with a
 * feedback controller (it reads the same probe the fire loop writes), and saves
 * what a judge would actually see. Not part of verify.sh: the browser is
 * optional, the game is not.
 *
 *   npm run shots
 */

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PORT = 5200 + (Date.now() % 300);
const OUT = 'proof/shots';
const DATA = `.kiln-shots-${Date.now()}.json`;

const CHROME = [
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));

if (!CHROME) {
  console.error('No Chromium found. Install Chrome, or `npx playwright install chromium`.');
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['scripts/preview.mjs'], {
  env: { ...process.env, PORT: String(PORT), SEED: '9', KILN_DATA: DATA },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => process.stdout.write(`  [server] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`  [server] ${d}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('preview server did not start');
}

/** Pick the best empty spot: as close to the band as the crowd allows. */
function bestSpot(init) {
  const { ware, peak, cells, total } = init;
  let best = { x: 0.5, y: 0.5, miss: Infinity };
  for (let xi = 2; xi <= 98; xi++) {
    for (let yi = 2; yi <= 98; yi++) {
      const x = xi / 100;
      const y = yi / 100;
      const col = Math.min(2, Math.floor(x * 3));
      const row = Math.min(3, Math.floor(y * 4));
      const cell = col * 4 + row;
      const crowd = 1 - Math.min(0.06, 0.02 * (cells[cell] ?? 0));
      const load = 1 - Math.min(0.04, 0.0008 * total);
      const cf = colF(x) * rowF(y) * crowd * load;
      const miss = Math.abs(cf * peak - ware.mid);
      if (miss < best.miss) best = { x, y, miss };
    }
  }
  return best;
}

const COL = [1.16, 1.0, 0.86];
const ROW = [1.06, 1.0, 0.94, 0.88];
function piece(table, u) {
  const n = table.length;
  const x = Math.min(1, Math.max(0, u)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}
const colF = (x) => piece(COL, x);
const rowF = (y) => piece(ROW, y);

const tSeg = 3;
function targetAt(curve, t) {
  const raw = Math.min(24, Math.max(0, t)) / tSeg;
  const i = Math.min(curve.length - 1, Math.floor(raw));
  const f = raw - i;
  const a = curve[i] ?? 0;
  const b = curve[Math.min(curve.length - 1, i + 1)] ?? a;
  return a + (b - a) * f;
}

async function playRound(page, { label, viewport }) {
  await page.setViewportSize(viewport);
  await page.goto(`http://localhost:${PORT}/game.html?probe=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.kiln-wrap canvas', { timeout: 15000 });
  await sleep(700);

  const init = await (await fetch(`http://localhost:${PORT}/api/init`)).json();
  const spot = bestSpot(init);

  const box = await page.locator('.kiln-wrap canvas').boundingBox();
  const cx = box.x + ((16 + spot.x * (720 - 32)) / 720) * box.width;
  const cy = box.y + ((16 + spot.y * (420 - 32)) / 420) * box.height;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(500);
  await page.screenshot({ path: `${OUT}/${label}-1-load.jpg`, type: 'jpeg', quality: 88 });

  await page.getByRole('button', { name: /Light the fire/i }).click();
  await page.waitForSelector('.feed', { timeout: 8000 });
  await sleep(400);
  await page.screenshot({ path: `${OUT}/${label}-2-fire-start.jpg`, type: 'jpeg', quality: 88 });

  const feed = await page.locator('.feed').boundingBox();
  const fx = feed.x + feed.width / 2;
  const fy = feed.y + feed.height / 2;

  let down = false;
  let shotAt = false;
  let lastState = null;
  const started = Date.now();
  while (Date.now() - started < 28000) {
    const probe = await page.evaluate(() => window.__kilnProbe ?? null);
    if (!probe?.state) break;
    const state = { ...probe.state, curve: probe.curve };
    if (state.t > 21 && !shotAt) {
      shotAt = true;
      await page.screenshot({ path: `${OUT}/${label}-3-fire.jpg`, type: 'jpeg', quality: 88 });
    }
    // A skilled player stokes ahead of the line: the pot lags the fire by ~2s.
    const ahead = targetAt(state.curve, state.t + 1.2);
    const want = state.temp < ahead + 0.012;
    if (want && !down) {
      await page.mouse.move(fx, fy);
      await page.mouse.down();
      down = true;
    } else if (!want && down) {
      await page.mouse.up();
      down = false;
    }
    if (state.t >= 23.9) { lastState = state; break; }
    lastState = state;
    await sleep(40);
  }
  if (down) await page.mouse.up();
  console.log(`  trace: peak ${lastState?.temp?.toFixed(3)} target ${lastState?.target?.toFixed(3)} curvePeak ${Math.max(...(lastState?.curve ?? [0])).toFixed(3)}`);

  await page.getByRole('button', { name: /Open the kiln/i }).click({ timeout: 8000 });
  try {
    await page.waitForSelector('.card', { timeout: 8000 });
  } catch (error) {
    await page.screenshot({ path: `${OUT}/${label}-ERR.jpg`, fullPage: true, type: 'jpeg', quality: 80 });
    console.error('no card; page says:', (await page.locator('.shell').innerText()).slice(0, 400));
    throw error;
  }
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/${label}-4-result.jpg`, fullPage: true, type: 'jpeg', quality: 88 });
  const after = await (await fetch(`http://localhost:${PORT}/api/init`)).json();
  console.log(`  spot wanted ${spot.x.toFixed(3)},${spot.y.toFixed(3)} got ${after.me.played?.x?.toFixed(3)},${after.me.played?.y?.toFixed(3)} q ${after.me.played?.q?.toFixed(3)}`);
  const card = await page.locator('.card').innerText();
  console.log(`  ${label}: ${card.split('\n').join(' | ').slice(0, 160)}`);
  return init;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  await waitForServer();

  const desktop = await browser.newContext({ viewport: { width: 820, height: 1080 }, deviceScaleFactor: 1.6 });
  const page = await desktop.newPage();
  const init = await playRound(page, { label: 'desktop', viewport: { width: 820, height: 1080 } });
  console.log(`played ${init.day} · ${init.ware.name}`);

  // The inline card in a feed is narrow; capture what Reddit actually shows.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true });
  const mp = await mobile.newPage();
  await mp.goto(`http://localhost:${PORT}/splash.html`, { waitUntil: 'networkidle' });
  await sleep(900);
  await mp.screenshot({ path: `${OUT}/mobile-0-splash.jpg`, type: 'jpeg', quality: 88 });
} finally {
  await browser.close();
  server.kill();
  rmSync(DATA, { force: true });
  console.log(`stills in ${OUT}/`);
}
