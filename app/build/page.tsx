'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Scene from '@/components/Scene';
import type { PartStatus } from '@/components/PCScene';
import { load, save } from '@/components/prefs';
import type { SceneKey } from '@/lib/assembly';
import { Build, CATEGORY_LABEL, CATEGORY_ORDER, Category, PARTS_BY_CAT, estimateWatts, getPart, resolve } from '@/lib/catalog';
import { checkBuild } from '@/lib/compat';
import { WHAT_IT_DOES, gamingVerdict } from '@/lib/explain';
import { scores } from '@/lib/recommend';
import { DEMO_BUILD, buildHref, decodeBuild, decodeOwned } from '@/lib/share';

type Extras = { monitor: '' | '1080' | '1440' | '4k'; peripherals: boolean; windows: boolean; wifiAdapter: boolean; taxPct: number };
const MONITOR_PRICE = { '': 0, '1080': 130, '1440': 230, '4k': 400 };

export default function BuildPage() {
  const qs = useSearchParams();
  const router = useRouter();
  const [build, setBuild] = useState<Build>(() => decodeBuild(qs.get('b')) ?? DEMO_BUILD);
  const [owned, setOwned] = useState<Set<Category>>(() => decodeOwned(qs.get('own')));
  const [sel, setSel] = useState<Category | null>(null);
  const [copied, setCopied] = useState(false);
  const [extras, setExtras] = useState<Extras>({ monitor: '1080', peripherals: true, windows: true, wifiAdapter: false, taxPct: 7 });

  useEffect(() => { setExtras((e) => load('fr:extras', e)); }, []);
  useEffect(() => { save('fr:extras', extras); }, [extras]);
  // Keep the URL as the source of truth for sharing.
  useEffect(() => { router.replace(buildHref('/build', build, owned), { scroll: false }); }, [build, owned, router]);

  const r = useMemo(() => resolve(build), [build]);
  const issues = useMemo(() => checkBuild(build), [build]);
  const s = useMemo(() => scores(build), [build]);
  const errors = issues.filter((i) => i.severity === 'error').length;

  const status: Partial<Record<SceneKey, PartStatus>> = {};
  for (const i of [...issues].reverse()) {
    if (i.severity === 'info') continue;
    for (const c of i.parts) status[c] = i.severity;
  }
  if (sel && !status[sel]) status[sel] = 'focus';
  const catStatus = (c: Category) => issues.find((i) => i.parts.includes(c) && i.severity !== 'info')?.severity;

  const partsTotal = CATEGORY_ORDER.reduce((t, c) => t + (owned.has(c) ? 0 : getPart(build[c])?.price ?? 0), 0);
  const extrasTotal = MONITOR_PRICE[extras.monitor] + (extras.peripherals ? 50 : 0) + (extras.windows ? 120 : 0) + (extras.wifiAdapter ? 20 : 0);
  const tax = Math.round((partsTotal + extrasTotal) * extras.taxPct / 100);

  const pick = (k: SceneKey) => {
    setSel(k);
    document.getElementById(`part-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <main className="wrap">
      <div className="builder">
        <div className="stage">
          <div className="row">
            <h1 className="grow" style={{ fontSize: 24, margin: 0 }}>Your build</h1>
            <span className={`chip ${errors ? 'error' : 'ok'}`}>{errors ? `${errors} problem${errors > 1 ? 's' : ''} to fix` : 'Everything fits'}</span>
          </div>
          <div className="scene-host"><Scene r={r} status={status} onPick={pick} /></div>
          <div className="row">
            <Link className={`btn primary grow ${errors ? 'disabled' : ''}`} href={buildHref('/assemble', build, owned)} aria-disabled={errors > 0}
              onClick={(e) => { if (errors) e.preventDefault(); }} style={{ justifyContent: 'center', opacity: errors ? 0.5 : 1 }}>
              {errors ? 'Fix problems to start building' : 'Start step-by-step assembly'}
            </Link>
            <button className="btn" onClick={share}>{copied ? 'Link copied' : 'Share for review'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {issues.length > 0 && (
            <section className="issues" aria-label="Compatibility">
              {issues.map((i) => (
                <div key={i.id} className={`issue ${i.severity}`}>
                  <div className="title">{i.title}</div>
                  <div className="small muted">{i.detail}</div>
                  {i.fix && (
                    <button className="btn" style={{ marginTop: 8, padding: '6px 10px', fontSize: 13 }}
                      onClick={() => { setBuild({ ...build, [i.fix!.cat]: i.fix!.partId }); setSel(i.fix!.cat); }}>
                      {i.fix.label}
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <h3>What this build can do</h3>
            <div className="small" style={{ display: 'grid', gap: 10 }}>
              <div><div className="row"><span className="grow">Gaming</span><span>{s.gaming}/100</span></div><div className="meter"><div style={{ width: `${s.gaming}%` }} /></div></div>
              <div><div className="row"><span className="grow">Editing / creative</span><span>{s.creating}/100</span></div><div className="meter"><div style={{ width: `${s.creating}%` }} /></div></div>
              <div><div className="row"><span className="grow">Room to upgrade later</span><span>{s.upgrade}/100</span></div><div className="meter"><div style={{ width: `${s.upgrade}%` }} /></div></div>
              <div className="muted">
                1080p: {gamingVerdict(s.gaming, '1080')}<br />1440p: {gamingVerdict(s.gaming, '1440')}<br />
                Noise: {['', 'Quiet', 'Moderate', 'Noticeable under load'][s.noise]} · Power draw about {estimateWatts(r)}W
              </div>
              <div className="muted">Rough guidance from relative scores, not benchmarks.</div>
            </div>
          </section>

          <section className="parts" aria-label="Parts">
            {CATEGORY_ORDER.map((c) => {
              const p = getPart(build[c]);
              const st = catStatus(c);
              const open = sel === c;
              const info = WHAT_IT_DOES[c];
              return (
                <div key={c} id={`part-${c}`} className={`part ${open ? 'sel' : ''} ${st ?? ''}`}>
                  <div className="head" onClick={() => setSel(open ? null : c)} role="button" tabIndex={0} aria-expanded={open}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(open ? null : c); } }}>
                    <div className="grow">
                      <div className="cat">{CATEGORY_LABEL[c]}</div>
                      <div>{p?.name ?? (c === 'gpu' ? 'None (built-in graphics)' : 'Not chosen')}</div>
                    </div>
                    <div className="price">{owned.has(c) ? <span className="chip ok">Owned</span> : p ? `$${p.price}` : ''}</div>
                  </div>
                  {open && (
                    <>
                      <select value={build[c] ?? ''} aria-label={`Choose ${CATEGORY_LABEL[c]}`}
                        onChange={(e) => setBuild({ ...build, [c]: e.target.value || undefined })}>
                        {c === 'gpu' && <option value="">None (use built-in graphics)</option>}
                        {PARTS_BY_CAT[c].map((o) => <option key={o.id} value={o.id}>{o.name} - ${o.price}</option>)}
                      </select>
                      <div className="explain">
                        {p && <div>{p.blurb}</div>}
                        <div><b>What it does:</b> {info.does}</div>
                        <div><b>How much you need:</b> {info.howMuch}</div>
                        <div><b>Upgrading it:</b> {info.upgrade}</div>
                        <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={owned.has(c)} onChange={(e) => {
                            const n = new Set(owned);
                            if (e.target.checked) n.add(c); else n.delete(c);
                            setOwned(n);
                          }} />
                          I already own this (reuse it, do not count its price)
                        </label>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </section>

          <section className="card">
            <h3>Total cost to get playing</h3>
            <table className="calc">
              <tbody>
                <tr><td>Tower parts{owned.size ? ` (minus ${owned.size} owned)` : ''}</td><td>${partsTotal}</td></tr>
                <tr><td>
                  Monitor{' '}
                  <select value={extras.monitor} onChange={(e) => setExtras({ ...extras, monitor: e.target.value as Extras['monitor'] })} style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <option value="">I have one</option><option value="1080">1080p</option><option value="1440">1440p</option><option value="4k">4K</option>
                  </select>
                </td><td>${MONITOR_PRICE[extras.monitor]}</td></tr>
                <tr><td><label><input type="checkbox" checked={extras.peripherals} onChange={(e) => setExtras({ ...extras, peripherals: e.target.checked })} /> Keyboard and mouse</label></td><td>${extras.peripherals ? 50 : 0}</td></tr>
                <tr><td><label><input type="checkbox" checked={extras.windows} onChange={(e) => setExtras({ ...extras, windows: e.target.checked })} /> Windows 11 Home license</label></td><td>${extras.windows ? 120 : 0}</td></tr>
                <tr><td><label><input type="checkbox" checked={extras.wifiAdapter} onChange={(e) => setExtras({ ...extras, wifiAdapter: e.target.checked })} /> USB Wi-Fi adapter{r.board && !r.board.wifi ? ' (your board has no Wi-Fi)' : ''}</label></td><td>${extras.wifiAdapter ? 20 : 0}</td></tr>
                <tr><td>Sales tax <input type="number" min={0} max={15} step={0.5} value={extras.taxPct} aria-label="Tax percent" onChange={(e) => setExtras({ ...extras, taxPct: Number(e.target.value) })} style={{ width: 56, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 6 }} />%</td><td>${tax}</td></tr>
                <tr className="total"><td>Estimated total</td><td>${(partsTotal + extrasTotal + tax).toLocaleString()}</td></tr>
              </tbody>
            </table>
            <p className="small muted" style={{ marginBottom: 0 }}>Prices are estimates. Most retailers ship PC parts free.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
