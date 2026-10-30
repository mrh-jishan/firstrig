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
- `components/PCScene.tsx` - procedural three.js scene (react-three-fiber), sized from real case/part dimensions

## Known limits
- Catalog is ~40 parts; prices are estimates, GPU lengths are typical per chip.
- Performance is relative scoring, not benchmarks.
- 3D models are procedural blocks, not manufacturer models.
