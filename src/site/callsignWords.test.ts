import { describe, expect, it } from 'vitest';
import { claimLine, cleanCallsign, LAUNCH, parseCheck, roleById, roleLine, variants, verdictWords } from './callsignWords';

describe('a callsign as typed', () => {
  it('is tidied the way the server keeps it', () => {
    expect(cleanCallsign('  Lead   Balloon!! ')).toBe('Lead Balloon');
    expect(cleanCallsign('CMDR Jameson')).toBe('Jameson');
    expect(cleanCallsign("O'Brien-Smith_2")).toBe("O'Brien-Smith_2");
    expect(cleanCallsign('Zoë')).toBe('Zoë');
    expect(cleanCallsign('a'.repeat(30))).toHaveLength(24);
  });
});

describe('the server’s answer', () => {
  it('keeps a sensible one and drops the rest', () => {
    expect(parseCheck({ name: 'Lead Balloon', verdict: 'free' })).toEqual({ name: 'Lead Balloon', verdict: 'free' });
    expect(parseCheck({ name: 'Police', verdict: 'never', reason: 'Sounds official' })).toEqual({ name: 'Police', verdict: 'never', reason: 'Sounds official' });
    expect(parseCheck({ name: 'X', verdict: 'maybe' })).toBeNull();
    expect(parseCheck({ error: 'Too many' })).toBeNull();
    expect(parseCheck(null)).toBeNull();
  });

  it('is said plainly, and a reserved name never says why', () => {
    expect(verdictWords({ name: 'Lead Balloon', verdict: 'free' })).toBe('CMDR Lead Balloon is free.');
    expect(verdictWords({ name: 'Jameson', verdict: 'taken' })).toBe('CMDR Jameson is taken: another commander has it.');
    expect(verdictWords({ name: 'Red Baron', verdict: 'reserved', reason: 'A real person' })).toBe('Red Baron is reserved.');
    expect(verdictWords({ name: 'Police', verdict: 'never', reason: 'Sounds official' })).toBe('Police can’t be a callsign: sounds official.');
  });
});

describe('when a name is taken', () => {
  it('tries II, III and IV, within 24 letters', () => {
    expect(variants('Lead Balloon')).toEqual(['Lead Balloon II', 'Lead Balloon III', 'Lead Balloon IV']);
    expect(variants('Lead Balloon II')).toEqual(['Lead Balloon III', 'Lead Balloon IV']);
    for (const v of variants('x'.repeat(24))) expect(v.length).toBeLessThanOrEqual(24);
  });
});

describe('the roles and the line', () => {
  it('has a ship for each role, and the Trader by default', () => {
    expect(roleById('pirate').ship).toBe('mamba');
    expect(roleById('nonsense').id).toBe('trader');
    expect(roleLine(roleById('legend'))).toBe('Every legend needs a callsign.');
  });

  it('says "before launch" only until Show HN', () => {
    expect(claimLine(LAUNCH - 1)).toBe('Claim yours before launch.');
    expect(claimLine(LAUNCH)).toBe('Claim yours.');
  });
});
