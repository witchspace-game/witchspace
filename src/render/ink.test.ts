import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { shipById } from '../content/ships';
import { buildShip } from './shipModel';
import { inkable } from './ink';
import { PAPER } from './look';

describe('ink', () => {
  it('draws her in ink at 0, and gives her back exactly at 1', () => {
    const model = buildShip(shipById('cobra-mk3')!);
    const fill = model.parts.neo.find((o): o is THREE.Mesh => o instanceof THREE.Mesh)!;
    const own = fill.material;
    const widths = model.lines.map((l) => l.material.linewidth);
    const lit = inkable(model);
    lit(0);
    expect(model.lines[0].material.color.getHexString()).toBe(new THREE.Color(PAPER.ink).getHexString());
    expect(fill.material).not.toBe(own);
    expect(model.root.userData.lights).toBe(0);
    lit(1);
    model.lines.forEach((l, i) => {
      expect(l.material.color.equals(l.base)).toBe(true);
      expect(l.material.linewidth).toBe(widths[i]);
    });
    expect(fill.material).toBe(own);
  });
});
