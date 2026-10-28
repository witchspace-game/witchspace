import { API, sessionToken } from './account';

// The shipyard's few calls to the server: how many of each special edition are
// spoken for, claiming your number, and redeeming a gift voucher. Numbers and
// vouchers need you signed in, so they belong to you on every device.

const auth = (): Record<string, string> => {
  const s = sessionToken();
  return s ? { Authorization: `Bearer ${s}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

async function call<T>(method: string, path: string, body?: unknown): Promise<T | { error: string }> {
  const res = await fetch(`${API}${path}`, { method, headers: auth(), body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  if (!res) return { error: "Couldn't reach the yard's office (witchspace.org.uk)" };
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return res.ok ? data : { error: data.error ?? `That didn't work (${res.status})` };
}

export async function editionCounts(): Promise<Record<string, { limit: number; taken: number }>> {
  const r = await call<{ editions: { id: string; limit: number; taken: number }[] }>('GET', '/shipyard/editions');
  return 'error' in r ? {} : Object.fromEntries(r.editions.map((e) => [e.id, { limit: e.limit, taken: e.taken }]));
}

export const claimEdition = (edition: string) => call<{ number: number; limit: number }>('POST', '/me/edition', { edition });
export const releaseEdition = (edition: string) => call<{ ok: true }>('DELETE', '/me/edition', { edition });
export const redeemVoucher = (code: string) => call<{ ship: string }>('POST', '/me/voucher', { code });
