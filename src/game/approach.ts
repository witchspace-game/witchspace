// The station approach's rules (docs/design/station-approach.md): pure, so they're tested without a
// scene. flight/approach.ts draws them.

import * as THREE from 'three';
import type { StarSystem } from '../galaxy/generate';
import { COMPANIES } from './companies';
import { APPROACH } from '../render/look';

/** The beam's reach, and how far off its axis it can be seen (fading over the last few degrees). */
export const BEAM_RANGE = 5000;
const BEAM_CONE = THREE.MathUtils.degToRad(25);
const BEAM_EDGE = THREE.MathUtils.degToRad(8);

/**
 * Which stations broadcast a beam: all but the most backward worlds (tech level 5 and up, so Lave,
 * where every commander learns to dock, does) and anarchies, with nobody to run one. The frontier,
 * where a docking computer earns its keep.
 */
export const BEAM_TECH = 5;
export const broadcasts = (s: StarSystem) => s.techLevel >= BEAM_TECH && s.government !== 0;

/** Who runs the station, as its pulse shows (station-approach.md, "Who owns the station"): its world's, unless a company does. */
export function ownerColour(s: StarSystem): string {
  if (s.galaxy === 0 && s.index === 46) return COMPANIES.mutual.colour; // Meridian Station, Riedquat: where the Mutual began
  if (s.government === 7) return COMPANIES.hexon.colour; // a Corporate State: the company is the government
  return APPROACH.world;
}

/** How far into the beam `at` is, 0..1: inside the cone and range, fading at the cone's edge. */
export function inBeam(at: THREE.Vector3, mouth: THREE.Vector3, out: THREE.Vector3): number {
  const to = at.clone().sub(mouth);
  const d = to.length();
  if (d > BEAM_RANGE || d < 1) return d < 1 ? 1 : 0;
  const off = to.angleTo(out);
  return THREE.MathUtils.clamp((BEAM_CONE - off) / BEAM_EDGE, 0, 1);
}

