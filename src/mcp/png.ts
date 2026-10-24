// A tiny raster for the MCP server's ship previews: anti-aliased lines on a
// dark background, encoded as PNG. The Worker has no canvas, and assistants
// show PNGs more reliably than SVG. Uses CompressionStream, which Workers,
// browsers and Node 18+ all have.

export class Raster {
  readonly data: Float32Array; // RGB, 0..1, additive (lines glow where they cross)

  constructor(
    readonly width: number,
    readonly height: number,
    background: [number, number, number] = [0.02, 0.027, 0.05],
  ) {
    this.data = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i++) this.data.set(background, i * 3);
  }

  private plot(x: number, y: number, c: [number, number, number], a: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || a <= 0) return;
    const i = (y * this.width + x) * 3;
    for (let k = 0; k < 3; k++) this.data[i + k] = Math.min(1, this.data[i + k] + c[k] * a);
  }

  /** A line of a given width (pixels), soft-edged. */
  line(x0: number, y0: number, x1: number, y1: number, color: [number, number, number], width = 1.6, alpha = 1) {
    const r = width / 2 + 1;
    const minX = Math.floor(Math.min(x0, x1) - r);
    const maxX = Math.ceil(Math.max(x0, x1) + r);
    const minY = Math.floor(Math.min(y0, y1) - r);
    const maxY = Math.ceil(Math.max(y0, y1) + r);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1e-9;
    for (let y = Math.max(0, minY); y <= Math.min(this.height - 1, maxY); y++) {
      for (let x = Math.max(0, minX); x <= Math.min(this.width - 1, maxX); x++) {
        // Distance from the pixel centre to the segment.
        const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / len2));
        const px = x0 + t * dx - (x + 0.5);
        const py = y0 + t * dy - (y + 0.5);
        const d = Math.sqrt(px * px + py * py);
        const a = Math.max(0, Math.min(1, width / 2 + 0.5 - d));
        if (a > 0) this.plot(x, y, color, a * alpha);
      }
    }
  }

  /** The line again, wide and faint: a cheap glow. */
  glowLine(x0: number, y0: number, x1: number, y1: number, color: [number, number, number]) {
    this.line(x0, y0, x1, y1, color, 6, 0.12);
    this.line(x0, y0, x1, y1, color, 1.8, 1);
  }

  /** Simple 3×5 pixel-font text, scaled: enough for a label or two. */
  text(str: string, x: number, y: number, scale: number, color: [number, number, number]) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const glyph = FONT[ch];
      if (glyph) {
        for (let row = 0; row < 5; row++)
          for (let col = 0; col < 3; col++)
            if (glyph[row] & (4 >> col))
              for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) this.plot(cx + col * scale + sx, y + row * scale + sy, color, 1);
      }
      cx += 4 * scale;
    }
  }

  async png(): Promise<Uint8Array> {
    const { width, height } = this;
    const raw = new Uint8Array((width * 3 + 1) * height);
    for (let y = 0; y < height; y++) {
      raw[y * (width * 3 + 1)] = 0; // no filter
      for (let x = 0; x < width * 3; x++) raw[y * (width * 3 + 1) + 1 + x] = Math.round(this.data[y * width * 3 + x] * 255);
    }
    const idat = await deflate(raw);
    const ihdr = new Uint8Array(13);
    const v = new DataView(ihdr.buffer);
    v.setUint32(0, width);
    v.setUint32(4, height);
    ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
    return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]);
  }
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.slice().buffer]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 0xff] ^ (c >>> 8);
  v.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}

/** Base64, for MCP image content. */
export function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// 3×5 glyphs, one row per number, bits left to right.
const FONT: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [6, 1, 2, 4, 7], '3': [6, 1, 2, 1, 6],
  '4': [5, 5, 7, 1, 1], '5': [7, 4, 6, 1, 6], '6': [3, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 6],
  '.': [0, 0, 0, 0, 2], '-': [0, 0, 7, 0, 0], ' ': [0, 0, 0, 0, 0], ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4],
};
