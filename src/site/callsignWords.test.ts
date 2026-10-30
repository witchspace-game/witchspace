import { describe, expect, it } from 'vitest';
import { careerById, careerLine, claimLine, cleanCallsign, finishFor, LAUNCH, memberNumber, memberSince, parseCheck, scenesFor, SCENES, variants, verdictWords } from './callsignWords';

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

describe('the careers and the line', () => {
  it('has the four, Trade by default, each with scenes that exist', () => {
    expect(careerById('fight').noun).toBe('Fighter');
    expect(careerById('nonsense').id).toBe('trade');
    expect(careerLine(careerById('explore'))).toBe('Every explorer needs a callsign.');
    for (const id of ['trade', 'fight', 'explore', 'build']) for (const s of careerById(id).scenes) expect(SCENES[s]).toBeTruthy();
  });

  it('puts a career’s own scenes first, and every scene once', () => {
    const list = scenesFor(careerById('build'));
    expect(list.slice(0, 2)).toEqual(['station-rising', 'yard']);
    expect(new Set(list).size).toBe(Object.keys(SCENES).length);
  });

  it('says "before launch" only until Show HN', () => {
    expect(claimLine(LAUNCH - 1)).toBe('Claim yours before launch.');
    expect(claimLine(LAUNCH)).toBe('Claim yours.');
  });
});

describe('the plate', () => {
  it('wears what was earned: an edition its own, Elite black, a founder titanium', () => {
    expect(finishFor({ edition: 'dark', elite: true })).toBe('dark');
    expect(finishFor({ elite: true, founding: true })).toBe('black');
    expect(finishFor({ founding: true })).toBe('titanium');
    expect(finishFor({})).toBe('alloy');
  });

  it('numbers members in two groups of four, never like a bank card', () => {
    expect(memberNumber(1)).toBe('0000 0001');
    expect(memberNumber(12345)).toBe('0001 2345');
    expect(memberNumber(null)).toBe('•••• ••••');
    expect(memberSince(Date.UTC(2026, 9, 30))).toBe('MEMBER SINCE 10/26');
  });
});
