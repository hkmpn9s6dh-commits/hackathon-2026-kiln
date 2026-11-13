import { describe, expect, it } from 'vitest';

import { CROWD_PENALTY, dayKeyOf, idealStoke, makeKiln } from '../../shared/kiln';
import type { RedisLike } from './store';
import { nextStreak, countsFrom, readState, readYard, submitPiece } from './store';

/** A Redis that lives in a Map, with just the commands this app uses. */
class FakeRedis implements RedisLike {
  private hashes = new Map<string, Map<string, string>>();
  private values = new Map<string, string>();
  private sorted = new Map<string, Map<string, number>>();

  private hash(key: string): Map<string, string> {
    let found = this.hashes.get(key);
    if (!found) {
      found = new Map();
      this.hashes.set(key, found);
    }
    return found;
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.hash(key).get(field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hash(key));
  }

  async hSetNX(key: string, field: string, value: string): Promise<number> {
    const hash = this.hash(key);
    if (hash.has(field)) return 0;
    hash.set(field, value);
    return 1;
  }

  async hIncrBy(key: string, field: string, by: number): Promise<number> {
    const hash = this.hash(key);
    const next = Number.parseInt(hash.get(field) ?? '0', 10) + by;
    hash.set(field, String(next));
    return next;
  }

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async set(key: string, value: string): Promise<string> {
    this.values.set(key, value);
    return 'OK';
  }

  async zAdd(key: string, ...members: { member: string; score: number }[]): Promise<number> {
    let set = this.sorted.get(key);
    if (!set) {
      set = new Map();
      this.sorted.set(key, set);
    }
    for (const { member, score } of members) set.set(member, score);
    return members.length;
  }

  async zRange(
    key: string,
    start: number | string,
    stop: number | string,
    opts?: { by: 'rank' | 'score' | 'lex'; reverse?: boolean }
  ): Promise<{ member: string; score: number }[]> {
    const set = this.sorted.get(key) ?? new Map<string, number>();
    const rows = [...set.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => (opts?.reverse ? b.score - a.score : a.score - b.score));
    const from = typeof start === 'number' ? start : 0;
    const to = typeof stop === 'number' ? stop : rows.length - 1;
    return rows.slice(from, to + 1);
  }
}

const NOON = new Date('2026-11-14T12:00:00Z');
const TODAY = dayKeyOf(NOON);
const TOMORROW = new Date('2026-11-15T09:00:00Z');

function plan(now: Date, wareIndex = 0, slotId = 'body-1') {
  const kiln = makeKiln(dayKeyOf(now));
  const ware = kiln.wares[wareIndex];
  const slot = kiln.slots.find((s) => s.id === slotId);
  if (!ware || !slot) throw new Error('bad fixture');
  const needed = idealStoke(ware, slot, 0);
  const perTap = (needed / 3 + 6) / 18;
  return { wareId: ware.id, slotId: slot.id, taps: [perTap, perTap, perTap] };
}

describe('storing a firing', () => {
  it('commits once, then hands back the same piece', async () => {
    const redis = new FakeRedis();
    const input = plan(NOON);
    const first = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, input);
    expect(first.kind).toBe('committed');
    if (first.kind !== 'committed') return;
    expect(first.response.already).toBe(false);
    expect(first.response.streak).toBe(1);

    const second = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, input);
    expect(second.kind).toBe('already');
    if (second.kind !== 'already') return;
    expect(second.response.already).toBe(true);
    expect(second.response.mine.temp).toBe(first.response.mine.temp);
    expect(second.response.total).toBe(first.response.total);
  });

  it('counts every piece into its zone, and charges the next potter for it', async () => {
    const redis = new FakeRedis();
    const first = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, plan(NOON, 0, 'body-1'));
    const second = await submitPiece(redis, NOON, { id: 'u2', name: 'birch' }, plan(NOON, 0, 'body-1'));
    expect(first.kind).toBe('committed');
    expect(second.kind).toBe('committed');
    if (first.kind !== 'committed' || second.kind !== 'committed') return;
    expect(second.response.counts.body).toBe(2);
    expect(first.response.counts.body).toBe(1);
  });

  it('makes the second piece in a zone colder by exactly one crowd penalty', async () => {
    const redis = new FakeRedis();
    const a = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, plan(NOON, 0, 'tail-0'));
    const b = await submitPiece(redis, NOON, { id: 'u2', name: 'birch' }, plan(NOON, 0, 'tail-0'));
    if (a.kind !== 'committed' || b.kind !== 'committed') throw new Error('expected two commits');
    expect(a.response.mine.temp - b.response.mine.temp).toBe(CROWD_PENALTY);
  });

  it('refuses a ware or shelf that is not in today’s kiln', async () => {
    const redis = new FakeRedis();
    const bad = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, { wareId: 'nope', slotId: 'body-1', taps: [1, 1, 1] });
    expect(bad.kind).toBe('rejected');
    const badSlot = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, { wareId: plan(NOON).wareId, slotId: 'nope', taps: [1, 1, 1] });
    expect(badSlot.kind).toBe('rejected');
  });

  it('ignores extra taps and clamps wild ones', async () => {
    const redis = new FakeRedis();
    const wild = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, { ...plan(NOON), taps: [50, -50, 0.5] });
    expect(wild.kind).toBe('committed');
    if (wild.kind !== 'committed') return;
    expect(Number.isFinite(wild.response.mine.temp)).toBe(true);
  });
});

describe('streaks', () => {
  it('starts at one, grows on the next day, and resets after a gap', () => {
    expect(nextStreak({ lastDay: '', days: 0 }, TODAY)).toEqual({ lastDay: TODAY, days: 1 });
    expect(nextStreak({ lastDay: TODAY, days: 3 }, TODAY)).toEqual({ lastDay: TODAY, days: 3 });
    expect(nextStreak({ lastDay: TODAY, days: 3 }, '2026-11-15')).toEqual({ lastDay: '2026-11-15', days: 4 });
    expect(nextStreak({ lastDay: TODAY, days: 3 }, '2026-11-18')).toEqual({ lastDay: '2026-11-18', days: 1 });
  });

  it('carries the streak into the next day’s state', async () => {
    const redis = new FakeRedis();
    await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, plan(NOON));
    await submitPiece(redis, TOMORROW, { id: 'u1', name: 'ash' }, plan(TOMORROW));
    const state = await readState(redis, new Date('2026-11-15T10:00:00Z'), 'ash', 'u1');
    expect(state.streak).toBe(2);
  });
});

describe('reading the kiln', () => {
  it('gives a fresh player an empty yard and a full clock', async () => {
    const redis = new FakeRedis();
    const state = await readState(redis, NOON, 'ash', 'u1');
    expect(state.day).toBe(TODAY);
    expect(state.mine).toBeNull();
    expect(state.streak).toBe(0);
    expect(state.counts).toEqual({ mouth: 0, body: 0, tail: 0 });
    expect(state.hoursLeft).toBeCloseTo(12, 5);
    expect(state.kiln.slots).toHaveLength(9);
  });

  it('shows the same piece back to the potter who fired it', async () => {
    const redis = new FakeRedis();
    const input = plan(NOON);
    const done = await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, input);
    if (done.kind !== 'committed') throw new Error('expected a commit');
    const state = await readState(redis, NOON, 'ash', 'u1');
    expect(state.mine).not.toBeNull();
    expect(state.mine?.slotId).toBe(input.slotId);
    expect(state.mine?.grade).toBe(done.response.mine.grade);
  });

  it('lists the yard in the order pieces went in', async () => {
    const redis = new FakeRedis();
    await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, plan(NOON, 0, 'body-1'));
    await submitPiece(redis, new Date(NOON.getTime() + 60_000), { id: 'u2', name: 'birch' }, plan(NOON, 1, 'tail-2'));
    const yard = await readYard(redis, NOON);
    expect(yard.entries).toHaveLength(2);
    expect(yard.entries[0]?.username).toBe('ash');
    expect(yard.entries[1]?.username).toBe('birch');
    expect(yard.total).toBe(2);
    expect(yard.balanced).toBe(false);
  });

  it('ranks the day’s board from high to low', async () => {
    const redis = new FakeRedis();
    await submitPiece(redis, NOON, { id: 'u1', name: 'ash' }, plan(NOON, 0, 'body-1'));
    await submitPiece(redis, NOON, { id: 'u2', name: 'birch' }, plan(NOON, 1, 'tail-1'));
    const state = await readState(redis, NOON, 'ash', 'u1');
    expect(state.board.length).toBe(2);
    expect(state.board[0]!.score).toBeGreaterThanOrEqual(state.board[1]!.score);
  });

  it('treats junk in redis as an empty kiln instead of crashing', async () => {
    const redis = new FakeRedis();
    await redis.hSetNX(`kiln:${TODAY}:zones`, 'body', 'not-a-number');
    const state = await readState(redis, NOON, 'ash', 'u1');
    expect(state.counts.body).toBe(0);
    expect(countsFrom({ mouth: '-4' })).toEqual({ mouth: 0, body: 0, tail: 0 });
  });
});
