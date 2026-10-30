'use client';

import Link from 'next/link';
import Scene from '@/components/Scene';
import { resolve } from '@/lib/catalog';
import { DEMO_BUILD, buildHref } from '@/lib/share';

const FEATURES = [
  { t: 'Start from what you do', d: 'Say "Fortnite, homework, $900". Get three complete builds that fit, with no part names required.' },
  { t: 'Every part explained', d: 'Click anything in the 3D model to see what it does, how much you need, and what upgrading it changes.' },
  { t: 'See conflicts, not error codes', d: 'A card too long for the case glows red right where it hits, with a one-click swap that fits.' },
  { t: 'Build alongside me', d: 'Open your build on your phone next to the real PC. One step at a time, every cable shown, a checklist before you move on.' },
  { t: 'Real total cost', d: 'Monitor, keyboard, Windows, Wi-Fi adapter and tax included. Mark parts you already own to reuse them.' },
  { t: 'When it will not boot', d: '"Fans spin but no picture" walks you through checks in order, highlighting the exact part to look at.' },
];

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <span className="chip info">For first-time builders</span>
          <h1 style={{ marginTop: 14 }}>Build your first PC <span className="grad-text">with confidence.</span></h1>
          <p className="lead">
            Tell us what you play or work on and what you can spend. We pick parts that fit together, show you the build in 3D,
            then guide your hands through assembly, cable by cable.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link href="/wizard" className="btn primary big">Find my build</Link>
            <Link href={buildHref('/build', DEMO_BUILD)} className="btn big">Explore a sample build</Link>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>Free. No account. Your build lives in the link, so you can share it with a friend for a second opinion.</p>
        </div>
        <div style={{ height: 440 }}>
          <Scene r={resolve(DEMO_BUILD)} />
        </div>
      </section>

      <section className="features">
        {FEATURES.map((f) => (
          <div className="card" key={f.t}>
            <h3>{f.t}</h3>
            <p className="muted small" style={{ margin: 0 }}>{f.d}</p>
          </div>
        ))}
      </section>

      <p className="small muted" style={{ marginTop: 32 }}>
        Part specs come from manufacturer sheets for a small, hand-checked catalog. GPU lengths are typical for that chip and vary by brand. Prices are estimates; check the retailer before you buy.
      </p>
    </main>
  );
}
