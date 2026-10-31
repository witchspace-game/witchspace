// The Neo look: Witchspace's signature (Mark, 31 October 2026: "The look of the Neo world is our
// 'signature' look. Lets get this right and locked down so we do not go changing it without serious
// consideration"). Every number that makes it is here, and nowhere else: the glow, the lines, the
// stars, the planets and the sun. docs/design/neo-look.md says what the look is and why.
//
// Changing anything in this file changes the signature. Before a pull request that does:
//   1. run `node tools/look-check.mjs` (with `npm run dev -- --port 5311` running) and look at
//      every picture it flags in tools/look/out/;
//   2. get Mark's yes on the pictures, not just the numbers;
//   3. then, and only then, `node tools/look-check.mjs --accept` to make them the new reference.
// The site's pages (src/site) read the same numbers, so the game and the site always glow alike.

/**
 * The glow (three.js's UnrealBloomPass): what glows, how strongly, and how far it spreads. Five blurs,
 * tight to screen-wide, weighted towards the tight ones so it hugs the lines; the widest is kept faint,
 * or every ship sits in a screen-sized disc of haze (#167). Radius 0, so these weights are used as given.
 */
export const GLOW = {
  strength: 1.0,
  radius: 0,
  /** On brightness, where pure blue counts for only about 7% (issue #292: blues and violets can glow unevenly). */
  threshold: 0.2,
  factors: [1, 0.75, 0.45, 0.18, 0.04],
  /** On a phone the glow is worked out at three-quarters of the screen's resolution, for the battery (#306): it looks the same. */
  phoneScale: 0.75,
} as const;

/** Device pixels per CSS pixel, at most: past 2 the lines can't look any sharper, and the work grows. */
export const MAX_PIXEL_RATIO = 2;

/**
 * Anti-aliasing for the image the glow is made from (the canvas's own doesn't reach it), in samples a
 * pixel: 4 on a computer's 1× screen, where steps show most and it's free (#351); none on a Retina
 * screen, where it cost nearly half the frame rate, or a phone, whose dense screen hides the steps.
 */
export const samplesFor = (coarsePointer: boolean, pixelRatio: number) => (!coarsePointer && pixelRatio < 2 ? 4 : 0);

/** Brightest a pixel may be before the glow (the sun is 4): anything past it, or not a number, is a fault (#352). */
export const BRIGHTEST = 16;

/** A grain of less than one shade a pixel, too fine to see, so the glow's long fades don't show as rings (#169). */
export const GRAIN = 1 / 255;

/** A ship: hull lines bright enough to glow, finer detail lines dimmer, and a faint fill so it reads as solid. */
export const SHIP = {
  hull: { brightness: 1.6, width: 2.2 },
  detail: { brightness: 1.1, width: 1.4 },
  fill: 0.07,
} as const;

/** The stars: points at infinity, faint and blue-white, a few brighter, never glowing as much as a ship. */
export const STARS = {
  count: 2500,
  size: 1.2,
  distance: 8000,
  /** Hue between these (blue to violet), at this saturation; lightness mostly faint, a few up to 0.53. */
  hue: [0.55, 0.7],
  saturation: 0.35,
  lightness: (r: number) => 0.08 + r ** 3 * 0.45,
} as const;

/** A planet: a lit globe, its grid of latitude and longitude, and a soft rim of air. */
export const PLANET = {
  fill: 0.12,
  grid: { brightness: 0.9, width: 1.2 },
  atmosphere: { scale: 1.06, strength: 0.55, falloff: 6 },
} as const;

/** The sun: brighter than anything else (values over 1 feed the glow), so it blazes. */
export const SUN = [4, 3.1, 1.8] as const;
