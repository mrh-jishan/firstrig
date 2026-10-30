// Synthesised sound effects (Web Audio). No audio files: every sound is built from oscillators,
// filtered noise and envelopes, so it loads instantly and stays tiny.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
let hum: { stop: () => void; gain: GainNode } | null = null;

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    // Gentle compressor keeps stacked effects from clipping.
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

function env(c: AudioContext, g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function burst(freq: number, q: number, peak: number, decay: number, type: BiquadFilterType = 'bandpass', at = 0) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + at;
  const src = noise(c);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  env(c, g, t, peak, 0.002, decay);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random()); src.stop(t + decay + 0.05);
}

function tone(freq: number, type: OscillatorType, peak: number, decay: number, at = 0, slideTo?: number) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + decay);
  const g = c.createGain();
  env(c, g, t, peak, 0.004, decay);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + decay + 0.05);
}

export const sfx = {
  /** UI hover / small tick. */
  tick: () => burst(5200, 6, 0.08, 0.025),
  /** Button press. */
  click: () => { burst(3200, 4, 0.25, 0.04); tone(1800, 'sine', 0.04, 0.03); },
  /** Plastic latch snapping shut (RAM clips, PCIe latch). Two quick transients. */
  snap: () => { burst(2600, 3, 0.7, 0.05); burst(4200, 5, 0.45, 0.04, 'bandpass', 0.045); tone(900, 'triangle', 0.08, 0.05); },
  /** Heavy part seating: low thud plus a click. */
  thunk: () => { tone(110, 'sine', 0.6, 0.18, 0, 60); burst(700, 1.5, 0.4, 0.09, 'lowpass'); burst(2400, 4, 0.25, 0.04, 'bandpass', 0.03); },
  /** Screwdriver: short ratcheting buzz. */
  screw: () => { for (let i = 0; i < 6; i++) burst(1800 + i * 90, 8, 0.18, 0.025, 'bandpass', i * 0.055); },
  /** Part flying in. */
  whoosh: () => {
    const c = ac(); if (!c || !master) return;
    const t = c.currentTime;
    const src = noise(c);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35); f.frequency.exponentialRampToValueAtTime(500, t + 0.7);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.8);
  },
  /** Connector clicking home (24-pin, 8-pin). */
  plug: () => { burst(1400, 2, 0.5, 0.06); burst(3600, 6, 0.35, 0.03, 'bandpass', 0.05); },
  /** PSU rocker switch. */
  rocker: () => { burst(1100, 2, 0.6, 0.05); tone(220, 'square', 0.05, 0.04); },
  /** Single short BIOS POST beep: all good. */
  post: () => tone(1000, 'square', 0.12, 0.16, 0.0),
  /** Conflict alert. */
  error: () => { tone(220, 'sawtooth', 0.12, 0.12); tone(185, 'sawtooth', 0.12, 0.16, 0.13); },
  /** Positive confirmation chime. */
  success: () => { tone(660, 'sine', 0.15, 0.18); tone(990, 'sine', 0.12, 0.25, 0.09); },
  /** Camera transition. */
  swoosh: () => burst(900, 0.8, 0.08, 0.25, 'bandpass'),
};

/** Fan spin-up hum: filtered noise + low motor tone, ramps with the fans. */
export function startHum() {
  const c = ac(); if (!c || !master || hum) return;
  const t = c.currentTime;
  const src = noise(c); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(120, t); lp.frequency.exponentialRampToValueAtTime(900, t + 2.5);
  const motor = c.createOscillator(); motor.type = 'sine'; motor.frequency.setValueAtTime(30, t); motor.frequency.exponentialRampToValueAtTime(95, t + 2.5);
  const mg = c.createGain(); mg.gain.value = 0.05;
  const gain = c.createGain(); gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.16, t + 1.8);
  src.connect(lp).connect(gain); motor.connect(mg).connect(gain); gain.connect(master);
  src.start(t); motor.start(t);
  hum = {
    gain,
    stop: () => {
      const n = c.currentTime;
      gain.gain.cancelScheduledValues(n);
      gain.gain.setValueAtTime(gain.gain.value, n);
      gain.gain.exponentialRampToValueAtTime(0.0001, n + 1.2);
      src.stop(n + 1.3); motor.stop(n + 1.3);
    },
  };
}

export function stopHum() {
  hum?.stop();
  hum = null;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
}

export function isMuted() {
  return muted;
}
