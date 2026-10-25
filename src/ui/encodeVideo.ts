import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

// Frames to an MP4, offline: each frame drawn when the encoder is ready for it,
// so the video is smooth however slowly the device renders. H.264 through
// WebCodecs, muxed by mp4-muxer, as the flight recorder does.

const CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f'];

export async function canEncode(width: number, height: number): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  for (const codec of CODECS) {
    try {
      if ((await VideoEncoder.isConfigSupported({ codec, width, height, bitrate: 3_000_000, framerate: 30 })).supported) return codec;
    } catch {
      /* try the next */
    }
  }
  return null;
}

export async function encodeVideo(opts: {
  width: number;
  height: number;
  fps: number;
  frames: number;
  /** Draw frame i onto the canvas. */
  draw: (i: number, g: OffscreenCanvasRenderingContext2D) => void | Promise<void>;
  onProgress?: (done: number) => void;
}): Promise<Blob | null> {
  const { width, height, fps, frames } = opts;
  const codec = await canEncode(width, height);
  if (!codec) return null;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width, height, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
  let failed = false;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: () => (failed = true),
  });
  encoder.configure({ codec, width, height, bitrate: 3_000_000, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } });
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d')!;
  for (let i = 0; i < frames && !failed; i++) {
    await opts.draw(i, g);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 0));
    if (i % 10 === 0) {
      opts.onProgress?.(i / frames);
      await new Promise((r) => setTimeout(r, 0)); // let the page breathe
    }
  }
  if (failed) return null;
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}
