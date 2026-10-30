// Curated starter catalog. Kept deliberately small so every spec can be checked by hand.
// Dimensions come from manufacturer spec sheets; GPU lengths are for a typical model of
// that chip because partner cards vary. Prices are rough US street estimates.

export type Category = 'cpu' | 'board' | 'ram' | 'gpu' | 'storage' | 'cooler' | 'psu' | 'case';

export const CATEGORY_ORDER: Category[] = ['cpu', 'cooler', 'board', 'ram', 'gpu', 'storage', 'psu', 'case'];

export const CATEGORY_LABEL: Record<Category, string> = {
  cpu: 'Processor (CPU)',
  board: 'Motherboard',
  ram: 'Memory (RAM)',
  gpu: 'Graphics card (GPU)',
  storage: 'Storage (SSD)',
  cooler: 'CPU cooler',
  psu: 'Power supply (PSU)',
  case: 'Case',
};

type Base = { id: string; name: string; price: number; blurb: string };

export type Cpu = Base & {
  cat: 'cpu';
  socket: 'AM4' | 'AM5' | 'LGA1700';
  cores: number;
  watts: number; // realistic sustained gaming/heavy load draw
  gaming: number; // 0-100 relative
  creating: number; // 0-100 relative multicore
  hasIgpu: boolean;
  stockCooler: boolean;
};

export type Board = Base & {
  cat: 'board';
  socket: Cpu['socket'];
  form: 'ATX' | 'mATX' | 'ITX';
  mem: 'DDR4' | 'DDR5';
  wifi: boolean;
  m2Slots: number;
};

export type Ram = Base & { cat: 'ram'; mem: 'DDR4' | 'DDR5'; gb: number; sticks: number };

export type Gpu = Base & {
  cat: 'gpu';
  lengthMm: number;
  watts: number;
  vramGb: number;
  power: string; // connector description
  gaming: number;
  creating: number;
};

export type Storage = Base & { cat: 'storage'; tb: number; speed: 'fast' | 'faster' | 'fastest' };

export type Cooler = Base & {
  cat: 'cooler';
  kind: 'stock' | 'air' | 'aio';
  heightMm: number; // air coolers only; 0 for AIO
  radMm: number; // AIO radiator length
  handlesWatts: number;
  noise: 1 | 2 | 3; // 1 quiet, 3 loud
};

export type Psu = Base & { cat: 'psu'; watts: number; rating: string; noise: 1 | 2 | 3 };

export type Case = Base & {
  cat: 'case';
  forms: Board['form'][];
  maxGpuMm: number;
  maxCoolerMm: number;
  radSupport: number[]; // radiator sizes supported
  size: 'small' | 'mid';
  color: string;
};

export type Part = Cpu | Board | Ram | Gpu | Storage | Cooler | Psu | Case;

export const CPUS: Cpu[] = [
  { cat: 'cpu', id: 'r5-5600', name: 'AMD Ryzen 5 5600', price: 105, socket: 'AM4', cores: 6, watts: 76, gaming: 52, creating: 40, hasIgpu: false, stockCooler: true,
    blurb: 'Older but still capable 6-core chip. Cheapest way into a solid gaming PC, but the AM4 platform will not get new CPUs.' },
  { cat: 'cpu', id: 'r5-7600', name: 'AMD Ryzen 5 7600', price: 185, socket: 'AM5', cores: 6, watts: 88, gaming: 68, creating: 52, hasIgpu: true, stockCooler: true,
    blurb: '6-core chip on the newer AM5 platform, so you can drop in a faster CPU years later without changing the motherboard.' },
  { cat: 'cpu', id: 'i5-14400f', name: 'Intel Core i5-14400F', price: 175, socket: 'LGA1700', cores: 10, watts: 148, gaming: 64, creating: 60, hasIgpu: false, stockCooler: true,
    blurb: '10-core Intel chip, good all-rounder. The "F" means no built-in graphics, so it needs a graphics card to show a picture.' },
  { cat: 'cpu', id: 'r7-9700x', name: 'AMD Ryzen 7 9700X', price: 300, socket: 'AM5', cores: 8, watts: 88, gaming: 78, creating: 72, hasIgpu: true, stockCooler: false,
    blurb: '8 cores for gaming plus heavier work like video editing. Does not include a cooler.' },
  { cat: 'cpu', id: 'r7-9800x3d', name: 'AMD Ryzen 7 9800X3D', price: 470, socket: 'AM5', cores: 8, watts: 120, gaming: 100, creating: 74, hasIgpu: true, stockCooler: false,
    blurb: 'One of the fastest gaming CPUs available thanks to its extra on-chip cache. Overkill unless you pair it with a strong GPU.' },
];

export const BOARDS: Board[] = [
  { cat: 'board', id: 'b550m-wifi', name: 'MSI B550M PRO-VDH WIFI', price: 115, socket: 'AM4', form: 'mATX', mem: 'DDR4', wifi: true, m2Slots: 2,
    blurb: 'Compact AM4 board with Wi-Fi built in.' },
  { cat: 'board', id: 'b650m-rs', name: 'ASRock B650M Pro RS', price: 135, socket: 'AM5', form: 'mATX', mem: 'DDR5', wifi: false, m2Slots: 3,
    blurb: 'Value AM5 board. No Wi-Fi, so plan on an Ethernet cable or a USB Wi-Fi adapter.' },
  { cat: 'board', id: 'b650-gp-wifi', name: 'MSI B650 GAMING PLUS WIFI', price: 170, socket: 'AM5', form: 'ATX', mem: 'DDR5', wifi: true, m2Slots: 2,
    blurb: 'Full-size AM5 board with Wi-Fi. Easy to build in thanks to roomy spacing.' },
  { cat: 'board', id: 'b760m-wifi', name: 'MSI PRO B760M-A WIFI (DDR5)', price: 150, socket: 'LGA1700', form: 'mATX', mem: 'DDR5', wifi: true, m2Slots: 2,
    blurb: 'Intel 12th-14th gen board with Wi-Fi. Make sure you buy the DDR5 version to match this RAM type.' },
];

export const RAMS: Ram[] = [
  { cat: 'ram', id: 'ddr4-16', name: 'Corsair Vengeance LPX 16GB (2x8GB) DDR4-3200', price: 40, mem: 'DDR4', gb: 16, sticks: 2,
    blurb: 'Enough for gaming and schoolwork today.' },
  { cat: 'ram', id: 'ddr4-32', name: 'Corsair Vengeance LPX 32GB (2x16GB) DDR4-3600', price: 70, mem: 'DDR4', gb: 32, sticks: 2,
    blurb: 'Comfortable headroom for gaming plus a browser full of tabs.' },
  { cat: 'ram', id: 'ddr5-32', name: 'G.Skill Flare X5 32GB (2x16GB) DDR5-6000 CL30', price: 95, mem: 'DDR5', gb: 32, sticks: 2,
    blurb: 'The usual sweet spot for new builds.' },
  { cat: 'ram', id: 'ddr5-64', name: 'Kingston FURY Beast 64GB (2x32GB) DDR5-6000', price: 175, mem: 'DDR5', gb: 64, sticks: 2,
    blurb: 'For video editing, big photo libraries, or running VMs.' },
];

export const GPUS: Gpu[] = [
  { cat: 'gpu', id: 'arc-b580', name: 'Intel Arc B580 12GB', price: 260, lengthMm: 272, watts: 190, vramGb: 12, power: '1x 8-pin PCIe', gaming: 42, creating: 35,
    blurb: 'Budget card that handles 1080p and many 1440p games well.' },
  { cat: 'gpu', id: 'rtx-5060ti', name: 'GeForce RTX 5060 Ti 16GB (dual-fan)', price: 430, lengthMm: 230, watts: 180, vramGb: 16, power: '1x 8-pin PCIe', gaming: 55, creating: 52,
    blurb: 'Efficient mid-range card, strong at 1080p and good at 1440p.' },
  { cat: 'gpu', id: 'rtx-5070', name: 'GeForce RTX 5070 12GB (dual-fan)', price: 560, lengthMm: 250, watts: 250, vramGb: 12, power: '1x 12V-2x6 or 1x 8-pin (model dependent)', gaming: 70, creating: 66,
    blurb: 'The 1440p sweet spot for most players.' },
  { cat: 'gpu', id: 'rx-9070xt', name: 'Radeon RX 9070 XT 16GB (triple-fan)', price: 650, lengthMm: 330, watts: 304, vramGb: 16, power: '2-3x 8-pin PCIe', gaming: 80, creating: 62,
    blurb: 'Fast 1440p card with lots of memory. Long, so check case clearance.' },
  { cat: 'gpu', id: 'rtx-5080', name: 'GeForce RTX 5080 16GB (triple-fan)', price: 1050, lengthMm: 340, watts: 360, vramGb: 16, power: '1x 12V-2x6', gaming: 100, creating: 95,
    blurb: 'High-end card for 4K gaming and serious 3D or video work.' },
];

export const STORAGES: Storage[] = [
  { cat: 'storage', id: 'p3-1tb', name: 'Crucial P3 1TB NVMe', price: 60, tb: 1, speed: 'fast',
    blurb: 'Holds Windows plus 8-12 large games.' },
  { cat: 'storage', id: 'sn580-1tb', name: 'WD Blue SN580 1TB NVMe', price: 65, tb: 1, speed: 'faster',
    blurb: 'Quick 1TB drive. Same capacity, slightly snappier.' },
  { cat: 'storage', id: 'p3p-2tb', name: 'Crucial P3 Plus 2TB NVMe', price: 115, tb: 2, speed: 'faster',
    blurb: 'Room for a big game library or video projects.' },
  { cat: 'storage', id: '990pro-2tb', name: 'Samsung 990 Pro 2TB NVMe', price: 170, tb: 2, speed: 'fastest',
    blurb: 'Top-speed drive. You will rarely feel the difference in games.' },
];

export const COOLERS: Cooler[] = [
  { cat: 'cooler', id: 'stock', name: 'Stock cooler (included with CPU)', price: 0, kind: 'stock', heightMm: 60, radMm: 0, handlesWatts: 95, noise: 3,
    blurb: 'Free, but louder under load. Fine for 65W-class chips.' },
  { cat: 'cooler', id: 'ax120', name: 'Thermalright Assassin X 120 Refined SE', price: 20, kind: 'air', heightMm: 148, radMm: 0, handlesWatts: 180, noise: 2,
    blurb: 'Cheap single-tower cooler that beats any stock cooler.' },
  { cat: 'cooler', id: 'pa120', name: 'Thermalright Peerless Assassin 120 SE', price: 38, kind: 'air', heightMm: 155, radMm: 0, handlesWatts: 240, noise: 1,
    blurb: 'Dual-tower air cooler, quiet and strong for the price.' },
  { cat: 'cooler', id: 'nhd15g2', name: 'Noctua NH-D15 G2', price: 150, kind: 'air', heightMm: 168, radMm: 0, handlesWatts: 280, noise: 1,
    blurb: 'Premium, very quiet, and very tall. Many cases cannot fit it.' },
  { cat: 'cooler', id: 'lf3-240', name: 'Arctic Liquid Freezer III 240', price: 75, kind: 'aio', heightMm: 0, radMm: 240, handlesWatts: 260, noise: 1,
    blurb: 'All-in-one liquid cooler. Needs a case with a 240mm radiator mount.' },
];

export const PSUS: Psu[] = [
  { cat: 'psu', id: 'a650bn', name: 'MSI MAG A650BN 650W Bronze', price: 55, watts: 650, rating: '80+ Bronze', noise: 3,
    blurb: 'Budget unit, fine for lower-power builds. Cables are not removable.' },
  { cat: 'psu', id: 'rm750e', name: 'Corsair RM750e 750W Gold', price: 95, watts: 750, rating: '80+ Gold', noise: 1,
    blurb: 'Reliable, quiet, modular cables (plug in only what you need).' },
  { cat: 'psu', id: 'rm850e', name: 'Corsair RM850e 850W Gold', price: 115, watts: 850, rating: '80+ Gold', noise: 1,
    blurb: 'Headroom for high-end GPUs and future upgrades.' },
  { cat: 'psu', id: 'rm1000e', name: 'Corsair RM1000e 1000W Gold', price: 160, watts: 1000, rating: '80+ Gold', noise: 1,
    blurb: 'More than most single-GPU builds will ever need.' },
];

export const CASES: Case[] = [
  { cat: 'case', id: 'nr200p', name: 'Cooler Master MasterBox NR200P', price: 95, forms: ['ITX'], maxGpuMm: 330, maxCoolerMm: 155, radSupport: [240, 280], size: 'small', color: '#2a2d33',
    blurb: 'Tiny and stylish, but only takes Mini-ITX boards. Harder first build.' },
  { cat: 'case', id: 'q300l', name: 'Cooler Master MasterBox Q300L', price: 50, forms: ['mATX', 'ITX'], maxGpuMm: 360, maxCoolerMm: 157, radSupport: [240], size: 'mid', color: '#25272b',
    blurb: 'Budget compact case. Fits mATX boards, not full ATX.' },
  { cat: 'case', id: 'a3-matx', name: 'Lian Li A3-mATX', price: 75, forms: ['mATX', 'ITX'], maxGpuMm: 415, maxCoolerMm: 165, radSupport: [240, 360], size: 'mid', color: '#1f2328',
    blurb: 'Compact but roomy inside, great airflow for its size.' },
  { cat: 'case', id: 'h5-flow', name: 'NZXT H5 Flow', price: 95, forms: ['ATX', 'mATX', 'ITX'], maxGpuMm: 365, maxCoolerMm: 165, radSupport: [240, 280], size: 'mid', color: '#e9eaec',
    blurb: 'Clean, popular mid-tower with good airflow and simple cable routing.' },
  { cat: 'case', id: 'pop-air', name: 'Fractal Design Pop Air', price: 85, forms: ['ATX', 'mATX', 'ITX'], maxGpuMm: 405, maxCoolerMm: 170, radSupport: [240, 280, 360], size: 'mid', color: '#2b2e33',
    blurb: 'Roomy, beginner-friendly mid-tower with three front fans included.' },
];

export const ALL_PARTS: Part[] = [...CPUS, ...BOARDS, ...RAMS, ...GPUS, ...STORAGES, ...COOLERS, ...PSUS, ...CASES];

export const PARTS_BY_CAT: Record<Category, Part[]> = {
  cpu: CPUS, board: BOARDS, ram: RAMS, gpu: GPUS, storage: STORAGES, cooler: COOLERS, psu: PSUS, case: CASES,
};

const byId = new Map(ALL_PARTS.map((p) => [p.id, p]));
export function getPart<T extends Part = Part>(id: string | undefined | null): T | undefined {
  return id ? (byId.get(id) as T | undefined) : undefined;
}

// A build is just one chosen id per category. gpu may be absent (integrated graphics).
export type Build = Partial<Record<Category, string>>;

export type Resolved = {
  cpu?: Cpu; board?: Board; ram?: Ram; gpu?: Gpu; storage?: Storage; cooler?: Cooler; psu?: Psu; case?: Case;
};

export function resolve(b: Build): Resolved {
  return {
    cpu: getPart<Cpu>(b.cpu), board: getPart<Board>(b.board), ram: getPart<Ram>(b.ram), gpu: getPart<Gpu>(b.gpu),
    storage: getPart<Storage>(b.storage), cooler: getPart<Cooler>(b.cooler), psu: getPart<Psu>(b.psu), case: getPart<Case>(b.case),
  };
}

// Everything except GPU, CPU and board pulls a modest amount; add a margin for fans, drives, USB.
export function estimateWatts(r: Resolved): number {
  return (r.cpu?.watts ?? 0) + (r.gpu?.watts ?? 0) + 75;
}
