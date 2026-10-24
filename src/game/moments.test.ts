import { describe, expect, it } from 'vitest';
import { leadEvent, momentDescription, momentTags, momentTitle, type MomentContext, type MomentEvent } from './moments';

const ctx: MomentContext = { callsign: 'Jameson', system: 'Riedquat', galaxy: 1, government: 'Anarchy', rank: 'Average', when: Date.UTC(2026, 9, 24, 20, 15) };
const kill = (s: string): MomentEvent => ({ kind: 'kill', text: `${s} destroyed · bounty 80 Cr`, subject: s });

describe('moments', () => {
  it('names a clip by its most remarkable event', () => {
    expect(leadEvent([kill('Mamba'), { kind: 'death', text: 'Ship destroyed' }]).kind).toBe('death');
    expect(momentTitle([kill('Mamba')], ctx)).toBe('CMDR Jameson: Mamba down at Riedquat');
    expect(momentTitle([kill('Mamba'), kill('Sidewinder')], ctx)).toBe('CMDR Jameson: 2 kills in one fight at Riedquat');
    expect(momentTitle([kill('Mamba'), { kind: 'death', text: 'Ship destroyed' }], ctx)).toBe('CMDR Jameson: Took 1 pirate with me at Riedquat');
    expect(momentTitle([{ kind: 'legend', text: 'Hull read: the Falcon', subject: 'The Falcon' }], ctx)).toBe('CMDR Jameson: The Falcon, running dark at Riedquat');
  });

  it('never claims a first it can’t know', () => {
    expect(momentTitle([{ kind: 'discovery', text: 'Survey complete · Riedquat', subject: 'Riedquat' }], ctx)).not.toMatch(/first/i);
  });

  it('keeps titles within YouTube’s 100 characters', () => {
    expect(momentTitle([kill('A'.repeat(200))], { ...ctx, callsign: 'B'.repeat(40) }).length).toBeLessThanOrEqual(100);
  });

  it('writes a true description and tags from what happened', () => {
    const d = momentDescription([kill('Mamba')], ctx);
    expect(d).toMatch(/Riedquat \(galaxy 1, Anarchy\), 2026-10-24 20:15 UTC/);
    expect(d).toMatch(/· Mamba destroyed · bounty 80 Cr/);
    expect(d).toMatch(/witchspace\.org\.uk\/play/);
    expect(momentTags([kill('Mamba')], ctx)).toEqual(expect.arrayContaining(['witchspace', 'flight recorder', 'dogfight', 'mamba', 'riedquat']));
  });
});
