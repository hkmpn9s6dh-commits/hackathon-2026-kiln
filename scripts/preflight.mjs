/**
 * Static checks on the thing that will actually be uploaded.
 *
 *   node scripts/preflight.mjs
 *
 * Nothing here needs Reddit, a browser or a token: it reads devvit.json and the
 * built bundle and refuses to let obvious mistakes through.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}
function note(message) {
  notes.push(message);
}

async function readJson(path) {
  const text = await readFile(join(root, path), 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${path} is not valid JSON: ${String(error)}`);
    return null;
  }
}

async function exists(path) {
  try {
    await stat(join(root, path));
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const out = [];
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  for (const entry of entries) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await listFiles(rel)));
    else out.push(rel);
  }
  return out;
}

const config = await readJson('devvit.json');
if (config) {
  if (!/^[a-z][a-z0-9-]{2,19}$/.test(config.name ?? '')) {
    fail(`devvit.json name "${config.name}" must be 3–20 chars, lowercase, start with a letter`);
  }
  const entrypoints = config.post?.entrypoints ?? {};
  for (const key of ['default', 'game']) {
    if (!entrypoints[key]?.entry) fail(`devvit.json is missing the "${key}" entrypoint`);
  }
  if (config.server?.entry !== 'index.cjs') {
    fail(`server entry should be index.cjs (CJS is the only format Devvit runs), got ${config.server?.entry}`);
  }
  const scheduled = Object.entries(config.scheduler?.tasks ?? {});
  if (scheduled.length === 0) fail('no scheduled task: the daily post is the return loop');
  for (const [name, task] of scheduled) {
    if (!/^\/internal\//.test(task?.endpoint ?? '')) fail(`scheduler task ${name} must point at /internal/...`);
    if (!task?.cron) fail(`scheduler task ${name} has no cron`);
  }
  if (config.permissions?.redis !== true) fail('permissions.redis must be true — the shared kiln lives there');
  if (config.triggers?.onAppInstall !== '/internal/triggers/on-app-install') {
    fail('onAppInstall trigger is not wired');
  }
}

for (const file of ['dist/client/splash.html', 'dist/client/game.html', 'dist/server/index.cjs']) {
  if (!(await exists(file))) fail(`missing build output: ${file} (run npm run build)`);
}

if (!problems.length) {
  const clientFiles = await listFiles('dist/client');
  let bytes = 0;
  for (const file of clientFiles) {
    const info = await stat(join(root, file));
    bytes += info.size;
  }
  if (bytes > 4 * 1024 * 1024) fail(`client bundle is ${(bytes / 1048576).toFixed(1)}MB — too big for a feed post`);
  note(`client bundle: ${(bytes / 1024).toFixed(0)}KB across ${clientFiles.length} files`);

  const textFiles = clientFiles.filter((f) => /\.(js|css|html)$/.test(f));
  for (const file of textFiles) {
    const text = await readFile(join(root, file), 'utf8');
    const external = text.match(/https?:\/\/[^\s"'()]+/g) ?? [];
    for (const url of external) {
      if (/^https?:\/\/www\.w3\.org\//.test(url)) continue;
      if (/^https?:\/\/schema\.devvit/.test(url)) continue;
      if (/^https?:\/\/[a-z0-9.-]*devvit/.test(url)) continue;
      // React puts documentation links in its own error text; nothing is fetched.
      if (/^https?:\/\/react\.dev\//.test(url)) continue;
      fail(`${file} loads an external URL: ${url.slice(0, 80)}`);
      break;
    }
    if (/\beval\s*\(/.test(text)) fail(`${file} contains eval()`);
    if (/new\s+Function\s*\(/.test(text)) fail(`${file} builds code from strings`);
  }

  const server = await readFile(join(root, 'dist/server/index.cjs'), 'utf8');
  if (/^\s*import\s/m.test(server.slice(0, 2000))) fail('server bundle looks like ESM; Devvit needs CJS');
  // Hono composes the "/api" and "/internal" prefixes at runtime, so look for the
  // route fragments and the strings only our handlers contain.
  for (const route of ['/state', '/commit', '/yard', 'post-create', 'on-app-install', 'daily-kiln', 'kiln:streak']) {
    if (!server.includes(route)) fail(`server bundle does not seem to contain ${route}`);
  }
  note(`server bundle: ${(Buffer.byteLength(server) / 1024).toFixed(0)}KB`);

  const html = await readFile(join(root, 'dist/client/splash.html'), 'utf8');
  if (!/viewport/.test(html)) fail('splash.html has no viewport meta — the feed card will zoom on phones');
}

for (const noteText of notes) process.stdout.write(`  · ${noteText}\n`);
if (problems.length) {
  process.stdout.write('\npreflight failed:\n');
  for (const problem of problems) process.stdout.write(`  ✗ ${problem}\n`);
  process.exit(1);
}
process.stdout.write('preflight ok\n');
