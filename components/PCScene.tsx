'use client';

import { CameraControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Resolved } from '@/lib/catalog';
import type { CableKey, SceneKey } from '@/lib/assembly';
import { setMuted, sfx, startHum, stopHum } from '@/lib/sound';
import { CpuChip, Motherboard, NvmeDrive, RamSticks } from './three/Board';
import { Cables } from './three/Cables';
import { BoardBox, PcCase } from './three/Case';
import { CpuCooler } from './three/Cooler';
import { EngineProvider, EngineTicker, Mount, createEngine, useEngine, type Engine, type PartStatus } from './three/engine';
import { GraphicsCard } from './three/Gpu';
import { layout, type Layout, type V3 } from './three/layout';
import { PowerSupply } from './three/Psu';
import { Post, Studio } from './three/Studio';
import { usePrefs } from './prefs';

export type { PartStatus };

export type SceneProps = {
  r: Resolved;
  installed?: SceneKey[]; // undefined = everything chosen
  active?: SceneKey; // plays its keyframed install clip
  cables?: CableKey[];
  activeCables?: CableKey[]; // animate being routed
  status?: Partial<Record<SceneKey, PartStatus>>;
  hideCase?: boolean; // board is on its box on the bench, case not yet involved
  lowGfx?: boolean;
  animKey?: string; // change to replay animations
  onPick?: (k: SceneKey) => void;
  showLabels?: boolean;
};

const LABEL: Record<SceneKey, string> = {
  case: 'Case', board: 'Motherboard', cpu: 'CPU', ram: 'RAM', storage: 'NVMe SSD', cooler: 'CPU cooler', gpu: 'Graphics card', psu: 'Power supply',
};

type View = 'hero' | 'side' | 'front' | 'top' | 'back' | 'inside' | 'bench';
const VIEWS: { v: View; label: string; key: string }[] = [
  { v: 'hero', label: '3/4', key: '1' }, { v: 'side', label: 'Side', key: '2' }, { v: 'front', label: 'Front', key: '3' },
  { v: 'top', label: 'Top', key: '4' }, { v: 'back', label: 'Back', key: '5' }, { v: 'inside', label: 'Inside', key: '6' },
];

function viewPose(v: View, l: Layout): [V3, V3] {
  const { H, W, D } = l;
  const c: V3 = [0, H * 0.48, 0];
  const s = Math.max(H, D) / 47;
  switch (v) {
    case 'side': return [[92 * s, H * 0.55, 2], c];
    case 'front': return [[6, H * 0.55, 95 * s], c];
    case 'top': return [[W * 0.2, 112 * s, 4], [0, H * 0.4, 0]];
    case 'back': return [[-34 * s, H * 0.7, -82 * s], c];
    case 'inside': {
      const sock: V3 = [l.x0 + 3, l.top - l.sock.dv, l.rear + l.sock.du];
      return [[sock[0] + 30, sock[1] + 6, sock[2] + 20], sock];
    }
    case 'bench': return [[36, 44, 40], [1, 4, 2]];
    default: return [[62 * s, H * 1.0, 66 * s], [0, H * 0.44, 0]];
  }
}

/** Eases the whole board assembly between "on its box on the bench" and "screwed into the case". */
function BoardFrame({ l, bench, children }: { l: Layout; bench: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const init = useRef(false);
  const target = useMemo(() => {
    const q = new THREE.Quaternion();
    if (bench) {
      q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
      return { p: new THREE.Vector3(-l.bh / 2, 6.05, -l.bw / 2), q };
    }
    return { p: new THREE.Vector3(...l.board), q };
  }, [bench, l]);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!init.current) { g.position.copy(target.p); g.quaternion.copy(target.q); init.current = true; return; }
    const k = 1 - Math.exp(-dt * 3);
    g.position.lerp(target.p, k);
    g.quaternion.slerp(target.q, k);
  });
  return <group ref={ref}>{children}</group>;
}

function Rig(p: SceneProps & { hovered: SceneKey | null; setHovered: (k: SceneKey | null) => void }) {
  const { r } = p;
  const l = useMemo(() => layout(r), [r]);
  const all: SceneKey[] = ['case', 'board', 'cpu', 'ram', 'storage', 'cooler', 'gpu', 'psu'];
  const shown = new Set<SceneKey>(p.installed ?? all);
  if (p.active) shown.add(p.active);
  const bench = !!p.hideCase;
  const st = p.status ?? {};
  const common = (k: SceneKey) => ({
    name: k, active: p.active === k, animKey: p.animKey, status: st[k], hovered: p.hovered === k,
    onPick: p.onPick, onHover: p.setHovered, showLabel: p.showLabels, label: LABEL[k],
  });
  const { P, sock, pcieDv, m2, ramUsed, bw, bh } = l;
  const ramMid = (ramUsed[0] + ramUsed[ramUsed.length - 1]) / 2;

  return (
    <group>
      {bench && r.board && <BoardBox w={bh + 3} d={bw + 3} name={r.board.name} />}

      <BoardFrame l={l} bench={bench}>
        {shown.has('board') && r.board && (
          <Mount {...common('board')} pivot={P(bw / 2, bh / 2, 0)} labelAt={P(bw * 0.7, bh - 2, 1.5)}>
            <Motherboard l={l} part={r.board} />
          </Mount>
        )}
        {shown.has('cpu') && r.cpu && (
          <Mount {...common('cpu')} pivot={P(sock.du, sock.dv, 0.6)} explode={[5, 0, 0]} labelAt={P(sock.du, sock.dv + 3.5, 2)}>
            <CpuChip l={l} part={r.cpu} />
          </Mount>
        )}
        {shown.has('storage') && r.storage && (
          <Mount {...common('storage')} pivot={P(m2.du - 4, m2.dv, 0.45)} explode={[4, -2, 0]} labelAt={P(m2.du, m2.dv + 1.5, 1.5)}>
            <NvmeDrive l={l} part={r.storage} />
          </Mount>
        )}
        {shown.has('ram') && r.ram && (
          <Mount {...common('ram')} pivot={P(ramMid, sock.dv + 1, 1)} explode={[11, 0, 2]} labelAt={P(ramMid, sock.dv - 6.5, 5)}>
            <RamSticks l={l} part={r.ram} />
          </Mount>
        )}
        {shown.has('cooler') && r.cooler && (
          <Mount {...common('cooler')} pivot={P(sock.du, sock.dv, 3)} explode={[19, 3, 0]}
            labelAt={P(sock.du, sock.dv - 8, r.cooler.kind === 'air' ? r.cooler.heightMm / 20 : 3)}>
            <CpuCooler l={l} part={r.cooler} />
          </Mount>
        )}
        {shown.has('gpu') && r.gpu && (
          <Mount {...common('gpu')} pivot={P(l.gpuLen / 2, pcieDv + 2.5, 6)} explode={[22, -8, 0]} labelAt={P(l.gpuLen * 0.55, pcieDv + 3, 13)}>
            <group position={P(-1.4, pcieDv, 0)}><GraphicsCard l={l} part={r.gpu} /></group>
          </Mount>
        )}
      </BoardFrame>

      {!bench && shown.has('case') && r.case && (
        <Mount {...common('case')} glowScale={0.06} pivot={[0, l.H / 2, 0]} labelAt={[l.W / 2 + 1, l.H + 2, l.D / 2 - 4]}>
          <PcCase l={l} part={r.case} lowGfx={p.lowGfx} />
        </Mount>
      )}
      {!bench && shown.has('psu') && r.psu && (
        <Mount {...common('psu')} pivot={l.psu} explode={[8, -1, 18]} labelAt={[l.psu[0] + 8.5, l.psu[1] + 2, l.psu[2]]}>
          <group position={l.psu}><PowerSupply part={r.psu} /></group>
        </Mount>
      )}
      {!bench && <Cables l={l} r={r} cables={p.cables ?? []} activeCables={p.activeCables ?? []} animKey={p.animKey} />}
    </group>
  );
}

/** Camera choreography: smooth dolly between presets, auto-orbit, focus on picked parts. */
function CameraRig({ l, view, focus, autoRotate, controls }: { l: Layout; view: { v: View; n: number }; focus: { k: SceneKey | null; n: number }; autoRotate: boolean; controls: React.RefObject<CameraControls | null> }) {
  const engine = useEngine();
  const first = useRef(true);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const [pos, tgt] = viewPose(view.v, l);
    void c.setLookAt(...pos, ...tgt, !first.current);
    if (!first.current && engine.sound) sfx.swoosh();
    first.current = false;
  }, [view, l, controls, engine]);
  useEffect(() => {
    const c = controls.current;
    const obj = focus.k ? engine.objects.get(focus.k) : null;
    if (!c || !obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    void c.fitToBox(box, true, { paddingTop: 3, paddingBottom: 3, paddingLeft: 3, paddingRight: 3 });
  }, [focus, controls, engine]);
  useFrame((_, dt) => {
    if (autoRotate && controls.current && !controls.current.active) controls.current.azimuthAngle += dt * 0.18;
  });
  return (
    <CameraControls ref={controls} makeDefault minDistance={14} maxDistance={220} maxPolarAngle={Math.PI * 0.49} smoothTime={0.45} draggingSmoothTime={0.12} dollySpeed={0.6} />
  );
}

export default function PCScene(props: SceneProps) {
  const prefs = usePrefs();
  const engine = useMemo<Engine>(() => createEngine(), []);
  const controls = useRef<CameraControls | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const l = useMemo(() => layout(props.r), [props.r]);
  const quality = props.lowGfx ? 'low' : 'high';
  const [hovered, setHovered] = useState<SceneKey | null>(null);
  const [view, setView] = useState<{ v: View; n: number }>({ v: props.hideCase ? 'bench' : 'hero', n: 0 });
  const [focus, setFocus] = useState<{ k: SceneKey | null; n: number }>({ k: null, n: 0 });
  const [explode, setExplode] = useState(false);
  const [xray, setXray] = useState(false);
  const [power, setPower] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);

  engine.sound = prefs.sound;
  useEffect(() => { setMuted(!prefs.sound); }, [prefs.sound]);
  useEffect(() => { engine.explodeTarget = explode ? 1 : 0; }, [engine, explode]);
  useEffect(() => {
    // During assembly the side panel is off, exactly like a real build.
    engine.xrayTarget = xray || !!props.installed || props.status?.psu ? 1 : 0;
  }, [engine, xray, props.installed, props.status?.psu]);
  useEffect(() => { engine.cableViewTarget = props.activeCables?.some((c) => c === 'atx24' || c === 'eps8') ? 1 : 0; }, [engine, props.activeCables]);
  // Jump between bench and case framing when the assembly moves the board.
  useEffect(() => { setView((v) => ({ v: props.hideCase ? 'bench' : 'hero', n: v.n + 1 })); }, [props.hideCase]);
  // Alert once when a new conflict appears.
  const errCount = Object.values(props.status ?? {}).filter((s) => s === 'error').length;
  const prevErr = useRef(errCount);
  useEffect(() => { if (errCount > prevErr.current && engine.sound) sfx.error(); prevErr.current = errCount; }, [errCount, engine]);

  const togglePower = () => {
    const on = !power;
    setPower(on);
    if (on) {
      if (engine.sound) sfx.rocker();
      setTimeout(() => { engine.powerTarget = 1; if (engine.sound) startHum(); }, 280);
      setTimeout(() => { if (engine.sound && engine.powerTarget === 1) sfx.post(); }, 2600);
    } else {
      engine.powerTarget = 0;
      if (engine.sound) sfx.rocker();
      stopHum();
    }
  };
  useEffect(() => () => { stopHum(); }, []);

  const pick = (k: SceneKey) => {
    if (engine.sound) sfx.click();
    setFocus((f) => ({ k, n: f.n + 1 }));
    props.onPick?.(k);
  };
  const hover = (k: SceneKey | null) => {
    setHovered(k);
    if (k && engine.sound) sfx.tick();
    if (wrap.current) wrap.current.style.cursor = k ? 'pointer' : '';
  };
  const tool = (fn: () => void) => () => { if (engine.sound) sfx.click(); fn(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v) { setView((cur) => ({ v: v.v, n: cur.n + 1 })); return; }
      const k = e.key.toLowerCase();
      if (k === 'e') setExplode((x) => !x);
      else if (k === 'x') setXray((x) => !x);
      else if (k === 'p') togglePower();
      else if (k === 'r') setAutoRotate((x) => !x);
      else if (k === 'm') prefs.set({ sound: !prefs.sound });
      else if (k === 'f' && focus.k) setFocus((f) => ({ k: f.k, n: f.n + 1 }));
      else if (k === '?') setHelp((x) => !x);
      else return;
      if (engine.sound) sfx.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fullscreen = () => {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.();
  };

  const center: V3 = [0, l.H / 2, 0];
  return (
    <div className="scene-wrap" ref={wrap}>
      <Canvas
        shadows={quality === 'high'}
        dpr={quality === 'low' ? 1 : [1, 1.75]}
        camera={{ position: [60, 46, 66], fov: 32, near: 0.5, far: 900 }}
        gl={{ antialias: quality === 'low', powerPreference: 'high-performance', toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05 }}
        onCreated={() => setReady(true)}
        onPointerMissed={() => hover(null)}
      >
        <EngineProvider engine={engine}>
          <EngineTicker />
          <Suspense fallback={null}>
            <Studio center={center} quality={quality} />
            <Rig {...props} lowGfx={quality === 'low'} hovered={hovered} setHovered={hover} onPick={pick} />
            <Post quality={quality} />
          </Suspense>
          <CameraRig l={l} view={view} focus={focus} autoRotate={autoRotate} controls={controls} />
        </EngineProvider>
      </Canvas>

      {!ready && <div className="scene-loading">Starting renderer...</div>}

      <div className="viewport-bar top" role="toolbar" aria-label="Camera">
        {VIEWS.map((v) => (
          <button key={v.v} className={view.v === v.v ? 'on' : ''} onClick={tool(() => setView((c) => ({ v: v.v, n: c.n + 1 })))} title={`${v.label} view (${v.key})`}>{v.label}</button>
        ))}
        <span className="sep" />
        <button className={autoRotate ? 'on' : ''} onClick={tool(() => setAutoRotate((x) => !x))} title="Auto-orbit (R)">Orbit</button>
        <button onClick={tool(fullscreen)} title="Fullscreen">Full</button>
      </div>
      <div className="viewport-bar bottom" role="toolbar" aria-label="Scene">
        <button className={explode ? 'on' : ''} onClick={tool(() => setExplode((x) => !x))} title="Exploded view (E)">Explode</button>
        <button className={xray ? 'on' : ''} onClick={tool(() => setXray((x) => !x))} title="See through panels (X)">X-ray</button>
        <button className={power ? 'on power' : 'power'} onClick={togglePower} title="Power on: fans, RGB, POST beep (P)">{power ? 'Power off' : 'Power on'}</button>
        <button className={prefs.sound ? 'on' : ''} onClick={() => prefs.set({ sound: !prefs.sound })} title="Sound effects (M)">{prefs.sound ? 'Sound on' : 'Muted'}</button>
        <button onClick={() => setHelp((x) => !x)} title="Shortcuts (?)">?</button>
      </div>

      {hovered && (
        <div className={`scene-tip ${props.status?.[hovered] ?? ''}`}>
          <b>{LABEL[hovered]}</b>
          <span>{props.r[hovered]?.name ?? ''}</span>
          {props.status?.[hovered] === 'error' && <em>Conflict, see the list</em>}
          {props.status?.[hovered] === 'warn' && <em>Worth checking</em>}
          <small>Click to focus</small>
        </div>
      )}
      {help && (
        <div className="scene-help" onClick={() => setHelp(false)}>
          <b>Controls</b>
          <div>Drag: orbit · Right-drag: pan · Scroll / pinch: zoom</div>
          <div>1-6: camera views · R: auto-orbit · F: refocus</div>
          <div>E: exploded view · X: x-ray · P: power on/off · M: mute</div>
          <div>Click a part: fly to it and explain it</div>
        </div>
      )}
    </div>
  );
}
