import { describe, expect, it } from 'vitest';
import { jpegSize } from './clipCheck';

/** The start of a JPEG: SOI, an APP0 segment, then a baseline frame header of the given size. */
const jpeg = (w: number, h: number, sof = 0xc0) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, sof, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0]);

describe("a clip's card is checked before it's kept", () => {
  it('reads the size from the frame header, baseline or progressive', () => {
    expect(jpegSize(jpeg(1200, 630))).toEqual({ w: 1200, h: 630 });
    expect(jpegSize(jpeg(1200, 630, 0xc2))).toEqual({ w: 1200, h: 630 });
  });

  it("refuses what isn't a JPEG", () => {
    expect(jpegSize(new TextEncoder().encode('<svg></svg>'))).toBeNull();
    expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
