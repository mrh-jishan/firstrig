import { Build, CATEGORY_ORDER, Category, getPart } from './catalog';

export const DEMO_BUILD: Build = {
  cpu: 'r5-7600', cooler: 'ax120', board: 'b650-gp-wifi', ram: 'ddr5-32', gpu: 'rtx-5070', storage: 'p3p-2tb', psu: 'rm750e', case: 'pop-air',
};

// Readable, compact URL form: ids in category order joined by "~", blank for none.
export function encodeBuild(b: Build): string {
  return CATEGORY_ORDER.map((c) => b[c] ?? '').join('~');
}

export function decodeBuild(s: string | null | undefined): Build | null {
  if (!s) return null;
  const ids = s.split('~');
  if (ids.length !== CATEGORY_ORDER.length) return null;
  const b: Build = {};
  CATEGORY_ORDER.forEach((c, i) => {
    const p = getPart(ids[i]);
    if (p && p.cat === c) b[c] = p.id;
  });
  return b;
}

export function encodeOwned(owned: Set<Category>) {
  return [...owned].join(',');
}

export function decodeOwned(s: string | null | undefined): Set<Category> {
  return new Set((s ?? '').split(',').filter((c): c is Category => (CATEGORY_ORDER as string[]).includes(c)));
}

export function buildHref(path: string, b: Build, owned?: Set<Category>) {
  const q = new URLSearchParams({ b: encodeBuild(b) });
  if (owned && owned.size) q.set('own', encodeOwned(owned));
  return `${path}?${q.toString()}`;
}
