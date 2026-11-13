import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ErrorResponse, FireResponse, InitResponse } from '../../shared/api.ts';
import type { FireSample } from '../../shared/types.ts';
import { telemetry } from '@devvit/analytics/client/reddit';

export type Phase = 'loading' | 'load' | 'fire' | 'result' | 'error';

export type Game = {
  phase: Phase;
  init: InitResponse | null;
  ghost: { x: number; y: number } | null;
  result: FireResponse | null;
  error: string | null;
  place: (x: number, y: number) => void;
  startFire: () => void;
  submit: (samples: FireSample[]) => void;
  reload: () => void;
};

async function getInit(): Promise<InitResponse> {
  const res = await fetch('/api/init', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`init ${res.status}`);
  return (await res.json()) as InitResponse;
}

export function useGame(): Game {
  const [phase, setPhase] = useState<Phase>('loading');
  const [init, setInit] = useState<InitResponse | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<FireResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getInit()
      .then((data) => {
        setInit(data);
        if (data.me.played) {
          setGhost({ x: data.me.played.x, y: data.me.played.y });
          setPhase('result');
        } else {
          setPhase('load');
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'The kiln did not open.');
        setPhase('error');
      });
  }, []);

  useEffect(() => {
    reload();
    void telemetry.appReady().catch(() => undefined);
  }, [reload]);

  const place = useCallback((x: number, y: number) => {
    setGhost({ x, y });
  }, []);

  const startFire = useCallback(() => {
    setPhase('fire');
    void telemetry.startJourney().catch(() => undefined);
    void telemetry
      .interaction({ action: 'pot_placed', actionDetails: ghost ? `${ghost.x.toFixed(2)},${ghost.y.toFixed(2)}` : 'none' })
      .catch(() => undefined);
  }, [ghost]);

  const submit = useCallback(
    (samples: FireSample[]) => {
      const spot = ghost ?? { x: 0.5, y: 0.5 };
      fetch('/api/fire', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ x: spot.x, y: spot.y, samples }),
      })
        .then(async (res) => {
          const data = (await res.json()) as FireResponse | ErrorResponse;
          if (!res.ok || data.type === 'error') {
            throw new Error('message' in data ? data.message : 'The fire went out.');
          }
          setResult(data);
          setPhase('result');
          void telemetry
            .endJourney({
              complete: true,
              game: { win: data.outcome.verdict !== 'under' && data.outcome.verdict !== 'over', score: data.outcome.score },
            })
            .catch(() => undefined);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'The fire went out.');
          setPhase('error');
        });
    },
    [ghost],
  );

  return useMemo(
    () => ({ phase, init, ghost, result, error, place, startFire, submit, reload }),
    [phase, init, ghost, result, error, place, startFire, submit, reload],
  );
}
