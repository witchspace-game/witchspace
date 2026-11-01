import { describe, expect, it } from 'vitest';
import { inviteLine } from './clipView';
import { LAUNCH } from '../site/callsignWords';

describe('after a shared clip', () => {
  it('names who flew it, and links to a callsign of your own in their career', () => {
    const line = inviteLine({ callsign: 'Kestrel', career: 'fight' }, LAUNCH - 1);
    expect(line).toContain('CMDR Kestrel flew this.');
    expect(line).toContain('href="/callsign/?career=fight&from=clip"');
    expect(line).toContain('Founding members until launch');
  });
  it('says pilot when there is no career, and simply claim yours after launch', () => {
    const line = inviteLine({ callsign: 'Kestrel', career: null }, LAUNCH + 1);
    expect(line).toContain('Every pilot needs a callsign.');
    expect(line).toContain('href="/callsign/?from=clip"');
    expect(line).toContain('Claim yours →');
  });
  it('escapes a callsign', () => {
    expect(inviteLine({ callsign: '<b>x</b>', career: null })).not.toContain('<b>x');
  });
});
