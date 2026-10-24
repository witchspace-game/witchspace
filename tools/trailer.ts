// Cuts the trailer, frame by frame, from the clips and stills that
// tools/press-shots.mjs makes, over the Blue Danube (the U.S. Marine Band's
// public-domain recording the game already plays). Encodes H.264 and AAC in
// the browser and hands the MP4 to tools/press-video.mjs.
//
// The trailer (16:9, about a minute), a social cut (16:9, about 25 s), a
// vertical cut for phones and stories (9:16), and short films with one idea
// each: docking, the Falcon, a fight, the Bastion, building.

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

const FPS = 30;
const FADE = 0.4; // seconds of crossfade between shots
const GREEN = '#3dffb0';
const INK = '#eef3fa';

type Shot = {
  /** A clip (seconds into it from `from`), a still (with a slow push in), or a card. */
  clip?: string;
  still?: string;
  from?: number;
  /** Seconds on screen. */
  len: number;
  /** Still push-in: scale from → to, about a focus point (0..1). */
  zoom?: [number, number];
  focus?: [number, number];
  /** A word for the section, large, as it begins (TRADE, FIGHT...). */
  label?: string;
  caption?: string;
  /** Phones: up to three stills side by side. */
  phones?: string[];
  card?: 'title' | 'end';
  /** Play a clip faster (2 = double speed). */
  speed?: number;
  /** Captions at times within the shot: [from, to, text]. */
  lines?: [number, number, string][];
};

const CLIP = (name: string) => `/press-shots/video/${name}.mp4`;
const SHOT = (path: string) => `/press-shots/${path}`;

const TRAILER: Shot[] = [
  { clip: 'clip-station', len: 6, card: 'title' },
  { still: SHOT('run5/market-00.jpg'), len: 4.2, zoom: [1.0, 1.18], focus: [0.42, 0.42], label: 'Trade', caption: 'Read the news. Work the markets.' },
  { still: SHOT('news-00.jpg'), len: 3, zoom: [1.05, 1.2], focus: [0.12, 0.45], caption: 'News travels at the speed of ships.' },
  { clip: 'clip-pack', from: 0.4, len: 6, label: 'Fight', caption: 'Pirates hunt in packs.' },
  { clip: 'clip-falcon', len: 3.8, caption: 'And some of them are Legends.' },
  { clip: 'clip-jump', from: 0.2, len: 5.2, label: 'Explore', caption: 'Eight galaxies. 2,048 worlds each.' },
  { clip: 'clip-survey', len: 4.5, caption: 'Survey them. Put your name on the chart.' },
  { clip: 'clip-yard', len: 6.5, label: 'Build', caption: 'Help build the galaxy you fly in.' },
  { clip: 'clip-look', len: 5.5, caption: 'Neo-vector, or 1984. One key.' },
  { phones: [SHOT('run5/phone-market.jpg'), SHOT('run5/phone-docked.jpg'), SHOT('run5/phone-news.jpg')], len: 4.2, caption: 'On any screen.' },
  { len: 5.5, card: 'end' },
];

const SOCIAL: Shot[] = [
  { clip: 'clip-station', from: 1, len: 3.5, card: 'title' },
  { clip: 'clip-pack', from: 2.6, len: 4, label: 'Fight' },
  { still: SHOT('run5/market-00.jpg'), len: 3, zoom: [1.0, 1.15], focus: [0.42, 0.42], label: 'Trade' },
  { clip: 'clip-survey', from: 0.5, len: 3, label: 'Explore' },
  { clip: 'clip-yard', from: 1.5, len: 3.5, label: 'Build' },
  { clip: 'clip-look', from: 1.5, len: 3.5, caption: 'Neo-vector, or 1984. One key.' },
  { len: 4.5, card: 'end' },
];

// Phones: the clips cropped to the middle, and the phone screens full frame.
const VERTICAL: Shot[] = [
  { clip: 'clip-station', from: 1, len: 3.5, card: 'title' },
  { clip: 'clip-pack', from: 2.6, len: 4, label: 'Fight' },
  { still: SHOT('run5/phone-market.jpg'), len: 3, zoom: [1.0, 1.08], focus: [0.5, 0.3], label: 'Trade' },
  { clip: 'clip-jump', from: 0.2, len: 3.2, label: 'Explore' },
  { clip: 'clip-yard', from: 2, len: 3.5, label: 'Build' },
  { clip: 'clip-look', from: 1.5, len: 3.5, caption: 'Neo-vector, or 1984.' },
  { len: 4.5, card: 'end' },
];

// Short films, one idea each.
const DOCK: Shot[] = [
  { clip: 'clip-dock', from: 0.5, len: 15.5, speed: 1.5, card: 'title', lines: [[7, 12.5, 'The docking computer.']] },
  { clip: 'clip-dock', from: 22.5, len: 14.5, lines: [[1, 6.5, 'And yes, it plays the Blue Danube.'], [9, 13.5, 'Docked. Right on, Commander.']] },
  { len: 5, card: 'end' },
];

const FALCON: Shot[] = [
  { clip: 'clip-falcon-dark', len: 7.1, lines: [[0.3, 2.6, "Something's out there, running dark."], [3, 6.8, 'Hull read: the Falcon.']] },
  { clip: 'clip-falcon', len: 3.8, caption: 'The one the haulers warn you about.' },
  { len: 5, card: 'end' },
];

const FIGHT: Shot[] = [
  { clip: 'clip-pack', from: 0.4, len: 6, caption: 'Pirates hunt in packs.' },
  { clip: 'clip-fight', from: 0.3, len: 4.6, caption: 'Military lasers, all round.' },
  { clip: 'clip-falcon', len: 3.6, caption: 'Every kill has a price on it.' },
  { len: 5, card: 'end' },
];

const BASTION: Shot[] = [
  { clip: 'clip-bastion', from: 3, len: 9.8, speed: 3, lines: [[0.8, 4.6, 'Break the law badly enough...'], [5.2, 9.4, '...and the Co-operative Marshals come for you.']] },
  { clip: 'clip-bastion', from: 31, len: 21, lines: [[2, 7, 'Through a witchspace rift.'], [12, 18, 'The Bastion. And its Lancers.']] },
  { len: 5, card: 'end' },
];

const BUILD: Shot[] = [
  { clip: 'clip-yard', len: 7, caption: "Wexley-Yorozu's Titanoboa builds stations." },
  { clip: 'clip-yard-station', len: 6, speed: 1.3, caption: 'Stage by stage, over days, where everyone can see.' },
  { still: SHOT('news-00.jpg'), len: 4, zoom: [2.6, 2.85], focus: [0.07, 0.33], caption: 'It makes the news.' },
  { len: 5, card: 'end' },
];

// music: seconds into the recording to start from (66 is where the waltz proper begins).
const CUTS = {
  trailer: { shots: TRAILER, w: 1920, h: 1080, music: 66 },
  social: { shots: SOCIAL, w: 1920, h: 1080, music: 66 },
  vertical: { shots: VERTICAL, w: 1080, h: 1920, music: 66 },
  docking: { shots: DOCK, w: 1920, h: 1080, music: 66 },
  falcon: { shots: FALCON, w: 1920, h: 1080, music: 150 },
  fight: { shots: FIGHT, w: 1920, h: 1080, music: 200 },
  bastion: { shots: BASTION, w: 1920, h: 1080, music: 0 },
  build: { shots: BUILD, w: 1920, h: 1080, music: 260 },
};

const params = new URLSearchParams(location.search);
const cut = CUTS[(params.get('cut') ?? 'trailer') as keyof typeof CUTS];
const { w: W, h: H, shots, music: musicFrom } = cut;
const canvas = document.querySelector<HTMLCanvasElement>('#out')!;
canvas.width = W;
canvas.height = H;
const g = canvas.getContext('2d')!;
const portrait = H > W;
const unit = Math.min(W, H) / 1080; // type scales with the short side

// --- Loading -------------------------------------------------------------------

const videos = new Map<string, HTMLVideoElement>();
const images = new Map<string, HTMLImageElement>();

async function loadVideo(src: string) {
  if (videos.has(src)) return;
  const v = document.createElement('video');
  v.muted = true;
  v.preload = 'auto';
  v.src = src;
  await new Promise((ok, fail) => ((v.onloadeddata = ok), (v.onerror = () => fail(new Error(`Can't load ${src}`)))));
  videos.set(src, v);
}

async function loadImage(src: string) {
  if (images.has(src)) return;
  const i = new Image();
  i.src = src;
  await i.decode();
  images.set(src, i);
}

const LOGO = new Image();
LOGO.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M4 18 L12 9 L20 9 L28 18 L18 23 L14 23 Z M12 9 L14 23 M20 9 L18 23" fill="none" stroke="${GREEN}" stroke-width="1.6" stroke-linejoin="round"/></svg>`)}`;

async function seek(v: HTMLVideoElement, t: number) {
  const target = Math.min(Math.max(t, 0), v.duration - 0.001);
  if (Math.abs(v.currentTime - target) < 0.001) return;
  await new Promise((ok) => ((v.onseeked = ok), (v.currentTime = target)));
}

// --- Drawing -------------------------------------------------------------------

/** Draw a source to fill the frame (cropping to fit), pushed in about a focus point. */
function cover(src: CanvasImageSource, sw: number, sh: number, zoom = 1, focus: [number, number] = [0.5, 0.5]) {
  const s = Math.max(W / sw, H / sh) * zoom;
  const dw = sw * s;
  const dh = sh * s;
  const x = Math.min(0, Math.max(W - dw, W / 2 - focus[0] * dw));
  const y = Math.min(0, Math.max(H - dh, H / 2 - focus[1] * dh));
  g.drawImage(src, x, y, dw, dh);
}

function text(str: string, x: number, y: number, size: number, opts: { font?: string; weight?: number; color?: string; align?: CanvasTextAlign; spacing?: number; glow?: string } = {}) {
  g.save();
  g.font = `${opts.weight ?? 600} ${size}px ${opts.font ?? "'Space Grotesk'"}, sans-serif`;
  g.fillStyle = opts.color ?? INK;
  g.textAlign = opts.align ?? 'left';
  g.textBaseline = 'alphabetic';
  if (opts.spacing) g.letterSpacing = `${opts.spacing}px`;
  if (opts.glow) {
    g.shadowColor = opts.glow;
    g.shadowBlur = size * 0.35;
  }
  g.fillText(str, x, y);
  g.restore();
}

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** Fade in over `a` seconds from the start, out over `b` before the end. */
const envelope = (t: number, len: number, a = 0.5, b = 0.5) => clamp01(Math.min(t / a, (len - t) / b));

function shade(top: number, bottom: number) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `rgba(0,0,0,${top})`);
  grad.addColorStop(0.35, 'rgba(0,0,0,0)');
  grad.addColorStop(0.62, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${bottom})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

function drawWordmark(cx: number, cy: number, size: number, alpha: number) {
  g.save();
  g.globalAlpha = alpha;
  const logo = size * 1.25;
  g.font = `700 ${size}px 'Space Grotesk', sans-serif`;
  g.letterSpacing = `${size * 0.3}px`;
  const tw = g.measureText('WITCHSPACE').width;
  const x0 = cx - (logo + size * 0.5 + tw) / 2;
  g.shadowColor = GREEN;
  g.shadowBlur = size * 0.4;
  g.drawImage(LOGO, x0, cy - logo * 0.68, logo, logo);
  g.shadowBlur = size * 0.25;
  g.fillStyle = INK;
  g.textBaseline = 'alphabetic';
  g.fillText('WITCHSPACE', x0 + logo + size * 0.5, cy);
  g.restore();
}

async function drawShot(shot: Shot, t: number) {
  if (shot.clip) {
    const v = videos.get(CLIP(shot.clip))!;
    // The middle of the frame: ask for its exact start and rounding can hand back the one before (a stutter).
    await seek(v, (shot.from ?? 0) + t * (shot.speed ?? 1) + 0.5 / FPS);
    cover(v, v.videoWidth, v.videoHeight, portrait ? 1.0 : 1);
  } else if (shot.still) {
    const i = images.get(shot.still)!;
    const [a, b] = shot.zoom ?? [1, 1];
    cover(i, i.naturalWidth, i.naturalHeight, a + (b - a) * ease(t / shot.len), shot.focus);
  } else if (shot.phones) {
    g.fillStyle = '#05070d';
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.6);
    glow.addColorStop(0, 'rgba(61,255,176,0.10)');
    glow.addColorStop(1, 'rgba(61,255,176,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    const ph = H * 0.74;
    shot.phones.forEach((src, k) => {
      const i = images.get(src)!;
      const pw = (ph * i.naturalWidth) / i.naturalHeight;
      const rise = (1 - ease(clamp01((t - k * 0.25) / 0.9))) * H * 0.12;
      const x = W / 2 + (k - 1) * pw * 1.12 - pw / 2;
      const y = H * 0.16 + rise;
      g.save();
      g.globalAlpha = ease(clamp01((t - k * 0.25) / 0.6));
      g.shadowColor = 'rgba(61,255,176,0.35)';
      g.shadowBlur = 40 * unit;
      g.beginPath();
      g.roundRect(x, y, pw, ph, 28 * unit);
      g.fillStyle = '#000';
      g.fill();
      g.shadowBlur = 0;
      g.clip();
      g.drawImage(i, x, y, pw, ph);
      g.restore();
      g.save();
      g.strokeStyle = 'rgba(238,243,250,0.35)';
      g.lineWidth = 2 * unit;
      g.beginPath();
      g.roundRect(x, y, pw, ph, 28 * unit);
      g.stroke();
      g.restore();
    });
  } else {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  }

  // Words over the picture.
  if (shot.label || shot.caption || shot.lines) shade(0, shot.still ? 0.85 : 0.6);
  const left = portrait ? W / 2 : 110 * unit;
  const align: CanvasTextAlign = portrait ? 'center' : 'left';
  if (shot.label) {
    const a = envelope(t, Math.min(shot.len, 2.6), 0.35, 0.6);
    if (a > 0) {
      g.save();
      g.globalAlpha = a;
      text(shot.label.toUpperCase(), left, portrait ? H * 0.79 : H - 250 * unit, (portrait ? 120 : 132) * unit, { weight: 700, spacing: 18 * unit, color: GREEN, align, glow: 'rgba(61,255,176,0.7)' });
      g.restore();
    }
  }
  if (shot.caption) {
    const a = envelope(t - 0.35, shot.len - 0.35, 0.45, 0.5);
    if (a > 0) {
      g.save();
      g.globalAlpha = a;
      text(shot.caption, left, portrait ? H * 0.86 : H - 140 * unit, (portrait ? 54 : 58) * unit, { weight: 600, align, glow: 'rgba(0,0,0,0.9)' });
      g.restore();
    }
  }
  for (const [from, to, line] of shot.lines ?? []) {
    const a = envelope(t - from, to - from, 0.45, 0.45);
    if (a <= 0) continue;
    g.save();
    g.globalAlpha = a;
    text(line, left, portrait ? H * 0.86 : H - 140 * unit, (portrait ? 54 : 58) * unit, { weight: 600, align, glow: 'rgba(0,0,0,0.9)' });
    g.restore();
  }
  if (shot.card === 'title') {
    if (t < 6.5) shade(0, 0.7 * envelope(t, 6.5, 0.3, 0.8));
    const len = Math.min(shot.len, 6.5); // the title, then the shot on its own
    const a = envelope(t - 1.2, len - 1.2, 0.9, 0.6);
    const k = envelope(t - 0.2, len - 0.2, 0.7, 0.6);
    g.save();
    g.globalAlpha = k;
    text('A LOVE LETTER TO ELITE (1984)', W / 2, H * (portrait ? 0.7 : 0.74), 30 * unit, { font: 'Inter', weight: 600, spacing: 8 * unit, color: GREEN, align: 'center', glow: 'rgba(0,0,0,0.9)' });
    g.restore();
    drawWordmark(W / 2, H * (portrait ? 0.77 : 0.86), (portrait ? 74 : 96) * unit, a);
  }
  if (shot.card === 'end') {
    const a = envelope(t, shot.len, 0.8, 0.9);
    drawWordmark(W / 2, H * 0.44, (portrait ? 70 : 84) * unit, a);
    g.save();
    g.globalAlpha = a;
    text('Trade. Fight. Explore. Build.', W / 2, H * 0.44 + 100 * unit, 48 * unit, { weight: 600, align: 'center' });
    text('Free in your browser · witchspace.org.uk', W / 2, H * 0.44 + 170 * unit, 34 * unit, { font: 'Inter', weight: 500, color: GREEN, align: 'center', glow: 'rgba(61,255,176,0.45)' });
    text('An unofficial, open-source tribute. Music: The Blue Danube, U.S. Marine Band (public domain).', W / 2, H - 70 * unit, 19 * unit, { font: 'Inter', weight: 400, color: '#7f8ca0', align: 'center' });
    g.restore();
  }
}

// --- The cut ---------------------------------------------------------------------

/** Each shot's start time; shots overlap by FADE for the crossfade. */
const starts: number[] = [];
let total = 0;
for (const s of shots) {
  starts.push(total);
  total += s.len - FADE;
}
total += FADE;

async function render() {
  await document.fonts.load("700 40px 'Space Grotesk'");
  await document.fonts.load("600 40px 'Space Grotesk'");
  await document.fonts.load("500 40px 'Inter'");
  await LOGO.decode();
  for (const s of shots) {
    if (s.clip) await loadVideo(CLIP(s.clip));
    if (s.still) await loadImage(s.still);
    for (const p of s.phones ?? []) await loadImage(p);
  }

  const target = new ArrayBufferTarget();
  const aac = (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 })).supported;
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    audio: { codec: aac ? 'aac' : 'opus', sampleRate: 48000, numberOfChannels: 2 },
    fastStart: 'in-memory',
  });

  // Music: the waltz proper, faded in and out to the cut's length.
  const audio = await music(total);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => console.error(e) });
  aenc.configure({ codec: aac ? 'mp4a.40.2' : 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
  const BLOCK = 4800;
  for (let i = 0; i < audio.length; i += BLOCK) {
    const n = Math.min(BLOCK, audio.length - i);
    const data = new Float32Array(n * 2);
    data.set(audio.getChannelData(0).subarray(i, i + n), 0);
    data.set(audio.getChannelData(1).subarray(i, i + n), n);
    aenc.encode(new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / 48000) * 1e6), data }));
  }

  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => console.error(e) });
  venc.configure({ codec: 'avc1.640033', width: W, height: H, bitrate: 7e6, framerate: FPS });
  const layer = new OffscreenCanvas(W, H);
  const lg = layer.getContext('2d')!;
  const frames = Math.round(total * FPS);
  for (let f = 0; f < frames; f++) {
    const time = f / FPS;
    // The shots on screen now: one, or two while crossfading.
    const live = shots.map((s, k) => ({ s, k, t: time - starts[k] })).filter(({ s, t }) => t >= 0 && t < s.len);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    for (const { s, t, k } of live) {
      if (live.length > 1 && k === live[live.length - 1].k) {
        // The incoming shot, faded over the outgoing one.
        lg.drawImage(canvas, 0, 0);
        await drawShot(s, t);
        const a = ease(clamp01(t / FADE));
        g.save();
        g.globalAlpha = 1 - a;
        g.drawImage(layer, 0, 0);
        g.restore();
      } else await drawShot(s, t);
    }
    // Fade from and to black at the very ends.
    const edge = Math.min(time / 0.6, (total - time) / 0.6);
    if (edge < 1) {
      g.fillStyle = `rgba(0,0,0,${1 - clamp01(edge)})`;
      g.fillRect(0, 0, W, H);
    }
    const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
    frame.close();
    if (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    (window as any).__progress = f / frames;
  }
  await venc.flush();
  await aenc.flush();
  muxer.finalize();
  return { bytes: new Uint8Array(target.buffer), seconds: total, audio: aac ? 'aac' : 'opus' };
}

async function music(seconds: number) {
  const buf = await (await fetch('/audio/blue-danube.mp3')).arrayBuffer();
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 48000), 48000);
  const src = ctx.createBufferSource();
  src.buffer = await ctx.decodeAudioData(buf);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(0.9, 1.2);
  gain.gain.setValueAtTime(0.9, Math.max(1.2, seconds - 3));
  gain.gain.linearRampToValueAtTime(0, seconds);
  src.connect(gain).connect(ctx.destination);
  src.start(0, musicFrom);
  return ctx.startRendering();
}

(window as any).__render = async () => {
  const r = await render();
  (window as any).__bytes = r.bytes;
  return { size: r.bytes.length, seconds: r.seconds, audio: r.audio };
};
(window as any).__chunk = (i: number, n: number) => {
  const b: Uint8Array = (window as any).__bytes.subarray(i, i + n);
  let s = '';
  for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode(...b.subarray(k, k + 0x8000));
  return btoa(s);
};
(window as any).__ready = true;
