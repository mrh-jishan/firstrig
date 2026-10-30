'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Gpu as GpuPart } from '@/lib/catalog';
import { Bx, Instances, ScrewHead } from './Board';
import Fan from './Fan';
import { seg, useEngine, useRig, useStd } from './engine';
import type { Layout, V3 } from './layout';
import { rgbMaterial } from './shaders';
import { brushedTexture, holeMeshAlpha, labelTexture, pinGrid } from './textures';

// GPU space: origin where the bracket meets the slot line. +x away from the board (toward the glass),
// -y is the fan side (fans face down in a tower), +z runs along the card toward the case front.
export function GraphicsCard({ l, part }: { l: Layout; part: GpuPart }) {
  const engine = useEngine();
  const L = l.gpuLen;
  const triple = L >= 30;
  const fanSize = triple ? 9.2 : 9.8;
  const fanCount = triple ? 3 : 2;
  const height = 12.2; // card height from the slot outward
  const thick = triple ? 5.6 : 4.6;
  const vendor = part.name.startsWith('GeForce') ? 'nv' : part.name.startsWith('Radeon') ? 'amd' : 'intel';
  const accent = vendor === 'nv' ? '#76b900' : vendor === 'amd' ? '#e0322c' : '#3a8dde';

  const fanCenters = useMemo(() => {
    const usable = L - 3;
    return Array.from({ length: fanCount }, (_, i) => 1.8 + usable * ((i + 0.5) / fanCount));
  }, [L, fanCount]);

  // Shroud plate: chamfered outline with circular fan throats. Shape X = height (x), shape Y = length (z).
  const shroudGeo = useMemo(() => {
    const s = new THREE.Shape();
    const c = 1.4;
    s.moveTo(0.6, 0); s.lineTo(height - c, 0); s.lineTo(height, c); s.lineTo(height, L - c); s.lineTo(height - c, L); s.lineTo(0.6, L); s.lineTo(0.6, 0);
    for (const z of fanCenters) { const h = new THREE.Path(); h.absarc(height / 2 + 0.3, z, fanSize * 0.49, 0, Math.PI * 2, true); s.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3, curveSegments: 48 });
    g.rotateX(Math.PI / 2); // extrude toward -y
    return g;
  }, [L, fanCenters, fanSize, height]);

  // Angular accent panels between fans.
  const accentGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(1.6, 0.9); s.lineTo(1.6, 3.6); s.lineTo(0, 4.5); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
  }, []);

  const shroudMat = useStd({ color: vendor === 'nv' ? '#2b2e33' : '#1d1f23', metalness: 0.75, roughness: 0.32, map: brushedTexture(110) }, [vendor]);
  const darkMat = useStd({ color: '#121316', metalness: 0.4, roughness: 0.5 });
  const finMat = useStd({ color: '#b9bec5', metalness: 1, roughness: 0.35 });
  const pcbMat = useStd({ color: '#121417', roughness: 0.55 });
  const copper = useStd({ color: '#c8794a', metalness: 1, roughness: 0.25 });
  const bracketMat = useStd({ color: '#b7bcc3', metalness: 1, roughness: 0.3, map: brushedTexture(210) });
  const portMat = useStd({ color: '#08090a', roughness: 0.6 });
  const fingersMat = useStd({ color: '#e2b650', metalness: 1, roughness: 0.25 });
  const backplate = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#26292e', metalness: 0.85, roughness: 0.32, map: brushedTexture(120), alphaMap: holeMeshAlpha(14), transparent: true, side: THREE.DoubleSide,
  }), []);
  const backplateSolid = useStd({ color: '#1f2226', metalness: 0.85, roughness: 0.35, map: brushedTexture(110) });
  const accentMat = useStd({ color: accent, metalness: 0.6, roughness: 0.35 }, [accent]);
  const powerMat = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.6 });
    const face = new THREE.MeshStandardMaterial({ map: pinGrid(part.power.includes('12V') ? 6 : 4, 2), roughness: 0.5 });
    return [face, body, body, body, body, body];
  }, [part.power]);
  const sideLabel = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: part.name.replace(/ \(.*\)/, '').replace(/ \d+GB/, '').toUpperCase(), size: 46, weight: 800, color: '#e8ebef' }], { w: 1024, h: 96 }),
    transparent: true, roughness: 0.4,
  }), [part.name]);
  const rgb = useMemo(() => rgbMaterial({ speed: 0.18 }), []);
  useFrame(() => { rgb.uniforms.uTime.value = engine.time; rgb.uniforms.uPower.value = engine.power; });

  // Fin stack: ~one fin every 1.8mm along the card.
  const fins = useMemo(() => {
    const out: V3[] = [];
    for (let z = 1.2; z < L - 1.4; z += 0.18) out.push([height / 2 + 0.3, -thick * 0.45, z]);
    return out;
  }, [L, height, thick]);
  const finGeo = useMemo(() => new THREE.BoxGeometry(height - 1.8, thick * 0.62, 0.035), [height, thick]);

  const pipes = useMemo(() => [2.4, 4.6, 7.2, 9.4].map((x, i) => {
    const y = -thick * 0.45;
    const zEnd = L - 0.9 - i * 0.12;
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y + 0.6, 3), new THREE.Vector3(x, y + 0.6, zEnd - 1.4), new THREE.Vector3(x, y, zEnd), new THREE.Vector3(x, y - 0.9, zEnd - 0.6),
    ]), 40, 0.32, 10);
  }), [L, thick]);

  const bracketPorts: V3[] = [[3.2, -1.2, -0.9], [6.0, -1.2, -0.9], [8.8, -1.2, -0.9], [3.2, -3.4, -0.9]];

  const pose = useRef<THREE.Group>(null);
  const screws = useRef<(THREE.Group | null)[]>([]);
  const screwSteel = useStd({ color: '#c9ccd1', metalness: 1, roughness: 0.28 });
  useRig((rc) => {
    if (pose.current) {
      const v = rc.gpu;
      pose.current.visible = v > -0.5;
      // Carried in level from the glass side, lined up over the slot, then pressed straight down.
      pose.current.position.x = v < 0.5 ? 16 + (1.6 - 16) * seg(v, 0, 0.5) : 1.6 * (1 - seg(v, 0.5, 1));
      pose.current.position.y = v < 0.5 ? (1 - seg(v, 0, 0.5)) * 4 : 0;
    }
    screws.current.forEach((g, i) => {
      if (!g) return;
      const v = Math.min(1, Math.max(0, rc.gpuScrew * 2 - i));
      g.visible = v > 0.02;
      g.position.z = -0.75 - (1 - v) * 1.5;
      g.children[0].rotation.x = (1 - v) * 14;
    });
  });

  return (
    <group ref={pose}>
      {/* Bracket screws into the case slot rail */}
      {[0, 1].map((i) => (
        <group key={i} ref={(g) => { screws.current[i] = g; }} position={[height + 0.25, -thick / 2 + 0.6 + (i ? -1.6 : 1.2), -0.75]} rotation={[0, Math.PI / 2, 0]}>
          <group><ScrewHead mat={screwSteel} r={0.38} /></group>
        </group>
      ))}
      {/* PCB + gold fingers seated in the slot */}
      <Bx p={[height / 2 + 0.2, 0, L / 2 - 0.4]} s={[height - 0.4, 0.16, L - 1.6]} m={pcbMat} />
      <Bx p={[0.45, 0, 1.4 + 4.3 + Math.min(8.9, l.bw - 6) / 2]} s={[0.8, 0.17, Math.min(8.9, l.bw - 6)]} m={fingersMat} />

      {/* Backplate on top (vented) */}
      <Bx p={[height / 2 + 0.3, 0.32, L / 2 - 0.2]} s={[height - 0.4, 0.06, L - 1.0]} m={backplateSolid} />
      <mesh position={[height / 2 + 0.3, 0.37, L * 0.72]} rotation={[-Math.PI / 2, 0, 0]} material={backplate}><planeGeometry args={[height - 1.2, L * 0.4]} /></mesh>

      {/* Cooler: fins, heatpipes, shroud, fans */}
      <Instances geo={finGeo} mat={finMat} points={fins} />
      {pipes.map((g, i) => <mesh key={i} geometry={g} material={copper} castShadow />)}
      <mesh geometry={shroudGeo} material={shroudMat} position={[0, -thick + 0.9, 0]} castShadow receiveShadow />
      {/* Side wall facing the glass, with model name and RGB strip */}
      <Bx p={[height + 0.1, -thick / 2 + 0.25, L / 2]} s={[0.25, thick - 0.5, L - 2.6]} m={darkMat} />
      <mesh position={[height + 0.24, -thick / 2 + 0.6, L * 0.42]} rotation={[0, Math.PI / 2, 0]} material={sideLabel}><planeGeometry args={[L * 0.55, 1.1]} /></mesh>
      <mesh position={[height + 0.25, -thick / 2 - 0.9, L * 0.5]} rotation={[0, Math.PI / 2, 0]} material={rgb}><planeGeometry args={[L - 5, 0.35]} /></mesh>
      {fanCenters.slice(0, -1).map((z, i) => (
        <mesh key={i} geometry={accentGeo} material={accentMat} position={[height / 2 + 0.3 - 0.8, -thick - 0.05, (z + fanCenters[i + 1]) / 2 - 2.25]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      {fanCenters.map((z, i) => (
        <Fan key={z} size={fanSize} blades={11} frame={false} position={[height / 2 + 0.3, -thick + 0.45, z]} rotation={[Math.PI / 2, 0, 0]}
          spinOffset={i} speed={i % 2 ? -1 : 1} bladeColor="#1a1b1e" />
      ))}

      {/* Power socket on the top edge */}
      <Bx p={[height - 0.2, 0.2, L * 0.62]} s={[0.9, 1.0, part.power.includes('12V') ? 2.0 : 2.6]} m={powerMat} />

      {/* I/O bracket with display outputs */}
      <Bx p={[height / 2, -thick / 2 + 0.6, -0.55]} s={[height + 0.6, thick + 0.8, 0.1]} m={bracketMat} />
      {bracketPorts.map((p, i) => <Bx key={i} p={p} s={[2.0, 0.8, 0.3]} m={portMat} />)}
      <Bx p={[height / 2, -thick / 2 + 0.6, -0.4]} s={[height - 1, thick - 0.4, 0.2]} m={darkMat} />
    </group>
  );
}
