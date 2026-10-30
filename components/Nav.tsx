'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePrefs } from './prefs';

export default function Nav() {
  const path = usePathname();
  const qs = useSearchParams();
  const b = qs.get('b');
  const own = qs.get('own');
  const carry = b ? `?${new URLSearchParams({ b, ...(own ? { own } : {}) })}` : '';
  const prefs = usePrefs();
  const link = (href: string, label: string, keep = false) => (
    <Link href={keep ? href + carry : href} className={path === href ? 'on' : ''}>{label}</Link>
  );
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" className="brand"><i aria-hidden />First<span>Rig</span></Link>
      <div className="links">
        {link('/wizard', 'Find my build')}
        {link('/build', 'Builder', true)}
        {b && link('/assemble', 'Assembly guide', true)}
        {link('/troubleshoot', 'Troubleshoot', true)}
      </div>
      <div className="prefs">
        <label><input type="checkbox" checked={prefs.flat} onChange={(e) => prefs.set({ flat: e.target.checked })} /> Simple 2D view</label>
        <label><input type="checkbox" checked={prefs.lowGfx} onChange={(e) => prefs.set({ lowGfx: e.target.checked })} /> Low graphics</label>
        <label><input type="checkbox" checked={prefs.labels} onChange={(e) => prefs.set({ labels: e.target.checked })} /> Labels</label>
      </div>
    </nav>
  );
}
