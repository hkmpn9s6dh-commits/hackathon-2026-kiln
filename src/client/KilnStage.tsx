import { useEffect, useRef } from 'react';

import type { Kiln } from '../shared/kiln';
import { drawKiln, hitSlot, resetParticles, toView } from './kiln-canvas';
import type { RenderPiece, RenderState } from './kiln-canvas';

type Props = {
  kiln: Kiln;
  pieces: RenderPiece[];
  selectedSlot: string | null;
  phase: RenderState['phase'];
  heat: number;
  spotlight: string | null;
  onPick: (slotId: string) => void;
  onHover: (slotId: string | null) => void;
  label: string;
  note?: string | null;
  warn?: boolean;
};

export function KilnStage(props: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(props);
  const hoverRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  stateRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    resetParticles();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const loop = (now: number): void => {
      const dt = lastRef.current === 0 ? 16 : now - lastRef.current;
      lastRef.current = now;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawKiln(
        ctx,
        rect.width,
        rect.height,
        {
          kiln: stateRef.current.kiln,
          pieces: stateRef.current.pieces,
          selectedSlot: stateRef.current.selectedSlot,
          hoverSlot: hoverRef.current,
          phase: stateRef.current.phase,
          heat: stateRef.current.heat,
          spotlight: stateRef.current.spotlight,
          reducedMotion: reduced,
        },
        now,
        dt
      );
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      lastRef.current = 0;
    };
  }, []);

  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>, commit: boolean): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = toView(canvas, event.clientX, event.clientY);
    const slot = hitSlot(props.kiln, point.x, point.y);
    if (commit) {
      if (slot) props.onPick(slot.id);
      return;
    }
    hoverRef.current = slot?.id ?? null;
    props.onHover(hoverRef.current);
  };

  return (
    <div className="stage">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={props.label}
        onPointerDown={(e) => handlePointer(e, true)}
        onPointerMove={(e) => handlePointer(e, false)}
        onPointerLeave={() => {
          hoverRef.current = null;
          props.onHover(null);
        }}
      />
      {props.note ? (
        <span className={props.warn ? 'stage-note warn' : 'stage-note'}>{props.note}</span>
      ) : null}
    </div>
  );
}
