import * as THREE from 'three';
import { audioGraph, getSoundMode, noiseBuffer } from './sound';

// Sounds that help you feel your ship and hear where others are, kept
// deliberately subtle so they never become a drone:
//  - your engine is a whisper when cruising and swells briefly when you
//    change speed; thrusters hiss only on a real turn
//  - other ships' engines and lasers come from where they are
//  - a soft double beep warns of a hostile on your tail

const setParam = (p: AudioParam, v: number, t: number, smooth = 0.08) => p.setTargetAtTime(v, t, smooth);

// Positioning is explicit stereo rather than the browser's HRTF "3D audio",
// which is subtle and nearly centred on laptop and desktop speakers:
//  - left/right: strong stereo pan from the sound's direction
//  - behind you: muffled (low-pass), as sounds behind your head are
//  - distance: quieter further away
const listenerInverse = new THREE.Matrix4();
const REF_DISTANCE = 200; // metres at full volume
const PAN_STRENGTH = 1.6; // >1 exaggerates left/right so it's obvious on speakers

/** Keep the listener's ears where the camera is. */
export function setListener(camera: THREE.Camera) {
  listenerInverse.copy(camera.matrixWorldInverse);
}

interface Spatial {
  input: AudioNode;
  place(at: THREE.Vector3): void;
  disconnect(): void;
}

function makeSpatial(at: THREE.Vector3, refDistance = REF_DISTANCE): Spatial {
  const { ctx, master } = audioGraph();
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  const pan = ctx.createStereoPanner();
  const gain = ctx.createGain();
  muffle.connect(pan).connect(gain).connect(master);
  const v = new THREE.Vector3();
  const place = (p: THREE.Vector3) => {
    v.copy(p).applyMatrix4(listenerInverse); // camera space: +x right, -z ahead
    const dist = Math.max(1, v.length());
    const t = ctx.currentTime;
    setParam(pan.pan, THREE.MathUtils.clamp((v.x / dist) * PAN_STRENGTH, -1, 1), t, 0.03);
    const behind = THREE.MathUtils.clamp(v.z / dist, 0, 1); // 0 ahead or beside, 1 directly behind
    setParam(muffle.frequency, THREE.MathUtils.lerp(16000, 900, behind), t, 0.03);
    setParam(gain.gain, refDistance / (refDistance + Math.max(0, dist - refDistance)), t, 0.03);
  };
  // Start from the right place rather than gliding in from the centre.
  v.copy(at).applyMatrix4(listenerInverse);
  const dist0 = Math.max(1, v.length());
  pan.pan.value = THREE.MathUtils.clamp((v.x / dist0) * PAN_STRENGTH, -1, 1);
  muffle.frequency.value = THREE.MathUtils.lerp(16000, 900, THREE.MathUtils.clamp(v.z / dist0, 0, 1));
  gain.gain.value = refDistance / (refDistance + Math.max(0, dist0 - refDistance));
  return { input: muffle, place, disconnect: () => gain.disconnect() };
}

/** A laser zap from a point in space. */
export function zapAt(at: THREE.Vector3, from: number, to: number, seconds: number, volume: number) {
  const { ctx } = audioGraph();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const p = makeSpatial(at);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + seconds);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  o.connect(g).connect(p.input);
  o.start(t);
  o.stop(t + seconds + 0.05);
  o.onended = () => p.disconnect();
}

/** A missile motor lighting up somewhere out there: a roar that swells and fades. */
export function rocketAt(at: THREE.Vector3, volume: number) {
  const { ctx } = audioGraph();
  const t = ctx.currentTime;
  const length = 1.6;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, length);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
  f.frequency.exponentialRampToValueAtTime(500, t + length);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.08);
  g.gain.setTargetAtTime(0.0001, t + 0.3, 0.4);
  const p = makeSpatial(at);
  src.connect(f).connect(g).connect(p.input);
  src.start(t);
  src.stop(t + length);
  src.onended = () => p.disconnect();
}

/** A burst of filtered noise from a point in space (impacts, explosions). */
export function boomAt(at: THREE.Vector3, seconds: number, cutoff: number, volume: number) {
  const { ctx } = audioGraph();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, seconds);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(40, t + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  const p = makeSpatial(at);
  src.connect(f).connect(g).connect(p.input);
  src.start(t);
  src.onended = () => p.disconnect();
}

/** Your own ship: engine hum that tracks speed, thruster hiss that tracks turning. */
export class EngineSound {
  private nodes: {
    hum: OscillatorNode;
    hum2: OscillatorNode;
    tone: BiquadFilterNode;
    humGain: GainNode;
    hiss: AudioBufferSourceNode;
    hissFilter: BiquadFilterNode;
    hissGain: GainNode;
  } | null = null;

  start() {
    if (this.nodes) return;
    const { ctx, master } = audioGraph();
    const t = ctx.currentTime;
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 40;
    const hum2 = ctx.createOscillator();
    hum2.type = 'triangle';
    hum2.frequency.value = 80.6; // slightly detuned for a richer drone
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 160;
    const humGain = ctx.createGain();
    humGain.gain.setValueAtTime(0, t);
    hum.connect(tone);
    hum2.connect(tone);
    tone.connect(humGain).connect(master);

    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(ctx, 2);
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 900;
    hissFilter.Q.value = 0.8;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    hiss.connect(hissFilter).connect(hissGain).connect(master);

    hum.start(t);
    hum2.start(t);
    hiss.start(t);
    this.nodes = { hum, hum2, tone, humGain, hiss, hissFilter, hissGain };
  }

  /** speed and turn are 0..1. */
  private lastSpeed = 0;
  private swell = 0;

  /** speed and turn are 0..1; dt in seconds. */
  update(speed: number, turn: number, dt: number) {
    if (!this.nodes) return;
    const { ctx } = audioGraph();
    const t = ctx.currentTime;
    const n = this.nodes;
    // Changing speed swells the engine; it settles back within a second or so.
    const change = Math.abs(speed - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = speed;
    this.swell = Math.max(this.swell * Math.exp(-dt * 1.5), Math.min(1, change * 2));
    const drone = getSoundMode() === 'full' ? 1 : 0;
    setParam(n.hum.frequency, 38 + speed * 46, t, 0.15);
    setParam(n.hum2.frequency, 76.6 + speed * 92, t, 0.15);
    setParam(n.tone.frequency, 160 + speed * 900 + this.swell * 500, t, 0.15);
    setParam(n.humGain.gain, drone * (0.008 + speed * 0.01 + this.swell * 0.05), t, 0.2);
    // Ignore small corrections; hiss only on a real turn.
    const hiss = Math.max(0, Math.min(1, turn) - 0.2) / 0.8;
    setParam(n.hissGain.gain, hiss * 0.035, t, 0.08);
    setParam(n.hissFilter.frequency, 700 + turn * 700, t, 0.08);
  }

  stop() {
    if (!this.nodes) return;
    const { ctx } = audioGraph();
    const t = ctx.currentTime;
    const n = this.nodes;
    setParam(n.humGain.gain, 0, t, 0.15);
    setParam(n.hissGain.gain, 0, t, 0.05);
    for (const s of [n.hum, n.hum2, n.hiss]) s.stop(t + 1);
    this.nodes = null;
  }
}

/** Another ship's engine, positioned in 3D. */
export class ShipVoice {
  private readonly osc: OscillatorNode;
  private readonly gain: GainNode;
  private readonly spatial: Spatial;

  constructor(at: THREE.Vector3) {
    const { ctx } = audioGraph();
    this.osc = ctx.createOscillator();
    this.osc.type = 'triangle';
    this.osc.frequency.value = 62 + Math.random() * 10;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.spatial = makeSpatial(at);
    this.osc.connect(filter).connect(this.gain).connect(this.spatial.input);
    this.osc.start();
  }

  update(at: THREE.Vector3, speed: number) {
    const t = this.gain.context.currentTime;
    this.spatial.place(at);
    setParam(this.osc.frequency, 60 + speed * 50, t, 0.2);
    setParam(this.gain.gain, getSoundMode() === 'full' ? 0.12 : 0, t, 0.3);
  }

  dispose() {
    const t = this.gain.context.currentTime;
    setParam(this.gain.gain, 0, t, 0.1);
    this.osc.stop(t + 0.5);
    this.osc.onended = () => this.spatial.disconnect();
  }
}

/** Two soft beeps from the direction of the threat. */
export function tailWarning(at: THREE.Vector3) {
  const { ctx } = audioGraph();
  const p = makeSpatial(at, 2000); // audible regardless of distance
  for (const offset of [0, 0.14]) {
    const t = ctx.currentTime + offset;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 1320;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(p.input);
    o.start(t);
    o.stop(t + 0.12);
  }
  setTimeout(() => p.disconnect(), 500);
}
