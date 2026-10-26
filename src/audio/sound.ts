// Sound effects are synthesised with Web Audio. The recordings are the United
// States Marine Band's, in neo-vector mode: the Blue Danube when the docking
// computer flies, and the music cues below (see public/audio/CREDITS.md).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
// Sound modes, cycled with N: everything, effects without the engine drone, or off.
export type SoundMode = 'full' | 'effects' | 'off';
const SOUND_MODES: SoundMode[] = ['full', 'effects', 'off'];
let soundMode: SoundMode = (() => {
  try {
    const v = localStorage.getItem('witchspace.sound') as SoundMode | null;
    return v && SOUND_MODES.includes(v) ? v : 'full';
  } catch {
    return 'full';
  }
})();
export const getSoundMode = () => soundMode;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = soundMode === 'off' ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  // iOS also has 'interrupted' (the Home Screen app was left, the phone
  // locked, a call came in), and it stays that way until resumed.
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  return { ctx, master: master! };
}

/** Shared audio graph for other sound modules (see spatial.ts). */
export const audioGraph = () => audio();

/** Browsers only allow audio after a user gesture; call this from one. */
export function unlockAudio() {
  const { ctx } = audio();
  if (unlocked) return;
  unlocked = true;
  // Older iOS only unlocks once a sound has started inside the gesture.
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  src.connect(ctx.destination);
  src.start();
}
let unlocked = false;

// Every tap, click or key press revives the sound (touch flight controls use
// pointerdown, which iOS doesn't count as a gesture, so listen for the ends).
for (const type of ['touchend', 'pointerup', 'click', 'keydown'] as const) {
  addEventListener(type, () => ctx?.state !== 'running' && unlockAudio(), { capture: true, passive: true });
}
// Back from the Home Screen or the lock screen: try at once (the next tap does it if not).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
});

export function cycleSoundMode(): SoundMode {
  soundMode = SOUND_MODES[(SOUND_MODES.indexOf(soundMode) + 1) % SOUND_MODES.length];
  try {
    localStorage.setItem('witchspace.sound', soundMode);
  } catch {
    // Not saved; applies for this session.
  }
  const { ctx, master } = audio();
  master.gain.setTargetAtTime(soundMode === 'off' ? 0 : 0.5, ctx.currentTime, 0.05);
  return soundMode;
}

export function noiseBuffer(ctx: AudioContext, seconds: number) {
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
  hyperspace: () => {
    noise(3.4, 'bandpass', 160, 2600, 0.28);
    zap(55, 220, 3.2, 0.06, 'sine');
  },
  /** A camera shutter: two quick clicks. */
  shutter: () => {
    noise(0.04, 'highpass', 4000, 3000, 0.35);
    setTimeout(() => noise(0.05, 'highpass', 3000, 2000, 0.25), 70);
  },
  /**
   * In-system jump: a soft whoosh that swells in and climbs, like a short
   * hyperspace. (It used to be a falling burst of noise, too like a scrape.)
   */
  jump: () => {
    const { ctx, master } = audio();
    const t = ctx.currentTime;
    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer(ctx, 1.1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.8);
    const ag = ctx.createGain();
    ag.gain.setValueAtTime(0.001, t);
    ag.gain.exponentialRampToValueAtTime(0.3, t + 0.35);
    ag.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
    air.connect(f).connect(ag).connect(master);
    air.start(t);
    const tone = ctx.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(110, t);
    tone.frequency.exponentialRampToValueAtTime(440, t + 0.8);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.001, t);
    tg.gain.exponentialRampToValueAtTime(0.07, t + 0.3);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 1);
    tone.connect(tg).connect(master);
    tone.start(t);
    tone.stop(t + 1.05);
  },
  tick: () => zap(1200, 1100, 0.05, 0.05, 'square'),
  explosion: () => noise(2.2, 'lowpass', 1800, 40, 1),
  /** Missile lock: two rising notes. */
  lock: () => {
    zap(660, 660, 0.08, 0.05, 'square');
    setTimeout(() => zap(990, 990, 0.1, 0.05, 'square'), 90);
  },
  /**
   * Missile away: a dull clunk as it drops off the rail, then the motor
   * catches with a roar that brightens and fades as it pulls away.
   */
  missileLaunch: () => {
    const { ctx, master } = audio();
    const t = ctx.currentTime;
    const clunk = ctx.createOscillator();
    const cg = ctx.createGain();
    clunk.type = 'sine';
    clunk.frequency.setValueAtTime(150, t);
    clunk.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    cg.gain.setValueAtTime(0.35, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    clunk.connect(cg).connect(master);
    clunk.start(t);
    clunk.stop(t + 0.22);

    const ignite = t + 0.14;
    const length = 1.8;
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(ctx, length);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(250, ignite);
    f.frequency.exponentialRampToValueAtTime(3800, ignite + 0.35);
    f.frequency.exponentialRampToValueAtTime(600, ignite + length);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.0001, ignite);
    hg.gain.exponentialRampToValueAtTime(0.4, ignite + 0.06);
    hg.gain.setTargetAtTime(0.0001, ignite + 0.35, 0.4);
    hiss.connect(f).connect(hg).connect(master);
    hiss.start(ignite);
    hiss.stop(ignite + length);

    const rumble = ctx.createOscillator();
    const rg = ctx.createGain();
    rumble.type = 'triangle';
    rumble.frequency.setValueAtTime(70, ignite);
    rumble.frequency.exponentialRampToValueAtTime(40, ignite + 1.2);
    rg.gain.setValueAtTime(0.0001, ignite);
    rg.gain.exponentialRampToValueAtTime(0.18, ignite + 0.05);
    rg.gain.exponentialRampToValueAtTime(0.0001, ignite + 1.2);
    rumble.connect(rg).connect(master);
    rumble.start(ignite);
    rumble.stop(ignite + 1.3);
  },
  /** The seeker growling as it closes on a ship: higher as it gets nearer a lock. */
  seek: (progress: number) => {
    const f = 480 + 520 * Math.min(1, progress);
    zap(f, f, 0.05, 0.035, 'square');
  },
  /** Missile lock (Modern): one solid tone. Fire. */
  lockTone: () => zap(1040, 1040, 0.5, 0.045, 'square'),
  /** Incoming missile: a short, insistent warble. */
  incoming: () => {
    zap(1300, 900, 0.09, 0.05, 'square');
    setTimeout(() => zap(1300, 900, 0.09, 0.05, 'square'), 140);
  },
  ecm: () => {
    zap(200, 3200, 0.5, 0.06, 'sawtooth');
    noise(0.6, 'highpass', 6000, 2000, 0.25);
  },
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
    music.stop(); // the waltz takes over
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

// --- Music cues: the Marine Band for the galaxy's big moments ----------------
// Streamed recordings (public/audio/CREDITS.md), for neo-vector mode with the
// sound full on: Sousa's "Semper Fidelis" when the Co-operative Marshals come
// through a rift, and Berlioz's "Dream of a Witches' Sabbath" when the
// Falcon's hull is read. Each fades in, plays once, and fades out when the
// moment is over.

export type Cue = 'marshals' | 'falcon';
const CUES: Record<Cue, { url: string; gain: number }> = {
  marshals: { url: '/audio/semper-fidelis.mp3', gain: 0.7 },
  falcon: { url: '/audio/witches-sabbath.mp3', gain: 1 },
};
const cueSources = new Map<Cue, { el: HTMLAudioElement; node: MediaElementAudioSourceNode }>();
let cueOn: { name: Cue; el: HTMLAudioElement; bus: GainNode } | null = null;

export const music = {
  /** Play a cue from the start, unless it's already playing, the docking waltz is, or sound isn't full on. */
  play(name: Cue, orchestral: boolean) {
    if (!orchestral || soundMode !== 'full' || playing || cueOn?.name === name) return;
    music.stop();
    const { ctx, master } = audio();
    let src = cueSources.get(name);
    if (!src) {
      const el = new Audio(CUES[name].url);
      el.preload = 'auto';
      src = { el, node: ctx.createMediaElementSource(el) };
      cueSources.set(name, src);
    }
    const bus = ctx.createGain();
    bus.connect(master);
    src.node.disconnect();
    src.node.connect(bus);
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(CUES[name].gain, ctx.currentTime + 2);
    const el = src.el;
    el.currentTime = 0;
    const on = { name, el, bus };
    cueOn = on;
    el.onended = () => cueOn === on && music.stop();
    el.play().catch(() => cueOn === on && music.stop()); // offline or blocked: silence, as before
  },
  /** Fade a cue out (any cue, or only `name` if it's the one playing). */
  stop(name?: Cue) {
    if (!cueOn || (name && cueOn.name !== name)) return;
    const { ctx } = audio();
    const { el, bus } = cueOn;
    cueOn = null;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
    setTimeout(() => {
      if (cueOn?.el !== el) el.pause();
      bus.disconnect();
    }, 4000);
  },
  /** The cue playing, if any. */
  get playing(): Cue | null {
    return cueOn?.name ?? null;
  },
};

