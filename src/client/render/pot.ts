/**
 * Porcelain, drawn procedurally. Ported from 把桩 (AME-1345) — same painter,
 * same idea: one object under one warm light, a real mouth you can see into,
 * a foot ring with its own shadow, and a painted band that survives at 50 px.
 *
 * The port added one thing: the glaze is a function of the heat the pot
 * actually reached, so a firing can be read off the object before the number.
 */

import type { WareDef, WareShape } from '../../shared/types.ts';

export type PotPaint = {
  /** 0..1, how hot this piece got; warms the clay and brightens the glaze. */
  heat?: number;
  over?: boolean;
  cracked?: boolean;
  flambe?: boolean;
  /** 0..1, how much light reaches it. Low inside the kiln. */
  dim?: number;
  /** Per-piece seed: hand-thrown things are never identical. */
  seed?: number;
  /** What the fire did to the glaze, before any grade is spoken. */
  mood?: 'under' | 'good' | 'over' | 'rare';
};

type Glaze = {
  deep: string;
  dark: string;
  mid: string;
  light: string;
  paint: string | null;
};

const GLAZE: Record<string, Glaze> = {
  yingqing: {
    deep: '#546b65',
    dark: '#9db4ac',
    mid: '#d7e7e0',
    light: '#fbfefc',
    paint: null,
  },
  qinghua: {
    deep: '#6f6a5c',
    dark: '#b3ab97',
    mid: '#e6dfcd',
    light: '#fffdf6',
    paint: '#2b4f9e',
  },
  jihong: {
    deep: '#3a0c06',
    dark: '#7d1d10',
    mid: '#b23a22',
    light: '#dd7355',
    paint: null,
  },
};

const RATIO: Record<WareShape, number> = { bowl: 1.38, jar: 0.86, vase: 0.62 };

export function potHeight(shape: WareShape, maxW: number, maxH: number): number {
  return Math.min(maxH, maxW / RATIO[shape]);
}

function halfProfile(shape: WareShape, w: number, t: number): number {
  if (shape === 'bowl') {
    const r = 1 - 0.5 * Math.pow(t, 2.6);
    const flare = t < 0.08 ? 0.03 * (1 - t / 0.08) : 0;
    return (w / 2) * (r + flare);
  }
  if (shape === 'jar') {
    return (w / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * (0.18 + 0.68 * t))), 0.46);
  }
  const belly = w / 2;
  if (t < 0.08) return belly * 0.3;
  if (t < 0.2) return belly * (0.3 - (0.14 * (t - 0.08)) / 0.12);
  if (t < 0.44) return belly * (0.16 + 0.84 * Math.sin(((t - 0.2) / 0.24) * Math.PI * 0.5));
  if (t < 0.8) return belly * (1 - (0.62 * (t - 0.44)) / 0.36);
  return belly * (0.38 - (0.12 * (t - 0.8)) / 0.2);
}

function bodyPath(ctx: CanvasRenderingContext2D, shape: WareShape, w: number, h: number): void {
  const n = 26;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = halfProfile(shape, w, t);
    const y = t * h;
    if (i === 0) ctx.moveTo(-r, y);
    else ctx.lineTo(-r, y);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const r = halfProfile(shape, w, t);
    ctx.lineTo(r, t * h);
  }
  ctx.closePath();
}

function cylinder(ctx: CanvasRenderingContext2D, g: Glaze, w: number): CanvasGradient {
  const grad = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
  grad.addColorStop(0, g.deep);
  grad.addColorStop(0.18, g.dark);
  grad.addColorStop(0.42, g.light);
  grad.addColorStop(0.6, g.mid);
  grad.addColorStop(0.86, g.dark);
  grad.addColorStop(1, g.deep);
  return grad;
}

function paintBand(
  ctx: CanvasRenderingContext2D,
  ware: WareDef,
  shape: WareShape,
  w: number,
  h: number,
  dim: number,
): void {
  const ink = GLAZE[ware.kind]?.paint ?? null;
  if (!ink) {
    ctx.strokeStyle = `rgba(96,126,118,${0.34 * dim})`;
    ctx.lineWidth = Math.max(0.7, h * 0.014);
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const spread = -0.42 + i * 0.105;
      ctx.beginPath();
      ctx.moveTo(w * spread * 0.5, h * 0.88);
      ctx.quadraticCurveTo(w * spread * 0.85, h * 0.74, w * spread * 1.02, h * 0.58);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, h * 0.9);
    ctx.quadraticCurveTo(0, h * 0.86, w * 0.44, h * 0.9);
    ctx.stroke();
    return;
  }

  const top = shape === 'bowl' ? 0.16 : 0.2;
  const bottom = shape === 'bowl' ? 0.72 : 0.76;
  ctx.fillStyle = `rgba(43,79,158,${0.8 * dim})`;
  ctx.fillRect(-w, h * top, w * 2, Math.max(1, h * 0.035));
  ctx.fillRect(-w, h * (top + 0.06), w * 2, Math.max(0.8, h * 0.018));
  ctx.fillRect(-w, h * bottom, w * 2, Math.max(1, h * 0.03));

  const y0 = h * ((top + bottom) / 2 + 0.02);
  ctx.strokeStyle = `rgba(43,79,158,${0.92 * dim})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, h * 0.03);
  ctx.beginPath();
  ctx.moveTo(-w * 0.62, y0 + h * 0.02);
  ctx.bezierCurveTo(-w * 0.3, y0 - h * 0.1, -w * 0.05, y0 + h * 0.1, w * 0.18, y0 - h * 0.02);
  ctx.bezierCurveTo(w * 0.38, y0 - h * 0.1, w * 0.5, y0 + h * 0.04, w * 0.62, y0 - h * 0.02);
  ctx.stroke();

  ctx.fillStyle = `rgba(43,79,158,${0.85 * dim})`;
  for (let i = 0; i < 5; i++) {
    const lx = -w * 0.46 + i * w * 0.24;
    const ly = y0 - h * 0.03 + (i % 2 ? h * 0.05 : -h * 0.04);
    ctx.beginPath();
    ctx.ellipse(lx, ly, w * 0.05, h * 0.028, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw a piece; `cy` is the foot. */
export function drawPot(
  ctx: CanvasRenderingContext2D,
  ware: WareDef,
  cx: number,
  cy: number,
  height: number,
  paint: PotPaint = {},
): void {
  const shape = ware.shape;
  const h = height;
  const w = height * RATIO[shape];
  const g = GLAZE[ware.kind] ?? (GLAZE.yingqing as Glaze);
  const dim = paint.dim ?? 1;

  ctx.save();
  ctx.translate(cx, cy - h);
  if (paint.seed !== undefined) {
    const tilt = (((paint.seed * 37) % 100) / 100 - 0.5) * 0.05;
    if (tilt) {
      ctx.translate(0, h);
      ctx.rotate(tilt);
      ctx.translate(0, -h);
    }
  }

  ctx.fillStyle = `rgba(0,0,0,${0.42 * dim})`;
  ctx.beginPath();
  ctx.ellipse(0, h + Math.max(0.5, h * 0.012), w * 0.34, Math.max(1.2, h * 0.026), 0, 0, Math.PI * 2);
  ctx.fill();

  bodyPath(ctx, shape, w, h);
  ctx.fillStyle = cylinder(ctx, g, w);
  ctx.fill();

  ctx.save();
  ctx.clip();

  const foot = ctx.createLinearGradient(0, h * 0.72, 0, h);
  foot.addColorStop(0, 'rgba(0,0,0,0)');
  foot.addColorStop(1, `rgba(0,0,0,${0.34 * dim})`);
  ctx.fillStyle = foot;
  ctx.fillRect(-w, h * 0.72, w * 2, h * 0.3);

  const core = ctx.createLinearGradient(w * 0.06, 0, w * 0.52, 0);
  core.addColorStop(0, 'rgba(0,0,0,0)');
  core.addColorStop(1, `rgba(24,34,32,${0.34 * dim})`);
  ctx.fillStyle = core;
  ctx.fillRect(-w, 0, w * 2, h);

  const near = ctx.createLinearGradient(-w * 0.5, 0, -w * 0.2, 0);
  near.addColorStop(0, `rgba(255,255,255,${0.34 * dim})`);
  near.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = near;
  ctx.fillRect(-w, 0, w, h);

  paintBand(ctx, ware, shape, w, h, dim);

  if (paint.heat && paint.heat > 0.04) {
    const warm = ctx.createLinearGradient(-w * 0.5, h, w * 0.2, 0);
    warm.addColorStop(0, `rgba(255,140,60,${Math.min(0.26, paint.heat * 0.4)})`);
    warm.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(-w, 0, w * 2, h);
  }

  if (paint.flambe) {
    // Copper-red wandering under a green celadon: unrepeatable, so it is mottled.
    for (let i = 0; i < 7; i++) {
      const y = h * (0.18 + i * 0.1);
      const grad = ctx.createLinearGradient(-w * 0.5, y, w * 0.5, y + h * 0.08);
      grad.addColorStop(0, 'rgba(120,20,10,0)');
      grad.addColorStop(0.4 + (i % 3) * 0.1, `rgba(150,28,14,${0.5 * dim})`);
      grad.addColorStop(1, `rgba(60,80,60,${0.3 * dim})`);
      ctx.fillStyle = grad;
      ctx.fillRect(-w, y, w * 2, h * 0.08);
    }
  }

  if (paint.over) {
    const run = ctx.createLinearGradient(0, h * 0.78, 0, h);
    run.addColorStop(0, 'rgba(120,66,26,0)');
    run.addColorStop(1, 'rgba(120,66,26,0.5)');
    ctx.fillStyle = run;
    ctx.fillRect(-w, h * 0.78, w * 2, h * 0.22);
  }

  if (paint.cracked) {
    ctx.strokeStyle = 'rgba(28,20,14,0.85)';
    ctx.lineWidth = Math.max(1, h * 0.008);
    for (let i = 0; i < 3; i++) {
      const x0 = -w * 0.14 + i * w * 0.14;
      ctx.beginPath();
      ctx.moveTo(x0, h * 0.1);
      ctx.lineTo(x0 + w * 0.04, h * 0.4);
      ctx.lineTo(x0 - w * 0.02, h * 0.64);
      ctx.stroke();
    }
  }

  if (paint.mood === 'under') {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(196,208,214,0.55)';
    ctx.fillRect(-w, 0, w * 2, h);
    ctx.globalCompositeOperation = 'source-over';
  } else if (paint.mood === 'over') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(104,58,26,0.5)';
    ctx.fillRect(-w, 0, w * 2, h);
    ctx.globalCompositeOperation = 'source-over';
  } else if (paint.mood === 'rare') {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(180,40,20,0.4)';
    ctx.fillRect(-w, 0, w * 2, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (dim < 1) {
    ctx.fillStyle = `rgba(22,12,7,${(1 - dim) * 0.7})`;
    ctx.fillRect(-w, 0, w * 2, h);
  }
  ctx.restore();

  const gloss = 0.5 + 0.5 * Math.min(1, dim + 0.2);
  ctx.save();
  bodyPath(ctx, shape, w, h);
  ctx.clip();
  ctx.fillStyle = `rgba(255,255,255,${0.3 * gloss})`;
  ctx.beginPath();
  ctx.ellipse(-w * 0.22, h * 0.42, w * 0.05, h * 0.26, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Mouth: the one thing that says "vessel" at any size.
  if (shape === 'bowl') {
    const ry = Math.max(1.6, w * 0.055);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.5, ry, 0, 0, Math.PI * 2);
    const inner = ctx.createLinearGradient(0, -ry, 0, ry);
    inner.addColorStop(0, 'rgba(38,52,48,0.92)');
    inner.addColorStop(0.6, 'rgba(58,74,68,0.9)');
    inner.addColorStop(1, 'rgba(120,136,128,0.85)');
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, ry * 0.55, w * 0.46, ry * 0.86, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * dim})`;
    ctx.lineWidth = Math.max(0.8, h * 0.012);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.5, ry, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    const fr = w * 0.19;
    const fh = Math.max(1.5, h * 0.035);
    ctx.fillStyle = g.deep;
    ctx.beginPath();
    ctx.moveTo(-fr, h - fh);
    ctx.lineTo(-fr, h - fh * 0.2);
    ctx.quadraticCurveTo(0, h - fh * 0.2 + fr * 0.18, fr, h - fh * 0.2);
    ctx.lineTo(fr, h - fh);
    ctx.quadraticCurveTo(0, h - fh + fr * 0.18, -fr, h - fh);
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'vase') {
    const ry = Math.max(1.2, w * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.1, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18,12,8,0.75)';
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * dim})`;
    ctx.lineWidth = Math.max(0.7, h * 0.01);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.44, Math.max(1.6, w * 0.07), 0, 0, Math.PI * 2);
    const lid = ctx.createLinearGradient(-w * 0.4, 0, w * 0.4, 0);
    lid.addColorStop(0, g.dark);
    lid.addColorStop(0.3, g.light);
    lid.addColorStop(1, g.deep);
    ctx.fillStyle = lid;
    ctx.fill();
    ctx.strokeStyle = `rgba(0,0,0,${0.35 * dim})`;
    ctx.lineWidth = Math.max(0.8, h * 0.01);
    ctx.stroke();
  }

  ctx.restore();
}

/** A tiny pot for the map: no bands, just a silhouette that still reads. */
export function drawPotSmall(
  ctx: CanvasRenderingContext2D,
  ware: WareDef,
  cx: number,
  cy: number,
  h: number,
): void {
  drawPot(ctx, ware, cx, cy, h, { dim: 0.92 });
}
