'use client';

import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useEngine } from './engine';
import { floorTexture } from './textures';

/** Three-point studio rig + an image-based-lighting environment built from light cards (no HDR download). */
export function Studio({ center, quality }: { center: [number, number, number]; quality: 'low' | 'high' }) {
  const engine = useEngine();
  const rim = useRef<THREE.SpotLight>(null);
  const inner = useRef<THREE.PointLight>(null);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.85, metalness: 0.1 }), []);
  useFrame(() => {
    // Interior glow rises with power so the case lights up when the PC turns on.
    if (inner.current) inner.current.intensity = 40 + engine.power * 260;
    if (rim.current) rim.current.intensity = 900 + engine.power * 400;
  });
  const high = quality === 'high';
  return (
    <>
      <color attach="background" args={['#e6e2f6']} />
      <fog attach="fog" args={['#e6e2f6', 180, 460]} />
      <hemisphereLight args={['#ffffff', '#b9b2dc', 0.9]} />
      <directionalLight
        position={[60, 95, 70]} intensity={2.2} color="#fff4e6" castShadow={high}
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04}
        shadow-camera-left={-70} shadow-camera-right={110} shadow-camera-top={70} shadow-camera-bottom={-20} shadow-camera-near={10} shadow-camera-far={260}
      />
      <spotLight ref={rim} position={[-50, 70, -60]} angle={0.5} penumbra={0.9} intensity={900} color="#8f6bff" distance={0} decay={1.6} />
      <spotLight position={[70, 30, -50]} angle={0.6} penumbra={1} intensity={500} color="#ff7a5c" distance={0} decay={1.6} />
      <pointLight ref={inner} position={[center[0] + 2, center[1] + 6, center[2] + 4]} intensity={60} distance={70} decay={1.6} color="#d8e8ff" />

      <Environment resolution={high ? 256 : 64} frames={1}>
        <color attach="background" args={['#d9d4ef']} />
        <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[0, 60, 0]} rotation-x={Math.PI / 2} scale={[80, 40, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#e9f1ff" position={[70, 20, 20]} rotation-y={-Math.PI / 2} scale={[60, 14, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#9cc4ff" position={[-70, 20, -10]} rotation-y={Math.PI / 2} scale={[60, 10, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#ffd7b0" position={[20, 30, 70]} scale={30} />
        <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[100, 100, 1]} />
      </Environment>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow material={floorMat}>
        <circleGeometry args={[260, 96]} />
      </mesh>
      <ContactShadows position={[0, 0.02, 0]} scale={220} blur={2.4} far={40} opacity={0.45} color="#2a1f66" resolution={high ? 1024 : 256} frames={high ? Infinity : 1} />
    </>
  );
}

export function Post({ quality }: { quality: 'low' | 'high' }) {
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={2.2} intensity={2.4} distanceFalloff={1.2} halfRes quality="medium" />
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
      <Vignette eskil={false} offset={0.3} darkness={0.28} />
    </EffectComposer>
  );
}
