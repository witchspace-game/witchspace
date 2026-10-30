import { describe, expect, it } from 'vitest';
import { emailKey } from './emailKey';

describe('emailKey', () => {
  it('drops a +tag', () => {
    expect(emailKey('Mark+Bond@Example.co.uk')).toBe('mark@example.co.uk');
    expect(emailKey('mark@example.co.uk')).toBe('mark@example.co.uk');
  });
  it('treats Gmail as Gmail does: no dots, googlemail the same', () => {
    expect(emailKey('j.ame.son+alt@gmail.com')).toBe('jameson@gmail.com');
    expect(emailKey('jameson@googlemail.com')).toBe('jameson@gmail.com');
  });
  it('keeps dots elsewhere', () => {
    expect(emailKey('a.b@example.com')).toBe('a.b@example.com');
  });
  it('leaves an address that starts with + alone', () => {
    expect(emailKey('+x@example.com')).toBe('+x@example.com');
  });
});
