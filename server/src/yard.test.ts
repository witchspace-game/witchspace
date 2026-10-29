import { describe, expect, it } from 'vitest';
import { arrivedMessages, readyMessage } from './yard';

const name = () => 'Fer-de-lance';
const H = 3_600_000;

describe('the yard tells you', () => {
  it('when your ship is finished, once (by key), and not before', () => {
    const o = { ship: 'fer-de-lance', name: 'Halcyon', placed: 0 };
    expect(readyMessage(o, name, 71 * H)).toBeNull();
    expect(readyMessage(o, name, 72 * H)).toMatchObject({ key: 'yard:0', body: expect.stringContaining('Your Fer-de-lance “Halcyon”') });
  });
  it('by edition and number, and never for a gift', () => {
    // An edition takes longer: the Dark Edition a week.
    expect(readyMessage({ ship: 'fer-de-lance', placed: 0, edition: { id: 'dark', number: 1 } }, name, 100 * H)).toBeNull();
    expect(readyMessage({ ship: 'fer-de-lance', placed: 0, edition: { id: 'dark', number: 1 } }, name, 168 * H)?.body).toContain('Dark Edition 001');
    expect(readyMessage({ ship: 'fer-de-lance', placed: 0, gifted: true }, name, 100 * H)).toBeNull();
  });
});

describe('the Carriers’ Mutual tell you', () => {
  it('when a ship you sent for has arrived, once each, and not before', () => {
    const s = { id: 'a1', ship: 'cobra-mk3', equipment: [], lasers: {}, missiles: 0, damaged: [], at: { galaxy: 0, system: 1 }, delivery: { to: { galaxy: 0, system: 7 }, arrives: 5 * H } };
    expect(arrivedMessages([s], () => 'Cobra Mk III', 4 * H)).toEqual([]);
    expect(arrivedMessages([s], () => 'Cobra Mk III', 5 * H)).toEqual([{ key: `fleet:a1:${5 * H}`, title: 'Your ship has arrived', body: 'Your Cobra Mk III has arrived at Lave, in the hangar and waiting for you.' }]);
    expect(arrivedMessages(undefined, () => '', 5 * H)).toEqual([]);
  });
});
