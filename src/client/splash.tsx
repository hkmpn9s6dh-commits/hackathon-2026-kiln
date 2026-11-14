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
      <svg viewBox="0 0 800 485" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="800" height="485" fill="#f4ede2" />

        {/* the kiln wall, one arch, one piece in front of it */}
        <rect x="-10" y="0" width="520" height="306" fill="#bda58b" />
        <path d="M26 306 L26 176 Q188 96 424 156 L424 306 Z" fill="#9a5820" />
        <path d="M42 306 L42 190 Q188 118 408 172 L408 306 Z" fill="#120a06" />
        <path d="M42 262 Q188 240 408 266 L408 306 L42 306 Z" fill="#a8451c" />
        <path d="M42 284 Q188 266 408 288 L408 306 L42 306 Z" fill="#e0662a" />
        <path d="M42 296 Q188 284 408 298 L408 306 L42 306 Z" fill="#ffce94" />

        {/* the yard floor, a single line across the card */}
        <rect x="-10" y="306" width="820" height="2" fill="#8c7358" opacity="0.5" />

        {/* one piece, standing on that line, lit by the arch */}
        <g transform="translate(596 306) scale(1.05)">
          <ellipse cx="6" cy="2" rx="40" ry="7" fill="#5a3e2a" opacity="0.26" />
          <path
            d="M-12 -58 C-14 -50 -31 -46 -31 -22 C-31 -5 -15 0 0 0 C15 0 31 -5 31 -22 C31 -46 14 -50 12 -58 Z"
            fill="#2f5aa8"
            stroke="#221a14"
            strokeWidth="2"
          />
          <path d="M-24 -34 C-16 -42 -4 -46 6 -46" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="5" fill="none" />
          <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="#0b0603" />
          <ellipse cx="0" cy="-58" rx="12" ry="3.6" fill="none" stroke="#221a14" strokeWidth="2" />
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
          One piece each. Everyone fires the same kiln. Miss the heat and it comes out chalk.
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
