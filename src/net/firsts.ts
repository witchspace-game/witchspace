// Your name on the galaxy: who brought each world's, moon's and signal's data
// home first (docs/design/exploration.md, stage 1b). The server side is in
// server/src/accounts.ts. Signed out, nothing is claimed and the chart simply
// shows what others have found.

import { API, currentAccount, sessionToken } from './account';

export interface Claim {
  galaxy: number;
  system: number;
  body: string;
}

const CACHE_MS = 5 * 60_000;
const cache = new Map<number, { at: number; bySystem: Map<number, Map<string, string>> }>();
const loading = new Map<number, Promise<void>>();

/** Fetch a galaxy's firsts, if they're not fresh already. */
export function loadFirsts(galaxy: number): Promise<void> {
  const have = cache.get(galaxy);
  if (have && Date.now() - have.at < CACHE_MS) return Promise.resolve();
  const busy = loading.get(galaxy);
  if (busy) return busy;
  const p = fetch(`${API}/firsts/${galaxy}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ firsts: { s: number; b: string; c: string }[] }>) : { firsts: [] }))
    .then(({ firsts }) => {
      const bySystem = new Map<number, Map<string, string>>();
      for (const f of firsts) {
        if (!bySystem.has(f.s)) bySystem.set(f.s, new Map());
        bySystem.get(f.s)!.set(f.b, f.c);
      }
      cache.set(galaxy, { at: Date.now(), bySystem });
    })
    .catch(() => {}) // offline: the chart goes without
    .finally(() => loading.delete(galaxy));
  loading.set(galaxy, p);
  return p;
}

/** Who found what first in a system, by body id (from the last fetch). */
export const firstsIn = (galaxy: number, system: number): Map<string, string> => cache.get(galaxy)?.bySystem.get(system) ?? new Map();

/** Data just brought home: claim it. Returns the claims that were yours (first), or none if signed out. */
export async function claimFirsts(claims: Claim[]): Promise<Claim[]> {
  const session = sessionToken();
  if (!session || !currentAccount()?.callsign || !claims.length) return [];
  try {
    const res = await fetch(`${API}/me/firsts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ claims: claims.slice(0, 60) }),
    });
    if (!res.ok) return [];
    const { firsts } = (await res.json()) as { firsts: Claim[] };
    // What's yours shows on the chart straight away.
    const callsign = currentAccount()!.callsign!;
    for (const f of firsts) {
      // Not fetched yet: start the galaxy with what's yours, stale so the next look fetches the rest.
      if (!cache.has(f.galaxy)) cache.set(f.galaxy, { at: 0, bySystem: new Map() });
      const g = cache.get(f.galaxy)!;
      if (!g.bySystem.has(f.system)) g.bySystem.set(f.system, new Map());
      g.bySystem.get(f.system)!.set(f.body, callsign);
    }
    return firsts;
  } catch {
    return [];
  }
}
