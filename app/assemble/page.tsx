'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Scene from '@/components/Scene';
import { load, save, usePrefs } from '@/components/prefs';
import { assemblySteps, rigAt } from '@/lib/assembly';
import { resolve, type Resolved } from '@/lib/catalog';
import { sfx } from '@/lib/sound';
import { DEMO_BUILD, buildHref, decodeBuild, encodeBuild } from '@/lib/share';

export default function Assemble() {
  const qs = useSearchParams();
  const prefs = usePrefs();
  const build = useMemo(() => decodeBuild(qs.get('b')) ?? DEMO_BUILD, [qs]);
  const r = useMemo(() => resolve(build), [build]);
  const steps = useMemo(() => assemblySteps(r), [r]);
  const key = `fr:assembly2:${encodeBuild(build)}`;
  const [pos, setPos] = useState({ s: 0, a: 0 });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const saved = load<{ s: number; a: number; checked: Record<string, boolean> }>(key, { s: 0, a: 0, checked: {} });
    const s = Math.min(saved.s, steps.length - 1);
    setPos({ s, a: Math.min(saved.a, steps[s].actions.length - 1) });
    setChecked(saved.checked);
    loaded.current = true;
  }, [key, steps]);
  useEffect(() => { if (loaded.current) save(key, { ...pos, checked }); }, [key, pos, checked]);

  const step = steps[pos.s];
  const action = step.actions[pos.a];
  const rig = useMemo(() => rigAt(steps, pos.s, pos.a), [steps, pos]);
  const lastAction = pos.a === step.actions.length - 1;

  // Each action plays its own sounds, timed to the motion.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!prefs.sound) return;
    const timers = (action.sounds ?? []).map(([t, name]) => setTimeout(() => sfx[name](), t * 1000));
    return () => timers.forEach(clearTimeout);
  }, [action, prefs.sound]);

  // Autoplay walks through the actions of the current step, then waits for the checklist.
  useEffect(() => {
    if (!playing) return;
    if (lastAction) { setPlaying(false); return; }
    const t = setTimeout(() => setPos((p) => ({ ...p, a: p.a + 1 })), (action.hold ?? 3.4) * 1000);
    return () => clearTimeout(t);
  }, [playing, pos, action, lastAction]);

  const go = (s: number, a = 0) => {
    const ss = Math.max(0, Math.min(steps.length - 1, s));
    setPos({ s: ss, a: Math.max(0, Math.min(steps[ss].actions.length - 1, a)) });
  };
  const next = () => (lastAction ? go(pos.s + 1, 0) : setPos({ ...pos, a: pos.a + 1 }));
  const prev = () => (pos.a > 0 ? setPos({ ...pos, a: pos.a - 1 }) : pos.s > 0 && go(pos.s - 1, steps[pos.s - 1].actions.length - 1));
  const stepDone = (i: number) => steps[i].check.every((_, c) => checked[`${steps[i].id}:${c}`]);
  const totalMin = steps.reduce((t, s) => t + s.minutes, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <main className="wrap">
      <div className="assemble">
        <div className="stage">
          <Scene r={r} rig={rig} marks={action.marks} activeCables={action.active} hideCase={step.hideCase}
            focus={{ at: action.focus ?? 'boardCenter', zoom: action.zoom, from: action.from, key: `${pos.s}-${pos.a}` }} />
        </div>

        <div className="guide">
          <div className="row small muted">
            <span className="grow">Step {pos.s + 1} of {steps.length} · about {step.minutes} min · whole build about {Math.round(totalMin / 5) * 5} min</span>
            <Link href={buildHref('/build', build)}>Back to parts</Link>
          </div>
          <nav className="steplist" aria-label="Steps">
            {steps.map((s, i) => (
              <button key={s.id} className={`${i === pos.s ? 'on' : ''} ${i !== pos.s && stepDone(i) ? 'done' : ''}`}
                onClick={() => go(i)} title={s.title} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === pos.s ? 'step' : undefined}>{i + 1}</button>
            ))}
          </nav>

          <h1 className="step-title">{step.title}</h1>
          <div className="action-progress" aria-hidden>
            {step.actions.map((_, i) => <i key={i} className={i < pos.a ? 'done' : i === pos.a ? 'on' : ''} onClick={() => setPos({ ...pos, a: i })} />)}
          </div>

          <ol className="actions">
            {step.actions.map((a, i) => (
              <li key={i} className={i === pos.a ? 'on' : i < pos.a ? 'done' : ''} onClick={() => setPos({ ...pos, a: i })}>
                <span className="num">{i + 1}</span>
                <div>
                  <div className="t">{a.t}</div>
                  {i === pos.a && a.why && <div className="why">{a.why}</div>}
                  {i === pos.a && a.bios && <BiosMock r={r} />}
                </div>
              </li>
            ))}
          </ol>

          <div className="player">
            <button className="btn" onClick={prev} disabled={pos.s === 0 && pos.a === 0} aria-label="Previous action">◀</button>
            <button className="btn primary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Pause' : lastAction ? 'Replay step' : 'Play step'}</button>
            <button className="btn" onClick={next} disabled={pos.s === steps.length - 1 && lastAction} aria-label="Next action">▶</button>
          </div>
          <p className="small muted" style={{ marginTop: 4 }}>Arrow keys step through actions · Space plays. Drag the 3D view to look around at any time.</p>

          {step.watchOut && <div className="watch small"><b>Watch out:</b> {step.watchOut}</div>}

          {lastAction && (
            <section className="checks">
              <h3>Check before moving on</h3>
              {step.check.map((t, c) => {
                const id = `${step.id}:${c}`;
                return (
                  <label key={id}>
                    <input type="checkbox" checked={!!checked[id]} onChange={(e) => { setChecked({ ...checked, [id]: e.target.checked }); if (e.target.checked && prefs.sound) sfx.tick(); }} />
                    <span>{t}</span>
                  </label>
                );
              })}
              {pos.s < steps.length - 1
                ? <button className={`btn ${stepDone(pos.s) ? 'primary' : ''}`} style={{ width: '100%', justifyContent: 'center' }} onClick={() => { if (prefs.sound) sfx.success(); go(pos.s + 1); }}>
                    {stepDone(pos.s) ? `Next: ${steps[pos.s + 1].title}` : 'Next step (checks not ticked)'}
                  </button>
                : <Link className="btn primary" href={buildHref('/troubleshoot', build)}>Something not working?</Link>}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

/** What the BIOS front page shows on a successful first boot with these parts. */
function BiosMock({ r }: { r: Resolved }) {
  const ddr5 = r.ram?.mem === 'DDR5';
  const rated = r.ram?.name.match(/DDR\d-(\d+)/)?.[1] ?? '';
  return (
    <div className="bios">
      <div className="bios-head"><span>BIOS</span><span>EZ Mode</span></div>
      <div className="bios-grid">
        <div><small>CPU</small>{r.cpu?.name}</div>
        <div><small>Memory</small>{r.ram?.gb} GB · {ddr5 ? 'DDR5-4800' : 'DDR4-2133'} <em>{ddr5 ? 'EXPO' : 'XMP'}: off → {rated} MT/s</em></div>
        <div><small>Storage</small>{r.storage?.name} ({r.storage?.tb} TB)</div>
        <div><small>CPU temp</small>34 °C</div>
      </div>
    </div>
  );
}
