import {
  Build, Category, CATEGORY_LABEL, CATEGORY_ORDER, PARTS_BY_CAT, Part, Resolved, estimateWatts, resolve,
} from './catalog';

export type Severity = 'error' | 'warn' | 'info';

export type Issue = {
  id: string;
  severity: Severity;
  title: string;
  detail: string; // plain-language why
  parts: Category[]; // highlighted in 3D
  fix?: { cat: Category; partId: string; label: string };
};

type Rule = (r: Resolved, b: Build) => Omit<Issue, 'fix'> | null;

const rules: Rule[] = [
  (r) => r.cpu && r.board && r.cpu.socket !== r.board.socket ? {
    id: 'socket', severity: 'error', parts: ['cpu', 'board'],
    title: 'CPU does not fit this motherboard',
    detail: `The ${r.cpu.name} uses the ${r.cpu.socket} socket but the board has ${r.board.socket}. The chip physically will not go in.`,
  } : null,
  (r) => r.ram && r.board && r.ram.mem !== r.board.mem ? {
    id: 'memtype', severity: 'error', parts: ['ram', 'board'],
    title: `${r.ram.mem} memory in a ${r.board.mem} board`,
    detail: `DDR4 and DDR5 sticks have their notch in different places, so the wrong type cannot be pushed into the slot. This board needs ${r.board.mem}.`,
  } : null,
  (r) => r.board && r.case && !r.case.forms.includes(r.board.form) ? {
    id: 'form', severity: 'error', parts: ['board', 'case'],
    title: `${r.board.form} board is too big for this case`,
    detail: `The ${r.case.name} only takes ${r.case.forms.join(' / ')} boards. The screw holes will not line up and the board will not fit.`,
  } : null,
  (r) => {
    if (!r.gpu || !r.case) return null;
    const room = r.case.maxGpuMm - r.gpu.lengthMm;
    if (room < 0) return {
      id: 'gpulen', severity: 'error', parts: ['gpu', 'case'],
      title: `Graphics card is ${-room}mm too long`,
      detail: `This card is about ${r.gpu.lengthMm}mm long and the case fits up to ${r.case.maxGpuMm}mm. It would hit the front fans.`,
    };
    if (room < 20) return {
      id: 'gpulen', severity: 'warn', parts: ['gpu', 'case'],
      title: `Tight fit: only ${room}mm to spare for the GPU`,
      detail: 'Card lengths vary by brand. Check the exact model you buy against the case limit before ordering.',
    };
    return null;
  },
  (r) => r.cooler?.kind === 'stock' && r.cpu && !r.cpu.stockCooler ? {
    id: 'nostock', severity: 'error', parts: ['cooler', 'cpu'],
    title: 'This CPU does not come with a cooler',
    detail: `The ${r.cpu.name} ships without a fan, so "stock cooler" leaves it with nothing. It would overheat and shut down within seconds.`,
  } : null,
  (r) => r.cooler?.kind === 'air' && r.case && r.cooler.heightMm > r.case.maxCoolerMm ? {
    id: 'coolerh', severity: 'error', parts: ['cooler', 'case'],
    title: `Cooler is ${r.cooler.heightMm - r.case.maxCoolerMm}mm too tall`,
    detail: `The cooler stands ${r.cooler.heightMm}mm tall but the case allows ${r.case.maxCoolerMm}mm. The side panel will not close.`,
  } : null,
  (r) => r.cooler?.kind === 'aio' && r.case && !r.case.radSupport.includes(r.cooler.radMm) ? {
    id: 'rad', severity: 'error', parts: ['cooler', 'case'],
    title: `No room for a ${r.cooler.radMm}mm radiator`,
    detail: `This case supports ${r.case.radSupport.join(' / ')}mm radiators.`,
  } : null,
  (r) => r.cooler && r.cpu && r.cooler.handlesWatts < r.cpu.watts ? {
    id: 'coolcap', severity: 'warn', parts: ['cooler', 'cpu'],
    title: 'Cooler is undersized for this CPU',
    detail: `The CPU can pull about ${r.cpu.watts}W under load; this cooler is comfortable up to about ${r.cooler.handlesWatts}W. Expect noise and slower speeds when it gets hot.`,
  } : null,
  (r) => {
    if (!r.psu || !r.cpu) return null;
    const need = estimateWatts(r);
    if (r.psu.watts < need * 1.1) return {
      id: 'psu', severity: 'error', parts: ['psu', 'gpu', 'cpu'],
      title: 'Power supply is too weak',
      detail: `This build can draw around ${need}W. A ${r.psu.watts}W unit would run near its limit and may shut the PC off during games.`,
    };
    if (r.psu.watts < need * 1.4) return {
      id: 'psu', severity: 'warn', parts: ['psu'],
      title: 'Little power headroom',
      detail: `Estimated draw is about ${need}W. Graphics cards spike above their rating for split seconds, so aim for roughly 40% headroom.`,
    };
    return null;
  },
  (r) => r.cpu && !r.cpu.hasIgpu && !r.gpu ? {
    id: 'nodisplay', severity: 'error', parts: ['cpu', 'gpu'],
    title: 'Nothing to make a picture',
    detail: `The ${r.cpu.name} has no built-in graphics, so without a graphics card the monitor stays black.`,
  } : null,
  (r) => r.cpu && r.board?.socket === 'AM4' ? {
    id: 'am4', severity: 'info', parts: ['board'],
    title: 'AM4 is a dead-end platform',
    detail: 'It works great today, but future AMD CPUs need a new motherboard. AM5 costs a bit more now and keeps upgrade options open.',
  } : null,
  (r) => r.board && !r.board.wifi ? {
    id: 'wifi', severity: 'info', parts: ['board'],
    title: 'No built-in Wi-Fi',
    detail: 'Plan on an Ethernet cable to your router, or add a USB Wi-Fi adapter (about $20) in the budget calculator.',
  } : null,
];

export function checkBuild(b: Build): Issue[] {
  const r = resolve(b);
  const issues: Issue[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (!b[cat] && cat !== 'gpu') issues.push({
      id: `missing-${cat}`, severity: 'error', parts: [cat],
      title: `Pick a ${CATEGORY_LABEL[cat].toLowerCase()}`, detail: 'Every PC needs one of these.',
    });
  }
  for (const rule of rules) {
    const hit = rule(r, b);
    if (hit) issues.push({ ...hit, fix: suggestFix(b, hit.id, hit.parts) });
  }
  const rank = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, z) => rank[a.severity] - rank[z.severity]);
}

// Single-part swap that clears the issue without adding any new error. Tries the issue's
// first-listed part before the others, and prefers the swap closest in price to what was chosen.
function suggestFix(b: Build, issueId: string, cats: Category[]): Issue['fix'] {
  if (issueId === 'am4' || issueId === 'wifi') return undefined;
  const before = errorIds(b);
  for (const cat of cats) {
    const current = PARTS_BY_CAT[cat].find((p) => p.id === b[cat]);
    let best: { part: Part; delta: number } | null = null;
    for (const part of PARTS_BY_CAT[cat]) {
      if (part.id === b[cat]) continue;
      const next = { ...b, [cat]: part.id };
      const r = resolve(next);
      if (rules.some((rule) => rule(r, next)?.id === issueId)) continue;
      if ([...errorIds(next)].some((id) => !before.has(id))) continue;
      const delta = part.price - (current?.price ?? 0);
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { part, delta };
    }
    if (best) {
      const sign = best.delta >= 0 ? '+' : '-';
      return { cat, partId: best.part.id, label: `Swap to ${best.part.name} (${sign}$${Math.abs(best.delta)})` };
    }
  }
  return undefined;
}

function errorIds(b: Build) {
  const r = resolve(b);
  return new Set(rules.map((rule) => rule(r, b)).filter((h) => h?.severity === 'error').map((h) => h!.id));
}

export function isCompatible(b: Build) {
  return !checkBuild(b).some((i) => i.severity === 'error');
}
