'use client';

import dynamic from 'next/dynamic';
import type { SceneProps } from './PCScene';
import type { SceneKey } from '@/lib/assembly';
import { usePrefs } from './prefs';

const PCScene = dynamic(() => import('./PCScene'), {
  ssr: false,
  loading: () => <div className="scene-wrap"><div className="scene-loading">Loading 3D view...</div></div>,
});

const FLAT: { k: SceneKey; label: string; cls?: string }[] = [
  { k: 'cpu', label: 'CPU' }, { k: 'cooler', label: 'Cooler' }, { k: 'ram', label: 'RAM' }, { k: 'storage', label: 'SSD' },
  { k: 'board', label: 'Motherboard', cls: 'wide' }, { k: 'gpu', label: 'Graphics card', cls: 'wide' },
  { k: 'psu', label: 'Power supply', cls: 'wide' }, { k: 'case', label: 'Case', cls: 'wide' },
];

// Text-first view for phones, older machines and screen readers.
function FlatScene(p: SceneProps) {
  const shown = new Set(p.installed ?? FLAT.map((f) => f.k));
  return (
    <div className="scene-wrap" role="group" aria-label="Build diagram">
      <div className="flat">
        {FLAT.map(({ k, label, cls }) => {
          const part = p.r[k];
          const state = p.status?.[k] ?? (p.active === k ? 'focus' : '');
          const off = !shown.has(k) && p.active !== k;
          return (
            <button key={k} className={`slot ${cls ?? ''} ${state} ${off ? 'off' : ''}`} onClick={() => p.onPick?.(k)} style={{ textAlign: 'left', background: 'var(--panel)' }}>
              <b>{label}{p.active === k ? ' (install now)' : ''}</b>
              {part?.name ?? (k === 'gpu' ? 'Built-in graphics' : 'Not chosen')}
            </button>
          );
        })}
        {(p.activeCables?.length ?? 0) > 0 && (
          <div className="slot focus full"><b>Cables this step</b>{p.activeCables!.join(', ')}</div>
        )}
      </div>
    </div>
  );
}

export default function Scene(props: SceneProps) {
  const prefs = usePrefs();
  if (prefs.flat) return <FlatScene {...props} />;
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <PCScene {...props} lowGfx={prefs.lowGfx} showLabels={prefs.labels} />
    </div>
  );
}
