import * as THREE from 'three';

// Procedural textures drawn on canvases at runtime, so the scene ships with zero image assets.
// Each generator is memoised by key; textures are shared across every mesh that uses them.

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(c: HTMLCanvasElement, opts: { repeat?: [number, number]; color?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(...opts.repeat);
  if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  t.needsUpdate = true;
  return t;
}

function memo<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = cache.get(key) as T | undefined;
  if (!t) { t = make(); cache.set(key, t); }
  return t;
}

// Seeded RNG so every visit draws the same board.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Motherboard PCB: matte black solder mask, copper traces, vias, silkscreen labels. */
export function pcbTexture(kind: 'board' | 'green' | 'gpu', labels: { text: string; x: number; y: number; size?: number; rot?: number }[] = [], seed = 7, aspect = 1.25) {
  return memo(`pcb:${kind}:${seed}:${aspect}:${labels.map((l) => l.text + l.x + l.y).join()}`, () => {
    const W = 1024, H = Math.round(1024 * aspect);
    const [c, g] = canvas(W, H);
    const base = kind === 'green' ? '#0f4a2a' : kind === 'gpu' ? '#141414' : '#16191d';
    const trace = kind === 'green' ? '#1d6b3f' : '#24292f';
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    const r = rng(seed);
    // Subtle mottling of the solder mask.
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.025})`;
      g.fillRect(r() * W, r() * H, 2 + r() * 6, 2 + r() * 6);
    }
    // Manhattan-routed trace bundles.
    g.lineCap = 'round';
    for (let b = 0; b < 70 * aspect; b++) {
      const n = 3 + Math.floor(r() * 7);
      let x = r() * W, y = r() * H;
      const horiz = r() > 0.5;
      const len1 = 40 + r() * 260, len2 = 30 + r() * 200;
      const dir = r() > 0.5 ? 1 : -1;
      g.strokeStyle = trace;
      g.lineWidth = 1.6 + r() * 1.5;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        g.beginPath();
        if (horiz) {
          g.moveTo(x, y + o); g.lineTo(x + len1, y + o); g.lineTo(x + len1 + len2 * 0.3, y + o + len2 * 0.3 * dir); g.lineTo(x + len1 + len2, y + o + len2 * 0.3 * dir);
        } else {
          g.moveTo(x + o, y); g.lineTo(x + o, y + len1); g.lineTo(x + o + len2 * 0.3 * dir, y + len1 + len2 * 0.3); g.lineTo(x + o + len2 * 0.3 * dir, y + len1 + len2);
        }
        g.stroke();
      }
    }
    // Vias.
    for (let i = 0; i < 900; i++) {
      const x = r() * W, y = r() * H;
      g.fillStyle = '#6b6f75';
      g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = base;
      g.beginPath(); g.arc(x, y, 0.9, 0, Math.PI * 2); g.fill();
    }
    // Tiny SMD passives.
    for (let i = 0; i < 500; i++) {
      const x = r() * W, y = r() * H, rot = r() > 0.5;
      g.fillStyle = r() > 0.4 ? '#3a3226' : '#1a1a1a';
      g.fillRect(x, y, rot ? 8 : 4, rot ? 4 : 8);
      g.fillStyle = '#b8b8b8';
      if (rot) { g.fillRect(x, y, 2, 4); g.fillRect(x + 6, y, 2, 4); } else { g.fillRect(x, y, 4, 2); g.fillRect(x, y + 6, 4, 2); }
    }
    // Silkscreen.
    g.fillStyle = 'rgba(235,235,235,0.85)';
    g.strokeStyle = 'rgba(235,235,235,0.55)';
    g.font = '600 18px ui-monospace, Menlo, monospace';
    for (const l of labels) {
      g.save();
      g.translate(l.x * W, l.y * H);
      if (l.rot) g.rotate(l.rot);
      g.font = `600 ${l.size ?? 18}px ui-monospace, Menlo, monospace`;
      g.fillText(l.text, 0, 0);
      g.restore();
    }
    return finish(c);
  });
}

/** Brushed aluminium: fine directional streaks. Used as both map and roughness. */
export function brushedTexture(tint = 200) {
  return memo(`brushed:${tint}`, () => {
    const W = 512, H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = `rgb(${tint},${tint},${tint})`;
    g.fillRect(0, 0, W, H);
    const r = rng(3);
    for (let i = 0; i < 4000; i++) {
      const y = r() * H;
      const v = tint + (r() - 0.5) * 60;
      g.strokeStyle = `rgba(${v},${v},${v},${0.15 + r() * 0.25})`;
      g.lineWidth = 0.5 + r();
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (r() - 0.5) * 2); g.stroke();
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/** Hexagonal perforated mesh as an alpha map (white = solid). */
export function hexMeshAlpha(cell = 22, density = 1) {
  return memo(`hex:${cell}:${density}`, () => {
    const W = 512, H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    const r = cell * 0.42;
    const dx = cell * 0.866, dy = cell * 0.75;
    for (let row = -1; row * dy < H + cell; row++) {
      for (let col = -1; col * dx < W + cell; col++) {
        const x = col * dx + (row % 2 ? dx / 2 : 0);
        const y = row * dy;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 3 * k + Math.PI / 6;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.closePath(); g.fill();
      }
    }
    return finish(c, { repeat: [density, density], color: false });
  });
}

/** Round-hole mesh used on dust filters and PSU grilles. */
export function holeMeshAlpha(step = 16) {
  return memo(`holes:${step}`, () => {
    const W = 256, H = 256;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    for (let y = 0; y < H + step; y += step) for (let x = 0; x < W + step; x += step) {
      const ox = (y / step) % 2 ? step / 2 : 0;
      g.beginPath(); g.arc(x + ox, y, step * 0.36, 0, Math.PI * 2); g.fill();
    }
    return finish(c, { color: false });
  });
}

/** Woven sleeving normal map for cables. */
export function braidNormal() {
  return memo('braid', () => {
    const W = 128, H = 128;
    const [c, g] = canvas(W, H);
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, W, H);
    const s = 16;
    for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
      const flip = ((x + y) / s) % 2;
      const grad = flip ? g.createLinearGradient(x, y, x + s, y + s) : g.createLinearGradient(x + s, y, x, y + s);
      grad.addColorStop(0, 'rgb(70,90,255)');
      grad.addColorStop(0.5, 'rgb(128,128,255)');
      grad.addColorStop(1, 'rgb(190,170,255)');
      g.fillStyle = grad;
      g.fillRect(x + 1, y + 1, s - 2, s - 2);
    }
    return finish(c, { repeat: [24, 1], color: false });
  });
}

/** Radiator / heatsink fin pattern viewed edge-on (stripes), as color map. */
export function finStripes(pitch = 6, dark = '#26282c', light = '#5d6168') {
  return memo(`fins:${pitch}:${dark}:${light}`, () => {
    const W = 256, H = 64;
    const [c, g] = canvas(W, H);
    g.fillStyle = dark; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += pitch) {
      const grad = g.createLinearGradient(x, 0, x + pitch, 0);
      grad.addColorStop(0, dark); grad.addColorStop(0.5, light); grad.addColorStop(1, dark);
      g.fillStyle = grad; g.fillRect(x, 0, pitch * 0.55, H);
    }
    return finish(c);
  });
}

/** Text label / sticker, e.g. PSU spec label, SSD sticker, laser-etched CPU lid. */
export function labelTexture(lines: { t: string; size: number; weight?: number; color?: string }[], opts: { w?: number; h?: number; bg?: string; border?: string; align?: CanvasTextAlign; etched?: boolean } = {}) {
  const key = `label:${JSON.stringify(lines)}:${JSON.stringify(opts)}`;
  return memo(key, () => {
    const W = opts.w ?? 512, H = opts.h ?? 256;
    const [c, g] = canvas(W, H);
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, W, H); }
    if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16); }
    const total = lines.reduce((s, l) => s + l.size * 1.3, 0);
    let y = (H - total) / 2;
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'top';
    for (const l of lines) {
      g.font = `${l.weight ?? 700} ${l.size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      g.fillStyle = l.color ?? '#fff';
      const x = g.textAlign === 'center' ? W / 2 : 28;
      if (opts.etched) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(l.t, x + 1.5, y + 1.5); g.fillStyle = l.color ?? '#d9dde2'; }
      g.fillText(l.t, x, y);
      y += l.size * 1.3;
    }
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Gold edge-connector fingers along the bottom of RAM, GPU, SSD. */
export function goldFingers(count = 60) {
  return memo(`fingers:${count}`, () => {
    const W = 1024, H = 32;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#0f3d22'; g.fillRect(0, 0, W, H);
    const w = W / count;
    for (let i = 0; i < count; i++) {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#f3d27a'); grad.addColorStop(1, '#b8892c');
      g.fillStyle = grad;
      g.fillRect(i * w + w * 0.18, 2, w * 0.64, H - 2);
    }
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Connector face: grid of square pin holes, e.g. ATX 24-pin. */
export function pinGrid(cols: number, rows: number) {
  return memo(`pins:${cols}x${rows}`, () => {
    const W = cols * 32, H = rows * 32;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      g.fillStyle = '#050505';
      g.fillRect(x * 32 + 6, y * 32 + 6, 20, 20);
      g.fillStyle = '#c9a54a';
      g.fillRect(x * 32 + 13, y * 32 + 13, 6, 6);
    }
    return finish(c);
  });
}

/** Studio floor: soft radial falloff with a faint engineering grid. */
export function floorTexture() {
  return memo('floor', () => {
    const W = 1024;
    const [c, g] = canvas(W, W);
    const grad = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    grad.addColorStop(0, '#1a2029'); grad.addColorStop(1, '#0b0f14');
    g.fillStyle = grad; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(120,150,190,0.08)';
    g.lineWidth = 1;
    for (let i = 0; i <= W; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, W); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke();
    }
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/**
 * Contact fields. 'socket' = LGA socket full of tiny gold spring pins (AM5 / Intel),
 * 'pads' = flat gold pads under an LGA CPU, 'pins' = AM4 CPU underside covered in pins,
 * 'holes' = AM4 socket, a white block of pin holes.
 */
export function contactField(kind: 'socket' | 'pads' | 'pins' | 'holes') {
  return memo(`contacts:${kind}`, () => {
    const W = 512;
    const [c, g] = canvas(W, W);
    const bg = kind === 'holes' ? '#ebe6d8' : kind === 'socket' ? '#1a1b1e' : '#1d5a33';
    g.fillStyle = bg; g.fillRect(0, 0, W, W);
    const n = kind === 'pads' ? 38 : 40;
    const step = W / n;
    const mid = W / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = x * step + step / 2, cy = y * step + step / 2;
      // Leave the centre clear (capacitor island on CPUs, keep-out on sockets) and clip one corner (the key).
      if (Math.abs(cx - mid) < W * 0.14 && Math.abs(cy - mid) < W * 0.14 && kind !== 'holes') continue;
      if (x + y < 3) continue;
      if (kind === 'holes') {
        g.fillStyle = '#2b2a27'; g.beginPath(); g.arc(cx, cy, step * 0.18, 0, Math.PI * 2); g.fill();
      } else if (kind === 'pads') {
        g.fillStyle = '#d9b04c'; g.fillRect(cx - step * 0.28, cy - step * 0.28, step * 0.56, step * 0.56);
      } else {
        const grad = g.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, step * 0.4);
        grad.addColorStop(0, '#fff2c0'); grad.addColorStop(0.5, '#d9b04c'); grad.addColorStop(1, 'rgba(90,70,20,0.2)');
        g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, step * 0.32, 0, Math.PI * 2); g.fill();
      }
    }
    if (kind === 'pads') {
      g.fillStyle = '#5b4a2a';
      for (let i = 0; i < 24; i++) g.fillRect(mid - 50 + (i % 6) * 18, mid - 40 + Math.floor(i / 6) * 22, 10, 6);
    }
    // Gold key triangle in the clipped corner.
    g.fillStyle = '#e8c35c';
    g.beginPath(); g.moveTo(4, 4); g.lineTo(46, 4); g.lineTo(4, 46); g.closePath(); g.fill();
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Thermal paste dot: grey with a glossy highlight. */
export function pasteTexture() {
  return memo('paste', () => {
    const W = 128;
    const [c, g] = canvas(W, W);
    const grad = g.createRadialGradient(W * 0.42, W * 0.4, 2, W / 2, W / 2, W / 2);
    grad.addColorStop(0, '#d9dbe0'); grad.addColorStop(0.6, '#9a9ea6'); grad.addColorStop(1, '#6c7078');
    g.fillStyle = grad; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2); g.fill();
    return finish(c);
  });
}
