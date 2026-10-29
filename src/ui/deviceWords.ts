// Words for the device you're on (Mark: keyboard letters on a phone). The kit's
// descriptions are written for a keyboard ("Press C"); on a touch screen they say
// what to tap instead, by the drawer and HUD buttons' own names.

import { isTouch } from '../game/input';

const TAPS: [RegExp, string][] = [
  [/\bPress C\b/g, 'Tap Dock'],
  [/\bPress O\b/g, 'Tap Combat'],
  [/\bPress Z\b/g, 'Tap ECM'],
  [/\bPress B\b/g, 'Tap Bomb'],
  [/\bPress 9\b/g, 'Tap Survey'],
  [/\bPress 0\b/g, 'Tap Dark'],
  [/\bH stops it\b/g, 'Tapping Hyper stops it'],
  [/ \(or Y\)/g, ''],
];

/** A kit description (or any line written for a keyboard), said for this device. */
export const forDevice = (text: string): string => (isTouch ? TAPS.reduce((s, [re, to]) => s.replace(re, to), text) : text);
