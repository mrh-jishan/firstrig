'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Scene from '@/components/Scene';
import { load, save } from '@/components/prefs';
import { assemblySteps } from '@/lib/assembly';
import { resolve } from '@/lib/catalog';
import { DEMO_BUILD, buildHref, decodeBuild, encodeBuild } from '@/lib/share';

export default function Assemble() {
  const qs = useSearchParams();
  const build = useMemo(() => decodeBuild(qs.get('b')) ?? DEMO_BUILD, [qs]);
  const r = useMemo(() => resolve(build), [build]);
  const steps = useMemo(() => assemblySteps(r), [r]);
  const key = `fr:assembly:${encodeBuild(build)}`;
  const [i, setI] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const saved = load<{ i: number; checked: Record<string, boolean> }>(key, { i: 0, checked: {} });
    setI(Math.min(saved.i, steps.length - 1));
    setChecked(saved.checked);
  }, [key, steps.length]);
  useEffect(() => { save(key, { i, checked }); }, [key, i, checked]);

  const step = steps[i];
  const stepDone = (idx: number) => steps[idx].check.every((_, c) => checked[`${steps[idx].id}:${c}`]);
  const allChecked = stepDone(i);
  const totalMin = steps.reduce((t, s) => t + s.minutes, 0);
  const go = (n: number) => { setI(Math.max(0, Math.min(steps.length - 1, n))); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <main className="wrap">
      <div className="assemble">
        <div className="stage">
          <Scene r={r} installed={step.show} active={step.active} cables={step.cables} activeCables={step.activeCables}
            hideCase={step.hideCase} animKey={`${step.id}-${replay}`} />
        </div>

        <div>
          <div className="row small muted" style={{ marginBottom: 8 }}>
            <span className="grow">Step {i + 1} of {steps.length} · about {step.minutes} min (whole build about {Math.round(totalMin / 5) * 5} min)</span>
            <Link href={buildHref('/build', build)}>Back to parts</Link>
          </div>
          <nav className="steplist" aria-label="Steps">
            {steps.map((s, idx) => (
              <button key={s.id} className={`${idx === i ? 'on' : ''} ${idx !== i && stepDone(idx) ? 'done' : ''}`}
                onClick={() => go(idx)} aria-label={`Step ${idx + 1}: ${s.title}`} aria-current={idx === i ? 'step' : undefined}>{idx + 1}</button>
            ))}
          </nav>

          <h1 style={{ fontSize: 26 }}>{step.title}</h1>
          {step.active && <button className="btn small" style={{ padding: '4px 10px', marginBottom: 8 }} onClick={() => setReplay((n) => n + 1)}>Replay animation</button>}

          <ol className="do">{step.doThis.map((t) => <li key={t}>{t}</li>)}</ol>

          {step.watchOut && <div className="watch small" style={{ margin: '14px 0' }}><b>Watch out:</b> {step.watchOut}</div>}

          <h3 style={{ marginTop: 18 }}>Check before moving on</h3>
          <div className="checks">
            {step.check.map((t, c) => {
              const id = `${step.id}:${c}`;
              return (
                <label key={id}>
                  <input type="checkbox" checked={!!checked[id]} onChange={(e) => setChecked({ ...checked, [id]: e.target.checked })} />
                  <span>{t}</span>
                </label>
              );
            })}
          </div>

          <div className="stepnav">
            <button className="btn" disabled={i === 0} onClick={() => go(i - 1)}>Back</button>
            {i < steps.length - 1
              ? <button className={`btn ${allChecked ? 'primary' : ''}`} onClick={() => go(i + 1)}>{allChecked ? 'Next step' : 'Next (checks not ticked)'}</button>
              : <Link className="btn primary" href={buildHref('/troubleshoot', build)}>Something not working?</Link>}
          </div>
          <p className="small muted">
            Tip: open this page on your phone and prop it next to your PC. Your progress is saved on this device.
            Always follow your motherboard manual if it differs.
          </p>
        </div>
      </div>
    </main>
  );
}
