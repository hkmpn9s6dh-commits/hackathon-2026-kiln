/**
 * Local play, without the platform.
 *
 * Serves the real built client, mounts the real Hono routes, and swaps Redis
 * for a JSON file — so `npm run preview` gives you the exact same game a
 * subreddit would run, with nobody's approval needed. A handful of rival pots
 * are seeded so the crowd on the kiln map is visible on a fresh laptop.
 *
 *   npm run preview            # http://localhost:5173
 *   PORT=8080 npm run preview
 *   SEED=0 npm run preview     # an empty kiln
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApi } from '../src/server/app.ts';
import { fileStore } from '../src/server/store-file.ts';
import { dayKeyOf, specForDay } from '../src/shared/sim/daily.ts';
import { evaluate, flambeRollFor } from '../src/shared/sim/evaluate.ts';
import { readTrace } from '../src/shared/sim/fire.ts';
import { effectiveFactor } from '../src/shared/sim/kiln.ts';

const PORT = Number(process.env.PORT ?? 5173);
const SEED = Number(process.env.SEED ?? 8);
const DATA = process.env.KILN_DATA ?? '.kiln-local.json';

const store = await fileStore(DATA);
const now = () => new Date();
const day = dayKeyOf(now());

const RIVALS = [
  'claymore', 'sinter', 'ashfall', 'nine_fires', 'glaze_ghost',
  'cold_flue', 'biscuit', 'stoker_jin', 'shard_picker', 'kiln_widow',
];

async function seed() {
  if (!Number.isFinite(SEED) || SEED <= 0) return;
  const existing = await store.pots(day);
  if (existing.length > 0) return;

  const spec = specForDay(day);
  const placed = [];
  for (const [n, name] of RIVALS.slice(0, SEED).entries()) {
    // Slight bias toward the fire mouth: that is what a crowd does.
    const x = Math.min(0.96, 0.04 + Math.pow(((n * 37) % 100) / 100, 1.7) * 0.62);
    const y = 0.08 + (((n * 53) % 88) / 100) * 0.84;
    const factor = effectiveFactor(x, y, placed.length, placed.length);
    const trace = readTrace(
      Array.from({ length: 49 }, (_, i) => ({
        t: (i / 48) * 24,
        temp: Math.max(0, (spec.curve[Math.min(7, Math.floor((i / 48) * 8))] ?? 0) * (0.86 + (n % 7) / 40)),
      })),
      spec.curve,
    );
    const outcome = evaluate({
      ware: spec.ware,
      factor,
      trace,
      flambeRoll: flambeRollFor(day, name),
    });
    const pot = {
      u: `seed:${name}`,
      n: name,
      x,
      y,
      q: outcome.quality,
      v: outcome.verdict,
      s: outcome.score,
      t: Date.now() + n,
    };
    await store.savePot(day, pot);
    placed.push(pot);
  }
  console.log(`seeded ${placed.length} rival pots into ${day}`);
}

await seed();

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, day, store: DATA }));

app.route(
  '/',
  createApi({
    store,
    session: () => {
      const user = (process.env.KILN_USER ?? 'local').trim();
      return { user, name: user === 'local' ? 'You' : user, loggedIn: true };
    },
    now,
  }),
);

app.use('/*', serveStatic({ root: './dist/client' }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`KILN on http://localhost:${info.port}  (day ${day}, data ${DATA})`);
});
