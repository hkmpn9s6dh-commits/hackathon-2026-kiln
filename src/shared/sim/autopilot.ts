/**
 * A reference player.
 *
 * Not shipped to Reddit — it exists so the simulator can be held to a promise:
 * a careful stoker, standing in the right place, can always make something
 * good, and a careless one cannot. The tests and `npm run sweep` both use it.
 */

import type { FireSample } from '../types.ts';
import { ROUND_SECONDS, createFire, readTrace, stepFire, targetAt, type FireTrace } from './fire.ts';

export type AutopilotOptions = {
  /** How far ahead of the schedule the stoker reads, in seconds. */
  lead?: number;
  /** Stoke when the pot is this far below the reading. */
  margin?: number;
  /** Seconds between decisions; models the human tap rate. */
  tick?: number;
  /** Fixed step of the fire integrator. */
  step?: number;
};

/** Play one firing and return both the raw trace and what it means. */
export function autopilot(
  curve: readonly number[],
  options: AutopilotOptions = {},
): { samples: FireSample[]; trace: FireTrace } {
  const lead = options.lead ?? 1.2;
  const margin = options.margin ?? 0.012;
  const tick = options.tick ?? 0.04;
  const step = options.step ?? 0.016;

  const fire = createFire();
  const samples: FireSample[] = [{ t: 0, temp: 0 }];
  let nextDecision = 0;
  let feeding = false;

  while (fire.t < ROUND_SECONDS) {
    if (fire.t >= nextDecision) {
      const read = targetAt(curve, Math.min(ROUND_SECONDS, fire.t + lead));
      feeding = fire.temp < read + margin;
      nextDecision = fire.t + tick;
    }
    fire.feeding = feeding;
    stepFire(fire, step);
    const last = samples[samples.length - 1];
    if (!last || fire.t - last.t >= 0.05) {
      samples.push({ t: Number(fire.t.toFixed(2)), temp: Number(fire.temp.toFixed(4)) });
    }
  }

  return { samples, trace: readTrace(samples, curve) };
}

/** A stoker who never touches the fire again after lighting it. */
export function idleTrace(curve: readonly number[]): FireTrace {
  return readTrace(
    Array.from({ length: 240 }, (_, i) => ({ t: (i / 240) * ROUND_SECONDS, temp: 0 })),
    curve,
  );
}

/** A stoker who keeps the firebox full and never looks at the schedule. */
export function roaringTrace(curve: readonly number[]): FireTrace {
  const fire = createFire();
  const samples: FireSample[] = [{ t: 0, temp: 0 }];
  while (fire.t < ROUND_SECONDS) {
    fire.feeding = true;
    stepFire(fire, 0.016);
    const last = samples[samples.length - 1];
    if (!last || fire.t - last.t >= 0.05) {
      samples.push({ t: Number(fire.t.toFixed(2)), temp: Number(fire.temp.toFixed(4)) });
    }
  }
  return readTrace(samples, curve);
}
