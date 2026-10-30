'use client';

import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Cooler as CoolerPart } from '@/lib/catalog';
import { Bx, Instances } from './Board';
import Fan from './Fan';
import { useEngine, useStd, usePhys } from './engine';
import type { Layout, V3 } from './layout';
import { infinityMirrorMaterial } from './shaders';
import { braidNormal, brushedTexture, finStripes, labelTexture } from './textures';

// Socket space: origin at the CPU socket centre on the board surface, +x out of the board, +z toward the front.
export function CpuCooler({ l, part }: { l: Layout; part: CoolerPart }) {
  const at = l.P(l.sock.du, l.sock.dv, 0);
  return (
    <group position={at}>
      {part.kind === 'stock' && <StockCooler />}
      {part.kind === 'air' && <TowerCooler part={part} />}
      {part.kind === 'aio' && <Aio l={l} part={part} />}
    </group>
  );
}

function StockCooler() {
  const alu = useStd({ color: '#a7adb5', metalness: 1, roughness: 0.32 });
  const shroud = useStd({ color: '#141517', roughness: 0.55 });
  const copper = useStd({ color: '#c47a4c', metalness: 1, roughness: 0.3 });
  const { points, rots } = useMemo(() => {
    const p: V3[] = [], r: V3[] = [];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      p.push([2.2, Math.cos(a) * 3.1, Math.sin(a) * 3.1]);
      r.push([a + 0.35, 0, 0]);
    }
    return { points: p, rots: r };
  }, []);
  const fin = useMemo(() => new THREE.BoxGeometry(2.4, 2.6, 0.07), []);
  return (
    <group>
      <mesh position={[1.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={copper}><cylinderGeometry args={[1.6, 1.6, 0.5, 40]} /></mesh>
      <mesh position={[2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={alu}><cylinderGeometry args={[1.6, 1.6, 2.4, 40]} /></mesh>
      <Instances geo={fin} mat={alu} points={points} rots={rots} />
      <mesh position={[3.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={shroud} castShadow>
        <cylinderGeometry args={[4.9, 4.9, 1.0, 64, 1, true]} />
      </mesh>
      <Fan size={8.6} blades={7} frame={false} position={[3.9, 0, 0]} rotation={[0, Math.PI / 2, 0]} bladeColor="#18191c" hubLabel="" />
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([y, z]) => (
        <mesh key={`${y}${z}`} position={[2.3, y * 3.7, z * 3.7]} rotation={[0, 0, Math.PI / 2]} material={alu}><cylinderGeometry args={[0.28, 0.28, 3.6, 12]} /></mesh>
      ))}
    </group>
  );
}

function TowerCooler({ part }: { part: CoolerPart }) {
  const H = part.heightMm / 10;
  const dual = part.id === 'pa120' || part.id === 'nhd15g2';
  const noctua = part.id === 'nhd15g2';
  const fanSize = noctua ? 14 : 12;
  const finH = noctua ? 15 : 12.5;
  const depth = noctua ? 5.2 : dual ? 4.6 : 5.2;
  const towers = dual ? [-(depth / 2 + 1.2), depth / 2 + 1.2] : [0];
  const xStart = 3.4;
  const xEnd = H - 0.35;

  const nickel = useStd({ color: '#d4d7db', metalness: 1, roughness: 0.18 });
  const fins = usePhys({ color: noctua ? '#c9ccd0' : '#babec4', metalness: 1, roughness: 0.3, clearcoat: 0.15 });
  const cover = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#16171a', metalness: 0.6, roughness: 0.35,
    map: labelTexture([{ t: part.name.split(' ')[0].toUpperCase(), size: 52, color: '#c9ced4', weight: 800 }], { w: 512, h: 512, bg: '#18191c' }),
  }), [part.name]);

  const finPoints = useMemo(() => {
    const out: V3[] = [];
    for (const z of towers) for (let x = xStart; x <= xEnd; x += noctua ? 0.19 : 0.21) out.push([x, 0, z]);
    return out;
  }, [towers, xEnd, noctua]);
  const finGeo = useMemo(() => {
    // Fins have a shallow wave on their leading edge, like real stacks.
    const s = new THREE.Shape();
    const h = finH / 2, d = depth / 2;
    s.moveTo(-h, -d);
    for (let i = 0; i <= 10; i++) s.lineTo(-h + (finH * i) / 10, -d + (i % 2 ? 0.25 : 0));
    s.lineTo(h, d);
    for (let i = 10; i >= 0; i--) s.lineTo(-h + (finH * i) / 10, d - (i % 2 ? 0.25 : 0));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
    g.rotateY(Math.PI / 2); // shape plane -> y/z plane, thickness along x
    g.rotateX(Math.PI / 2);
    return g;
  }, [finH, depth]);

  const pipes = useMemo(() => {
    const n = dual ? 6 : 4;
    const out: THREE.TubeGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const yTop = t * (finH - 3);
      const yBase = t * 3.2;
      const zA = dual ? towers[0] + (i % 2 ? 0.8 : -0.8) : -1.5;
      const zB = dual ? towers[1] + (i % 2 ? -0.8 : 0.8) : 1.5;
      const pts = [
        [xEnd + 0.2, yTop, zA], [xStart + 1, yTop, zA], [2.2, yBase, zA * 0.45], [1.55, yBase, 0],
        [2.2, yBase, zB * 0.45], [xStart + 1, yTop, zB], [xEnd + 0.2, yTop, zB],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
      out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 80, 0.3, 12));
    }
    return out;
  }, [dual, finH, towers, xEnd]);
  const capGeo = useMemo(() => new THREE.SphereGeometry(0.31, 12, 8), []);
  const capPoints = useMemo(() => {
    const n = dual ? 6 : 4;
    const out: V3[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const zA = dual ? towers[0] + (i % 2 ? 0.8 : -0.8) : -1.5;
      const zB = dual ? towers[1] + (i % 2 ? -0.8 : 0.8) : 1.5;
      out.push([xEnd + 0.2, t * (finH - 3), zA], [xEnd + 0.2, t * (finH - 3), zB]);
    }
    return out;
  }, [dual, finH, towers, xEnd]);

  const fanX = (xStart + xEnd) / 2 + 0.2;
  const frontZ = towers[towers.length - 1] + depth / 2 + fanSize * 0.1 + 0.15;
  const fanColors = noctua ? { blade: '#8b5e45', frame: '#d6c3a5' } : { blade: '#141518', frame: '#1a1b1e' };

  return (
    <group>
      <Bx p={[1.1, 0, 0]} s={[0.6, 4.0, 4.0]} m={nickel} />
      <RoundedBox args={[0.9, 4.6, 5.2]} radius={0.12} position={[1.8, 0, 0]} material={nickel} castShadow />
      {pipes.map((g, i) => <mesh key={i} geometry={g} material={nickel} castShadow />)}
      <Instances geo={finGeo} mat={fins} points={finPoints} />
      <Instances geo={capGeo} mat={nickel} points={capPoints} />
      {!noctua && towers.map((z) => (
        <RoundedBox key={z} args={[0.3, finH + 0.2, depth + 0.1]} radius={0.1} position={[xEnd + 0.4, 0, z]} material={cover} castShadow />
      ))}
      <Fan size={fanSize} position={[fanX, 0, frontZ]} bladeColor={fanColors.blade} frameColor={fanColors.frame} />
      {dual && <Fan size={fanSize} position={[fanX, 0, 0]} bladeColor={fanColors.blade} frameColor={fanColors.frame} spinOffset={1} />}
    </group>
  );
}

function Aio({ l, part }: { l: Layout; part: CoolerPart }) {
  const engine = useEngine();
  const block = useStd({ color: '#17181b', metalness: 0.5, roughness: 0.4, map: brushedTexture(80) });
  const mirror = useMemo(() => infinityMirrorMaterial(), []);
  useFrame(() => { mirror.uniforms.uTime.value = engine.time; mirror.uniforms.uPower.value = engine.power; });
  const sleeve = useStd({ color: '#121315', roughness: 0.75, normalMap: braidNormal(), normalScale: new THREE.Vector2(0.9, 0.9) });
  const finCore = useStd({ map: finStripes(5), metalness: 0.7, roughness: 0.5 });
  const tank = useStd({ color: '#1b1c1f', metalness: 0.5, roughness: 0.45 });

  // Radiator lives under the top panel; convert its world position into socket space.
  const radLen = part.radMm / 10 + 3.4;
  const sock = l.P(l.sock.du, l.sock.dv, 0);
  const w: V3 = [l.x0 + 10.6, l.H - 0.9 - 1.4, l.rear + 2 + radLen / 2];
  const b = l.toBoard(w);
  const rad: V3 = [b[0] - sock[0], b[1] - sock[1], b[2] - sock[2]];
  const tubes = useMemo(() => [-0.9, 0.9].map((dz) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.6, 3.1, dz), new THREE.Vector3(5, 7, dz * 2), new THREE.Vector3(rad[0] - 2, rad[1] - 3, rad[2] - radLen / 2 + 1 + dz),
    new THREE.Vector3(rad[0] - 1, rad[1] - 0.4, rad[2] - radLen / 2 + 0.8 + dz * 0.6),
  ]), 64, 0.55, 12)), [rad, radLen]);

  return (
    <group>
      <RoundedBox args={[3.8, 6.4, 6.4]} radius={0.6} smoothness={4} position={[2.75, 0, 0]} material={block} castShadow />
      <mesh position={[4.66, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mirror}><circleGeometry args={[2.6, 64]} /></mesh>
      {tubes.map((g, i) => <mesh key={i} geometry={g} material={sleeve} castShadow />)}
      <group position={rad}>
        <Bx p={[0, 0, 0]} s={[12, 2.7, radLen - 3.4]} m={finCore} />
        <Bx p={[0, 0, -(radLen - 1.7) / 2]} s={[12.4, 3.0, 1.7]} m={tank} />
        <Bx p={[0, 0, (radLen - 1.7) / 2]} s={[12.4, 3.0, 1.7]} m={tank} />
        {[-1, 1].map((k) => (
          <Fan key={k} size={12} position={[0, -2.75, k * 6.1]} rotation={[-Math.PI / 2, 0, 0]} spinOffset={k} />
        ))}
      </group>
    </group>
  );
}
