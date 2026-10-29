// The flight recorder (docs/design/flight-recorder.md, stage 2): every ship's
// black box. While flying, the view is encoded (H.264, in the browser with
// WebCodecs: HD, 720p at 30 fps, stepping down to 480p at 24 fps on a device
// that can't keep up) into a rolling buffer of the last minute, held in
// memory (a few MB). Nothing is written until a moment happens (a kill, a Legend, the
// Marshals, a discovery, your death, or you keep it yourself); then the
// seconds around it become an MP4 for the flight log. Where WebCodecs or
// H.264 aren't available, the recorder simply isn't there.

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

const SECONDS = 60; // what the buffer holds: the longest clip (a whole fight)
const CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f'];

// Adaptive quality (Mark): every device starts in HD. Copying and encoding the
// view is real work, so if the game's frame rate sags while recording (under
// SLOW_FPS for STRUGGLE seconds), the recorder steps down to SD: about 60% less
// work, and still sharp on a phone's screen. The device remembers, and the
// flight log offers to try HD again.
export type Quality = 'hd' | 'sd';
const QUALITY: Record<Quality, { height: number; fps: number; bitrate: number }> = {
  hd: { height: 720, fps: 30, bitrate: 1_200_000 }, // glowing lines on black: half of what a busy scene needs
  sd: { height: 480, fps: 24, bitrate: 700_000 },
};
const SLOW_FPS = 40;
const STRUGGLE = 4; // seconds
const WARM_UP = 5; // seconds of recording before judging (the first frames are always slow)
const QUALITY_KEY = 'witchspace-recorder-quality';
// H.264 needs even dimensions: 480 × 16/9 is 853.3, and Safari refuses 853 (so
// iPhones said they couldn't record). Ask for the size we'll really encode.
const probeWidth = (q: Quality) => Math.round((QUALITY[q].height * 16) / 9) & ~1;
const remembered = (): Quality => {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'sd' ? 'sd' : 'hd';
  } catch {
    return 'hd';
  }
};

interface Chunk {
  chunk: EncodedVideoChunk;
  /** Media time, in seconds: advances only while recording, so pauses (docked, the tunnel) leave no gap. */
  t: number;
  key: boolean;
}

interface Pending<M> {
  start: number;
  end: number;
  meta: M;
  poster: Promise<Blob | null>;
  done: (clip: Clip<M> | null) => void;
}

export interface Clip<M> {
  video: Blob;
  poster: Blob | null;
  seconds: number;
  meta: M;
}

export class FlightRecorder<M> {
  private encoder: VideoEncoder | null = null;
  private config: VideoEncoderConfig | null = null;
  private decoderConfig: VideoDecoderConfig | null = null;
  private frame: OffscreenCanvas | null = null;
  private chunks: Chunk[] = [];
  private pending: Pending<M>[] = [];
  private mediaTime = 0;
  private sinceFrame = 1;
  private frames = 0;
  private broken = false;
  /** Encoder failures this session: iOS can take the encoder away while the app is in the background, so a few are tried again. */
  private failures = 0;
  /** Resting (nothing about): the next frame recorded starts afresh with a keyframe. */
  private rested = false;
  private codec: string | null = null;
  /** Why it can't record, if it can't: for the message the player sees. */
  why = '';
  /** HD or SD, as this device manages (see QUALITY). */
  quality: Quality = remembered();
  /** HD isn't possible here at all (no encoder for it): SD it is, and no offer to try HD again. */
  hdUnsupported = false;
  private smooth = 1 / 60; // the game's frame time, smoothed
  private recorded = 0; // seconds recorded at this quality
  private slowFor = 0;
  /** Whether this browser can record at all (decided once, asynchronously). */
  ready: Promise<boolean>;

  constructor(private enabled: () => boolean) {
    this.ready = this.probe();
  }

  private async probe(): Promise<boolean> {
    if (typeof VideoEncoder === 'undefined') return (this.why = 'no video encoder in this browser (Safari 16.4 or later has one)'), false;
    if (typeof OffscreenCanvas === 'undefined') return (this.why = 'no OffscreenCanvas in this browser'), false;
    // HD if this browser can encode it, else SD.
    for (const q of ['hd', 'sd'] as Quality[]) {
      const { height, fps, bitrate } = QUALITY[q];
      for (const codec of CODECS) {
        try {
          const r = await VideoEncoder.isConfigSupported({ codec, width: probeWidth(q), height, bitrate, framerate: fps });
          if (r.supported) {
            this.codec = codec;
            if (q === 'sd') {
              this.quality = 'sd';
              this.hdUnsupported = true;
            }
            return true;
          }
        } catch {
          /* try the next */
        }
      }
    }
    this.why = `no H.264 encoder for ${probeWidth('sd')}×${QUALITY.sd.height}`;
    return false;
  }

  /** Try HD again (from the flight log), after it stepped down. */
  tryHd() {
    if (this.hdUnsupported) return;
    this.setQuality('hd');
  }

  private setQuality(q: Quality) {
    this.quality = q;
    this.recorded = 0;
    this.slowFor = 0;
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      /* storage blocked: decided again next time */
    }
  }

  /** Watch the game's frame rate while recording in HD; if it sags, step down to SD (between clips, never in one). */
  private judge(dt: number) {
    this.smooth += (Math.min(dt, 0.25) - this.smooth) * 0.05;
    this.recorded += dt;
    if (this.quality !== 'hd' || this.recorded < WARM_UP) return;
    this.slowFor = this.smooth > 1 / SLOW_FPS ? this.slowFor + dt : 0;
    if (this.slowFor >= STRUGGLE && !this.pending.length) this.setQuality('sd');
  }

  /** The recorder's clock, in seconds of recorded flight: what keep()'s `before` counts back from. */
  get time() {
    return this.mediaTime;
  }

  get available() {
    return this.codec !== null && !this.broken;
  }

  /**
   * Call right after the frame is drawn (a WebGL canvas is blank once the task ends). dt in seconds.
   * While `resting` (nothing about: see recorderWatch.ts) nothing is recorded, unless a clip is
   * still being finished, so the buffer holds the last minute worth having, not a minute of black.
   */
  capture(canvas: HTMLCanvasElement, dt: number, resting = false) {
    if (!this.available || !this.enabled() || canvas.width < 2 || canvas.height < 2) return;
    if (resting && !this.pending.length) {
      this.rested = true;
      return;
    }
    this.mediaTime += Math.min(dt, 0.1);
    this.judge(dt);
    const { height: HEIGHT, fps: FPS } = QUALITY[this.quality];
    this.sinceFrame += dt;
    if (this.sinceFrame < 1 / FPS - 0.002) return;
    this.sinceFrame = 0;
    const height = Math.min(HEIGHT, canvas.height) & ~1;
    const width = Math.round((height * canvas.width) / canvas.height) & ~1;
    // A fresh encoder when the size changes, or when the phone closed the last one while the app was away.
    if (!this.encoder || this.encoder.state === 'closed' || this.config?.width !== width || this.config?.height !== height) this.start(width, height);
    if (!this.encoder || this.encoder.state !== 'configured') return;
    if (this.encoder.encodeQueueSize > 4) return; // falling behind: drop a frame rather than lag the game
    const g = this.frame!.getContext('2d')!;
    g.drawImage(canvas, 0, 0, width, height);
    const frame = new VideoFrame(this.frame!, { timestamp: Math.round(this.mediaTime * 1e6), duration: Math.round(1e6 / FPS) });
    if (this.rested) this.frames = 0; // waking: a keyframe, so the cut to the new scene is clean
    this.rested = false;
    this.encoder.encode(frame, { keyFrame: this.frames++ % FPS === 0 });
    frame.close();
    void this.finishDue();
  }

  private start(width: number, height: number) {
    this.encoder?.close();
    this.chunks = [];
    this.frames = 0;
    this.frame = new OffscreenCanvas(width, height);
    const { fps, bitrate } = QUALITY[this.quality];
    this.config = { codec: this.codec!, width, height, bitrate, framerate: fps, latencyMode: 'realtime', hardwareAcceleration: 'prefer-hardware', avc: { format: 'avc' } };
    try {
      this.encoder = new VideoEncoder({
        output: (chunk, meta) => {
          if (meta?.decoderConfig) this.decoderConfig = meta.decoderConfig;
          this.chunks.push({ chunk, t: chunk.timestamp / 1e6, key: chunk.type === 'key' });
          this.trim();
        },
        error: (e) => {
          // The encoder gave up (on a phone, often the app went to the background): start a fresh one on the
          // next frame, and only after a few failures carry on without a recorder.
          this.broken = ++this.failures >= 3;
          this.why = `the video encoder stopped (${e?.message || 'error'})`;
          this.encoder = null;
        },
      });
      this.encoder.configure(this.config);
    } catch (e) {
      this.broken = true;
      this.why = `the video encoder wouldn't start (${(e as Error)?.message || 'error'})`;
      this.encoder = null;
    }
  }

  /** Keep the last SECONDS, cut at a keyframe so any clip can start cleanly. */
  private trim() {
    const newest = this.chunks[this.chunks.length - 1].t;
    const oldestNeeded = Math.min(newest - SECONDS, ...this.pending.map((p) => p.start));
    let cut = 0;
    for (let i = 1; i < this.chunks.length; i++) {
      if (this.chunks[i].key) {
        if (this.chunks[i].t <= oldestNeeded) cut = i;
        else break;
      }
    }
    if (cut) this.chunks.splice(0, cut);
  }

  /**
   * Keep the seconds around now: `before` seconds back, `after` seconds on.
   * A moment that lands while another is still being recorded joins it (merge
   * decides how the two metas combine). Resolves with the clip, or null if
   * there was nothing to keep.
   */
  keep(meta: M, before: number, after: number, merge: (a: M, b: M) => M): Promise<Clip<M> | null> {
    if (!this.available || !this.enabled()) return Promise.resolve(null);
    const now = this.mediaTime;
    const open = this.pending.find((p) => p.end >= now - 1);
    if (open) {
      open.meta = merge(open.meta, meta);
      open.end = Math.min(Math.max(open.end, now + after), open.start + SECONDS);
      return new Promise((resolve) => {
        const prev = open.done;
        open.done = (clip) => {
          prev(clip);
          resolve(clip);
        };
      });
    }
    return new Promise((resolve) => {
      this.pending.push({ start: Math.max(0, now - before), end: now + after, meta, poster: poster(this.frame), done: resolve });
      if (after <= 0) void this.finishDue(true);
    });
  }

  /** Stop capturing for now (docked, the title screen): anything being recorded is finished with what there is. */
  pause() {
    void this.finishDue(true);
  }

  private async finishDue(all = false) {
    const due = this.pending.filter((p) => all || this.mediaTime >= p.end);
    if (!due.length) return;
    this.pending = this.pending.filter((p) => !due.includes(p));
    if (this.encoder?.state === 'configured') await this.encoder.flush().catch(() => {});
    for (const p of due) p.done(await this.mux(p));
  }

  private async mux(p: Pending<M>): Promise<Clip<M> | null> {
    if (!this.decoderConfig || !this.config) return null;
    let first = -1;
    for (let i = 0; i < this.chunks.length; i++) {
      if (this.chunks[i].t > p.start) break;
      if (this.chunks[i].key) first = i;
    }
    if (first < 0) first = this.chunks.findIndex((c) => c.key);
    if (first < 0) return null;
    const take = this.chunks.slice(first).filter((c) => c.t <= p.end + 0.001);
    const fps = this.config.framerate ?? 30;
    if (take.length < fps / 2) return null; // under half a second: nothing worth keeping
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: 'avc', width: this.config.width, height: this.config.height, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    take.forEach((c, i) => muxer.addVideoChunk(c.chunk, i === 0 ? { decoderConfig: this.decoderConfig! } : undefined));
    muxer.finalize();
    return { video: new Blob([target.buffer], { type: 'video/mp4' }), poster: await p.poster, seconds: take[take.length - 1].t - take[0].t, meta: p.meta };
  }
}

/** A still of the moment, for the flight log: from the recorder's own copy of the latest frame (the game's canvas is blank between frames). */
function poster(frame: OffscreenCanvas | null): Promise<Blob | null> {
  if (!frame) return Promise.resolve(null);
  const w = 480;
  const h = Math.round((w * frame.height) / frame.width);
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d')!.drawImage(frame, 0, 0, w, h);
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.8 }).catch(() => null);
}
