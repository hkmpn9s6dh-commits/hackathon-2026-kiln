import { makeKiln, idealStoke, CROWD_PENALTY } from '../src/shared/kiln.ts';
const k = makeKiln('2027-10-20');
console.log('variant', k.variant, 'wares', k.wares.map((w) => `${w.id}:${w.ideal}`).join(','));
for (const s of k.slots) {
  const st = idealStoke({ ideal: 1176 }, s, 0);
  console.log(s.id, 'base', s.base, 'stoke', st, 'temp', s.base + st - CROWD_PENALTY * 0, 'delta', s.base + st - 1176);
}
