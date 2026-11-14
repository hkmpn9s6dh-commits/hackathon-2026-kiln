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

        {/* the arch fills most of the frame: we are standing right at the mouth */}
        <path d="M-40 430 L-40 120 Q170 40 470 110 L470 430 Z" fill="#9a5820" />
        <path d="M-16 430 L-16 148 Q170 76 440 138 L440 430 Z" fill="#120a06" />
        <path d="M-16 336 Q170 300 440 350 L440 430 L-16 430 Z" fill="#a8451c" />
        <path d="M-16 376 Q170 344 440 388 L440 430 L-16 430 Z" fill="#e0662a" />
        <path d="M-16 402 Q170 376 440 412 L440 430 L-16 430 Z" fill="#ffce94" />

        {/* the yard floor, and the piece standing on it */}
        <rect x="-10" y="430" width="660" height="80" fill="#a58c6d" />
        <rect x="-10" y="426" width="660" height="4" fill="#8c7358" opacity="0.6" />

        <g transform="translate(492 430) scale(1.5)">
          <ellipse cx="6" cy="2" rx="40" ry="7" fill="#3a2418" opacity="0.35" />
          <path
            d="M-12 -58 C-14 -50 -31 -46 -31 -22 C-31 -5 -15 0 0 0 C15 0 31 -5 31 -22 C31 -46 14 -50 12 -58 Z"
            fill="#2f5aa8"
            stroke="#1a120c"
            strokeWidth="1.6"
          />
          <path d="M-24 -34 C-16 -42 -4 -46 6 -46" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="5" fill="none" />
          <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="#0b0603" />
          <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="none" stroke="#1a120c" strokeWidth="1.6" />
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
