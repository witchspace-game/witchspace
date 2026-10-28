import { beforeEach, describe, expect, it } from 'vitest';

// A stand-in for the browser's storage, so the save and load run as they do in the game.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  });
});

describe('the save’s checksum, as Elite’s commander files had', () => {
  it('loads an untouched save as it was, and starts its ledger', async () => {
    const { loadCommander, newCommander, saveCommander } = await import('./commander');
    const c = newCommander('modern');
    c.credits = 1234;
    saveCommander(c);
    const back = loadCommander()!;
    expect(back.credits).toBe(1234);
    expect(back.tampered).toBeUndefined();
    expect(back.ledger?.balance).toBe(1234);
  });

  it('marks a save edited by hand', async () => {
    const { loadCommander, newCommander, saveCommander } = await import('./commander');
    saveCommander(newCommander('modern'));
    const [key, raw] = [...store.entries()][0];
    store.set(key, raw.replace('"credits":100', '"credits":9999999'));
    expect(loadCommander()!.tampered).toBe(true);
  });
});
