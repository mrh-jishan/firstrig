'use client';

import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Case as CasePart } from '@/lib/catalog';
import { Bx } from './Board';
import Fan from './Fan';
import { useEngine, useStd } from './engine';
import type { Layout } from './layout';
import { hexMeshAlpha, holeMeshAlpha, labelTexture } from './textures';

// World space. The glass side faces +x, the front faces +z.
export function PcCase({ l, part, lowGfx }: { l: Layout; part: CasePart; lowGfx?: boolean }) {
  const engine = useEngine();
  const { D, H, W } = l;
  const white = part.color === '#e9eaec';
  const t = 0.15;

  const steel = useStd({ color: part.color, metalness: white ? 0.15 : 0.55, roughness: white ? 0.45 : 0.5 }, [part.color]);
  const steelIn = useStd({ color: white ? '#dfe1e4' : '#1c1e22', metalness: 0.4, roughness: 0.6 }, [white]);
  const rubber = useStd({ color: '#0d0e10', roughness: 0.95 });
  const meshKind = part.id === 'pop-air' || part.id === 'a3-matx' ? 'hex' : 'holes';
  const frontMesh = useMemo(() => new THREE.MeshStandardMaterial({
    color: white ? '#f1f2f4' : '#121316', metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide, transparent: true,
    alphaMap: meshKind === 'hex' ? hexMeshAlpha(26, 3) : (() => { const a = holeMeshAlpha(14).clone(); a.repeat.set(4, 6); a.needsUpdate = true; return a; })(),
  }), [white, meshKind]);
  const topMesh = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0b0c0e', metalness: 0.3, roughness: 0.6, alphaMap: holeMeshAlpha(10), transparent: true, side: THREE.DoubleSide,
  }), []);
  const slotMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: white ? '#e4e6e9' : '#191a1d', metalness: 0.6, roughness: 0.4, alphaMap: holeMeshAlpha(8), transparent: true, side: THREE.DoubleSide,
  }), [white]);
  const badge = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: part.name.split(' ').slice(-2).join(' ').toUpperCase(), size: 40, weight: 700, color: white ? '#2a2c30' : '#c9ced4' }], { w: 512, h: 96 }),
    transparent: true, roughness: 0.5,
  }), [part.name, white]);

  // Smoked tempered glass: a light dark tint plus clearcoat reflections, so the interior stays crisp.
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0b0e12', transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.6, specularIntensity: 1, depthWrite: false, side: THREE.DoubleSide,
  }), [lowGfx]);
  const frit = useStd({ color: '#050506', roughness: 0.3 });

  const glassRef = useRef<THREE.Group>(null);
  const shroudSide = useRef<THREE.MeshStandardMaterial>(null);
  const trayMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const k = engine.explode;
    if (glassRef.current) {
      glassRef.current.position.x = k * 34;
      glassRef.current.visible = engine.xray < 0.98;
    }
    glass.opacity = 0.22 * (1 - engine.xray);
    // While cables are being routed the tray turns see-through so you can follow them behind it.
    if (trayMat.current) trayMat.current.opacity = 1 - engine.cableView * 0.75;
    if (shroudSide.current) { shroudSide.current.opacity = 1 - engine.xray; shroudSide.current.visible = engine.xray < 0.98; }
  });

  const frontFans = part.size === 'small' ? [] : part.id === 'q300l' ? [] : (part.id === 'pop-air' ? [0.3, 0.55, 0.8] : [0.38, 0.68]);
  const rgbFans = part.id === 'pop-air';
  const fanBlade = white ? '#f2f3f5' : '#141518';
  const fanFrame = white ? '#eceef1' : '#18191c';
  const shroudH = l.small ? 0 : 10.6;
  const trayX = l.x0 - 0.65;
  const ioTop = l.top;
  const slotCount = l.small ? 3 : 7;

  return (
    <group>
      {/* Chassis shell */}
      <Bx p={[-W / 2, H / 2, 0]} s={[t, H, D]} m={steel} />
      <Bx p={[0, t / 2 + 1.2, 0]} s={[W, t, D]} m={steelIn} />
      <Bx p={[0, H - t / 2, 0]} s={[W, t, D]} m={steel} />
      <Bx p={[0, H / 2, -D / 2]} s={[W, H, t]} m={steelIn} />
      {/* Exterior skin bottom + feet */}
      <Bx p={[0, 1.15, 0]} s={[W, 0.12, D]} m={steel} />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => (
        <RoundedBox key={`${x}${z}`} args={[3, 1.2, 3.6]} radius={0.3} position={[x * (W / 2 - 2.2), 0.6, z * (D / 2 - 3)]} material={rubber} castShadow />
      ))}
      {/* Motherboard tray with grommets */}
      <mesh position={[trayX, H / 2 + 0.6, 0]} receiveShadow>
        <boxGeometry args={[0.12, H - 2.4, D - 1]} />
        <meshStandardMaterial ref={trayMat} color={white ? '#dfe1e4' : '#1c1e22'} metalness={0.4} roughness={0.6} transparent />
      </mesh>
      {[0.25, 0.5, 0.75].map((f) => (
        <RoundedBox key={f} args={[0.4, 4.2, 1.6]} radius={0.2} position={[trayX + 0.15, l.top - l.bh * f, l.rear + l.bw + 2.2]} material={rubber} />
      ))}
      <RoundedBox args={[0.4, 1.5, 5]} radius={0.2} position={[trayX + 0.15, l.top + 1.4, l.rear + 3.5]} material={rubber} />
      {/* Top dust filter */}
      <mesh position={[0, H + 0.02, 1]} rotation={[-Math.PI / 2, 0, 0]} material={topMesh}><planeGeometry args={[W - 3, D - 8]} /></mesh>
      {/* Front panel: frame + perforated face */}
      <group position={[0, 0, D / 2]}>
        <Bx p={[-W / 2 + 0.6, H / 2, 0]} s={[1.2, H, 1.4]} m={steel} />
        <Bx p={[W / 2 - 0.6, H / 2, 0]} s={[1.2, H, 1.4]} m={steel} />
        <Bx p={[0, H - 0.6, 0]} s={[W, 1.2, 1.4]} m={steel} />
        <Bx p={[0, 1.8, 0]} s={[W, 1.4, 1.4]} m={steel} />
        <mesh position={[0, H / 2 + 0.6, 0.55]} material={frontMesh}><planeGeometry args={[W - 2.4, H - 3.4]} /></mesh>
        <mesh position={[0, 1.8, 0.71]} material={badge}><planeGeometry args={[9, 1.6]} /></mesh>
      </group>
      {frontFans.map((f, i) => (
        <Fan key={f} size={12} position={[0.6, H * f, D / 2 - 2.4]} rgb={rgbFans} spinOffset={i} bladeColor={fanBlade} frameColor={fanFrame} />
      ))}
      {/* Rear: exhaust fan, I/O opening, slot covers */}
      <Fan size={12} position={[l.x0 + 7.5, ioTop - 6.8, -D / 2 + 1.4]} rotation={[0, Math.PI, 0]} rgb={rgbFans} spinOffset={4} bladeColor={fanBlade} frameColor={fanFrame} />
      {Array.from({ length: slotCount }, (_, i) => (
        <mesh key={i} position={[l.x0 + 6.4, l.top - l.pcieDv - 1.4 - i * 2.03, -D / 2 - 0.09]} rotation={[0, Math.PI, 0]} material={slotMat}>
          <planeGeometry args={[11.2, 1.6]} />
        </mesh>
      ))}
      {/* PSU shroud */}
      {shroudH > 0 && (
        <group>
          <Bx p={[0, shroudH, -2.5]} s={[W - 0.3, 0.15, D - 5.5]} m={steelIn} />
          <mesh position={[W / 2 - 0.25, (shroudH + 1.2) / 2, -2.5]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[D - 5.5, shroudH - 1.2]} />
            <meshStandardMaterial ref={shroudSide} color={part.color} metalness={white ? 0.15 : 0.55} roughness={0.5} transparent side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {/* Tempered glass side panel with black frit border */}
      <group ref={glassRef}>
        <mesh position={[W / 2 + 0.3, H / 2 + 0.6, 0]} rotation={[0, Math.PI / 2, 0]} material={glass} renderOrder={2}>
          <planeGeometry args={[D - 0.4, H - 1.2]} />
        </mesh>
        <Bx p={[W / 2 + 0.32, H - 0.9, 0]} s={[0.02, 1.2, D - 0.4]} m={frit} shadow={false} />
        <Bx p={[W / 2 + 0.32, 1.8, 0]} s={[0.02, 1.2, D - 0.4]} m={frit} shadow={false} />
        <Bx p={[W / 2 + 0.32, H / 2 + 0.6, D / 2 - 0.8]} s={[0.02, H - 1.2, 1.2]} m={frit} shadow={false} />
        <Bx p={[W / 2 + 0.32, H / 2 + 0.6, -D / 2 + 0.8]} s={[0.02, H - 1.2, 1.2]} m={frit} shadow={false} />
      </group>
    </group>
  );
}

/** Motherboard retail box, used as the workbench while the board is built outside the case. */
export function BoardBox({ w, d, name }: { w: number; d: number; name: string }) {
  const side = useMemo(() => new THREE.MeshStandardMaterial({
    map: labelTexture([{ t: name.replace(/\(.*\)/, '').trim().toUpperCase(), size: 44, weight: 800 }, { t: 'MOTHERBOARD', size: 26, color: '#9aa3ad', weight: 600 }], { w: 1024, h: 192, bg: '#15171b' }),
    roughness: 0.75,
  }), [name]);
  const plain = useStd({ color: '#15171b', roughness: 0.75 });
  const mats = useMemo(() => [plain, plain, plain, plain, side, plain], [plain, side]);
  return (
    <mesh position={[0, 3, 0]} material={mats} castShadow receiveShadow>
      <boxGeometry args={[w, 6, d]} />
    </mesh>
  );
}
