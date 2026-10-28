import type { ShipDef } from '../content/types';

// A ship file in a link: /ship-editor/#ship=<the file, deflated and base64url>.
// It's in the hash, so it never reaches a server: a draft on a branch can be
// sent to a phone without a deploy (tools/ship-link.ts makes one). No DOM here,
// so it can be tested, and the tool can use it in Node.

export const LINK_KEY = 'ship';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const toBase64url = (b: Uint8Array) => {
  let s = '';
  for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** The hash for a ship file: "ship=…". */
export async function shipHash(file: unknown): Promise<string> {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(file)), new CompressionStream('deflate-raw'));
  return `${LINK_KEY}=${toBase64url(bytes)}`;
}

/** The ship file in a hash, if there is one and it looks like a ship. */
export async function shipFromHash(hash: string): Promise<ShipDef | null> {
  const m = new RegExp(`^#?${LINK_KEY}=([\\w-]+)$`).exec(hash);
  if (!m) return null;
  try {
    const bytes = await pipe(fromBase64url(m[1]), new DecompressionStream('deflate-raw'));
    const s = JSON.parse(new TextDecoder().decode(bytes)) as ShipDef;
    const ok = typeof s?.name === 'string' && Array.isArray(s.geometry?.vertices) && Array.isArray(s.geometry?.faces) && typeof s.stats === 'object' && typeof s.style?.lineColor === 'string';
    return ok ? s : null;
  } catch {
    return null;
  }
}
