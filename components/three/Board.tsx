'use client';

import { RoundedBox } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Board as BoardPart, Cpu as CpuPart, Ram as RamPart, Storage as StoragePart } from '@/lib/catalog';
import { seg, useRig, useStd, usePhys } from './engine';
import type { Layout, V3 } from './layout';
import { brushedTexture, contactField, finStripes, goldFingers, labelTexture, pcbTexture, pinGrid } from './textures';

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

/** Pan-head Phillips screw, head facing +x. */
export function ScrewHead({ mat, r = 0.3 }: { mat: THREE.Material; r?: number }) {
  const slot = useStd({ color: '#2a2c30', roughness: 0.6 });
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[r * 0.25, 0, 0]} material={mat} castShadow><cylinderGeometry args={[r, r * 1.05, r * 0.5, 20]} /></mesh>
      <Bx p={[r * 0.52, 0, 0]} s={[0.02, r * 1.2, r * 0.22]} m={slot} shadow={false} />
      <Bx p={[r * 0.52, 0, 0]} s={[0.02, r * 0.22, r * 1.2]} m={slot} shadow={false} />
    </group>
  );
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

  const socketMats = useMemo(() => {
    const top = new THREE.MeshStandardMaterial({ map: contactField(part.socket === 'AM4' ? 'holes' : 'socket'), roughness: 0.4, metalness: part.socket === 'AM4' ? 0 : 0.6 });
    return [top, socketBase, socketBase, socketBase, socketBase, socketBase];
  }, [part.socket, socketBase]);
  const coverMat = useStd({ color: '#26282c', roughness: 0.35, transparent: true, opacity: 0.92 });
  const brass = useStd({ color: '#c9a24a', metalness: 1, roughness: 0.3 });
  const sinkMat = useStd({ color: '#2b2f35', metalness: 0.85, roughness: 0.32, map: finStripes(7, '#24272c', '#4b5058') });
  const sinkLabel = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: 'M.2 SHIELD', size: 40, color: '#c7ccd3', weight: 800 }], { w: 512, h: 96 }), transparent: true, metalness: 0.5, roughness: 0.4,
  }), []);
  const padMat = useStd({ color: '#8d9399', roughness: 0.9 });
  const filmMat = useStd({ color: '#9fd3ff', roughness: 0.1, transparent: true, opacity: 0.55 });

  const leverRef = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Group>(null);
  const latchRefs = useRef<(THREE.Group | null)[]>([]);
  const m2ScrewRef = useRef<THREE.Group>(null);
  const sinkRef = useRef<THREE.Group>(null);
  const filmRef = useRef<THREE.Group>(null);
  const pcieLatchRef = useRef<THREE.Group>(null);
  const screwRefs = useRef<(THREE.Group | null)[]>([]);
  const usedSlots = useMemo(() => ramSlots.map((du) => l.ramUsed.includes(du)), [ramSlots, l.ramUsed]);
  const sinkHome = useMemo(() => P(m2.du, m2.dv, 0.98), [P, m2]);
  useRig((rc) => {
    if (leverRef.current) {
      // First press it out sideways from under the hook, then swing it up.
      leverRef.current.position.z = P(sock.du - 3.1, 0, 0)[2] - 0.3 * seg(rc.lever, 0, 0.15) * (1 - seg(rc.lever, 0.2, 0.4));
      leverRef.current.rotation.z = -seg(rc.lever, 0.1, 1) * 1.75;
    }
    if (plateRef.current) plateRef.current.rotation.z = rc.plate * 1.9;
    if (coverRef.current) {
      coverRef.current.visible = rc.socketCover > 0.08;
      coverRef.current.position.x = (1 - rc.socketCover) * 6;
    }
    latchRefs.current.forEach((g, i) => { if (g) g.rotation.z = usedSlots[i] ? rc.ramLatch * 0.75 : 0; });
    if (m2ScrewRef.current) {
      const out = 1 - rc.m2Screw;
      m2ScrewRef.current.position.x = 0.62 + out * 3;
      m2ScrewRef.current.rotation.x = out * 14;
    }
    if (sinkRef.current) {
      const k = rc.m2Sink;
      sinkRef.current.position.set(sinkHome[0] + k * 10, sinkHome[1] + k * 4, sinkHome[2]);
      sinkRef.current.rotation.set(0, 0, -k * Math.PI * 0.95);
    }
    if (filmRef.current) {
      filmRef.current.visible = rc.m2Film > 0.05;
      filmRef.current.position.set(-(1 - rc.m2Film) * 2, 0, (1 - rc.m2Film) * 6);
      filmRef.current.rotation.y = (1 - rc.m2Film) * 0.6;
    }
    if (pcieLatchRef.current) pcieLatchRef.current.rotation.y = -rc.pcieLatch * 0.7;
    const n = screwRefs.current.length;
    screwRefs.current.forEach((g, i) => {
      if (!g) return;
      const v = Math.min(1, Math.max(0, rc.boardScrews * n - i));
      g.visible = v > 0.02;
      g.position.x = 0.1 + (1 - v) * 2.5;
      g.rotation.x = (1 - v) * 12;
    });
  });

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

      {/* CPU socket: pin field, key triangle, hinged load plate with PnP cover, spring lever */}
      <Bx p={P(sock.du, sock.dv, 0.18)} s={[0.36, 5.4, 5.4]} m={socketMats} />
      <mesh position={P(sock.du - 2.9, sock.dv + 2.9, 0.01)} rotation={[0, Math.PI / 2, Math.PI / 4]} material={gold}><circleGeometry args={[0.32, 3]} /></mesh>
      <Bx p={P(sock.du - 3.45, sock.dv - 2.75, 0.4)} s={[0.5, 0.35, 0.35]} m={steel} />
      <group ref={leverRef} position={P(sock.du - 3.1, sock.dv + 2.7, 0.5)}>
        <mesh position={[0, 2.7, 0]} material={steel} castShadow><cylinderGeometry args={[0.075, 0.075, 5.4, 10]} /></mesh>
        <Bx p={[0.45, 5.4, 0]} s={[0.9, 0.16, 0.16]} m={steel} />
        <Bx p={[0.05, 0, 0.25]} s={[0.16, 0.16, 0.6]} m={steel} />
      </group>
      {part.socket !== 'AM4' && (
        <group ref={plateRef} position={P(sock.du, sock.dv - 2.75, 0.42)}>
          <Bx p={[0, -0.45, 0]} s={[0.1, 0.9, 5.6]} m={steel} />
          <Bx p={[0, -5.05, 0]} s={[0.1, 0.9, 5.6]} m={steel} />
          <Bx p={[0, -2.75, -2.35]} s={[0.1, 5.5, 0.9]} m={steel} />
          <Bx p={[0, -2.75, 2.35]} s={[0.1, 5.5, 0.9]} m={steel} />
          <Bx p={[0, -5.75, 0]} s={[0.1, 0.6, 1.4]} m={steel} />
          <group ref={coverRef}>
            <Bx p={[0.18, -2.75, 0]} s={[0.22, 4.1, 4.1]} m={coverMat} />
          </group>
        </group>
      )}

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

      {/* DIMM slots: fixed stop at the bottom, hinged latch at the top */}
      {ramSlots.map((du, i) => (
        <group key={du}>
          <Bx p={P(du, sock.dv + 1, 0.42)} s={[0.84, 13.4, 0.62]} m={i % 2 ? plastic : plasticGrey} />
          <Bx p={P(du, sock.dv + 1 + 7.0, 0.62)} s={[1.2, 0.55, 0.66]} m={plasticGrey} />
          <group ref={(g) => { latchRefs.current[i] = g; }} position={P(du, sock.dv + 1 - 6.75, 0.2)}>
            <Bx p={[0.6, 0.25, 0]} s={[1.25, 0.5, 0.66]} m={plasticGrey} />
            <Bx p={[1.2, 0.45, 0]} s={[0.2, 0.3, 0.66]} m={plasticGrey} />
          </group>
        </group>
      ))}

      {/* M.2 slot, standoff, screw and removable heatsink with thermal-pad film */}
      <Bx p={P(m2.du - 4.3, m2.dv, 0.3)} s={[0.6, 2.3, 0.8]} m={plastic} />
      <Bx p={P(m2.du - 4.3, m2.dv + 0.45, 0.62)} s={[0.04, 0.12, 0.85]} m={gold} />
      <mesh position={P(m2.du + 3.9, m2.dv, 0.22)} rotation={[0, 0, Math.PI / 2]} material={brass}><cylinderGeometry args={[0.22, 0.22, 0.44, 12]} /></mesh>
      <group ref={m2ScrewRef} position={P(m2.du + 3.9, m2.dv, 0.62)}>
        <ScrewHead mat={steel} r={0.26} />
      </group>
      <group ref={sinkRef} position={P(m2.du, m2.dv, 0.98)}>
        <RoundedBox args={[0.5, 2.8, 8.8]} radius={0.12} material={sinkMat} castShadow />
        <mesh position={[0.26, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={sinkLabel}><planeGeometry args={[7.6, 1.6]} /></mesh>
        <Bx p={[-0.3, 0, 0]} s={[0.1, 2.3, 8]} m={padMat} />
        <group ref={filmRef}><Bx p={[-0.37, 0, 0]} s={[0.03, 2.4, 8.1]} m={filmMat} shadow={false} /></group>
        <group position={[0.3, 0, 4.0]}><ScrewHead mat={steel} r={0.22} /></group>
      </group>

      {/* PCIe x16 (steel armoured) and a second slot */}
      <Bx p={P(4.3 + pcieLen / 2, pcieDv, 0.45)} s={[0.9, 0.82, pcieLen]} m={steel} />
      <Bx p={P(4.3 + pcieLen / 2, pcieDv, 0.92)} s={[0.06, 0.3, pcieLen - 0.2]} m={plastic} />
      <group ref={pcieLatchRef} position={P(4.3 + pcieLen + 0.05, pcieDv, 0.3)}>
        <Bx p={[0.5, 0, 0.35]} s={[1.0, 0.85, 0.7]} m={plasticGrey} />
      </group>
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
      {/* Mounting screws: driven in one by one during assembly */}
      {l.holes.map(([du, dv], i) => (
        <group key={i} ref={(g) => { screwRefs.current[i] = g; }} position={P(du, dv, 0.1)}>
          <ScrewHead mat={steel} r={0.45} />
        </group>
      ))}
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
  const bottom = useMemo(() => new THREE.MeshStandardMaterial({
    map: contactField(part.socket === 'AM4' ? 'pins' : 'pads'), metalness: 0.5, roughness: 0.35,
  }), [part.socket]);
  const gold = useStd({ color: '#e8c35c', metalness: 1, roughness: 0.25, emissive: '#5a4300', emissiveIntensity: 0.4 });
  const pose = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const flip = useRef<THREE.Group>(null);
  useRig((rc) => {
    if (!pose.current) return;
    const v = rc.cpu;
    pose.current.visible = v > -0.5;
    pose.current.position.x = v < 0.5 ? 6 + (1.0 - 6) * seg(v, 0, 0.5) : 1.0 * (1 - seg(v, 0.5, 1));
    if (spin.current) spin.current.rotation.x = rc.cpuSpin * Math.PI / 2;
    if (flip.current) flip.current.rotation.z = rc.cpuFlip * Math.PI * 0.85;
  });
  // CPU space: origin at the socket centre, x out of the board.
  return (
    <group position={P(sock.du, sock.dv, 0)}>
      <group ref={pose}>
        <group ref={spin}>
          <group ref={flip} position={[0.5, 0, 0]}>
            <group position={[-0.5, 0, 0]}>
              <Bx p={[0.42, 0, 0]} s={[0.12, h, w]} m={sub} />
              <mesh position={[0.355, 0, 0]} rotation={[0, -Math.PI / 2, 0]} material={bottom}><planeGeometry args={[w - 0.05, h - 0.05]} /></mesh>
              {part.socket === 'AM4' && (
                <mesh position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={gold}><boxGeometry args={[h - 0.4, 0.22, w - 0.4]} /></mesh>
              )}
              <RoundedBox args={[0.34, h - 0.7, w - 0.7]} radius={0.12} smoothness={3} position={[0.66, 0, 0]} material={ihs} castShadow />
              <mesh position={[0.835, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={etch}><planeGeometry args={[w - 1.0, h - 1.0]} /></mesh>
              {/* Gold key triangle on the corner of the substrate */}
              <mesh position={[0.49, -(h / 2 - 0.3), -(w / 2 - 0.3)]} rotation={[0, Math.PI / 2, Math.PI / 4]} material={gold}><circleGeometry args={[0.26, 3]} /></mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export function RamSticks({ l, part }: { l: Layout; part: RamPart }) {
  const { P, sock, ramUsed } = l;
  const tall = part.mem === 'DDR5' ? 3.5 : 3.2;
  const spreaderGeo = useMemo(() => {
    // Heat-spreader silhouette: flat bottom, stepped top.
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
  const fingers = useStd({ map: goldFingers(36), metalness: 0.8, roughness: 0.3 });
  const label = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: part.name.split(' ').slice(0, 2).join(' ').toUpperCase(), size: 34 }, { t: `${part.gb / 2}GB ${part.mem}`, size: 26, color: '#c4c9cf', weight: 500 }], { w: 512, h: 128, bg: '#1b1d21' }),
    roughness: 0.5, metalness: 0.5,
  }), [part.name, part.gb, part.mem]);
  // The key notch: DDR5 sits close to the middle, DDR4 a little further off-centre.
  const notch = part.mem === 'DDR5' ? -0.3 : -1.2;
  const L = 13.3;
  const leftLen = L / 2 + notch - 0.2;
  const rightLen = L / 2 - notch - 0.2;
  const pose = useRef<THREE.Group>(null);
  useRig((rc) => {
    if (!pose.current) return;
    const v = rc.ram;
    pose.current.visible = v > -0.5;
    pose.current.position.x = v < 0.5 ? 6.5 + (1.4 - 6.5) * seg(v, 0, 0.5) : 1.4 * (1 - seg(v, 0.5, 1));
  });
  return (
    <group ref={pose}>
      {ramUsed.map((du) => (
        <group key={du} position={P(du, sock.dv + 1, 0)}>
          <Bx p={[0.9 + tall / 2 - 0.2, 0, 0]} s={[tall, 13.3, 0.12]} m={pcb} />
          <mesh position={[0.45, L / 2 - leftLen / 2, 0.065]} rotation={[0, 0, Math.PI / 2]} material={fingers}><planeGeometry args={[leftLen, 0.5]} /></mesh>
          <mesh position={[0.45, -L / 2 + rightLen / 2, 0.065]} rotation={[0, 0, Math.PI / 2]} material={fingers}><planeGeometry args={[rightLen, 0.5]} /></mesh>
          <mesh geometry={spreaderGeo} material={spreader} position={[0.85, 0, 0.08]} castShadow />
          <mesh geometry={spreaderGeo} material={spreader} position={[0.85, 0, -0.33]} castShadow />
          <mesh position={[0.85 + tall * 0.45, 0, 0.245]} rotation={[0, 0, Math.PI / 2]} material={label}>
            <planeGeometry args={[9, tall * 0.42]} />
          </mesh>
        </group>
      ))}
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
  const pose = useRef<THREE.Group>(null);
  useRig((rc) => {
    if (!pose.current) return;
    const v = rc.m2;
    pose.current.visible = v > -0.5;
    const a = seg(v, 0, 0.5);
    // Slide in along the board at 30 degrees, then press flat.
    pose.current.position.set((1 - a) * 3, 0, (1 - a) * 7);
    pose.current.rotation.y = v < 0.5 ? 0.52 : 0.52 * (1 - seg(v, 0.5, 1));
  });
  // Pivot at the connector end of the drive.
  return (
    <group position={P(m2.du - 4, m2.dv, 0.45)}>
      <group ref={pose}>
        <group position={[0, 0, 4]}>
          <Bx p={[0, 0, 0]} s={[0.08, 2.2, 8]} m={pcb} />
          <Bx p={[0.08, 0, -2.2]} s={[0.1, 1.3, 1.3]} m={chip} />
          <Bx p={[0.08, 0, 0.3]} s={[0.12, 1.5, 1.7]} m={chip} />
          <Bx p={[0.08, 0, 2.3]} s={[0.12, 1.5, 1.7]} m={chip} />
          <mesh position={[0.155, 0, 0.6]} rotation={[0, Math.PI / 2, 0]} material={label}><planeGeometry args={[6.2, 1.9]} /></mesh>
          <mesh position={[0.045, 0, -3.85]} rotation={[0, Math.PI / 2, 0]} material={fingers}><planeGeometry args={[0.3, 2.1]} /></mesh>
          {/* Half-moon notch at the far end where the screw goes */}
          <mesh position={[0, 0, 3.95]} rotation={[0, 0, Math.PI / 2]} material={pcb}><cylinderGeometry args={[0.3, 0.3, 0.09, 16, 1, false, 0, Math.PI]} /></mesh>
        </group>
      </group>
    </group>
  );
}
