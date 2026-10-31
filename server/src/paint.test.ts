import { describe, expect, it } from 'vitest';
import { cleanPaint, ownPaint } from './paint';

const dark = { c: '#8f6bff', g: 1.25, t: '#f2f6ff', l: 1 as const, e: { i: 'dark', n: 1 } };

describe('paint in shared space', () => {
  it('keeps an edition, and its lights, for the account that holds that number', () => {
    expect(ownPaint(cleanPaint(dark), [{ id: 'dark', number: 1 }])).toEqual(dark);
  });

  it('flies anyone else plain: no number, no black-light lights', () => {
    expect(ownPaint(cleanPaint(dark), [])).toEqual({ c: '#8f6bff', g: 1.25, t: '#f2f6ff' });
    expect(ownPaint(cleanPaint(dark), [{ id: 'dark', number: 2 }])).toEqual({ c: '#8f6bff', g: 1.25, t: '#f2f6ff', l: 1 });
    expect(ownPaint(cleanPaint(dark), [{ id: 'witch-fire', number: 1 }])).toEqual({ c: '#8f6bff', g: 1.25, t: '#f2f6ff' });
  });

  it('drops a malformed edition', () => {
    expect(cleanPaint({ c: '#ffffff', e: { i: 'dark', n: 0 } })).toEqual({ c: '#ffffff' });
    expect(cleanPaint({ c: '#ffffff', e: 'dark 001' })).toEqual({ c: '#ffffff' });
  });
});
