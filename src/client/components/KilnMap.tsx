import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PotView } from '../../shared/api.ts';
import { COL_F, ROW_F, cellOf, crowdMultiplier, factorAt, loadMultiplier } from '../../shared/sim/kiln.ts';
import type { WareDef } from '../../shared/types.ts';
import { heatRgb } from '../render/heat.ts';
import { drawPot, potHeight } from '../render/pot.ts';

const W = 720;
const H = 420;
const PAD = 16;
const IW = W - PAD * 2;
const IH = H - PAD * 2;

export type KilnMapProps = {
  ware: WareDef;
  peak: number;
  cells: number[];
  pots: PotView[];
  total: number;
  ghost: { x: number; y: number } | null;
  onPlace: (x: number, y: number) => void;
  dimmed?: boolean;
  children?: React.ReactNode;
};

function px(x: number): number {
  return PAD + x * IW;
}
function py(y: number): number {
  return PAD + y * IH;
}

/** Where, at this column, the ideal temperature is — solved against the row gradient. */
function bandY(x: number, target: number, load: number): number | null {
  const colF = colFactor(x);
  const want = target / (colF * load);
  if (want > ROW_F[0] || want < ROW_F[3]) return null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const f = rowFactor(mid);
    if (f > want) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function colFactor(x: number): number {
  const u = Math.min(1, Math.max(0, x)) * 2;
  const i = Math.min(1, Math.floor(u));
  const f = u - i;
  const a = COL_F[i] ?? 1;
  const b = COL_F[i + 1] ?? 1;
  return a + (b - a) * f;
}

function rowFactor(y: number): number {
  const u = Math.min(1, Math.max(0, y)) * 3;
  const i = Math.min(2, Math.floor(u));
  const f = u - i;
  const a = ROW_F[i] ?? 1;
  const b = ROW_F[i + 1] ?? 1;
  return a + (b - a) * f;
}

export function KilnMap(props: KilnMapProps): React.ReactElement {
  const { ware, peak, cells, pots, total, ghost, onPlace, dimmed, children } = props;
  const ref = useRef<HTMLCanvasElement | null>(null);
  const load = loadMultiplier(total);

  const field = useMemo(() => makeField(ware, peak, load), [ware, peak, load]);

  const draw = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    // The brick shell.
    ctx.fillStyle = '#150d09';
    ctx.fillRect(0, 0, W, H);
    const shell = ctx.createLinearGradient(0, 0, 0, H);
    shell.addColorStop(0, 'rgba(84,44,26,0.55)');
    shell.addColorStop(0.5, 'rgba(38,20,13,0.55)');
    shell.addColorStop(1, 'rgba(58,30,18,0.55)');
    ctx.fillStyle = shell;
    ctx.fillRect(0, 0, W, H);

    // Brick courses, faint: the kiln is a building, not a box.
    ctx.strokeStyle = 'rgba(255,196,140,0.055)';
    ctx.lineWidth = 1;
    for (let y = 8; y < H; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Heat field.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(field, PAD, PAD, IW, IH);

    // The band: everywhere this spot would land the ware true.
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD, PAD, IW, IH);
    ctx.clip();

    const target = ware.mid / peak;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,248,232,0.9)';
    ctx.shadowColor = 'rgba(255,220,160,0.85)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= 120; s++) {
      const x = s / 120;
      const y = bandY(x, target, load);
      if (y === null) {
        started = false;
        continue;
      }
      const X = px(x);
      const Y = py(y);
      if (!started) {
        ctx.moveTo(X, Y);
        started = true;
      } else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.restore();

    // Setters' marks: the twelve cells the crowd is counted in.
    ctx.strokeStyle = 'rgba(255,236,210,0.09)';
    ctx.lineWidth = 1;
    for (let c = 1; c < 3; c++) {
      ctx.beginPath();
      ctx.moveTo(px(c / 3), PAD);
      ctx.lineTo(px(c / 3), H - PAD);
      ctx.stroke();
    }
    for (let r = 1; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(PAD, py(r / 4));
      ctx.lineTo(W - PAD, py(r / 4));
      ctx.stroke();
    }

    // Crowd.
    const cellW = IW / 3;
    const cellH = IH / 4;
    ctx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < cells.length; i++) {
      const n = cells[i] ?? 0;
      if (!n) continue;
      const col = Math.floor(i / 4);
      const row = i % 4;
      const bx = PAD + col * cellW + cellW - 30;
      const by = PAD + row * cellH + 8;
      ctx.fillStyle = 'rgba(10,6,4,0.55)';
      ctx.beginPath();
      ctx.roundRect(bx, by, 22, 16, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,226,188,0.82)';
      ctx.fillText(`${n}`, bx + 11, by + 12);
    }

    // Pots already fired today.
    const h = potHeight(ware.shape, 44, 44);
    for (const pot of pots) {
      const X = px(pot.x);
      const Y = py(pot.y);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.filter = 'blur(0.4px)';
      drawPot(ctx, ware, X, Y, h * 0.72, { dim: 0.66, seed: pot.x * 100 + pot.y * 37 });
      ctx.restore();
    }

    // The pot in your hand.
    if (ghost) {
      const X = px(ghost.x);
      const Y = py(ghost.y);
      ctx.save();
      const halo = ctx.createRadialGradient(X, Y - 22, 2, X, Y - 22, 46);
      halo.addColorStop(0, 'rgba(255,236,200,0.34)');
      halo.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(X, Y - 22, 46, 0, Math.PI * 2);
      ctx.fill();
      drawPot(ctx, ware, X, Y, 62, { seed: 3 });
      ctx.strokeStyle = 'rgba(255,244,224,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X - 9, Y + 5);
      ctx.lineTo(X + 9, Y + 5);
      ctx.stroke();
      ctx.restore();
    }

    // Firebox glow on the left, chimney dark on the right.
    const fire = ctx.createLinearGradient(0, 0, 90, 0);
    fire.addColorStop(0, 'rgba(255,140,50,0.22)');
    fire.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = fire;
    ctx.fillRect(0, 0, 120, H);
    const flue = ctx.createLinearGradient(W - 80, 0, W, 0);
    flue.addColorStop(0, 'rgba(0,0,0,0)');
    flue.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = flue;
    ctx.fillRect(W - 120, 0, 120, H);

    if (dimmed) {
      ctx.fillStyle = 'rgba(10,6,4,0.42)';
      ctx.fillRect(0, 0, W, H);
    }

    // Frame.
    ctx.strokeStyle = 'rgba(240,180,92,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }, [field, ware, peak, load, cells, pots, ghost, dimmed]);

  useEffect(() => {
    draw();
  }, [draw]);

  const place = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = ref.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const cx = Math.min(0.985, Math.max(0.015, (x * W - PAD) / IW));
      const cy = Math.min(0.985, Math.max(0.015, (y * H - PAD) / IH));
      onPlace(cx, cy);
    },
    [onPlace],
  );

  return (
    <div className="kiln-wrap">
      <canvas
        ref={ref}
        width={W}
        height={H}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          place(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === 'mouse') place(e);
        }}
      />
      <div className="kiln-hint">
        {ghost ? 'the white line is where your ware lands true' : 'drag or tap inside the kiln'}
      </div>
      {children}
    </div>
  );
}

/** Low-resolution heat field, upscaled: cheap, smooth, and easy to band. */
function makeField(ware: WareDef, peak: number, load: number): HTMLCanvasElement {
  const w = 180;
  const h = 100;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(w, h);
  const lo = ware.mid - ware.half * 3.4;
  const hi = ware.mid + ware.half * 3.4;

  for (let j = 0; j < h; j++) {
    const y = j / (h - 1);
    for (let i = 0; i < w; i++) {
      const x = i / (w - 1);
      const eff = factorAt(x, y) * peak * load;
      const t = (eff - lo) / (hi - lo);
      const glow = Math.max(0, 1 - Math.abs(eff - ware.mid) / (ware.half * 2.2));
      const [r, g, b] = heatOf(t, glow);
      const k = (j * w + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function heatOf(t: number, glow: number): [number, number, number] {
  // Brick when cold, ember when hot, and a pale bloom right on the band.
  const u = Math.min(1, Math.max(0, t));
  const [r, g, b] = heatRgb(Math.pow(u, 1.85));
  const brick: [number, number, number] = [48, 26, 18];
  const k = Math.pow(u, 1.5);
  const glow2 = glow * glow;
  return [
    Math.round(brick[0] * (1 - k) + r * k + 52 * glow2),
    Math.round(brick[1] * (1 - k) + g * k + 40 * glow2),
    Math.round(brick[2] * (1 - k) + b * k + 24 * glow2),
  ];
}

/** What the map says about the spot under the cursor. Pure, so the tests can read it. */
export function spotVerdict(
  ware: WareDef,
  peak: number,
  x: number,
  y: number,
  cells: number[],
  total: number,
): { eff: number; fit: 'over' | 'fit' | 'under'; crowd: number; est: number } {
  const cell = cellOf(x, y);
  const crowded = cells[cell] ?? 0;
  const factor = factorAt(x, y) * loadMultiplier(total) * crowdMultiplier(crowded);
  const eff = factor * peak;
  const fit = eff > ware.mid + ware.half ? 'over' : eff < ware.mid - ware.half ? 'under' : 'fit';
  const closeness = Math.max(0, 1 - Math.pow(Math.abs(eff - ware.mid) / ware.half, 2));
  return { eff, fit, crowd: crowded, est: Math.round(closeness * 100) };
}
