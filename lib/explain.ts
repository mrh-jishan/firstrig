import { Build, CATEGORY_LABEL, CATEGORY_ORDER, Category, Resolved, getPart, resolve } from './catalog';
import { buildPrice, scores } from './recommend';

export const WHAT_IT_DOES: Record<Category, { does: string; howMuch: string; upgrade: string }> = {
  cpu: {
    does: 'The brain. Runs the game logic, your apps and Windows itself.',
    howMuch: '6 cores is plenty for gaming. 8+ cores helps with video editing and streaming.',
    upgrade: 'A faster CPU mostly raises frame rates in competitive games at 1080p, and cuts export times.',
  },
  cooler: {
    does: 'Pulls heat off the CPU. Without one the CPU shuts down in seconds.',
    howMuch: 'Match it to the CPU wattage. Bigger coolers can spin slower, so they are quieter.',
    upgrade: 'A better cooler makes the PC quieter. It rarely makes it faster.',
  },
  board: {
    does: 'The backbone everything plugs into. Decides which CPU and RAM you can use, and how many drives and USB ports you get.',
    howMuch: 'A basic board from a good brand is enough. Pay more for Wi-Fi or extra slots only if you need them.',
    upgrade: 'Expensive boards add features, not speed. AM5 boards accept future AMD CPUs.',
  },
  ram: {
    does: 'Short-term memory for whatever is open right now: games, browser tabs, editing timelines.',
    howMuch: '16GB for school and light games, 32GB for most gamers, 64GB for heavy video or 3D work.',
    upgrade: 'More RAM helps only when you were running out. Past that, you will not notice it.',
  },
  gpu: {
    does: 'Draws every frame you see. The single biggest factor for gaming performance.',
    howMuch: 'Match it to your monitor: a 1440p or 4K screen needs a much stronger card than 1080p.',
    upgrade: 'This is where extra gaming money goes furthest: higher settings, higher resolution, smoother motion.',
  },
  storage: {
    does: 'Where Windows, games and files live permanently. NVMe drives screw straight onto the motherboard.',
    howMuch: 'Big modern games are 100-150GB each. 1TB holds about 8, 2TB about 15.',
    upgrade: 'More space is useful. A "faster" NVMe barely changes loading times in games.',
  },
  psu: {
    does: 'Converts wall power into what the parts need. A bad one can take other parts down with it.',
    howMuch: 'Enough watts with headroom, from a reputable model. Gold-rated units run cooler and quieter.',
    upgrade: 'Extra watts give room for a bigger GPU later. They do not add speed.',
  },
  case: {
    does: 'Holds everything and moves air through it.',
    howMuch: 'It must fit your motherboard size, GPU length and cooler height. Mesh fronts keep things cool.',
    upgrade: 'Roomier cases are easier to build in and quieter. Smaller cases look great but are fiddly.',
  },
};

export function gamingVerdict(score: number, res: '1080' | '1440' | '4k' = '1080') {
  const need = res === '4k' ? 90 : res === '1440' ? 60 : 40;
  if (score < 20) return 'Light games only (Minecraft, older titles, browser games).';
  if (score >= need + 15) return `Very smooth at ${res === '4k' ? '4K' : res + 'p'} with high settings in most games.`;
  if (score >= need) return `Smooth at ${res === '4k' ? '4K' : res + 'p'} in most games; turn some settings down in the newest ones.`;
  return `Playable at ${res === '4k' ? '4K' : res + 'p'} with lowered settings. Consider a stronger graphics card.`;
}

export type UpgradeLine = { cat: Category; from?: string; to?: string; cost: number; what: string };

// Explain, per part, what changes between two builds and whether it is worth the money.
export function explainUpgrade(a: Build, b: Build): { lines: UpgradeLine[]; summary: string } {
  const lines: UpgradeLine[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (a[cat] === b[cat]) continue;
    const pa = getPart(a[cat]);
    const pb = getPart(b[cat]);
    lines.push({ cat, from: pa?.name, to: pb?.name, cost: (pb?.price ?? 0) - (pa?.price ?? 0), what: changeFor(cat, resolve(a), resolve(b)) });
  }
  const sa = scores(a);
  const sb = scores(b);
  const cost = buildPrice(b) - buildPrice(a);
  const dg = sb.gaming - sa.gaming;
  const dc = sb.creating - sa.creating;
  const pct = (d: number, base: number) => (base > 0 ? Math.round((d / base) * 100) : 0);
  const summary = `For ${cost >= 0 ? '+' : '-'}$${Math.abs(cost)}: gaming ${dg >= 0 ? '+' : ''}${pct(dg, sa.gaming)}%, creative work ${dc >= 0 ? '+' : ''}${pct(dc, sa.creating)}%.`;
  return { lines, summary };
}

function changeFor(cat: Category, a: Resolved, b: Resolved): string {
  switch (cat) {
    case 'gpu': {
      const d = (b.gpu?.gaming ?? 8) - (a.gpu?.gaming ?? 8);
      if (Math.abs(d) < 5) return 'About the same gaming speed.';
      return d > 0 ? `Roughly ${Math.round((d / (a.gpu?.gaming ?? 8)) * 100)}% more graphics power: higher settings or resolution.` : 'Less graphics power.';
    }
    case 'cpu': {
      const d = (b.cpu?.creating ?? 0) - (a.cpu?.creating ?? 0);
      const g = (b.cpu?.gaming ?? 0) - (a.cpu?.gaming ?? 0);
      return `${g > 5 ? 'Higher frame rates in CPU-heavy games. ' : ''}${d > 5 ? 'Faster video exports and multitasking.' : g <= 5 ? 'Small difference you will rarely notice.' : ''}`.trim();
    }
    case 'ram': return `${a.ram?.gb ?? 0}GB to ${b.ram?.gb ?? 0}GB. ${(b.ram?.gb ?? 0) > 32 ? 'Helps big editing projects; games will not use it.' : 'More breathing room with many apps open.'}`;
    case 'storage': return `${a.storage?.tb ?? 0}TB to ${b.storage?.tb ?? 0}TB of space.`;
    case 'psu': return `${a.psu?.watts ?? 0}W to ${b.psu?.watts ?? 0}W. Needed for the stronger parts or future upgrades.`;
    case 'cooler': return (b.cooler?.noise ?? 2) < (a.cooler?.noise ?? 2) ? 'Quieter under load.' : 'Needed to keep the faster CPU cool.';
    case 'board': return b.board?.socket === 'AM5' && a.board?.socket !== 'AM5' ? 'Moves to AM5: room for future CPU upgrades.' : 'Required to match the other parts.';
    case 'case': return 'Different size or airflow; needed so the other parts fit.';
  }
}

export function partLabel(cat: Category) {
  return CATEGORY_LABEL[cat];
}
