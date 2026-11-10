import { describe, expect, it } from 'vitest';
import { POLICE_LASER, TRADER_LASER, traderArms } from './weapons';

const dps = (l: { damage: number; interval: number }) => l.damage / l.interval;

describe("a trader's guns, by the system she works", () => {
  it('are skilled where it is dangerous, and timid where it is safe', () => {
    const anarchy = traderArms(0);
    expect(dps(anarchy.laser)).toBeGreaterThanOrEqual(dps(POLICE_LASER));
    expect(anarchy.gimbal).toBeGreaterThan(0);
    expect(traderArms(7).laser).toBe(TRADER_LASER);
    expect(traderArms(7).gimbal).toBeUndefined();
  });

  it('never get weaker as the system gets rougher', () => {
    for (let g = 1; g < 8; g++) expect(dps(traderArms(g - 1).laser)).toBeGreaterThanOrEqual(dps(traderArms(g).laser));
  });
});
