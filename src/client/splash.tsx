import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './index.css';

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { StateResponse } from '../shared/api';
import { GRADE_LABEL } from '../shared/kiln';
import { fetchState, host, openGame } from './net';

function hoursText(hours: number): string {
  const total = Math.max(0, Math.floor(hours * 60));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

/**
 * The poster. This is what a redditor sees at 300px in a feed, so it is built
 * like a poster: one object, one fire, one line of type. Not a scene.
 */
function Poster(): React.ReactElement {
  return (
    <div className="poster" aria-hidden="true">
      <svg viewBox="0 0 640 500" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="640" height="500" fill="#bda58b" />

        {/* one whole arch, centred, with the piece standing inside its mouth */}
        <path d="M56 402 L56 208 Q320 92 584 208 L584 402 Z" fill="#9a5820" />
        <path d="M84 402 L84 232 Q320 128 556 232 L556 402 Z" fill="#1d1109" />
        <path d="M84 402 L84 232 Q320 128 556 232 L556 402 Z" fill="none" stroke="#0d0805" strokeWidth="2" />

        {/* fire floor inside the mouth */}
        <path d="M84 402 L84 372 Q320 340 556 372 L556 402 Z" fill="#7a2f12" />
        <path d="M84 402 L84 384 Q320 356 556 384 L556 402 Z" fill="#c9561f" />
        <path d="M84 402 L84 394 Q320 372 556 394 L556 402 Z" fill="#ffc37a" />

        {/* the piece, centre stage, lit from the fire under it */}
        <g transform="translate(320 398) scale(1.5)">
          <ellipse cx="0" cy="2" rx="42" ry="8" fill="#1a0d06" opacity="0.55" />
          <path
            d="M-12 -58 C-14 -50 -31 -46 -31 -22 C-31 -5 -15 0 0 0 C15 0 31 -5 31 -22 C31 -46 14 -50 12 -58 Z"
            fill="#2f5aa8"
            stroke="#0f0a07"
            strokeWidth="1.4"
          />
          <path d="M-24 -34 C-16 -42 -4 -46 6 -46" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="5" fill="none" />
          <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="#070402" />
          <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="none" stroke="#0f0a07" strokeWidth="1.4" />
        </g>

        {/* the yard floor */}
        <rect x="-10" y="402" width="660" height="110" fill="#a58c6d" />
        <rect x="-10" y="398" width="660" height="4" fill="#8c7358" opacity="0.6" />

        {/* the only verb: a stoke band with the needle in it */}
        <g transform="translate(212 432)">
          <rect x="0" y="0" width="216" height="12" rx="6" fill="#5f4b38" opacity="0.5" />
          <rect x="62" y="0" width="56" height="12" rx="6" fill="#a8451c" />
          <rect x="128" y="-6" width="4" height="24" fill="#221a14" />
        </g>
      </svg>
    </div>
  );
}

function Card(): React.ReactElement {
  const [state, setState] = useState<StateResponse | null>(null);

  useEffect(() => {
    let alive = true;
    fetchState()
      .then((next) => {
        if (alive) setState(next);
      })
      .catch(() => {
        /* the card still works without numbers */
      });
    return () => {
      alive = false;
    };
  }, []);

  const total = state ? state.counts.mouth + state.counts.body + state.counts.tail : 0;

  return (
    <div className="card">
      <Poster />
      <div className="card-copy">
        <span className="kicker">One kiln a day</span>
        <h1>KILN</h1>
        <p className="tag">
          Pick a piece. Stoke three times. Everyone fires the same kiln — miss the heat and it comes out chalk.
        </p>
        <div className="cta">
          <button className="btn primary" onClick={(event) => openGame(event)}>
            {state?.mine ? 'See today’s yard' : 'Load your piece'}
          </button>
          <span className="status">
            {state?.mine
              ? `${GRADE_LABEL[state.mine.grade]} · ${state.mine.temp}°C`
              : state
                ? `${total} ${total === 1 ? 'piece' : 'pieces'} in · ${hoursText(state.hoursLeft)} left`
                : host.onReddit
                  ? 'warming'
                  : 'local build'}
          </span>
        </div>
        {state && state.streak > 1 ? <span className="streak">{state.streak}-day streak</span> : null}
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Card />);
}
