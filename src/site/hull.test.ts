import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkGeometry, signedVolume } from '../content/geometry';
import type { ShipDef, Vec3 } from '../content/types';
import { convexHull, partsOf, shipGeometry } from './hull';

const cube: Vec3[] = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as Vec3)));

describe('convexHull', () => {
  it('makes a cube of six square faces, wound outward', () => {
    const h = convexHull(cube);
    expect(h.vertices).toHaveLength(8);
    expect(h.faces).toHaveLength(6);
    expect(h.faces.every((f) => f.length === 4)).toBe(true);
    expect(signedVolume(h.vertices, h.faces)).toBeGreaterThan(0);
    expect(checkGeometry(h.vertices, h.faces)).toEqual({ errors: [], warnings: [] });
  });

  it('leaves out a point inside, a point along an edge and a repeated point', () => {
    const h = convexHull([...cube, [0, 0, 0], [0, -1, -1], [1, 1, 1]]);
    expect(h.vertices).toHaveLength(8);
    expect(h.faces).toHaveLength(6);
  });

  it('makes a plate from points in one plane, and nothing from a line', () => {
    const plate = convexHull([[0, 0, 0], [0, 4, -2], [0, 0, -6], [0, 2, -3]]);
    expect(plate.faces).toHaveLength(1);
    expect(plate.faces[0]).toHaveLength(3);
    expect(convexHull([[0, 0, 0], [1, 1, 1], [2, 2, 2]]).faces).toHaveLength(0);
  });
});

describe('a fleet ship as parts', () => {
  const dir = join(__dirname, '../../content/ships');
  const ships = readdirSync(dir)
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ShipDef)
    .filter((s) => !s.modules);
  const key = (p: Vec3) => p.map((c) => c.toFixed(2)).join(',');

  it.each(ships.map((s) => [s.id, s] as const))('%s comes back as it was', (_, ship) => {
    const parts = partsOf(ship.geometry);
    const g = shipGeometry(parts);
    expect(g.faces).toHaveLength(ship.geometry.faces.length);
    expect(new Set(g.vertices.map(key))).toEqual(new Set(ship.geometry.vertices.map(key)));
    expect(checkGeometry(g.vertices, g.faces).errors).toEqual([]);
  });

  it('finds the mirrored pairs: the Falcon is a hull and a pair of wings', () => {
    const falcon = ships.find((s) => s.id === 'falcon')!;
    expect(partsOf(falcon.geometry).map((p) => p.mirror)).toEqual(['centre', 'pair']);
  });
});
