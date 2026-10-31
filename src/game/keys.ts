// The keyboard, key by key, for the pop-out keyboard (ui/keyboard.ts): what each key does in each
// control scheme, in a word or two, and which group it belongs to. The full words are the controls
// lists (controls.ts controlRows); keys.test.ts checks every key here is in them, so the two can't drift.
// Like the printed keyboard overlay that came with Elite in 1984 (Mark: "a popout keyboard").

import type { ControlScheme } from './input';

export type KeyGroup = 'fly' | 'fight' | 'travel' | 'talk' | 'game';

export interface KeyUse {
  /** KeyboardEvent.code. */
  code: string;
  /** A word or two, on the key. */
  label: string;
  group: KeyGroup;
  /** How the controls list writes this key (its row is the full description). */
  token: string;
}

/** The keys every scheme shares. */
const SHARED: KeyUse[] = [
  { code: 'ArrowUp', label: 'Dive', group: 'fly', token: 'Arrows' },
  { code: 'ArrowDown', label: 'Climb', group: 'fly', token: 'Arrows' },
  { code: 'ArrowLeft', label: 'Roll ←', group: 'fly', token: 'Arrows' },
  { code: 'ArrowRight', label: 'Roll →', group: 'fly', token: 'Arrows' },
  { code: 'Comma', label: 'Roll ←', group: 'fly', token: '<' },
  { code: 'Period', label: 'Roll →', group: 'fly', token: '>' },
  { code: 'Space', label: 'Faster', group: 'fly', token: 'Space' },
  { code: 'ShiftLeft', label: 'Slower', group: 'fly', token: 'Shift' },
  { code: 'ShiftRight', label: 'Slower', group: 'fly', token: 'Shift' },
  { code: 'Slash', label: 'Slower', group: 'fly', token: '?' },
  { code: 'KeyC', label: 'Dock', group: 'travel', token: 'C' },
  { code: 'KeyH', label: 'Hyper', group: 'travel', token: 'H' },
  { code: 'KeyJ', label: 'Jump', group: 'travel', token: 'J' },
  { code: 'KeyG', label: 'Map', group: 'travel', token: 'G' },
  { code: 'KeyY', label: 'Galaxy', group: 'travel', token: 'Y' },
  { code: 'KeyO', label: 'Fight', group: 'fight', token: 'O' },
  { code: 'Digit9', label: 'Survey', group: 'travel', token: '9' },
  { code: 'KeyT', label: 'Arm', group: 'fight', token: 'T' },
  { code: 'KeyB', label: 'Bomb', group: 'fight', token: 'B' },
  { code: 'KeyZ', label: 'ECM', group: 'fight', token: 'Z' },
  { code: 'KeyR', label: 'Range', group: 'fight', token: 'R' },
  { code: 'KeyV', label: 'View', group: 'fly', token: 'V' },
  { code: 'Digit1', label: 'Front', group: 'fly', token: '1' },
  { code: 'Digit2', label: 'Rear', group: 'fly', token: '2' },
  { code: 'Digit3', label: 'Left', group: 'fly', token: '3' },
  { code: 'Digit4', label: 'Right', group: 'fly', token: '4' },
  { code: 'Digit0', label: 'Dark', group: 'talk', token: '0' },
  { code: 'KeyL', label: 'Hail', group: 'talk', token: 'L' },
  { code: 'Quote', label: 'Radio', group: 'talk', token: "'" },
  { code: 'Enter', label: 'Accept', group: 'talk', token: 'Enter' },
  { code: 'Backquote', label: 'SOS', group: 'talk', token: '`' },
  { code: 'KeyP', label: 'Photo', group: 'game', token: 'P' },
  { code: 'KeyK', label: 'Keys', group: 'game', token: 'K' },
  { code: 'KeyI', label: 'Invert', group: 'game', token: 'I' },
  { code: 'KeyN', label: 'Sound', group: 'game', token: 'N' },
  { code: 'F1', label: 'Help', group: 'game', token: 'F1' },
];

/** What each scheme adds, or changes, on top of the shared keys. */
const BY_SCHEME: Record<ControlScheme, KeyUse[]> = {
  mouse: [
    { code: 'KeyW', label: 'Faster', group: 'fly', token: 'W' },
    { code: 'KeyS', label: 'Slower', group: 'fly', token: 'S' },
    { code: 'KeyA', label: 'Roll ←', group: 'fly', token: 'A' },
    { code: 'KeyD', label: 'Roll →', group: 'fly', token: 'D' },
    { code: 'KeyQ', label: 'Yaw ←', group: 'fly', token: 'Q' },
    { code: 'KeyE', label: 'Yaw →', group: 'fly', token: 'E' },
    { code: 'KeyF', label: 'Fire', group: 'fight', token: 'F' },
    { code: 'KeyX', label: 'Missile', group: 'fight', token: 'X' },
    { code: 'KeyU', label: 'Yield', group: 'fight', token: 'U' },
    { code: 'KeyM', label: '1984', group: 'game', token: 'M' },
  ],
  keyboard: [
    { code: 'KeyW', label: 'Dive', group: 'fly', token: 'W' },
    { code: 'KeyS', label: 'Climb', group: 'fly', token: 'S' },
    { code: 'KeyA', label: 'Roll ←', group: 'fly', token: 'A' },
    { code: 'KeyD', label: 'Roll →', group: 'fly', token: 'D' },
    { code: 'KeyF', label: 'Fire', group: 'fight', token: 'F' },
    { code: 'KeyX', label: 'Missile', group: 'fight', token: 'X' },
    { code: 'KeyU', label: 'Yield', group: 'fight', token: 'U' },
    { code: 'KeyM', label: '1984', group: 'game', token: 'M' },
  ],
  bbc: [
    { code: 'KeyX', label: 'Climb', group: 'fly', token: 'X' },
    { code: 'KeyS', label: 'Dive', group: 'fly', token: 'S' },
    { code: 'KeyA', label: 'Fire', group: 'fight', token: 'A' },
    { code: 'KeyM', label: 'Missile', group: 'fight', token: 'M' },
    { code: 'KeyU', label: 'Unarm', group: 'fight', token: 'U' },
    { code: 'KeyE', label: 'ECM', group: 'fight', token: 'E' },
    { code: 'KeyQ', label: 'Yield', group: 'fight', token: 'Q' },
  ],
};

/** Every key this scheme uses, by code. */
export function keysFor(scheme: ControlScheme): Map<string, KeyUse> {
  return new Map([...SHARED, ...BY_SCHEME[scheme]].map((k) => [k.code, k]));
}

/** The keyboard, row by row: a code and its width in key units (a letter key is 1). '' is a gap. */
export const LAYOUT: [code: string, width: number][][] = [
  [['Escape', 1], ['', 0.5], ['F1', 1], ['', 12.5]],
  [['Backquote', 1], ['Digit1', 1], ['Digit2', 1], ['Digit3', 1], ['Digit4', 1], ['Digit5', 1], ['Digit6', 1], ['Digit7', 1], ['Digit8', 1], ['Digit9', 1], ['Digit0', 1], ['Minus', 1], ['Equal', 1], ['Backspace', 2]],
  [['Tab', 1.5], ['KeyQ', 1], ['KeyW', 1], ['KeyE', 1], ['KeyR', 1], ['KeyT', 1], ['KeyY', 1], ['KeyU', 1], ['KeyI', 1], ['KeyO', 1], ['KeyP', 1], ['BracketLeft', 1], ['BracketRight', 1], ['Backslash', 1.5]],
  [['CapsLock', 1.75], ['KeyA', 1], ['KeyS', 1], ['KeyD', 1], ['KeyF', 1], ['KeyG', 1], ['KeyH', 1], ['KeyJ', 1], ['KeyK', 1], ['KeyL', 1], ['Semicolon', 1], ['Quote', 1], ['Enter', 2.25]],
  [['ShiftLeft', 2.25], ['KeyZ', 1], ['KeyX', 1], ['KeyC', 1], ['KeyV', 1], ['KeyB', 1], ['KeyN', 1], ['KeyM', 1], ['Comma', 1], ['Period', 1], ['Slash', 1], ['ShiftRight', 2.75]],
  [['', 3.75], ['Space', 6.25], ['', 5]],
];
/** The arrow keys, beside the main block: up over left, down, right. */
export const ARROWS: [code: string, column: number, row: number][] = [
  ['ArrowUp', 1, 0],
  ['ArrowLeft', 0, 1],
  ['ArrowDown', 1, 1],
  ['ArrowRight', 2, 1],
];

/** What's printed on a key. */
export function keyCap(code: string, mac: boolean): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const caps: Record<string, string> = {
    Escape: 'esc', F1: mac ? 'fn F1' : 'F1', Backquote: '`', Minus: '-', Equal: '=', Backspace: mac ? 'delete' : '⌫', Tab: 'tab',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', CapsLock: 'caps', Semicolon: ';', Quote: "'", Enter: mac ? 'return' : 'enter',
    ShiftLeft: 'shift', ShiftRight: 'shift', Comma: '<', Period: '>', Slash: '?', Space: 'space',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };
  return caps[code] ?? code;
}
