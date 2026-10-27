// The Witchspace GitHub App (docs/design/submissions.md): when a maintainer
// accepts a submission, it opens the pull request, so the author never needs
// GitHub. It can reach this one repository, with contents and pull requests.
// Two secrets: GITHUB_APP_ID, and GITHUB_APP_KEY, the private key as GitHub
// gives it (PKCS#1 PEM; PKCS#8 works too).

import type { PullRequestText } from './submissions';

export interface GitHubEnv {
  GITHUB_APP_ID?: string;
  GITHUB_APP_KEY?: string;
}

const REPO = 'witchspace-game/witchspace';
const API = 'https://api.github.com';
const BASE = 'main';

export const gitHubReady = (env: GitHubEnv) => Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_KEY);

// --- The key -------------------------------------------------------------------------

/** DER length bytes. */
function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  for (let v = n; v > 0; v >>= 8) bytes.unshift(v & 0xff);
  return [0x80 | bytes.length, ...bytes];
}

const RSA_ALGORITHM = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];

/** GitHub hands out PKCS#1 keys; WebCrypto reads only PKCS#8. Wrap one in the other. */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array<ArrayBuffer> {
  const octets = [0x04, ...derLength(pkcs1.length), ...pkcs1];
  const inner = [0x02, 0x01, 0x00, ...RSA_ALGORITHM, ...octets];
  return new Uint8Array([0x30, ...derLength(inner.length), ...inner]);
}

/** A PEM private key, either kind, as PKCS#8 bytes. */
export function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const pkcs1 = pem.includes('BEGIN RSA PRIVATE KEY');
  const b64 = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return pkcs1 ? pkcs1ToPkcs8(der) : der;
}

const b64url = (v: Uint8Array | string) =>
  btoa(String.fromCharCode(...(typeof v === 'string' ? new TextEncoder().encode(v) : v)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** The App's own token: a JWT signed with its key, good for ten minutes (we ask for nine). */
export async function appJwt(appId: string, pem: string, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const iat = Math.floor(now / 1000) - 60; // GitHub allows for clocks a little out
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iat, exp: iat + 540, iss: appId }))}`;
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64url(sig)}`;
}

// --- Calling GitHub --------------------------------------------------------------------

async function gh(token: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'witchspace-submissions',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
}

function must(r: { status: number; data: Record<string, unknown> }, what: string) {
  if (r.status >= 300) throw new Error(`GitHub wouldn't ${what} (${r.status}: ${String(r.data.message ?? 'no message')})`);
  return r.data;
}

/** An installation token for this repository, good for an hour. */
async function installationToken(env: GitHubEnv): Promise<string> {
  const jwt = await appJwt(env.GITHUB_APP_ID!, env.GITHUB_APP_KEY!);
  const installation = must(await gh(jwt, 'GET', `/repos/${REPO}/installation`), 'find the App installed on the repository');
  const token = must(await gh(jwt, 'POST', `/app/installations/${String(installation.id)}/access_tokens`), 'give the App a token');
  return token.token as string;
}

const utf8Base64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Open the pull request: a branch from main, the file on it, and the request. Returns its address. */
export async function openPullRequest(env: GitHubEnv, file: { path: string; text: string }, pr: PullRequestText): Promise<string> {
  const token = await installationToken(env);
  const base = must(await gh(token, 'GET', `/repos/${REPO}/git/ref/heads/${BASE}`), 'read main');
  const sha = (base.object as { sha: string }).sha;
  const branch = await gh(token, 'POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${pr.branch}`, sha });
  // Already there (a retry after a failure part-way): carry on with it.
  if (branch.status >= 300 && branch.status !== 422) must(branch, 'make the branch');
  const existing = await gh(token, 'GET', `/repos/${REPO}/contents/${file.path}?ref=${encodeURIComponent(pr.branch)}`);
  must(
    await gh(token, 'PUT', `/repos/${REPO}/contents/${file.path}`, {
      message: pr.commit,
      content: utf8Base64(file.text),
      branch: pr.branch,
      ...(existing.status === 200 ? { sha: existing.data.sha } : {}),
    }),
    'commit the file',
  );
  const opened = await gh(token, 'POST', `/repos/${REPO}/pulls`, { title: pr.title, head: pr.branch, base: BASE, body: pr.body });
  if (opened.status === 422) {
    // One is already open for this branch: use it.
    const open = await gh(token, 'GET', `/repos/${REPO}/pulls?head=${REPO.split('/')[0]}:${encodeURIComponent(pr.branch)}&state=open`);
    const first = (open.data as unknown as { html_url: string }[])[0];
    if (first) return first.html_url;
  }
  return must(opened, 'open the pull request').html_url as string;
}
