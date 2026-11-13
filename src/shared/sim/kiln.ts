/**
 * Kiln geometry — ported from 把桩 (AME-1345), re-read for a one-round daily
 * game.
 *
 * A wood kiln is not an oven: it is a long chamber with the firebox at one end
 * and the chimney at the other, so the same firing lands differently depending
 * on where your pot stands. In 把桩 you chose one of twelve setters' chambers.
 * In KILN you drag the pot anywhere inside the chamber, because a daily round
 * has room for one continuous decision, not twelve discrete ones — and because
 * the crowd is what turns a free choice into a problem.
 *
 * Heat is a continuous field: fire mouth (x = 0) is hottest, flue (x = 1) is
 * coolest, upper shelves run hotter than the floor. Crowding stays discrete:
 * pots are counted in the twelve setters' cells they land in.
 */

export const COLS = 3;
export const ROWS = 4;
export const CELLS = COLS * ROWS;

/** Fire mouth (hot) → body → flue (cool). */
export const COL_F = [1.16, 1.0, 0.86] as const;
/** Upper shelves run hotter than the floor of a chamber. */
export const ROW_F = [1.06, 1.0, 0.94, 0.88] as const;

export const COL_NAMES = ['Fire mouth', 'Body', 'Flue'] as const;
export const COL_ZH = ['窑头', '窑身', '窑尾'] as const;
export const ROW_NAMES = ['Top', 'Upper', 'Lower', 'Floor'] as const;
export const ROW_ZH = ['上', '中', '下', '底'] as const;

/** Pots still block each other's draft: every extra pot costs the cell heat. */
export const CROWD_STEP = 0.008;
export const CROWD_MAX = 0.05;
/** A full kiln is a cold kiln — the day's whole load costs everyone a little. */
export const LOAD_STEP = 0.0005;
export const LOAD_MAX = 0.03;
export const LOAD_FULL = 50;

export const F_MIN = 0.86 * 0.88;
export const F_MAX = 1.16 * 1.06;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function piecewise(table: readonly number[], u: number): number {
  const n = table.length;
  const x = Math.min(1, Math.max(0, u)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  return lerp(table[i] ?? 1, table[i + 1] ?? 1, f);
}

/** Position 0..1 across the chamber. 0 = fire mouth, 1 = flue. */
export function factorAt(x: number, y: number): number {
  return piecewise(COL_F, x) * piecewise(ROW_F, y);
}

export function cellOf(x: number, y: number): number {
  const col = Math.min(COLS - 1, Math.max(0, Math.floor(x * COLS)));
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor(y * ROWS)));
  return col * ROWS + row;
}

export function cellCenter(i: number): { x: number; y: number } {
  const col = Math.floor(i / ROWS);
  const row = i % ROWS;
  return { x: (col + 0.5) / COLS, y: (row + 0.5) / ROWS };
}

export function cellLabel(i: number): string {
  const col = Math.floor(i / ROWS);
  const row = i % ROWS;
  return `${COL_NAMES[col] ?? ''} · ${ROW_NAMES[row] ?? ''}`;
}

export function cellLabelZh(i: number): string {
  const col = Math.floor(i / ROWS);
  const row = i % ROWS;
  return `${COL_ZH[col] ?? ''}${ROW_ZH[row] ?? ''}`;
}

/** 0 pots → 1.0, 1 pot → 0.992, 6+ pots → 0.95. Never worse than 5%. */
export function crowdMultiplier(pots: number): number {
  return 1 - Math.min(CROWD_MAX, CROWD_STEP * Math.max(0, Math.floor(pots)));
}

/** The day's total load: a packed kiln runs cold for everybody, capped at 4%. */
export function loadMultiplier(totalPots: number): number {
  return 1 - Math.min(LOAD_MAX, LOAD_STEP * Math.max(0, Math.floor(totalPots)));
}

/** The factor a pot actually feels: where it stands, then who is packed around it. */
export function effectiveFactor(
  x: number,
  y: number,
  cellPots: number,
  totalPots: number = 0,
): number {
  return factorAt(x, y) * crowdMultiplier(cellPots) * loadMultiplier(totalPots);
}

export type Fit = 'over' | 'fit' | 'under';

/** Where this spot lands a pot if the fire follows the day's curve exactly. */
export function forecast(firePeak: number, factor: number, mid: number, half: number): Fit {
  const eff = firePeak * factor;
  if (eff > mid + half) return 'over';
  if (eff < mid - half) return 'under';
  return 'fit';
}
