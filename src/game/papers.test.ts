import { describe, expect, it } from 'vitest';
import { EDITIONS, editionById } from '../content/editions';
import { systemAt } from '../galaxy/generate';
import { papersFor, papersLink, sentence } from './papers';
import { editionGiftSpec } from './shipyard';

describe('an edition’s papers', () => {
  it('say what a gifted Witch-fire carries, from the gift’s fit-out', () => {
    const p = papersFor(editionById('witch-fire')!, 1, 'Fer-de-lance');
    expect(p.no).toBe('001');
    expect(p.finish).toBe('Orerve Nebula, with Witch-fire trim');
    expect(p.glow).toBe('Blazing');
    expect(p.fitted).toEqual(['Beam lasers, front and rear', 'Docking computer', 'Combat computer']);
    expect(p.fittedLine).toBe('beam lasers front and rear, a docking computer and a combat computer');
    expect(p.aboardLine).toBe('an owner’s suite, a name in gold leaf and a starlight cabin');
    expect(p.fitted.length).toBe(1 + editionGiftSpec(editionById('witch-fire')!).upgrades.length);
  });

  it('wait at the maker’s own yard: Goddard Ring, Onrira', () => {
    for (const e of EDITIONS) {
      const p = papersFor(e, 1, 'Fer-de-lance');
      expect(systemAt(e.yard.galaxy, e.yard.system).name).toBe('Onrira');
      expect(`${p.yard}, ${p.system}`).toBe('Goddard Ring, Onrira');
    }
  });

  it('link to a private certificate, the token after the #', () => {
    expect(papersLink(papersFor(editionById('dark')!, 7, 'Fer-de-lance'), 'abc')).toBe('https://witchspace.org.uk/ships/fer-de-lance/dark/007/#t=abc');
    expect(sentence(['a'])).toBe('a');
    expect(sentence(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
