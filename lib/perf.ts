import { Build, resolve } from './catalog';
import { scores } from './recommend';

export type Res = '1080' | '1440' | '4k';

// Reference frame rates for a 100-score GPU (RTX 5080 class) and a 100-score CPU (9800X3D class)
// at high settings, no ray tracing, no upscaling. Real results vary by ±25% with drivers, settings and maps.
export const GAMES: { id: string; name: string; kind: 'esports' | 'aaa' | 'casual'; gpu: Record<Res, number>; cpu: number; cap?: number }[] = [
  { id: 'valorant', name: 'Valorant', kind: 'esports', gpu: { '1080': 900, '1440': 700, '4k': 420 }, cpu: 760 },
  { id: 'cs2', name: 'Counter-Strike 2', kind: 'esports', gpu: { '1080': 520, '1440': 400, '4k': 230 }, cpu: 480 },
  { id: 'fortnite', name: 'Fortnite', kind: 'esports', gpu: { '1080': 260, '1440': 190, '4k': 100 }, cpu: 300 },
  { id: 'apex', name: 'Apex Legends', kind: 'esports', gpu: { '1080': 300, '1440': 235, '4k': 135 }, cpu: 290, cap: 300 },
  { id: 'minecraft', name: 'Minecraft (Java)', kind: 'casual', gpu: { '1080': 620, '1440': 500, '4k': 300 }, cpu: 380 },
  { id: 'cyberpunk', name: 'Cyberpunk 2077', kind: 'aaa', gpu: { '1080': 190, '1440': 135, '4k': 70 }, cpu: 200 },
  { id: 'alanwake2', name: 'Alan Wake 2', kind: 'aaa', gpu: { '1080': 125, '1440': 88, '4k': 45 }, cpu: 180 },
];

export type GameFps = { id: string; name: string; kind: string; fps: number; limitedBy: 'cpu' | 'gpu' | 'balanced' };

export function gameFps(b: Build, res: Res): GameFps[] {
  const r = resolve(b);
  const cpu = r.cpu?.gaming ?? 0;
  // Integrated graphics on chips that have it; nothing at all on chips that do not.
  const gpu = r.gpu?.gaming ?? (r.cpu?.hasIgpu ? 7 : 0);
  return GAMES.map((g) => {
    const gpuFps = g.gpu[res] * (gpu / 100);
    const cpuFps = g.cpu * (cpu / 100);
    if (gpuFps <= 0 || cpuFps <= 0) return { id: g.id, name: g.name, kind: g.kind, fps: 0, limitedBy: 'gpu' as const };
    // Soft minimum: whichever part is slower sets the pace, with some overlap near the crossover.
    let fps = Math.pow(Math.pow(gpuFps, -4) + Math.pow(cpuFps, -4), -1 / 4);
    if (g.kind === 'aaa' && (r.ram?.gb ?? 32) < 32) fps *= 0.94;
    if (g.cap) fps = Math.min(fps, g.cap);
    const limitedBy = cpuFps < gpuFps * 0.85 ? 'cpu' : gpuFps < cpuFps * 0.85 ? 'gpu' : 'balanced';
    return { id: g.id, name: g.name, kind: g.kind, fps: Math.round(fps), limitedBy };
  });
}

export function fpsTier(fps: number): { label: string; tone: 'bad' | 'ok' | 'good' | 'great' } {
  if (fps < 30) return { label: 'Choppy', tone: 'bad' };
  if (fps < 60) return { label: 'Playable', tone: 'ok' };
  if (fps < 144) return { label: 'Smooth', tone: 'good' };
  return { label: 'High refresh', tone: 'great' };
}

/** Minutes to export a 10-minute 4K H.265 video project; 100-score creative build takes about 4. */
export function exportMinutes(b: Build) {
  const s = scores(b).creating;
  return s > 0 ? Math.round((4 * 100) / s * 10) / 10 : 0;
}
