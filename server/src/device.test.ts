import { describe, expect, it } from 'vitest';
import { deviceKind } from './device';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPAD_OLD = 'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

describe('phone, tablet or computer', () => {
  it('takes what the game says', () => {
    expect(deviceKind('tablet', MAC)).toBe('tablet'); // an iPad's Safari calls itself a Mac
    expect(deviceKind('phone', null)).toBe('phone');
  });

  it('falls back on the browser for older games, and never anything but the three', () => {
    expect(deviceKind(undefined, IPHONE)).toBe('phone');
    expect(deviceKind(undefined, ANDROID_PHONE)).toBe('phone');
    expect(deviceKind(undefined, ANDROID_TABLET)).toBe('tablet');
    expect(deviceKind(undefined, IPAD_OLD)).toBe('tablet');
    expect(deviceKind(undefined, MAC)).toBe('desktop');
    expect(deviceKind('<script>', null)).toBe('desktop');
  });
});
