'use client';

import { useFrame, type ThreeElements } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useEngine, useStd } from './engine';
import { rgbMaterial } from './shaders';
import { labelTexture } from './textures';

const geoCache = new Map<string, { blades: THREE.BufferGeometry; frame: THREE.BufferGeometry }>();

// Fan geometry, authored in fan space: axis along +z (air flows toward +z), centred at origin.
function fanGeometry(size: number, blades: number) {
  const key = `${size}:${blades}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const r0 = size * 0.165;
  const r1 = size * 0.455;
  const span = (Math.PI * 2) / blades;
  // One blade outline in polar terms: narrow at the hub, wide and swept forward at the tip.
  const shape = new THREE.Shape();
  const steps = 18;
  const edge = (t: number, lead: boolean) => {
    const r = r0 + (r1 - r0) * t;
    const width = span * (0.55 + 0.32 * t);
    const sweep = 0.38 * t * t;
    const a = sweep + (lead ? width / 2 : -width / 2) + (lead ? Math.sin(t * Math.PI) * 0.06 : 0);
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  };
  shape.moveTo(edge(0, false).x, edge(0, false).y);
  for (let i = 1; i <= steps; i++) { const p = edge(i / steps, false); shape.lineTo(p.x, p.y); }
  // Rounded tip.
  const tipA = edge(1, false), tipB = edge(1, true);
  const mid = tipA.clone().add(tipB).multiplyScalar(0.5).multiplyScalar(1.03);
  shape.quadraticCurveTo(mid.x, mid.y, tipB.x, tipB.y);
  for (let i = steps - 1; i >= 0; i--) { const p = edge(i / steps, true); shape.lineTo(p.x, p.y); }
  shape.closePath();
  const one = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8, steps: 1 });
  one.translate(0, 0, -0.035);
  // Twist into a helicoid: each point rises along the axis in proportion to its angle, like a real impeller.
  const pos = one.attributes.position as THREE.BufferAttribute;
  const pitch = size * 0.32;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const a = Math.atan2(y, x) - 0.19;
    pos.setZ(i, pos.getZ(i) + (a / (Math.PI * 2)) * pitch * 2.2);
  }
  one.computeVertexNormals();
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < blades; i++) parts.push(one.clone().rotateZ(i * span));
  const bladesGeo = mergeGeometries(parts)!;
  bladesGeo.computeVertexNormals();

  // Frame: rounded square with a circular throat, extruded to 2.5cm depth.
  const s = size / 2;
  const rr = size * 0.09;
  const f = new THREE.Shape();
  f.moveTo(-s + rr, -s); f.lineTo(s - rr, -s); f.quadraticCurveTo(s, -s, s, -s + rr); f.lineTo(s, s - rr); f.quadraticCurveTo(s, s, s - rr, s);
  f.lineTo(-s + rr, s); f.quadraticCurveTo(-s, s, -s, s - rr); f.lineTo(-s, -s + rr); f.quadraticCurveTo(-s, -s, -s + rr, -s);
  const hole = new THREE.Path(); hole.absarc(0, 0, size * 0.475, 0, Math.PI * 2, true);
  f.holes.push(hole);
  const depth = size * 0.2;
  const frame = new THREE.ExtrudeGeometry(f, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 48 });
  frame.translate(0, 0, -depth / 2);
  const out = { blades: bladesGeo, frame };
  geoCache.set(key, out);
  return out;
}

export type FanProps = {
  size?: number; // cm, 12 or 14
  blades?: number;
  frame?: boolean;
  bladeColor?: string;
  frameColor?: string;
  rgb?: boolean;
  speed?: number; // relative full-power speed
  spinOffset?: number;
  hubLabel?: string;
} & ThreeElements['group'];

export default function Fan({ size = 12, blades = 7, frame = true, bladeColor = '#15171a', frameColor = '#1b1d21', rgb = false, speed = 1, spinOffset = 0, hubLabel, ...group }: FanProps) {
  const engine = useEngine();
  const geo = useMemo(() => fanGeometry(size, blades), [size, blades]);
  const rotor = useRef<THREE.Group>(null);
  const bladeMat = usePhysLike(bladeColor, rgb);
  const frameMat = useStd({ color: frameColor, roughness: 0.55, metalness: 0.05 }, [frameColor]);
  const hubMat = useStd({ color: '#0e0f11', roughness: 0.4 });
  const padMat = useStd({ color: '#2a2c30', roughness: 0.9 });
  const strutMat = useStd({ color: frameColor, roughness: 0.6 }, [frameColor]);
  const ring = useMemo(() => (rgb ? rgbMaterial({ offset: spinOffset * 0.13 }) : null), [rgb, spinOffset]);
  const sticker = useMemo(() => hubLabel ? new THREE.MeshStandardMaterial({ map: labelTexture([{ t: hubLabel, size: 64 }], { w: 256, h: 256, bg: '#101114' }), roughness: 0.6 }) : null, [hubLabel]);
  const depth = size * 0.2;

  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z -= dt * engine.power * 28 * speed;
    if (ring) { ring.uniforms.uTime.value = engine.time; ring.uniforms.uPower.value = engine.power; }
  });

  return (
    <group {...group}>
      {frame && (
        <>
          <mesh geometry={geo.frame} material={frameMat} castShadow receiveShadow />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => (
            <mesh key={`${x}${y}`} position={[x * size * 0.44, y * size * 0.44, 0]} material={padMat}>
              <boxGeometry args={[size * 0.1, size * 0.1, depth + 0.12]} />
            </mesh>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2 + Math.PI / 4]} position={[0, 0, -depth / 2 + 0.15]} material={strutMat}>
              <boxGeometry args={[size * 0.62, 0.25, 0.25]} />
            </mesh>
          ))}
        </>
      )}
      <group ref={rotor}>
        <mesh geometry={geo.blades} material={bladeMat} castShadow />
        <mesh rotation={[Math.PI / 2, 0, 0]} material={hubMat} castShadow>
          <cylinderGeometry args={[size * 0.17, size * 0.17, depth * 0.85, 40]} />
        </mesh>
        {sticker && (
          <mesh position={[0, 0, depth * 0.43 + 0.01]} material={sticker}>
            <circleGeometry args={[size * 0.15, 40]} />
          </mesh>
        )}
      </group>
      {ring && (
        <mesh material={ring} position={[0, 0, depth / 2 - 0.1]}>
          <torusGeometry args={[size * 0.478, 0.12, 8, 96]} />
        </mesh>
      )}
    </group>
  );
}

function usePhysLike(color: string, translucent: boolean) {
  return useMemo(() => new THREE.MeshPhysicalMaterial({
    color, roughness: translucent ? 0.3 : 0.55, metalness: 0, clearcoat: translucent ? 0.3 : 0.1, envMapIntensity: 0.5,
    transmission: translucent ? 0.45 : 0, thickness: 0.2, side: THREE.DoubleSide,
  }), [color, translucent]);
}
