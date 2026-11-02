import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { systemAt, galaxy } from '../galaxy/generate';
import { COMPANIES } from './companies';
import { APPROACH } from '../render/look';
import { broadcasts, inBeam, ownerColour } from './approach';

describe('the approach beam (station-approach.md)', () => {
  const mouth = new THREE.Vector3(0, 0, 0);
  const out = new THREE.Vector3(0, 0, 1);
  const at = (deg: number, d: number) => new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(deg)) * d, 0, Math.cos(THREE.MathUtils.degToRad(deg)) * d);

  it('is seen lined up and within range, fading at the edge of its cone, and not from the side', () => {
    expect(inBeam(at(0, 2000), mouth, out)).toBe(1);
    expect(inBeam(at(10, 2000), mouth, out)).toBe(1);
    expect(inBeam(at(21, 2000), mouth, out)).toBeGreaterThan(0);
    expect(inBeam(at(21, 2000), mouth, out)).toBeLessThan(1);
    expect(inBeam(at(40, 2000), mouth, out)).toBe(0);
    expect(inBeam(at(0, 6000), mouth, out)).toBe(0);
    expect(inBeam(at(180, 500), mouth, out)).toBe(0);
  });

  it('is broadcast by all but the most backward worlds and anarchies, Lave included', () => {
    const g = galaxy(0);
    expect(g.filter((s) => s.government === 0).every((s) => !broadcasts(s))).toBe(true);
    expect(g.filter((s) => s.techLevel < 5).every((s) => !broadcasts(s))).toBe(true);
    expect(broadcasts(g[7])).toBe(true); // Lave, where everyone learns to dock
  });

  it('pulses in its owner’s colour: the world’s amber, Hexon in a Corporate State, the Mutual at Meridian', () => {
    const corporate = galaxy(0).find((s) => s.government === 7)!;
    const democracy = galaxy(0).find((s) => s.government === 6)!;
    expect(ownerColour(corporate)).toBe(COMPANIES.hexon.colour);
    expect(ownerColour(democracy)).toBe(APPROACH.world);
    expect(ownerColour(systemAt(0, 46))).toBe(COMPANIES.mutual.colour);
  });
});
