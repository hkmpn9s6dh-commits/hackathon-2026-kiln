import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from './store-file.ts';
import { buildInit, playFire, type Session } from './service.ts';
import { autopilot } from '../shared/sim/autopilot.ts';
import { specForDay } from '../shared/sim/daily.ts';

const SESSION: Session = { user: 't2_alice', name: 'alice', loggedIn: true };

async function withStore<T>(fn: (path: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'kiln-'));
  try {
    return await fn(join(dir, 'store.json'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const NOW = new Date('2026-11-14T09:00:00Z');

test('a fresh day is an empty kiln with nothing of yours in it', async () => {
  await withStore(async (path) => {
    const store = await fileStore(path);
    const init = await buildInit(store, SESSION, NOW);
    assert.equal(init.type, 'init');
    assert.equal(init.day, '2026-11-14');
    assert.equal(init.total, 0);
    assert.equal(init.me.played, null);
    assert.equal(init.me.streak, 0);
    assert.equal(init.cells.length, 12);
    assert.ok(init.cells.every((n) => n === 0));
    assert.equal(init.ware.id, specForDay('2026-11-14').ware.id);
    assert.equal(init.board.length, 0);
  });
});

test('firing writes exactly one pot and refuses a second', async () => {
  await withStore(async (path) => {
    const store = await fileStore(path);
    const spec = specForDay('2026-11-14');
    const { samples } = autopilot(spec.curve);

    const first = await playFire(store, SESSION, { x: 0.5, y: 0.4, samples }, NOW);
    assert.ok(first.ok);
    assert.ok(first.value.outcome.score >= 0);

    const again = await playFire(store, SESSION, { x: 0.5, y: 0.4, samples }, NOW);
    assert.equal(again.ok, false);
    if (!again.ok) assert.match(again.message, /already in today/);

    const init = await buildInit(store, SESSION, NOW);
    assert.equal(init.total, 1);
    assert.ok(init.me.played);
    assert.equal(init.me.streak, 1);
  });
});

test('a score is a recount of the trace, not a number the client chose', async () => {
  await withStore(async (path) => {
    const store = await fileStore(path);
    const cold = Array.from({ length: 240 }, (_, i) => ({
      t: (i / 240) * 24,
      temp: 0.05,
    }));
    const res = await playFire(
      store,
      { user: 't2_liar', name: 'liar', loggedIn: true },
      { x: 0.9, y: 0.9, samples: cold },
      NOW,
    );
    assert.ok(res.ok);
    assert.equal(res.value.outcome.verdict, 'under');
    assert.ok(res.value.outcome.score < 15);
  });
});

test('the crowd really does cost the second pot in the same shelf', async () => {
  await withStore(async (path) => {
    const store = await fileStore(path);
    const spec = specForDay('2026-11-14');
    const { samples } = autopilot(spec.curve);

    const a = await playFire(store, { user: 't2_a', name: 'a', loggedIn: true }, { x: 0.5, y: 0.4, samples }, NOW);
    const b = await playFire(store, { user: 't2_b', name: 'b', loggedIn: true }, { x: 0.5, y: 0.4, samples }, NOW);
    assert.ok(a.ok && b.ok);
    assert.ok(b.value.outcome.eff < a.value.outcome.eff, 'the second pot runs colder');
    assert.ok(b.value.outcome.score <= a.value.outcome.score);
  });
});

test('a streak survives one missed night and dies after two', async () => {
  await withStore(async (path) => {
    const store = await fileStore(path);
    const spec14 = specForDay('2026-11-14');
    const { samples } = autopilot(spec14.curve);

    await playFire(store, SESSION, { x: 0.5, y: 0.5, samples }, new Date('2026-11-14T09:00:00Z'));
    const next = await playFire(store, SESSION, { x: 0.5, y: 0.5, samples: samples },
      new Date('2026-11-15T09:00:00Z'));
    assert.ok(next.ok);
    assert.equal(next.value.streak, 2);

    const after = await buildInit(store, SESSION, new Date('2026-11-18T09:00:00Z'));
    assert.equal(after.me.streak, 0);
  });
});

test('nonsense firings are turned away with a reason', async () => {
  await withStore(async (path) => {
    const store = await fileStore(path);
    const spec = specForDay('2026-11-14');
    const { samples } = autopilot(spec.curve);

    const outside = await playFire(store, SESSION, { x: 1.4, y: 0.5, samples }, NOW);
    assert.equal(outside.ok, false);

    const short = await playFire(store, SESSION, { x: 0.5, y: 0.5, samples: samples.slice(0, 5) }, NOW);
    assert.equal(short.ok, false);

    const unfinished = await playFire(store, SESSION, { x: 0.5, y: 0.5, samples: samples.slice(0, 40) }, NOW);
    assert.equal(unfinished.ok, false);

    const backwards = await playFire(
      store,
      SESSION,
      { x: 0.5, y: 0.5, samples: [...samples].reverse() },
      NOW,
    );
    assert.equal(backwards.ok, false);
  });
});

test('the board ranks the day by score and says where you came', async () => {
  await withStore(async (path) => {
    const store = await fileStore(path);
    const spec = specForDay('2026-11-14');
    const { samples } = autopilot(spec.curve);

    await playFire(store, { user: 't2_weak', name: 'weak', loggedIn: true }, { x: 0.97, y: 0.97, samples }, NOW);
    const mid = await playFire(store, { user: 't2_mid', name: 'mid', loggedIn: true }, { x: 0.5, y: 0.4, samples }, NOW);
    assert.ok(mid.ok);

    const init = await buildInit(store, { user: 't2_mid', name: 'mid', loggedIn: true }, NOW);
    assert.equal(init.board.length, 2);
    assert.equal(init.board[0]?.rank, 1);
    assert.ok(init.board[0]!.s >= init.board[1]!.s);
    assert.equal(init.me.rank, init.board.find((r) => r.n === 'mid')?.rank ?? null);
  });
});
