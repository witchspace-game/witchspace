import { describe, expect, it } from 'vitest';
import { OUT_OF_ACTION } from '../../src/game/renowned';
import { isResult, summarise } from './renowned';

const NOW = Date.UTC(2026, 10, 9, 12);

describe("renowned pirates' shared record", () => {
  it('takes results only for systems that have one, and only beaten, won or ran', () => {
    expect(isResult({ galaxy: 0, system: 46, how: 'beaten' })).toBe(true); // Ambrose Hale, Riedquat
    expect(isResult({ galaxy: 0, system: 46, how: 'bribed' })).toBe(false);
    expect(isResult({ galaxy: 9, system: 46, how: 'won' })).toBe(false);
    expect(isResult({ galaxy: 0, system: 300, how: 'won' })).toBe(false);
    expect(isResult('beaten')).toBe(false);
  });

  it('sums up each pirate: tallies, when he is back, and the latest five', () => {
    const rows = [
      { system: 46, how: 'beaten' as const, at: NOW - 3600_000, callsign: 'Kestrel' },
      ...Array.from({ length: 6 }, (_, i) => ({ system: 46, how: 'won' as const, at: NOW - (i + 2) * 86_400_000, callsign: `Pilot${i}` })),
      { system: 27, how: 'ran' as const, at: NOW - 600_000, callsign: 'Wren' },
    ];
    const [hale, lasko] = summarise(rows, NOW);
    expect(hale).toMatchObject({ s: 46, beaten: 1, won: 6, ran: 0, out: NOW - 3600_000 + OUT_OF_ACTION });
    expect(hale.recent).toHaveLength(5);
    expect(hale.recent[0]).toEqual({ c: 'Kestrel', how: 'beaten', at: NOW - 3600_000 });
    expect(lasko).toMatchObject({ s: 27, ran: 1, out: 0 });
    // Long enough after, he's flying again.
    expect(summarise(rows, NOW + OUT_OF_ACTION)[0].out).toBe(0);
  });
});
