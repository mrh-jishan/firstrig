'use client';

import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { SceneKey } from '@/lib/assembly';
import { sfx } from '@/lib/sound';
import { ghostMaterial } from './shaders';
import type { V3 } from './layout';

export type PartStatus = 'error' | 'warn' | 'focus';
export const STATUS_COLOR: Record<PartStatus | 'hover', string> = { error: '#ff3030', warn: '#ffae00', focus: '#2f9bff', hover: '#9cc9ff' };

/** Mutable per-frame engine state. Targets are set by UI; current values ease toward them every frame. */
export type Engine = {
  power: number; powerTarget: number;
  explode: number; explodeTarget: number;
  xray: number; xrayTarget: number;
  cableView: number; cableViewTarget: number;
  time: number;
  sound: boolean;
  objects: Map<SceneKey, THREE.Object3D>;
};

export function createEngine(): Engine {
  return { power: 0, powerTarget: 0, explode: 0, explodeTarget: 0, xray: 0, xrayTarget: 0, cableView: 0, cableViewTarget: 0, time: 0, sound: true, objects: new Map() };
}

const EngineCtx = createContext<Engine>(createEngine());
export const EngineProvider = ({ engine, children }: { engine: Engine; children: ReactNode }) => <EngineCtx.Provider value={engine}>{children}</EngineCtx.Provider>;
export const useEngine = () => useContext(EngineCtx);

export function EngineTicker() {
  const e = useEngine();
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2.2);
    e.time += dt;
    e.power += (e.powerTarget - e.power) * (e.powerTarget > e.power ? 1 - Math.exp(-dt * 0.9) : k * 1.5);
    e.explode += (e.explodeTarget - e.explode) * (1 - Math.exp(-dt * 3.2));
    e.xray += (e.xrayTarget - e.xray) * k * 2;
    e.cableView += (e.cableViewTarget - e.cableView) * k * 2;
  });
  return null;
}

/* ------------------------------------------------------------------ keyframe clips */

type SoundName = keyof typeof sfx;
type ClipSpec = { pos: [number, ...V3][]; rot?: [number, ...V3][]; sounds: [number, SoundName][] };

// Hand-keyed install motions, authored in the part's parent space (+x is "toward the viewer").
// Each clip ends at rest (0,0,0) so the final keyframe is the installed pose.
const CLIPS: Partial<Record<SceneKey, ClipSpec>> = {
  cpu: {
    pos: [[0, 8, 3, 0], [0.7, 2.6, 0, 0], [1.15, 0.7, 0, 0], [1.5, 0, 0, 0]],
    rot: [[0, 0, 0.5, 0.35], [0.7, 0, 0, 0], [1.5, 0, 0, 0]],
    sounds: [[0.02, 'whoosh'], [1.5, 'thunk'], [1.85, 'snap']],
  },
  storage: {
    pos: [[0, 5, 2, 9], [0.8, 0.2, 0, 1.4], [1.25, 0, 0, 0], [1.7, 0, 0, 0]],
    rot: [[0, 0, 0.9, 0], [0.8, 0, 0.5, 0], [1.25, 0, 0.5, 0], [1.7, 0, 0, 0]],
    sounds: [[0.02, 'whoosh'], [1.25, 'plug'], [1.95, 'screw']],
  },
  ram: {
    pos: [[0, 11, 6, 0], [0.75, 4.2, 0, 0], [1.25, 1.1, 0, 0], [1.4, 1.1, 0, 0], [1.6, 0, 0, 0]],
    rot: [[0, 0.5, 0, 0], [0.75, 0, 0, 0], [1.6, 0, 0, 0]],
    sounds: [[0.02, 'whoosh'], [1.6, 'snap'], [1.72, 'snap']],
  },
  cooler: {
    pos: [[0, 18, 5, 0], [0.9, 3.4, 0, 0], [1.4, 0, 0, 0]],
    rot: [[0, 0.35, 0, 0.25], [0.9, 0, 0, 0], [1.4, 0, 0, 0]],
    sounds: [[0.02, 'whoosh'], [1.4, 'thunk'], [1.7, 'screw'], [2.15, 'screw']],
  },
  gpu: {
    pos: [[0, 14, 9, 3], [0.85, 4, 0, 0], [1.35, 0.6, 0, 0], [1.65, 0, 0, 0]],
    rot: [[0, 0, 0, 0.35], [0.85, 0, 0, 0], [1.65, 0, 0, 0]],
    sounds: [[0.02, 'whoosh'], [1.65, 'snap'], [2.05, 'screw']],
  },
  board: {
    pos: [[0, 20, 6, 0], [1.0, 4, 0, 0], [1.5, 0, 0, 0]],
    rot: [[0, 0, -0.45, 0], [1.0, 0, 0, 0], [1.5, 0, 0, 0]],
    sounds: [[0.02, 'whoosh'], [1.5, 'thunk'], [1.8, 'screw'], [2.2, 'screw']],
  },
  psu: {
    pos: [[0, 0, 3, 30], [1.0, 0, 0, 4], [1.45, 0, 0, 0]],
    sounds: [[0.02, 'whoosh'], [1.45, 'thunk'], [1.8, 'screw']],
  },
};

function buildClip(spec: ClipSpec) {
  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('.position', spec.pos.map((k) => k[0]), spec.pos.flatMap((k) => [k[1], k[2], k[3]]), THREE.InterpolateSmooth),
  ];
  if (spec.rot) {
    const q = new THREE.Quaternion();
    tracks.push(new THREE.QuaternionKeyframeTrack('.quaternion', spec.rot.map((k) => k[0]),
      spec.rot.flatMap((k) => q.setFromEuler(new THREE.Euler(k[1], k[2], k[3])).toArray())));
  }
  return new THREE.AnimationClip('install', -1, tracks);
}

/* ------------------------------------------------------------------ mount */

type MountProps = {
  name: SceneKey;
  pivot: V3; // point the part rotates around while animating, in parent space
  explode?: V3; // offset when the exploded view is on
  active?: boolean;
  animKey?: string;
  status?: PartStatus;
  hovered?: boolean;
  label?: string;
  labelAt?: V3; // parent space
  showLabel?: boolean;
  glowScale?: number; // large shells (the case) glow faintly so the parts inside stay readable
  onPick?: (k: SceneKey) => void;
  onHover?: (k: SceneKey | null) => void;
  children: ReactNode;
};

/**
 * Wraps one part: owns its keyframe install animation, exploded-view offset, holographic placement
 * ghost and emissive status glow. Children are authored in parent space; the wrapper re-centres them
 * on `pivot` so rotations look natural.
 */
export function Mount(p: MountProps) {
  const engine = useEngine();
  const explodeRef = useRef<THREE.Group>(null);
  const animRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const ghostRef = useRef<THREE.Mesh>(null);
  const ghostMat = useMemo(() => ghostMaterial(), []);
  const [ghostBox, setGhostBox] = useState<{ c: THREE.Vector3; s: THREE.Vector3 } | null>(null);
  const mixer = useRef<{ m: THREE.AnimationMixer; a: THREE.AnimationAction; fired: Set<number>; spec: ClipSpec } | null>(null);
  const mats = useRef<{ m: THREE.MeshStandardMaterial; e: THREE.Color; i: number }[]>([]);

  useEffect(() => {
    if (contentRef.current) engine.objects.set(p.name, contentRef.current);
    return () => { engine.objects.delete(p.name); };
  }, [engine, p.name]);

  // Gather the part's own standard materials once so the glow can be applied and restored.
  useEffect(() => {
    const list: typeof mats.current = [];
    const seen = new Set<THREE.Material>();
    contentRef.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && !Array.isArray(m) && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial && !seen.has(m)) {
        seen.add(m);
        list.push({ m, e: (m.userData.baseEmissive ??= m.emissive.clone()), i: (m.userData.baseIntensity ??= m.emissiveIntensity) });
      }
    });
    mats.current = list;
  });

  // Measure the installed pose for the ghost before the animation moves anything.
  useLayoutEffect(() => {
    if (!p.active || !contentRef.current || !animRef.current) { setGhostBox(null); return; }
    animRef.current.position.set(0, 0, 0);
    animRef.current.quaternion.identity();
    const pivotGroup = explodeRef.current!.parent!;
    pivotGroup.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(contentRef.current);
    const inv = pivotGroup.matrixWorld.clone().invert();
    const c = box.getCenter(new THREE.Vector3()).applyMatrix4(inv);
    const s = box.getSize(new THREE.Vector3());
    setGhostBox({ c, s });
  }, [p.active, p.animKey]);

  useEffect(() => {
    const g = animRef.current;
    const spec = CLIPS[p.name];
    if (!p.active || !g || !spec) { mixer.current = null; g?.position.set(0, 0, 0); g?.quaternion.identity(); return; }
    const m = new THREE.AnimationMixer(g);
    const a = m.clipAction(buildClip(spec));
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    mixer.current = { m, a, fired: new Set(), spec };
    return () => { m.stopAllAction(); m.uncacheRoot(g); };
  }, [p.active, p.animKey, p.name]);

  useFrame((_, dt) => {
    const mx = mixer.current;
    if (mx) {
      mx.m.update(Math.min(dt, 0.05));
      mx.spec.sounds.forEach(([t, s], i) => {
        if (!mx.fired.has(i) && mx.a.time >= t - 1e-3) { mx.fired.add(i); if (engine.sound) sfx[s](); }
      });
    }
    if (explodeRef.current && p.explode) {
      const k = engine.explode;
      explodeRef.current.position.set(p.explode[0] * k, p.explode[1] * k, p.explode[2] * k);
    }
    if (ghostRef.current) {
      const total = mx ? mx.a.getClip().duration : 0;
      const done = mx ? Math.min(1, mx.a.time / Math.max(0.01, total)) : 1;
      ghostMat.uniforms.uTime.value = engine.time;
      ghostMat.uniforms.uOpacity.value = 1 - THREE.MathUtils.smoothstep(done, 0.75, 1);
      ghostRef.current.visible = ghostMat.uniforms.uOpacity.value > 0.01;
    }
    const glow = p.status ? STATUS_COLOR[p.status] : p.hovered ? STATUS_COLOR.hover : null;
    const pulse = (p.status ? 0.45 + Math.sin(engine.time * 4.5) * 0.3 : 0.18) * (p.glowScale ?? 1);
    for (const { m, e, i } of mats.current) {
      if (glow) { m.emissive.set(glow); m.emissiveIntensity = pulse; } else { m.emissive.copy(e); m.emissiveIntensity = i; }
    }
  });

  const neg: V3 = [-p.pivot[0], -p.pivot[1], -p.pivot[2]];
  return (
    <group position={p.pivot}>
      <group ref={explodeRef}>
        <group ref={animRef}>
          <group
            ref={contentRef}
            position={neg}
            onClick={(e) => { e.stopPropagation(); p.onPick?.(p.name); }}
            onPointerOver={(e) => { e.stopPropagation(); p.onHover?.(p.name); }}
            onPointerOut={() => p.onHover?.(null)}
          >
            {p.children}
          </group>
          {p.showLabel && p.label && p.labelAt && (
            <Html position={[p.labelAt[0] - p.pivot[0], p.labelAt[1] - p.pivot[1], p.labelAt[2] - p.pivot[2]]} center style={{ pointerEvents: 'none' }} zIndexRange={[4, 0]}>
              <div className={`scene-label ${p.status ?? ''}`}>{p.label}</div>
            </Html>
          )}
        </group>
      </group>
      {p.active && ghostBox && (
        <mesh ref={ghostRef} position={ghostBox.c} material={ghostMat}>
          <boxGeometry args={[ghostBox.s.x + 0.3, ghostBox.s.y + 0.3, ghostBox.s.z + 0.3]} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ material helpers */

export function useStd(params: THREE.MeshStandardMaterialParameters, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new THREE.MeshStandardMaterial(params), deps);
}

export function usePhys(params: THREE.MeshPhysicalMaterialParameters, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new THREE.MeshPhysicalMaterial(params), deps);
}
