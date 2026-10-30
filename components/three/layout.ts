import type { Resolved } from '@/lib/catalog';
import type { Anchor } from '@/lib/assembly';

// All units are centimetres. World axes: +x toward the glass panel, +y up, +z toward the case front.
// Board-mounted parts are authored in "board space": origin at the board's top-rear corner on its
// front surface, +x out of the board, -y down the board, +z toward the case front.

export type V3 = [number, number, number];

export function layout(r: Resolved) {
  const c = r.case;
  const small = c?.size === 'small';
  const D = (c?.maxGpuMm ?? 380) / 10 + 8;
  const H = small ? 34 : 47;
  const W = Math.max(19, (c?.maxCoolerMm ?? 165) / 10 + 4);
  const form = r.board?.form ?? 'ATX';
  const bh = form === 'ATX' ? 30.5 : form === 'mATX' ? 24.4 : 17;
  const bw = form === 'ITX' ? 17 : 24.4;
  const x0 = -W / 2 + 2.6; // motherboard front surface
  const top = H - 3.2;
  const rear = -D / 2 + 2.6;
  const itx = form === 'ITX';
  const sock = { du: itx ? 7.5 : 9.2, dv: itx ? 6 : 7.4 };
  const pcieDv = itx ? 13.4 : 17.2;
  const ramDu = sock.du + 6.4;
  const ramSlots = itx ? [ramDu, ramDu + 1.0] : [ramDu, ramDu + 0.95, ramDu + 1.9, ramDu + 2.85];
  const ramUsed = itx ? ramSlots : [ramSlots[1], ramSlots[3]];
  const m2 = { du: sock.du, dv: pcieDv - 3.4 };
  const board: V3 = [x0, top, rear];
  /** Board-space point from distance along the board (du, toward front), down the board (dv) and out of it (dx). */
  const P = (du: number, dv: number, dx = 0): V3 => [dx, -dv, du];
  /** World point to board space. */
  const toBoard = (w: V3): V3 => [w[0] - x0, w[1] - top, w[2] - rear];
  const psu: V3 = [-W / 2 + 1.0 + 7.5, 1.3 + 4.35, -D / 2 + 1 + 7.2];
  const gpuLen = (r.gpu?.lengthMm ?? 250) / 10;
  const pcieLen = Math.min(8.9, bw - 6);
  // Mounting holes (du, dv) in board space.
  const holes: [number, number][] = itx ? [[0.6, 1], [bw - 1, 1], [0.6, bh - 1], [bw - 1, bh - 1]]
    : [[0.6, 1], [bw - 1, 1], [0.6, pcieDv + 1], [bw - 1, pcieDv + 1], [0.6, bh - 1], [bw - 1, bh - 1], [bw / 2 + 2, 1], [bw / 2 + 2, bh - 1]];
  // The workbench: the board lies flat on its box beside the case. Board space +x (out of the board) points up.
  const benchCenter: V3 = [W / 2 + 36, 0, 4];
  const benchCorner: V3 = [benchCenter[0] - bh / 2, 6.05, benchCenter[2] - bw / 2];
  return { D, H, W, bh, bw, x0, top, rear, itx, small, sock, pcieDv, pcieLen, ramSlots, ramUsed, m2, board, P, toBoard, psu, gpuLen, holes, benchCenter, benchCorner };
}

export type Layout = ReturnType<typeof layout>;

export type AnchorPos = { space: 'board' | 'world'; p: V3 };

/** Where each named anchor sits. Board anchors are in board space and move with the board. */
export function anchors(l: Layout, r: Resolved): Record<Anchor, AnchorPos> {
  const { P, sock, m2, ramUsed, bw, bh, pcieDv, pcieLen, holes, x0, top, rear, D, H, W, psu, gpuLen } = l;
  const B = (p: V3): AnchorPos => ({ space: 'board', p });
  const Wd = (p: V3): AnchorPos => ({ space: 'world', p });
  const lga = r.cpu?.socket === 'LGA1700';
  const [ch, cw] = lga ? [4.5, 3.75] : [4, 4];
  const ddr5 = r.ram?.mem !== 'DDR4';
  const tower = r.cooler?.kind === 'air';
  const coolerH = r.cooler?.kind === 'air' ? r.cooler.heightMm / 10 : r.cooler?.kind === 'aio' ? 5 : 6;
  const cs: V3[] = tower
    ? [P(sock.du - 3.6, sock.dv, 2.4), P(sock.du + 3.6, sock.dv, 2.4), P(sock.du - 3.6, sock.dv, 2.4), P(sock.du + 3.6, sock.dv, 2.4)]
    : [P(sock.du - 3.7, sock.dv - 3.7, 1.6), P(sock.du + 3.7, sock.dv + 3.7, 1.6), P(sock.du + 3.7, sock.dv - 3.7, 1.6), P(sock.du - 3.7, sock.dv + 3.7, 1.6)];
  const h = holes.slice(0, 6).map(([du, dv]) => B(P(du, dv, 0.6)));
  const radLen = (r.cooler?.radMm ?? 240) / 10 + 3.4;
  return {
    boardCenter: B(P(bw / 2, bh / 2, 0)),
    socket: B(P(sock.du, sock.dv, 1)),
    lever: B(P(sock.du - 3.1, sock.dv - 2.6, 0.9)),
    plate: B(P(sock.du, sock.dv + 2.5, 1)),
    cpuAbove: B(P(sock.du, sock.dv, 6)),
    coolerBase: B(P(sock.du, sock.dv, 11.8)),
    cpuTri: B(P(sock.du - cw / 2 + 0.3, sock.dv + ch / 2 - 0.3, 1)),
    socketTri: B(P(sock.du - 2.9, sock.dv + 2.9, 0.4)),
    m2Slot: B(P(m2.du - 4.2, m2.dv, 0.6)),
    m2Screw: B(P(m2.du + 3.9, m2.dv, 0.7)),
    m2Sink: B(P(m2.du, m2.dv, 1.3)),
    m2Key: B(P(m2.du - 4.3, m2.dv + 0.4, 0.7)),
    ramA2: B(P(ramUsed[0], sock.dv + 1, 2.4)),
    ramB2: B(P(ramUsed[ramUsed.length - 1], sock.dv + 1, 2.4)),
    ramSlots: B(P((ramUsed[0] + ramUsed[ramUsed.length - 1]) / 2, sock.dv + 1, 1.5)),
    ramLatch: B(P(ramUsed[ramUsed.length - 1], sock.dv + 1 - 7, 1.4)),
    ramNotch: B(P(ramUsed[0], sock.dv + 1 + (ddr5 ? 0.3 : 1.2), 1.0)),
    cs1: B(cs[0]), cs2: B(cs[1]), cs3: B(cs[2]), cs4: B(cs[3]),
    coolerTop: B(P(sock.du, sock.dv, coolerH)),
    cpuFan: B(P(sock.du + 3.8, 1.3, 0.6)),
    eps: B(P(2.9, 0.75, 1.2)),
    atx: B(P(bw - 0.85, 11.5, 1.6)),
    pcieSlot: B(P(4.3 + pcieLen / 2, pcieDv, 1.2)),
    pcieLatch: B(P(4.3 + pcieLen + 0.4, pcieDv, 1.2)),
    fpanel: B(P(bw - 3.7, bh - 0.8, 0.6)),
    fpPwr: B(P(bw - 3.3, bh - 0.9, 0.7)),
    fpRst: B(P(bw - 3.3, bh - 0.65, 0.7)),
    fpHdd: B(P(bw - 4.1, bh - 0.65, 0.7)),
    fpPled: B(P(bw - 4.1, bh - 0.9, 0.7)),
    usb3: B(P(bw - 0.85, bh - 6.2, 1)),
    audio: B(P(1.5, bh - 0.8, 0.6)),
    sysFan: B(P(bw - 3.2, 2.4, 0.6)),
    cmos: B(P(bw - 8.6, pcieDv + 3.2, 0.5)),
    h1: h[0], h2: h[1], h3: h[2], h4: h[3], h5: h[4] ?? h[0], h6: h[5] ?? h[1],
    topCutout: B(P(3, -1.4, -1)),
    grommet: B(P(bw + 2.2, 11.5, -0.4)),
    case: Wd([0, H / 2, 0]),
    tray: Wd([x0, top - bh / 2, rear + bw / 2]),
    standoffs: Wd([x0 - 0.3, top - bh / 2, rear + bw / 2]),
    ioShield: Wd([x0 + 1.5, top - 6.6, -D / 2 + 0.6]),
    slotCovers: Wd([x0 + 6.4, top - pcieDv - 3, -D / 2 - 0.2]),
    psuBay: Wd(psu),
    psuSockets: Wd([psu[0] - 1, psu[1], psu[2] + 7.2]),
    psuSwitch: Wd([psu[0] + 5, psu[1] - 1.6, psu[2] - 7.2]),
    gpuPorts: Wd([x0 + 5, top - pcieDv - 1.6, -D / 2 - 0.6]),
    gpuPower: Wd([x0 + 12.4, top - pcieDv + 0.6, rear - 1.4 + gpuLen * 0.62]),
    gpuBracket: Wd([x0 + 6, top - pcieDv + 0.4, -D / 2 + 0.3]),
    glass: Wd([W / 2 + 1, H / 2, 0]),
    radiator: Wd([x0 + 10.6, H - 2.3, rear + 2 + radLen / 2]),
    frontFans: Wd([0.6, H * 0.5, D / 2 - 2.4]),
  };
}

/** Board-space point to world, for a board on the bench (s = 0) or in the case (s = 1). */
export function boardToWorld(l: Layout, p: V3, inCase: boolean): V3 {
  if (inCase) return [l.board[0] + p[0], l.board[1] + p[1], l.board[2] + p[2]];
  // Bench pose is a +90 degree turn about z: (x, y, z) -> (-y, x, z).
  return [l.benchCorner[0] - p[1], l.benchCorner[1] + p[0], l.benchCorner[2] + p[2]];
}
