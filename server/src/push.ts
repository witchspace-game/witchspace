// Web Push, the standard way browsers receive notifications, without a third
// party. We send an empty push signed with our VAPID key; the browser wakes
// our service worker (public/sw.js), which asks us what to show. Sending no
// payload means nothing needs encrypting.

export interface PushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const text = (s: string) => b64url(new TextEncoder().encode(s));

/** Push services we'll send to: the browsers' own (stops the endpoint being used to reach anywhere else). */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.apple\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];

export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

/** A VAPID token for one push service, signed with our private key (a P-256 JWK). */
async function vapidToken(endpoint: string, privateJwk: string, subject: string): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(privateJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = text(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = text(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(signature)}`;
}

/** Send an empty push. Returns 'gone' if the subscription has expired and should be forgotten. */
export async function sendPush(endpoint: string, vapid: { publicKey: string; privateJwk: string }): Promise<'sent' | 'gone' | 'failed'> {
  const token = await vapidToken(endpoint, vapid.privateJwk, 'mailto:hello@witchspace.org.uk');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { TTL: String(48 * 3600), Urgency: 'normal', Authorization: `vapid t=${token}, k=${vapid.publicKey}`, 'Content-Length': '0' },
  });
  if (res.status === 404 || res.status === 410) return 'gone';
  return res.ok ? 'sent' : 'failed';
}
