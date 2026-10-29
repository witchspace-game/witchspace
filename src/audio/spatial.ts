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

// --- A grand tourer's weapons (Mark: the Fer-de-lance's guns should sound as expensive as her engines) ---
// Crystal lasers: no rasp, a clean bright note with a glassy shimmer above it, a sharp attack and a
// short ringing tail. Each laser has its own: a pulse snaps, a beam sings, a military laser cracks.
// Her missile leaves on a damped rail "thock" and a smooth rising whoosh. Your own play where you
// are; another ship's come from where she is.

export type LaserSound = 'pulse' | 'beam' | 'military';

const CRYSTAL: Record<LaserSound, { f: number; drop: number; seconds: number; shimmer: number; bite: number; volume: number }> = {
  pulse: { f: 2350, drop: 0.8, seconds: 0.11, shimmer: 0.35, bite: 0, volume: 0.05 },
  beam: { f: 2050, drop: 0.92, seconds: 0.24, shimmer: 0.5, bite: 0, volume: 0.042 },
  military: { f: 1550, drop: 0.72, seconds: 0.17, shimmer: 0.3, bite: 0.05, volume: 0.06 },
};

/** Where a sound goes: placed in space, or (null) straight to you. */
function outlet(at: THREE.Vector3 | null): { input: AudioNode; done: () => void } {
  if (!at) return { input: audioGraph().master, done: () => {} };
  const p = makeSpatial(at);
  return { input: p.input, done: () => p.disconnect() };
}

/** A tone that rings and fades: a sine (or triangle) gliding down by `drop` over `seconds`. */
function ring(out: AudioNode, type: OscillatorType, f: number, drop: number, seconds: number, volume: number, t: number) {
  const { ctx } = audioGraph();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * drop, t + seconds);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + seconds + 0.02);
  return o;
}

/** A Fer-de-lance's laser shot, of each kind: yours (`at` null) or another ship's from where she is. */
export function crystalShot(kind: LaserSound, at: THREE.Vector3 | null, volume = 1) {
  const { ctx } = audioGraph();
  const t = ctx.currentTime;
  const c = CRYSTAL[kind];
  const out = outlet(at);
  const v = c.volume * volume * (at ? 6 : 1); // placed sounds fall off with distance: start them louder
  const body = ring(out.input, 'sine', c.f, c.drop, c.seconds, v, t);
  ring(out.input, 'triangle', c.f * 1.5, c.drop, c.seconds * 0.8, v * 0.35, t); // the fifth above, for colour
  ring(out.input, 'sine', c.f * 3.01, c.drop, c.seconds * 0.5, v * c.shimmer, t); // the glassy shimmer, a hair sharp
  if (c.bite) {
    // A military laser's crack: a breath of bright noise at the front.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.04);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(c.bite * volume * (at ? 6 : 1), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(f).connect(g).connect(out.input);
    src.start(t);
  }
  body.onended = out.done;
}

/** A Fer-de-lance's missile: a damped rail release, then the motor lighting in a smooth rising whoosh with a clean tone. */
export function precisionLaunch(at: THREE.Vector3 | null, volume = 1) {
  const { ctx } = audioGraph();
  const t = ctx.currentTime;
  const out = outlet(at);
  const k = volume * (at ? 3 : 1);
  ring(out.input, 'sine', 240, 0.4, 0.08, 0.22 * k, t); // the thock of the rail
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 1.1);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(380, t + 0.1);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.95);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.13 * k, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  src.connect(f).connect(g).connect(out.input);
  src.start(t + 0.1);
  const tone = ring(out.input, 'sine', 320, 2.9, 0.95, 0.03 * k, t + 0.12); // the motor's note, climbing
  tone.onended = out.done;
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

/**
 * How a ship's engines sound (her ship file's style.engine). "drone": a working ship's gritty hum, the
 * Cobra's. "grand" (Mark: the Fer-de-lance is an expensive ship and should feel it): no buzz, a deep
 * smooth purr from two pure tones beating slowly, a clean turbine whine that rises with the throttle,
 * and composure: she strains less in a turn and her thrusters barely hiss.
 */
export type EngineVoice = 'drone' | 'grand';

interface VoiceShape {
  hum: [OscillatorType, number, number]; // wave, Hz at rest, Hz more at full speed
  hum2: [OscillatorType, number, number];
  tone: [number, number]; // lowpass: Hz at rest, more at full speed
  level: [number, number]; // gain at rest, more at full speed
  /** How much a turn strains her: pitch lift of each tone, brightness, level. */
  load: [number, number, number, number];
  hiss: number;
  /** The turbine: Hz at rest, more at full speed, its level at full speed (none for a drone). */
  turbine?: [number, number, number];
  /** At a steady throttle, how far she settles (0..1 of her level) after a few seconds: a grand tourer at cruise. */
  cruise?: number;
}

const VOICES: Record<EngineVoice, VoiceShape> = {
  drone: { hum: ['sawtooth', 38, 46], hum2: ['triangle', 76.6, 92], tone: [160, 900], level: [0.008, 0.01], load: [0.07, 0.1, 650, 0.012], hiss: 0.035 },
  grand: { hum: ['sine', 31, 24], hum2: ['sine', 62.35, 48.6], tone: [150, 420], level: [0.014, 0.012], load: [0.03, 0.04, 300, 0.006], hiss: 0.012, turbine: [360, 820, 0.011], cruise: 0.6 },
};

/** Your own ship: engine hum that tracks speed and strains in a turn, thruster hiss on a hard one. */
export class EngineSound {
  private nodes: {
    hum: OscillatorNode;
    hum2: OscillatorNode;
    tone: BiquadFilterNode;
    humGain: GainNode;
    hiss: AudioBufferSourceNode;
    hissFilter: BiquadFilterNode;
    hissGain: GainNode;
    turbine?: OscillatorNode;
    turbineGain?: GainNode;
  } | null = null;
  private voice: EngineVoice = 'drone';

  start(voice: EngineVoice = 'drone') {
    if (this.nodes && this.voice === voice) return;
    if (this.nodes) this.stop();
    this.voice = voice;
    const v = VOICES[voice];
    const { ctx, master } = audioGraph();
    const t = ctx.currentTime;
    const hum = ctx.createOscillator();
    hum.type = v.hum[0];
    hum.frequency.value = v.hum[1];
    const hum2 = ctx.createOscillator();
    hum2.type = v.hum2[0];
    hum2.frequency.value = v.hum2[1]; // slightly detuned from the octave: a richer drone, or a slow purr
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = v.tone[0];
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
    if (v.turbine) {
      const turbine = ctx.createOscillator();
      turbine.type = 'sine';
      turbine.frequency.value = v.turbine[0];
      const turbineGain = ctx.createGain();
      turbineGain.gain.value = 0;
      turbine.connect(turbineGain).connect(master);
      turbine.start(t);
      Object.assign(this.nodes, { turbine, turbineGain });
    }
  }

  /**
   * Leaving the station in a grand tourer: the turbine winds up from a low note to its own over a
   * couple of seconds, and the purr swells with it, like a good car starting. A drone just runs.
   */
  spool() {
    const n = this.nodes;
    const v = VOICES[this.voice];
    if (!n?.turbine || !n.turbineGain || !v.turbine || getSoundMode() !== 'full') return;
    const { ctx } = audioGraph();
    const t = ctx.currentTime;
    this.spooling = t + 2.4;
    n.turbine.frequency.cancelScheduledValues(t);
    n.turbine.frequency.setValueAtTime(110, t);
    n.turbine.frequency.exponentialRampToValueAtTime(v.turbine[0] + v.turbine[1] * this.lastSpeed, t + 2.2);
    n.turbineGain.gain.cancelScheduledValues(t);
    n.turbineGain.gain.setValueAtTime(0, t);
    n.turbineGain.gain.linearRampToValueAtTime(v.turbine[2] * 1.6, t + 1.4);
    n.turbineGain.gain.linearRampToValueAtTime(v.turbine[2] * 0.6, t + 2.4);
    n.humGain.gain.cancelScheduledValues(t);
    n.humGain.gain.setValueAtTime(0, t);
    n.humGain.gain.linearRampToValueAtTime((v.level[0] + v.level[1]) * 1.5, t + 1.6);
    n.humGain.gain.linearRampToValueAtTime(v.level[0] + v.level[1] * this.lastSpeed, t + 2.4);
  }

  private lastSpeed = 0;
  private swell = 0;
  /** How hard the ship is being worked (0..1): the drone strains under it (Mark: in a dogfight the speed barely changes, so the note sat flat). */
  private load = 0;
  /** Until when (audio clock) the launch spool-up has the engine. */
  private spooling = 0;
  /** Seconds at a steady throttle: a grand tourer settles at cruise (Mark: not annoying on a long run). */
  private steady = 0;

  /** speed and turn are 0..1; dt in seconds. */
  update(speed: number, turn: number, dt: number) {
    if (!this.nodes) return;
    const { ctx } = audioGraph();
    const t = ctx.currentTime;
    const n = this.nodes;
    const v = VOICES[this.voice];
    // Changing speed swells the engine; it settles back within a second or so.
    const change = Math.abs(speed - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = speed;
    this.swell = Math.max(this.swell * Math.exp(-dt * 1.5), Math.min(1, change * 2));
    this.steady = change > 0.02 ? 0 : this.steady + dt;
    // Held steady for a few seconds, she eases back over about six, to cruise; any change of throttle brings her back.
    const settle = v.cruise ? 1 - v.cruise * Math.min(1, Math.max(0, this.steady - 3) / 6) : 1;
    // The load follows the stick quickly as you pull and eases off more slowly as you level out.
    const want = Math.min(1, turn);
    this.load += (want - this.load) * (1 - Math.exp(-dt * (want > this.load ? 5 : 1.8)));
    const drone = getSoundMode() === 'full' ? 1 : 0;
    const [lift, lift2, bright, louder] = v.load;
    const hiss = Math.max(0, Math.min(1, turn) - 0.2) / 0.8; // ignore small corrections; hiss only on a real turn
    setParam(n.hissGain.gain, hiss * v.hiss, t, 0.08);
    setParam(n.hissFilter.frequency, 700 + turn * 700, t, 0.08);
    if (t < this.spooling) return; // the spool-up has the tones for now
    // Under load the note lifts a little, brightens and grows, and its two voices pull apart: a growl
    // in a drone, barely a change of breath in a grand tourer.
    setParam(n.hum.frequency, (v.hum[1] + speed * v.hum[2]) * (1 + lift * this.load), t, 0.12);
    setParam(n.hum2.frequency, (v.hum2[1] + speed * v.hum2[2]) * (1 + lift2 * this.load), t, 0.12);
    setParam(n.tone.frequency, v.tone[0] + speed * v.tone[1] + this.swell * 500 + this.load * bright, t, 0.12);
    setParam(n.humGain.gain, drone * (v.level[0] + speed * v.level[1] * (0.6 + 0.4 * settle) + this.swell * 0.05 + this.load * louder), t, 0.15);
    if (n.turbine && n.turbineGain && v.turbine) {
      // The turbine sings with the throttle: near silent at rest, a clean rising whine opened up, swelling as you open her.
      setParam(n.turbine.frequency, v.turbine[0] + speed * v.turbine[1] + this.load * 30, t, 0.25);
      setParam(n.turbineGain.gain, drone * v.turbine[2] * ((0.08 + 0.92 * speed * speed) * settle + this.swell * 0.6), t, 0.6);
    }
  }

  stop() {
    if (!this.nodes) return;
    const { ctx } = audioGraph();
    const t = ctx.currentTime;
    const n = this.nodes;
    setParam(n.humGain.gain, 0, t, 0.15);
    setParam(n.hissGain.gain, 0, t, 0.05);
    if (n.turbineGain) setParam(n.turbineGain.gain, 0, t, 0.15);
    for (const s of [n.hum, n.hum2, n.hiss, ...(n.turbine ? [n.turbine] : [])]) s.stop(t + 1);
    this.nodes = null;
    this.spooling = 0;
  }
}

/** Another ship's engine, positioned in 3D. */
export class ShipVoice {
  private readonly osc: OscillatorNode;
  private readonly gain: GainNode;
  private readonly spatial: Spatial;
  /** A grand tourer's turbine, heard as she passes. */
  private readonly turbine: { osc: OscillatorNode; gain: GainNode } | null = null;

  constructor(at: THREE.Vector3, private readonly voice: EngineVoice = 'drone') {
    const { ctx } = audioGraph();
    const grand = voice === 'grand';
    this.osc = ctx.createOscillator();
    this.osc.type = grand ? 'sine' : 'triangle';
    this.osc.frequency.value = (grand ? 46 : 62) + Math.random() * 10;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = grand ? 320 : 420;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.spatial = makeSpatial(at);
    this.osc.connect(filter).connect(this.gain).connect(this.spatial.input);
    this.osc.start();
    if (grand) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.spatial.input);
      osc.start();
      this.turbine = { osc, gain };
    }
  }

  update(at: THREE.Vector3, speed: number) {
    const t = this.gain.context.currentTime;
    const on = getSoundMode() === 'full' ? 1 : 0;
    this.spatial.place(at);
    setParam(this.osc.frequency, this.voice === 'grand' ? 44 + speed * 30 : 60 + speed * 50, t, 0.2);
    setParam(this.gain.gain, on * (this.voice === 'grand' ? 0.14 : 0.12), t, 0.3);
    if (this.turbine) {
      setParam(this.turbine.osc.frequency, 380 + speed * 800, t, 0.3);
      setParam(this.turbine.gain.gain, on * 0.035 * (0.15 + 0.85 * speed), t, 0.3);
    }
  }

  dispose() {
    const t = this.gain.context.currentTime;
    setParam(this.gain.gain, 0, t, 0.1);
    this.osc.stop(t + 0.5);
    this.osc.onended = () => this.spatial.disconnect();
    if (this.turbine) {
      setParam(this.turbine.gain.gain, 0, t, 0.1);
      this.turbine.osc.stop(t + 0.5);
    }
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
