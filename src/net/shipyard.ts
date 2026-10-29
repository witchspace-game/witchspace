import { API, sessionToken } from './account';

// The shipyard's few calls to the server: how many of each special edition are
// signed over and the numbers you hold. Both need you signed in, so they belong
// to you on every device.

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

/** The numbered editions this account holds, as the yard's office has them, each with its certificate's private link. */
export const heldEditions = () => call<{ editions: { edition: string; number: number; token?: string; link?: string | null }[] }>('GET', '/me/editions');


/** A ship specced on the site, saved to your account so it reaches every device (docs/design/ship-configurator.md). */
export const accountSpec = () => call<{ spec: unknown; at: number | null }>('GET', '/me/spec');
export const forgetAccountSpec = () => call<{ ok: true }>('DELETE', '/me/spec');

/** Ships signed over to this account (no code): where each is waiting, and its edition number if it has one. */
export const signedOver = () => call<{ gifts: { ship: string; edition: string | null; number: number | null; galaxy: number; system: number }[] }>('GET', '/me/gifts');
