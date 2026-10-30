'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CATEGORY_ORDER, getPart } from '@/lib/catalog';
import { gamingVerdict } from '@/lib/explain';
import { Needs, Resolution, USE_LABEL, Use, recommend, scores } from '@/lib/recommend';
import { buildHref, encodeBuild } from '@/lib/share';

const RES: { v: Resolution; t: string; d: string }[] = [
  { v: '1080', t: '1080p', d: 'Most common, cheapest to drive. 24" monitors.' },
  { v: '1440', t: '1440p', d: 'Sharper, the popular upgrade. 27" monitors.' },
  { v: '4k', t: '4K', d: 'Very sharp, needs a powerful graphics card.' },
];

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [n, setN] = useState<Needs>({ uses: [], budget: 1000, resolution: '1080', wifi: true, quiet: false, small: false });
  const toggle = (u: Use) => setN((c) => ({ ...c, uses: c.uses.includes(u) ? c.uses.filter((x) => x !== u) : [...c.uses, u] }));
  const tiers = useMemo(() => (step === 3 ? recommend(n) : []), [step, n]);
  const gaming = n.uses.some((u) => u === 'esports' || u === 'aaa' || u === 'streaming');

  return (
    <main className="wrap wizard" style={step === 3 ? { maxWidth: 1100 } : undefined}>
      <div className="steps-dots" aria-hidden>{[0, 1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>

      {step === 0 && (
        <section>
          <h1>What will you use it for?</h1>
          <p className="muted">Pick everything that applies.</p>
          <div className="opts">
            {(Object.keys(USE_LABEL) as Use[]).map((u) => (
              <button key={u} className={`opt ${n.uses.includes(u) ? 'on' : ''}`} aria-pressed={n.uses.includes(u)} onClick={() => toggle(u)}>
                <div className="t">{USE_LABEL[u]}</div>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn primary" disabled={!n.uses.length} onClick={() => setStep(gaming ? 1 : 2)}>Next</button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>What monitor will you play on?</h1>
          <p className="muted">Not sure? Choose 1080p. It is the safe default.</p>
          <div className="opts">
            {RES.map((r) => (
              <button key={r.v} className={`opt ${n.resolution === r.v ? 'on' : ''}`} aria-pressed={n.resolution === r.v} onClick={() => setN({ ...n, resolution: r.v })}>
                <div className="t">{r.t}</div><div className="small muted">{r.d}</div>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn" onClick={() => setStep(0)}>Back</button>
            <button className="btn primary" onClick={() => setStep(2)}>Next</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>What can you spend on the tower?</h1>
          <p className="muted">Just the computer itself. We add monitor, keyboard and Windows separately later so nothing surprises you.</p>
          <div className="card">
            <div className="row"><span className="grow" style={{ fontSize: 32, fontWeight: 800 }}>${n.budget.toLocaleString()}</span></div>
            <input type="range" min={500} max={2500} step={50} value={n.budget} aria-label="Budget"
              onChange={(e) => setN({ ...n, budget: Number(e.target.value) })} />
            <div className="row small muted"><span className="grow">$500</span><span>$2,500</span></div>
          </div>
          <div className="opts" style={{ marginTop: 14 }}>
            <button className={`opt ${n.wifi ? 'on' : ''}`} aria-pressed={n.wifi} onClick={() => setN({ ...n, wifi: !n.wifi })}>
              <div className="t">I need Wi-Fi</div><div className="small muted">No Ethernet cable where the PC will sit.</div>
            </button>
            <button className={`opt ${n.quiet ? 'on' : ''}`} aria-pressed={n.quiet} onClick={() => setN({ ...n, quiet: !n.quiet })}>
              <div className="t">Keep it quiet</div><div className="small muted">Bedroom or shared space.</div>
            </button>
            <button className={`opt ${n.small ? 'on' : ''}`} aria-pressed={n.small} onClick={() => setN({ ...n, small: !n.small })}>
              <div className="t">Small is OK</div><div className="small muted">Allow compact cases (a bit harder to build in).</div>
            </button>
          </div>
          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn" onClick={() => setStep(gaming ? 1 : 0)}>Back</button>
            <button className="btn primary" onClick={() => setStep(3)}>Show my builds</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1>Your builds</h1>
          <p className="muted">Every build below is checked for fit and power. Open one to see it in 3D and tweak it.</p>
          <div className="tiers">
            {tiers.map((t) => {
              const s = scores(t.build);
              return (
                <div key={t.key} className={`card tier ${t.key}`}>
                  <div className="row"><h2 className="grow" style={{ margin: 0 }}>{t.label}</h2><span className="price" style={{ fontSize: 22, fontWeight: 800 }}>${t.price.toLocaleString()}</span></div>
                  <p className="small muted">{t.pitch}</p>
                  <p className="small"><b>Gaming:</b> {gamingVerdict(s.gaming, n.resolution)}</p>
                  <ul>
                    {CATEGORY_ORDER.map((c) => { const p = getPart(t.build[c]); return p ? <li key={c}>{p.name}</li> : null; })}
                    {!t.build.gpu && <li>Built-in graphics (no graphics card)</li>}
                  </ul>
                  <Link className="btn primary" href={buildHref('/build', t.build)}>Open this build</Link>
                </div>
              );
            })}
          </div>
          {tiers.length > 1 && (
            <p style={{ marginTop: 16 }}>
              <Link className="btn" href={`/compare?${new URLSearchParams(Object.fromEntries(tiers.map((t, i) => [`b${i}`, encodeBuild(t.build)])))}&res=${n.resolution}`}>
                Compare side by side and see what each upgrade buys you
              </Link>
            </p>
          )}
          <button className="btn" style={{ marginTop: 10 }} onClick={() => setStep(2)}>Change budget</button>
        </section>
      )}
    </main>
  );
}
