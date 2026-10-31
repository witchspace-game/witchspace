import { describe, expect, it } from 'vitest';
import { controlRows } from './controls';
import { keysFor } from './keys';

describe('the pop-out keyboard', () => {
  it('only shows keys the controls lists describe, in every scheme', () => {
    for (const scheme of ['mouse', 'keyboard', 'bbc'] as const) {
      const rows = controlRows(scheme === 'bbc' ? 'bbc' : scheme === 'mouse', { gimballed: false, modern: true });
      const tokens = new Set(rows.flatMap(([k, v]) => [...k.split(/[\s/]+/), ...v.match(/[<>?]|Space|Shift/g) ?? []]));
      for (const k of keysFor(scheme).values()) expect(tokens.has(k.token), `${scheme}: ${k.code} (${k.token})`).toBe(true);
    }
  });

  it('flies the BBC Micro way on its keys', () => {
    const k = keysFor('bbc');
    expect([k.get('KeyX')?.label, k.get('KeyS')?.label, k.get('KeyA')?.label, k.get('KeyM')?.label]).toEqual(['Climb', 'Dive', 'Fire', 'Missile']);
  });
});
