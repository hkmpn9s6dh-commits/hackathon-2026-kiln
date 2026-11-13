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
      <svg viewBox="0 0 800 520" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="800" height="520" fill="#f4ede2" />

        {/* kiln: flat terracotta, a black doorway, a band of fire. No gradients:
            flat shapes survive being shrunk to 300px. */}
        <path d="M-20 520 L-20 132 Q150 88 372 120 L372 520 Z" fill="#b4552f" stroke="#221a14" strokeWidth="3" />
        <path d="M-20 520 L-20 168 Q150 126 336 152 L336 520 Z" fill="#140b07" />
        <path d="M-20 330 Q150 300 336 316 L336 520 L-20 520 Z" fill="#c2451c" />
        <path d="M-20 362 Q150 338 336 350 L336 520 L-20 520 Z" fill="#ffb35e" />
        <path d="M-20 394 Q150 372 336 382 L336 520 L-20 520 Z" fill="#fff3d6" />
        <g fill="#8e3f22">
          <rect x="-20" y="236" width="356" height="3" opacity="0.55" />
          <rect x="-20" y="330" width="356" height="3" opacity="0.55" />
        </g>

        {/* embers */}
        <g fill="#c2451c">
          <circle cx="250" cy="372" r="4" />
          <circle cx="290" cy="300" r="3" opacity="0.8" />
          <circle cx="206" cy="286" r="2.4" opacity="0.6" />
          <circle cx="322" cy="412" r="3" opacity="0.7" />
        </g>

        {/* one piece, flat cobalt with one hard highlight */}
        <g transform="translate(520 350) scale(0.92)">
          <ellipse cx="4" cy="6" rx="86" ry="14" fill="#8a6a48" opacity="0.22" />
          <path
            d="M-25 -118 C-29 -103 -65 -95 -61 -46 C-57 -8 -27 0 0 0 C27 0 57 -8 61 -46 C65 -95 29 -103 25 -118 Z"
            fill="#2f5aa8"
            stroke="#221a14"
            strokeWidth="3"
          />
          <path d="M-52 -54 C-40 -66 -16 -72 2 -72" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="7" fill="none" />
          <ellipse cx="0" cy="-118" rx="25" ry="6" fill="#0b0603" />
          <ellipse cx="0" cy="-118" rx="25" ry="6" fill="none" stroke="#221a14" strokeWidth="3" />
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
