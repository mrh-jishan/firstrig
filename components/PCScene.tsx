'use client';

import { CameraControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Resolved } from '@/lib/catalog';
import { RIG_BUILT, type Anchor, type CableKey, type Mark, type RigState, type SceneKey } from '@/lib/assembly';
import { setMuted, sfx, startHum, stopHum } from '@/lib/sound';
import { CpuChip, Motherboard, NvmeDrive, RamSticks } from './three/Board';
import { Cables } from './three/Cables';
import { BoardBox, PcCase } from './three/Case';
import { CpuCooler } from './three/Cooler';
import { EngineProvider, EngineTicker, Mount, createEngine, seg, useEngine, type Engine, type PartStatus } from './three/engine';
import { GraphicsCard } from './three/Gpu';
import { anchors as anchorMap, boardToWorld, layout, type Layout, type V3 } from './three/layout';
import { Marks } from './three/Marks';
import { PowerSupply } from './three/Psu';
import { Post, Studio } from './three/Studio';
import { usePrefs } from './prefs';

export type { PartStatus };

export type SceneFocus = { at: Anchor; zoom?: number; from?: V3; key: string };

export type SceneProps = {
  r: Resolved;
  rig?: RigState; // assembly guide drives every moving sub-part; omitted = fully built PC
  marks?: Mark[]; // callouts and arrows
  focus?: SceneFocus; // camera flies here whenever key changes
  activeCables?: CableKey[]; // highlighted cables
  status?: Partial<Record<SceneKey, PartStatus>>;
  hideCase?: boolean; // only the workbench is in shot
  lowGfx?: boolean;
  onPick?: (k: SceneKey) => void;
  showLabels?: boolean;
};

const LABEL: Record<SceneKey, string> = {
  case: 'Case', board: 'Motherboard', cpu: 'CPU', ram: 'RAM', storage: 'NVMe SSD', cooler: 'CPU cooler', gpu: 'Graphics card', psu: 'Power supply',
};

type View = 'hero' | 'side' | 'front' | 'top' | 'back' | 'inside';
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
    default: return [[62 * s, H * 1.0, 66 * s], [0, H * 0.44, 0]];
  }
}

/** Carries the whole board assembly from its box on the bench into the case as rig.board goes 0 -> 1. */
function BoardFrame({ l, children }: { l: Layout; children: React.ReactNode }) {
  const engine = useEngine();
  const ref = useRef<THREE.Group>(null);
  const poses = useMemo(() => ({
    benchP: new THREE.Vector3(...l.benchCorner), benchQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
    caseP: new THREE.Vector3(...l.board), caseQ: new THREE.Quaternion(),
  }), [l]);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = seg(engine.rc.board, 0, 1);
    g.position.lerpVectors(poses.benchP, poses.caseP, s);
    g.position.y += Math.sin(Math.PI * s) * 18; // lift it over the case wall
    g.quaternion.slerpQuaternions(poses.benchQ, poses.caseQ, Math.min(1, s * 1.3));
  });
  return <group ref={ref}>{children}</group>;
}

function Rig(p: SceneProps & { hovered: SceneKey | null; setHovered: (k: SceneKey | null) => void }) {
  const { r } = p;
  const l = useMemo(() => layout(r), [r]);
  const anchors = useMemo(() => anchorMap(l, r), [l, r]);
  const shown = new Set<SceneKey>(['case', 'board', 'cpu', 'ram', 'storage', 'cooler', 'gpu', 'psu']);
  const bench = !!p.hideCase;
  const assembling = !!p.rig;
  const st = p.status ?? {};
  const common = (k: SceneKey) => ({
    name: k, status: st[k], hovered: p.hovered === k,
    onPick: p.onPick, onHover: p.setHovered, showLabel: p.showLabels && !assembling, label: LABEL[k],
  });
  const { P, sock, pcieDv, m2, ramUsed, bw, bh } = l;
  const ramMid = (ramUsed[0] + ramUsed[ramUsed.length - 1]) / 2;

  return (
    <group>
      {assembling && r.board && <group position={l.benchCenter}><BoardBox w={bh + 3} d={bw + 3} name={r.board.name} /></group>}

      <BoardFrame l={l}>
        <Marks marks={p.marks ?? []} anchors={anchors} space="board" />
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
          <PcCase l={l} part={r.case} lowGfx={p.lowGfx} gpuSlots={r.gpu && r.gpu.lengthMm >= 300 ? 3 : 2} />
        </Mount>
      )}
      {!bench && shown.has('psu') && r.psu && (
        <Mount {...common('psu')} pivot={l.psu} explode={[8, -1, 18]} labelAt={[l.psu[0] + 8.5, l.psu[1] + 2, l.psu[2]]}>
          <group position={l.psu}><PowerSupply part={r.psu} /></group>
        </Mount>
      )}
      {!bench && <Cables l={l} r={r} activeCables={p.activeCables ?? []} />}
      {!bench && <Marks marks={p.marks ?? []} anchors={anchors} space="world" />}
    </group>
  );
}

/** Camera choreography: smooth dolly between presets, auto-orbit, focus on picked parts. */
function CameraRig({ l, r, view, focus, aim, autoRotate, controls }: { l: Layout; r: Resolved; view: { v: View; n: number }; focus: { k: SceneKey | null; n: number }; aim?: SceneFocus; autoRotate: boolean; controls: React.RefObject<CameraControls | null> }) {
  const engine = useEngine();
  const first = useRef(true);
  const anchors = useMemo(() => anchorMap(l, r), [l, r]);
  // Fly to the anchor an assembly action points at, using where the board will end up.
  useEffect(() => {
    const c = controls.current;
    if (!c || !aim) return;
    const a = anchors[aim.at];
    const inCase = engine.rig.board >= 0.5;
    const tgt = a.space === 'board' ? boardToWorld(l, a.p, inCase) : a.p;
    const dir = new THREE.Vector3(...(aim.from ?? (a.space === 'board' && !inCase ? [0.45, 1, 0.7] : [1, 0.42, 0.78]))).normalize();
    const d = aim.zoom ?? 40;
    void c.setLookAt(tgt[0] + dir.x * d, tgt[1] + dir.y * d, tgt[2] + dir.z * d, tgt[0], tgt[1], tgt[2], !first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aim?.key, anchors, controls, engine, l]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (view.n === 0 && aim) return; // the assembly guide frames its own first shot
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
  const [view, setView] = useState<{ v: View; n: number }>({ v: 'hero', n: 0 });
  const [focus, setFocus] = useState<{ k: SceneKey | null; n: number }>({ k: null, n: 0 });
  const [explode, setExplode] = useState(false);
  const [xray, setXray] = useState(false);
  const [power, setPower] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);

  engine.sound = prefs.sound;
  // Rig targets: the assembly guide's state, or a finished PC. First assignment snaps without animating.
  const rig = props.rig ?? RIG_BUILT;
  engine.rig = rig;
  if (!engine.rigInit) { engine.rc = { ...rig }; engine.rigInit = true; }
  useEffect(() => { setMuted(!prefs.sound); }, [prefs.sound]);
  useEffect(() => { engine.explodeTarget = explode ? 1 : 0; }, [engine, explode]);
  useEffect(() => { engine.xrayTarget = xray || props.status?.psu ? 1 : 0; }, [engine, xray, props.status?.psu]);
  // In the guide, power is part of the rig (the "press the power button" action).
  const rigPower = props.rig ? props.rig.power : null;
  useEffect(() => {
    if (rigPower === null) return;
    const on = rigPower > 0.5;
    if (on && engine.powerTarget < 0.5) { engine.powerTarget = 1; if (engine.sound) startHum(); }
    if (!on && engine.powerTarget > 0.5) { engine.powerTarget = 0; stopHum(); }
  }, [rigPower, engine]);
  useEffect(() => { engine.cableViewTarget = props.activeCables?.some((c) => c === 'atx24' || c === 'eps8') ? 1 : 0; }, [engine, props.activeCables]);
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
          <CameraRig l={l} r={props.r} view={view} focus={focus} aim={props.focus} autoRotate={autoRotate} controls={controls} />
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
