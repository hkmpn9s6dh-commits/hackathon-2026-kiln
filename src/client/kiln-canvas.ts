/**
 * The kiln, drawn as a section cut through a wood-fired tunnel kiln at night.
 *
 * What the drawing has to convince you of, in this order:
 *
 *  1. It is ONE kiln, not three boxes. A single brick barrel runs the width of
 *     the frame; two firewalls divide it into a fire mouth, a body and a tail,
 *     and each wall is pierced by a flame slot the fire climbs through.
 *  2. Everything is lit from below. The coals lie on the chamber floor; the
 *     vault is brightest a hand above them and falls to black at the crown;
 *     every pot is lit from beneath and rimmed with light along its far edge.
 *  3. The structure is real: voussoir bricks fan around the arch, shelves are
 *     carried on props you can see between the boards, firebrick is burnt pale
 *     where the flame has run for years.
 *  4. The ware is thrown, not drawn: a foot ring, throwing rings, glaze that
 *     breaks thin on the lip and pools dark in the belly.
 *
 * Nothing is an image. Bricks, fire, smoke and nine glazes are all paths.
 */

import type { Kiln, Slot, WareForm, Zone } from '../shared/kiln';
import { ZONES } from '../shared/kiln';

export const VIEW_W = 1000;
export const VIEW_H = 560;

/* ------------------------------------------------------------------ */
/* Geometry — the hit tests read these four numbers                    */
/* ------------------------------------------------------------------ */

const GROUND = 486;

/** The clear opening of each chamber. The piers sit between them. */
const CHAMBER: Record<Zone, { x: number; w: number }> = {
  mouth: { x: 232, w: 150 },
  body: { x: 426, w: 150 },
  tail: { x: 620, w: 150 },
};

const SHELF_Y = [244, 332, 420];
const SHELF_H = 80;

/** Inner face of the barrel vault. */
const VAULT = { cx: 500, a: 310, spring: 255, rise: 155, n: 3.2 };

type Arch = { cx: number; a: number; spring: number; rise: number; n: number };

function superY(x: number, o: Arch): number {
  const t = Math.min(1, Math.abs((x - o.cx) / o.a));
  const f = Math.pow(Math.max(0, 1 - Math.pow(t, o.n)), 1 / o.n);
  return o.spring - o.rise * f;
}

const innerY = (x: number): number => superY(x, VAULT);

function archPath(ctx: CanvasRenderingContext2D, o: Arch, bottom: number): void {
  const x0 = o.cx - o.a;
  const x1 = o.cx + o.a;
  ctx.moveTo(x0, bottom);
  ctx.lineTo(x0, o.spring);
  for (let i = 1; i <= 72; i += 1) {
    const x = x0 + ((x1 - x0) * i) / 72;
    ctx.lineTo(x, superY(x, o));
  }
  ctx.lineTo(x1, bottom);
  ctx.closePath();
}

export type RenderPiece = {
  slotId: string;
  form: WareForm;
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
  return { x: chamber.x, y: shelf - SHELF_H, w: chamber.w, h: SHELF_H };
}

export function hitSlot(kiln: Kiln, x: number, y: number): Slot | null {
  for (const slot of kiln.slots) {
    const r = slotRect(slot);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return slot;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Small maths                                                         */
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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

type RGB = { r: number; g: number; b: number };

function parseHex(hex: string): RGB {
  const v = hex.replace('#', '');
  return {
    r: Number.parseInt(v.slice(0, 2), 16),
    g: Number.parseInt(v.slice(2, 4), 16),
    b: Number.parseInt(v.slice(4, 6), 16),
  };
}

/** amount > 0 lightens toward white, < 0 darkens toward the ink of the kiln. */
function shade(c: RGB, amount: number): string {
  const t = clamp(amount, -1, 1);
  const target = t >= 0 ? 255 : 12;
  const k = Math.abs(t);
  return `rgb(${Math.round(c.r + (target - c.r) * k)},${Math.round(c.g + (target - c.g) * k)},${Math.round(
    c.b + (target - c.b) * k
  )})`;
}

/* ------------------------------------------------------------------ */
/* Glaze tinting                                                       */
/* ------------------------------------------------------------------ */

export function tintGlaze(hex: string, seed: number): string {
  const base = parseHex(hex);
  const r = base.r / 255;
  const g = base.g / 255;
  const b = base.b / 255;
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
  const rand = mulberry(seed ^ 0x51ed);
  const hue = (h + (rand() - 0.5) * 0.06 + 1) % 1;
  const s = clamp(sat + (rand() - 0.5) * 0.1, 0.18, 0.72);
  const li = clamp(l + (rand() - 0.5) * 0.1, 0.28, 0.62);

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = li < 0.5 ? li * (1 + s) : li + s - li * s;
  const p = 2 * li - q;
  const to255 = (v: number): string =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to255(hue2rgb(p, q, hue + 1 / 3))}${to255(hue2rgb(p, q, hue))}${to255(hue2rgb(p, q, hue - 1 / 3))}`;
}

/* ------------------------------------------------------------------ */
/* The static plate: brickwork, vault, piers, shelves, floor           */
/* ------------------------------------------------------------------ */

const PLATE_SCALE = 2;
let plate: { key: string; canvas: HTMLCanvasElement } | null = null;

function plateFor(kiln: Kiln, scale: number): HTMLCanvasElement {
  const key = `${kiln.seed}:${scale.toFixed(3)}`;
  if (plate && plate.key === key) return plate.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(VIEW_W * PLATE_SCALE);
  canvas.height = Math.round(VIEW_H * PLATE_SCALE);
  const g = canvas.getContext('2d');
  if (g) {
    g.scale(PLATE_SCALE, PLATE_SCALE);
    paintPlate(g, kiln);
  }
  plate = { key, canvas };
  return canvas;
}

/** A tooth over everything: four thousand specks, laid once. */
function grain(g: CanvasRenderingContext2D): void {
  const rand = mulberry(0x51d3);
  for (let i = 0; i < 5200; i += 1) {
    const x = rand() * VIEW_W;
    const y = rand() * VIEW_H;
    const a = 0.02 + rand() * 0.05;
    g.fillStyle = rand() > 0.5 ? `rgba(16,10,6,${a.toFixed(3)})` : `rgba(255,246,232,${(a * 0.8).toFixed(3)})`;
    g.fillRect(x, y, 1, 1);
  }
}

function paintPlate(g: CanvasRenderingContext2D, kiln: Kiln): void {
  // A frame of brick. Outside it, nothing: the kiln fills the view.
  g.fillStyle = '#6f5b45';
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  g.save();
  g.beginPath();
  g.rect(0, 0, VIEW_W, GROUND);
  archPath(g, VAULT, GROUND);
  g.clip('evenodd');
  brickField(g, kiln);
  // the night air sits on the brick: everything outside the kiln is cold
  g.save();
  g.globalCompositeOperation = 'multiply';
  const night = g.createLinearGradient(0, 0, 0, GROUND);
  night.addColorStop(0, 'rgb(96,116,152)');
  night.addColorStop(0.55, 'rgb(112,126,150)');
  night.addColorStop(1, 'rgb(132,132,140)');
  g.fillStyle = night;
  g.fillRect(0, 0, VIEW_W, GROUND);
  g.restore();

  const fall = g.createLinearGradient(0, 0, VIEW_W, VIEW_H);
  fall.addColorStop(0, 'rgba(18,11,6,0.30)');
  fall.addColorStop(0.34, 'rgba(18,11,6,0.04)');
  fall.addColorStop(0.62, 'rgba(18,11,6,0.10)');
  fall.addColorStop(1, 'rgba(18,11,6,0.34)');
  g.fillStyle = fall;
  g.fillRect(0, 0, VIEW_W, GROUND);
  cutFace(g);
  archRing(g, kiln);
  shellTint(g);
  g.restore();

  chamber(g, kiln);
  piers(g);
  shelves(g);
  cones(g, kiln);
  yardFloor(g);
  yardProps(g, kiln);
  wallTools(g);
  grain(g);
}

/** Hanging on the wall: the things a potter reaches for without looking. */
function wallTools(g: CanvasRenderingContext2D): void {
  g.save();
  // a row of pegs with a leather apron and a pair of gloves
  const pegX = [838, 870, 902];
  for (const x of pegX) {
    g.fillStyle = 'rgba(220,204,180,0.22)';
    g.fillRect(x - 1, 128, 2, 10);
    g.beginPath();
    g.arc(x, 138, 2.4, 0, Math.PI * 2);
    g.fill();
  }
  // a small slate board with today's firing number, chalked
  g.fillStyle = 'rgba(28,26,24,0.9)';
  g.fillRect(66, 112, 74, 54);
  g.strokeStyle = 'rgba(200,186,164,0.35)';
  g.lineWidth = 2;
  g.strokeRect(66, 112, 74, 54);
  g.fillStyle = 'rgba(240,232,216,0.55)';
  g.fillRect(74, 124, 40, 1.6);
  g.fillRect(74, 134, 56, 1.4);
  g.fillRect(74, 144, 32, 1.4);
  g.fillRect(74, 154, 48, 1.2);
  g.restore();
}

/** Bricks laid one at a time: each one its own clay, its own burn. */
function brickField(g: CanvasRenderingContext2D, kiln: Kiln): void {
  const rand = mulberry(kiln.seed ^ 0x2b1d);
  const BW = 46;
  const BH = 16;
  const base: RGB = { r: 104, g: 84, b: 64 };

  for (let row = 0; row * BH < GROUND + BH; row += 1) {
    const y = row * BH;
    const offset = row % 2 === 0 ? 0 : BW / 2;
    for (let x = -BW; x < VIEW_W + BW; x += BW) {
      const bx = x - offset;
      const heat = rand();
      const tone = (rand() - 0.5) * 0.30;
      const c = {
        r: clamp(base.r + tone * 54 + (heat - 0.5) * 40, 52, 196),
        g: clamp(base.g + tone * 40 + (heat - 0.5) * 28, 38, 168),
        b: clamp(base.b + tone * 26 + (heat - 0.5) * 18, 28, 140),
      };
      g.fillStyle = `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
      g.fillRect(bx + 1, y + 1, BW - 2, BH - 2);

      // a chipped corner, now and then
      if (rand() < 0.07) {
        const corner = rand() < 0.5 ? -1 : 1;
        const cw = 5 + rand() * 9;
        g.fillStyle = 'rgba(74,56,40,0.55)';
        g.beginPath();
        if (corner < 0) {
          g.moveTo(bx + 1, y + 1);
          g.lineTo(bx + 1 + cw, y + 1);
          g.lineTo(bx + 1, y + 1 + cw * 0.7);
        } else {
          g.moveTo(bx + BW - 1, y + 1);
          g.lineTo(bx + BW - 1 - cw, y + 1);
          g.lineTo(bx + BW - 1, y + 1 + cw * 0.7);
        }
        g.closePath();
        g.fill();
      }

      // mortar: a lit arris on top, a shadowed joint beneath
      g.fillStyle = 'rgba(255,236,206,0.13)';
      g.fillRect(bx + 1, y + 1, BW - 2, 1.2);
      g.fillStyle = 'rgba(10,6,3,0.62)';
      g.fillRect(bx + 1, y + BH - 2, BW - 2, 1.5);
      g.fillStyle = 'rgba(38,25,16,0.22)';
      g.fillRect(bx + 1, y + 1, 1, BH - 2);
    }
  }
}

/** The cut face: the brick has been sliced, so its section is paler and rough. */
function cutFace(g: CanvasRenderingContext2D): void {
  const rand = mulberry(0x7c31);
  g.save();
  g.beginPath();
  archPath(g, VAULT, GROUND);
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(226,206,178,0.9)';
  g.stroke();
  g.lineWidth = 2.2;
  g.strokeStyle = 'rgba(248,236,214,0.75)';
  g.stroke();
  g.restore();

  // the lip of the opening is lit by what is inside it
  g.save();
  g.beginPath();
  archPath(g, VAULT, GROUND);
  g.strokeStyle = 'rgba(255,186,116,0.5)';
  g.lineWidth = 2.4;
  g.shadowColor = 'rgba(255,140,60,0.65)';
  g.shadowBlur = 14;
  g.stroke();
  g.restore();

  // a fine dusting of broken brick along the cut
  g.save();
  g.beginPath();
  archPath(g, VAULT, GROUND);
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(240,224,200,0.16)';
  g.stroke();
  g.restore();
  void rand;
}

/** Voussoirs: the ring of wedge-shaped bricks that carries the arch. */
function archRing(g: CanvasRenderingContext2D, kiln: Kiln): void {
  const rand = mulberry(kiln.seed ^ 0x9a17);
  const N = 29;
  const x0 = VAULT.cx - VAULT.a - 6;
  const x1 = VAULT.cx + VAULT.a + 6;
  const depth = 34;

  const inner: Array<[number, number]> = [];
  const outer: Array<[number, number]> = [];
  for (let i = 0; i <= N; i += 1) {
    const x = x0 + ((x1 - x0) * i) / N;
    inner.push([x, innerY(x)]);
    // the normal, pointing up and away from the chamber
    const xa = x0 + ((x1 - x0) * Math.max(0, i - 1)) / N;
    const xb = x0 + ((x1 - x0) * Math.min(N, i + 1)) / N;
    const tx = xb - xa;
    const ty = innerY(xb) - innerY(xa);
    const len = Math.hypot(tx, ty) || 1;
    const nx = ty / len;
    const ny = -tx / len;
    outer.push([x + nx * depth, innerY(x) + ny * depth]);
  }

  for (let i = 0; i < N; i += 1) {
    const a = inner[i]!;
    const b = inner[i + 1]!;
    const c = outer[i + 1]!;
    const d = outer[i]!;
    const tone = (rand() - 0.5) * 0.4;
    const warm = rand();
    const r = Math.round(clamp(132 + tone * 62 + warm * 34, 84, 206));
    const gg = Math.round(clamp(94 + tone * 44 + warm * 16, 56, 158));
    const bb = Math.round(clamp(68 + tone * 30, 40, 126));
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(c[0], c[1]);
    g.lineTo(d[0], d[1]);
    g.closePath();
    g.fillStyle = `rgb(${r},${gg},${bb})`;
    g.fill();

    // every voussoir is a brick: one joint line on its outer edge
    g.strokeStyle = 'rgba(52,36,24,0.34)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }

  // the ring's outer arris, then a shadow under the whole ring
  g.beginPath();
  for (let i = 0; i < outer.length; i += 1) {
    const p = outer[i]!;
    if (i === 0) g.moveTo(p[0], p[1]);
    else g.lineTo(p[0], p[1]);
  }
  g.strokeStyle = 'rgba(240,226,204,0.34)';
  g.lineWidth = 1.4;
  g.stroke();
}

/** Soot and heat: the wall remembers the fire even where the flame never was. */
function shellTint(g: CanvasRenderingContext2D): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const halo = g.createRadialGradient(
      c.x + c.w / 2,
      GROUND - 40,
      30,
      c.x + c.w / 2,
      GROUND - 40,
      c.w * 1.5
    );
    halo.addColorStop(0, 'rgba(24,13,8,0.66)');
    halo.addColorStop(0.38, 'rgba(24,13,8,0.30)');
    halo.addColorStop(0.72, 'rgba(24,13,8,0.10)');
    halo.addColorStop(1, 'rgba(28,16,9,0)');
    g.fillStyle = halo;
    g.fillRect(c.x - c.w, 0, c.w * 3, GROUND);
  }

  // a lime wash that has weathered off in patches, high on the wall
  const rand = mulberry(0x3311);
  for (let i = 0; i < 34; i += 1) {
    const x = rand() * VIEW_W;
    const y = rand() * 210;
    const r = 26 + rand() * 90;
    const wash = g.createRadialGradient(x, y, 0, x, y, r);
    wash.addColorStop(0, `rgba(248,240,226,${(0.05 + rand() * 0.09).toFixed(3)})`);
    wash.addColorStop(1, 'rgba(248,240,226,0)');
    g.fillStyle = wash;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // the top of the wall goes black: no flame reaches it
  const crown = g.createLinearGradient(0, 0, 0, 250);
  crown.addColorStop(0, 'rgba(10,6,4,0.86)');
  crown.addColorStop(0.5, 'rgba(10,6,4,0.42)');
  crown.addColorStop(1, 'rgba(10,6,4,0)');
  g.fillStyle = crown;
  g.fillRect(0, 0, VIEW_W, 250);
}

/** Inside the barrel: dark, but never empty. Soot, spalling, a lit floor. */
function chamber(g: CanvasRenderingContext2D, kiln: Kiln): void {
  g.save();
  g.beginPath();
  archPath(g, VAULT, GROUND);
  g.clip();

  const body = g.createLinearGradient(0, 90, 0, GROUND);
  body.addColorStop(0, '#080504');
  body.addColorStop(0.3, '#100a06');
  body.addColorStop(0.62, '#1c100a');
  body.addColorStop(0.86, '#301a0d');
  body.addColorStop(1, '#4a2611');
  g.fillStyle = body;
  g.fillRect(0, 0, VIEW_W, GROUND);

  // light climbs: the vault is warm a hand above the coals and black at the crown
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const lamp = g.createRadialGradient(
      c.x + c.w / 2,
      GROUND - 16,
      12,
      c.x + c.w / 2,
      GROUND - 16,
      330
    );
    lamp.addColorStop(0, 'rgba(255,178,96,0.34)');
    lamp.addColorStop(0.32, 'rgba(226,118,52,0.17)');
    lamp.addColorStop(0.62, 'rgba(176,64,20,0.07)');
    lamp.addColorStop(1, 'rgba(150,40,10,0)');
    g.fillStyle = lamp;
    g.fillRect(c.x - 90, 70, c.w + 180, GROUND - 70);
  }

  // red-hot brick: the vault throws the fire back down at you
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const arch = g.createLinearGradient(0, VAULT.rise + 40, 0, GROUND);
    arch.addColorStop(0, 'rgba(120,26,6,0)');
    arch.addColorStop(0.45, 'rgba(150,38,10,0.10)');
    arch.addColorStop(0.78, 'rgba(196,66,18,0.20)');
    arch.addColorStop(1, 'rgba(226,96,28,0.30)');
    g.fillStyle = arch;
    g.fillRect(c.x - 8, 90, c.w + 16, GROUND - 90);
  }

  // sagger columns standing at the back of each chamber: depth, not decoration
  const deep = mulberry(kiln.seed ^ 0x1211);
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const columns = 3;
    for (let i = 0; i < columns; i += 1) {
      const cx = c.x + 24 + (i * (c.w - 48)) / (columns - 1) + (deep() - 0.5) * 10;
      const top = 190 + deep() * 60;
      const cw = 15 + deep() * 4;
      const stack = g.createLinearGradient(cx - cw, 0, cx + cw, 0);
      stack.addColorStop(0, 'rgba(12,7,4,0.9)');
      stack.addColorStop(0.45, 'rgba(58,34,20,0.85)');
      stack.addColorStop(1, 'rgba(10,6,3,0.9)');
      g.fillStyle = stack;
      g.fillRect(cx - cw, top, cw * 2, GROUND - top);
      for (let y = top; y < GROUND; y += 13) {
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.fillRect(cx - cw, y, cw * 2, 1);
        g.fillStyle = 'rgba(255,170,110,0.05)';
        g.fillRect(cx - cw, y + 1, cw * 2, 0.8);
      }
    }
  }

  // the vault's own brickwork, almost lost in the dark
  const rand = mulberry(kiln.seed ^ 0x4d21);
  const BH = 21;
  for (let row = 0; row * BH < 200; row += 1) {
    const y = 90 + row * BH;
    g.strokeStyle = 'rgba(140,88,52,0.10)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(VIEW_W, y);
    g.stroke();
    const offset = row % 2 === 0 ? 0 : 30;
    for (let x = -30; x < VIEW_W; x += 60) {
      g.beginPath();
      g.moveTo(x - offset, y);
      g.lineTo(x - offset, y + BH);
      g.stroke();
    }
  }
  void rand;

  const sootRand = mulberry(kiln.seed ^ 0x61f3);
  for (let i = 0; i < 26; i += 1) {
    const x = 200 + sootRand() * 600;
    const y = 120 + sootRand() * 260;
    const r = 24 + sootRand() * 70;
    const smudge = g.createRadialGradient(x, y, 0, x, y, r);
    smudge.addColorStop(0, `rgba(0,0,0,${(0.16 + sootRand() * 0.2).toFixed(3)})`);
    smudge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = smudge;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // haze: the back of the chamber sits in its own smoke
  const haze = g.createLinearGradient(0, 96, 0, GROUND);
  haze.addColorStop(0, 'rgba(74,38,18,0.34)');
  haze.addColorStop(0.45, 'rgba(64,32,15,0.12)');
  haze.addColorStop(1, 'rgba(54,26,12,0.02)');
  g.fillStyle = haze;
  g.fillRect(0, 96, VIEW_W, GROUND - 96);

  // the reveal: the cut edge of the tunnel, turning away from us
  for (const side of [-1, 1] as const) {
    const edge = side < 0 ? VAULT.cx - VAULT.a : VAULT.cx + VAULT.a;
    const wall = g.createLinearGradient(edge, 0, edge - side * 22, 0);
    wall.addColorStop(0, 'rgba(6,4,3,0.95)');
    wall.addColorStop(0.55, 'rgba(46,26,15,0.75)');
    wall.addColorStop(1, 'rgba(96,56,32,0.25)');
    g.fillStyle = wall;
    g.fillRect(side < 0 ? edge : edge - 22, VAULT.spring - 6, 22, GROUND - VAULT.spring + 6);
    g.fillStyle = 'rgba(255,186,120,0.14)';
    g.fillRect(side < 0 ? edge + 20 : edge - 21, VAULT.spring, 1.6, GROUND - VAULT.spring);
  }

  g.restore();
}

/** Two firewalls. Each has a slot at the floor where the flame climbs through. */
function piers(g: CanvasRenderingContext2D): void {
  const bands: Array<[number, number]> = [
    [CHAMBER.mouth.x + CHAMBER.mouth.w, CHAMBER.body.x],
    [CHAMBER.body.x + CHAMBER.body.w, CHAMBER.tail.x],
  ];

  for (const [x0, x1] of bands) {
    const top = Math.min(innerY(x0), innerY(x1)) - 6;
    const w = x1 - x0;

    g.save();
    g.beginPath();
    g.moveTo(x0, GROUND);
    g.lineTo(x0, top);
    g.quadraticCurveTo((x0 + x1) / 2, top - 14, x1, top);
    g.lineTo(x1, GROUND);
    g.closePath();
    g.clip();

    // the wall is fired brick, seen from the fire side: scorched, crazed, pale
    const fill = g.createLinearGradient(x0, 0, x1, 0);
    fill.addColorStop(0, '#150c07');
    fill.addColorStop(0.18, '#4a2a17');
    fill.addColorStop(0.45, '#6b4022');
    fill.addColorStop(0.7, '#3a2113');
    fill.addColorStop(1, '#120b06');
    g.fillStyle = fill;
    g.fillRect(x0, top - 24, w, GROUND - top + 24);

    const rand = mulberry(0x5c11);
    for (let y = top; y < GROUND; y += 11) {
      // courses, unevenly fired
      for (let i = 0; i < 2; i += 1) {
        const bw = w / 2;
        const bx = x0 + i * bw + (rand() - 0.5) * 2;
        g.fillStyle = `rgba(${Math.round(96 + rand() * 46)},${Math.round(58 + rand() * 26)},${Math.round(
          32 + rand() * 16
        )},0.34)`;
        g.fillRect(bx, y, bw - 1, 10);
      }
      g.fillStyle = 'rgba(0,0,0,0.42)';
      g.fillRect(x0, y + 10, w, 1);
      g.fillStyle = 'rgba(255,180,120,0.10)';
      g.fillRect(x0, y + 11, w, 0.8);
    }

    // the throat: a slot with a keystone, the way the flame gets through
    const sx = (x0 + x1) / 2;
    const sw = 20;
    const sh = 76;
    g.beginPath();
    g.moveTo(sx - sw / 2, GROUND - 4);
    g.lineTo(sx - sw / 2, GROUND - sh + 14);
    g.quadraticCurveTo(sx, GROUND - sh - 10, sx + sw / 2, GROUND - sh + 14);
    g.lineTo(sx + sw / 2, GROUND - 4);
    g.closePath();
    g.fillStyle = '#070403';
    g.fill();
    g.restore();

    const glow = g.createLinearGradient(0, GROUND - 4, 0, GROUND - sh);
    glow.addColorStop(0, 'rgba(255,236,190,0.95)');
    glow.addColorStop(0.35, 'rgba(255,160,64,0.75)');
    glow.addColorStop(1, 'rgba(170,48,12,0.05)');
    g.fillStyle = glow;
    g.beginPath();
    g.moveTo(sx - sw / 2, GROUND - 4);
    g.lineTo(sx - sw / 2, GROUND - sh + 14);
    g.quadraticCurveTo(sx, GROUND - sh - 10, sx + sw / 2, GROUND - sh + 14);
    g.lineTo(sx + sw / 2, GROUND - 4);
    g.closePath();
    g.fill();

    // the brick around the throat has run pale with heat
    const burn = g.createRadialGradient(sx, GROUND - sh / 2, 4, sx, GROUND - sh / 2, 58);
    burn.addColorStop(0, 'rgba(255,204,140,0.34)');
    burn.addColorStop(1, 'rgba(255,204,140,0)');
    g.fillStyle = burn;
    g.fillRect(sx - 62, GROUND - 150, 124, 150);
  }
}

/** Shelves: kiln boards carried on props, the way they really stand. */
function shelves(g: CanvasRenderingContext2D): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const left = c.x - 24;
    const right = c.x + c.w + 24;
    const w = right - left;

    for (let i = 0; i < SHELF_Y.length; i += 1) {
      const y = SHELF_Y[i]!;
      const below = i + 1 < SHELF_Y.length ? SHELF_Y[i + 1]! : GROUND;

      // props first: three little pillars, so the board is carried, not glued
      const props = [left + 24, left + w / 2, right - 24];
      for (const px of props) {
        const top = y + 10;
        const h = below - top;
        if (h < 6) continue;
        const prop = g.createLinearGradient(px - 3, 0, px + 3, 0);
        prop.addColorStop(0, '#2e1f13');
        prop.addColorStop(0.28, '#8d6b48');
        prop.addColorStop(0.5, '#6f5136');
        prop.addColorStop(1, '#241710');
        g.fillStyle = prop;
        g.fillRect(px - 3, top, 6, h);
        g.fillStyle = 'rgba(255,206,150,0.18)';
        g.fillRect(px - 3, top, 1, h);
      }

      // the board: a thin lit top face, a thick fireclay edge
      const board = g.createLinearGradient(0, y - 1, 0, y + 10);
      board.addColorStop(0, '#8a6c4e');
      board.addColorStop(0.18, '#6a4f38');
      board.addColorStop(0.65, '#4b3626');
      board.addColorStop(1, '#291b12');
      g.fillStyle = board;
      g.fillRect(left, y, w, 9.5);

      g.fillStyle = 'rgba(255,226,182,0.42)';
      g.fillRect(left, y - 0.8, w, 1.4);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(left, y + 9.5, w, 2.6);

      // the board throws shade down over everything beneath it
      const cast = g.createLinearGradient(0, y + 10, 0, y + 34);
      cast.addColorStop(0, 'rgba(0,0,0,0.55)');
      cast.addColorStop(0.45, 'rgba(0,0,0,0.22)');
      cast.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cast;
      g.fillRect(left, y + 10, w, 24);

      // the board's front edge is where the glaze drips land
      g.fillStyle = 'rgba(0,0,0,0.24)';
      g.fillRect(left + 4, y + 3, w - 8, 0.9);
    }
  }
}

/* ------------------------------------------------------------------ */
/* The yard floor in front of the kiln                                 */
/* ------------------------------------------------------------------ */

function yardFloor(g: CanvasRenderingContext2D): void {
  const floor = g.createLinearGradient(0, GROUND, 0, VIEW_H);
  floor.addColorStop(0, '#4e4438');
  floor.addColorStop(0.4, '#3d352c');
  floor.addColorStop(1, '#28221b');
  g.fillStyle = floor;
  g.fillRect(0, GROUND, VIEW_W, VIEW_H - GROUND);

  // flagstones, badly laid
  const rand = mulberry(0x8ab1);
  g.strokeStyle = 'rgba(24,15,9,0.28)';
  g.lineWidth = 1.1;
  for (let row = 0; row < 3; row += 1) {
    const y = GROUND + 6 + row * row * 6 + row * 6;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(VIEW_W, y);
    g.stroke();
    const step = 120 - row * 18;
    for (let x = rand() * step; x < VIEW_W; x += step) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 6, y + 14);
      g.stroke();
    }
  }

  // the hard line where the wall meets the ground
  g.fillStyle = 'rgba(20,12,7,0.55)';
  g.fillRect(0, GROUND - 2, VIEW_W, 3);

  // chips of fired clay and a scatter of ash
  for (let i = 0; i < 90; i += 1) {
    const x = rand() * VIEW_W;
    const y = GROUND + 4 + rand() * (VIEW_H - GROUND - 8);
    const s = rand() * 2.2 + 0.6;
    g.fillStyle = rand() > 0.4 ? 'rgba(214,192,164,0.22)' : 'rgba(28,18,11,0.30)';
    g.fillRect(x, y, s, s * 0.7);
  }
}


/** Pyrometric cones, one per chamber: the honest thermometer of a wood kiln. */
function cones(g: CanvasRenderingContext2D, kiln: Kiln): void {
  const rand = mulberry(kiln.seed ^ 0x3d17);
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const baseX = c.x + 12;
    const baseY = SHELF_Y[2]! - 1;

    // a pad of clay, then the cone leaning as it softens
    g.fillStyle = 'rgba(210,190,164,0.5)';
    g.beginPath();
    g.ellipse(baseX, baseY, 7, 2.4, 0, 0, Math.PI * 2);
    g.fill();

    const lean = 0.16 + rand() * 0.1;
    g.beginPath();
    g.moveTo(baseX - 2.2, baseY);
    g.quadraticCurveTo(baseX - 1.4, baseY - 11, baseX + lean * 9, baseY - 19);
    g.quadraticCurveTo(baseX + 1.8, baseY - 10, baseX + 2.2, baseY);
    g.closePath();
    const body = g.createLinearGradient(baseX, baseY - 19, baseX, baseY);
    body.addColorStop(0, 'rgba(246,236,220,0.75)');
    body.addColorStop(1, 'rgba(190,168,142,0.55)');
    g.fillStyle = body;
    g.fill();
  }
}

/** The yard: what a working kiln has lying about at four in the morning. */
function yardProps(g: CanvasRenderingContext2D, kiln: Kiln): void {
  const rand = mulberry(kiln.seed ^ 0x2f19);

  /* ---- split logs, stacked end-on against the left wall ---- */
  const wx = 8;
  const wy = GROUND + 4;
  g.save();
  g.fillStyle = 'rgba(12,7,4,0.4)';
  g.beginPath();
  g.ellipse(wx + 96, wy + 78, 108, 16, 0, 0, Math.PI * 2);
  g.fill();

  type Log = { x: number; y: number; r: number; rot: number };
  const logs: Log[] = [];
  for (let i = 0; i < 17; i += 1) {
    const band = Math.floor(rand() * 3);
    const y = wy + 46 - band * 15 - rand() * 6;
    const x = wx + 18 + rand() * 124 + band * 6;
    logs.push({ x, y, r: 10 + rand() * 6, rot: (rand() - 0.5) * 0.5 });
  }
  logs.sort((a, b) => a.y - b.y);
  for (const log of logs) {
    g.save();
    g.translate(log.x, log.y);
    g.rotate(log.rot);
    g.fillStyle = '#33241a';
    g.beginPath();
    g.ellipse(0, 0, log.r, log.r * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    const end2 = g.createRadialGradient(-1, -1, 1, 0, 0, log.r * 0.9);
    end2.addColorStop(0, '#cbb08a');
    end2.addColorStop(0.6, '#a98a60');
    end2.addColorStop(1, '#6f5540');
    g.fillStyle = end2;
    g.beginPath();
    g.ellipse(0, 0, log.r * 0.86, log.r * 0.66, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(92,66,44,0.35)';
    g.lineWidth = 0.7;
    for (let k = 1; k <= 2; k += 1) {
      g.beginPath();
      g.ellipse(0, 0, log.r * 0.86 * (k / 3), log.r * 0.66 * (k / 3), 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(24,14,8,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(0, 0, log.r * 0.86, log.r * 0.66, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  g.restore();

  /* ---- a water jar, right, for judging the fire by its reflection ---- */
  const jx = 872;
  const jy = GROUND + 66;
  g.save();
  g.fillStyle = 'rgba(12,7,4,0.42)';
  g.beginPath();
  g.ellipse(jx + 4, jy + 10, 48, 12, 0, 0, Math.PI * 2);
  g.fill();

  const jarBody = new Path2D();
  jarBody.moveTo(jx - 34, jy - 44);
  jarBody.bezierCurveTo(jx - 46, jy - 20, jx - 34, jy + 6, jx, jy + 6);
  jarBody.bezierCurveTo(jx + 34, jy + 6, jx + 46, jy - 20, jx + 34, jy - 44);
  jarBody.closePath();
  const jarGrad = g.createLinearGradient(jx - 40, jy - 50, jx + 40, jy + 6);
  jarGrad.addColorStop(0, '#4a3524');
  jarGrad.addColorStop(0.45, '#6b4c33');
  jarGrad.addColorStop(1, '#2a1b12');
  g.fillStyle = jarGrad;
  g.fill(jarBody);
  g.strokeStyle = 'rgba(20,12,7,0.7)';
  g.lineWidth = 1.2;
  g.stroke(jarBody);

  // the water: a dark disc with the fire in it
  g.beginPath();
  g.ellipse(jx, jy - 44, 34, 8, 0, 0, Math.PI * 2);
  g.fillStyle = '#14100c';
  g.fill();
  g.beginPath();
  g.ellipse(jx, jy - 44, 34, 8, 0, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(232,206,170,0.35)';
  g.lineWidth = 1.4;
  g.stroke();
  g.beginPath();
  g.ellipse(jx - 8, jy - 45, 9, 2.2, -0.2, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,196,120,0.55)';
  g.fill();
  g.restore();

  /* ---- long tongs leaning on the wall, and a rake with them ---- */
  g.save();
  g.strokeStyle = 'rgba(26,17,11,0.9)';
  g.lineCap = 'round';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(700, GROUND + 60);
  g.lineTo(724, GROUND - 46);
  g.moveTo(712, GROUND + 62);
  g.lineTo(730, GROUND - 44);
  g.stroke();
  g.lineWidth = 1.6;
  g.beginPath();
  g.ellipse(727, GROUND - 44, 9, 4, 0.4, 0, Math.PI * 2);
  g.stroke();
  g.restore();

  /* ---- shards: every wood kiln has a pile of failures ---- */
  g.save();
  for (let i = 0; i < 14; i += 1) {
    const x = 260 + rand() * 300;
    const y = GROUND + 10 + rand() * 44;
    const w = 7 + rand() * 15;
    const h = 3 + rand() * 6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w * 0.5, y - h, x + w, y + 1);
    g.quadraticCurveTo(x + w * 0.5, y + h * 0.5, x, y);
    g.fillStyle = rand() > 0.45 ? 'rgba(226,214,192,0.6)' : 'rgba(180,150,116,0.5)';
    g.fill();
    g.strokeStyle = 'rgba(60,40,26,0.35)';
    g.lineWidth = 0.6;
    g.stroke();
  }
  g.restore();

  /* ---- chalk on the wall: tallies of firings, and today's mark ---- */
  g.save();
  g.strokeStyle = 'rgba(244,236,222,0.4)';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  let tx = 76;
  for (let i = 0; i < 13; i += 1) {
    if (i > 0 && i % 5 === 0) {
      g.beginPath();
      g.moveTo(tx - 30, 300);
      g.lineTo(tx - 2, 322);
      g.stroke();
      tx += 10;
    }
    g.beginPath();
    g.moveTo(tx, 298 + rand() * 2);
    g.lineTo(tx + 1.5, 322);
    g.stroke();
    tx += 7;
  }
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Fire                                                                */
/* ------------------------------------------------------------------ */

function drawFire(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  heat: number,
  time: number,
  dt: number
): void {
  const reduced = state.reducedMotion;

  // one bed of coals per chamber, dimmer as the fire runs to the tail
  const strength: Record<Zone, number> = { mouth: 1, body: 0.72, tail: 0.46 };

  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const k = strength[zone] * (0.55 + heat * 0.45);
    const bedTop = GROUND - 56;

    // the light the coals throw up the vault
    const lift = ctx.createRadialGradient(
      c.x + c.w / 2,
      GROUND - 8,
      8,
      c.x + c.w / 2,
      GROUND - 8,
      c.w * 1.55
    );
    lift.addColorStop(0, `rgba(255,206,140,${(0.34 * k).toFixed(3)})`);
    lift.addColorStop(0.32, `rgba(238,126,52,${(0.20 * k).toFixed(3)})`);
    lift.addColorStop(0.7, `rgba(200,70,20,${(0.06 * k).toFixed(3)})`);
    lift.addColorStop(1, 'rgba(190,60,18,0)');
    ctx.fillStyle = lift;
    ctx.fillRect(c.x - c.w, 60, c.w * 3, GROUND - 60);

    // the pit itself: unlit, so the coals read as glowing
    const pit = ctx.createLinearGradient(0, bedTop - 6, 0, GROUND);
    pit.addColorStop(0, 'rgba(8,5,3,0)');
    pit.addColorStop(0.45, 'rgba(8,5,3,0.55)');
    pit.addColorStop(1, 'rgba(6,4,2,0.9)');
    ctx.fillStyle = pit;
    ctx.fillRect(c.x - 4, bedTop - 6, c.w + 8, GROUND - bedTop + 6);

    // ash bed
    const ash = ctx.createLinearGradient(0, bedTop, 0, GROUND);
    ash.addColorStop(0, 'rgba(60,36,22,0)');
    ash.addColorStop(1, `rgba(72,40,22,${(0.5 * k).toFixed(3)})`);
    ctx.fillStyle = ash;
    ctx.fillRect(c.x - 6, bedTop, c.w + 12, GROUND - bedTop);

    // the crown of the vault is nearly at melting point: dull red, additive
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const crown = ctx.createRadialGradient(
      c.x + c.w / 2,
      GROUND - 30,
      26,
      c.x + c.w / 2,
      GROUND - 30,
      400
    );
    crown.addColorStop(0, `rgba(206,66,14,${(0.44 * k).toFixed(3)})`);
    crown.addColorStop(0.32, `rgba(168,44,8,${(0.26 * k).toFixed(3)})`);
    crown.addColorStop(0.68, `rgba(116,24,5,${(0.11 * k).toFixed(3)})`);
    crown.addColorStop(1, 'rgba(80,14,2,0)');
    ctx.fillStyle = crown;
    ctx.fillRect(c.x - 100, 70, c.w + 200, GROUND - 70);
    ctx.restore();

    // individual coals, each with its own breath
    const rand = mulberry(state.kiln.seed ^ (zone.length * 7919) ^ 0x33af);
    for (let i = 0; i < 30; i += 1) {
      const cx = c.x + 6 + rand() * (c.w - 12);
      const cy = GROUND - 4 - rand() * 22;
      const r = 4 + rand() * 9;
      const phase = rand() * Math.PI * 2;
      const pulse = reduced ? 0.7 : 0.62 + Math.sin(time * 0.0035 + phase) * 0.26;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
      glow.addColorStop(0, `rgba(255,240,206,${(0.55 * pulse * k).toFixed(3)})`);
      glow.addColorStop(0.3, `rgba(255,150,58,${(0.5 * pulse * k).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(160,42,10,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 2.4, r * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(38,20,12,${(0.55).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.5, r * 0.95, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // flame tongues: a silhouette with a waist and a sway, lit from its root
    if (!reduced) {
      const tongues = 7;
      for (let i = 0; i < tongues; i += 1) {
        const t = time * 0.0021 + i * 1.31 + zone.length * 0.7;
        const spread = (i + 0.5) / tongues;
        const fx = c.x + 12 + (c.w - 24) * spread + Math.sin(t * 1.2) * 6;
        // the middle of the bed burns highest
        const centre = 1 - Math.abs(spread - 0.5) * 1.35;
        const fh = (34 + centre * 54 + Math.sin(t * 2.3) * 16 + heat * 42) * k;
        const fw = (11 + centre * 8) * (1 + Math.sin(t * 1.6 + i) * 0.12);
        const sway = Math.sin(t * 1.9 + i * 0.8) * fw * 0.7;
        const root = GROUND - 10;

        ctx.beginPath();
        ctx.moveTo(fx - fw, root);
        ctx.bezierCurveTo(
          fx - fw * 0.92,
          root - fh * 0.36,
          fx - fw * 0.34 + sway * 0.5,
          root - fh * 0.72,
          fx + sway,
          root - fh
        );
        ctx.bezierCurveTo(
          fx + fw * 0.3 + sway * 0.5,
          root - fh * 0.58,
          fx + fw * 0.88,
          root - fh * 0.3,
          fx + fw,
          root
        );
        ctx.closePath();

        const fire = ctx.createLinearGradient(0, root, 0, root - fh);
        fire.addColorStop(0, `rgba(255,253,246,${(0.88 * k).toFixed(3)})`);
        fire.addColorStop(0.22, `rgba(255,220,150,${(0.72 * k).toFixed(3)})`);
        fire.addColorStop(0.55, `rgba(250,146,52,${(0.44 * k).toFixed(3)})`);
        fire.addColorStop(0.85, `rgba(206,62,16,${(0.12 * k).toFixed(3)})`);
        fire.addColorStop(1, 'rgba(170,40,10,0)');
        ctx.fillStyle = fire;
        ctx.fill();

        // the hot core: a narrow white blade inside the tongue
        ctx.beginPath();
        ctx.moveTo(fx - fw * 0.34, root);
        ctx.bezierCurveTo(fx - fw * 0.22, root - fh * 0.3, fx - fw * 0.1 + sway * 0.4, root - fh * 0.5, fx + sway * 0.5, root - fh * 0.58);
        ctx.bezierCurveTo(fx + fw * 0.12 + sway * 0.4, root - fh * 0.42, fx + fw * 0.26, root - fh * 0.24, fx + fw * 0.34, root);
        ctx.closePath();
        const core = ctx.createLinearGradient(0, root, 0, root - fh * 0.6);
        core.addColorStop(0, `rgba(255,255,248,${(0.6 * k).toFixed(3)})`);
        core.addColorStop(1, 'rgba(255,210,140,0)');
        ctx.fillStyle = core;
        ctx.fill();
      }
    }

    // embers rising off the bed
    if (!reduced && embers.length < 120) {
      if (Math.random() < 0.7) {
        embers.push({
          x: c.x + 14 + Math.random() * (c.w - 28),
          y: GROUND - 10 - Math.random() * 26,
          vx: (Math.random() - 0.5) * 16,
          vy: -26 - Math.random() * 62,
          life: 1,
          size: 0.6 + Math.random() * 1.4,
        });
      }
    }
  }

  // fire climbs the gaps: tongues reaching up between the boards
  if (!reduced) {
    for (let level = SHELF_Y.length - 1; level >= 1; level -= 1) {
      const low = SHELF_Y[level]! - 2;
      const high = SHELF_Y[level - 1]! + 12;
      const gap = low - high;
      if (gap < 24) continue;
      for (const zone of ZONES) {
        const c = CHAMBER[zone];
        const k = strength[zone] * (0.3 + heat * 0.7) * (level === 2 ? 1 : 0.6);
        const n = 5;
        for (let i = 0; i < n; i += 1) {
          const t = time * 0.0024 + i * 1.9 + level * 3.1 + zone.length;
          const spread = (i + 0.5) / n;
          const fx = c.x + 10 + (c.w - 20) * spread + Math.sin(t * 1.3) * 5;
          const fh = (gap * 0.55 + Math.sin(t * 2.6 + i) * gap * 0.22) * Math.min(1, k + 0.3);
          const fw = 8 + Math.sin(t * 1.5 + i * 2) * 2.4;
          const root = low - 2;
          const sway = Math.sin(t * 1.7 + i) * fw * 0.6;

          ctx.beginPath();
          ctx.moveTo(fx - fw, root);
          ctx.bezierCurveTo(fx - fw * 0.9, root - fh * 0.4, fx - fw * 0.2 + sway, root - fh * 0.75, fx + sway, root - fh);
          ctx.bezierCurveTo(fx + fw * 0.3 + sway, root - fh * 0.6, fx + fw * 0.9, root - fh * 0.3, fx + fw, root);
          ctx.closePath();
          const g3 = ctx.createLinearGradient(0, root, 0, root - fh);
          g3.addColorStop(0, `rgba(255,242,206,${(0.34 * k).toFixed(3)})`);
          g3.addColorStop(0.45, `rgba(244,140,50,${(0.22 * k).toFixed(3)})`);
          g3.addColorStop(1, 'rgba(190,50,12,0)');
          ctx.fillStyle = g3;
          ctx.fill();
        }
      }
    }
  }

  // bloom: one wide, soft halo per chamber, added rather than painted over
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const k = strength[zone] * (0.4 + heat * 0.6);
    const halo = ctx.createRadialGradient(
      c.x + c.w / 2,
      GROUND - 24,
      10,
      c.x + c.w / 2,
      GROUND - 24,
      260
    );
    halo.addColorStop(0, `rgba(255,196,124,${(0.16 * k).toFixed(3)})`);
    halo.addColorStop(0.4, `rgba(240,132,52,${(0.07 * k).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(200,70,20,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(c.x - 180, GROUND - 300, c.w + 360, 380);
  }
  ctx.restore();

  // embers drift, whatever chamber they came from
  const step = Math.min(dt, 48) / 1000;
  for (let i = embers.length - 1; i >= 0; i -= 1) {
    const e = embers[i]!;
    e.x += e.vx * step;
    e.y += e.vy * step;
    e.vy -= 3 * step;
    e.life -= step * 0.26;
    if (e.life <= 0) {
      embers.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(255,${140 + Math.floor(90 * e.life)},70,${(e.life * 0.8).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Smoke: slow, cool, and only where the flame is. */
function drawSmoke(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  heat: number,
  time: number
): void {
  if (state.reducedMotion) return;
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const rand = mulberry(state.kiln.seed ^ (zone.charCodeAt(0) * 31) ^ 0x5ac1);
    const n = zone === 'mouth' ? 7 : zone === 'body' ? 6 : 4;
    for (let i = 0; i < n; i += 1) {
      const seedX = rand();
      const seedY = rand();
      const seedR = rand();
      const drift = Math.sin(time * 0.0004 + i * 1.9 + seedX * 6) * 22;
      const rise = ((time * 0.012 + seedY * 260) % 300) * -1;
      const x = c.x + 18 + seedX * (c.w - 36) + drift;
      const y = GROUND - 70 + rise;
      if (y < 110) continue;
      const r = 30 + seedR * 46;
      const a = (0.05 + heat * 0.05) * (1 - Math.abs(y - (GROUND - 70)) / 420);
      const puff = ctx.createRadialGradient(x, y, 0, x, y, r);
      puff.addColorStop(0, `rgba(150,138,126,${Math.max(0, a).toFixed(3)})`);
      puff.addColorStop(1, 'rgba(150,138,126,0)');
      ctx.fillStyle = puff;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------------------ */
/* The ware                                                            */
/* ------------------------------------------------------------------ */

type Profile = Array<[number, number]>;

const PROFILES: Record<WareForm, Profile> = {
  // wide and shallow, the lip flared
  bowl: [
    [0.0, 0.26],
    [0.02, 0.3],
    [0.07, 0.37],
    [0.16, 0.44],
    [0.28, 0.49],
    [0.42, 0.525],
    [0.52, 0.54],
  ],
  // belly, shoulder, short neck
  jar: [
    [0.0, 0.28],
    [0.04, 0.36],
    [0.13, 0.44],
    [0.27, 0.485],
    [0.43, 0.49],
    [0.57, 0.445],
    [0.67, 0.345],
    [0.71, 0.295],
    [0.745, 0.3],
    [0.765, 0.32],
  ],
  // tall, high shoulder, long neck
  vase: [
    [0.0, 0.19],
    [0.03, 0.235],
    [0.1, 0.3],
    [0.22, 0.355],
    [0.38, 0.375],
    [0.53, 0.35],
    [0.65, 0.265],
    [0.73, 0.19],
    [0.87, 0.155],
    [0.965, 0.17],
    [1.0, 0.2],
  ],
  // wide and flat, the rim turned up
  plate: [
    [0.0, 0.24],
    [0.02, 0.3],
    [0.05, 0.44],
    [0.12, 0.56],
    [0.22, 0.62],
    [0.3, 0.63],
  ],
  // a tea bowl: cone, small foot
  cup: [
    [0.0, 0.14],
    [0.03, 0.18],
    [0.1, 0.3],
    [0.22, 0.42],
    [0.34, 0.465],
    [0.38, 0.47],
  ],
  // lotus basin: wide, everted lip
  basin: [
    [0.0, 0.26],
    [0.03, 0.32],
    [0.08, 0.48],
    [0.18, 0.58],
    [0.32, 0.605],
    [0.41, 0.6],
    [0.42, 0.55],
  ],
  // double gourd: two bellies, a waist
  gourd: [
    [0.0, 0.16],
    [0.03, 0.22],
    [0.1, 0.34],
    [0.2, 0.4],
    [0.3, 0.36],
    [0.38, 0.24],
    [0.44, 0.215],
    [0.52, 0.31],
    [0.64, 0.355],
    [0.74, 0.28],
    [0.82, 0.16],
    [0.88, 0.145],
  ],
  // plum vase: small mouth, heavy shoulder, long taper
  meiping: [
    [0.0, 0.17],
    [0.03, 0.21],
    [0.12, 0.28],
    [0.28, 0.345],
    [0.42, 0.36],
    [0.56, 0.33],
    [0.7, 0.25],
    [0.82, 0.17],
    [0.9, 0.135],
    [0.95, 0.15],
  ],
  // ovoid, narrow at the neck
  egg: [
    [0.0, 0.22],
    [0.05, 0.32],
    [0.16, 0.41],
    [0.34, 0.445],
    [0.52, 0.43],
    [0.68, 0.37],
    [0.8, 0.27],
    [0.88, 0.19],
    [0.92, 0.185],
  ],
};

type VesselOpts = {
  mine: boolean;
  grade?: string | undefined;
  alpha?: number;
  /** 0 = standing in shadow, 1 = directly over the coals */
  lit?: number;
};

/**
 * A thrown pot. Silhouette from the profile; volume from a three-stop glaze
 * that breaks pale on the lip and pools dark at the foot; life from a foot
 * ring, throwing rings and one specular that follows the belly.
 */
function drawVessel(
  ctx: CanvasRenderingContext2D,
  form: RenderPiece['form'],
  cx: number,
  baseY: number,
  unit: number,
  glaze: string,
  opts: VesselOpts
): void {
  const prof = PROFILES[form];
  const alpha = opts.alpha ?? 1;
  const lit = opts.lit ?? 0.6;
  const base = parseHex(glaze);

  const pts: Array<[number, number]> = prof.map(([y, r]) => [cx - r * unit, baseY - y * unit]);
  const right: Array<[number, number]> = prof.map(([y, r]) => [cx + r * unit, baseY - y * unit]);
  const top = prof[prof.length - 1]!;
  const topY = baseY - top[0] * unit;
  const topR = top[1] * unit;
  const foot = prof[0]!;
  const footR = foot[1] * unit;

  // contact shadow, tight and dark: the pot is standing on the board
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  const shadow = ctx.createRadialGradient(cx, baseY + 1, 0, cx, baseY + 1, footR * 1.6);
  shadow.addColorStop(0, 'rgba(12,7,4,0.9)');
  shadow.addColorStop(1, 'rgba(12,7,4,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, footR * 1.6, Math.max(2.4, footR * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const body = new Path2D();
  body.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i += 1) body.lineTo(pts[i]![0], pts[i]![1]);
  body.lineTo(top[1] === 0 ? cx : cx + topR, topY);
  // over the mouth, slightly hollow
  body.quadraticCurveTo(cx, topY - topR * 0.22, cx - topR, topY);
  for (let i = right.length - 1; i >= 0; i -= 1) body.lineTo(right[i]![0], right[i]![1]);
  body.closePath();

  ctx.save();
  ctx.globalAlpha = alpha;

  // the body: glaze, lit from below by the coals
  const vertical = ctx.createLinearGradient(0, topY, 0, baseY);
  vertical.addColorStop(0, shade(base, -0.34 + lit * 0.16));
  vertical.addColorStop(0.28, shade(base, -0.14 + lit * 0.1));
  vertical.addColorStop(0.62, shade(base, 0.06 + lit * 0.12));
  vertical.addColorStop(0.9, shade(base, 0.12 + lit * 0.24));
  vertical.addColorStop(1, shade(base, -0.2));
  ctx.fillStyle = vertical;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);

  // the near side turns away from the fire: a vertical core shadow
  const core = ctx.createLinearGradient(cx - topR * 1.1, 0, cx + topR * 1.4, 0);
  core.addColorStop(0, 'rgba(14,9,6,0.34)');
  core.addColorStop(0.34, 'rgba(14,9,6,0.02)');
  core.addColorStop(0.62, 'rgba(14,9,6,0.10)');
  core.addColorStop(1, 'rgba(10,6,4,0.52)');
  ctx.fillStyle = core;
  ctx.fillRect(cx - topR * 1.6, topY - 4, topR * 3.2, baseY - topY + 8);

  // the coals light the underside of every pot
  const kick = ctx.createLinearGradient(0, baseY, 0, baseY - unit * 0.5);
  kick.addColorStop(0, `rgba(255,158,72,${(0.30 * lit).toFixed(3)})`);
  kick.addColorStop(0.5, `rgba(255,140,58,${(0.10 * lit).toFixed(3)})`);
  kick.addColorStop(1, 'rgba(255,130,50,0)');
  ctx.fillStyle = kick;
  ctx.fillRect(cx - topR * 1.6, baseY - unit * 0.5, topR * 3.2, unit * 0.5);

  // glaze pools thick at the foot: darker, cooler, and slightly glossy
  const pool = ctx.createLinearGradient(0, baseY, 0, baseY - unit * 0.24);
  pool.addColorStop(0, `rgba(10,6,4,${(0.34 + lit * 0.1).toFixed(3)})`);
  pool.addColorStop(1, 'rgba(10,6,4,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(cx - topR * 1.6, baseY - unit * 0.24, topR * 3.2, unit * 0.24);

  // throwing rings: three or four, only where the light rakes across
  ctx.strokeStyle = `rgba(10,7,5,${(0.10 + lit * 0.08).toFixed(3)})`;
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 4; i += 1) {
    const y = baseY - unit * (0.16 + i * 0.19);
    ctx.beginPath();
    ctx.ellipse(cx, y, topR * 0.94, Math.max(1.2, unit * 0.02), 0, Math.PI * 0.06, Math.PI * 0.94);
    ctx.stroke();
  }

  // one specular, broken by the curvature of the belly
  const spec = ctx.createLinearGradient(cx - topR * 0.9, baseY - unit * 0.6, cx, baseY - unit * 0.2);
  spec.addColorStop(0, `rgba(255,252,242,${(0.06 + lit * 0.14).toFixed(3)})`);
  spec.addColorStop(0.6, `rgba(255,250,238,${(0.02 + lit * 0.06).toFixed(3)})`);
  spec.addColorStop(1, 'rgba(255,250,238,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(cx - topR * 1.1, topY, topR * 1.2, baseY - topY);

  // glaze that ran: two thin drips below the lip
  ctx.strokeStyle = shade(base, -0.28);
  ctx.lineWidth = Math.max(0.9, unit * 0.016);
  ctx.lineCap = 'round';
  for (const dx of [-0.42, 0.5]) {
    const sx = cx + topR * dx;
    ctx.beginPath();
    ctx.moveTo(sx, topY + 1);
    ctx.quadraticCurveTo(sx + topR * 0.04, topY + unit * 0.12, sx - topR * 0.02, topY + unit * 0.2);
    ctx.stroke();
  }

  // the far edge catches the fire: a rim of light down the right side
  ctx.strokeStyle = `rgba(255,214,156,${(0.18 + lit * 0.34).toFixed(3)})`;
  ctx.lineWidth = Math.max(1, unit * 0.018);
  ctx.beginPath();
  for (let i = 0; i < right.length; i += 1) {
    const p = right[i]!;
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();

  ctx.restore();

  // the mouth: a dark ellipse, then the lip ring
  ctx.beginPath();
  ctx.ellipse(cx, topY, topR, Math.max(1.4, topR * 0.26), 0, 0, Math.PI * 2);
  ctx.fillStyle = shade(base, -0.62);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,236,198,${(0.2 + lit * 0.4).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.9, unit * 0.016);
  ctx.stroke();

  // foot ring: a crisp turned edge, and the unglazed clay inside it
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 0.6, footR * 0.96, Math.max(1.6, footR * 0.24), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(208,188,160,0.30)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,10,6,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  // a piece fired past its range gets a chalky film, not a different shape
  if (opts.grade === 'under' || opts.grade === 'over') {
    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#e8ded0';
    ctx.fill(body);
    ctx.restore();
  }

  // every pot gets a contour: the edge is where the glaze ends and the soot starts
  ctx.save();
  ctx.globalAlpha = alpha * (opts.mine ? 0.75 : 0.55);
  ctx.strokeStyle = `rgba(8,5,3,${opts.mine ? 0.7 : 0.55})`;
  ctx.lineWidth = opts.mine ? 1.1 : 0.85;
  ctx.stroke(body);
  ctx.restore();
}


/**
 * An unclaimed shelf still has a life: stacked saggars, a wad of clay, the
 * setters from yesterday's firing. A kiln is never a row of empty boxes.
 */
function drawFurniture(ctx: CanvasRenderingContext2D, kiln: Kiln, slot: Slot): void {
  const rect = slotRect(slot);
  const baseY = rect.y + rect.h + 1;
  const rand = mulberry((kiln.seed ^ (slot.zone.length * 7919)) + slot.row * 131 + slot.zone.charCodeAt(0));
  const roll = rand();
  // most free shelves hold raw bisque; the rest hold saggars or setters
  const kind = roll < 0.55 ? 2 : roll < 0.8 ? 0 : 1;

  if (kind === 0) {
    // a stack of sagger rings, roughly aligned
    const stacks = 1 + Math.floor(rand() * 2);
    for (let s = 0; s < stacks; s += 1) {
      const cx = rect.x + 34 + rand() * (rect.w - 68);
      const rings = 3 + Math.floor(rand() * 3);
      for (let r = 0; r < rings; r += 1) {
        const w = 23 + rand() * 3;
        const cy = baseY - 2 - r * 12.5;
        const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
        g.addColorStop(0, '#241710');
        g.addColorStop(0.35, '#5d4732');
        g.addColorStop(0.62, '#4a3626');
        g.addColorStop(1, '#1d120c');
        ctx.fillStyle = g;
        ctx.fillRect(cx - w, cy - 11.5, w * 2, 11.5);
        ctx.fillStyle = 'rgba(255,196,140,0.20)';
        ctx.fillRect(cx - w, cy - 11.5, w * 2, 1.2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(cx - w, cy - 0.7, w * 2, 1.4);
      }
    }
  } else if (kind === 1) {
    // a nest of setters and one sagger lying on its side
    const cx = rect.x + rect.w / 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cx - 16 + i * 11, baseY - 3 - i * 0.4, 9, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${70 + i * 6},${52 + i * 4},${38 + i * 3},0.85)`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,150,0.14)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  } else {
    // raw bisque, unglazed and dim: it fills the kiln, and it is not for sale
    const forms: WareForm[] = ['bowl', 'plate', 'cup', 'basin', 'jar', 'gourd', 'vase', 'meiping', 'egg'];
    // glazes of the whole kiln: celadon, cobalt, copper red, ash, tenmoku, moon-white
    const glazes = [
      '#8FB3A4', '#7E9BD1', '#BE6A46', '#9DB4C6', '#A8BE72',
      '#A9C6E8', '#5F8298', '#C9A227', '#D8C9AE', '#6E7F6A',
      '#B4705A', '#7C8AA8',
    ];
    const n = 3 + Math.floor(rand() * 2);
    const gap = Math.min(42, (rect.w - 16) / n);
    for (let i = 0; i < n; i += 1) {
      const fx = rect.x + rect.w / 2 - (gap * (n - 1)) / 2 + i * gap;
      const form = forms[Math.floor(rand() * forms.length)] ?? 'bowl';
      // a few are still raw, waiting their turn
      const raw = rand() < 0.18;
      drawVessel(
        ctx,
        form,
        fx,
        baseY,
        (SHELF_H + 3) * 0.78,
        raw ? '#4b3f34' : glazes[Math.floor(rand() * glazes.length)] ?? '#8FB3A4',
        {
          mine: false,
          // not ours, and further from the fire: dimmer, but still glazed
          alpha: raw ? 0.45 : 0.78,
          lit: raw ? 0.24 : 0.44,
        }
      );
    }
    const ash = ctx.createLinearGradient(0, baseY - 8, 0, baseY);
    ash.addColorStop(0, 'rgba(196,176,150,0)');
    ash.addColorStop(1, 'rgba(196,176,150,0.16)');
    ctx.fillStyle = ash;
    ctx.fillRect(rect.x + 4, baseY - 8, rect.w - 8, 8);
    ctx.beginPath();
    const sx = rect.x + rect.w * (0.3 + rand() * 0.4);
    ctx.moveTo(sx, baseY - 2);
    ctx.quadraticCurveTo(sx + 9, baseY - 8, sx + 18, baseY - 3);
    ctx.quadraticCurveTo(sx + 9, baseY - 1, sx, baseY - 2);
    ctx.fillStyle = 'rgba(228,216,194,0.45)';
    ctx.fill();
  }
}

/** Redrawn after the ware: a board has a front edge, and it hides their feet. */
function shelfFronts(ctx: CanvasRenderingContext2D): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const left = c.x - 24;
    const w = c.w + 48;
    for (const y of SHELF_Y) {
      const board = ctx.createLinearGradient(0, y, 0, y + 10);
      board.addColorStop(0, '#6a4f38');
      board.addColorStop(0.55, '#4b3626');
      board.addColorStop(1, '#291b12');
      ctx.fillStyle = board;
      ctx.fillRect(left, y + 1.5, w, 8);
      ctx.fillStyle = 'rgba(255,226,182,0.34)';
      ctx.fillRect(left, y + 1.5, w, 1.1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(left, y + 9.5, w, 2.4);
    }
  }
}

function drawPieces(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const bySlot = new Map<string, RenderPiece[]>();
  for (const p of state.pieces) {
    const list = bySlot.get(p.slotId);
    if (list) list.push(p);
    else bySlot.set(p.slotId, [p]);
  }

  for (const slot of state.kiln.slots) {
    const list = bySlot.get(slot.id);
    if (!list || list.length === 0) {
      drawFurniture(ctx, state.kiln, slot);
      continue;
    }
    const rect = slotRect(slot);
    const n = list.length;

    // fewer pieces means each can be bigger — up to the height of the shelf
    const unit = (SHELF_H + 3) * (n >= 4 ? 0.7 : n === 3 ? 0.78 : n === 2 ? 0.9 : 1.02);
    const gap = Math.min(70, (rect.w - 18) / n);
    const startX = rect.x + rect.w / 2 - (gap * (n - 1)) / 2;
    const baseY = rect.y + rect.h + 1.5;

    for (let i = 0; i < n; i += 1) {
      const piece = list[i]!;
      const cx = startX + i * gap;
      // deeper in the chamber is further from the coals
      const depth = clamp((cx - rect.x) / rect.w, 0, 1);
      drawVessel(ctx, piece.form, cx, baseY, unit, piece.glaze, {
        mine: piece.mine,
        grade: piece.grade,
        lit: clamp(0.86 - Math.abs(depth - 0.4) * 0.5, 0.35, 1),
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Selection, spotlight, shade                                         */
/* ------------------------------------------------------------------ */

function drawSelection(ctx: CanvasRenderingContext2D, state: RenderState, time: number): void {
  const focus = state.selectedSlot ?? state.spotlight ?? state.hoverSlot;
  if (!focus) return;
  const slot = state.kiln.slots.find((s) => s.id === focus);
  if (!slot) return;
  const r = slotRect(slot);
  const pulse = state.reducedMotion ? 0.5 : 0.5 + Math.sin(time * 0.0035) * 0.5;
  const active = state.selectedSlot === focus;

  ctx.save();

  // the shelf itself is lit: a pool on the board, not a box around it
  const pool = ctx.createRadialGradient(
    r.x + r.w / 2,
    r.y + r.h,
    6,
    r.x + r.w / 2,
    r.y + r.h,
    r.w * 0.86
  );
  pool.addColorStop(0, `rgba(255,208,150,${(active ? 0.30 : 0.16).toFixed(3)})`);
  pool.addColorStop(0.45, `rgba(255,186,120,${(active ? 0.12 : 0.06).toFixed(3)})`);
  pool.addColorStop(1, 'rgba(255,186,120,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(r.x - r.w * 0.3, r.y - 24, r.w * 1.6, r.h + 48);

  // one bright line where the piece stands, and two ticks at the corners
  ctx.strokeStyle = `rgba(255,224,176,${(active ? 0.5 + pulse * 0.3 : 0.2 + pulse * 0.1).toFixed(3)})`;
  ctx.lineWidth = active ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(r.x + 6, r.y + r.h - 1);
  ctx.lineTo(r.x + r.w - 6, r.y + r.h - 1);
  ctx.stroke();

  if (active) {
    ctx.strokeStyle = `rgba(255,224,176,${(0.34 + pulse * 0.2).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    const tick = 9;
    ctx.beginPath();
    ctx.moveTo(r.x + 2, r.y + r.h - 1 - tick);
    ctx.lineTo(r.x + 2, r.y + r.h - 1);
    ctx.lineTo(r.x + 2 + tick, r.y + r.h - 1);
    ctx.moveTo(r.x + r.w - 2, r.y + r.h - 1 - tick);
    ctx.lineTo(r.x + r.w - 2, r.y + r.h - 1);
    ctx.lineTo(r.x + r.w - 2 - tick, r.y + r.h - 1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawShade(ctx: CanvasRenderingContext2D, heat: number): void {
  // the fire lights the yard in front of the mouth
  const spill = ctx.createRadialGradient(
    CHAMBER.mouth.x + CHAMBER.mouth.w / 2,
    GROUND - 10,
    10,
    CHAMBER.mouth.x + CHAMBER.mouth.w / 2,
    GROUND - 10,
    360
  );
  spill.addColorStop(0, `rgba(255,190,110,${(0.30 + heat * 0.22).toFixed(3)})`);
  spill.addColorStop(0.35, `rgba(240,128,52,${(0.16 + heat * 0.12).toFixed(3)})`);
  spill.addColorStop(1, 'rgba(200,70,20,0)');
  ctx.fillStyle = spill;
  ctx.fillRect(0, GROUND - 40, VIEW_W, VIEW_H - GROUND + 40);

  // a cool dark at the edges, so the fire is the only warm thing
  const vignette = ctx.createRadialGradient(500, 330, 190, 500, 330, 660);
  vignette.addColorStop(0, 'rgba(18,11,7,0)');
  vignette.addColorStop(0.62, 'rgba(18,11,7,0.16)');
  vignette.addColorStop(1, 'rgba(18,11,7,0.52)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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

  const page = ctx.createLinearGradient(0, 0, 0, height);
  page.addColorStop(0, '#f4ecdf');
  page.addColorStop(1, '#e4d5bf');
  ctx.fillStyle = page;
  ctx.fillRect(0, 0, width, height);

  ctx.translate(dx, dy);
  ctx.scale(scale, scale);

  const plateCanvas = plateFor(state.kiln, scale);
  ctx.drawImage(plateCanvas, 0, 0, VIEW_W, VIEW_H);

  const heat =
    state.phase === 'firing' ? state.heat : state.phase === 'result' ? 1 : state.phase === 'stoke' ? 0.55 : 0.4;

  drawFire(ctx, state, heat, time, dt);
  drawPieces(ctx, state);
  shelfFronts(ctx);
  drawSmoke(ctx, state, heat, time);
  drawSelection(ctx, state, time);
  drawShade(ctx, heat);

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

export function resetParticles(): void {
  embers.length = 0;
  plate = null;
}
