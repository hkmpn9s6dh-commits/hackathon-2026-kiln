/**
 * The kiln, drawn as a section — the way a workshop drawing would show it.
 *
 * Rules of the drawing:
 *  - hairlines, not outlines: every edge is 0.75–1.25px of ink at low alpha;
 *  - colour only where the fire and the glaze are: paper, ink, terracotta, one
 *    glaze per piece;
 *  - the kiln is heavy, so it gets a wide soft shadow and one hard ground line;
 *  - nothing is an image: bricks, fire, smoke and the glazes are all paths.
 */

import type { Kiln, Slot, Zone } from '../shared/kiln';
import { ZONES } from '../shared/kiln';

export const VIEW_W = 1000;
export const VIEW_H = 560;

const CHAMBER: Record<Zone, { x: number; w: number }> = {
  mouth: { x: 104, w: 250 },
  body: { x: 392, w: 250 },
  tail: { x: 680, w: 218 },
};

const SHELF_Y = [206, 326, 446];
const SHELF_H = 108;
const GROUND = 522;
// the shell runs past every edge: we are standing close to the kiln
const KILN = { x: -60, y: -150, w: 1120, h: GROUND + 150 };
const ARCH_TOP = 92;

const INK = '43, 33, 26';

export type RenderPiece = {
  slotId: string;
  form: 'bowl' | 'jar' | 'vase' | 'egg';
  glaze: string;
  mine: boolean;
  grade?: string;
};

export type RenderState = {
  kiln: Kiln;
  pieces: RenderPiece[];
  selectedSlot: string | null;
  hoverSlot: string | null;
  phase: 'select' | 'stoke' | 'firing' | 'result' | 'yard';
  heat: number;
  spotlight: string | null;
  reducedMotion: boolean;
};

type Ember = { x: number; y: number; vx: number; vy: number; life: number; size: number };

const embers: Ember[] = [];

/* ------------------------------------------------------------------ */
/* Coordinate plumbing (the hit tests depend on these numbers)         */
/* ------------------------------------------------------------------ */

export function fit(width: number, height: number): { scale: number; dx: number; dy: number } {
  const scale = Math.min(width / VIEW_W, height / VIEW_H);
  return { scale, dx: (width - VIEW_W * scale) / 2, dy: (height - VIEW_H * scale) / 2 };
}

export function toView(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const { scale, dx, dy } = fit(rect.width, rect.height);
  return { x: (clientX - rect.left - dx) / scale, y: (clientY - rect.top - dy) / scale };
}

export function slotRect(slot: Slot): { x: number; y: number; w: number; h: number } {
  const chamber = CHAMBER[slot.zone];
  const shelf = SHELF_Y[slot.row] ?? SHELF_Y[0]!;
  return { x: chamber.x + 6, y: shelf - SHELF_H, w: chamber.w - 12, h: SHELF_H };
}

export function hitSlot(kiln: Kiln, x: number, y: number): Slot | null {
  for (const slot of kiln.slots) {
    const r = slotRect(slot);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return slot;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Paper grain, built once and reused as a pattern. */
let grain: CanvasPattern | null = null;
function paperGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grain) return grain;
  const tile = document.createElement('canvas');
  tile.width = 96;
  tile.height = 96;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  const rand = mulberry(0x9e3779b9);
  for (let i = 0; i < 900; i += 1) {
    const a = 0.02 + rand() * 0.05;
    tctx.fillStyle = rand() > 0.5 ? `rgba(${INK},${a.toFixed(3)})` : `rgba(255,255,255,${(a * 1.6).toFixed(3)})`;
    tctx.fillRect(Math.floor(rand() * 96), Math.floor(rand() * 96), 1, 1);
  }
  grain = ctx.createPattern(tile, 'repeat');
  return grain;
}

function hairline(ctx: CanvasRenderingContext2D, alpha: number, width = 1): void {
  ctx.strokeStyle = `rgba(${INK},${alpha})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
}

/* ------------------------------------------------------------------ */
/* Glaze tinting                                                       */
/* ------------------------------------------------------------------ */

export function tintGlaze(hex: string, seed: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const shift = ((seed % 1000) / 1000 - 0.5) * 0.07;
  const lShift = (((seed >> 10) % 100) / 100 - 0.5) * 0.08;
  const hh = (h + shift + 1) % 1;
  const ss = Math.max(0.16, Math.min(0.62, sat));
  const ll = Math.max(0.36, Math.min(0.68, l + lShift));
  const hue2rgb = (p1: number, q1: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p1 + (q1 - p1) * 6 * tt;
    if (tt < 1 / 2) return q1;
    if (tt < 2 / 3) return p1 + (q1 - p1) * (2 / 3 - tt) * 6;
    return p1;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p1 = 2 * ll - q;
  const to255 = (x: number): string =>
    Math.round(Math.max(0, Math.min(1, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to255(hue2rgb(p1, q, hh + 1 / 3))}${to255(hue2rgb(p1, q, hh))}${to255(hue2rgb(p1, q, hh - 1 / 3))}`;
}

/* ------------------------------------------------------------------ */
/* A piece                                                             */
/* ------------------------------------------------------------------ */

function piecePath(form: RenderPiece['form']): Path2D {
  const body = new Path2D();
  if (form === 'bowl') {
    body.moveTo(-33, -24);
    body.bezierCurveTo(-30, -4, -17, 0, 0, 0);
    body.bezierCurveTo(17, 0, 30, -4, 33, -24);
    body.bezierCurveTo(20, -28, -20, -28, -33, -24);
    body.closePath();
  } else if (form === 'jar') {
    body.moveTo(-12, -58);
    body.bezierCurveTo(-14, -50, -31, -46, -31, -22);
    body.bezierCurveTo(-31, -5, -15, 0, 0, 0);
    body.bezierCurveTo(15, 0, 31, -5, 31, -22);
    body.bezierCurveTo(31, -46, 14, -50, 12, -58);
    body.closePath();
  } else if (form === 'vase') {
    body.moveTo(-8, -74);
    body.bezierCurveTo(-9, -62, -24, -54, -23, -32);
    body.bezierCurveTo(-22, -9, -12, 0, 0, 0);
    body.bezierCurveTo(12, 0, 22, -9, 23, -32);
    body.bezierCurveTo(24, -54, 9, -62, 8, -74);
    body.closePath();
  } else {
    body.moveTo(-7, -76);
    body.bezierCurveTo(-8, -66, -28, -58, -28, -32);
    body.bezierCurveTo(-28, -9, -13, 0, 0, 0);
    body.bezierCurveTo(13, 0, 28, -9, 28, -32);
    body.bezierCurveTo(28, -58, 8, -66, 7, -76);
    body.closePath();
  }
  return body;
}

const LIP: Record<RenderPiece['form'], { y: number; rx: number }> = {
  bowl: { y: -24, rx: 33 },
  jar: { y: -58, rx: 12 },
  vase: { y: -74, rx: 8 },
  egg: { y: -76, rx: 7 },
};

function drawPiece(
  ctx: CanvasRenderingContext2D,
  form: RenderPiece['form'],
  cx: number,
  baseY: number,
  scale: number,
  glaze: string,
  alpha: number,
  mine: boolean
): void {
  const lip = LIP[form];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, baseY);
  ctx.scale(scale, scale);

  // contact shadow: soft, offset, never black
  const shadow = ctx.createRadialGradient(2, 2, 1, 2, 2, 30);
  shadow.addColorStop(0, 'rgba(46,24,14,0.6)');
  shadow.addColorStop(1, 'rgba(90,62,40,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(2, 2, 30, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = piecePath(form);

  // the glaze: a wash that darkens toward the foot
  const wash = ctx.createLinearGradient(0, lip.y, 0, 0);
  wash.addColorStop(0, glaze);
  wash.addColorStop(0.7, glaze);
  wash.addColorStop(1, 'rgba(64,44,32,0.75)');
  ctx.globalAlpha = alpha * 0.92;
  ctx.fillStyle = wash;
  ctx.fill(body);

  // one specular arc, clipped to the body: that is what reads as glaze
  ctx.save();
  ctx.clip(body);
  ctx.globalAlpha = alpha * 0.32;
  ctx.strokeStyle = 'rgba(255,252,246,0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-22, lip.y + 12);
  ctx.quadraticCurveTo(-12, lip.y + 3, 6, lip.y + 5);
  ctx.stroke();
  ctx.restore();

  // hairline contour
  ctx.globalAlpha = alpha * (mine ? 0.9 : 0.5);
  ctx.strokeStyle = mine ? 'rgba(255,246,232,0.95)' : `rgba(${INK},0.62)`;
  ctx.lineWidth = mine ? 1.1 : 0.9;
  ctx.stroke(body);

  // lip
  ctx.globalAlpha = alpha * 0.85;
  ctx.beginPath();
  ctx.ellipse(0, lip.y, lip.rx, Math.max(2.2, lip.rx * 0.2), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(38,24,16,0.55)';
  ctx.fill();
  ctx.strokeStyle = `rgba(${INK},0.55)`;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Main draw                                                           */
/* ------------------------------------------------------------------ */

export function drawKiln(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState,
  time: number,
  dt: number
): void {
  const { scale, dx, dy } = fit(width, height);

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const paper = ctx.createLinearGradient(0, 0, 0, height);
  paper.addColorStop(0, '#faf5ec');
  paper.addColorStop(0.58, '#f6efe4');
  paper.addColorStop(1, '#ece1d0');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  const pattern = paperGrain(ctx);
  if (pattern) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#f6efe4';
  if (dx > 0.5) {
    ctx.fillRect(0, 0, dx, height);
    ctx.fillRect(width - dx, 0, dx, height);
  }

  ctx.translate(dx, dy);
  ctx.scale(scale, scale);

  const heat = state.phase === 'firing' ? state.heat : state.phase === 'result' ? 1 : 0.35;

  drawFloor(ctx, heat);
  drawShell(ctx, state.kiln);
  for (const zone of ZONES) chamberRing(ctx, zone);
  drawChambers(ctx, state, heat, time);
  drawShelfBacks(ctx);
  drawPieces(ctx, state, time);
  drawShelfLips(ctx);
  drawMouth(ctx, heat, time, dt, state.reducedMotion);
  drawSelection(ctx, state, time);

  if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
    ctx.save();
    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 1;
    for (const y of SHELF_Y) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(940, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#00ffff';
    for (const slot of state.kiln.slots) {
      const r = slotRect(slot);
      ctx.fillRect(r.x + r.w / 2 - 3, r.y + r.h + 2 - 3, 6, 6);
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawFloor(ctx: CanvasRenderingContext2D, heat: number): void {
  const floor = ctx.createLinearGradient(0, GROUND, 0, VIEW_H);
  floor.addColorStop(0, '#b9a184');
  floor.addColorStop(1, '#a58c6d');
  ctx.fillStyle = floor;
  ctx.fillRect(0, GROUND, VIEW_W, VIEW_H - GROUND);

  // one hard line between wall and floor, then a few soft ones
  hairline(ctx, 0.3, 1.1);
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(VIEW_W, GROUND);
  ctx.stroke();

  hairline(ctx, 0.08, 1);
  for (let i = 1; i < 7; i += 1) {
    const y = GROUND + i * i * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
    ctx.stroke();
  }

  // the fire spills onto the floor in front of the mouth
  const spill = ctx.createRadialGradient(
    CHAMBER.mouth.x - 30,
    GROUND + 10,
    10,
    CHAMBER.mouth.x - 30,
    GROUND + 10,
    230
  );
  spill.addColorStop(0, `rgba(224,102,42,${(0.14 + heat * 0.12).toFixed(3)})`);
  spill.addColorStop(1, 'rgba(224,102,42,0)');
  ctx.fillStyle = spill;
  ctx.fillRect(0, GROUND, 460, VIEW_H - GROUND);

  // wide soft shadow under the kiln
  const shadow = ctx.createRadialGradient(500, GROUND + 6, 40, 500, GROUND + 6, 470);
  shadow.addColorStop(0, 'rgba(90,62,40,0.24)');
  shadow.addColorStop(0.5, 'rgba(90,62,40,0.09)');
  shadow.addColorStop(1, 'rgba(90,62,40,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(500, GROUND + 4, 470, 26, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawShell(ctx: CanvasRenderingContext2D, kiln: Kiln): void {
  const { x, y, w, h } = KILN;

  const shell = new Path2D();
  shell.moveTo(x, y + h);
  shell.lineTo(x, y);
  shell.lineTo(x + w, y);
  shell.lineTo(x + w, y + h);
  shell.closePath();

  const fill = ctx.createLinearGradient(0, y - 30, 0, y + h);
  fill.addColorStop(0, '#c0a88d');
  fill.addColorStop(0.38, '#b39a7f');
  fill.addColorStop(1, '#8c7358');
  ctx.fillStyle = fill;
  ctx.fill(shell);

  // brick coursing: hairlines only, never a texture
  ctx.save();
  ctx.clip(shell);
  const rand = mulberry(kiln.seed ^ 0x2b1d);
  hairline(ctx, 0.12, 0.8);
  for (let row = 0; row * 22 < h + 40; row += 1) {
    const yy = y + row * 22;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    const offset = row % 2 === 0 ? 0 : 33;
    for (let bx = x - offset; bx < x + w; bx += 66) {
      ctx.beginPath();
      ctx.moveTo(bx, yy);
      ctx.lineTo(bx, yy + 22);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 26; i += 1) {
    const bx = x + rand() * w;
    const by = y + 20 + rand() * (h - 30);
    ctx.fillStyle = `rgba(${INK},${(0.03 + rand() * 0.04).toFixed(3)})`;
    ctx.fillRect(bx, by, 26, 16);
  }
  ctx.restore();

  // soot: every opening in a wood kiln blackens the brick around it
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const halo = ctx.createRadialGradient(
      c.x + c.w / 2,
      GROUND - 60,
      20,
      c.x + c.w / 2,
      GROUND - 60,
      c.w * 0.85
    );
    halo.addColorStop(0, 'rgba(38,22,14,0.30)');
    halo.addColorStop(0.55, 'rgba(38,22,14,0.10)');
    halo.addColorStop(1, 'rgba(38,22,14,0)');
    ctx.save();
    ctx.clip(shell);
    ctx.fillStyle = halo;
    ctx.fillRect(c.x - 60, 150, c.w + 120, GROUND - 150);
    ctx.restore();
  }

  // a lime wash along the crown, worn thin
  ctx.save();
  ctx.clip(shell);
  const wash = ctx.createLinearGradient(0, KILN.y - 30, 0, KILN.y + 96);
  wash.addColorStop(0, 'rgba(255,246,232,0.16)');
  wash.addColorStop(1, 'rgba(255,246,232,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(KILN.x, KILN.y - 40, KILN.w, 150);
  ctx.restore();

  // the top of the frame is the crown of the vault: one line, nothing more
  const vault = ctx.createLinearGradient(0, 0, 0, 74);
  vault.addColorStop(0, 'rgba(60,42,30,0.16)');
  vault.addColorStop(1, 'rgba(60,42,30,0)');
  ctx.fillStyle = vault;
  ctx.fillRect(0, 0, VIEW_W, 74);
}

function chamberRing(ctx: CanvasRenderingContext2D, zone: Zone): void {
  const c = CHAMBER[zone];
  const top = ARCH_TOP;
  ctx.beginPath();
  ctx.moveTo(c.x - 14, GROUND);
  ctx.lineTo(c.x - 14, top + 44);
  ctx.quadraticCurveTo(c.x + c.w / 2, top - 26, c.x + c.w + 14, top + 44);
  ctx.lineTo(c.x + c.w + 14, GROUND);
  ctx.lineTo(c.x + c.w, GROUND);
  ctx.lineTo(c.x + c.w, top + 44);
  ctx.quadraticCurveTo(c.x + c.w / 2, top - 8, c.x, top + 44);
  ctx.lineTo(c.x, GROUND);
  ctx.closePath();
  ctx.fillStyle = 'rgba(154, 88, 62, 0.95)';
  ctx.fill();
}

function chamberArch(ctx: CanvasRenderingContext2D, zone: Zone): void {
  const c = CHAMBER[zone];
  const top = ARCH_TOP;
  ctx.beginPath();
  ctx.moveTo(c.x, GROUND);
  ctx.lineTo(c.x, top + 44);
  ctx.quadraticCurveTo(c.x + c.w / 2, top - 8, c.x + c.w, top + 44);
  ctx.lineTo(c.x + c.w, GROUND);
  ctx.closePath();
}

function drawChambers(ctx: CanvasRenderingContext2D, state: RenderState, heat: number, time: number): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    chamberArch(ctx, zone);

    // the inside of a kiln is a hole: near black, warm only at the floor
    const inside = ctx.createLinearGradient(0, 150, 0, GROUND);
    inside.addColorStop(0, '#0e0907');
    inside.addColorStop(0.18, '#1b110c');
    inside.addColorStop(0.62, '#241410');
    inside.addColorStop(0.9, '#3c1e11');
    inside.addColorStop(1, zone === 'tail' ? '#4c2614' : '#612c12');
    ctx.fillStyle = inside;
    ctx.fill();

    ctx.strokeStyle = `rgba(${INK},0.5)`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const bedH = 68;
    const strength = (zone === 'mouth' ? 0.7 : zone === 'body' ? 0.46 : 0.28) + heat * 0.3;
    const bed = ctx.createLinearGradient(0, GROUND - bedH, 0, GROUND);
    bed.addColorStop(0, 'rgba(224,102,42,0)');
    bed.addColorStop(0.6, `rgba(224,102,42,${(strength * 0.42).toFixed(3)})`);
    bed.addColorStop(1, `rgba(255,196,132,${strength.toFixed(3)})`);

    ctx.save();
    chamberArch(ctx, zone);
    ctx.clip();
    ctx.fillStyle = bed;
    ctx.fillRect(c.x, GROUND - bedH, c.w, bedH);

    // the ash pit line, and a stack of saggers waiting in the corner
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(c.x, GROUND - 26, c.w, 2);
    ctx.strokeStyle = 'rgba(255,190,130,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i += 1) {
      const sx = c.x + c.w - 46;
      const sy = GROUND - 6 - i * 11;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 17, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!state.reducedMotion) {
      const t = time * 0.0012;
      const breath = ctx.createLinearGradient(0, GROUND - 120, 0, GROUND);
      breath.addColorStop(0, 'rgba(255,150,80,0)');
      breath.addColorStop(
        1,
        `rgba(255,150,80,${(0.05 + Math.sin(t + (zone === 'tail' ? 1.3 : 0)) * 0.02).toFixed(3)})`
      );
      ctx.fillStyle = breath;
      ctx.fillRect(c.x, GROUND - 120, c.w, 120);
    }
    ctx.restore();
  }

  // pilasters between the chambers
  for (const wallX of [354, 640]) {
    ctx.fillStyle = '#b59c81';
    ctx.fillRect(wallX - 2, 0, 40, GROUND);
    hairline(ctx, 0.24, 1);
    ctx.beginPath();
    ctx.moveTo(wallX - 2, 0);
    ctx.lineTo(wallX - 2, GROUND);
    ctx.moveTo(wallX + 38, 0);
    ctx.lineTo(wallX + 38, GROUND);
    ctx.stroke();
  }
}

function drawShelfBacks(ctx: CanvasRenderingContext2D): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    for (const y of SHELF_Y) {
      // the top face of the slab, seen from slightly above
      ctx.fillStyle = 'rgba(255,238,208,0.30)';
      ctx.fillRect(c.x + 3, y - 3.5, c.w - 6, 3.5);
      ctx.fillStyle = `rgba(${INK},0.4)`;
      ctx.fillRect(c.x + 3, y, c.w - 6, 1.6);
    }
  }
}

/** Drawn after the pieces: a shelf has a front lip, and it hides their feet. */
function drawShelfLips(ctx: CanvasRenderingContext2D): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    for (const y of SHELF_Y) {
      const lip = ctx.createLinearGradient(0, y, 0, y + 6);
      lip.addColorStop(0, 'rgba(120,84,62,0.95)');
      lip.addColorStop(1, 'rgba(74,48,34,0.95)');
      ctx.fillStyle = lip;
      ctx.fillRect(c.x + 2, y + 1, c.w - 4, 5.5);
      ctx.fillStyle = 'rgba(255,240,216,0.4)';
      ctx.fillRect(c.x + 2, y + 1, c.w - 4, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(c.x + 2, y + 6.5, c.w - 4, 2);
    }
  }
}

function drawPieces(ctx: CanvasRenderingContext2D, state: RenderState, time: number): void {
  const bySlot = new Map<string, RenderPiece[]>();
  for (const piece of state.pieces) {
    const list = bySlot.get(piece.slotId);
    if (list) list.push(piece);
    else bySlot.set(piece.slotId, [piece]);
  }

  for (const slot of state.kiln.slots) {
    const list = bySlot.get(slot.id) ?? [];
    const rect = slotRect(slot);
    const baseY = rect.y + rect.h + 2;
    if (list.length === 0) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = 'rgba(255,226,186,0.8)';
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(rect.x + rect.w / 2, baseY - 3, 20, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const count = list.length;
    const gap = Math.max(58, Math.min(78, (rect.w - 18) / Math.max(1, count)));
    const scale = count > 3 ? 0.86 : count > 2 ? 0.98 : 1.12;
    list.forEach((piece, index) => {
      const x = rect.x + rect.w / 2 + (index - (count - 1) / 2) * gap;
      const dim = state.spotlight !== null && state.spotlight !== slot.id;
      const alpha = dim ? 0.35 : 1;
      const bob = state.reducedMotion ? 0 : Math.sin(time * 0.0016 + slot.row + index) * 0.4;
      drawPiece(ctx, piece.form, x, baseY + bob, scale, piece.glaze, alpha, piece.mine);
    });
  }
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  heat: number,
  time: number,
  dt: number,
  reduced: boolean
): void {
  const x = 30;
  const w = 96;
  const h = 92;
  const y = GROUND - h;

  // an arched stoke hole cut through the shell, ringed with fired clay
  ctx.beginPath();
  ctx.moveTo(x - 9, y + h);
  ctx.lineTo(x - 9, y + 24);
  ctx.quadraticCurveTo(x + w / 2, y - 22, x + w + 9, y + 24);
  ctx.lineTo(x + w + 9, y + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(154, 88, 62, 0.95)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + 24);
  ctx.quadraticCurveTo(x + w / 2, y - 12, x + w, y + 24);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fillStyle = '#160c07';
  ctx.fill();
  ctx.strokeStyle = `rgba(${INK},0.6)`;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // the fire sits low in the hole
  ctx.save();
  ctx.clip();
  const fire = ctx.createLinearGradient(x, y + h, x, y + h * 0.25);
  fire.addColorStop(0, `rgba(255,248,226,${(0.95).toFixed(3)})`);
  fire.addColorStop(0.3, `rgba(255,190,110,${(0.8 + heat * 0.15).toFixed(3)})`);
  fire.addColorStop(1, 'rgba(196,72,28,0.12)');
  ctx.fillStyle = fire;
  ctx.fillRect(x, y + h * 0.25, w, h);

  if (!reduced) {
    for (let i = 0; i < 3; i += 1) {
      const t = time * 0.0018 + i * 2.2;
      const fh = 22 + Math.sin(t * 2.2) * 9;
      const g = ctx.createRadialGradient(x + w / 2, y + h - fh * 0.5, 1, x + w / 2, y + h - fh * 0.5, fh);
      g.addColorStop(0, 'rgba(255,252,240,0.8)');
      g.addColorStop(1, 'rgba(255,178,96,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y + h - fh * 1.5, w, fh * 1.5);
    }
  }
  ctx.restore();

  if (reduced) return;

  if (embers.length < 24) {
    embers.push({
      x: x + w / 2 + (Math.random() - 0.5) * 8,
      y: y + h - 10 - Math.random() * 18,
      vx: (Math.random() - 0.1) * 14,
      vy: -12 - Math.random() * 22,
      life: 1,
      size: 0.6 + Math.random() * 1,
    });
  }
  const step = Math.min(dt, 48) / 1000;
  for (let i = embers.length - 1; i >= 0; i -= 1) {
    const e = embers[i]!;
    e.x += e.vx * step;
    e.y += e.vy * step;
    e.vy -= 3 * step;
    e.life -= step * 0.42;
    if (e.life <= 0) {
      embers.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(226,120,54,${(e.life * 0.5).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSelection(ctx: CanvasRenderingContext2D, state: RenderState, time: number): void {
  if (state.phase !== 'select' && state.phase !== 'stoke') return;
  const pulse = state.reducedMotion ? 0.5 : (Math.sin(time * 0.0035) + 1) / 2;

  for (const slot of state.kiln.slots) {
    const active = slot.id === state.selectedSlot;
    const hover = slot.id === state.hoverSlot;
    if (!active && !hover) continue;
    const r = slotRect(slot);
    ctx.save();
    if (active) {
      ctx.strokeStyle = 'rgba(224,102,42,0.5)';
      ctx.lineWidth = 3;
      roundRect(ctx, r.x + 1, r.y + 6, r.w - 2, r.h - 10, 6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,246,232,0.95)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(255,232,198,${(0.22 + pulse * 0.28).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      roundRect(ctx, r.x + 1, r.y + 6, r.w - 2, r.h - 10, 6);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Reset the particle fields (used between posts / tests). */
export function resetParticles(): void {
  embers.length = 0;
}
