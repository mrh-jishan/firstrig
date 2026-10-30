'use client';

import { useMemo, useState } from 'react';
import type { Build } from '@/lib/catalog';
import { exportMinutes, fpsTier, gameFps, type Res } from '@/lib/perf';

const RES: { v: Res; label: string }[] = [{ v: '1080', label: '1080p' }, { v: '1440', label: '1440p' }, { v: '4k', label: '4K' }];

/** Estimated FPS per game for a build, with optional before/after deltas when a part was just swapped. */
export default function PerfPanel({ build, before, res: resProp, onRes, compact }: { build: Build; before?: Build | null; res?: Res; onRes?: (r: Res) => void; compact?: boolean }) {
  const [own, setOwn] = useState<Res>('1080');
  const res = resProp ?? own;
  const setRes = onRes ?? setOwn;
  const now = useMemo(() => gameFps(build, res), [build, res]);
  const prev = useMemo(() => (before ? gameFps(before, res) : null), [before, res]);
  const max = res === '1080' ? 360 : res === '1440' ? 280 : 180;
  const exp = exportMinutes(build);
  const expBefore = before ? exportMinutes(before) : null;
  const games = compact ? now.filter((g) => ['fortnite', 'valorant', 'cyberpunk', 'minecraft'].includes(g.id)) : now;

  return (
    <div className="perf">
      <div className="perf-head">
        <h3>Estimated performance</h3>
        <div className="seg" role="tablist" aria-label="Resolution">
          {RES.map((r) => <button key={r.v} role="tab" aria-selected={res === r.v} className={res === r.v ? 'on' : ''} onClick={() => setRes(r.v)}>{r.label}</button>)}
        </div>
      </div>
      <ul className="fps-list">
        {games.map((g) => {
          const p = prev?.find((x) => x.id === g.id);
          const d = p ? g.fps - p.fps : 0;
          const tier = fpsTier(g.fps);
          return (
            <li key={g.id}>
              <div className="fps-row">
                <span className="game">{g.name}</span>
                {d !== 0 && <span className={`delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '+' : ''}{d}</span>}
                <span className="fps"><b>{g.fps >= 1000 ? '999+' : g.fps}</b> fps</span>
              </div>
              <div className={`fps-bar ${tier.tone}`}><div style={{ width: `${Math.min(100, (g.fps / max) * 100)}%` }} /></div>
              {!compact && (
                <div className="fps-meta">
                  <span className={`tier ${tier.tone}`}>{tier.label}</span>
                  {g.limitedBy !== 'balanced' && g.fps > 0 && <span className="lim">{g.limitedBy === 'cpu' ? 'CPU-limited' : 'GPU-limited'}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!compact && (
        <div className="perf-foot">
          <div><small>10-min 4K video export</small><b>~{exp} min</b>{expBefore !== null && expBefore !== exp && <span className={`delta ${exp < expBefore ? 'up' : 'down'}`}>{exp < expBefore ? '-' : '+'}{Math.abs(Math.round((exp - expBefore) * 10) / 10)} min</span>}</div>
        </div>
      )}
      <p className="small muted perf-note">High settings, no ray tracing or upscaling. Estimates from relative scores, typically within ±25%.</p>
    </div>
  );
}
