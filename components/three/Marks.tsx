'use client';

import { Billboard, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Anchor, Mark } from '@/lib/assembly';
import type { AnchorPos } from './layout';

const TONE: Record<NonNullable<Mark['tone']>, string> = { info: '#7c5cff', warn: '#ff8a1f', ok: '#12c48b' };

/** Callouts pinned to anchors: a pulsing ring, a label chip, and an animated arrow showing which way to move. */
export function Marks({ marks, anchors, space }: { marks: Mark[]; anchors: Record<Anchor, AnchorPos>; space: 'board' | 'world' }) {
  const list = marks.filter((m) => anchors[m.at]?.space === space);
  return (
    <group>
      {list.map((m, i) => <One key={`${m.at}-${i}`} m={m} p={anchors[m.at].p} />)}
    </group>
  );
}

function One({ m, p }: { m: Mark; p: [number, number, number] }) {
  const color = TONE[m.tone ?? 'info'];
  const ring = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Group>(null);
  const glow = useMemo(() => new THREE.Color(color).multiplyScalar(2.2), [color]);
  const dir = useMemo(() => (m.arrow ? new THREE.Vector3(...m.arrow).normalize() : null), [m.arrow]);
  const quat = useMemo(() => (dir ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) : null), [dir]);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ring.current) {
      const k = (t * 1.2) % 1;
      ring.current.scale.setScalar(0.6 + k * 1.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    }
    if (arrow.current && dir) {
      const k = (t * 0.9) % 1;
      const e = k * k * (3 - 2 * k);
      arrow.current.position.copy(dir).multiplyScalar(-3.2 + e * 2.4);
      arrow.current.scale.setScalar(k > 0.85 ? (1 - k) / 0.15 : 1);
    }
  });
  return (
    <group position={p}>
      <Billboard>
        <mesh ref={ring} renderOrder={10}>
          <ringGeometry args={[0.55, 0.75, 40]} />
          <meshBasicMaterial color={glow} transparent depthTest={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={10}>
          <circleGeometry args={[0.22, 20]} />
          <meshBasicMaterial color={glow} depthTest={false} toneMapped={false} />
        </mesh>
      </Billboard>
      {dir && quat && (
        <group ref={arrow}>
          <group quaternion={quat}>
            <mesh position={[0, -0.9, 0]} renderOrder={10}>
              <cylinderGeometry args={[0.12, 0.12, 1.8, 12]} />
              <meshBasicMaterial color={glow} depthTest={false} toneMapped={false} transparent opacity={0.95} />
            </mesh>
            <mesh position={[0, 0.35, 0]} renderOrder={10}>
              <coneGeometry args={[0.38, 0.8, 20]} />
              <meshBasicMaterial color={glow} depthTest={false} toneMapped={false} transparent opacity={0.95} />
            </mesh>
          </group>
        </group>
      )}
      {(m.text || m.n) && (
        <Html center position={[0, 0, 0]} style={{ pointerEvents: 'none', transform: 'translate(0, -30px)' }} zIndexRange={[6, 0]}>
          <div className={`callout ${m.tone ?? 'info'}`}>
            {m.n !== undefined && <b>{m.n}</b>}
            {m.text && <span>{m.text}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}
