import { useCallback, useMemo, useState } from 'react';
import { showShareSheet } from '@devvit/web/client';
import type { BoardRow, InitResponse, PotView } from '../shared/api.ts';
import { VERDICT_LABEL, noteForVerdict, shareText } from '../shared/sim/score.ts';
import { cellLabel, cellLabelZh, cellOf, loadMultiplier } from '../shared/sim/kiln.ts';
import type { FireSample, WareDef } from '../shared/types.ts';
import { FireStage } from './components/FireStage.tsx';
import { KilnMap, spotVerdict } from './components/KilnMap.tsx';
import { PotCanvas } from './components/PotCanvas.tsx';
import { useGame } from './hooks/useGame.ts';

const VERDICT_TONE: Record<string, string> = {
  bad: '',
  plain: '',
  good: 'great',
  great: 'great',
  rare: 'rare',
};

export function App(): React.ReactElement {
  const game = useGame();
  const { init, phase } = game;

  if (phase === 'loading' || !init) {
    return (
      <div className="app">
        <div className="shell">
          <div className="bar">
            <div className="mark">
              K<em>I</em>LN
            </div>
          </div>
          <p className="note center" style={{ marginTop: '22vh' }}>
            lighting the kiln…
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="app">
        <div className="shell">
          <div className="bar">
            <div className="mark">
              K<em>I</em>LN
            </div>
          </div>
          <p className="note center" style={{ marginTop: '18vh' }}>
            {game.error}
          </p>
          <button className="btn" onClick={game.reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="shell">
        <TopBar init={init} />
        {phase === 'result' ? (
          <Result init={init} game={game} />
        ) : phase === 'fire' ? (
          <Firing init={init} onDone={game.submit} />
        ) : (
          <Loading init={init} game={game} />
        )}
      </div>
    </div>
  );
}

function TopBar({ init }: { init: InitResponse }): React.ReactElement {
  const [y, m, d] = init.day.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const stamp = `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''} ${y}`;
  const left = Math.max(0, init.endsAt - init.now);
  const hours = Math.floor(left / 3_600_000);
  const mins = Math.floor((left % 3_600_000) / 60_000);
  return (
    <div className="bar">
      <div className="mark">
        K<em>I</em>LN
      </div>
      <div className="dateline">
        {stamp} · resets in {hours}h {String(mins).padStart(2, '0')}m
      </div>
      {init.me.streak > 0 ? (
        <div className="streak">
          <b>{init.me.streak}</b> day{init.me.streak === 1 ? '' : 's'}
        </div>
      ) : (
        <div className="streak">{init.me.loggedIn ? init.me.name : 'guest'}</div>
      )}
    </div>
  );
}

function WareCard({ ware, init, compact }: { ware: WareDef; init: InitResponse; compact?: boolean }): React.ReactElement {
  return (
    <div className="ware">
      <PotCanvas ware={ware} width={compact ? 58 : 74} height={compact ? 58 : 74} className="ware-thumb" />
      <div>
        <h1 className="ware-name">{ware.name}</h1>
        <div className="ware-zh">{ware.zh}</div>
        <div className="ware-meta">
          {ware.body === 'thin' ? 'thin body · cracks if slammed' : 'thick body · takes a fast fire'}
        </div>
      </div>
      <div className="band">
        <b>{ware.mid.toFixed(2)}</b>
        wants ±{ware.half.toFixed(3)}
        <br />
        fire peaks {init.peak.toFixed(2)}
      </div>
    </div>
  );
}

function Loading({ init, game }: { init: InitResponse; game: ReturnType<typeof useGame> }): React.ReactElement {
  const spot = game.ghost
    ? spotVerdict(init.ware, init.peak, game.ghost.x, game.ghost.y, init.cells, init.total)
    : null;
  const label =
    spot === null
      ? 'Pick a spot'
      : spot.fit === 'fit'
        ? 'Lands true'
        : spot.fit === 'over'
          ? 'Will overfire'
          : 'Will underfire';

  return (
    <>
      <WareCard ware={init.ware} init={init} />

      <KilnMap
        ware={init.ware}
        peak={init.peak}
        cells={init.cells}
        pots={init.pots}
        total={init.total}
        ghost={game.ghost}
        onPlace={game.place}
      >
        <div className="readout">
          <div className={`fit ${spot && spot.fit === 'fit' ? 'ok' : 'no'}`}>
            {label}
            {spot ? ` · ${spot.est}` : ''}
          </div>
          <div>
            heat {spot ? spot.eff.toFixed(2) : '—'} · band{' '}
            {(init.ware.mid - init.ware.half).toFixed(2)}–{(init.ware.mid + init.ware.half).toFixed(2)}
          </div>
          <div style={{ opacity: 0.7 }}>
            {spot
              ? `${spot.crowd} pot${spot.crowd === 1 ? '' : 's'} on this shelf · ${init.total} in the kiln`
              : `${init.total} in the kiln`}
          </div>
        </div>
      </KilnMap>

      <div className="act">
        <button className="btn" disabled={!game.ghost} onClick={game.startFire}>
          Light the fire
          <small>
            {game.ghost
              ? `${cellLabelZh(cellOf(game.ghost.x, game.ghost.y))} · ${cellLabel(cellOf(game.ghost.x, game.ghost.y))}`
              : 'place your pot first'}
          </small>
        </button>
      </div>

      <p className="caption">
        One pot a day, one shared kiln. Everyone in this subreddit fires the same schedule — the
        white line is where <b>{init.ware.name.toLowerCase()}</b> lands true. Pots already standing on
        a shelf steal each other’s draft, so the best spot is not always the empty one.
      </p>
    </>
  );
}

function Firing({ init, onDone }: { init: InitResponse; onDone: (s: FireSample[]) => void }): React.ReactElement {
  return (
    <>
      <WareCard ware={init.ware} init={init} compact />
      <FireStage ware={init.ware} curve={init.curve} onDone={onDone} />
      <p className="caption">
        {init.schedule} Hold to feed; let go to let it breathe. The pot only feels what the flame
        did a moment ago, so stoke <b>ahead</b> of the line, not at it.
      </p>
    </>
  );
}

function Result({ init, game }: { init: InitResponse; game: ReturnType<typeof useGame> }): React.ReactElement {
  const played: PotView | null = game.result?.pot ?? init.me.played;
  const verdict = played?.v ?? 'good';
  const score = played?.s ?? 0;
  const quality = played?.q ?? 0;
  const cell = played ? cellOf(played.x, played.y) : 0;
  const board: BoardRow[] = game.result?.board ?? init.board;
  const streak = game.result?.streak ?? init.me.streak;
  const rank = game.result?.rank ?? init.me.rank;
  const total = game.result?.total ?? init.total;
  const named = VERDICT_LABEL[verdict];
  const [toast, setToast] = useState<string | null>(null);

  const share = useCallback(() => {
    const text = shareText({
      dayKey: init.day,
      ware: init.ware.name,
      zh: init.ware.zh,
      verdict,
      score,
      chamber: cell,
    });
    void (async () => {
      try {
        await showShareSheet({ title: 'KILN', text });
      } catch {
        try {
          await navigator.clipboard.writeText(text);
          setToast('copied to the clipboard');
        } catch {
          setToast('could not open the share sheet');
        }
      }
    })();
  }, [cell, init.day, init.ware.name, init.ware.zh, score, verdict]);

  const note = noteForVerdict(init.ware, verdict);
  const load = Math.round((1 - loadMultiplier(total)) * 100);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>{init.ware.name}</h2>
            <div className="zh">{init.ware.zh}</div>
          </div>
          <div className={`seal ${VERDICT_TONE[named.tone] ?? ''}`}>
            {named.zh}
            <br />
            {named.en}
          </div>
        </div>

        <div className="reveal">
          <PotCanvas
            ware={init.ware}
            width={210}
            height={190}
            className="card-pot"
            outcome={{
              verdict,
              quality,
              score,
              eff: 0,
              note,
              flambe: verdict === 'flambe',
            }}
            paint={{ heat: verdict === 'over' ? 0.5 : 0.16 }}
          />
        </div>

        <p className="card-note">{note}</p>

        <div className="row" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
          <div className="score">
            {score}
            <small>/100</small>
          </div>
          <div className="grow" />
          <div className="card-rows" style={{ borderTop: 'none', paddingTop: 0, textAlign: 'right' }}>
            <span>shelf</span>
            <b>
              {cellLabelZh(cell)} · {cellLabel(cell)}
            </b>
            <span>rank today</span>
            <b>{rank ? `#${rank} of ${total}` : '—'}</b>
            <span>streak</span>
            <b>
              {streak} day{streak === 1 ? '' : 's'}
            </b>
            <span>kiln load</span>
            <b>{load === 0 ? 'cold and empty' : `${load}% cold`}</b>
          </div>
        </div>

        <div className="caption" style={{ color: 'rgba(36,26,20,0.55)' }}>
          {init.ware.culture}
        </div>
      </div>

      <Board rows={board} me={init.me.name} />

      <div className="act">
        <button className="btn" onClick={share}>
          Share the pot
          <small>one line, no spoilers</small>
        </button>
      </div>

      <p className="caption">
        Tomorrow the kiln is loaded with <b>{init.nextWare.name}</b> ({init.nextWare.zh}). The
        schedule changes at 00:00 UTC — fire early, while the kiln is still cold and empty.
      </p>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}

function Board({ rows, me }: { rows: BoardRow[]; me: string }): React.ReactElement | null {
  const top = useMemo(() => rows.slice(0, 6), [rows]);
  if (top.length === 0) return null;
  return (
    <div className="board">
      <h3>Today’s kiln</h3>
      <ol>
        {top.map((row) => (
          <li key={`${row.rank}-${row.n}`}>
            <span>{row.rank}</span>
            <b className={row.n === me ? 'me' : ''}>{row.n}</b>
            <span className="v">{VERDICT_LABEL[row.v]?.zh ?? row.v}</span>
            <b>{row.s}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}
