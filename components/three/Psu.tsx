'use client';

import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Psu as PsuPart } from '@/lib/catalog';
import { Bx } from './Board';
import Fan from './Fan';
import { useStd } from './engine';
import { brushedTexture, hexMeshAlpha, labelTexture, pinGrid } from './textures';

// PSU space: centred on the unit. 15 wide (x), 8.6 tall (y), 14 deep (z). Fan faces down, sockets face +z.
export function PowerSupply({ part }: { part: PsuPart }) {
  const modular = part.id !== 'a650bn';
  const shell = useStd({ color: '#141518', metalness: 0.45, roughness: 0.7 });
  const grille = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0c0d0f', metalness: 0.7, roughness: 0.4, alphaMap: hexMeshAlpha(18, 2), transparent: true, side: THREE.DoubleSide,
  }), []);
  const accent = useStd({ color: '#2a2d33', metalness: 0.9, roughness: 0.3, map: brushedTexture(140) });
  const label = useMemo(() => {
    const [brand, ...rest] = part.name.split(' ');
    return new THREE.MeshStandardMaterial({
      map: labelTexture([
        { t: brand.toUpperCase(), size: 54, weight: 800 },
        { t: rest.join(' ').replace(/\d+W.*/, '').trim(), size: 36, color: '#cfd4da', weight: 600 },
        { t: `${part.watts}W`, size: 72, weight: 800, color: '#ffffff' },
        { t: part.rating.toUpperCase(), size: 30, color: part.rating.includes('Gold') ? '#e8c46a' : '#c98f5a' },
      ], { w: 768, h: 512, bg: '#18191c' }),
      roughness: 0.6,
    });
  }, [part.name, part.watts, part.rating]);
  const sockets = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.6 });
    const face8 = new THREE.MeshStandardMaterial({ map: pinGrid(4, 2), roughness: 0.5 });
    const face24 = new THREE.MeshStandardMaterial({ map: pinGrid(9, 2), roughness: 0.5 });
    return { s8: [body, body, body, body, face8, body], s24: [body, body, body, body, face24, body] };
  }, []);
  const iec = useStd({ color: '#0a0a0b', roughness: 0.5 });
  const rocker = useStd({ color: '#1d1e21', roughness: 0.4 });

  return (
    <group>
      <RoundedBox args={[15, 8.6, 14]} radius={0.35} smoothness={3} material={shell} castShadow receiveShadow />
      {/* Fan + grille underneath */}
      <Fan size={12} position={[0, -3.3, 0]} rotation={[Math.PI / 2, 0, 0]} frame={false} />
      <mesh position={[0, -4.32, 0]} rotation={[Math.PI / 2, 0, 0]} material={grille}><circleGeometry args={[6.3, 64]} /></mesh>
      {/* Side label and accent */}
      <mesh position={[7.52, 0.4, 0]} rotation={[0, Math.PI / 2, 0]} material={label}><planeGeometry args={[11, 7.2]} /></mesh>
      <Bx p={[7.51, -3.7, 0]} s={[0.04, 0.5, 13.4]} m={accent} />
      {/* Rear: honeycomb, mains socket and rocker switch */}
      <mesh position={[-2, 0, -7.02]} rotation={[0, Math.PI, 0]} material={grille}><planeGeometry args={[9, 7.4]} /></mesh>
      <Bx p={[5, 1.2, -7.05]} s={[2.6, 1.8, 0.2]} m={iec} />
      <Bx p={[5, -1.6, -7.08]} s={[1.0, 1.4, 0.25]} m={rocker} />
      {/* Front: modular sockets or a fixed cable exit */}
      {modular ? (
        <>
          <Bx p={[-3.5, 1.4, 7.05]} s={[5.8, 1.4, 0.3]} m={sockets.s24} />
          {[-1.2, 2.2, 5.6].map((x) => <Bx key={x} p={[x, -1.4, 7.05]} s={[2.4, 1.2, 0.3]} m={sockets.s8} />)}
        </>
      ) : (
        <mesh position={[4, 0.5, 7.2]} rotation={[Math.PI / 2, 0, 0]} material={iec}><cylinderGeometry args={[1.4, 1.6, 0.6, 24]} /></mesh>
      )}
    </group>
  );
}
