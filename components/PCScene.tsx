'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, Html, OrbitControls } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Resolved } from '@/lib/catalog';
import type { CableKey, SceneKey } from '@/lib/assembly';

// Units are centimetres. The viewer looks from the glass side (+x) toward the motherboard tray (-x).
// Rear of the case is -z, front is +z.

export type PartStatus = 'error' | 'warn' | 'focus';

export type SceneProps = {
  r: Resolved;
  installed?: SceneKey[]; // undefined = everything chosen
  active?: SceneKey;
  cables?: CableKey[];
  activeCables?: CableKey[];
  status?: Partial<Record<SceneKey, PartStatus>>;
  hideCase?: boolean;
  lowGfx?: boolean;
  animKey?: string; // change to replay the install animation
  onPick?: (k: SceneKey) => void;
  showLabels?: boolean;
};

const STATUS_COLOR: Record<PartStatus, string> = { error: '#ff3b3b', warn: '#ffb020', focus: '#3ba7ff' };

function layout(r: Resolved) {
  const c = r.case;
  const small = c?.size === 'small';
  const D = (c?.maxGpuMm ?? 380) / 10 + 6;
  const H = small ? 30 : 46;
  const W = (c?.maxCoolerMm ?? 165) / 10 + 3;
  const form = r.board?.form ?? 'ATX';
  const bh = form === 'ATX' ? 30.5 : form === 'mATX' ? 24.4 : 17;
  const bw = form === 'ITX' ? 17 : 24.4;
  const x0 = -W / 2 + 2; // motherboard surface
  const top = H - 3;
  const rear = -D / 2 + 2;
  const P = (du: number, dv: number, dx = 0): [number, number, number] => [x0 + dx, top - dv, rear + du];
  const itx = form === 'ITX';
  const socket = { du: itx ? 7 : 9, dv: itx ? 6 : 7 };
  const pcieDv = itx ? 13 : 17;
  return { D, H, W, bh, bw, x0, top, rear, P, socket, pcieDv, itx, small };
}

type L = ReturnType<typeof layout>;

function useInstallOffset(active: boolean, animKey: string | undefined, from: THREE.Vector3) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<{ key?: string; t: number }>({ t: -1 });
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    if (!active) { g.position.set(0, 0, 0); return; }
    if (start.current.key !== animKey || start.current.t < 0) start.current = { key: animKey, t: state.clock.elapsedTime };
    const p = Math.min(1, (state.clock.elapsedTime - start.current.t) / 1.4);
    const e = 1 - Math.pow(1 - p, 3);
    g.position.copy(from).multiplyScalar(1 - e);
  });
  return ref;
}

function Mat({ color, status, active, metal = 0.3, opacity }: { color: string; status?: PartStatus; active?: boolean; metal?: number; opacity?: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const glow = status ? STATUS_COLOR[status] : active ? STATUS_COLOR.focus : null;
  useFrame((s) => {
    if (ref.current && glow) ref.current.emissiveIntensity = 0.35 + Math.sin(s.clock.elapsedTime * 4) * 0.25;
  });
  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      metalness={metal}
      roughness={0.55}
      emissive={glow ?? '#000000'}
      emissiveIntensity={glow ? 0.5 : 0}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
    />
  );
}

function Box({ pos, size, color, status, active, metal, opacity, edges }: {
  pos: [number, number, number]; size: [number, number, number]; color: string; status?: PartStatus; active?: boolean; metal?: number; opacity?: number; edges?: string;
}) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <Mat color={color} status={status} active={active} metal={metal} opacity={opacity} />
      {edges && <Edges color={edges} />}
    </mesh>
  );
}

function Label({ pos, text, show }: { pos: [number, number, number]; text: string; show?: boolean }) {
  if (!show) return null;
  return (
    <Html position={pos} center distanceFactor={60} style={{ pointerEvents: 'none' }}>
      <div className="scene-label">{text}</div>
    </Html>
  );
}

function CaseShell({ l, color, hide, status }: { l: L; color: string; hide?: boolean; status?: PartStatus }) {
  const { D, H, W } = l;
  const t = 0.6;
  const op = hide ? 0.05 : undefined;
  const edge = status ? STATUS_COLOR[status] : hide ? '#4b5563' : '#6b7280';
  const fans = l.small ? [H / 2] : [H * 0.25, H * 0.5, H * 0.75];
  return (
    <group>
      <Box pos={[-W / 2, H / 2, 0]} size={[t, H, D]} color={color} opacity={op} edges={edge} />
      <Box pos={[0, t / 2, 0]} size={[W, t, D]} color={color} opacity={op} edges={edge} />
      <Box pos={[0, H - t / 2, 0]} size={[W, t, D]} color={color} opacity={hide ? 0.05 : 0.6} edges={edge} />
      <Box pos={[0, H / 2, -D / 2]} size={[W, H, t]} color={color} opacity={op} edges={edge} />
      <Box pos={[0, H / 2, D / 2]} size={[W, H, t]} color={color} opacity={hide ? 0.05 : 0.35} edges={edge} />
      {!hide && fans.map((y) => (
        <mesh key={y} position={[0, y, D / 2 - 1.8]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[5.6, 5.6, 2.4, 24]} />
          <meshStandardMaterial color="#111827" roughness={0.8} transparent opacity={0.85} />
        </mesh>
      ))}
      {!hide && (
        <mesh position={[W / 2, H / 2, 0]}>
          <boxGeometry args={[0.2, H, D]} />
          <meshPhysicalMaterial color="#9fb6cc" transparent opacity={0.08} roughness={0.05} />
        </mesh>
      )}
    </group>
  );
}

function curve(points: [number, number, number][]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
}

function Cable({ pts, color, radius, active }: { pts: [number, number, number][]; color: string; radius: number; active?: boolean }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve(pts), 48, radius, 8, false), [pts, radius]);
  const end = pts[pts.length - 1];
  return (
    <group>
      <mesh geometry={geo}>
        <Mat color={color} active={active} metal={0.1} />
      </mesh>
      {active && <Pulse pos={end} />}
    </group>
  );
}

function Pulse({ pos }: { pos: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const k = 1 + ((s.clock.elapsedTime * 1.5) % 1) * 1.6;
    ref.current?.scale.setScalar(k);
    const m = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 1 - ((s.clock.elapsedTime * 1.5) % 1);
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[1.1, 16, 16]} />
      <meshBasicMaterial color={STATUS_COLOR.focus} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

function Rig(p: SceneProps) {
  const { r } = p;
  const l = useMemo(() => layout(r), [r]);
  const all: SceneKey[] = ['case', 'board', 'cpu', 'ram', 'storage', 'cooler', 'gpu', 'psu'];
  const shown = new Set<SceneKey>(p.installed ?? all);
  if (p.active) shown.add(p.active);
  const st = p.status ?? {};
  const isA = (k: SceneKey) => p.active === k;
  const lab = p.showLabels;

  const off = (k: SceneKey) => new THREE.Vector3(k === 'board' ? 18 : 16, k === 'psu' ? 0 : 8, k === 'psu' ? 20 : 0);
  const refs = {
    board: useInstallOffset(isA('board'), p.animKey, off('board')),
    cpu: useInstallOffset(isA('cpu'), p.animKey, off('cpu')),
    ram: useInstallOffset(isA('ram'), p.animKey, off('ram')),
    storage: useInstallOffset(isA('storage'), p.animKey, off('storage')),
    cooler: useInstallOffset(isA('cooler'), p.animKey, off('cooler')),
    gpu: useInstallOffset(isA('gpu'), p.animKey, off('gpu')),
    psu: useInstallOffset(isA('psu'), p.animKey, off('psu')),
  };

  const pick = (k: SceneKey) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); p.onPick?.(k); };

  const { P, x0, top, rear, bh, bw, socket, pcieDv, D, H, W } = l;
  const boardCenter = P(bw / 2, bh / 2, -0.15);
  const sock = P(socket.du, socket.dv, 0);
  const ramDu = socket.du + 6.5;
  const ramSlots = l.itx ? [ramDu, ramDu + 1] : [ramDu, ramDu + 0.9, ramDu + 1.8, ramDu + 2.7];
  const ramUsed = l.itx ? ramSlots : [ramSlots[1], ramSlots[3]];
  const gpuLen = (r.gpu?.lengthMm ?? 250) / 10;
  const gpuPos: [number, number, number] = [x0 + 6.6, top - pcieDv - 2.6, rear - 1 + gpuLen / 2];
  const psuPos: [number, number, number] = [-W / 2 + 1 + 7.5, 4.9, -D / 2 + 1 + 7.2];
  const coolerKind = r.cooler?.kind ?? 'air';
  const coolerH = coolerKind === 'air' ? (r.cooler?.heightMm ?? 150) / 10 : coolerKind === 'stock' ? 6 : 4.5;
  const dualTower = r.cooler?.id === 'pa120' || r.cooler?.id === 'nhd15g2';

  const cablePts: Record<CableKey, [number, number, number][]> = {
    atx24: [[psuPos[0] + 2, 9.4, psuPos[2] + 5], [x0 - 1.2, 12, rear + bw + 2.2], [x0 - 1.2, top - 10, rear + bw + 2.2], [x0 + 1.4, top - 10, rear + bw - 0.6]],
    eps8: [[psuPos[0] - 3, 9.4, psuPos[2] - 4], [x0 - 1.2, 14, rear - 0.6], [x0 - 1.2, top + 1.6, rear + 2.5], [x0 + 1, top - 0.8, rear + 2.5]],
    pcie: [[psuPos[0] + 4, 9.4, psuPos[2] + 3], [x0 + 9, gpuPos[1] - 6, rear + gpuLen * 0.6], [x0 + 12.6, gpuPos[1] + 0.5, rear + gpuLen * 0.62]],
    front: [[x0 + 1, top - bh + 0.6, rear + bw - 3], [x0 + 3, 4, rear + bw + 3], [0, 2.5, D / 2 - 4]],
    fans: [[0, H * 0.35, D / 2 - 3.5], [x0 + 3, top - bh - 0.5, rear + bw * 0.5], [x0 + 1, top - bh + 0.8, rear + bw * 0.5]],
  };

  return (
    <group>
      {shown.has('case') && <group onClick={pick('case')}><CaseShell l={l} color={r.case?.color ?? '#2b2e33'} hide={p.hideCase} status={st.case} /></group>}
      {p.hideCase && <Box pos={[x0 - 1.5, top - bh / 2 - 0.5, rear + bw / 2]} size={[1, bh + 2, bw + 3]} color="#c7a77a" opacity={0.6} />}

      {shown.has('board') && r.board && (
        <group ref={refs.board} onClick={pick('board')}>
          <Box pos={boardCenter} size={[0.3, bh, bw]} color="#1d3b2a" status={st.board} active={isA('board')} edges="#2f5a42" />
          <Box pos={P(socket.du, socket.dv, 0.2)} size={[0.3, 5.6, 5.6]} color="#9ca3af" metal={0.8} />
          {ramSlots.map((du) => <Box key={du} pos={P(du, socket.dv + 1, 0.3)} size={[0.6, 13.6, 0.55]} color="#111827" />)}
          <Box pos={P(bw - 6, pcieDv, 0.4)} size={[0.8, 0.9, Math.min(9, bw - 4)]} color="#111827" />
          <Box pos={P(2.5, 7, 1.6)} size={[3.2, 9, 3]} color="#374151" metal={0.6} />
          <Label pos={P(bw / 2, bh - 2, 1)} text="Motherboard" show={lab} />
        </group>
      )}

      {shown.has('cpu') && r.cpu && (
        <group ref={refs.cpu} onClick={pick('cpu')}>
          <Box pos={P(socket.du, socket.dv, 0.55)} size={[0.5, 4, 4]} color="#c0c4ca" metal={0.9} status={st.cpu} active={isA('cpu')} />
        </group>
      )}

      {shown.has('ram') && r.ram && (
        <group ref={refs.ram} onClick={pick('ram')}>
          {ramUsed.map((du) => <Box key={du} pos={P(du, socket.dv + 1, 2)} size={[3.2, 13.3, 0.7]} color="#1f2937" status={st.ram} active={isA('ram')} edges="#4b5563" />)}
          <Label pos={P(ramUsed[0], socket.dv - 6.5, 3.5)} text="RAM" show={lab} />
        </group>
      )}

      {shown.has('storage') && r.storage && (
        <group ref={refs.storage} onClick={pick('storage')}>
          <Box pos={P(socket.du + 1, l.itx ? 15 : 13.6, 0.35)} size={[0.3, 2.2, 8]} color="#0f172a" status={st.storage} active={isA('storage')} edges="#64748b" />
        </group>
      )}

      {shown.has('cooler') && r.cooler && (
        <group ref={refs.cooler} onClick={pick('cooler')}>
          {coolerKind === 'stock' && (
            <mesh position={P(socket.du, socket.dv, 0.8 + coolerH / 2)} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[4.8, 4.8, coolerH, 28]} />
              <Mat color="#3f3f46" status={st.cooler} active={isA('cooler')} />
            </mesh>
          )}
          {coolerKind === 'air' && (
            <>
              <Box pos={P(socket.du, socket.dv, 0.8 + coolerH / 2)} size={[coolerH, 12.5, dualTower ? 11 : 5.5]} color="#cbd5e1" metal={0.7} status={st.cooler} active={isA('cooler')} edges="#94a3b8" />
              <Box pos={P(socket.du + (dualTower ? 0 : 3.4), socket.dv, 0.8 + coolerH / 2)} size={[coolerH - 1, 12, 2.4]} color={r.cooler.id === 'nhd15g2' ? '#5b4636' : '#111827'} status={st.cooler} active={isA('cooler')} />
            </>
          )}
          {coolerKind === 'aio' && (
            <>
              <Box pos={P(socket.du, socket.dv, 0.8 + coolerH / 2)} size={[coolerH, 6.5, 6.5]} color="#18181b" status={st.cooler} active={isA('cooler')} edges="#52525b" />
              <Box pos={[0.5, H - 3.2, rear + 4 + (r.cooler.radMm / 10) / 2]} size={[12, 3.8, r.cooler.radMm / 10]} color="#27272a" status={st.cooler} active={isA('cooler')} edges="#52525b" />
              <Cable pts={[P(socket.du + 3, socket.dv - 2, 3), [x0 + 5, H - 6, rear + 12], [0, H - 4.5, rear + 14]]} color="#111" radius={0.55} />
            </>
          )}
          <Label pos={P(socket.du, socket.dv - 7.5, coolerH / 2 + 1)} text="CPU cooler" show={lab} />
        </group>
      )}

      {shown.has('gpu') && r.gpu && (
        <group ref={refs.gpu} onClick={pick('gpu')}>
          <Box pos={gpuPos} size={[12, 4.8, gpuLen]} color="#18181b" status={st.gpu} active={isA('gpu')} edges="#3f3f46" />
          <Box pos={[gpuPos[0], gpuPos[1] + 2.5, gpuPos[2]]} size={[11.6, 0.2, gpuLen - 0.4]} color="#52525b" metal={0.8} />
          <Box pos={[x0 + 6.6, gpuPos[1], rear - 1.3]} size={[12, 5.5, 0.2]} color="#9ca3af" metal={0.9} />
          <Label pos={[gpuPos[0] + 6.5, gpuPos[1], gpuPos[2]]} text="Graphics card" show={lab} />
        </group>
      )}

      {shown.has('psu') && r.psu && (
        <group ref={refs.psu} onClick={pick('psu')}>
          <Box pos={psuPos} size={[15, 8.6, 14]} color="#111827" status={st.psu} active={isA('psu')} edges="#374151" />
          <Label pos={[psuPos[0] + 8, psuPos[1], psuPos[2]]} text="Power supply" show={lab} />
        </group>
      )}

      {(['atx24', 'eps8', 'pcie', 'front', 'fans'] as CableKey[]).map((k) => {
        const on = p.cables?.includes(k) || p.activeCables?.includes(k);
        if (!on || (k === 'pcie' && !r.gpu)) return null;
        const color = k === 'front' ? '#9ca3af' : k === 'fans' ? '#4b5563' : '#0b0b0c';
        const radius = k === 'atx24' ? 0.9 : k === 'front' || k === 'fans' ? 0.3 : 0.55;
        return <Cable key={k} pts={cablePts[k]} color={color} radius={radius} active={p.activeCables?.includes(k)} />;
      })}

      {st.gpu === 'error' && r.case && (
        <mesh position={[gpuPos[0], gpuPos[1], rear - 1 + r.case.maxGpuMm / 10]}>
          <boxGeometry args={[13, 8, 0.15]} />
          <meshBasicMaterial color={STATUS_COLOR.error} transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

export default function PCScene(props: SceneProps) {
  const H = props.r.case?.size === 'small' ? 30 : 46;
  const [ready, setReady] = useState(false);
  return (
    <div className="scene-wrap">
      <Canvas
        shadows={!props.lowGfx}
        dpr={props.lowGfx ? 1 : [1, 2]}
        camera={{ position: [62, H * 0.85, 44], fov: 38, near: 1, far: 500 }}
        onCreated={() => setReady(true)}
        gl={{ antialias: !props.lowGfx }}
      >
        <color attach="background" args={['#0d1117']} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#cfe3ff', '#1a1f26', 0.6]} />
        <directionalLight position={[40, 70, 50]} intensity={1.4} castShadow={!props.lowGfx} />
        <directionalLight position={[-30, 20, -40]} intensity={0.35} />
        <Rig {...props} />
        <OrbitControls target={[0, H / 2, 0]} enablePan={false} minDistance={30} maxDistance={140} enableDamping />
      </Canvas>
      {!ready && <div className="scene-loading">Loading 3D view...</div>}
    </div>
  );
}
