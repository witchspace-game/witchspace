// Small helpers shared by the ideas board and accounts.

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A random token, URL-safe. */
export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The visitor's network, as a salted hash: we never keep the address itself. */
export async function networkOf(request: Request, salt: string): Promise<string> {
  return (await sha256(salt + (request.headers.get('CF-Connecting-IP') ?? 'local'))).slice(0, 24);
}

/** Cloudflare Turnstile: is this a person? Skipped when no secret is set (local development). */
export async function isHuman(secret: string | undefined, token: unknown, request: Request): Promise<boolean> {
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean };
  return out.success === true;
}
