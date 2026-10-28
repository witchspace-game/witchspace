import { describe, expect, it } from 'vitest';
import { editionById } from '../../src/content/editions';
import { papersFor, papersLink } from '../../src/game/papers';
import { editionEmail } from './emails';

describe('the maker’s letter', () => {
  const p = papersFor(editionById('witch-fire')!, 1, 'Fer-de-lance');
  const link = papersLink(p, 'deadbeef');
  const m = editionEmail(p, 'Zorgon Petterson', 'Moxon', link);

  it('is from the maker, in the edition’s colours, with her papers’ private link', () => {
    expect(m.subject).toBe('Witch-fire Edition 001 is ready for you, Commander');
    expect(m.html).toContain('ZORGON PETTERSON · ONRIRA');
    expect(m.html).toContain('#ff4dff');
    expect(m.html).toContain(link);
    expect(m.text).toContain(link);
    expect(m.html).toContain('https://witchspace.org.uk/share/ships-fer-de-lance-witch-fire.jpg');
  });

  it('says what she carries from her papers, never typed in', () => {
    expect(m.text).toContain('She carries beam lasers front and rear, a docking computer and a combat computer, and aboard there’s an owner’s suite');
    expect(m.text).toContain('She’s waiting at Goddard Ring, Onrira.');
    expect(m.text).toContain('The glow is blazing.');
  });

  it('greets a commander without a callsign plainly', () => {
    expect(editionEmail(p, 'Zorgon Petterson', null, link).text).toContain('Built for Commander\n');
  });
});
