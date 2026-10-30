'use client';

import { RoundedBox } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Board as BoardPart, Cpu as CpuPart, Ram as RamPart, Storage as StoragePart } from '@/lib/catalog';
import { useStd, usePhys } from './engine';
import type { Layout, V3 } from './layout';
import { brushedTexture, goldFingers, labelTexture, pcbTexture, pinGrid } from './textures';

type BoxProps = { p: V3; s: V3; m: THREE.Material | THREE.Material[]; r?: V3; shadow?: boolean };
export function Bx({ p, s, m, r, shadow = true }: BoxProps) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** Many identical small meshes (pins, capacitors, fins) as one instanced draw call. */
export function Instances({ geo, mat, points, rot, rots }: { geo: THREE.BufferGeometry; mat: THREE.Material; points: V3[]; rot?: V3; rots?: V3[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    points.forEach((pt, i) => {
      q.setFromEuler(new THREE.Euler(...(rots?.[i] ?? rot ?? [0, 0, 0])));
      ref.current!.setMatrixAt(i, m.compose(new THREE.Vector3(...pt), q, one));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [points, rot, rots]);
  return <instancedMesh ref={ref} args={[geo, mat, points.length]} castShadow receiveShadow />;
}

/** Box whose +x face carries a pin-grid texture (connector seen from above). */
function Connector({ p, s, cols, rows, color = '#151515' }: { p: V3; s: V3; cols: number; rows: number; color?: string }) {
  const mats = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const face = new THREE.MeshStandardMaterial({ map: pinGrid(cols, rows), roughness: 0.5 });
    return [face, body, body, body, body, body];
  }, [cols, rows, color]);
  return <Bx p={p} s={s} m={mats} />;
}

export function Motherboard({ l, part }: { l: Layout; part: BoardPart }) {
  const { P, bw, bh, sock, pcieDv, ramSlots, m2, itx } = l;
  const amd = part.socket !== 'LGA1700';
  const chipset = part.name.match(/B\d{3}M?/)?.[0]?.replace('M', '') ?? 'B650';
  const labels = useMemo(() => {
    const L = (text: string, du: number, dv: number, size = 16) => ({ text, x: du / bw, y: dv / bh, size });
    return [
      L('CPU_FAN', sock.du + 3.6, 0.9), L('SYS_FAN1', bw - 3.4, 2), L('ATX_PWR1', bw - 2.6, 7.6), L('CPU_PWR1', 1.0, 2.6),
      L(part.socket, sock.du - 1.4, sock.dv + 3.6, 22), L('PCI_E1', 3.5, pcieDv - 0.8), L('M2_1', m2.du - 4, m2.dv - 1.4),
      L('DIMMA1', ramSlots[0] - 0.4, sock.dv - 6.4, 12), L('JFP1', bw - 4.6, bh - 1.4), L('JUSB1', bw - 9, bh - 1.4),
      L('BAT1', bw - 9.4, pcieDv + 2.4), L(part.name.replace(/\(.*\)/, '').trim(), 2.2, bh - 2.4, 26),
    ];
  }, [bw, bh, sock, pcieDv, m2, ramSlots, part.socket, part.name]);
  const pcbMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: pcbTexture('board', labels, 11, bh / bw), roughness: 0.62, metalness: 0.15,
  }), [labels, bh, bw]);
  const pcbGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(bw, bh);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    g.rotateY(Math.PI / 2);
    return g;
  }, [bw, bh]);

  const edge = useStd({ color: '#0d0f12', roughness: 0.7 });
  const plastic = useStd({ color: '#16181b', roughness: 0.55 });
  const plasticGrey = useStd({ color: '#55595f', roughness: 0.5 });
  const steel = useStd({ color: '#c9ccd1', metalness: 1, roughness: 0.28 });
  const alu = useStd({ color: '#3a3e45', metalness: 0.9, roughness: 0.35, map: brushedTexture(150), roughnessMap: brushedTexture(120) });
  const aluLight = useStd({ color: '#9aa1aa', metalness: 0.95, roughness: 0.3, map: brushedTexture(200) });
  const choke = useStd({ color: '#4b4d52', metalness: 0.5, roughness: 0.45 });
  const cap = useStd({ color: '#8e9298', metalness: 0.9, roughness: 0.3 });
  const gold = useStd({ color: '#e0b552', metalness: 1, roughness: 0.25 });
  const usbBlue = useStd({ color: '#1f5fbf', roughness: 0.5 });
  const socketBase = useStd({ color: amd && part.socket === 'AM4' ? '#e9e4d6' : '#1e2024', roughness: 0.6 });
  const chipLabel = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: chipset, size: 72, color: '#c7ccd3' }], { w: 256, h: 256, bg: '#2b2f35', etched: true }), metalness: 0.7, roughness: 0.35,
  }), [chipset]);

  // Precomputed instance points.
  const chokes = useMemo(() => Array.from({ length: 7 }, (_, i) => P(sock.du - 3.6 + i * 1.15, sock.dv - 3.6, 0.45)), [P, sock]);
  const chokesL = useMemo(() => Array.from({ length: 5 }, (_, i) => P(sock.du - 3.7, sock.dv - 2.2 + i * 1.15, 0.45)), [P, sock]);
  const caps = useMemo(() => [
    ...Array.from({ length: 6 }, (_, i) => P(sock.du - 3.2 + i * 1.25, sock.dv - 2.6, 0.45)),
    ...Array.from({ length: 4 }, (_, i) => P(bw - 6 + i * 0.9, bh - 4.6, 0.45)),
  ], [P, sock, bw, bh]);
  const vrmFins = useMemo(() => Array.from({ length: 11 }, (_, i) => P(sock.du - 4 + i * 0.85, sock.dv - 5.4, 2.4)), [P, sock]);
  const pins = useMemo(() => {
    const out: V3[] = [];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) out.push(P(bw - 4.2 + x * 0.254, bh - 0.9 + y * 0.254, 0.42));
    for (let x = 0; x < 4; x++) out.push(P(sock.du + 3.2 + x * 0.254, 1.3, 0.42));
    for (let x = 0; x < 4; x++) out.push(P(bw - 3.2 + x * 0.254, 2.4, 0.42));
    return out;
  }, [P, bw, bh, sock]);
  const holes = useMemo(() => {
    const pts: [number, number][] = itx ? [[0.6, 1], [bw - 1, 1], [0.6, bh - 1], [bw - 1, bh - 1]]
      : [[0.6, 1], [bw - 1, 1], [bw / 2 + 2, 1], [0.6, pcieDv + 1], [bw - 1, pcieDv + 1], [0.6, bh - 1], [bw - 1, bh - 1], [bw / 2 + 2, bh - 1]];
    return pts.map(([du, dv]) => P(du, dv, 0.01));
  }, [P, bw, bh, itx, pcieDv]);
  const pinGeo = useMemo(() => new THREE.BoxGeometry(0.6, 0.07, 0.07), []);
  const chokeGeo = useMemo(() => new THREE.BoxGeometry(0.7, 0.9, 0.9), []);
  const capGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16).rotateZ(Math.PI / 2), []);
  const finGeo = useMemo(() => new THREE.BoxGeometry(1.6, 2.6, 0.3), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.18, 0.42, 24).rotateY(Math.PI / 2), []);

  const pcieLen = Math.min(8.9, bw - 6);
  return (
    <group>
      <mesh geometry={pcbGeo} material={pcbMat} position={P(bw / 2, bh / 2, 0.002)} receiveShadow />
      <Bx p={P(bw / 2, bh / 2, -0.09)} s={[0.16, bh, bw]} m={edge} />
      <Instances geo={ringGeo} mat={steel} points={holes} />

      {/* CPU socket with retention frame */}
      <Bx p={P(sock.du, sock.dv, 0.18)} s={[0.36, 5.4, 5.4]} m={socketBase} />
      {part.socket !== 'AM4' && (
        <group>
          <Bx p={P(sock.du, sock.dv - 2.55, 0.42)} s={[0.12, 0.3, 5.6]} m={steel} />
          <Bx p={P(sock.du, sock.dv + 2.55, 0.42)} s={[0.12, 0.3, 5.6]} m={steel} />
          <Bx p={P(sock.du - 2.65, sock.dv, 0.42)} s={[0.12, 5.4, 0.3]} m={steel} />
          <Bx p={P(sock.du + 2.65, sock.dv, 0.42)} s={[0.12, 5.4, 0.3]} m={steel} />
        </group>
      )}
      <mesh position={P(sock.du - 3.1, sock.dv, 0.5)} material={steel}>
        <cylinderGeometry args={[0.07, 0.07, 5.4, 10]} />
      </mesh>
      <Bx p={P(sock.du - 3.1, sock.dv + 2.9, 0.9)} s={[0.9, 0.14, 0.14]} m={steel} />

      {/* VRM: chokes, caps, finned heatsink and the rear I/O shroud */}
      <Instances geo={chokeGeo} mat={choke} points={[...chokes, ...chokesL]} />
      <Instances geo={capGeo} mat={cap} points={caps} />
      <Bx p={P(sock.du + 0.2, sock.dv - 5.4, 0.9)} s={[1.6, 2.6, 9.8]} m={alu} />
      <Instances geo={finGeo} mat={alu} points={vrmFins} />
      <RoundedBox args={[3.4, 12.5, 3.6]} radius={0.35} position={P(1.9, 6.6, 1.8)} material={alu} castShadow />
      <Bx p={P(1.9, 6.6, 3.62)} s={[0.04, 11.5, 0.5]} m={aluLight} />

      {/* Power connectors */}
      <Connector p={P(2.9, 0.75, 0.55)} s={[1.1, 1.0, 2.2]} cols={4} rows={2} />
      <Connector p={P(bw - 0.85, 11.5, 0.75)} s={[1.5, 5.4, 1.05]} cols={2} rows={12} />

      {/* DIMM slots with latches */}
      {ramSlots.map((du, i) => (
        <group key={du}>
          <Bx p={P(du, sock.dv + 1, 0.42)} s={[0.84, 13.4, 0.62]} m={i % 2 ? plastic : plasticGrey} />
          <Bx p={P(du, sock.dv + 1 - 7.0, 0.62)} s={[1.2, 0.55, 0.66]} m={plasticGrey} />
          <Bx p={P(du, sock.dv + 1 + 7.0, 0.62)} s={[1.2, 0.55, 0.66]} m={plasticGrey} />
        </group>
      ))}

      {/* M.2 slot + standoff */}
      <Bx p={P(m2.du - 4.3, m2.dv, 0.3)} s={[0.6, 2.3, 0.8]} m={plastic} />
      <mesh position={P(m2.du + 3.9, m2.dv, 0.22)} rotation={[0, 0, Math.PI / 2]} material={steel}><cylinderGeometry args={[0.22, 0.22, 0.44, 12]} /></mesh>

      {/* PCIe x16 (steel armoured) and a second slot */}
      <Bx p={P(4.3 + pcieLen / 2, pcieDv, 0.45)} s={[0.9, 0.82, pcieLen]} m={steel} />
      <Bx p={P(4.3 + pcieLen / 2, pcieDv, 0.92)} s={[0.06, 0.3, pcieLen - 0.2]} m={plastic} />
      <Bx p={P(4.3 + pcieLen + 0.4, pcieDv, 0.6)} s={[1.1, 0.9, 0.7]} m={plasticGrey} />
      {!itx && <Bx p={P(4.3 + pcieLen / 2, pcieDv + 6.2, 0.42)} s={[0.84, 0.78, pcieLen]} m={plastic} />}

      {/* Chipset heatsink */}
      {!itx && <RoundedBox args={[0.9, 5, 5]} radius={0.2} position={P(bw - 6.2, bh - 6.6, 0.45)} material={chipLabel} castShadow />}

      {/* Headers, USB3, SATA, CMOS battery, M.2 */}
      <Instances geo={pinGeo} mat={gold} points={pins} />
      <Bx p={P(bw - 3.7, bh - 0.78, 0.2)} s={[0.3, 0.7, 1.5]} m={plastic} />
      <Bx p={P(bw - 0.85, bh - 6.2, 0.45)} s={[0.9, 2.0, 1.0]} m={usbBlue} />
      {[0, 1, 2, 3].map((i) => <Bx key={i} p={P(bw - 0.7, bh - 11.6 + i * 1.15, 0.45)} s={[0.9, 0.95, 1.1]} m={plastic} />)}
      <mesh position={P(bw - 8.6, pcieDv + 3.2, 0.2)} rotation={[0, 0, Math.PI / 2]} material={steel} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.32, 32]} />
      </mesh>
      {/* Rear I/O block poking out the back */}
      <Bx p={P(-0.4, 6.6, 1.5)} s={[2.8, 12, 0.8]} m={steel} />
    </group>
  );
}

export function CpuChip({ l, part }: { l: Layout; part: CpuPart }) {
  const { P, sock } = l;
  const lga = part.socket === 'LGA1700';
  const [h, w] = lga ? [4.5, 3.75] : [4.0, 4.0];
  const sub = useStd({ color: '#1d5a33', roughness: 0.6, metalness: 0.2 });
  const ihs = usePhys({ color: '#d6d9dd', metalness: 1, roughness: 0.22, clearcoat: 0.3, map: brushedTexture(225) });
  const etch = useMemo(() => {
    const brand = part.name.split(' ').slice(0, 1).join(' ');
    const model = part.name.split(' ').slice(1).join(' ');
    return new THREE.MeshStandardMaterial({
      map: labelTexture([{ t: brand, size: 44, color: '#3c4047' }, { t: model, size: 38, color: '#3c4047', weight: 600 }, { t: 'DIFFUSED IN ' + (lga ? 'MALAYSIA' : 'TAIWAN'), size: 18, color: '#555a61', weight: 500 }], { w: 512, h: 512 }),
      transparent: true, metalness: 0.6, roughness: 0.4,
    });
  }, [part.name, lga]);
  const gold = useStd({ color: '#d9b04c', metalness: 1, roughness: 0.3 });
  return (
    <group>
      <Bx p={P(sock.du, sock.dv, 0.42)} s={[0.12, h, w]} m={sub} />
      <RoundedBox args={[0.34, h - 0.7, w - 0.7]} radius={0.12} smoothness={3} position={P(sock.du, sock.dv, 0.66)} material={ihs} castShadow />
      <mesh position={P(sock.du, sock.dv, 0.835)} rotation={[0, Math.PI / 2, 0]} material={etch}>
        <planeGeometry args={[w - 1.0, h - 1.0]} />
      </mesh>
      {/* Gold alignment triangle */}
      <mesh position={P(sock.du - w / 2 + 0.25, sock.dv + h / 2 - 0.25, 0.49)} rotation={[0, Math.PI / 2, 0]} material={gold}>
        <circleGeometry args={[0.18, 3]} />
      </mesh>
    </group>
  );
}

export function RamSticks({ l, part }: { l: Layout; part: RamPart }) {
  const { P, sock, ramUsed } = l;
  const tall = part.mem === 'DDR5' ? 3.5 : 3.2;
  const spreaderGeo = useMemo(() => {
    // Heat-spreader silhouette: flat bottom, aggressive stepped top.
    const s = new THREE.Shape();
    const L = 13.3, Hh = tall;
    s.moveTo(-L / 2, 0); s.lineTo(L / 2, 0); s.lineTo(L / 2, Hh * 0.82); s.lineTo(L / 2 - 1.2, Hh);
    s.lineTo(1.6, Hh); s.lineTo(0.9, Hh * 0.9); s.lineTo(-0.9, Hh * 0.9); s.lineTo(-1.6, Hh);
    s.lineTo(-L / 2 + 1.2, Hh); s.lineTo(-L / 2, Hh * 0.82); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    g.rotateZ(-Math.PI / 2); // shape X -> -y (length), shape Y -> +x (height out of board)
    return g;
  }, [tall]);
  const spreader = useStd({ color: '#1b1d21', metalness: 0.8, roughness: 0.38, map: brushedTexture(90) });
  const pcb = useStd({ color: '#0f3d22', roughness: 0.6 });
  const fingers = useStd({ map: goldFingers(72), metalness: 0.8, roughness: 0.3 });
  const label = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: part.name.split(' ').slice(0, 2).join(' ').toUpperCase(), size: 34 }, { t: `${part.gb / 2}GB ${part.mem}`, size: 26, color: '#c4c9cf', weight: 500 }], { w: 512, h: 128, bg: '#1b1d21' }),
    roughness: 0.5, metalness: 0.5,
  }), [part.name, part.gb, part.mem]);
  return (
    <group>
      {ramUsed.map((du) => {
        const c = P(du, sock.dv + 1, 0);
        return (
          <group key={du} position={c}>
            <Bx p={[0.9 + tall / 2 - 0.2, 0, 0]} s={[tall, 13.3, 0.12]} m={pcb} />
            <mesh position={[0.45, 0, 0.065]} rotation={[0, 0, Math.PI / 2]} material={fingers}><planeGeometry args={[13.3, 0.5]} /></mesh>
            <mesh geometry={spreaderGeo} material={spreader} position={[0.85, 0, 0.08]} castShadow />
            <mesh geometry={spreaderGeo} material={spreader} position={[0.85, 0, -0.33]} castShadow />
            <mesh position={[0.85 + tall * 0.45, 0, 0.245]} rotation={[0, 0, Math.PI / 2]} material={label}>
              <planeGeometry args={[9, tall * 0.42]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function NvmeDrive({ l, part }: { l: Layout; part: StoragePart }) {
  const { P, m2 } = l;
  const pcb = useStd({ color: '#101215', roughness: 0.55 });
  const chip = useStd({ color: '#1a1b1e', roughness: 0.35, metalness: 0.2 });
  const fingers = useStd({ map: goldFingers(36), metalness: 0.8, roughness: 0.3 });
  const label = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: part.name.replace(/ NVMe$/, ''), size: 30 }, { t: `${part.tb}TB  NVMe  PCIe`, size: 22, color: '#9aa3ad', weight: 500 }], { w: 512, h: 128, bg: '#15171a' }),
    roughness: 0.5,
  }), [part.name, part.tb]);
  const c = P(m2.du, m2.dv, 0.45);
  return (
    <group position={c}>
      <Bx p={[0, 0, 0]} s={[0.08, 2.2, 8]} m={pcb} />
      <Bx p={[0.08, 0, -2.2]} s={[0.1, 1.3, 1.3]} m={chip} />
      <Bx p={[0.08, 0, 0.3]} s={[0.12, 1.5, 1.7]} m={chip} />
      <Bx p={[0.08, 0, 2.3]} s={[0.12, 1.5, 1.7]} m={chip} />
      <mesh position={[0.155, 0, 0.6]} rotation={[0, Math.PI / 2, 0]} material={label}><planeGeometry args={[6.2, 1.9]} /></mesh>
      <mesh position={[0.045, 0, -3.85]} rotation={[0, Math.PI / 2, 0]} material={fingers}><planeGeometry args={[0.3, 2.1]} /></mesh>
    </group>
  );
}
