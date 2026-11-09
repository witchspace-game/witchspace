import { describe, expect, it } from 'vitest';
import { COMMODITIES, isPlural } from './commodities';

describe('one good or many', () => {
  it('reads "computers are" and "food is"', () => {
    const plural = COMMODITIES.filter(isPlural).map((c) => c.id);
    expect(plural).toEqual(['textiles', 'radioactives', 'slaves', 'liquor', 'luxuries', 'narcotics', 'computers', 'alloys', 'firearms', 'furs', 'minerals', 'gems', 'alien', 'hydrogen', 'electronics']);
  });
});
