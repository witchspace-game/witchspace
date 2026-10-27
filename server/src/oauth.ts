// Signing in from an assistant (docs/design/mcp-server.md, "Signing in from an
// assistant"): MCP clients sign in to remote servers with OAuth 2.1, so the
// Worker is a small authorisation server whose login step is the game's own,
// on the site's connect page. These are the pure parts: the metadata clients
// read, PKCE, and which addresses a client may be sent back to. The state
// (clients, requests, codes, tokens) is in accounts.ts.

export const SCOPE = 'submit';
export const REQUEST_TTL = 15 * 60_000; // to sign in and allow, on the connect page
export const CODE_TTL = 5 * 60_000;
export const ACCESS_TTL = 60 * 60_000;
export const REFRESH_TTL = 30 * 86_400_000;
export const BUILD_PATH = '/mcp/build';

/**
 * Who we are, to clients: always the live server, whatever the request says, unless OAUTH_ISSUER is set
 * (only ever for `wrangler dev --var OAUTH_ISSUER:http://127.0.0.1:8787`, which rewrites Host to the live one).
 */
export const issuerOf = (override?: string) => (override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override) ? override : 'https://space.witchspace.org.uk');

/** The site's connect page, beside the server it signs in to (the live site, or `npm run dev`). */
export const connectPage = (issuer: string) => (/^https:\/\//.test(issuer) ? 'https://witchspace.org.uk/connect/' : 'http://localhost:5173/connect/');

/** RFC 8414: where to register, sign in and get tokens. */
export function authServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    scopes_supported: [SCOPE],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    service_documentation: 'https://witchspace.org.uk/design/mcp-server/',
  };
}

/** RFC 9728: the signed-in MCP address, and who signs you in to it. */
export function protectedResourceMetadata(issuer: string) {
  return {
    resource: `${issuer}${BUILD_PATH}`,
    authorization_servers: [issuer],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Witchspace: hand in your work',
    resource_documentation: 'https://witchspace.org.uk/design/mcp-server/',
  };
}

export const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** PKCE S256: the challenge a verifier must match. */
export async function s256(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

/** RFC 7636: 43 to 128 characters from the unreserved set. */
export const verifierOk = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9\-._~]{43,128}$/.test(v);
export const challengeOk = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9\-_]{43}$/.test(v);

/** Where a client may be sent back to: https anywhere, or http on this machine (desktop apps); never with a fragment. */
export function redirectOk(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 500) return false;
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Is `given` one of a client's registered return addresses? Exactly, except that on this machine (http on
 * localhost or 127.0.0.1) the port may differ: apps listen on whatever port is free (RFC 8252, 7.3), and
 * Claude Code registers its addresses without one.
 */
export function redirectMatches(registered: readonly string[], given: string): boolean {
  if (registered.includes(given)) return true;
  if (!redirectOk(given)) return false;
  const g = new URL(given);
  if (g.protocol !== 'http:') return false;
  return registered.some((r) => {
    try {
      const u = new URL(r);
      return u.protocol === 'http:' && u.hostname === g.hostname && u.pathname === g.pathname && u.search === g.search;
    } catch {
      return false;
    }
  });
}

/** The address with these added to its query string. */
export function withParams(uri: string, params: Record<string, string | undefined>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}

/** A client's own name for itself, tidied: shown on the connect page as "says it is". */
export const clientName = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, 80) : 'An AI assistant');

/** A client id that is a metadata document's address (the newer way to identify a client, with no registration). */
export function isMetadataUrl(id: string): boolean {
  try {
    const u = new URL(id);
    return u.protocol === 'https:' && u.pathname !== '/' && !u.hash;
  } catch {
    return false;
  }
}
