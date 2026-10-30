'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import Scene from '@/components/Scene';
import { resolve } from '@/lib/catalog';
import { SYMPTOMS } from '@/lib/troubleshoot';
import { DEMO_BUILD, decodeBuild } from '@/lib/share';

export default function Troubleshoot() {
  const qs = useSearchParams();
  const build = useMemo(() => decodeBuild(qs.get('b')) ?? DEMO_BUILD, [qs]);
  const r = useMemo(() => resolve(build), [build]);
  const [symptom, setSymptom] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const [fixed, setFixed] = useState(false);
  const checks = useMemo(() => SYMPTOMS.find((s) => s.id === symptom)?.checks(r) ?? [], [symptom, r]);
  const check = checks[n];

  return (
    <main className="wrap">
      <div className="assemble">
        <div className="stage">
          <Scene r={r} status={check?.focus ? { [check.focus]: 'focus' } : {}} activeCables={check?.cables} />
        </div>
        <div>
          <h1 style={{ fontSize: 26 }}>First boot troubleshooter</h1>
          {!qs.get('b') && <p className="small muted">Showing a sample build. Open this from your own build to get checks for your parts.</p>}
          {!symptom && (
            <>
              <p className="muted">What is happening? Unplug the power cable before touching anything inside.</p>
              <div className="opts" style={{ gridTemplateColumns: '1fr' }}>
                {SYMPTOMS.map((s) => <button key={s.id} className="opt" onClick={() => { setSymptom(s.id); setN(0); setFixed(false); }}><span className="t">{s.label}</span></button>)}
              </div>
            </>
          )}
          {symptom && check && !fixed && (
            <>
              <p className="muted">{SYMPTOMS.find((s) => s.id === symptom)!.label} · check {n + 1} of {checks.length}</p>
              <div className="card" style={{ fontSize: 17 }}>{check.text}</div>
              <div className="stepnav">
                <button className="btn" onClick={() => setSymptom(null)}>Different problem</button>
                <button className="btn primary" onClick={() => setN(n + 1)}>{n + 1 < checks.length ? 'Checked, still broken' : 'Still broken'}</button>
              </div>
              <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setFixed(true)}>That fixed it</button>
            </>
          )}
          {symptom && (fixed || !check) && (
            <div className="card">
              {fixed ? (
                <>
                  <h3>Nice work</h3>
                  <p className="muted">Most first-build problems are a loose cable or a half-seated part, exactly like this one.</p>
                </>
              ) : (
                <>
                  <h3>Out of easy checks</h3>
                  <p className="muted">
                    Take a clear photo of the inside and of any lit debug LEDs, then post it with your build link to r/buildapc
                    or the support forum for your motherboard brand. Someone will usually spot the issue quickly.
                  </p>
                </>
              )}
              <button className="btn" onClick={() => setSymptom(null)}>Start over</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
