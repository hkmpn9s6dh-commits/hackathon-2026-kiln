/**
 * The fire — ported from 把桩 (AME-1345).
 *
 * 把桩 ran a twelve-时辰 night. KILN runs one firing you can finish in a coffee
 * break, so the same first-order model is re-tuned to a shorter time constant
 * and a shorter round. What survives the port is the shape of the problem:
 * fuel is inertia, the pot only feels what the flame did a moment ago, and a
 * thin body cracks if you slam heat into it.
 *
 *   burn  = min(1, fuel) * FLOW
 *   fuel += (feeding ? FEED : 0) * dt - burn * BURN * dt
 *   temp += (burn * GAIN - (LOSS * temp + BASE)) * dt
 *
 * With fuel at the cap the fire settles at GAIN * FLOW - BASE, over LOSS:
 *   0.558 * 0.77 - 0.06 = 0.3696 over 0.5  →  0.739
 * so the ceiling of the kiln is ~0.74 and every daily target sits below it.
 */

import type { FireSample } from '../types.ts';
import { clamp } from './math.ts';

export const ROUND_SECONDS = 24;
export const SEGMENTS = 8;
export const SEGMENT_SECONDS = ROUND_SECONDS / SEGMENTS;

/** Half-width of the band the fire is allowed to wander before it costs you. */
export const BAND = 0.055;
/** °/s above which a hot fire is shocking the clay. */
export const SHOCK_RATE = 0.13;
/** Shock only matters once the ware is glowing. */
export const SHOCK_TEMP = 0.4;

const FLOW = 0.77;
const MAX_FUEL = 1.2;
const FEED_PER_SEC = 0.85;
const BURN_PER_SEC = 0.5;
const GAIN = 0.558;
const LOSS = 0.5;
const BASE = 0.06;

export type FireState = {
  /** Seconds since the round started. */
  t: number;
  /** 0..1.05 */
  temp: number;
  /** 0..1.2 */
  fuel: number;
  feeding: boolean;
};

export function createFire(): FireState {
  return { t: 0, temp: 0, fuel: 0, feeding: false };
}

/** Advance the fire by `dt` seconds. Mutates `s`; returns nothing to hide state. */
export function stepFire(s: FireState, dt: number): void {
  const burn = Math.min(1, s.fuel) * FLOW;
  const feed = s.feeding ? FEED_PER_SEC : 0;
  s.fuel = clamp(s.fuel + (feed - burn * BURN_PER_SEC) * dt, 0, MAX_FUEL);
  s.temp = clamp(s.temp + (burn * GAIN - (LOSS * s.temp + BASE)) * dt, 0, 1.05);
  s.t += dt;
}

/** The day's curve, in seconds. Piecewise linear between its eight points. */
export function targetAt(curve: readonly number[], t: number): number {
  const raw = clamp(t, 0, ROUND_SECONDS) / SEGMENT_SECONDS;
  const i = Math.min(curve.length - 1, Math.floor(raw));
  const frac = raw - i;
  const a = curve[i] ?? 0;
  const b = curve[Math.min(curve.length - 1, i + 1)] ?? a;
  return a + (b - a) * frac;
}

export type FireTrace = {
  /** Heat the pot actually sat at during the soak — what the glaze records. */
  peak: number;
  /** Accumulated seconds-degrees outside the band. */
  stress: number;
  /** Seconds spent heating faster than a body can take. */
  shock: number;
  /** Seconds spent inside the band. */
  inBand: number;
  duration: number;
};

const SOAK_SECONDS = 8;

/**
 * Read a firing back out of its raw trace. The server runs this on what the
 * client sent, so a score is always a recount of a trace and never a number
 * the client made up.
 */
export function readTrace(samples: readonly FireSample[], curve: readonly number[]): FireTrace {
  if (samples.length === 0) {
    return { peak: 0, stress: 0, shock: 0, inBand: 0, duration: 0 };
  }

  let stress = 0;
  let shock = 0;
  let inBand = 0;
  let duration = 0;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if (!prev || !cur) continue;
    const dt = clamp(cur.t - prev.t, 0, 0.5);
    if (dt <= 0) continue;
    duration = Math.max(duration, cur.t);

    const off = Math.abs(cur.temp - targetAt(curve, cur.t));
    if (off > BAND) stress += (off - BAND) * dt;
    else inBand += dt;

    const rate = (cur.temp - prev.temp) / dt;
    if (cur.temp > SHOCK_TEMP && rate > SHOCK_RATE) shock += dt;
  }

  const soakStart = Math.max(0, duration - SOAK_SECONDS);
  const soak = samples.filter((s) => s.t >= soakStart);
  const peak = soak.length === 0 ? 0 : soak.reduce((a, s) => a + s.temp, 0) / soak.length;

  return { peak, stress, shock, inBand, duration };
}
