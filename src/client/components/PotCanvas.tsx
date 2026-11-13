import { useEffect, useRef } from 'react';
import type { Outcome, WareDef } from '../../shared/types.ts';
import { drawPot, potHeight, type PotPaint } from '../render/pot.ts';

export type PotCanvasProps = {
  ware: WareDef;
  width: number;
  height: number;
  paint?: PotPaint;
  outcome?: Outcome;
  className?: string;
};

export function PotCanvas({
  ware,
  width,
  height,
  paint,
  outcome,
  className,
}: PotCanvasProps): React.ReactElement {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const h = potHeight(ware.shape, width * 0.82, height * 0.86);
    const p: PotPaint = {
      ...paint,
      over: outcome?.verdict === 'over',
      cracked: outcome?.verdict === 'cracked',
      flambe: outcome?.verdict === 'flambe',
      mood:
        outcome?.verdict === 'under' || outcome?.verdict === 'cracked'
          ? 'under'
          : outcome?.verdict === 'over'
            ? 'over'
            : outcome?.verdict === 'flambe'
              ? 'rare'
              : 'good',
      heat: paint?.heat ?? 0,
      seed: 7,
    };
    drawPot(ctx, ware, width / 2, height - 6, h, p);
  }, [ware, width, height, paint, outcome]);

  return <canvas ref={ref} className={className} style={{ width, height }} />;
}
