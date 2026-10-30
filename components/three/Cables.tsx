'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Resolved } from '@/lib/catalog';
import type { CableKey } from '@/lib/assembly';
import { sfx } from '@/lib/sound';
import { useEngine } from './engine';
import type { Layout, V3 } from './layout';
import { braidNormal, pinGrid } from './textures';

type Spec = { path: V3[]; strands: number; radius: number; colors: string[]; sleeved: boolean; plug?: { size: V3; cols: number; rows: number } };

// Routes in world space. Board points are converted with the board origin (cables only exist once the board is in the case).
function routes(l: Layout, r: Resolved): Record<CableKey, Spec> {
  const [bx, by, bz] = l.board;
  const W = (du: number, dv: number, dx = 0): V3 => [bx + dx, by - dv, bz + du];
  const { psu, bw, bh, pcieDv, gpuLen, D, H, x0, rear, top } = l;
  const gpuSock: V3 = [x0 + 12.0, top - pcieDv + 0.2, rear - 1.4 + gpuLen * 0.62];
  const atx = W(bw - 0.85, 11.5, 0.75);
  const eps = W(2.9, 0.75, 0.55);
  const front = W(bw - 3.7, bh - 0.9, 0.4);
  return {
    atx24: {
      path: [[psu[0] - 3.5, psu[1] + 1.4, psu[2] + 7.4], [psu[0] - 3, psu[1] + 2, psu[2] + 10], [x0 - 1.4, 12, rear + bw + 2.6], [x0 - 1.4, atx[1] - 1, rear + bw + 2.6],
        [x0 + 1.6, atx[1], rear + bw + 2.1], [atx[0] + 3.2, atx[1], atx[2] + 0.4], [atx[0] + 1.25, atx[1], atx[2]]],
      strands: 4, radius: 0.27, colors: ['#111214'], sleeved: true, plug: { size: [1.6, 5.4, 1.1], cols: 2, rows: 12 },
    },
    eps8: {
      path: [[psu[0] + 2.2, psu[1] - 1.4, psu[2] + 7.4], [psu[0] + 2, psu[1] + 3, psu[2] + 10], [x0 - 1.6, 13, rear + 1.4], [x0 - 1.6, top + 0.6, rear + 2.4],
        [x0 + 1.4, top + 1.0, eps[2]], [eps[0] + 2.4, eps[1], eps[2]], [eps[0] + 1.1, eps[1], eps[2]]],
      strands: 2, radius: 0.27, colors: ['#111214'], sleeved: true, plug: { size: [1.1, 1.0, 2.2], cols: 4, rows: 2 },
    },
    pcie: {
      path: [[psu[0] + 5.6, psu[1] - 1.4, psu[2] + 7.4], [psu[0] + 7, 10.2, psu[2] + 9], [gpuSock[0] + 2.6, gpuSock[1] - 9, gpuSock[2] - 1],
        [gpuSock[0] + 2.4, gpuSock[1] + 0.2, gpuSock[2]], [gpuSock[0] + 0.9, gpuSock[1] + 0.2, gpuSock[2]]],
      strands: r.gpu?.power.includes('12V') ? 2 : 3, radius: r.gpu?.power.includes('12V') ? 0.22 : 0.27, colors: ['#111214'], sleeved: true,
      plug: { size: [1.0, 1.0, r.gpu?.power.includes('12V') ? 2.0 : 2.6], cols: r.gpu?.power.includes('12V') ? 6 : 4, rows: 2 },
    },
    front: {
      path: [[front[0] + 0.9, front[1], front[2]], [front[0] + 1.6, front[1] - 1.2, front[2] + 1.5], [x0 + 3, 12.4, rear + bw + 3.6], [0, 11.2, D / 2 - 3.2], [0, 3.2, D / 2 - 1.6]],
      strands: 5, radius: 0.07, colors: ['#e23b3b', '#f2f2f2', '#2e7de0', '#3fbf5f', '#f2c230'], sleeved: false,
    },
    fans: {
      path: [[0.6, H * 0.38, D / 2 - 3.6], [x0 + 4, H * 0.36, D / 2 - 6], [x0 + 1.4, W(bw - 6, bh - 0.7)[1] - 1.5, W(bw - 6, bh)[2]], [x0 + 0.9, W(bw - 6, bh - 0.7)[1], W(bw - 6, bh)[2]]],
      strands: 1, radius: 0.12, colors: ['#1a1a1c'], sleeved: false,
    },
  };
}

function Cable({ spec, active, animKey }: { spec: Spec; active: boolean; animKey?: string }) {
  const engine = useEngine();
  const curve = useMemo(() => new THREE.CatmullRomCurve3(spec.path.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.35), [spec.path]);
  const geos = useMemo(() => {
    const frames = curve.computeFrenetFrames(160, false);
    return Array.from({ length: spec.strands }, (_, i) => {
      const off = (i - (spec.strands - 1) / 2) * spec.radius * 2.05;
      // Offset each strand sideways along the curve normal so bundles lie flat like real ribbons.
      const pts = Array.from({ length: 161 }, (_, k) => {
        const p = curve.getPointAt(k / 160);
        return p.add(frames.binormals[k].clone().multiplyScalar(off));
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, spec.radius, 10, false);
    });
  }, [curve, spec.strands, spec.radius]);
  const mats = useMemo(() => spec.colors.map((c) => new THREE.MeshStandardMaterial(spec.sleeved
    ? { color: c, roughness: 0.7, normalMap: braidNormal(), normalScale: new THREE.Vector2(0.8, 0.8) }
    : { color: c, roughness: 0.45 })), [spec.colors, spec.sleeved]);
  const plugMats = useMemo(() => {
    if (!spec.plug) return null;
    const body = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.55 });
    const face = new THREE.MeshStandardMaterial({ map: pinGrid(spec.plug.cols, spec.plug.rows), roughness: 0.5 });
    return [body, face, body, body, body, body];
  }, [spec.plug]);

  const progress = useRef(active ? 0 : 1);
  const fired = useRef(false);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const plug = useRef<THREE.Mesh>(null);
  useEffect(() => { progress.current = active ? 0 : 1; fired.current = !active; }, [active, animKey]);

  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, progress.current + dt / 1.6);
    const e = 1 - Math.pow(1 - progress.current, 2.2);
    meshes.current.forEach((m) => {
      if (!m) return;
      const g = m.geometry as THREE.BufferGeometry;
      g.setDrawRange(0, Math.floor((g.index?.count ?? 0) * e / 6) * 6);
    });
    if (plug.current) {
      const end = curve.getPointAt(Math.max(0.001, e));
      const tan = curve.getTangentAt(Math.max(0.001, e));
      plug.current.position.copy(end).addScaledVector(tan, -0.3);
    }
    if (!fired.current && progress.current >= 1) { fired.current = true; if (engine.sound) sfx.plug(); }
    // The cable being routed pulses so it stands out against a dark board.
    for (const m of mats) {
      if (active) { m.emissive.set('#2f9bff'); m.emissiveIntensity = 0.35 + Math.sin(engine.time * 4.5) * 0.25; } else m.emissiveIntensity = 0;
    }
  });

  const plugPos = spec.path[spec.path.length - 1];
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; }} geometry={g} material={mats[i % mats.length]} castShadow />
      ))}
      {spec.plug && plugMats && (
        <mesh ref={plug} position={plugPos} material={plugMats} castShadow>
          <boxGeometry args={spec.plug.size} />
        </mesh>
      )}
      {active && <CableGlow curve={curve} />}
    </group>
  );
}

/** A pulse of light travelling along the cable path toward the socket while it is being routed. */
function CableGlow({ curve }: { curve: THREE.Curve<THREE.Vector3> }) {
  const engine = useEngine();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = (engine.time * 0.45) % 1;
    ref.current.position.copy(curve.getPointAt(t));
    const s = 0.8 + Math.sin(engine.time * 8) * 0.15;
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.55, 16, 16]} />
      <meshBasicMaterial color={[0.6, 1.6, 3.2]} toneMapped={false} />
    </mesh>
  );
}

export function Cables({ l, r, cables, activeCables, animKey }: { l: Layout; r: Resolved; cables: CableKey[]; activeCables: CableKey[]; animKey?: string }) {
  const specs = useMemo(() => routes(l, r), [l, r]);
  const keys = [...new Set([...cables, ...activeCables])].filter((k) => k !== 'pcie' || r.gpu);
  return (
    <group>
      {keys.map((k) => <Cable key={k} spec={specs[k]} active={activeCables.includes(k)} animKey={animKey} />)}
    </group>
  );
}
