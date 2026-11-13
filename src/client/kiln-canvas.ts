/**
 * The kiln, drawn. One cross-section, three chambers, nine shelves.
 *
 * Everything here is procedural: no images, no sprite sheets. The shapes are
 * the same ones the sim uses, so what you see on the shelf is what gets fired.
 */

import type { Kiln, Slot, Zone } from '../shared/kiln';
import { ZONES } from '../shared/kiln';

export const VIEW_W = 1000;
export const VIEW_H = 560;

const CHAMBER: Record<Zone, { x: number; w: number }> = {
  mouth: { x: 92, w: 258 },
  body: { x: 384, w: 250 },
  tail: { x: 668, w: 246 },
};

const SHELF_Y = [252, 352, 452];
const SHELF_H = 96;

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
type Smoke = { x: number; y: number; vy: number; life: number; r: number; drift: number };

const embers: Ember[] = [];
const smoke: Smoke[] = [];

/* ------------------------------------------------------------------ */
/* Coordinate plumbing                                                 */
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
  return { x: chamber.x + 8, y: shelf - SHELF_H, w: chamber.w - 16, h: SHELF_H };
}

export function hitSlot(kiln: Kiln, x: number, y: number): Slot | null {
  for (const slot of kiln.slots) {
    const r = slotRect(slot);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return slot;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Small drawing helpers                                               */
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function brickTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const rand = mulberry(seed);
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.strokeStyle = 'rgba(12,8,6,0.55)';
  ctx.lineWidth = 1.2;
  const rowH = 15;
  for (let row = 0; row * rowH < h; row += 1) {
    const yy = y + row * rowH;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    const offset = row % 2 === 0 ? 0 : 26;
    for (let bx = x - offset; bx < x + w; bx += 52) {
      ctx.beginPath();
      ctx.moveTo(bx, yy);
      ctx.lineTo(bx, yy + rowH);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 90; i += 1) {
    const px = x + rand() * w;
    const py = y + rand() * h;
    const a = 0.02 + rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,225,190,${a * 1.8})` : `rgba(70,30,14,${a * 1.8})`;
    ctx.fillRect(px, py, 2 + rand() * 5, 2 + rand() * 4);
  }
  ctx.restore();
}

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
  const shift = ((seed % 1000) / 1000 - 0.5) * 0.09;
  const lShift = (((seed >> 10) % 100) / 100 - 0.5) * 0.12;
  const hh = (h + shift + 1) % 1;
  const ss = Math.max(0.18, Math.min(0.8, sat));
  const ll = Math.max(0.32, Math.min(0.78, l + lShift));
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
  const s = scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, baseY);
  ctx.scale(s, s);

  const body = new Path2D();
  if (form === 'bowl') {
    // wide and shallow, with a foot ring
    body.moveTo(-34, -26);
    body.bezierCurveTo(-32, -4, -18, 0, 0, 0);
    body.bezierCurveTo(18, 0, 32, -4, 34, -26);
    body.bezierCurveTo(20, -30, -20, -30, -34, -26);
    body.closePath();
  } else if (form === 'jar') {
    // belly, shoulder, short neck, flared lip
    body.moveTo(-13, -62);
    body.bezierCurveTo(-15, -54, -34, -50, -32, -24);
    body.bezierCurveTo(-30, -4, -14, 0, 0, 0);
    body.bezierCurveTo(14, 0, 30, -4, 32, -24);
    body.bezierCurveTo(34, -50, 15, -54, 13, -62);
    body.closePath();
  } else if (form === 'vase') {
    // tall, shoulder high on the body, long neck
    body.moveTo(-8, -78);
    body.bezierCurveTo(-10, -66, -26, -58, -24, -34);
    body.bezierCurveTo(-22, -10, -12, 0, 0, 0);
    body.bezierCurveTo(12, 0, 22, -10, 24, -34);
    body.bezierCurveTo(26, -58, 10, -66, 8, -78);
    body.closePath();
  } else {
    // ovoid, narrow at the neck
    body.moveTo(-7, -80);
    body.bezierCurveTo(-9, -70, -30, -62, -30, -34);
    body.bezierCurveTo(-30, -10, -14, 0, 0, 0);
    body.bezierCurveTo(14, 0, 30, -10, 30, -34);
    body.bezierCurveTo(30, -62, 9, -70, 7, -80);
    body.closePath();
  }

  // a shadow first, so the piece sits on the shelf instead of floating
  ctx.save();
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath();
  ctx.ellipse(2, 1, 24, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const grad = ctx.createLinearGradient(-28, -80, 30, 0);
  grad.addColorStop(0, glaze);
  grad.addColorStop(0.55, glaze);
  grad.addColorStop(1, 'rgba(24,16,12,0.88)');
  ctx.fillStyle = grad;
  ctx.fill(body);

  ctx.lineWidth = 1;
  ctx.strokeStyle = mine ? 'rgba(255,226,180,0.95)' : 'rgba(255,232,200,0.45)';
  ctx.stroke(body);

  // the light that makes it read as glazed clay
  ctx.save();
  ctx.clip(body);
  const sheen = ctx.createLinearGradient(-24, -60, 6, -10);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.32, 'rgba(255,255,255,0.04)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-36, -84, 70, 88);
  ctx.restore();

  // lip, so the silhouette has a mouth
  ctx.beginPath();
  const lipY = form === 'bowl' ? -26 : form === 'jar' ? -62 : form === 'vase' ? -78 : -80;
  const lipRx = form === 'bowl' ? 34 : form === 'jar' ? 13 : form === 'vase' ? 8 : 7;
  ctx.ellipse(0, lipY, lipRx, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12,9,7,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.9;
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

  // The caller has already scaled the context for devicePixelRatio, so every
  // number below is a CSS pixel. Never reset the transform here.
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // the dark of the workshop
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#f8f2e8');
  bg.addColorStop(0.62, '#f4ede2');
  bg.addColorStop(1, '#eadfce');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // letterbox bars, so the drawing never looks like it escaped its frame
  ctx.fillStyle = '#f4ede2';
  if (dx > 0.5) {
    ctx.fillRect(0, 0, dx, height);
    ctx.fillRect(width - dx, 0, dx, height);
  }

  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);

  const heat = state.phase === 'firing' ? state.heat : state.phase === 'result' ? 1 : 0.42;

  drawBackdrop(ctx, heat, time, state.kiln.seed);
  drawChimneySmoke(ctx, heat, time, dt, state.reducedMotion);
  drawKilnMass(ctx, state.kiln);
  drawChambers(ctx, state, heat, time);
  drawShelves(ctx, state);
  drawPieces(ctx, state, time);
  drawFireMouth(ctx, heat, time, dt, state.reducedMotion);
  drawSelection(ctx, state, time);

  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, heat: number, _time: number, seed: number): void {
  // paper wall, warm and flat, the way a workshop looks at ten in the morning
  const wall = ctx.createLinearGradient(0, 0, 0, 470);
  wall.addColorStop(0, '#f8f2e8');
  wall.addColorStop(0.6, '#f1e8db');
  wall.addColorStop(1, '#e9decb');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, VIEW_W, 470);

  const rand = mulberry(seed ^ 0x51f3);
  for (let i = 0; i < 30; i += 1) {
    const x = rand() * VIEW_W;
    const y = rand() * 430;
    const r = 40 + rand() * 130;
    const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rand() > 0.45;
    blot.addColorStop(0, warm ? 'rgba(180,85,47,0.045)' : 'rgba(120,96,70,0.05)');
    blot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blot;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // floor: swept clay
  const floor = ctx.createLinearGradient(0, 470, 0, VIEW_H);
  floor.addColorStop(0, '#dfd0ba');
  floor.addColorStop(0.4, '#d6c5ac');
  floor.addColorStop(1, '#c9b79c');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 470, VIEW_W, VIEW_H - 470);
  ctx.strokeStyle = 'rgba(120,96,70,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const x = i * 130;
    ctx.beginPath();
    ctx.moveTo(x, 470);
    ctx.lineTo(x - 40, VIEW_H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,96,70,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.lineTo(VIEW_W, 470);
  ctx.stroke();

  // heat spilling out of the kiln onto the floor
  const glow = ctx.createRadialGradient(500, 470, 40, 500, 470, 380);
  glow.addColorStop(0, 'rgba(226,87,31,' + (0.10 + heat * 0.14).toFixed(3) + ')');
  glow.addColorStop(0.55, 'rgba(226,87,31,' + (0.03 + heat * 0.05).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 200, VIEW_W, VIEW_H - 200);

  // contact shadow, tight and dark: the kiln is heavy
  const shadow = ctx.createRadialGradient(500, 480, 20, 500, 480, 340);
  shadow.addColorStop(0, 'rgba(90,62,40,0.35)');
  shadow.addColorStop(1, 'rgba(90,62,40,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(500, 480, 350, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // a paper label pinned on the wall, the way a yard marks whose kiln this is
  ctx.save();
  ctx.translate(96, 96);
  ctx.rotate(-0.03);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeStyle = 'rgba(34,26,20,0.18)';
  ctx.lineWidth = 1;
  ctx.fillRect(-40, -26, 118, 52);
  ctx.strokeRect(-40, -26, 118, 52);
  ctx.fillStyle = 'rgba(34,26,20,0.55)';
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(-30, -14 + i * 12, 92 - i * 22, 2);
  }
  ctx.restore();

  drawForeground(ctx, seed);
}

function drawKilnMass(ctx: CanvasRenderingContext2D, kiln: Kiln): void {
  const x = 70;
  const y = 150;
  const w = 860;
  const h = 320;

  ctx.save();
  ctx.shadowColor = 'rgba(90,62,40,0.45)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#8e3f22';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.restore();

  // outer shell
  const shell = ctx.createLinearGradient(x, y, x, y + h);
  shell.addColorStop(0, '#c4693f');
  shell.addColorStop(0.45, '#b4552f');
  shell.addColorStop(1, '#8e3f22');
  ctx.fillStyle = shell;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();

  brickTexture(ctx, x, y, w, h, kiln.seed);

  // warm rim along the crown, as if the kiln were lit from inside
  const rim = ctx.createLinearGradient(x, y, x, y + 60);
  rim.addColorStop(0, 'rgba(255,176,110,0.10)');
  rim.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = rim;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();

  // the arch line
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h - 4);
  ctx.quadraticCurveTo(x + 6, y + 4, x + w / 2, y + 2);
  ctx.quadraticCurveTo(x + w - 6, y + 4, x + w - 6, y + h - 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // cap stones
  ctx.fillStyle = 'rgba(255,246,232,0.55)';
  ctx.fillRect(x + 40, y - 10, w - 80, 10);
  ctx.strokeStyle = 'rgba(34,26,20,0.25)';
  ctx.strokeRect(x + 40, y - 10, w - 80, 10);
}

function drawForeground(ctx: CanvasRenderingContext2D, seed: number): void {
  const rand = mulberry(seed ^ 0x2ff1);
  // the workshop floor falls away into dark, with a few brick shards
  const band = ctx.createLinearGradient(0, 486, 0, VIEW_H);
  band.addColorStop(0, 'rgba(150,124,94,0)');
  band.addColorStop(0.45, 'rgba(150,124,94,0.18)');
  band.addColorStop(1, 'rgba(120,96,70,0.30)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 486, VIEW_W, VIEW_H - 486);
  for (let i = 0; i < 14; i += 1) {
    const x = rand() * VIEW_W;
    const y = 496 + rand() * 40;
    const w = 8 + rand() * 22;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(180,85,47,0.55)' : 'rgba(140,110,80,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.35, rand() * 0.6 - 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChambers(ctx: CanvasRenderingContext2D, state: RenderState, heat: number, time: number): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const top = 176;
    const bottom = 468;

    // A kiln is a hole with a fire at the bottom of it. Keep it dark; the only
    // light is the last 60px, where the embers are.
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, '#0d0806');
    grad.addColorStop(0.62, '#150c07');
    grad.addColorStop(0.86, '#2a1208');
    grad.addColorStop(1, zone === 'tail' ? '#3a1a0c' : '#4a1e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(c.x, top, c.w, bottom - top);

    // ember bed
    const bed = ctx.createLinearGradient(0, bottom - 62, 0, bottom);
    const strength = (zone === 'mouth' ? 0.5 : zone === 'body' ? 0.34 : 0.2) + heat * 0.28;
    bed.addColorStop(0, 'rgba(255,140,60,0)');
    bed.addColorStop(0.65, 'rgba(255,140,60,' + (strength * 0.5).toFixed(3) + ')');
    bed.addColorStop(1, 'rgba(255,196,120,' + strength.toFixed(3) + ')');
    ctx.fillStyle = bed;
    ctx.fillRect(c.x + 2, bottom - 62, c.w - 4, 62);

    // arch
    ctx.beginPath();
    ctx.moveTo(c.x, bottom);
    ctx.lineTo(c.x, top + 46);
    ctx.quadraticCurveTo(c.x + c.w / 2, top - 4, c.x + c.w, top + 46);
    ctx.lineTo(c.x + c.w, bottom);
    ctx.strokeStyle = 'rgba(20,10,6,0.85)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // slow tongues, barely there, only where the fire is
    if (!state.reducedMotion) {
      const count = zone === 'mouth' ? 3 : zone === 'body' ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const t = time * 0.0013 + i * 2.4 + (zone === 'tail' ? 1.7 : 0);
        const fx = c.x + 24 + ((i + 0.5) / count) * (c.w - 48);
        const h = (34 + Math.sin(t * 2.6) * 12) * (0.45 + heat * 0.6);
        const sway = Math.sin(t * 1.9 + i) * 7;
        const g = ctx.createLinearGradient(fx, bottom, fx, bottom - h * 1.9);
        g.addColorStop(0, 'rgba(255,190,120,0.30)');
        g.addColorStop(0.55, 'rgba(255,140,60,0.10)');
        g.addColorStop(1, 'rgba(226,83,31,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx - 11, bottom);
        ctx.quadraticCurveTo(fx - 7, bottom - h * 0.65, fx + sway, bottom - h * 1.85);
        ctx.quadraticCurveTo(fx + 8, bottom - h * 0.55, fx + 11, bottom);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // the two walls between chambers
  for (const wallX of [352, 638]) {
    ctx.fillStyle = '#c4693f';
    ctx.fillRect(wallX, 176, 28, 292);
    ctx.strokeStyle = 'rgba(34,26,20,0.35)';
    ctx.strokeRect(wallX, 176, 28, 292);
  }
}

function drawShelves(ctx: CanvasRenderingContext2D, state: RenderState): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    for (const y of SHELF_Y) {
      // the slab, lit from the fire below
      ctx.fillStyle = 'rgba(96,58,38,0.95)';
      ctx.fillRect(c.x + 4, y, c.w - 8, 4);
      ctx.fillStyle = 'rgba(255,196,140,0.35)';
      ctx.fillRect(c.x + 4, y, c.w - 8, 1.2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(c.x + 4, y + 4, c.w - 8, 3);
    }
  }
  void state;
}

function slotCenter(slot: Slot): { x: number; y: number } {
  const r = slotRect(slot);
  return { x: r.x + r.w / 2, y: r.y + r.h - 6 };
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
    const center = slotCenter(slot);
    if (list.length === 0) {
      ctx.save();
      ctx.globalAlpha = 0.30;
      ctx.strokeStyle = 'rgba(255,214,170,0.75)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 22, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const rect = slotRect(slot);
    const count = list.length;
    const gap = Math.min(52, (rect.w - 30) / Math.max(1, count));
    const scale = count > 3 ? 0.72 : count > 2 ? 0.84 : 0.95;

    list.forEach((piece, index) => {
      const x = center.x + (index - (count - 1) / 2) * gap;
      const dim = state.spotlight !== null && state.spotlight !== slot.id;
      const alpha = dim ? 0.4 : 1;
      const bob = state.reducedMotion ? 0 : Math.sin(time * 0.002 + slot.row + index) * 0.6;
      drawPiece(ctx, piece.form, x, center.y + bob, scale, piece.glaze, alpha, piece.mine);
    });
  }
}

function drawFireMouth(ctx: CanvasRenderingContext2D, heat: number, time: number, dt: number, reduced: boolean): void {
  const x = 70;
  const y = 330;
  const w = 26;
  const h = 110;

  // glow on the ground in front of the hole
  const spill = ctx.createRadialGradient(x - 10, y + h / 2, 4, x - 10, y + h / 2, 150);
  spill.addColorStop(0, `rgba(255,214,150,${0.55 + heat * 0.25})`);
  spill.addColorStop(0.35, `rgba(255,150,60,${0.30 + heat * 0.2})`);
  spill.addColorStop(1, 'rgba(226,83,31,0)');
  ctx.fillStyle = spill;
  ctx.fillRect(-120, y - 120, 320, h + 240);

  // the opening: a dark arch cut into the terracotta
  ctx.beginPath();
  ctx.moveTo(x - 4, y + h);
  ctx.lineTo(x - 4, y + 26);
  ctx.quadraticCurveTo(x + w / 2, y - 8, x + w + 4, y + 26);
  ctx.lineTo(x + w + 4, y + h);
  ctx.closePath();
  ctx.fillStyle = '#0f0704';
  ctx.fill();
  ctx.strokeStyle = 'rgba(34,26,20,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // fire inside it, floor up
  const fire = ctx.createLinearGradient(x, y + h, x, y + 10);
  fire.addColorStop(0, `rgba(255,244,214,${0.85 + heat * 0.15})`);
  fire.addColorStop(0.45, `rgba(255,170,80,${0.7 + heat * 0.25})`);
  fire.addColorStop(1, 'rgba(194,69,28,0.15)');
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 3);
  ctx.lineTo(x + 2, y + 30);
  ctx.quadraticCurveTo(x + w / 2, y - 2, x + w - 2, y + 30);
  ctx.lineTo(x + w - 2, y + h - 3);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = fire;
  ctx.fillRect(x, y - 10, w, h + 20);
  if (!reduced) {
    for (let i = 0; i < 3; i += 1) {
      const t = time * 0.002 + i * 2.1;
      const fh = 40 + Math.sin(t * 2.4) * 16;
      const g = ctx.createLinearGradient(x + w / 2, y + h, x + w / 2, y + h - fh);
      g.addColorStop(0, 'rgba(255,252,235,0.9)');
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + w / 2 + Math.sin(t) * 4, y + h - fh / 2, 5, fh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  if (reduced) return;

  // embers out of the hole
  if (embers.length < 40) {
    for (let i = 0; i < 2; i += 1) {
      embers.push({
        x: x + w / 2 + (Math.random() - 0.5) * 12,
        y: y + h - 10 - Math.random() * 30,
        vx: (Math.random() - 0.15) * 26,
        vy: -18 - Math.random() * 40,
        life: 1,
        size: 0.8 + Math.random() * 1.6,
      });
    }
  }
  const step = Math.min(dt, 48) / 1000;
  for (let i = embers.length - 1; i >= 0; i -= 1) {
    const e = embers[i]!;
    e.x += e.vx * step;
    e.y += e.vy * step;
    e.vy -= 4 * step;
    e.life -= step * 0.55;
    if (e.life <= 0) {
      embers.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(255,${150 + Math.floor(80 * e.life)},80,${e.life * 0.9})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChimneySmoke(
  ctx: CanvasRenderingContext2D,
  heat: number,
  time: number,
  dt: number,
  reduced: boolean
): void {
  // stack
  ctx.fillStyle = '#b4552f';
  roundRect(ctx, 826, 84, 56, 80, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34,26,20,0.35)';
  ctx.strokeRect(826, 84, 56, 80);
  ctx.fillStyle = 'rgba(34,26,20,0.45)';
  ctx.fillRect(832, 86, 44, 8);

  if (reduced) return;

  if (smoke.length < 22) {
    smoke.push({
      x: 854 + (Math.random() - 0.5) * 20,
      y: 80,
      vy: -12 - Math.random() * 12,
      life: 1,
      r: 4 + Math.random() * 5,
      drift: (Math.random() - 0.3) * 14,
    });
  }
  const step = Math.min(dt, 48) / 1000;
  for (let i = smoke.length - 1; i >= 0; i -= 1) {
    const s = smoke[i]!;
    s.y += s.vy * step;
    s.x += s.drift * step;
    s.r += 7 * step;
    s.life -= step * 0.22;
    if (s.life <= 0) {
      smoke.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(120,110,100,${s.life * (0.05 + heat * 0.06)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  void time;
}

function drawSelection(ctx: CanvasRenderingContext2D, state: RenderState, time: number): void {
  if (state.phase !== 'select' && state.phase !== 'stoke') return;
  const pulse = state.reducedMotion ? 0.5 : (Math.sin(time * 0.004) + 1) / 2;
  for (const slot of state.kiln.slots) {
    const active = slot.id === state.selectedSlot;
    const hover = slot.id === state.hoverSlot;
    if (!active && !hover) continue;
    const r = slotRect(slot);
    ctx.save();
    ctx.strokeStyle = active ? 'rgba(255,190,120,0.95)' : `rgba(255,190,120,${0.3 + pulse * 0.35})`;
    ctx.lineWidth = active ? 2 : 1.4;
    ctx.setLineDash(active ? [] : [5, 4]);
    roundRect(ctx, r.x + 2, r.y + 4, r.w - 4, r.h - 8, 8);
    ctx.stroke();
    if (hover && !active) {
      ctx.fillStyle = 'rgba(255,190,120,0.06)';
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Reset the particle fields (used between posts / tests). */
export function resetParticles(): void {
  embers.length = 0;
  smoke.length = 0;
}
