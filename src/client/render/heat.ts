/** Heat, as a colour. The whole visual language of the game is this ramp. */

export type Rgb = [number, number, number];

const STOPS: { at: number; c: Rgb }[] = [
  { at: 0.0, c: [26, 15, 10] },
  { at: 0.22, c: [74, 29, 14] },
  { at: 0.42, c: [140, 47, 14] },
  { at: 0.58, c: [201, 69, 26] },
  { at: 0.72, c: [239, 122, 37] },
  { at: 0.84, c: [247, 180, 85] },
  { at: 0.93, c: [255, 230, 168] },
  { at: 1.0, c: [255, 250, 240] },
];

export function heatRgb(t: number): Rgb {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1];
    const b = STOPS[i];
    if (!a || !b) break;
    if (x <= b.at) {
      const f = (x - a.at) / (b.at - a.at || 1);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * f),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * f),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * f),
      ];
    }
  }
  return STOPS[STOPS.length - 1]?.c ?? [255, 250, 240];
}

export function heatCss(t: number, alpha = 1): string {
  const [r, g, b] = heatRgb(t);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** The name a potter would use for what the fire is doing. */
export function fireName(temp: number): string {
  if (temp < 0.12) return 'dark';
  if (temp < 0.26) return 'dull red';
  if (temp < 0.4) return 'cherry';
  if (temp < 0.54) return 'orange';
  if (temp < 0.66) return 'gold';
  if (temp < 0.76) return 'white heat';
  return 'blinding';
}
