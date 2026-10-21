import { audioGraph, noiseBuffer } from './sound';

// The sound of a witchspace rift: a deep, detuned drone that builds for as
// long as the rift is opening. The filter slowly opens, a throb quickens and
// a thin whine climbs above it, so you hear the tension mount before
// anything comes through. Then breach() for the moment it does.

export interface Drone {
  /** Fade out and stop. */
  stop(fade?: number): void;
}

export function riftDrone(seconds: number): Drone {
  const { ctx, master } = audioGraph();
  const now = ctx.currentTime;
  const end = now + seconds;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.08, now + seconds * 0.3);
  out.gain.exponentialRampToValueAtTime(0.26, end);
  out.connect(master);

  // The throb: a tremolo that quickens as the rift opens.
  const throb = ctx.createGain();
  throb.gain.value = 0.7;
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(0.35, now);
  lfo.frequency.exponentialRampToValueAtTime(5, end);
  const depth = ctx.createGain();
  depth.gain.value = 0.3;
  lfo.connect(depth).connect(throb.gain);
  throb.connect(out);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 7;
  filter.frequency.setValueAtTime(80, now);
  filter.frequency.exponentialRampToValueAtTime(1300, end);
  filter.connect(throb);

  // Detuned saws a fifth apart, gliding up a fourth, over a sub.
  const voices: OscillatorNode[] = [lfo];
  const voice = (type: OscillatorType, hz: number, gain: number, rise: number, to: AudioNode) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, now);
    o.frequency.exponentialRampToValueAtTime(hz * rise, end);
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(to);
    voices.push(o);
    return g;
  };
  voice('sawtooth', 36.7, 0.5, 1.33, filter);
  voice('sawtooth', 37.2, 0.5, 1.33, filter);
  voice('sawtooth', 55, 0.3, 1.33, filter);
  voice('sine', 27.5, 0.9, 1.33, throb);

  // The whine: faint at first, climbing an octave over the last half.
  for (const hz of [880, 887]) {
    const g = voice('sine', hz, 0, 2, out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0, now + seconds * 0.45);
    g.gain.linearRampToValueAtTime(0.05, end);
  }

  // A low crackle of static, like the rift straining.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx, 2);
  hiss.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 3;
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0, now);
  hissGain.gain.linearRampToValueAtTime(0.08, end);
  hiss.connect(band).connect(hissGain).connect(out);

  const sources: AudioScheduledSourceNode[] = [...voices, hiss];
  for (const s of sources) {
    s.start(now);
    s.stop(end + 0.6);
  }
  let stopped = false;
  return {
    stop(fade = 0.4) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      for (const s of sources) {
        try {
          s.stop(t + fade + 0.05);
        } catch {
          // Already stopped.
        }
      }
    },
  };
}

/** Something huge breaking through: a deep boom, a falling roar and a ring of metal. */
export function riftBreach() {
  const { ctx, master } = audioGraph();
  const now = ctx.currentTime;

  const boom = ctx.createOscillator();
  boom.frequency.setValueAtTime(110, now);
  boom.frequency.exponentialRampToValueAtTime(24, now + 1.8);
  const boomGain = ctx.createGain();
  boomGain.gain.setValueAtTime(0.0001, now);
  boomGain.gain.exponentialRampToValueAtTime(0.7, now + 0.04);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
  boom.connect(boomGain).connect(master);

  const roar = ctx.createBufferSource();
  roar.buffer = noiseBuffer(ctx, 3.5);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(2600, now);
  low.frequency.exponentialRampToValueAtTime(70, now + 3.4);
  const roarGain = ctx.createGain();
  roarGain.gain.setValueAtTime(0.55, now);
  roarGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
  roar.connect(low).connect(roarGain).connect(master);

  const ring = ctx.createOscillator();
  ring.type = 'sawtooth';
  ring.frequency.setValueAtTime(330, now);
  ring.frequency.exponentialRampToValueAtTime(82, now + 2.5);
  const ringBand = ctx.createBiquadFilter();
  ringBand.type = 'bandpass';
  ringBand.frequency.value = 600;
  ringBand.Q.value = 8;
  const ringGain = ctx.createGain();
  ringGain.gain.setValueAtTime(0.12, now);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
  ring.connect(ringBand).connect(ringGain).connect(master);

  for (const s of [boom, roar, ring]) {
    s.start(now);
    s.stop(now + 3.6);
  }
}
