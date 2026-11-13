import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BAND,
  ROUND_SECONDS,
  SEGMENTS,
  createFire,
  readTrace,
  stepFire,
  targetAt,
  type FireTrace,
} from '../../shared/sim/fire.ts';
import type { FireSample, WareDef } from '../../shared/types.ts';
import { fireName, heatCss } from '../render/heat.ts';
import { drawPot, potHeight } from '../render/pot.ts';

const SW = 720;
const SH = 360;
const CW = 720;
const CH = 170;

export type FireStageProps = {
  ware: WareDef;
  curve: number[];
  onDone: (samples: FireSample[]) => void;
};

export function FireStage({ ware, curve, onDone }: FireStageProps): React.ReactElement {
  const sceneRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const fire = useRef(createFire());
  const samples = useRef<FireSample[]>([]);
  const feeding = useRef(false);
  const raf = useRef(0);
  const last = useRef(0);
  const record = useRef(0);
  const finished = useRef(false);

  const probe = useRef<{ curve: number[]; state: { t: number; temp: number; target: number } } | null>(null);
  const [on, setOn] = useState(false);
  const [temp, setTemp] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState<FireTrace | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    feeding.current = false;
    stop();
    const trace = readTrace(samples.current, curve);
    setDone(trace);
    setOn(false);
  }, [curve, stop]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('probe=1')) {
      probe.current = { curve, state: { t: 0, temp: 0, target: 0 } };
      (window as unknown as { __kilnProbe?: unknown }).__kilnProbe = probe.current;
    }
    const tick = (now: number) => {
      const s = fire.current;
      if (!last.current) last.current = now;
      let dt = (now - last.current) / 1000;
      last.current = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;

      // Fixed sub-steps keep the fire identical on a 60Hz phone and a 144Hz laptop.
      let left = dt;
      while (left > 0) {
        const step = Math.min(0.02, left);
        s.feeding = feeding.current;
        stepFire(s, step);
        left -= step;
      }

      record.current += dt;
      if (record.current >= 0.05) {
        record.current = 0;
        samples.current.push({ t: Number(s.t.toFixed(2)), temp: Number(s.temp.toFixed(4)) });
      }

      setTemp(s.temp);
      setElapsed(s.t);
      // Test probe: a headless play-through needs to see the fire it is driving.
      if (probe.current) {
        probe.current.state = { t: s.t, temp: s.temp, target: targetAt(curve, s.t) };
      }
      drawScene(sceneRef.current, ware, s.temp, s.feeding, s.t);
      drawChart(chartRef.current, curve, samples.current, s.temp, s.t);

      if (s.t >= ROUND_SECONDS) {
        samples.current.push({ t: ROUND_SECONDS, temp: Number(s.temp.toFixed(4)) });
        finish();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [curve, finish, ware]);

  const press = useCallback((down: boolean) => {
    feeding.current = down;
    setOn(down);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      press(e.type === 'keydown');
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
    };
  }, [press]);

  const target = targetAt(curve, elapsed);
  const off = temp - target;

  return (
    <>
      <div className="fire-wrap">
        <canvas ref={sceneRef} width={SW} height={SH} />
      </div>
      <canvas className="chart" ref={chartRef} width={CW} height={CH} />

      <div className="fire-hud">
        <span>
          fire <b style={{ color: heatCss(Math.min(1, temp / 0.8)) }}>{fireName(temp)}</b>
        </span>
        <span>
          wanted <b>{fireName(target)}</b>
        </span>
        <span>
          {off > 0.06 ? 'too fast' : off < -0.06 ? 'falling behind' : 'holding'} ·{' '}
          <b>{Math.max(0, ROUND_SECONDS - elapsed).toFixed(1)}s</b>
        </span>
      </div>

      {done ? (
        <button className="btn" onClick={() => onDone(samples.current)}>
          Open the kiln
          <small>see what the fire made</small>
        </button>
      ) : (
        <button
          className={on ? 'feed on' : 'feed'}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            press(true);
          }}
          onPointerUp={() => press(false)}
          onPointerCancel={() => press(false)}
          onPointerLeave={() => press(false)}
        >
          {on ? 'feeding' : 'hold to feed'}
        </button>
      )}
    </>
  );
}

function drawScene(
  canvas: HTMLCanvasElement | null,
  ware: WareDef,
  temp: number,
  feeding: boolean,
  t: number,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const heat = Math.min(1, temp / 0.8);
  ctx.clearRect(0, 0, SW, SH);

  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#070404');
  bg.addColorStop(0.62, '#120b08');
  bg.addColorStop(1, '#1d1009');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, SH);

  const floor = SH - 44;

  // The chamber: a brick arch, lit only where the fire reaches.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(40, floor + 18);
  ctx.lineTo(40, 92);
  ctx.quadraticCurveTo(40, 26, SW / 2, 26);
  ctx.quadraticCurveTo(SW - 40, 26, SW - 40, 92);
  ctx.lineTo(SW - 40, floor + 18);
  ctx.closePath();
  ctx.clip();

  const wall = ctx.createLinearGradient(0, 0, SW, 0);
  wall.addColorStop(0, `rgba(96,44,22,${0.5 + heat * 0.35})`);
  wall.addColorStop(0.35, 'rgba(48,24,16,0.55)');
  wall.addColorStop(1, 'rgba(18,10,8,0.6)');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, SW, SH);

  // Brick courses, warmer on the fire side.
  for (let y = 60; y < floor; y += 26) {
    ctx.strokeStyle = `rgba(255,190,140,${0.03 + heat * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SW, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = `rgba(255,170,110,${0.1 + heat * 0.14})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, floor + 18);
  ctx.lineTo(40, 92);
  ctx.quadraticCurveTo(40, 26, SW / 2, 26);
  ctx.quadraticCurveTo(SW - 40, 26, SW - 40, 92);
  ctx.lineTo(SW - 40, floor + 18);
  ctx.stroke();

  // Floor of the chamber.
  const floorGrad = ctx.createLinearGradient(0, floor, 0, SH);
  floorGrad.addColorStop(0, 'rgba(52,28,18,0.95)');
  floorGrad.addColorStop(1, 'rgba(16,9,6,1)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floor, SW, SH - floor);

  // Ember bed in the firebox.
  const bed = ctx.createRadialGradient(120, floor + 4, 4, 120, floor + 4, 190);
  bed.addColorStop(0, heatCss(Math.min(1, heat + 0.35), 0.95));
  bed.addColorStop(0.32, heatCss(Math.min(1, heat * 0.9), 0.55));
  bed.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bed;
  ctx.fillRect(0, floor - 120, 340, 190);

  // Flames: additive, so they bloom instead of stacking as flat shapes.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const tongues = 9;
  for (let i = 0; i < tongues; i++) {
    const ph = t * (2.4 + i * 0.41) + i * 1.7;
    const x = 54 + i * 19 + Math.sin(ph) * 7;
    const hgt = (54 + i * 9) * (0.45 + heat * 1.15) * (feeding ? 1.22 : 0.92) * (0.9 + 0.1 * Math.sin(ph * 2.3));
    const w = 13 + Math.sin(ph * 1.9) * 3;
    const g = ctx.createLinearGradient(x, floor, x, floor - hgt);
    g.addColorStop(0, `rgba(255,214,150,${0.5 + heat * 0.4})`);
    g.addColorStop(0.35, heatCss(Math.min(1, heat + 0.12), 0.42));
    g.addColorStop(0.75, heatCss(Math.min(1, heat * 0.8), 0.16));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w, floor + 2);
    ctx.bezierCurveTo(x - w * 1.15, floor - hgt * 0.45, x - w * 0.35, floor - hgt * 0.75, x, floor - hgt);
    ctx.bezierCurveTo(x + w * 0.4, floor - hgt * 0.72, x + w * 1.1, floor - hgt * 0.42, x + w, floor + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Embers drifting across the chamber toward the flue.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 28; i++) {
    const seed = i * 12.9898;
    const sp = 0.2 + ((i * 7) % 10) / 30;
    const x = ((seed * 91 + t * 26 * sp) % (SW + 60)) - 30;
    const y = floor - 10 - ((seed * 37 + t * 44 * sp) % (floor - 70));
    ctx.fillStyle = heatCss(Math.min(1, heat + 0.25), 0.18 + heat * 0.45);
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // The pot, on its settler, fire side lit.
  const h = potHeight(ware.shape, 138, 150);
  const px = SW * 0.63;
  const py = floor + 2;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(px, py + 4, h * 0.42, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Settler: a slab of fireclay the pot stands on.
  ctx.fillStyle = 'rgba(74,46,30,0.9)';
  ctx.beginPath();
  ctx.moveTo(px - h * 0.34, py + 2);
  ctx.lineTo(px + h * 0.34, py + 2);
  ctx.lineTo(px + h * 0.3, py + 10);
  ctx.lineTo(px - h * 0.3, py + 10);
  ctx.closePath();
  ctx.fill();

  const halo = ctx.createRadialGradient(px - 30, py - h * 0.5, 6, px - 20, py - h * 0.4, h * 0.95);
  halo.addColorStop(0, heatCss(Math.min(1, heat + 0.1), 0.22 + heat * 0.2));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, SW, SH);

  drawPot(ctx, ware, px, py, h, { heat: heat * 0.8, dim: 0.5 + heat * 0.55 });

  // Warm rim light from the firebox, thrown across the pot's left side.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createLinearGradient(px - h * 0.42, 0, px + h * 0.1, 0);
  rim.addColorStop(0, heatCss(Math.min(1, heat + 0.2), 0.28));
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(px - h * 0.5, py - h - 10, h * 0.62, h + 10);
  ctx.restore();

  const vig = ctx.createRadialGradient(SW / 2, SH / 2, SH * 0.28, SW / 2, SH / 2, SH * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, SW, SH);
}

function drawChart(
  canvas: HTMLCanvasElement | null,
  curve: number[],
  samples: FireSample[],
  temp: number,
  elapsed: number,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, CW, CH);

  const L = 40;
  const R = CW - 16;
  const T = 14;
  const B = CH - 26;
  const X = (t: number) => L + (t / ROUND_SECONDS) * (R - L);
  const Y = (v: number) => B - (v / 0.8) * (B - T);

  ctx.fillStyle = '#0d0907';
  ctx.fillRect(0, 0, CW, CH);

  // Segments.
  for (let i = 1; i < SEGMENTS; i++) {
    const t = i * 3;
    ctx.strokeStyle = 'rgba(236,224,203,0.08)';
    ctx.beginPath();
    ctx.moveTo(X(t), T);
    ctx.lineTo(X(t), B);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(236,224,203,0.14)';
  ctx.beginPath();
  ctx.moveTo(L, B);
  ctx.lineTo(R, B);
  ctx.stroke();

  // Band around the schedule.
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * ROUND_SECONDS;
    const v = targetAt(curve, t) + BAND;
    if (i === 0) ctx.moveTo(X(t), Y(v));
    else ctx.lineTo(X(t), Y(v));
  }
  for (let i = 120; i >= 0; i--) {
    const t = (i / 120) * ROUND_SECONDS;
    ctx.lineTo(X(t), Y(Math.max(0, targetAt(curve, t) - BAND)));
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(240,180,92,0.1)';
  ctx.fill();

  // The schedule.
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * ROUND_SECONDS;
    const v = targetAt(curve, t);
    if (i === 0) ctx.moveTo(X(t), Y(v));
    else ctx.lineTo(X(t), Y(v));
  }
  ctx.strokeStyle = 'rgba(240,180,92,0.72)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // What you actually did.
  if (samples.length > 1) {
    ctx.beginPath();
    samples.forEach((s, i) => {
      if (i === 0) ctx.moveTo(X(s.t), Y(s.temp));
      else ctx.lineTo(X(s.t), Y(s.temp));
      void s;
    });
    ctx.strokeStyle = heatCss(Math.min(1, temp / 0.8));
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const lastSample = samples[samples.length - 1];
    if (lastSample) {
      ctx.fillStyle = '#fff6e4';
      ctx.beginPath();
      ctx.arc(X(lastSample.t), Y(lastSample.temp), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(236,224,203,0.4)';
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText('the day’s schedule', L, CH - 8);
  ctx.textAlign = 'right';
  ctx.fillText(`${elapsed.toFixed(0)}s / ${ROUND_SECONDS}s`, R, CH - 8);
  ctx.textAlign = 'left';
}
