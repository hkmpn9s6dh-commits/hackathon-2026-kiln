/**
 * Everything the app remembers, in one place.
 *
 * The Redis client is passed in, so the same code runs against Devvit's Redis
 * in production and against a memory fake in the tests.
 */

import {
  collectiveOf,
  commitPiece,
  dayKeyOf,
  emptyCounts,
  findSlot,
  findWare,
  hoursUntilNextDay,
  makeKiln,
  previousDayKey,
  finalScore,
} from '../../shared/kiln';
import type { CommitResult, Grade, Kiln, Zone } from '../../shared/kiln';
import type { MyRecord, StateResponse, YardEntry, CommitResponse } from '../../shared/api';

export type RedisLike = {
  hGet: (key: string, field: string) => Promise<string | undefined>;
  hGetAll: (key: string) => Promise<Record<string, string>>;
  hSetNX: (key: string, field: string, value: string) => Promise<number | boolean>;
  hIncrBy: (key: string, field: string, by: number) => Promise<number>;
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string) => Promise<string | undefined>;
  zAdd: (key: string, ...members: { member: string; score: number }[]) => Promise<number>;
  zRange: (
    key: string,
    start: number | string,
    stop: number | string,
    opts?: { by: 'rank' | 'score' | 'lex'; reverse?: boolean }
  ) => Promise<{ member: string; score: number }[]>;
};

export type StoredCommit = {
  u: string;
  w: string;
  s: string;
  z: Zone;
  t: number;
  i: number;
  d: number;
  k: number;
  g: Grade;
  sc: number;
  at: number;
};

export type Streak = { lastDay: string; days: number };

const dayKey = (day: string) => `kiln:${day}:pieces`;
const zoneKey = (day: string) => `kiln:${day}:zones`;
const boardKey = (day: string) => `kiln:${day}:board`;
const streakKey = (userId: string) => `kiln:streak:${userId}`;

export function countsFrom(raw: Record<string, string>): Record<Zone, number> {
  const counts = emptyCounts();
  for (const zone of ['mouth', 'body', 'tail'] as Zone[]) {
    const value = Number.parseInt(raw[zone] ?? '0', 10);
    counts[zone] = Number.isFinite(value) && value > 0 ? value : 0;
  }
  return counts;
}

export async function readStreak(redis: RedisLike, userId: string): Promise<Streak> {
  const raw = await redis.get(streakKey(userId));
  if (!raw) return { lastDay: '', days: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<Streak>;
    if (typeof parsed.lastDay !== 'string' || typeof parsed.days !== 'number') {
      return { lastDay: '', days: 0 };
    }
    return { lastDay: parsed.lastDay, days: Math.max(0, Math.floor(parsed.days)) };
  } catch {
    return { lastDay: '', days: 0 };
  }
}

export function nextStreak(current: Streak, day: string): Streak {
  if (current.lastDay === day) return current;
  if (current.lastDay === previousDayKey(day)) {
    return { lastDay: day, days: current.days + 1 };
  }
  return { lastDay: day, days: 1 };
}

export function decodeCommit(raw: string): StoredCommit | null {
  try {
    const value = JSON.parse(raw) as Partial<StoredCommit>;
    if (
      typeof value.u !== 'string' ||
      typeof value.w !== 'string' ||
      typeof value.s !== 'string' ||
      typeof value.z !== 'string' ||
      typeof value.t !== 'number' ||
      typeof value.i !== 'number' ||
      typeof value.d !== 'number' ||
      typeof value.k !== 'number' ||
      typeof value.g !== 'string' ||
      typeof value.sc !== 'number' ||
      typeof value.at !== 'number'
    ) {
      return null;
    }
    return value as StoredCommit;
  } catch {
    return null;
  }
}

export function toMyRecord(commit: StoredCommit, kiln: Kiln): MyRecord {
  const ware = kiln.wares.find((w) => w.id === commit.w);
  return {
    wareId: commit.w,
    wareName: ware?.name ?? commit.w,
    slotId: commit.s,
    zone: commit.z,
    grade: commit.g,
    temp: commit.t,
    ideal: commit.i,
    delta: commit.d,
    stoke: commit.k,
    score: commit.sc,
    at: commit.at,
  };
}

export async function readBoard(
  redis: RedisLike,
  day: string,
  limit: number
): Promise<{ username: string; score: number }[]> {
  const rows = await redis.zRange(boardKey(day), 0, Math.max(0, limit - 1), { by: 'rank', reverse: true });
  return rows.map((row) => ({ username: row.member, score: Math.round(row.score) }));
}

export async function readState(
  redis: RedisLike,
  now: Date,
  username: string | null,
  userId: string
): Promise<StateResponse> {
  const day = dayKeyOf(now);
  const kiln = makeKiln(day);
  const [rawCounts, rawMine, streak, board] = await Promise.all([
    redis.hGetAll(zoneKey(day)),
    redis.hGet(dayKey(day), userId),
    readStreak(redis, userId),
    readBoard(redis, day, 8),
  ]);
  const mine = rawMine ? decodeCommit(rawMine) : null;
  const hoursLeft = hoursUntilNextDay(now);

  return {
    type: 'state',
    day,
    kiln,
    counts: countsFrom(rawCounts),
    streak: streak.lastDay === day ? streak.days : 0,
    board,
    mine: mine ? toMyRecord(mine, kiln) : null,
    hoursLeft,
    username,
  };
}

export async function readYard(
  redis: RedisLike,
  now: Date
): Promise<{ day: string; entries: YardEntry[]; counts: Record<Zone, number>; balanced: boolean; total: number }> {
  const day = dayKeyOf(now);
  const kiln = makeKiln(day);
  const [rawPieces, rawCounts] = await Promise.all([redis.hGetAll(dayKey(day)), redis.hGetAll(zoneKey(day))]);
  const counts = countsFrom(rawCounts);
  const entries: YardEntry[] = [];
  for (const raw of Object.values(rawPieces)) {
    const commit = decodeCommit(raw);
    if (!commit) continue;
    const ware = kiln.wares.find((w) => w.id === commit.w);
    entries.push({
      username: commit.u,
      wareId: commit.w,
      wareName: ware?.name ?? commit.w,
      slotId: commit.s,
      zone: commit.z,
      grade: commit.g,
      temp: commit.t,
      at: commit.at,
    });
  }
  entries.sort((a, b) => a.at - b.at);
  const collective = collectiveOf(counts);
  return { day, entries, counts, balanced: collective.balanced, total: collective.total };
}

export type CommitOutcome =
  | { kind: 'committed'; response: CommitResponse }
  | { kind: 'already'; response: CommitResponse }
  | { kind: 'rejected'; message: string };

export async function submitPiece(
  redis: RedisLike,
  now: Date,
  user: { id: string; name: string },
  input: { wareId: string; slotId: string; taps: number[] }
): Promise<CommitOutcome> {
  const day = dayKeyOf(now);
  const kiln = makeKiln(day);

  // One piece per potter per day: the second tap on the button must not fire twice.
  const existingRaw = await redis.hGet(dayKey(day), user.id);
  if (existingRaw) {
    const existing = decodeCommit(existingRaw);
    if (existing) {
      const counts = countsFrom(await redis.hGetAll(zoneKey(day)));
      return {
        kind: 'already',
        response: {
          type: 'committed',
          result: replayResult(kiln, existing),
          mine: toMyRecord(existing, kiln),
          counts,
          streak: (await readStreak(redis, user.id)).days,
          balanced: collectiveOf(counts).balanced,
          total: collectiveOf(counts).total,
          score: existing.sc,
          already: true,
        },
      };
    }
  }

  let ware;
  let slot;
  try {
    ware = findWare(kiln, input.wareId);
    slot = findSlot(kiln, input.slotId);
  } catch {
    return { kind: 'rejected', message: 'That piece or that shelf is not in today’s kiln.' };
  }

  const rawCounts = await redis.hGetAll(zoneKey(day));
  const counts = countsFrom(rawCounts);
  const crowd = counts[slot.zone];

  const result = commitPiece({
    kiln,
    wareId: ware.id,
    slotId: slot.id,
    taps: input.taps,
    crowd,
    userId: user.id,
  });

  const stored: StoredCommit = {
    u: user.name,
    w: ware.id,
    s: slot.id,
    z: slot.zone,
    t: result.temp,
    i: ware.ideal,
    d: result.delta,
    k: result.stoke,
    g: result.grade,
    sc: result.score,
    at: now.getTime(),
  };

  const fresh = await redis.hSetNX(dayKey(day), user.id, JSON.stringify(stored));
  if (!fresh) {
    const raced = await redis.hGet(dayKey(day), user.id);
    const decoded = raced ? decodeCommit(raced) : null;
    if (decoded) {
      const after = countsFrom(await redis.hGetAll(zoneKey(day)));
      return {
        kind: 'already',
        response: {
          type: 'committed',
          result: replayResult(kiln, decoded),
          mine: toMyRecord(decoded, kiln),
          counts: after,
          streak: (await readStreak(redis, user.id)).days,
          balanced: collectiveOf(after).balanced,
          total: collectiveOf(after).total,
          score: decoded.sc,
          already: true,
        },
      };
    }
    return { kind: 'rejected', message: 'That shelf filled up while you were stoking. Try again.' };
  }

  counts[slot.zone] = await redis.hIncrBy(zoneKey(day), slot.zone, 1);
  const streakBefore = await readStreak(redis, user.id);
  const streak = nextStreak(streakBefore, day);
  if (streak.lastDay !== streakBefore.lastDay || streak.days !== streakBefore.days) {
    await redis.set(streakKey(user.id), JSON.stringify(streak));
  }

  const collective = collectiveOf(counts);
  const total = finalScore(result, collective.balanced, streak.days);
  await redis.zAdd(boardKey(day), { member: user.name, score: total });

  return {
    kind: 'committed',
    response: {
      type: 'committed',
      result,
      mine: toMyRecord({ ...stored, sc: result.score }, kiln),
      counts,
      streak: streak.days,
      balanced: collective.balanced,
      total: collective.total,
      score: total,
      already: false,
    },
  };
}

export function replayResult(kiln: Kiln, stored: StoredCommit): CommitResult {
  const ware = kiln.wares.find((w) => w.id === stored.w) ?? kiln.wares[0]!;
  const slot = kiln.slots.find((s) => s.id === stored.s) ?? kiln.slots[0]!;
  return {
    ware,
    slot,
    stoke: stored.k,
    temp: stored.t,
    ideal: stored.i,
    delta: stored.d,
    grade: stored.g,
    transmuted: stored.g === 'transmuted',
    score: stored.sc,
  };
}
