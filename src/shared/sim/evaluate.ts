/**
 * What comes out of the kiln. Ported from 把桩's evaluate.ts: same idea — the
 * ware has a band, the chamber multiplies the fire, and the piece lands where
 * the product falls — with the firing quality folded in, because a daily round
 * has no second kiln to make up for a bad one.
 */

import type { Outcome, Verdict, WareDef } from '../types.ts';
import { ROUND_SECONDS, type FireTrace } from './fire.ts';
import { clamp } from './math.ts';

export const FLAMBE_CHANCE = 0.15;

export type EvaluateInput = {
  ware: WareDef;
  /** Chamber geometry × crowding, already multiplied. */
  factor: number;
  trace: FireTrace;
  /** 0..1, deterministic per (day, player). */
  flambeRoll?: number;
};

/** How much the fire wandered, 0..1. A clean firing is under ~0.03. */
export function wanderOf(trace: FireTrace): number {
  return trace.stress / ROUND_SECONDS;
}

export function evaluate(input: EvaluateInput): Outcome {
  const { ware, factor, trace } = input;
  const eff = trace.peak * factor;
  // Quadratic tolerance: forgiving near the middle of the band, unforgiving at its edge.
  // A linear falloff made a 1% firing error cost a whole grade, which felt like a bug.
  const closeness = 1 - Math.pow(Math.abs(eff - ware.mid) / ware.half, 2);

  if (closeness <= 0) {
    const over = eff > ware.mid;
    return {
      verdict: over ? 'over' : 'under',
      quality: 0,
      score: over ? 4 : 6,
      eff,
      note: over ? ware.overNote : ware.underNote,
      flambe: false,
    };
  }

  const wander = wanderOf(trace);
  const shockShare = trace.shock / ROUND_SECONDS;
  const steadiness = 1 - Math.min(0.45, wander * 2 + shockShare * 1.5);
  const quality = clamp(closeness * steadiness, 0, 1);

  const cracked = ware.body === 'thin' && trace.shock > 1.1 && eff > ware.mid - ware.half;
  if (cracked) {
    return {
      verdict: 'cracked',
      quality,
      score: Math.round(quality * 40),
      eff,
      note: 'A hairline ran through it as it cooled. You heard it happen.',
      flambe: false,
    };
  }

  const roll = input.flambeRoll ?? 1;
  if (quality >= 0.9 && roll < FLAMBE_CHANCE) {
    return {
      verdict: 'flambe',
      quality,
      score: 100,
      eff,
      note: 'The reduction went its own way. Red under green, unrepeatable — a flambé.',
      flambe: true,
    };
  }

  const verdict: Verdict = quality >= 0.74 ? 'excellent' : 'good';
  return {
    verdict,
    quality,
    score: Math.round(quality * 100),
    eff,
    note: verdict === 'excellent' ? ware.praise : 'Sound, and forgettable.',
    flambe: false,
  };
}

/** Deterministic roll in [0,1) for one player on one day. */
export function flambeRollFor(dayKey: string, player: string): number {
  let h = 0x811c9dc5;
  const s = `${dayKey}|${player}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h >>> 8) % 1000) / 1000;
}
