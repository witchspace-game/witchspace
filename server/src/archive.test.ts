import { describe, expect, it } from 'vitest';
import { insertFor, pack, unpack } from './archive';

describe("a deleted account's archive", () => {
  it('keeps every row, a card picture included, byte for byte', () => {
    const picture = new Uint8Array(70_000).map((_, i) => (i * 7) % 256);
    const tables = { accounts: [{ id: 'a1', email: 'k@example.com', callsign: 'Kestrel', member: 12 }], cards: [{ account: 'a1', id: 'c1', image: picture.buffer, at: 5 }] };
    const back = unpack(pack(tables));
    expect(back.accounts).toEqual(tables.accounts);
    expect(new Uint8Array(back.cards[0].image as ArrayBuffer)).toEqual(picture);
  });

  it('puts a row back with the columns it had', () => {
    expect(insertFor('saves', { account: 'a1', data: '{}', updated: 3 })).toEqual({ sql: 'INSERT OR IGNORE INTO saves (account, data, updated) VALUES (?, ?, ?)', values: ['a1', '{}', 3] });
    expect(insertFor('saves', { 'x; DROP TABLE saves': 1, account: 'a1' }).sql).not.toContain('DROP');
  });
});
