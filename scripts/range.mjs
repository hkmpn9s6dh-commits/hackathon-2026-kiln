import { makeKiln, STOKE_MIN, STOKE_MAX } from '../src/shared/kiln.ts';
let lo = 1e9;
let hi = -1e9;
for (let d = 0; d < 730; d += 1) {
  const day = new Date(Date.UTC(2026, 10, 1) + d * 86400000).toISOString().slice(0, 10);
  const k = makeKiln(day);
  for (const s of k.slots) {
    lo = Math.min(lo, s.base);
    hi = Math.max(hi, s.base);
  }
}
console.log('base', lo, hi);
console.log('lowest temp reachable', lo + 3 * STOKE_MIN, ' highest', hi + 3 * STOKE_MAX);
