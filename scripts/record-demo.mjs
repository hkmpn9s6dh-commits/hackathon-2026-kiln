/**
 * The 40-second demo.
 *
 *   node scripts/record-demo.mjs
 *
 * Records a real play-through in Chromium with captions burned in, then converts
 * to mp4 if the bundled ffmpeg can. No voice track: captions carry it.
 */

import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = 4331;
const CHROME =
  process.env.KILN_CHROME ??
  'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const FFMPEG = process.env.KILN_FFMPEG ?? 'C:/Users/张一/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';

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

const rawDir = join(root, 'submission', 'video-raw');
await rm(rawDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

async function caption(text) {
  await page.evaluate((value) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cap';
      el.style.cssText = [
        'position:fixed',
        'left:0',
        'right:0',
        'bottom:28px',
        'display:flex',
        'justify-content:center',
        'pointer-events:none',
        'z-index:9999',
        "font-family:'Inter Variable',system-ui,sans-serif",
      ].join(';');
      document.body.appendChild(el);
    }
    el.innerHTML = `<span style="background:rgba(20,12,8,0.82);color:#f7efe2;padding:10px 18px;border-radius:3px;font-size:19px;letter-spacing:0.01em">${value}</span>`;
  }, text);
}

try {
  // 1. the feed card
  await page.goto(`http://127.0.0.1:${PORT}/splash.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.card h1');
  await caption('One wood kiln a day. One piece each.');
  await wait(4200);

  // 2. the kiln
  await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wares .ware');
  await caption('Nine shelves: fire mouth, body, tail.');
  await wait(3600);

  // 3. pick a ware and a shelf
  await page.locator('.wares .ware').nth(1).click();
  await wait(700);
  const box = await page.locator('canvas').boundingBox();
  const scale = Math.min(box.width / 1000, box.height / 560);
  const dx = (box.width - 1000 * scale) / 2;
  const dy = (box.height - 560 * scale) / 2;
  await page.mouse.click(box.x + dx + 500 * scale, box.y + dy + 360 * scale);
  await caption('Every piece already in that chamber costs it 7°C.');
  await wait(3800);

  // 4. stoke
  await page.getByRole('button', { name: /Stoke the fire/ }).click();
  await page.waitForSelector('.stoke-track');
  await caption('Three strokes. Stop the needle in the band.');
  await wait(900);
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Space');
    await wait(900);
  }
  await wait(600);

  // 5. open
  await page.getByRole('button', { name: /Open the kiln/ }).click();
  await page.waitForSelector('.stamp .grade', { timeout: 20000 });
  await caption('Out of the kiln: fine, sound, or chalk.');
  await wait(4000);

  // 6. the yard
  await page.getByRole('button', { name: /See the yard/ }).click();
  await page.waitForSelector('.piece-row');
  await caption('Everyone fired the same kiln. A new one at midnight UTC.');
  await wait(4600);
} finally {
  await context.close();
  await browser.close();
  server.kill();
}

const files = (await readdir(rawDir)).filter((f) => f.endsWith('.webm'));
if (files.length === 0) {
  process.stdout.write('no recording produced\n');
  process.exit(1);
}
const webm = join(rawDir, files[0]);
const mp4 = join(root, 'submission', 'kiln-demo.mp4');
await new Promise((done) => {
  const ff = spawn(FFMPEG, ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', mp4], {
    stdio: 'ignore',
  });
  ff.on('exit', (code) => {
    if (code === 0) {
      process.stdout.write('submission/kiln-demo.mp4\n');
    } else {
      process.stdout.write('ffmpeg could not encode h264; keeping the webm\n');
      void rename(webm, join(root, 'submission', 'kiln-demo.webm'));
    }
    done(null);
  });
});
