/**
 * The game itself, minus HTTP and minus Devvit.
 *
 * Everything a firing depends on is computed here from (a) who is asking,
 * (b) what the store already holds and (c) the raw trace they sent. That is
 * what lets the same code run under Redis in a subreddit and under a JSON file
 * on a laptop, and what makes the server able to recount any score.
 */

import type {
  BoardRow,
  FireRequest,
  FireResponse,
  InitResponse,
  MeView,
  PotView,
} from '../shared/api.ts';
import { dayKeyOf, specForDay, addDays } from '../shared/sim/daily.ts';
import { evaluate, flambeRollFor } from '../shared/sim/evaluate.ts';
import { readTrace, ROUND_SECONDS } from '../shared/sim/fire.ts';
import { CELLS, cellOf, effectiveFactor } from '../shared/sim/kiln.ts';
import type { Verdict } from '../shared/types.ts';

export type PotRecord = {
  /** Store key: the player. Never sent to the client. */
  u: string;
  n: string;
  x: number;
  y: number;
  q: number;
  v: Verdict;
  s: number;
  /** ms since epoch. */
  t: number;
};

export type Streak = { n: number; last: string };

export interface GameStore {
  pots(day: string): Promise<PotRecord[]>;
  pot(day: string, user: string): Promise<PotRecord | null>;
  savePot(day: string, pot: PotRecord): Promise<void>;
  streak(user: string): Promise<Streak | null>;
  saveStreak(user: string, streak: Streak): Promise<void>;
}

export type Session = {
  /** Stable store key for this player. */
  user: string;
  /** What other players see. */
  name: string;
  loggedIn: boolean;
};

export type Outcome0<T> = { ok: true; value: T } | { ok: false; message: string };

const MAX_POTS_ON_MAP = 240;
const MAX_BOARD = 8;

function toView(p: PotRecord): PotView {
  return { n: p.n, x: p.x, y: p.y, q: p.q, v: p.v, s: p.s };
}

function countCells(pots: readonly PotRecord[]): number[] {
  const cells = new Array<number>(CELLS).fill(0);
  for (const p of pots) {
    const i = cellOf(p.x, p.y);
    cells[i] = (cells[i] ?? 0) + 1;
  }
  return cells;
}

function boardOf(pots: readonly PotRecord[]): BoardRow[] {
  return [...pots]
    .sort((a, b) => b.s - a.s || a.t - b.t)
    .slice(0, MAX_BOARD)
    .map((p, i) => ({ rank: i + 1, n: p.n, s: p.s, v: p.v }));
}

function rankOf(pots: readonly PotRecord[], me: PotRecord | null): number | null {
  if (!me) return null;
  const better = pots.filter((p) => p.s > me.s || (p.s === me.s && p.t < me.t)).length;
  return better + 1;
}

/** A stored streak only counts if it ended today or yesterday. */
export function streakValue(streak: Streak | null, day: string): number {
  if (!streak) return 0;
  if (streak.last === day || streak.last === addDays(day, -1)) return streak.n;
  return 0;
}

export async function buildInit(
  store: GameStore,
  session: Session,
  now: Date,
): Promise<InitResponse> {
  const day = dayKeyOf(now);
  const spec = specForDay(day);
  const [pots, mine, streak] = await Promise.all([
    store.pots(day),
    store.pot(day, session.user),
    store.streak(session.user),
  ]);

  const others = pots.filter((p) => p.u !== session.user);
  const cells = countCells(pots);
  const me: MeView = {
    name: session.name,
    loggedIn: session.loggedIn,
    played: mine ? toView(mine) : null,
    streak: streakValue(streak, day),
    rank: rankOf(pots, mine),
    others: others.length,
  };

  const next = specForDay(addDays(day, 1));

  return {
    type: 'init',
    day,
    endsAt: spec.startsAt + 86_400_000,
    now: now.getTime(),
    ware: spec.ware,
    nextWare: { name: next.ware.name, zh: next.ware.zh },
    peak: spec.peak,
    schedule: spec.schedule,
    shape: spec.shape,
    curve: spec.curve,
    cells,
    pots: pots
      .slice()
      .sort((a, b) => a.t - b.t)
      .slice(-MAX_POTS_ON_MAP)
      .map(toView),
    total: pots.length,
    me,
    board: boardOf(pots),
  };
}

function validTrace(req: FireRequest): string | null {
  if (!Number.isFinite(req.x) || !Number.isFinite(req.y)) return 'Where is the pot?';
  if (req.x < 0 || req.x > 1 || req.y < 0 || req.y > 1) return 'That spot is outside the kiln.';
  const s = req.samples;
  if (!Array.isArray(s) || s.length < 20) return 'That firing never happened.';
  if (s.length > 600) return `Too many readings (${s.length}).`;
  let last = -1;
  for (let i = 0; i < s.length; i++) {
    const sample = s[i];
    if (!sample || typeof sample.t !== 'number' || typeof sample.temp !== 'number') {
      return `Malformed firing log (${i}).`;
    }
    if (!Number.isFinite(sample.t) || !Number.isFinite(sample.temp)) return `Malformed firing log (${i}).`;
    if (sample.t < last) return `Malformed firing log (${i}: ${sample.t} after ${last}).`;
    if (sample.temp < 0 || sample.temp > 0.8) return `A pot cannot read ${sample.temp}.`;
    last = sample.t;
  }
  if (last < ROUND_SECONDS - 3) return 'The fire was still climbing when you stopped.';
  return null;
}

export async function playFire(
  store: GameStore,
  session: Session,
  req: FireRequest,
  now: Date,
): Promise<Outcome0<FireResponse>> {
  const bad = validTrace(req);
  if (bad) return { ok: false, message: bad };

  const day = dayKeyOf(now);
  const spec = specForDay(day);

  const existing = await store.pot(day, session.user);
  if (existing) {
    return { ok: false, message: 'Your pot is already in today’s kiln. One a day.' };
  }

  // Read the kiln as it stood when this pot went in: the crowd is who came first.
  const before = await store.pots(day);
  const cell = cellOf(req.x, req.y);
  const cellPots = before.filter((p) => cellOf(p.x, p.y) === cell).length;
  const factor = effectiveFactor(req.x, req.y, cellPots, before.length);

  const trace = readTrace(req.samples, spec.curve);
  const outcome = evaluate({
    ware: spec.ware,
    factor,
    trace,
    flambeRoll: flambeRollFor(day, session.user),
  });

  const pot: PotRecord = {
    u: session.user,
    n: session.name,
    x: req.x,
    y: req.y,
    q: outcome.quality,
    v: outcome.verdict,
    s: outcome.score,
    t: now.getTime(),
  };
  await store.savePot(day, pot);

  const prev = await store.streak(session.user);
  const streak =
    prev && prev.last === addDays(day, -1) ? prev.n + 1 : prev && prev.last === day ? prev.n : 1;
  await store.saveStreak(session.user, { n: streak, last: day });

  const pots = [...before, pot];
  return {
    ok: true,
    value: {
      type: 'fire',
      outcome,
      pot: toView(pot),
      rank: rankOf(pots, pot) ?? 1,
      streak,
      cells: countCells(pots),
      total: pots.length,
      board: boardOf(pots),
    },
  };
}
