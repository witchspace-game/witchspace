import * as THREE from 'three';
import { audioGraph, noiseBuffer } from './sound';

// Sounds that help you feel your ship and hear where others are:
//  - your engine hum rises with speed; thrusters hiss while you turn
//  - other ships' engines and lasers come from where they are (3D audio,
//    best with headphones)
//  - a soft double beep warns of a hostile on your tail

const setParam = (p: AudioParam, v: number, t: number, smooth = 0.08) => p.setTargetAtTime(v, t, smooth);

/** Keep the listener's ears where the camera is. */
export function setListener(position: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3) {
  const { ctx } = audioGraph();
  const l = ctx.listener;
  if (l.positionX) {
    const t = ctx.currentTime;
    l.positionX.setValueAtTime(position.x, t);
    l.positionY.setValueAtTime(position.y, t);
    l.positionZ.setValueAtTime(position.z, t);
    l.forwardX.setValueAtTime(forward.x, t);
    l.forwardY.setValueAtTime(forward.y, t);
    l.forwardZ.setValueAtTime(forward.z, t);
    l.upX.setValueAtTime(up.x, t);
    l.upY.setValueAtTime(up.y, t);
    l.upZ.setValueAtTime(up.z, t);
  } else {
    l.setPosition(position.x, position.y, position.z);
    l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }
}

function placePanner(p: PannerNode, at: THREE.Vector3) {
  const t = p.context.currentTime;
  if (p.positionX) {
    p.positionX.setValueAtTime(at.x, t);
    p.positionY.setValueAtTime(at.y, t);
    p.positionZ.setValueAtTime(at.z, t);
  } else {
    p.setPosition(at.x, at.y, at.z);
  }
}

function makePanner(at: THREE.Vector3): PannerNode {
  const { ctx, master } = audioGraph();
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 150;
  p.rolloffFactor = 1.1;
  p.maxDistance = 12000;
  placePanner(p, at);
  p.connect(master);
  return p;
}

/** A laser zap from a point in space. */
export function zapAt(at: THREE.Vector3, from: number, to: number, seconds: number, volume: number) {
  const { ctx } = audioGraph();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const p = makePanner(at);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + seconds);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  o.connect(g).connect(p);
  o.start(t);
  o.stop(t + seconds + 0.05);
  o.onended = () => p.disconnect();
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
  const p = makePanner(at);
  src.connect(f).connect(g).connect(p);
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
  update(speed: number, turn: number) {
    if (!this.nodes) return;
    const { ctx } = audioGraph();
    const t = ctx.currentTime;
    const n = this.nodes;
    setParam(n.hum.frequency, 38 + speed * 46, t, 0.15);
    setParam(n.hum2.frequency, 76.6 + speed * 92, t, 0.15);
    setParam(n.tone.frequency, 160 + speed * 1100, t, 0.15);
    setParam(n.humGain.gain, 0.05 + speed * 0.06, t, 0.2);
    setParam(n.hissGain.gain, Math.min(1, turn) * 0.09, t, 0.06);
    setParam(n.hissFilter.frequency, 700 + turn * 900, t, 0.06);
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
  private readonly panner: PannerNode;

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
    this.panner = makePanner(at);
    this.osc.connect(filter).connect(this.gain).connect(this.panner);
    this.osc.start();
  }

  update(at: THREE.Vector3, speed: number) {
    const t = this.panner.context.currentTime;
    placePanner(this.panner, at);
    setParam(this.osc.frequency, 60 + speed * 50, t, 0.2);
    setParam(this.gain.gain, 0.35, t, 0.3);
  }

  dispose() {
    const t = this.panner.context.currentTime;
    setParam(this.gain.gain, 0, t, 0.1);
    this.osc.stop(t + 0.5);
    this.osc.onended = () => this.panner.disconnect();
  }
}

/** Two soft beeps from the direction of the threat. */
export function tailWarning(at: THREE.Vector3) {
  const { ctx } = audioGraph();
  const p = makePanner(at);
  p.refDistance = 2000; // keep it audible regardless of distance
  for (const offset of [0, 0.14]) {
    const t = ctx.currentTime + offset;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 1320;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(p);
    o.start(t);
    o.stop(t + 0.12);
  }
  setTimeout(() => p.disconnect(), 500);
}
