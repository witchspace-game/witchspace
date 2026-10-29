import { describe, expect, it } from 'vitest';
import { cargoCapacity, EQUIPMENT, newCommander, rollEquipmentDamage } from './commander';
import { PLAYER_LASERS } from './weapons';

const dps = (id: keyof typeof PLAYER_LASERS) => PLAYER_LASERS[id].damage / PLAYER_LASERS[id].interval;
/** Seconds of continuous fire from cold before overheating (100). */
const burst = (id: keyof typeof PLAYER_LASERS) => {
  const l = PLAYER_LASERS[id];
  return 100 / (l.heat / l.interval - l.cooling);
};

describe('the equipment shop', () => {
  it('sells lasers that get better (and dearer) as you go', () => {
    expect(dps('pulse')).toBeLessThan(dps('beam'));
    expect(dps('beam')).toBeLessThan(dps('military'));
    expect(PLAYER_LASERS.pulse.price).toBeLessThan(PLAYER_LASERS.beam.price);
    expect(PLAYER_LASERS.beam.price).toBeLessThan(PLAYER_LASERS.military.price);
    // Beams trade staying power for punch; military lasers do both.
    expect(burst('beam')).toBeLessThan(burst('pulse'));
    expect(burst('military')).toBeGreaterThan(burst('beam'));
  });

  it('starts every commander with a pulse laser', () => {
    expect(newCommander('classic').lasers).toEqual({ front: 'pulse' });
  });

  it('adds hold space with the large cargo bay', () => {
    const c = newCommander('modern');
    expect(cargoCapacity(c, 20)).toBe(20);
    c.equipment.push('large-cargo-bay');
    expect(cargoCapacity(c, 20)).toBe(35);
  });

  it('never knocks out the cargo bay in combat', () => {
    const c = newCommander('modern');
    c.equipment = ['large-cargo-bay'];
    // Only the transponder, fitted to every Modern ship, can go; then nothing.
    expect(rollEquipmentDamage(c, () => 0)?.id).toBe('transponder');
    for (let i = 0; i < 50; i++) expect(rollEquipmentDamage(c, () => 0)).toBeNull();
    c.equipment.push('ecm');
    expect(rollEquipmentDamage(c, () => 0)?.id).toBe('ecm');
  });

  it('puts the big-ticket items at high-tech worlds', () => {
    const tech = (id: string) => EQUIPMENT.find((e) => e.id === id)!.minTech;
    expect(tech('galactic-hyperdrive')).toBeGreaterThanOrEqual(10);
    expect(tech('large-cargo-bay')).toBeLessThanOrEqual(5); // a trader can get one early
  });

  it('knocks out the transponder under Modern rules only', () => {
    const classic = newCommander('classic');
    classic.equipment = [];
    expect(rollEquipmentDamage(classic, () => 0)).toBeNull();
    const modern = newCommander('modern');
    modern.equipment = [];
    expect(rollEquipmentDamage(modern, () => 0)?.id).toBe('transponder');
    expect(modern.damaged).toEqual(['transponder']);
  });
});

describe('the kit, grouped', () => {
  it('puts every item in a group', async () => {
    const { everyItemGrouped, kitGroup } = await import('./kit');
    expect(everyItemGrouped()).toBe(true);
    expect(kitGroup('ecm')).toBe('combat');
    expect(kitGroup('large-cargo-bay')).toBe('trade');
    expect(kitGroup('survey-autopilot')).toBe('exploration');
  });
});
