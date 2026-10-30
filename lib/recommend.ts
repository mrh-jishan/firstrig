import {
  BOARDS, Build, CASES, COOLERS, CPUS, Cpu, GPUS, Gpu, PSUS, Part, RAMS, STORAGES, estimateWatts, resolve,
} from './catalog';
import { isCompatible } from './compat';

export type Use = 'esports' | 'aaa' | 'school' | 'creating' | 'streaming';
export type Resolution = '1080' | '1440' | '4k';

export type Needs = {
  uses: Use[];
  budget: number; // tower only, USD
  resolution: Resolution;
  wifi: boolean;
  quiet: boolean;
  small: boolean;
};

export const USE_LABEL: Record<Use, string> = {
  esports: 'Competitive games (Fortnite, Valorant, CS2)',
  aaa: 'Big story / open-world games',
  school: 'School, office, browsing',
  creating: 'Video or photo editing, 3D',
  streaming: 'Streaming while gaming',
};

const sum = (parts: (Part | undefined)[]) => parts.reduce((s, p) => s + (p?.price ?? 0), 0);

export function buildPrice(b: Build) {
  const r = resolve(b);
  return sum([r.cpu, r.board, r.ram, r.gpu, r.storage, r.cooler, r.psu, r.case]);
}

// How much the person will actually feel each part, 0-100.
export function scores(b: Build) {
  const r = resolve(b);
  const cpuG = r.cpu?.gaming ?? 0;
  const gpuG = r.gpu?.gaming ?? 8; // integrated graphics
  const gaming = Math.round(Math.min(gpuG, cpuG * 1.15) * 0.75 + gpuG * 0.25);
  const creating = Math.round((r.cpu?.creating ?? 0) * 0.55 + (r.gpu?.creating ?? 5) * 0.25 + Math.min(r.ram?.gb ?? 0, 64) / 64 * 20);
  const noise = Math.max(r.cooler?.noise ?? 2, r.psu?.noise ?? 2);
  const upgrade = (r.board?.socket === 'AM5' ? 50 : 15) + Math.min(35, Math.max(0, ((r.psu?.watts ?? 0) - estimateWatts(r)) / 10)) + (r.case?.size === 'mid' ? 15 : 0);
  return { gaming, creating, noise, upgrade: Math.round(Math.min(100, upgrade)) };
}

function needScore(b: Build, n: Needs) {
  const s = scores(b);
  const resWeight = n.resolution === '4k' ? 1.3 : n.resolution === '1440' ? 1.1 : 0.85;
  let v = 0;
  if (n.uses.includes('aaa')) v += s.gaming * resWeight;
  if (n.uses.includes('esports')) v += s.gaming * 0.6 + (resolve(b).cpu?.gaming ?? 0) * 0.4;
  if (n.uses.includes('creating')) v += s.creating * 1.1;
  if (n.uses.includes('streaming')) v += s.creating * 0.5 + s.gaming * 0.5;
  if (n.uses.includes('school') || n.uses.length === 0) v += 30 + s.creating * 0.2;
  v += s.upgrade * 0.08;
  if (n.quiet) v -= s.noise * 6;
  return v;
}

function cheapest<T extends Part>(list: T[], ok: (p: T) => boolean) {
  return [...list].filter(ok).sort((a, z) => a.price - z.price)[0];
}

// Fill everything around a CPU/GPU pair with the cheapest sensible parts for these needs.
function complete(cpu: Cpu, gpu: Gpu | undefined, n: Needs): Build | null {
  const heavy = n.uses.includes('creating') || n.uses.includes('streaming');
  const board = cheapest(BOARDS, (bd) => bd.socket === cpu.socket && (!n.wifi || bd.wifi));
  if (!board) return null;
  const wantGb = n.uses.includes('creating') ? 64 : n.uses.some((u) => u === 'aaa' || u === 'streaming') ? 32 : 16;
  const ram = cheapest(RAMS, (r) => r.mem === board.mem && r.gb >= Math.min(wantGb, board.mem === 'DDR5' ? 64 : 32))
    ?? cheapest(RAMS, (r) => r.mem === board.mem);
  const storage = cheapest(STORAGES, (s) => s.tb >= (heavy || n.uses.includes('aaa') ? 2 : 1));
  const caseP = cheapest(CASES, (c) => c.forms.includes(board.form) && (!gpu || c.maxGpuMm - gpu.lengthMm >= 20) && (n.small ? true : c.size === 'mid'));
  if (!caseP) return null;
  const cooler = cheapest(COOLERS, (c) =>
    (c.kind !== 'stock' || cpu.stockCooler) && c.handlesWatts >= cpu.watts * 1.1 &&
    (c.kind !== 'air' || c.heightMm <= caseP.maxCoolerMm) && (c.kind !== 'aio' || caseP.radSupport.includes(c.radMm)) &&
    (!n.quiet || c.noise === 1));
  if (!cooler) return null;
  const draw = cpu.watts + (gpu?.watts ?? 0) + 75;
  const psu = cheapest(PSUS, (p) => p.watts >= draw * 1.4 && (!n.quiet || p.noise === 1));
  if (!psu) return null;
  const b: Build = { cpu: cpu.id, board: board.id, ram: ram?.id, gpu: gpu?.id, storage: storage?.id, cooler: cooler.id, psu: psu.id, case: caseP.id };
  return isCompatible(b) ? b : null;
}

export type Tier = { key: 'saver' | 'sweet' | 'stretch'; label: string; pitch: string; build: Build; price: number };

export function recommend(n: Needs): Tier[] {
  const gamingUse = n.uses.some((u) => u === 'esports' || u === 'aaa' || u === 'streaming');
  const gpuOptions: (Gpu | undefined)[] = gamingUse ? GPUS : [undefined, ...GPUS];
  const candidates: { build: Build; price: number; value: number }[] = [];
  for (const cpu of CPUS) for (const gpu of gpuOptions) {
    const b = complete(cpu, gpu, n);
    if (b) candidates.push({ build: b, price: buildPrice(b), value: needScore(b, n) });
  }
  // Best value at a given price ceiling.
  const bestUnder = (ceiling: number) => candidates
    .filter((c) => c.price <= ceiling)
    .sort((a, z) => z.value - a.value || a.price - z.price)[0];

  const sweet = bestUnder(n.budget) ?? [...candidates].sort((a, z) => a.price - z.price)[0];
  const saver = bestUnder(Math.min(sweet.price - 1, n.budget * 0.8));
  const stretch = candidates
    .filter((c) => c.price > sweet.price && c.price <= n.budget * 1.25 && c.value > sweet.value)
    .filter((c) => !gamingUse || scores(c.build).gaming >= scores(sweet.build).gaming)
    .sort((a, z) => z.value / z.price - a.value / a.price)[0];

  const tiers: Tier[] = [];
  if (saver && saver.value < sweet.value) tiers.push({ key: 'saver', label: 'Saver', pitch: 'Covers what you asked for and keeps money in your pocket.', ...saver });
  tiers.push({ key: 'sweet', label: sweet.price > n.budget ? 'Closest fit' : 'Sweet spot', pitch: sweet.price > n.budget ? 'The cheapest build we can stand behind. It is above your budget.' : 'The most of what you need for your budget.', ...sweet });
  if (stretch) tiers.push({ key: 'stretch', label: 'Stretch', pitch: 'Worth it only if the upgrades below matter to you.', ...stretch });
  return tiers;
}
