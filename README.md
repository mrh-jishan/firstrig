# FirstRig

Build your first PC with confidence. Beginner-first PC builder: needs/budget wizard, 3D build view with visual
compatibility conflicts, step-by-step "build alongside me" assembly guide, and a first-boot troubleshooter.

```
npm install
npm run dev        # http://localhost:3330
npm run build && npm start
```

No backend, no keys. A build lives entirely in the URL (`?b=cpu~cooler~board~ram~gpu~storage~psu~case`), so sharing a link shares the build.

## Layout
- `lib/catalog.ts` - curated parts catalog (small on purpose; every spec hand-checkable)
- `lib/compat.ts` - compatibility rules in plain language + one-click fix suggestions that never add a new error
- `lib/recommend.ts` - wizard: needs + budget -> Saver / Sweet spot / Stretch builds
- `lib/assembly.ts` - assembly steps tailored to the chosen parts (socket type, cooler kind, GPU power connector)
- `lib/troubleshoot.ts` - symptom -> ordered checks, each tied to a part or cable in 3D
- `components/PCScene.tsx` - real-time renderer: camera choreography, viewport toolbar, keyboard shortcuts, power/explode/x-ray
- `components/three/` - the 3D engine
  - `Board.tsx`, `Gpu.tsx`, `Cooler.tsx`, `Psu.tsx`, `Case.tsx`, `Fan.tsx`, `Cables.tsx` - procedurally modelled parts sized from spec sheets
    (helicoid fan blades, instanced fin stacks, U-shaped heatpipes, DIMM latches, VRM chokes, sleeved cable bundles)
  - `textures.ts` - runtime canvas textures: PCB traces + silkscreen, brushed aluminium, hex/hole perforations, braid normal maps, labels
  - `shaders.ts` - GLSL: addressable RGB, holographic placement ghost (fresnel + scanlines), infinity-mirror pump cap
  - `engine.tsx` - keyframe install clips (THREE.AnimationMixer), status glow, exploded view, power state
  - `Studio.tsx` - lighting rig, light-card IBL environment, contact shadows, post (N8AO, bloom, AgX, SMAA, vignette)
- `lib/sound.ts` - Web Audio synthesised SFX (latches, screws, whooshes, fan hum, POST beep); no audio files

## Known limits
- Catalog is ~40 parts; prices are estimates, GPU lengths are typical per chip.
- Performance is relative scoring, not benchmarks.
- 3D models are procedural, detailed to spec-sheet dimensions, but not manufacturer CAD.
- `three` is pinned to 0.186 until `postprocessing` supports 0.187.
