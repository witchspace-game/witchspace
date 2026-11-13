// A deleted account's archive (Mark: "leave it archived for 90 days"). Deleting an account takes it
// out of the game at once: signed out everywhere, no emails or notifications, and its card, firsts and
// pirate record gone from public view. Its rows are kept here, out of every live table, for 90 days, so
// signing in again with the same email brings it all back. After that, they're erased for good.
// accounts.ts does the SQL; this packs rows into text and back, blobs included.

/** How long a deleted account is kept before it's erased. */
export const ARCHIVE_DAYS = 90;
export const ARCHIVE_MS = ARCHIVE_DAYS * 86_400_000;

/** The tables archived with an account, by their `account` column (the accounts row itself goes by id). */
export const ARCHIVED = ['saves', 'cards', 'firsts', 'renowned', 'submissions', 'registrations', 'ships'] as const;

type Value = string | number | null | ArrayBuffer;
export type Row = Record<string, Value>;
export type Packed = Record<string, Row[]>;

const B = '$b64';

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(text: string): ArrayBuffer {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

/** Rows by table, as text: blobs (a card's picture) as base64. */
export function pack(tables: Packed): string {
  return JSON.stringify(tables, (_k, v: unknown) => (v instanceof ArrayBuffer ? { [B]: toB64(v) } : ArrayBuffer.isView(v) ? { [B]: toB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice().buffer) } : v));
}

export function unpack(text: string): Packed {
  return JSON.parse(text, (_k, v: unknown) => (v && typeof v === 'object' && B in v && typeof (v as Record<string, unknown>)[B] === 'string' ? fromB64((v as Record<string, string>)[B]) : v)) as Packed;
}

/** An INSERT for one row, for whatever columns it had when it was archived. */
export function insertFor(table: string, row: Row): { sql: string; values: Value[] } {
  const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
  return { sql: `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, values: cols.map((c) => row[c]) };
}
