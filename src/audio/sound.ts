// Sound effects are synthesised with Web Audio. The only recording is the
// orchestral Blue Danube used in neo-vector mode (see public/audio/CREDITS.md).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

/** Browsers only allow audio after a user gesture; call this from one. */
export function unlockAudio() {
  audio();
}

export function toggleMute(): boolean {
  muted = !muted;
  const { ctx, master } = audio();
  master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
  return muted;
}

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noise(seconds: number, filter: BiquadFilterType, from: number, to: number, volume: number) {
  const { ctx, master } = audio();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, seconds);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  src.connect(f).connect(g).connect(master);
  src.start();
}

function zap(from: number, to: number, seconds: number, volume: number, type: OscillatorType) {
  const { ctx, master } = audio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + seconds);
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + seconds);
}

export const sfx = {
  laser: () => zap(1400, 180, 0.12, 0.09, 'square'),
  enemyLaser: () => zap(700, 120, 0.15, 0.06, 'sawtooth'),
  hit: () => noise(0.12, 'highpass', 3000, 1200, 0.5),
  thud: () => noise(0.5, 'lowpass', 600, 60, 0.9),
  scrape: () => noise(0.8, 'bandpass', 2500, 300, 0.6),
  tunnel: () => noise(1.6, 'bandpass', 200, 3000, 0.35),
  explosion: () => noise(2.2, 'lowpass', 1800, 40, 1),
  beep: () => {
    const { ctx, master } = audio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.12);
  },
};

// --- The Blue Danube (Johann Strauss II, 1866) ------------------------------
// A simplified arrangement of the famous waltz theme in D major.

type Note = [midi: number, beats: number]; // midi 0 = rest
const R = 0;

function phrase(lo: [number, number, number], hi1: number, hi2: number): Note[] {
  const [a, b, c] = lo;
  return [
    [a, 1], [a, 1], [b, 1],
    [c, 2], [R, 1],
    [hi1, 1], [hi1, 1], [R, 1],
    [hi2, 1], [hi2, 1], [R, 1],
  ];
}

const MELODY: Note[] = [
  ...phrase([62, 66, 69], 81, 78),
  ...phrase([62, 66, 69], 83, 79),
  ...phrase([61, 64, 71], 83, 79),
  ...phrase([61, 64, 71], 81, 78),
  ...phrase([62, 66, 74], 86, 81),
  ...phrase([62, 66, 74], 88, 83),
  [76, 1], [79, 1], [83, 1],
  [83, 2], [R, 1],
  [81, 1], [78, 1], [76, 1],
  [74, 2], [R, 1],
];

// One chord per bar: [bass, chord tone, chord tone]. Oom-pah-pah.
const D: [number, number, number] = [50, 66, 69];
const A7: [number, number, number] = [45, 67, 73];
const G: [number, number, number] = [43, 67, 71];
const BARS = [D, D, D, D, D, D, D, D, A7, A7, A7, A7, A7, A7, A7, D, D, D, D, D, G, G, G, G, A7, A7, A7, D];

const BEAT = 0.34; // seconds

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);


function tone(bus: GainNode, midi: number, at: number, length: number, type: OscillatorType, volume: number) {
  const { ctx } = audio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq(midi);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(volume, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, at + length);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + length + 0.05);
}

function scheduleLoop(bus: GainNode, start: number): number {
  let t = start;
  for (const [midi, beats] of MELODY) {
    if (midi) tone(bus, midi, t, beats * BEAT * 1.1, 'triangle', 0.22);
    t += beats * BEAT;
  }
  BARS.forEach(([bass, c1, c2], i) => {
    const bar = start + i * 3 * BEAT;
    tone(bus, bass, bar, BEAT * 1.2, 'sine', 0.3);
    for (const beat of [1, 2]) {
      tone(bus, c1 - 12, bar + beat * BEAT, BEAT * 0.6, 'sine', 0.1);
      tone(bus, c2 - 12, bar + beat * BEAT, BEAT * 0.6, 'sine', 0.1);
    }
  });
  return t - start;
}

let playing: { bus: GainNode; timer: number; recording?: HTMLAudioElement } | null = null;

// --- The orchestral recording (neo-vector mode) -----------------------------
// A real performance, streamed. See public/audio/CREDITS.md for its source and
// licence. 1984 mode keeps the chiptune arrangement above.

const RECORDING_URL = '/audio/blue-danube.mp3';
/** Seconds into the recording where the waltz proper begins, after the slow introduction. */
const RECORDING_START = 66;

let recording: { el: HTMLAudioElement; node: MediaElementAudioSourceNode } | null = null;

function recordingSource() {
  if (!recording) {
    const { ctx } = audio();
    const el = new Audio(RECORDING_URL);
    el.preload = 'auto';
    el.loop = true;
    recording = { el, node: ctx.createMediaElementSource(el) };
  }
  return recording;
}

/** Start fetching the recording early so it is ready when the docking computer engages. */
export function preloadRecording() {
  recordingSource().el.load();
}

export const danube = {
  start(orchestral: boolean) {
    if (playing) return;
    const { ctx, master } = audio();
    const bus = ctx.createGain();
    bus.connect(master);

    if (orchestral) {
      const { el, node } = recordingSource();
      node.disconnect();
      node.connect(bus);
      bus.gain.setValueAtTime(0, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
      el.currentTime = RECORDING_START;
      playing = { bus, timer: 0, recording: el };
      el.play().catch(() => {
        // Recording unavailable (offline, blocked): fall back to the synth.
        if (playing?.recording !== el) return;
        playing = null;
        bus.disconnect();
        danube.start(false);
      });
      return;
    }

    bus.gain.value = 0.9;
    let next = ctx.currentTime + 0.1;
    const loop = () => {
      next += scheduleLoop(bus, next);
      if (playing) playing.timer = window.setTimeout(loop, (next - ctx.currentTime - 1) * 1000);
    };
    playing = { bus, timer: 0 };
    loop();
  },
  stop() {
    if (!playing) return;
    const { ctx } = audio();
    clearTimeout(playing.timer);
    const { bus, recording: el } = playing;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => {
      // Don't pause if the docking computer was re-engaged in the meantime.
      if (el && playing?.recording !== el) el.pause();
      bus.disconnect();
    }, 2500);
    playing = null;
  },
};
