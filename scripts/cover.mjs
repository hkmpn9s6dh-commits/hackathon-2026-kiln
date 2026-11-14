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
  .copy { position: absolute; left: 96px; top: 776px; max-width: 1000px; }
  .kicker { font-size: 20px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a5a3c; }
  h1 { font-family: 'Fraunces Variable', serif; font-size: 118px; line-height: 0.82;
       letter-spacing: 0.12em; font-variation-settings: 'SOFT' 60, 'WONK' 1, 'opsz' 90; }
  p { margin-top: 14px; font-size: 24px; line-height: 1.45; color: #4a3b30; max-width: 640px; }
  .rule { position: absolute; left: 96px; top: 752px; width: 1308px; height: 1px; background: rgba(34,26,20,0.22); }
</style>
</head>
<body>
<div class="wrap">
  <svg class="art" viewBox="0 0 1500 1000" width="1500" height="1000" preserveAspectRatio="none">
    <rect width="1500" height="1000" fill="#f4ede2" />
    <rect x="0" y="0" width="1500" height="700" fill="#bda58b" />

    <!-- one whole arch, centred, the piece standing inside its mouth -->
    <path d="M250 700 L250 360 Q750 150 1250 360 L1250 700 Z" fill="#9a5820" />
    <path d="M300 700 L300 402 Q750 216 1200 402 L1200 700 Z" fill="#1d1109" />
    <path d="M300 700 L300 660 Q750 600 1200 660 L1200 700 Z" fill="#7a2f12" />
    <path d="M300 700 L300 680 Q750 624 1200 680 L1200 700 Z" fill="#c9561f" />
    <path d="M300 700 L300 692 Q750 640 1200 692 L1200 700 Z" fill="#ffc37a" />

    <g transform="translate(750 694) scale(3.1)">
      <ellipse cx="0" cy="2" rx="42" ry="8" fill="#1a0d06" opacity="0.55" />
      <path d="M-12 -58 C-14 -50 -31 -46 -31 -22 C-31 -5 -15 0 0 0 C15 0 31 -5 31 -22 C31 -46 14 -50 12 -58 Z"
            fill="#2f5aa8" stroke="#0f0a07" stroke-width="1.2" />
      <path d="M-24 -34 C-16 -42 -4 -46 6 -46" stroke="#ffffff" stroke-opacity="0.5" stroke-width="5" fill="none" />
      <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="#070402" />
      <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="none" stroke="#0f0a07" stroke-width="1.2" />
    </g>

    <!-- floor and the one verb -->
    <rect x="0" y="700" width="1500" height="44" fill="#a58c6d" />
    <rect x="0" y="696" width="1500" height="5" fill="#8c7358" opacity="0.6" />
    <g transform="translate(590 716)">
      <rect x="0" y="0" width="320" height="16" rx="8" fill="#5f4b38" opacity="0.5" />
      <rect x="92" y="0" width="84" height="16" rx="8" fill="#a8451c" />
      <rect x="190" y="-8" width="5" height="32" fill="#221a14" />
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
