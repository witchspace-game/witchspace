import { describe, expect, it } from 'vitest';
import { readyMessage } from './yard';

const name = () => 'Fer-de-lance';
const H = 3_600_000;

describe('the yard tells you', () => {
  it('when your ship is finished, once (by key), and not before', () => {
    const o = { ship: 'fer-de-lance', name: 'Halcyon', placed: 0 };
    expect(readyMessage(o, name, 71 * H)).toBeNull();
    expect(readyMessage(o, name, 72 * H)).toMatchObject({ key: 'yard:0', body: expect.stringContaining('Your Fer-de-lance “Halcyon”') });
  });
  it('by edition and number, and never for a gift', () => {
    expect(readyMessage({ ship: 'fer-de-lance', placed: 0, edition: { id: 'dark', number: 1 } }, name, 100 * H)?.body).toContain('Dark Edition 001');
    expect(readyMessage({ ship: 'fer-de-lance', placed: 0, gifted: true }, name, 100 * H)).toBeNull();
  });
});
