// Phone, tablet or computer, for the daily totals (/stats/ping): a bucket only, never the
// browser's own string (Marketing, Mark's yes, 9 November 2026). The game says which it is
// (src/net/stats.ts), since an iPad's Safari calls itself a Mac; older games are bucketed from
// the User-Agent, which is read and forgotten.

export type DeviceKind = 'phone' | 'tablet' | 'desktop';

const KINDS: readonly string[] = ['phone', 'tablet', 'desktop'];

export function deviceKind(said: unknown, userAgent: string | null): DeviceKind {
  if (typeof said === 'string' && KINDS.includes(said)) return said as DeviceKind;
  const ua = userAgent ?? '';
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/iPhone|iPod|Android|Mobile|Windows Phone/i.test(ua)) return 'phone';
  return 'desktop';
}
