import { describe, expect, it } from 'vitest';
import { cardId, checkCard, finishFor, FOUNDING_BEFORE, isFounding, ownedShips } from './card';

const ok = { career: 'fight', scene: 'coriolis', ship: 'cobra-mk3', angle: { x: 0.3, y: -0.2 } };

describe("the commander's card", () => {
  it('founding members claimed before 3 November, 14:00 UK', () => {
    expect(isFounding(FOUNDING_BEFORE - 1)).toBe(true);
    expect(isFounding(FOUNDING_BEFORE)).toBe(false);
    expect(isFounding(null)).toBe(false);
  });

  it('titanium for founders, alloy after launch, black at Elite', () => {
    expect(finishFor(FOUNDING_BEFORE - 1, { kills: 10 })).toBe('titanium');
    expect(finishFor(FOUNDING_BEFORE + 1, { kills: 10 })).toBe('alloy');
    expect(finishFor(FOUNDING_BEFORE - 1, { kills: 6400 })).toBe('black');
  });

  it('only ships you own: the one you fly and your fleet, or the starter Cobra with no save', () => {
    expect([...ownedShips(null)]).toEqual(['cobra-mk3']);
    const save = { ship: 'fer-de-lance', fleet: [{ ship: 'cobra-mk3' }] };
    expect(ownedShips(save).has('cobra-mk3')).toBe(true);
    expect('choices' in checkCard({ ...ok, ship: 'fer-de-lance' }, save, [])).toBe(true);
    expect(checkCard({ ...ok, ship: 'mamba' }, save, [])).toEqual({ error: 'Only ships you own can go on your card' });
  });

  it("an edition's card only for its owner, and only on its own hull", () => {
    const save = { ship: 'fer-de-lance' };
    const mine = [{ id: 'dark', number: 1 }];
    expect('choices' in checkCard({ ...ok, ship: 'fer-de-lance', edition: { id: 'dark', number: 1 } }, save, mine)).toBe(true);
    expect(checkCard({ ...ok, ship: 'fer-de-lance', edition: { id: 'dark', number: 2 } }, save, mine)).toEqual({ error: 'That edition’s card is for its owner' });
    expect(checkCard({ ...ok, ship: 'fer-de-lance', edition: { id: 'witch-fire', number: 1 } }, save, mine)).toEqual({ error: 'That edition’s card is for its owner' });
    expect(checkCard({ ...ok, ship: 'cobra-mk3', edition: { id: 'dark', number: 1 } }, save, mine)).toEqual({ error: 'No such edition of that ship' });
  });

  it('Legend is earned at Elite', () => {
    expect(checkCard({ ...ok, scene: 'legend' }, { kills: 100 }, [])).toEqual({ error: 'The Legend card is earned at Elite' });
    expect('choices' in checkCard({ ...ok, scene: 'legend' }, { kills: 6400 }, [])).toBe(true);
  });

  it('turns away a bad career, scene or angle', () => {
    expect('error' in checkCard({ ...ok, career: 'pirate' }, null, [])).toBe(true);
    expect('error' in checkCard({ ...ok, scene: '<script>' }, null, [])).toBe(true);
    expect('error' in checkCard({ ...ok, angle: { x: 'a', y: 0 } }, null, [])).toBe(true);
  });

  it('a link of ten letters and digits', () => {
    expect(cardId()).toMatch(/^[a-z0-9]{10}$/);
  });
});
