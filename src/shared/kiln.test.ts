import { describe, expect, it } from 'vitest';

import {
  COLLECTIVE_BONUS,
  CROWD_PENALTY,
  FINE_BAND,
  GRADE_LABEL,
  SOUND_BAND,
  STOKE_MAX,
  STOKE_MIN,
  WARE_LIB,
  ZONES,
  clamp01,
  collectiveOf,
  commitPiece,
  dayKeyOf,
  emptyCounts,
  explain,
  finalScore,
  forecast,
  gradeOf,
  hash32,
  hoursUntilNextDay,
  idealStoke,
  makeKiln,
  pointsOf,
  previousDayKey,
  shortDelta,
  stokeOf,
  streakBonus,
} from './kiln';
import type { CommitResult, Kiln } from './kiln';

const DAY = '2026-11-14';

function daysFrom(start: string, count: number): string[] {
  const out: string[] = [];
  let t = Date.parse(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

describe('the daily kiln', () => {
  it('is the same kiln for everyone on the same day', () => {
    const a = makeKiln(DAY);
    const b = makeKiln(DAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.day).toBe(DAY);
    expect(a.seed).toBe(hash32(`kiln:${DAY}`));
  });

  it('changes from one day to the next', () => {
    const a = makeKiln('2026-11-14');
    const b = makeKiln('2026-11-15');
    expect(a.slots.map((s) => s.base).join()).not.toBe(b.slots.map((s) => s.base).join());
  });

  it('always offers nine slots across three zones and three wares', () => {
    for (const day of daysFrom(DAY, 60)) {
      const kiln = makeKiln(day);
      expect(kiln.slots).toHaveLength(9);
      expect(new Set(kiln.slots.map((s) => s.id)).size).toBe(9);
      expect(new Set(kiln.slots.map((s) => s.zone))).toEqual(new Set(ZONES));
      expect(kiln.wares).toHaveLength(3);
      expect(new Set(kiln.wares.map((w) => w.id)).size).toBe(3);
      for (const ware of kiln.wares) {
        expect(WARE_LIB.map((w) => w.id)).toContain(ware.id);
      }
    }
  });

  it('keeps slot temperatures in a believable range', () => {
    for (const day of daysFrom(DAY, 90)) {
      for (const slot of makeKiln(day).slots) {
        expect(slot.base).toBeGreaterThan(1170);
        expect(slot.base).toBeLessThan(1345);
      }
    }
  });
});

describe('solvability', () => {
  // The hard invariant: every ware on every day can still be pulled off,
  // even when three other pieces are already sitting in the same zone.
  it('lets every offered ware reach the fine band, alone and crowded', () => {
    const failures: string[] = [];
    for (const day of daysFrom(DAY, 365)) {
      const kiln = makeKiln(day);
      for (const ware of kiln.wares) {
        for (const crowd of [0, 3]) {
          const best = kiln.slots
            .map((slot) => Math.abs(ware.ideal - (slot.base + idealStoke(ware, slot, crowd) - CROWD_PENALTY * crowd)))
            .reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
          if (best > FINE_BAND) failures.push(`${day} ${ware.id} crowd=${crowd} best=${best}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('never promises a fine piece it cannot deliver', () => {
    for (const day of daysFrom(DAY, 120)) {
      const kiln = makeKiln(day);
      for (const ware of kiln.wares) {
        for (const slot of kiln.slots) {
          for (const crowd of [0, 1, 2, 3]) {
            const { forecast: f } = forecast(ware, slot, crowd);
            const reachable =
              Math.abs(ware.ideal - (slot.base + idealStoke(ware, slot, crowd) - CROWD_PENALTY * crowd)) <= FINE_BAND;
            expect(f === 'fine').toBe(reachable);
          }
        }
      }
    }
  });
});

describe('stoking', () => {
  it('gives nothing for a dead tap and the most for a perfect one', () => {
    expect(stokeOf([0, 0, 0])).toBe(STOKE_MIN * 3);
    expect(stokeOf([1, 1, 1])).toBe(STOKE_MAX * 3);
    expect(stokeOf([0.5, 0.5, 0.5])).toBe(9);
  });

  it('ignores junk from the client', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(9)).toBe(1);
    expect(stokeOf([Number.NaN, 5, -3])).toBe(STOKE_MIN + STOKE_MAX + STOKE_MIN);
  });
});

describe('grading', () => {
  it('uses the fine band, then the sound band, then the shoulders', () => {
    expect(gradeOf(0)).toBe('fine');
    expect(gradeOf(FINE_BAND)).toBe('fine');
    expect(gradeOf(FINE_BAND + 1)).toBe('sound');
    expect(gradeOf(SOUND_BAND)).toBe('sound');
    expect(gradeOf(SOUND_BAND + 1)).toBe('over');
    expect(gradeOf(-(SOUND_BAND + 1))).toBe('under');
  });

  it('ranks the grades in the order the shelf does', () => {
    expect(pointsOf('transmuted')).toBeGreaterThan(pointsOf('fine'));
    expect(pointsOf('fine')).toBeGreaterThan(pointsOf('sound'));
    expect(pointsOf('sound')).toBeGreaterThan(pointsOf('under'));
    expect(pointsOf('under')).toBeGreaterThan(pointsOf('over'));
    for (const grade of ['transmuted', 'fine', 'sound', 'under', 'over'] as const) {
      expect(GRADE_LABEL[grade].length).toBeGreaterThan(3);
    }
  });
});

describe('committing a piece', () => {
  // A hand-built kiln, so these tests measure the rules and not today's dice.
  const fixture: Kiln = {
    day: DAY,
    seed: 1,
    variant: 'clear',
    variantLine: '',
    wares: [
      { id: 'jar', name: 'Blue-and-white jar', ideal: 1250, form: 'jar', glaze: '#7E9BD1', line: '' },
      { id: 'vase', name: 'Shadow-blue vase', ideal: 1300, form: 'vase', glaze: '#A9C6E8', line: '' },
    ],
    slots: [
      { id: 'mouth-0', zone: 'mouth', row: 0, base: 1310 },
      { id: 'body-0', zone: 'body', row: 0, base: 1250 },
      { id: 'tail-0', zone: 'tail', row: 0, base: 1200 },
    ],
  };

  function tapsFor(stoke: number): number[] {
    const perTap = (stoke / 3 - STOKE_MIN) / (STOKE_MAX - STOKE_MIN);
    return [perTap, perTap, perTap];
  }

  it('recomputes the same numbers the hint promised', () => {
    const result = commitPiece({
      kiln: fixture,
      wareId: 'jar',
      slotId: 'body-0',
      taps: tapsFor(0),
      crowd: 0,
      userId: 'u1',
    });
    expect(result.stoke).toBe(0);
    expect(result.temp).toBe(1250);
    expect(result.delta).toBe(0);
    expect(result.grade).toBe('fine');
  });

  it('takes CROWD_PENALTY off for every piece already in the zone', () => {
    const alone = commitPiece({ kiln: fixture, wareId: 'jar', slotId: 'body-0', taps: tapsFor(0), crowd: 0, userId: 'u1' });
    const crowded = commitPiece({ kiln: fixture, wareId: 'jar', slotId: 'body-0', taps: tapsFor(0), crowd: 2, userId: 'u1' });
    expect(alone.temp - crowded.temp).toBe(CROWD_PENALTY * 2);
    expect(crowded.grade).toBe('sound');
  });

  it('lets stoking rescue a cold shelf and ruin a good one', () => {
    const cold = commitPiece({ kiln: fixture, wareId: 'vase', slotId: 'tail-0', taps: tapsFor(30), crowd: 0, userId: 'u1' });
    expect(cold.temp).toBe(1230);
    expect(cold.grade).toBe('under');

    const hot = commitPiece({ kiln: fixture, wareId: 'jar', slotId: 'mouth-0', taps: tapsFor(30), crowd: 0, userId: 'u1' });
    expect(hot.grade).toBe('over');
  });

  it('only transmutes a fine piece in the kiln body, and only for some people', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      const result = commitPiece({
        kiln: fixture,
        wareId: 'jar',
        slotId: 'body-0',
        taps: tapsFor(0),
        crowd: 0,
        userId: `user-${i}`,
      });
      expect(result.grade === 'transmuted' ? result.transmuted : true).toBe(true);
      if (result.transmuted) seen.add('yes');
    }
    expect(seen.size).toBe(1);
  });

  it('never transmutes outside the body', () => {
    for (const slotId of ['mouth-0', 'tail-0']) {
      for (let i = 0; i < 60; i += 1) {
        const result = commitPiece({
          kiln: fixture,
          wareId: 'jar',
          slotId,
          taps: tapsFor(0),
          crowd: 0,
          userId: `user-${i}`,
        });
        expect(result.transmuted).toBe(false);
      }
    }
  });

  it('rejects a ware or a slot that is not in today’s kiln', () => {
    expect(() => commitPiece({ kiln: fixture, wareId: 'nope', slotId: 'mouth-0', taps: [1, 1, 1], crowd: 0, userId: 'u' })).toThrow();
    expect(() => commitPiece({ kiln: fixture, wareId: 'jar', slotId: 'nope', taps: [1, 1, 1], crowd: 0, userId: 'u' })).toThrow();
  });
});

describe('the shared load', () => {
  it('is balanced only when the zones are within one piece of each other', () => {
    expect(collectiveOf({ mouth: 2, body: 2, tail: 2 }).balanced).toBe(true);
    expect(collectiveOf({ mouth: 3, body: 2, tail: 2 }).balanced).toBe(true);
    expect(collectiveOf({ mouth: 4, body: 2, tail: 2 }).balanced).toBe(false);
    expect(collectiveOf({ mouth: 1, body: 1, tail: 1 }).balanced).toBe(true);
    expect(collectiveOf({ mouth: 0, body: 0, tail: 0 }).balanced).toBe(false);
    expect(collectiveOf({ mouth: 1, body: 1, tail: 0 }).balanced).toBe(false);
    expect(collectiveOf(emptyCounts()).total).toBe(0);
  });

  it('always says something true', () => {
    expect(collectiveOf({ mouth: 0, body: 0, tail: 0 }).line).toMatch(/empty/i);
    expect(collectiveOf({ mouth: 5, body: 1, tail: 1 }).line).toMatch(/fire mouth/i);
    expect(collectiveOf({ mouth: 1, body: 1, tail: 5 }).line).toMatch(/tail/i);
    expect(collectiveOf({ mouth: 3, body: 3, tail: 3 }).line).toMatch(/spread/i);
  });
});

describe('scoring', () => {
  const fine: CommitResult = {
    ware: WARE_LIB[0]!,
    slot: { id: 'body-1', zone: 'body', row: 1, base: 1266 },
    stoke: 0,
    temp: 1266,
    ideal: 1266,
    delta: 0,
    grade: 'fine',
    transmuted: false,
    score: pointsOf('fine'),
  };

  it('adds the shared bonus and the streak, and caps the streak', () => {
    expect(finalScore(fine, false, 0)).toBe(pointsOf('fine'));
    expect(finalScore(fine, true, 0)).toBe(pointsOf('fine') + COLLECTIVE_BONUS);
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(7)).toBe(42);
    expect(streakBonus(30)).toBe(42);
    expect(finalScore(fine, true, 30)).toBe(pointsOf('fine') + COLLECTIVE_BONUS + 42);
  });
});

describe('the clock the kiln runs on', () => {
  it('rolls at midnight UTC', () => {
    expect(dayKeyOf(new Date('2026-11-14T23:59:59Z'))).toBe('2026-11-14');
    expect(dayKeyOf(new Date('2026-11-15T00:00:01Z'))).toBe('2026-11-15');
    expect(hoursUntilNextDay(new Date('2026-11-14T22:00:00Z'))).toBeCloseTo(2, 5);
    expect(hoursUntilNextDay(new Date('2026-11-14T00:00:00Z'))).toBeCloseTo(24, 5);
  });

  it('knows the day before, across months and years', () => {
    expect(previousDayKey('2026-11-01')).toBe('2026-10-31');
    expect(previousDayKey('2027-01-01')).toBe('2026-12-31');
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
  });
});

describe('the words on screen', () => {
  it('explains a firing without a stray NaN', () => {
    const kiln = makeKiln(DAY);
    const ware = kiln.wares[0];
    if (!ware) throw new Error('bad fixture');
    const result = commitPiece({ kiln, wareId: ware.id, slotId: 'body-1', taps: [0.4, 0.7, 1], crowd: 1, userId: 'u' });
    const text = explain(result, 1);
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
    expect(text).toMatch(/°C/);
    expect(shortDelta(0)).toBe('dead on');
    expect(shortDelta(12)).toBe('+12°C');
    expect(shortDelta(-3)).toBe('-3°C');
  });
});
