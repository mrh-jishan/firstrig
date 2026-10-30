'use client';

import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { RIG_BUILT, RIG_KEYS, type RigState, type SceneKey } from '@/lib/assembly';
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
  rig: RigState; // targets
  rc: RigState; // current, eased
  rigInit: boolean;
};

export function createEngine(): Engine {
  return { power: 0, powerTarget: 0, explode: 0, explodeTarget: 0, xray: 0, xrayTarget: 0, cableView: 0, cableViewTarget: 0, time: 0, sound: true, objects: new Map(),
    rig: { ...RIG_BUILT }, rc: { ...RIG_BUILT }, rigInit: false };
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
    // Rig: -1 means "not in the scene", so hide instantly; parts entering appear at their held pose (0) and ease in.
    const r = 1 - Math.exp(-dt * 3.4);
    for (const key of RIG_KEYS) {
      const t = e.rig[key];
      let c = e.rc[key];
      if (t < -0.5) c = -1;
      else {
        if (c < -0.5) c = 0;
        c += (t - c) * r;
        if (Math.abs(t - c) < 0.0005) c = t;
      }
      e.rc[key] = c;
    }
  });
  return null;
}

/* ------------------------------------------------------------------ mount */

type MountProps = {
  name: SceneKey;
  pivot: V3; // point the part rotates around while animating, in parent space
  explode?: V3; // offset when the exploded view is on
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
 * Wraps one part: registers it for camera focus, applies the exploded-view offset and the emissive
 * status glow. Children are authored in parent space; the wrapper re-centres them on `pivot`.
 */
export function Mount(p: MountProps) {
  const engine = useEngine();
  const explodeRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
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

  useFrame(() => {
    if (explodeRef.current && p.explode) {
      const k = engine.explode;
      explodeRef.current.position.set(p.explode[0] * k, p.explode[1] * k, p.explode[2] * k);
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
        <group>
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

/** Run a callback every frame with the eased rig values. */
export function useRig(fn: (rc: RigState, e: Engine) => void) {
  const e = useEngine();
  useFrame(() => fn(e.rc, e));
}

/** Smoothstep remap of a 0..1 rig value into a sub-range, for staged motions. */
export function seg(v: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
