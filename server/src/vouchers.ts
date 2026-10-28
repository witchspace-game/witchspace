// Gift voucher codes: easy to read out and type, hard to guess. Four groups
// of four from an alphabet with no look-alikes (no 0/O, 1/I/L).

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function voucherCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(16);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

/** A code as typed: any case, spaces or dashes. '' if it can't be one. */
export function normaliseVoucher(typed: string): string {
  const s = typed
    .toUpperCase()
    .replace(/[\s-]/g, '');
  if (!/^[A-HJKMNP-Z2-9]{16}$/.test(s)) return '';
  return [0, 4, 8, 12].map((i) => s.slice(i, i + 4)).join('-');
}
