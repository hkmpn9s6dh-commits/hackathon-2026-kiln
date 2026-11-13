import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { addDays, dayKeyOf, nextWareForDay, specForDay, WARES, wareForDay } from './daily.ts';
import { evaluate, flambeRollFor } from './evaluate.ts';
import { autopilot } from './autopilot.ts';
import { CROWD_MAX, LOAD_MAX, crowdMultiplier, loadMultiplier } from './kiln.ts';

test('a day is the same day for everybody, however often it is asked', () => {
  const a = specForDay('2026-11-20');
  const b = specForDay('2026-11-20');
  assert.deepEqual(a, b);
  assert.equal(a.curve.length, 8);
  assert.equal(Math.max(...a.curve), Math.max(...a.curve.map((v) => v)));
  assert.ok(Math.abs(Math.max(...a.curve) - a.peak) < 1e-9);
});

test('day keys are UTC, and roll over at midnight UTC', () => {
  assert.equal(dayKeyOf(new Date('2026-11-14T23:59:59Z')), '2026-11-14');
  assert.equal(dayKeyOf(new Date('2026-11-15T00:00:00Z')), '2026-11-15');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('the rotation serves all six wares before repeating one', () => {
  const seen = new Set<string>();
  for (let i = 0; i < WARES.length; i++) seen.add(wareForDay(addDays('2026-11-11', i)).id);
  assert.equal(seen.size, WARES.length);
  assert.equal(wareForDay(addDays('2026-11-11', WARES.length)).id, wareForDay('2026-11-11').id);
});

test('tomorrow is advertised honestly', () => {
  const key = '2026-11-14';
  assert.equal(nextWareForDay(key).id, wareForDay(addDays(key, 1)).id);
});

test('the crowd costs a little and the load costs a little, both capped', () => {
  assert.equal(crowdMultiplier(0), 1);
  assert.ok(crowdMultiplier(4) < 1);
  assert.ok(crowdMultiplier(400) >= 1 - CROWD_MAX - 1e-9);
  assert.equal(loadMultiplier(0), 1);
  assert.ok(loadMultiplier(500) >= 1 - LOAD_MAX - 1e-9);
});

test('a perfect placement and a perfect fire make a Fine piece', () => {
  for (let i = 0; i < 30; i++) {
    const key = addDays('2026-11-11', i);
    const spec = specForDay(key);
    const { trace } = autopilot(spec.curve);
    const factor = spec.ware.mid / spec.peak;
    const o = evaluate({ ware: spec.ware, factor, trace, flambeRoll: 1 });
    // Fine is 74; a careful stoker in the right spot always gets there.
    assert.ok(o.score >= 74, `${key} ${spec.ware.id}: ${o.verdict} ${o.score}`);
  }
});

test('the flambé roll is per player per day and never in the way of a bad piece', () => {
  const a = flambeRollFor('2026-11-14', 't2_alice');
  const b = flambeRollFor('2026-11-14', 't2_alice');
  const c = flambeRollFor('2026-11-14', 't2_bob');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a >= 0 && a < 1);

  const spec = specForDay('2026-11-14');
  const { trace } = autopilot(spec.curve);
  const wild = evaluate({ ware: spec.ware, factor: 1.6, trace, flambeRoll: 0 });
  assert.equal(wild.flambe, false);
  assert.ok(wild.score < 40);
});

test('a thin body cracks when the fire is slammed into it', () => {
  const spec = specForDay('2026-11-11');
  const thin = spec.ware.body === 'thin' ? spec.ware : WARES.find((w) => w.body === 'thin');
  assert.ok(thin);
  const trace = { peak: thin.mid, stress: 0, shock: 6, inBand: 20, duration: 24 };
  const o = evaluate({ ware: thin, factor: 1, trace, flambeRoll: 1 });
  assert.equal(o.verdict, 'cracked');
});
