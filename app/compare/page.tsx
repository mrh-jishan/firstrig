'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Build, CATEGORY_LABEL, CATEGORY_ORDER, getPart, resolve } from '@/lib/catalog';
import { explainUpgrade, gamingVerdict } from '@/lib/explain';
import { buildPrice, scores, type Resolution } from '@/lib/recommend';
import { buildHref, decodeBuild } from '@/lib/share';

const NAMES = ['Saver', 'Sweet spot', 'Stretch'];

export default function Compare() {
  const qs = useSearchParams();
  const res = (qs.get('res') ?? '1080') as Resolution;
  const builds = useMemo(() => [0, 1, 2].map((i) => decodeBuild(qs.get(`b${i}`))).filter((b): b is Build => !!b), [qs]);
  const names = builds.length === 3 ? NAMES : builds.length === 2 ? ['Option A', 'Option B'] : ['Build'];

  if (!builds.length) return <main className="wrap"><p>No builds to compare. <Link href="/wizard">Start the wizard</Link>.</p></main>;

  const rows: { label: string; cell: (b: Build) => React.ReactNode }[] = [
    { label: 'Total (tower)', cell: (b) => <b className="price">${buildPrice(b).toLocaleString()}</b> },
    { label: 'Gaming', cell: (b) => gamingVerdict(scores(b).gaming, res) },
    { label: 'Editing / creative', cell: (b) => `${scores(b).creating}/100` },
    { label: 'Noise', cell: (b) => ['', 'Quiet', 'Moderate', 'Noticeable under load'][scores(b).noise] },
    { label: 'Size', cell: (b) => (resolve(b).case?.size === 'small' ? 'Compact' : 'Mid-tower') },
    { label: 'Upgrade room', cell: (b) => `${scores(b).upgrade}/100${resolve(b).board?.socket === 'AM5' ? ' (AM5: future CPUs fit)' : ''}` },
    ...CATEGORY_ORDER.map((c) => ({ label: CATEGORY_LABEL[c], cell: (b: Build) => getPart(b[c])?.name ?? (c === 'gpu' ? 'Built-in graphics' : '-') })),
  ];

  return (
    <main className="wrap">
      <h1>Compare builds</h1>
      <div className="card table-scroll">
        <table className="compare">
          <thead><tr><th />{builds.map((b, i) => <th key={i} style={{ color: 'var(--text)' }}>{names[i]} <Link href={buildHref('/build', b)} className="small">open</Link></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th>{builds.map((b, i) => <td key={i}>{row.cell(b)}</td>)}</tr>)}</tbody>
        </table>
      </div>

      {builds.slice(1).map((b, i) => {
        const up = explainUpgrade(builds[i], b);
        return (
          <section key={i} className="card" style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 20 }}>{names[i]} to {names[i + 1]}</h2>
            <p><b>{up.summary}</b></p>
            <table className="compare">
              <tbody>
                {up.lines.map((l) => (
                  <tr key={l.cat}>
                    <th>{CATEGORY_LABEL[l.cat]}</th>
                    <td className="small muted">{l.from ?? 'None'} &rarr; {l.to ?? 'None'}</td>
                    <td className="price" style={{ whiteSpace: 'nowrap' }}>{l.cost >= 0 ? '+' : '-'}${Math.abs(l.cost)}</td>
                    <td>{l.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
