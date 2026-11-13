/**
 * A local stand-in for Reddit.
 *
 * It serves the built client and answers the same three endpoints the Devvit
 * server answers, using the real store and the real sim (bundled with esbuild
 * so there is only one copy of the rules). The only fake part is Redis.
 *
 *   node scripts/dev-server.mjs [--port 4319] [--seed]
 */

import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..');
const harnessDir = join(root, '.harness');
const clientDir = join(root, 'dist', 'client');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg >= 0 ? Number.parseInt(args[portArg + 1] ?? '4319', 10) : 4319;
const SEED = args.includes('--seed');
const NOW = process.env.KILN_NOW ? new Date(process.env.KILN_NOW) : null;

class MemoryRedis {
  constructor() {
    this.hashes = new Map();
    this.values = new Map();
    this.sorted = new Map();
  }
  hash(key) {
    let found = this.hashes.get(key);
    if (!found) {
      found = new Map();
      this.hashes.set(key, found);
    }
    return found;
  }
  async hGet(key, field) {
    return this.hash(key).get(field);
  }
  async hGetAll(key) {
    return Object.fromEntries(this.hash(key));
  }
  async hSetNX(key, field, value) {
    const hash = this.hash(key);
    if (hash.has(field)) return 0;
    hash.set(field, value);
    return 1;
  }
  async hIncrBy(key, field, by) {
    const hash = this.hash(key);
    const next = Number.parseInt(hash.get(field) ?? '0', 10) + by;
    hash.set(field, String(next));
    return next;
  }
  async get(key) {
    return this.values.get(key);
  }
  async set(key, value) {
    this.values.set(key, value);
    return 'OK';
  }
  async zAdd(key, ...members) {
    let set = this.sorted.get(key);
    if (!set) {
      set = new Map();
      this.sorted.set(key, set);
    }
    for (const { member, score } of members) set.set(member, score);
    return members.length;
  }
  async zRange(key, start, stop, opts) {
    const set = this.sorted.get(key) ?? new Map();
    const rows = [...set.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => (opts?.reverse ? b.score - a.score : a.score - b.score));
    const from = typeof start === 'number' ? start : 0;
    const to = typeof stop === 'number' ? stop : rows.length - 1;
    return rows.slice(from, to + 1);
  }
}

async function bundle(entry, outfile) {
  await build({
    entryPoints: [join(root, entry)],
    outfile: join(harnessDir, outfile),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    logLevel: 'silent',
  });
}

async function prepare() {
  await mkdir(harnessDir, { recursive: true });
  await bundle('src/shared/kiln.ts', 'kiln.mjs');
  await bundle('src/server/core/store.ts', 'store.mjs');
  const stamp = Date.now();
  const store = await import(`${pathToFileURL(join(harnessDir, 'store.mjs')).href}?v=${stamp}`);
  const kiln = await import(`${pathToFileURL(join(harnessDir, 'kiln.mjs')).href}?v=${stamp}`);
  return { store, kiln };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(payload);
}

const { store, kiln } = await prepare();
const redis = new MemoryRedis();
const now = () => (NOW ? new Date(NOW) : new Date());

if (SEED) {
  const day = kiln.dayKeyOf(now());
  const seedKiln = kiln.makeKiln(day);
  const guests = [
    { id: 'seed-ash', name: 'ash-and-salt' },
    { id: 'seed-birch', name: 'birch_burner' },
    { id: 'seed-clay', name: 'clayfoot' },
    { id: 'seed-moss', name: 'mossy_kiln' },
  ];
  const placements = ['mouth-1', 'body-0', 'tail-2', 'tail-1'];
  for (let i = 0; i < guests.length; i += 1) {
    const guest = guests[i];
    const ware = seedKiln.wares[i % seedKiln.wares.length];
    const slot = seedKiln.slots.find((s) => s.id === placements[i]);
    await store.submitPiece(redis, now(), guest, {
      wareId: ware.id,
      slotId: slot.id,
      taps: [0.55 + i * 0.1, 0.7, 0.62],
    });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (path === '/api/state') {
    const state = await store.readState(redis, now(), 'dev-potter', 'dev-user');
    json(res, 200, state);
    return;
  }
  if (path === '/api/yard') {
    const yard = await store.readYard(redis, now());
    json(res, 200, { type: 'yard', ...yard });
    return;
  }
  if (path === '/api/commit' && req.method === 'POST') {
    const body = await readBody(req);
    const taps = Array.isArray(body.taps) ? body.taps.map(Number) : [];
    const outcome = await store.submitPiece(
      redis,
      now(),
      { id: 'dev-user', name: 'dev-potter' },
      { wareId: String(body.wareId ?? ''), slotId: String(body.slotId ?? ''), taps }
    );
    if (outcome.kind === 'rejected') json(res, 400, { type: 'error', message: outcome.message });
    else json(res, 200, outcome.response);
    return;
  }

  const file = path === '/' ? 'splash.html' : path.replace(/^\//, '');
  let full = join(clientDir, file);
  if (full.includes('..')) {
    res.writeHead(400).end('bad path');
    return;
  }
  try {
    const info = await stat(full);
    if (info.isDirectory()) full = join(full, 'index.html');
    const body = await readFile(full);
    res.writeHead(200, {
      'content-type': MIME[extname(full)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`kiln dev server on http://127.0.0.1:${PORT}\n`);
});
