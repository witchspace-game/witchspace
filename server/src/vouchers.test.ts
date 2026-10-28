import { describe, expect, it } from 'vitest';
import { normaliseVoucher, voucherCode } from './vouchers';

describe('voucher codes', () => {
  it('are four groups of four, with no look-alikes', () => {
    const code = voucherCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
  });
  it('forgive how they were typed', () => {
    const code = voucherCode();
    expect(normaliseVoucher(code.toLowerCase().replace(/-/g, ' '))).toBe(code);
    expect(normaliseVoucher('nope')).toBe('');
  });
});
