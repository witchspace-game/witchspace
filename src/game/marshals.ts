import type { StarSystem } from '../galaxy/generate';
import type { Commander } from './commander';

// The Co-operative Marshals come for commanders with a warrant (Modern rules):
// a Bastion carrier tears its way in through a witchspace rift and launches
// its wing of Lancers. It's slow to arrive on purpose: the rift gives about
// half a minute of warning, and a commander who notices can jump out before
// the interceptors are on them.

/** Seconds of each stage of the arrival. */
export const ARRIVAL = {
  /** A far-off flicker: the first sign. */
  disturbance: 12,
  /** The rift opens to full size. */
  opening: 20,
  /** The carrier slides out (818 m of hull at EMERGE_SPEED) as the rift closes around it. */
  emerging: 17,
  /** The rift collapses behind it. */
  collapse: 3,
};

export const WARNING = ARRIVAL.disturbance + ARRIVAL.opening; // seconds before the carrier appears
export const EMERGE_SPEED = 50; // m/s while coming through
export const WING = 8; // Lancers aboard a Bastion
export const FIRST_LAUNCH = 6; // seconds after it's through
export const LAUNCH_GAP = 15; // seconds between pairs
export const MAX_OUT = 4; // Lancers in space at once: the rest wait as replacements
export const RIFT_DISTANCE = 9000; // metres from the commander
export const RIFT_RADIUS = 1500; // metres: a tear in space you can see, and find, from across the system

/** How open the arrival rift is, `t` seconds after the first flicker. */
export function riftOpenness(t: number): number {
  if (t <= 0) return 0;
  if (t < ARRIVAL.disturbance) return 0.12 * (t / ARRIVAL.disturbance);
  const s = Math.min(1, (t - ARRIVAL.disturbance) / ARRIVAL.opening);
  return 0.12 + 0.88 * s * s * (3 - 2 * s);
}

/**
 * How open the rift is while the carrier comes through, by the share of its
 * hull that's out: wide at first, closing in around it, and never tighter
 * than the hull until the stern is clear.
 */
export function closingOpenness(out: number): number {
  return Math.max(0.1, 1 - Math.min(1, out) ** 2);
}

/** The warnings flashed during the arrival, at seconds after the first flicker. */
export const ARRIVAL_WARNINGS: { at: number; text: (km: string) => string }[] = [
  { at: 0, text: (km) => `Witchspace disturbance detected · ${km} km` },
  { at: ARRIVAL.disturbance, text: (km) => `Witchspace rift opening · ${km} km · large mass signature` },
  { at: WARNING - 8, text: () => 'Co-operative Marshals carrier inbound · leave the system now' },
];

/**
 * Seconds of flight before a carrier comes for a commander with a warrant
 * here, or null if none will. Each Bastion you've destroyed makes the next
 * come sooner.
 */
export function marshalsDelay(c: Commander, s: StarSystem, random = Math.random): number | null {
  if (c.difficulty !== 'modern' || !c.warrant || s.government === 0) return null;
  const base = 45 + random() * 45;
  return base / (1 + (c.bastionsDestroyed ?? 0) * 0.5);
}
