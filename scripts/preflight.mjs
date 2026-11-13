/**
 * Preflight: check the shipped artifact against the platform contract.
 *
 * `devvit upload` is the only way to know for certain that Reddit accepts an
 * app, and that needs an account. Everything that can be checked without one
 * is checked here instead: the config parses, every declared file exists, every
 * declared endpoint is served, nothing forbidden ended up in the bundle.
 *
 *   node scripts/preflight.mjs        # after `npm run build`
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const problems = [];
const notes = [];

function check(name, ok, detail = '') {
  if (!ok) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail && ok ? `  (${detail})` : ''}`);
}

const root = process.cwd();
const cfgPath = path.join(root, 'devvit.json');
if (!existsSync(cfgPath)) {
  console.error('no devvit.json — run this from the project root');
  process.exit(2);
}
const raw = readFileSync(cfgPath, 'utf8');
let cfg;
try {
  cfg = JSON.parse(raw);
  check('devvit.json parses', true);
} catch (error) {
  check('devvit.json parses', false, String(error));
  process.exit(1);
}

// --- identity ---------------------------------------------------------------
check(
  'app name is a legal Reddit app slug',
  typeof cfg.name === 'string' && /^[a-z][a-z0-9-]{2,19}$/.test(cfg.name),
  cfg.name,
);
check('schema is declared', typeof cfg.$schema === 'string', cfg.$schema ?? 'missing');

// --- entry points -----------------------------------------------------------
const postDir = path.join(root, cfg.post?.dir ?? 'public');
const entries = cfg.post?.entrypoints ?? {};
check('has a default post entrypoint', Boolean(entries.default), Object.keys(entries).join(', '));

for (const [name, entry] of Object.entries(entries)) {
  const file = path.join(postDir, entry.entry);
  check(`entrypoint "${name}" exists`, existsSync(file), path.relative(root, file));
  if (name === 'default') {
    check('default entrypoint is inline (feed card)', entry.inline === true);
  }
}

const serverEntry = path.join(root, cfg.server?.dir ?? 'dist/server', cfg.server?.entry ?? 'index.js');
check('server bundle exists', existsSync(serverEntry), path.relative(root, serverEntry));
if (existsSync(serverEntry)) {
  const bundle = statSync(serverEntry).size;
  check('server bundle is a sane size', bundle > 1000 && bundle < 12 * 1024 * 1024, `${Math.round(bundle / 1024)} KB`);
  check('server bundle is CommonJS', cfg.server?.entry?.endsWith('.cjs') ?? false);
}

// --- permissions ------------------------------------------------------------
check('redis is enabled (the kiln lives in Redis)', cfg.permissions?.redis === true);
check('journeys are enabled (judged criterion)', cfg.permissions?.journeys === true);
check('no payments permission requested', cfg.permissions?.payments !== true);
if (cfg.permissions?.http?.enable) {
  notes.push('http permission is on; the game itself makes no external calls');
}

// --- routes -----------------------------------------------------------------
const serverSource = existsSync(serverEntry) ? readFileSync(serverEntry, 'utf8') : '';

function declaredEndpoints() {
  const out = [];
  for (const item of cfg.menu?.items ?? []) out.push(['menu', item.endpoint]);
  for (const [name, endpoint] of Object.entries(cfg.triggers ?? {})) out.push([`trigger ${name}`, endpoint]);
  for (const [name, task] of Object.entries(cfg.scheduler?.tasks ?? {})) {
    out.push([`task ${name}`, typeof task === 'string' ? task : task.endpoint]);
  }
  for (const [name, endpoint] of Object.entries(cfg.forms ?? {})) out.push([`form ${name}`, endpoint]);
  return out;
}

const declared = declaredEndpoints();
for (const [kind, endpoint] of declared) {
  check(`${kind} endpoint is wired in the bundle`, serverSource.includes(endpoint), endpoint);
  check(
    `${kind} endpoint starts with /internal/`,
    typeof endpoint === 'string' && endpoint.startsWith('/internal/'),
    endpoint,
  );
}

for (const route of ['/api/init', '/api/fire', '/api/telemetry/journey/start']) {
  check(`client route ${route} is served`, serverSource.includes(route));
}

// --- forbidden things -------------------------------------------------------
check('no legacy public-api / blocks code', !serverSource.includes('@devvit/public-api'));

const secretPatterns = [
  [/sk-[A-Za-z0-9]{20,}/, 'an OpenAI-style key'],
  [/ghp_[A-Za-z0-9]{20,}/, 'a GitHub token'],
  [/AKIA[0-9A-Z]{16}/, 'an AWS key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
];
const clientDir = postDir;
const clientFiles = existsSync(clientDir)
  ? readdirSync(clientDir).filter((f) => /\.(js|html|css)$/.test(f))
  : [];
let secretHit = null;
for (const file of clientFiles) {
  const body = readFileSync(path.join(clientDir, file), 'utf8');
  for (const [re, what] of secretPatterns) if (re.test(body)) secretHit = `${file}: ${what}`;
}
check('no credentials in the client bundle', secretHit === null, secretHit ?? '');

let externalRef = null;
for (const file of clientFiles.filter((f) => f.endsWith('.html'))) {
  const body = readFileSync(path.join(clientDir, file), 'utf8');
  const m = /(?:src|href)="(https?:\/\/[^"]+)"/.exec(body);
  if (m) externalRef = `${file}: ${m[1]}`;
}
check('client HTML loads nothing off-domain', externalRef === null, externalRef ?? '');

// --- docs -------------------------------------------------------------------
const readme = path.join(root, 'README.md');
check('README explains how to play and how to run', existsSync(readme));
if (existsSync(readme)) {
  const body = readFileSync(readme, 'utf8');
  check('README mentions verify.sh', body.includes('scripts/verify.sh'));
  check('README mentions the daily reset', /UTC/.test(body));
}

console.log('');
if (notes.length) for (const n of notes) console.log(`note  ${n}`);
if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found.`);
  process.exit(1);
}
console.log('preflight clean.');
