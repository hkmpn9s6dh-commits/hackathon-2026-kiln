import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { autopilot, idleTrace, roaringTrace } from './autopilot.ts';
import { specForDay } from './daily.ts';
import { evaluate } from './evaluate.ts';
import { ROUND_SECONDS, createFire, readTrace, stepFire, targetAt } from './fire.ts';
import { F_MAX, F_MIN, factorAt } from './kiln.ts';

const CURVE = [0.06, 0.14, 0.26, 0.4, 0.56, 0.7, 0.74, 0.74];

test('the fire starts cold and stays cold when nobody feeds it', () => {
  const fire = createFire();
  for (let i = 0; i < 100; i++) stepFire(fire, 0.1);
  assert.equal(fire.temp, 0);
  assert.equal(fire.fuel, 0);
});

test('a fully fed fire settles just under the kiln ceiling', () => {
  const fire = createFire();
  for (let i = 0; i < 600; i++) {
    fire.feeding = true;
    stepFire(fire, 0.05);
  }
  assert.ok(fire.temp > 0.72 && fire.temp < 0.76, `settled at ${fire.temp}`);
});

test('the schedule is linear between its eight points and clamps outside', () => {
  assert.equal(targetAt(CURVE, 0), 0.06);
  assert.ok(Math.abs(targetAt(CURVE, 1.5) - (0.06 + (0.08 * 1.5) / 3)) < 1e-9);
  assert.equal(targetAt(CURVE, 21), 0.74);
  assert.equal(targetAt(CURVE, 99), 0.74);
  assert.equal(targetAt(CURVE, -5), 0.06);
});

test('a clean firing reads its peak off the soak, not off a lucky spike', () => {
  const { samples, trace } = autopilot(CURVE);
  assert.ok(samples.length > 300, 'the trace is dense');
  assert.ok(Math.abs(trace.peak - 0.74) < 0.03, `peak ${trace.peak}`);
  assert.ok(trace.stress < 0.6, `stress ${trace.stress}`);
  assert.ok(trace.inBand > ROUND_SECONDS * 0.4, `in band ${trace.inBand}`);
});

test('an empty trace cannot be read as a good firing', () => {
  const trace = readTrace([], CURVE);
  assert.equal(trace.peak, 0);
  assert.equal(trace.stress, 0);
});

test('the same trace always reads the same way', () => {
  const a = autopilot(CURVE);
  const b = autopilot(CURVE);
  assert.deepEqual(a.trace, b.trace);
});

test('the kiln is hotter at the fire mouth and hotter up high', () => {
  assert.ok(factorAt(0.02, 0.5) > factorAt(0.98, 0.5));
  assert.ok(factorAt(0.5, 0.02) > factorAt(0.5, 0.98));
  assert.ok(factorAt(0, 0) <= F_MAX + 1e-9);
  assert.ok(factorAt(1, 1) >= F_MIN - 1e-9);
});

test('a careful firing in the right place is Fine; a lazy one never is', () => {
  const spec = specForDay('2026-11-16');
  const curve = spec.curve;

  const good = autopilot(curve);
  let best = 0;
  for (let x = 0; x <= 1; x += 0.01) {
    for (let y = 0; y <= 1; y += 0.01) {
      const o = evaluate({ ware: spec.ware, factor: factorAt(x, y), trace: good.trace, flambeRoll: 1 });
      if (o.score > best) best = o.score;
    }
  }
  assert.ok(best >= 80, `best careful firing scored ${best}`);

  const idled = evaluate({ ware: spec.ware, factor: 1, trace: idleTrace(curve), flambeRoll: 1 });
  assert.ok(idled.score <= 10, `idle scored ${idled.score}`);

  const roared = evaluate({ ware: spec.ware, factor: 1, trace: roaringTrace(curve), flambeRoll: 1 });
  assert.ok(roared.score <= 40, `roaring scored ${roared.score}`);
});

test('every day of the first ninety has a place where the ware lands true', () => {
  const start = Date.parse('2026-11-01T00:00:00Z');
  for (let i = 0; i < 90; i++) {
    const key = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const spec = specForDay(key);
    const need = spec.ware.mid / spec.peak;
    assert.ok(
      need >= F_MIN && need <= F_MAX,
      `${key}: ${spec.ware.id} needs factor ${need.toFixed(3)}, kiln spans ${F_MIN}–${F_MAX}`,
    );
  }
});
