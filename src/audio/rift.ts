import { audioGraph, noiseBuffer } from './sound';

// The sound of a witchspace rift: a deep, detuned drone that builds for as
// long as the rift is opening. The filter slowly opens, a throb quickens and
// a thin whine climbs above it, so you hear the tension mount before
// anything comes through. Then riftGroan() as it does, and riftClose()
// as the rift shuts. No bangs: this is space.

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

/**
 * Something huge coming through: no bang (this is space), but a deep groan
 * that bends slowly downwards, as if space itself were straining.
 */
export function riftGroan(seconds: number) {
  const { ctx, master } = audioGraph();
  const now = ctx.currentTime;
  const end = now + seconds;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.2, now + 1.5);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 9;
  filter.frequency.setValueAtTime(700, now);
  filter.frequency.exponentialRampToValueAtTime(90, end);
  filter.connect(out).connect(master);
  const voices = [49, 49.6, 73.4].map((hz) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz, now);
    o.frequency.exponentialRampToValueAtTime(hz / 2, end);
    o.connect(filter);
    return o;
  });
  for (const o of voices) {
    o.start(now);
    o.stop(end + 0.1);
  }
}

/**
 * The rift closing: a soft rising inhale of air that cuts off dead into
 * silence, as though the hole had sucked itself shut.
 */
export function riftClose() {
  const { ctx, master } = audioGraph();
  const now = ctx.currentTime;
  const rise = 1.3;
  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, rise + 0.1);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.5;
  band.frequency.setValueAtTime(250, now);
  band.frequency.exponentialRampToValueAtTime(3500, now + rise);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + rise);
  g.gain.setValueAtTime(0.0001, now + rise + 0.02); // cut dead
  air.connect(band).connect(g).connect(master);
  air.start(now);
  air.stop(now + rise + 0.1);
}
