/**
 * What today is.
 *
 * One UTC day = one ware + one fire schedule, identical for everybody in the
 * subreddit. Nothing here is random at request time: the day key is the seed,
 * so the client, the server and the bot sweeps all see the same kiln, and a
 * score can be recomputed a month later.
 */

import type { WareDef } from '../types.ts';
import { clamp, hash32, mulberry32 } from './math.ts';

/** Day 0 of the rotation. The contest's first day, so launch week starts kind. */
export const ROTATION_EPOCH_UTC = Date.UTC(2026, 10, 11);
const DAY_MS = 86_400_000;

/**
 * Six wares, easy to hard. Each entry is a real Jingdezhen type; the band is
 * the point — a celadon bowl tolerates a sloppy fire, a copper-red vase does not.
 */
export const WARES: readonly WareDef[] = [
  {
    id: 'yingqing-bowl',
    kind: 'yingqing',
    shape: 'bowl',
    name: 'Celadon lotus bowl',
    zh: '影青刻花碗',
    mid: 0.5,
    half: 0.06,
    body: 'thin',
    praise: 'The glaze pools in the carving and goes blue where it thins. It holds light.',
    overNote: 'The glaze ran to the foot and welded itself to the setters.',
    underNote: 'The glaze is still matte; the carving reads grey.',
    culture:
      'Yingqing — "shadow blue" — is the Song-dynasty ware of Hutian, Jingdezhen: a glaze between blue and white that turns bluer wherever it pools.',
  },
  {
    id: 'qinghua-bowl',
    kind: 'qinghua',
    shape: 'bowl',
    name: 'Blue-and-white lotus bowl',
    zh: '青花缠枝碗',
    mid: 0.58,
    half: 0.055,
    body: 'thick',
    praise: 'The cobalt sank into the glaze. Not one line bled.',
    overNote: 'The blue went violet and the rim bubbled.',
    underNote: 'The cobalt is sitting on top of the glaze, going black.',
    culture:
      'Blue-and-white is underglaze: cobalt painted on the raw body, then sealed under a clear glaze and fired once, so the colour sits inside the glass.',
  },
  {
    id: 'douli-cup',
    kind: 'yingqing',
    shape: 'bowl',
    name: 'Conical tea bowl',
    zh: '影青斗笠盏',
    mid: 0.55,
    half: 0.05,
    body: 'thin',
    praise: 'Thin as a leaf. Tap it and it rings.',
    overNote: 'The rim slumped; the cone is a saucer now.',
    underNote: 'The body is still chalky at the rim.',
    culture:
      'A 斗笠盏 is a tea bowl whose wall rises like a bamboo hat — the thinnest thing a potter can throw, and the first to complain about a fast fire.',
  },
  {
    id: 'qinghua-jar',
    kind: 'qinghua',
    shape: 'jar',
    name: 'Blue-and-white covered jar',
    zh: '青花盖罐',
    mid: 0.62,
    half: 0.045,
    body: 'thick',
    praise: 'The lid sits true. The blue is even all the way round.',
    overNote: 'One shoulder sagged in the heat.',
    underNote: 'Orange-peel glaze, and the blue reads flat.',
    culture:
      'Jars were the export workhorse of Jingdezhen — a lidded jar has to keep its shoulder through the fire or the lid never seats again.',
  },
  {
    id: 'qinghua-meiping',
    kind: 'qinghua',
    shape: 'vase',
    name: 'Blue-and-white meiping',
    zh: '青花梅瓶',
    mid: 0.65,
    half: 0.046,
    body: 'thick',
    praise: 'The shoulder line holds, and the cobalt reads in three tones.',
    overNote: 'Glaze ran off the shoulder and left a scar.',
    underNote: 'The cobalt never fused into the body.',
    culture:
      'A meiping — "plum vase" — is small-mouthed, broad-shouldered, narrow-footed: a wine jar in the Song, a display piece by the Ming.',
  },
  {
    id: 'jihong-vase',
    kind: 'jihong',
    shape: 'vase',
    name: 'Copper-red pear-shaped vase',
    zh: '霁红玉壶春',
    mid: 0.7,
    half: 0.042,
    body: 'thin',
    praise: 'Red like cinnabar just set. One in ten firings, at best.',
    overNote: 'The copper burned off. A ring of white is all that is left.',
    underNote: 'Dull and brown, like yesterday’s liver.',
    culture:
      'Sacrificial red is coloured by copper and needs a reduction atmosphere: ten kilns, nine failures. The Chinese name literally means "after the rain".',
  },
];

/** Which ware the rotation serves on a given day key. */
export function wareIndexForDay(key: string): number {
  const day = Math.floor((Date.parse(`${key}T00:00:00Z`) - ROTATION_EPOCH_UTC) / DAY_MS);
  const n = WARES.length;
  return ((day % n) + n) % n;
}

export function wareForDay(key: string): WareDef {
  return WARES[wareIndexForDay(key)] ?? (WARES[0] as WareDef);
}

export function nextWareForDay(key: string): WareDef {
  const i = wareIndexForDay(key);
  return WARES[(i + 1) % WARES.length] ?? (WARES[0] as WareDef);
}

/**
 * The fire the kiln is scheduled to run today. The player has to hold this;
 * the chamber they choose decides what this fire does to their clay.
 */
export type DaySpec = {
  key: string;
  /** UTC midnight of this day, ms. */
  startsAt: number;
  ware: WareDef;
  /** Peak of the schedule, 0.42..0.70. */
  peak: number;
  shape: 'steady' | 'rush' | 'slow';
  /** Eight absolute targets, one per three seconds. */
  curve: number[];
  /** Human line printed under the chart. */
  schedule: string;
};

const SHAPES: Record<DaySpec['shape'], readonly number[]> = {
  steady: [0.14, 0.3, 0.48, 0.68, 0.86, 1, 1, 1],
  rush: [0.24, 0.5, 0.74, 0.9, 1, 1, 1, 1],
  slow: [0.1, 0.2, 0.34, 0.5, 0.7, 0.88, 1, 1],
};

const SCHEDULE_LINE: Record<DaySpec['shape'], string> = {
  steady: 'Even climb, long soak.',
  rush: 'Fast climb, early soak — thin bodies hate this one.',
  slow: 'Slow start, late peak. Patience pays.',
};

export function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayStartsAt(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

export function addDays(key: string, n: number): string {
  return new Date(dayStartsAt(key) + n * DAY_MS).toISOString().slice(0, 10);
}

export function specForDay(key: string): DaySpec {
  const ware = wareForDay(key);
  const rand = mulberry32(hash32(`kiln:${key}`));

  // Keep the schedule reachable: the slowest-firing chamber still has to be
  // able to land this ware somewhere, and the hottest must be able to overfire it.
  const low = Math.max(0.42, ware.mid / 1.22);
  const high = Math.min(0.7, ware.mid / 0.8);
  const peak = clamp(low + (high - low) * rand(), 0.4, 0.72);

  const shapes: DaySpec['shape'][] = ['steady', 'rush', 'slow'];
  const shape = shapes[Math.floor(rand() * 3)] ?? 'steady';
  const form = SHAPES[shape];

  return {
    key,
    startsAt: dayStartsAt(key),
    ware,
    peak,
    shape,
    curve: form.map((f) => f * peak),
    schedule: SCHEDULE_LINE[shape],
  };
}
