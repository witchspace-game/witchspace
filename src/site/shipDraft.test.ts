import { describe, expect, it } from 'vitest';
import { checkGeometry } from '../content/geometry';
import type { ShipDef } from '../content/types';
import cobraFile from '../../content/ships/cobra-mk3.json';
import bullsnakeFile from '../../content/ships/bullsnake.json';
import { slotProblem } from '../content/slot';
import { blank, fromShip, readDraft, shipFile, slug } from './shipDraft';

const cobra = cobraFile as unknown as ShipDef;

describe('the ship draft', () => {
  it('starts from a wedge that is a sound hull', () => {
    const g = shipFile({ ...blank(), name: 'Ice Hauler' }).geometry as ShipDef['geometry'];
    expect(g.faces.length).toBeGreaterThanOrEqual(4);
    expect(checkGeometry(g.vertices, g.faces)).toEqual({ errors: [], warnings: [] });
  });

  it('makes a fleet ship yours, or keeps its id to improve it', () => {
    const mine = fromShip(cobra, 'new');
    expect([mine.id, mine.name, mine.description, mine.improves]).toEqual(['', 'My Cobra Mk III', '', undefined]);
    expect(shipFile(mine).id).toBe('my-cobra-mk-iii');
    expect(fromShip(cobra, 'improve').id).toBe('cobra-mk3');
    const file = shipFile(mine);
    expect(file.credits).toEqual({ authors: [], license: 'CC-BY-SA-4.0' });
    expect((file.geometry as ShipDef['geometry']).details).toBeDefined();
  });

  it('keeps "never docks" to improve a ship, and drops it for a new one, which must then fit the slot', () => {
    const bullsnake = bullsnakeFile as unknown as ShipDef;
    const improved = shipFile(fromShip(bullsnake, 'improve'));
    expect(improved.docks).toBe(false);
    expect(slotProblem(improved as unknown as ShipDef)).toBeNull();
    const mine = shipFile(fromShip(bullsnake, 'new'));
    expect('docks' in mine).toBe(false);
    expect(slotProblem(mine as unknown as ShipDef)).toMatch(/tall/);
    expect('docks' in shipFile(fromShip(cobra, 'improve'))).toBe(false);
  });

  it('takes its id from the name until you give it one', () => {
    expect(shipFile({ ...blank(), name: "Halloran's Moth II" }).id).toBe('hallorans-moth-ii');
    expect(slug('  Ice -- Hauler ')).toBe('ice-hauler');
  });

  it('reads back a saved draft, and nothing else', () => {
    const d = blank();
    expect(readDraft(JSON.stringify(d))).toEqual(d);
    expect(readDraft('{"parts": 3}')).toBeNull();
    expect(readDraft('not json')).toBeNull();
    expect(readDraft(null)).toBeNull();
  });
});
