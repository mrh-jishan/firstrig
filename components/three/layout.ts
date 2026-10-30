import type { Resolved } from '@/lib/catalog';

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
  return { D, H, W, bh, bw, x0, top, rear, itx, small, sock, pcieDv, ramSlots, ramUsed, m2, board, P, toBoard, psu, gpuLen };
}

export type Layout = ReturnType<typeof layout>;
