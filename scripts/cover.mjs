/**
 * The 1500x1000 gallery cover.
 *
 *   node scripts/cover.mjs
 *
 * Drawn as HTML/SVG and photographed, so it uses the same shapes and palette as
 * the game instead of a separate piece of art that drifts.
 */

import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const CHROME =
  process.env.KILN_CHROME ??
  'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="file://${root.replace(/\\/g, '/')}/node_modules/@fontsource-variable/fraunces/index.css" />
<link rel="stylesheet" href="file://${root.replace(/\\/g, '/')}/node_modules/@fontsource-variable/inter/index.css" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1500px; height: 1000px; background: #f4ede2; overflow: hidden;
         font-family: 'Inter Variable', system-ui, sans-serif; color: #221a14; }
  .wrap { position: relative; width: 100%; height: 100%; }
  .art { position: absolute; inset: 0; }
  .copy { position: absolute; left: 96px; top: 736px; max-width: 760px; }
  .kicker { font-size: 20px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a5a3c; }
  h1 { font-family: 'Fraunces Variable', serif; font-size: 150px; line-height: 0.82;
       letter-spacing: 0.12em; font-variation-settings: 'SOFT' 60, 'WONK' 1, 'opsz' 90; }
  p { margin-top: 18px; font-size: 26px; line-height: 1.45; color: #4a3b30; max-width: 640px; }
  .rule { position: absolute; left: 96px; top: 700px; width: 1308px; height: 1px; background: rgba(34,26,20,0.22); }
</style>
</head>
<body>
<div class="wrap">
  <svg class="art" viewBox="0 0 1500 1000" width="1500" height="1000" preserveAspectRatio="none">
    <rect width="1500" height="1000" fill="#f4ede2" />
    <!-- the kiln wall -->
    <rect x="0" y="0" width="1500" height="640" fill="#bda58b" />
    <g stroke="#8a7057" stroke-opacity="0.22" stroke-width="1">
      ${Array.from({ length: 28 }, (_, i) => `<line x1="0" y1="${i * 22}" x2="1500" y2="${i * 22}" />`).join('')}
    </g>
    <!-- one deep arch -->
    <path d="M40 640 L40 280 Q380 80 830 270 L830 640 Z" fill="#9a5820" />
    <path d="M70 640 L70 312 Q380 130 800 290 L800 640 Z" fill="#120a06" />
    <path d="M70 512 Q380 460 800 522 L800 640 L70 640 Z" fill="#a8451c" />
    <path d="M70 566 Q380 520 800 576 L800 640 L70 640 Z" fill="#e0662a" />
    <path d="M70 602 Q380 568 800 610 L800 640 L70 640 Z" fill="#ffce94" />
    <!-- floor -->
    <rect x="0" y="640" width="1500" height="60" fill="#a58c6d" />
    <rect x="0" y="638" width="1500" height="4" fill="#7d664c" opacity="0.55" />
    <!-- the piece -->
    <g transform="translate(1090 640) scale(3.6)">
      <ellipse cx="6" cy="2" rx="42" ry="8" fill="#5a3e2a" opacity="0.28" />
      <path d="M-12 -58 C-14 -50 -31 -46 -31 -22 C-31 -5 -15 0 0 0 C15 0 31 -5 31 -22 C31 -46 14 -50 12 -58 Z"
            fill="#2f5aa8" stroke="#221a14" stroke-width="2" />
      <path d="M-24 -34 C-16 -42 -4 -46 6 -46" stroke="#ffffff" stroke-opacity="0.45" stroke-width="5" fill="none" />
      <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="#0b0603" />
      <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="none" stroke="#221a14" stroke-width="2" />
    </g>
  </svg>
  <div class="rule"></div>
  <div class="copy">
    <div class="kicker">One kiln a day</div>
    <h1>KILN</h1>
    <p>One piece each. Everyone fires the same kiln. Miss the heat and it comes out chalk.</p>
  </div>
</div>
</body>
</html>`;

await mkdir(join(root, 'submission'), { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: join(root, 'submission', 'cover-1500x1000.png') });
await browser.close();
process.stdout.write('submission/cover-1500x1000.png\n');
