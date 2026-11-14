import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './index.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { CommitResponse, StateResponse, YardResponse } from '../shared/api';
import {
  COLLECTIVE_BONUS,
  GRADE_LABEL,
  GRADE_LINE,
  STOKE_MAX,
  STOKE_MIN,
  ZONE_LABEL,
  ZONES,
  explain,
  forecast,
  hash32,
  shortDelta,
} from '../shared/kiln';
import type { Grade, Kiln, Ware } from '../shared/kiln';
import { KilnStage } from './KilnStage';
import { tintGlaze } from './kiln-canvas';
import { isMuted, setMuted, sfx } from './audio';
import type { RenderPiece } from './kiln-canvas';
import { backToPost, commitPiece, fetchState, fetchYard, host } from './net';

type Phase = 'select' | 'stoke' | 'firing' | 'result' | 'yard';

type ResultView = {
  grade: Grade;
  wareName: string;
  slotId: string;
  zone: string;
  temp: number;
  ideal: number;
  delta: number;
  stoke: number;
  score: number;
  streak: number;
  balanced: boolean;
  already: boolean;
};

const BAND = 0.085;

function targetsFor(seed: number, salt: string): number[] {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    a = (Math.imul(a, 1664525) + 1013904223 + salt.length * (i + 1)) >>> 0;
    out.push(0.24 + (a / 4294967296) * 0.52);
  }
  return out;
}

function hoursText(hours: number): string {
  const total = Math.max(0, Math.floor(hours * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function viewFromMine(state: StateResponse): ResultView | null {
  const mine = state.mine;
  if (!mine) return null;
  return {
    grade: mine.grade,
    wareName: mine.wareName,
    slotId: mine.slotId,
    zone: mine.zone,
    temp: mine.temp,
    ideal: mine.ideal,
    delta: mine.delta,
    stoke: mine.stoke,
    score: mine.score,
    streak: state.streak,
    balanced: false,
    already: true,
  };
}

const GLYPH: Record<Ware['form'], string> = {
  // wide and shallow, with a foot
  bowl: 'M1.5 8.5 Q14 1.5 26.5 8.5 Q23 16.5 14 16.5 Q5 16.5 1.5 8.5 Z M9 16.5 L9 18 L19 18 L19 16.5 Z',
  // belly, shoulder, short neck
  jar: 'M11 2.5 Q9.5 5 8 6.5 Q3.5 9.5 5 14.5 Q8 18 14 18 Q20 18 23 14.5 Q24.5 9.5 20 6.5 Q18.5 5 17 2.5 Z',
  // tall, shoulder high, long neck
  vase: 'M12 1.5 Q11.5 5 10 7 Q7 9.5 7.5 14 Q8.5 18 14 18 Q19.5 18 20.5 14 Q21 9.5 18 7 Q16.5 5 16 1.5 Z',
  // ovoid, narrow at the neck
  egg: 'M11 2 Q9 6 7.5 9 Q5 13 6.5 16 Q9.5 18.5 14 18.5 Q18.5 18.5 21.5 16 Q23 13 20.5 9 Q19 6 17 2 Z',
};

function PieceGlyph(props: { form: Ware['form']; glaze: string; size?: number }): React.ReactElement {
  const size = props.size ?? 30;
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 28 20" aria-hidden="true" className="glyph">
      <path d={GLYPH[props.form]} fill={props.glaze} stroke="rgba(34,26,20,0.65)" strokeWidth="0.9" />
      <ellipse cx="14" cy="2" rx="4" ry="1" fill="rgba(20,12,8,0.6)" />
    </svg>
  );
}

function LoadMeter(props: { counts: Record<string, number> }): React.ReactElement {
  return (
    <div className="load" role="group" aria-label="Pieces in each chamber">
      {ZONES.map((zone) => {
        const n = props.counts[zone] ?? 0;
        return (
          <div className="load-cell" key={zone}>
            <span className="load-name">{ZONE_LABEL[zone]}</span>
            <span className="load-ticks" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={i < n ? 'on' : ''} />
              ))}
            </span>
            <span className="load-num mono">{n}</span>
          </div>
        );
      })}
      <span className="load-note">every piece here costs 7°C</span>
    </div>
  );
}

function WareCard(props: { ware: Ware; active: boolean; onPick: () => void }): React.ReactElement {
  return (
    <button className="ware" aria-pressed={props.active} onClick={props.onPick}>
      <span className="ware-head">
        <PieceGlyph form={props.ware.form} glaze={props.ware.glaze} />
        <span className="name">{props.ware.name}</span>
      </span>
      <span className="temp mono">{props.ware.ideal}°C target</span>
      <span className="hint">{props.ware.line}</span>
    </button>
  );
}

function StokeBar(props: {
  targets: number[];
  stroke: number;
  taps: number[];
  onTap: (accuracy: number) => void;
}): React.ReactElement {
  const needleRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(0.5);
  const dirRef = useRef(1);
  const lockedRef = useRef(false);
  const tapRef = useRef(props.onTap);
  tapRef.current = props.onTap;
  const strokeRef = useRef(props.stroke);
  strokeRef.current = props.stroke;
  const targetsRef = useRef(props.targets);
  targetsRef.current = props.targets;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (now: number): void => {
      if (!last) last = now;
      const dt = Math.min(48, now - last) / 1000;
      last = now;
      if (!lockedRef.current) {
        const speed = 0.42 + strokeRef.current * 0.12;
        posRef.current += dirRef.current * speed * dt;
        if (posRef.current > 1) {
          posRef.current = 1;
          dirRef.current = -1;
        }
        if (posRef.current < 0) {
          posRef.current = 0;
          dirRef.current = 1;
        }
        if (needleRef.current) needleRef.current.style.left = `${(posRef.current * 100).toFixed(2)}%`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fire = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const target = targetsRef.current[strokeRef.current] ?? 0.5;
    const distance = Math.abs(posRef.current - target);
    const accuracy = Math.max(0, Math.min(1, 1 - distance / BAND));
    window.setTimeout(() => {
      lockedRef.current = false;
    }, 240);
    tapRef.current(accuracy);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        fire();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fire]);

  const target = props.targets[props.stroke] ?? 0.5;

  return (
    <div className="stoke">
      <div className="stoke-track" onClick={fire} role="presentation">
        <div
          className="stoke-band"
          style={{ left: `${(target - BAND) * 100}%`, width: `${BAND * 200}%` }}
        />
        <div ref={needleRef} className="stoke-needle" style={{ left: '50%' }} />
      </div>
      <div className="stoke-marks" aria-hidden="true">
        {[0, 1, 2].map((i) => {
          const value = props.taps[i];
          const cls = value === undefined ? '' : value > 0.55 ? 'hit' : 'miss';
          return <span key={i} className={`mark ${cls}`} />;
        })}
      </div>
    </div>
  );
}

function App(): React.ReactElement {
  const [state, setState] = useState<StateResponse | null>(null);
  const [phase, setPhase] = useState<Phase>('select');
  const [wareId, setWareId] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [, setHover] = useState<string | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const [result, setResult] = useState<ResultView | null>(null);
  const [yard, setYard] = useState<YardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heat, setHeat] = useState(0);
  const [muted, setMutedState] = useState(isMuted());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchYard()
      .then((next) => {
        if (alive) setYard(next);
      })
      .catch(() => {
        /* the kiln still works without the yard */
      });
    fetchState()
      .then((next) => {
        if (!alive) return;
        setState(next);
        const mine = viewFromMine(next);
        if (mine) {
          setResult(mine);
          setPhase('result');
        }
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const kiln: Kiln | null = state?.kiln ?? null;
  const ware = useMemo(() => kiln?.wares.find((w) => w.id === wareId) ?? null, [kiln, wareId]);
  const slot = useMemo(() => kiln?.slots.find((s) => s.id === slotId) ?? null, [kiln, slotId]);
  const counts = state?.counts ?? { mouth: 0, body: 0, tail: 0 };

  const targets = useMemo(
    () => (kiln ? targetsFor(kiln.seed, host.username ?? 'guest') : [0.5, 0.5, 0.5]),
    [kiln]
  );

  const hint = useMemo(() => {
    if (!ware || !slot) return null;
    return forecast(ware, slot, counts[slot.zone]);
  }, [ware, slot, counts]);

  const pieces: RenderPiece[] = useMemo(() => {
    if (!kiln) return [];
    const out: RenderPiece[] = [];
    // everyone else's pieces, as the yard last reported them
    for (const entry of yard?.entries ?? []) {
      const w = kiln.wares.find((x) => x.name === entry.wareName);
      out.push({
        slotId: entry.slotId,
        form: w?.form ?? 'jar',
        glaze: tintGlaze(w?.glaze ?? '#7E9BD1', hash32(entry.username)),
        mine: false,
        grade: entry.grade,
      });
    }
    if (ware && slot && phase === 'stoke') {
      out.push({ slotId: slot.id, form: ware.form, glaze: ware.glaze, mine: true });
    }
    if (result) {
      const fired = kiln.wares.find((w) => w.name === result.wareName);
      out.push({
        slotId: result.slotId,
        form: fired?.form ?? 'jar',
        glaze: fired?.glaze ?? '#7E9BD1',
        mine: true,
        grade: result.grade,
      });
    }
    return out;
  }, [kiln, ware, slot, phase, result, yard]);

  const stokeSoFar = useMemo(() => {
    let sum = 0;
    for (const tap of taps) sum += -6 + (STOKE_MAX - STOKE_MIN) * Math.max(0, Math.min(1, tap));
    return Math.round(sum);
  }, [taps]);

  const loadYard = useCallback(() => {
    setPhase('yard');
    fetchYard()
      .then((next) => setYard(next))
      .catch((err: Error) => setError(err.message));
  }, []);

  const fire = useCallback(() => {
    if (!ware || !slot) return;
    setPhase('firing');
    setBusy(true);
    setHeat(0);
    sfx.doorOpen();
    const started = performance.now();
    const ramp = (now: number): void => {
      const t = Math.min(1, (now - started) / 1500);
      setHeat(t);
      if (t < 1) requestAnimationFrame(ramp);
    };
    requestAnimationFrame(ramp);

    commitPiece({ wareId: ware.id, slotId: slot.id, taps })
      .then((response: CommitResponse) => {
        window.setTimeout(() => {
          setResult({
            grade: response.result.grade,
            wareName: response.result.ware.name,
            slotId: response.result.slot.id,
            zone: response.result.slot.zone,
            temp: response.result.temp,
            ideal: response.result.ideal,
            delta: response.result.delta,
            stoke: response.result.stoke,
            score: response.score,
            streak: response.streak,
            balanced: response.balanced,
            already: response.already,
          });
          setState((prev) =>
            prev ? { ...prev, counts: response.counts, streak: response.streak, mine: response.mine } : prev
          );
          setPhase('result');
          setBusy(false);
          fetchYard()
            .then((next) => setYard(next))
            .catch(() => {
              /* the result screen does not depend on it */
            });
          if (response.result.grade === 'transmuted') sfx.transmuted();
          else if (response.result.grade === 'fine') sfx.fine();
          else sfx.dull();
        }, 900);
      })
      .catch((err: Error) => {
        setError(err.message);
        setPhase('stoke');
        setBusy(false);
      });
  }, [ware, slot, taps]);

  useEffect(() => {
    if (phase !== 'select' || !kiln) return;
    const onKey = (event: KeyboardEvent): void => {
      const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
      if (index >= 0) {
        const picked = kiln.wares[index];
        if (picked) setWareId(picked.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, kiln]);

  if (!kiln) {
    return (
      <div className="game">
        <div className="stage-bg" />
        <div className="topbar" />
        <div className="stage" style={{ display: 'grid', placeItems: 'center' }}>
          <p className="panel-sub">{error ?? 'Lighting the kiln…'}</p>
        </div>
        <div />
      </div>
    );
  }

  const note =
    phase === 'select'
      ? slot
        ? `${ZONE_LABEL[slot.zone]} · row ${slot.row + 1} · ${slot.base}°C · ${counts[slot.zone]} here`
        : 'Tap a shelf to place your piece'
      : phase === 'stoke'
        ? 'Tap when the needle is in the band'
        : phase === 'yard'
          ? `${yard?.total ?? 0} pieces in today’s load`
          : null;

  return (
    <div className="game">
      <div className="stage-bg" />
      <header className="topbar">
        <span className="wordmark">KILN</span>
        <span className="dayline">
          {state?.day} · {kiln.variantLine}
        </span>
        <span className="spacer" />
        <span className="clock">
          <span>closes in</span>
          <b className="mono">{hoursText(state?.hoursLeft ?? 0)}</b>
        </span>
        <button
          className="icon-btn"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedState(next);
          }}
        >
          {muted ? '♪̸' : '♪'}
        </button>
      </header>

      <KilnStage
        kiln={kiln}
        pieces={pieces}
        selectedSlot={slotId}
        phase={phase}
        heat={heat}
        spotlight={null}
        note={note}
        warn={hint?.forecast === 'far'}
        onPick={(id) => {
          if (phase !== 'select') return;
          setSlotId(id);
          sfx.tap();
        }}
        onHover={setHover}
        label={`Wood kiln cross-section. ${counts.mouth} pieces at the fire mouth, ${counts.body} in the kiln body, ${counts.tail} at the tail.`}
      />

      <section className="panel">
        {error ? (
          <p className="panel-sub" style={{ color: 'var(--bad)' }}>
            {error}
          </p>
        ) : null}

        {phase === 'select' ? (
          <>
            <div className="panel-row">
              <div>
                <h2 className="panel-title">Load the kiln</h2>
                <p className="panel-sub">
                  One piece per potter per day. Pick a ware, then tap a shelf. Every piece already in
                  a chamber pulls its heat down.
                </p>
              </div>
              <span className="spacer" />
              <button
                className="btn primary"
                disabled={!ware || !slot}
                onClick={() => {
                  setPhase('stoke');
                  setTaps([]);
                }}
              >
                Stoke the fire →
              </button>
            </div>
            <LoadMeter counts={counts} />
            <div className="wares">
              {kiln.wares.map((w) => (
                <WareCard
                  key={w.id}
                  ware={w}
                  active={w.id === wareId}
                  onPick={() => {
                    setWareId(w.id);
                    sfx.tap();
                  }}
                />
              ))}
            </div>
            {hint ? (
              <p className="panel-sub">
                {hint.forecast === 'fine'
                  ? 'This shelf can land it, if you stoke well.'
                  : hint.forecast === 'sound'
                    ? 'Sound at best — there is not enough heat here for a fine piece.'
                    : 'This shelf cannot fire this piece. Pick another one.'}
              </p>
            ) : null}
          </>
        ) : null}

        {phase === 'stoke' ? (
          <>
            <div className="panel-row">
              <div>
                <h2 className="panel-title">Three strokes</h2>
                <p className="panel-sub">
                  {ware?.name} on{' '}
                  {slot ? `${ZONE_LABEL[slot.zone]} row ${slot.row + 1}` : 'the shelf'}. Stop the needle
                  inside the band, three times.
                </p>
              </div>
              <span className="spacer" />
              {taps.length >= 3 ? (
                <button className="btn primary" disabled={busy} onClick={fire}>
                  Open the kiln
                </button>
              ) : (
                <span className="clock">
                  <b className="mono">
                    {stokeSoFar >= 0 ? '+' : ''}
                    {stokeSoFar}°C
                  </b>
                  <span>so far</span>
                </span>
              )}
            </div>
            <StokeBar
              targets={targets}
              stroke={Math.min(taps.length, 2)}
              taps={taps}
              onTap={(accuracy) => {
                if (accuracy > 0.55) sfx.stokeHit();
                else sfx.stokeMiss();
                setTaps((prev) => (prev.length >= 3 ? prev : [...prev, accuracy]));
              }}
            />
          </>
        ) : null}

        {phase === 'firing' ? (
          <div className="panel-row">
            <div>
              <h2 className="panel-title">The door is open</h2>
              <p className="panel-sub">Nobody sees the piece until the glaze cools.</p>
            </div>
          </div>
        ) : null}

        {phase === 'result' && result ? (
          <>
            <div className="result">
              <div className={`stamp grade-${result.grade}`}>
                <span className="kicker">{result.already ? 'Already fired today' : 'Out of the kiln'}</span>
                <div className="stamp-body">
                  <PieceGlyph
                    form={(kiln.wares.find((w) => w.name === result.wareName) ?? kiln.wares[0]!).form}
                    glaze={(kiln.wares.find((w) => w.name === result.wareName) ?? kiln.wares[0]!).glaze}
                    size={72}
                  />
                  <div className="stamp-text">
                    <span className="grade">{GRADE_LABEL[result.grade]}</span>
                    <span className="line">{GRADE_LINE[result.grade]}</span>
                  </div>
                </div>
              </div>
              <div className="figures">
                <div className="figure">
                  <div className="k">Saw</div>
                  <div className="v mono">
                    {result.temp}
                    <small>°C</small>
                  </div>
                </div>
                <div className="figure">
                  <div className="k">Wanted</div>
                  <div className="v mono">
                    {result.ideal}
                    <small>°C</small>
                  </div>
                </div>
                <div className="figure">
                  <div className="k">Off by</div>
                  <div className="v mono">{shortDelta(result.delta)}</div>
                </div>
              </div>
            </div>
            <dl className="record">
              <div>
                <dt>Kiln row</dt>
                <dd>{result.zone.replace('mouth', 'Fire mouth').replace('body', 'Body').replace('tail', 'Tail')} · {result.slotId.split('-')[1] ? Number(result.slotId.split('-')[1]) + 1 : 1}</dd>
              </div>
              <div>
                <dt>Stoking</dt>
                <dd className="mono">{result.stoke >= 0 ? '+' : ''}{result.stoke}°C</dd>
              </div>
              <div>
                <dt>Crowd</dt>
                <dd className="mono">{Math.max(0, (counts as unknown as Record<string, number>)[result.zone] ?? 1) - 1} in chamber</dd>
              </div>
            </dl>
            <p className="explain">
              {explain(
                {
                  ware: kiln.wares.find((w) => w.id === result.wareName || w.name === result.wareName) ?? kiln.wares[0]!,
                  slot: kiln.slots.find((s) => s.id === result.slotId) ?? kiln.slots[0]!,
                  stoke: result.stoke,
                  temp: result.temp,
                  ideal: result.ideal,
                  delta: result.delta,
                  grade: result.grade,
                  transmuted: result.grade === 'transmuted',
                  score: result.score,
                },
                Math.max(0, (counts as unknown as Record<string, number>)[result.zone] ?? 1) - 1
              )}
            </p>
            <div className="panel-row">
              <span className="clock">
                <b className="mono">{result.score}</b>
                <span>points</span>
              </span>
              {result.streak > 0 ? (
                <span className="clock">
                  <b className="mono">{result.streak}</b>
                  <span>day streak</span>
                </span>
              ) : null}
              <span className="spacer" />
              <div className="actions">
                <button className="btn ghost" onClick={loadYard}>
                  See the yard
                </button>
                <button className="btn primary" onClick={backToPost}>
                  Back to the post
                </button>
              </div>
            </div>
            {result.already ? (
              <p className="panel-sub">
                One piece a day. The next kiln opens at 00:00 UTC — {hoursText(state?.hoursLeft ?? 0)} from
                now.
              </p>
            ) : null}
          </>
        ) : null}

        {phase === 'yard' ? (
          <div className="yard">
            <div className="panel-row">
              <div>
                <h2 className="panel-title">The yard</h2>
                <p className="panel-sub">
                  {yard ? `${yard.total} pieces in today’s load.` : 'Reading the shelves…'}
                </p>
              </div>
              <span className="spacer" />
              <button className="btn ghost small" onClick={() => setPhase(result ? 'result' : 'select')}>
                ← Back
              </button>
            </div>
            {yard?.balanced ? (
              <div className="banner">
                <span>窑火顺 — the load is spread end to end. Everyone who fired today gains {COLLECTIVE_BONUS} points.</span>
              </div>
            ) : null}
            <div className="yard-list">
              {(yard?.entries ?? []).map((entry, index) => (
                <div className="piece-row" key={`${entry.username}-${entry.at}-${index}`}>
                  <PieceGlyph
                    form={(kiln.wares.find((w) => w.name === entry.wareName) ?? kiln.wares[0]!).form}
                    glaze={(kiln.wares.find((w) => w.name === entry.wareName) ?? kiln.wares[0]!).glaze}
                    size={18}
                  />
                  <span
                    className="dot"
                    style={{
                      background:
                        entry.grade === 'transmuted'
                          ? 'var(--gold)'
                          : entry.grade === 'fine'
                            ? 'var(--ember-hot)'
                            : entry.grade === 'sound'
                              ? 'var(--celadon)'
                              : 'var(--bad)',
                    }}
                  />
                  <span className="who">{entry.username}</span>
                  <span className="what">
                    {ZONE_LABEL[entry.zone as keyof typeof ZONE_LABEL] ?? entry.zone} · {entry.temp}°C
                  </span>
                </div>
              ))}
              {yard && yard.entries.length === 0 ? (
                <p className="panel-sub">No one has loaded a piece yet today. Be the first.</p>
              ) : null}
            </div>
            <div className="panel-row">
              {ZONES.map((zone) => (
                <span className="clock" key={zone}>
                  <span>{ZONE_LABEL[zone]}</span>
                  <b className="mono">{yard?.counts[zone] ?? 0}</b>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
