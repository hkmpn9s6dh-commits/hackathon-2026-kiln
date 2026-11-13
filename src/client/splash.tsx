import './styles.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api.ts';
import { PotCanvas } from './components/PotCanvas.tsx';

function Splash(): React.ReactElement {
  const [init, setInit] = useState<InitResponse | null>(null);

  useEffect(() => {
    fetch('/api/init', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<InitResponse>) : null))
      .then((d) => setInit(d))
      .catch(() => undefined);
  }, []);

  const played = init?.me.played ?? null;

  return (
    <div className="app">
      <div className="shell" style={{ paddingTop: 16 }}>
        <div className="bar">
          <div className="mark">
            K<em>I</em>LN
          </div>
          <div className="dateline">one pot a day</div>
        </div>

        {init ? (
          <div className="ware">
            <PotCanvas ware={init.ware} width={62} height={62} className="ware-thumb" />
            <div>
              <div className="ware-name" style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>
                {init.ware.name}
              </div>
              <div className="ware-zh">{init.ware.zh}</div>
              <div className="ware-meta">
                {played
                  ? `you fired ${played.s}/100 today`
                  : `${init.total} pot${init.total === 1 ? '' : 's'} in the kiln · ${init.me.others} other${init.me.others === 1 ? '' : 's'} firing`}
              </div>
            </div>
            <div className="band">
              <b>{init.ware.mid.toFixed(2)}</b>
              ideal heat
            </div>
          </div>
        ) : (
          <p className="note">warming the kiln…</p>
        )}

        <button className="btn" onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}>
          {played ? 'See today’s kiln' : 'Enter the kiln'}
          <small>{played ? 'your pot is out' : 'place a pot · hold the fire · open the door'}</small>
        </button>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Splash />);
