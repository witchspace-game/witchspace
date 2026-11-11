import { beforeEach, describe, expect, it } from 'vitest';
import { newCommander } from './commander';
import { noteOffence, offenceWords, RAP_SHEET, recordCrime } from './law';
import { recordsKind, setRecordsKind } from './recorderKinds';

describe('the rap sheet', () => {
  it('puts each named offence on file, with where, what and what it made you', () => {
    const c = newCommander('modern');
    recordCrime(c, 'fugitive', true, 'Firing on a police Viper');
    expect(c.rapSheet).toHaveLength(1);
    expect(c.rapSheet![0]).toMatchObject({ galaxy: c.location.galaxy, system: c.location.system, what: 'Firing on a police Viper', made: 'fugitive', warrant: true });
  });

  it('files an offence even when your record here is already worse', () => {
    const c = newCommander('modern');
    recordCrime(c, 'fugitive', false, 'Firing on a police Viper');
    recordCrime(c, 'offender', false, 'Firing on a trader');
    expect(c.rapSheet!.map((o) => o.what)).toEqual(['Firing on a police Viper', 'Firing on a trader']);
  });

  it('files nothing where there is no law', () => {
    const c = newCommander('modern');
    c.location.system = [...Array(256).keys()].find((i) => i !== 7 && recordCrime({ ...newCommander('modern'), location: { ...c.location, system: i } }, 'offender', false, 'x') === null)!;
    expect(recordCrime(c, 'offender', false, 'Firing on a trader')).toBeNull();
    expect(c.rapSheet ?? []).toHaveLength(0);
  });

  it(`keeps the last ${RAP_SHEET}`, () => {
    const c = newCommander('modern');
    for (let i = 0; i < RAP_SHEET + 5; i++) noteOffence(c, `Offence ${i}`, 'offender');
    expect(c.rapSheet).toHaveLength(RAP_SHEET);
    expect(c.rapSheet![0].what).toBe('Offence 5');
  });

  it('takes the verdict off a crime’s words', () => {
    expect(offenceWords('Firing on a trader · you are an OFFENDER')).toBe('Firing on a trader');
    expect(offenceWords('Scanned by police · contraband found · you are an OFFENDER')).toBe('Scanned by police · contraband found');
    expect(offenceWords('Firing on a trader, running dark · you are the suspect · OFFENDER')).toBe('Firing on a trader, running dark');
    expect(offenceWords('Transponder on · you ignored a police hail · OFFENDER')).toBe('Transponder on · you ignored a police hail');
  });
});

describe('what the flight recorder keeps', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
  });

  it('keeps everything but surveys at first, and always what you keep by hand', () => {
    expect(recordsKind('discovery')).toBe(false);
    for (const k of ['kill', 'death', 'legend', 'marshals', 'crime', 'trade'] as const) expect(recordsKind(k)).toBe(true);
    expect(recordsKind('kept')).toBe(true);
    expect(recordsKind('photo')).toBe(true);
  });

  it('remembers your switches', () => {
    setRecordsKind('discovery', true);
    setRecordsKind('trade', false);
    expect(recordsKind('discovery')).toBe(true);
    expect(recordsKind('trade')).toBe(false);
  });
});
