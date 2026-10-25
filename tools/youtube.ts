// Uploads and schedules videos on the Witchspace YouTube channel through the
// YouTube Data API: Google's sanctioned route for software, not the website.
// The start of the flight recorder's channel agent (docs/design/flight-recorder.md, section 5).
//
//   npx tsx tools/youtube.ts auth                 sign in once (opens the browser; you approve)
//   npx tsx tools/youtube.ts upload <plan.json>   upload what the plan lists (--dry-run to check it first)
//   npx tsx tools/youtube.ts list                 the channel's videos and when they go public
//
// Setup, once: in Google Cloud, make a project, enable "YouTube Data API v3",
// create an OAuth client of type "Desktop app", and save its JSON as
// ~/.witchspace-youtube-client.json. The sign-in token is kept in
// ~/.witchspace-youtube-token.json (readable only by you). Neither ever goes in
// the repo, and this tool never sees your Google password.
//
// A plan is a JSON list (keep it in launch/, which is private):
//   [{ "file": "press-shots/video/fight-short.mp4", "title": "...", "description": "...",
//      "tags": ["witchspace"], "publishAt": "2026-10-26T18:00:00+00:00", "playlist": "Witchspace Shorts" }]
// Without publishAt a video is uploaded private. After each upload its videoId is
// written back into the plan, so running it again never uploads twice.

import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';

const CLIENT = join(homedir(), '.witchspace-youtube-client.json');
const TOKEN = join(homedir(), '.witchspace-youtube-token.json');
const SCOPE = 'https://www.googleapis.com/auth/youtube'; // upload, schedule, playlists
const API = 'https://www.googleapis.com/youtube/v3';
const GAMING = '20'; // YouTube's category id for Gaming

interface PlanItem {
  file: string;
  title: string;
  description: string;
  tags?: string[];
  /** When it goes public (ISO 8601). Omit to upload private. */
  publishAt?: string;
  playlist?: string;
  /** Written back after upload. */
  videoId?: string;
}

interface Token {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function client(): { client_id: string; client_secret: string } {
  if (!existsSync(CLIENT)) {
    console.error(`No OAuth client. Save the "Desktop app" client JSON from Google Cloud as ${CLIENT} (see the top of this file).`);
    process.exit(1);
  }
  const j = JSON.parse(readFileSync(CLIENT, 'utf8'));
  return j.installed ?? j.web ?? j;
}

function save(token: Token) {
  writeFileSync(TOKEN, JSON.stringify(token));
  chmodSync(TOKEN, 0o600);
}

// --- Signing in: the OAuth loopback flow with PKCE, for desktop apps -------------

async function auth() {
  const { client_id, client_secret } = client();
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');
  const code = await new Promise<{ code: string; redirect: string }>((done, fail) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/') return res.writeHead(404).end();
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(ok ? '<p>Signed in. You can close this tab and go back to the terminal.</p>' : '<p>Sign-in failed or was cancelled.</p>');
      server.close();
      ok ? done({ code: url.searchParams.get('code')!, redirect }) : fail(new Error(url.searchParams.get('error') ?? 'sign-in failed'));
    });
    let redirect = '';
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      redirect = `http://127.0.0.1:${port}`;
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id, redirect_uri: redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state })}`;
      console.log(`Opening Google sign-in. Choose the account that owns the Witchspace channel, then the channel itself.\nIf nothing opens, visit:\n${url}\n`);
      execFile('open', [url]);
    });
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ code: code.code, client_id, client_secret, redirect_uri: code.redirect, grant_type: 'authorization_code', code_verifier: verifier }),
  });
  const j = await res.json();
  if (!res.ok || !j.refresh_token) throw new Error(`Token exchange failed: ${JSON.stringify(j)}`);
  save({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000 });
  const me = await api('GET', '/channels?part=snippet&mine=true');
  console.log(`Signed in as: ${me.items?.[0]?.snippet?.title ?? '(no channel)'}. Token saved to ${TOKEN}.`);
}

async function accessToken(): Promise<string> {
  if (!existsSync(TOKEN)) {
    console.error('Not signed in: run  npx tsx tools/youtube.ts auth');
    process.exit(1);
  }
  const t: Token = JSON.parse(readFileSync(TOKEN, 'utf8'));
  if (Date.now() < t.expires_at - 60_000) return t.access_token;
  const { client_id, client_secret } = client();
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id, client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }) });
  const j = await res.json();
  if (!res.ok) throw new Error(`Couldn't refresh the sign-in (run auth again): ${JSON.stringify(j)}`);
  save({ ...t, access_token: j.access_token, expires_at: Date.now() + j.expires_in * 1000 });
  return j.access_token;
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]}: ${res.status} ${j.error?.message ?? JSON.stringify(j)}`);
  return j;
}

// --- Uploading -----------------------------------------------------------------------

function checkPlan(plan: PlanItem[]): string[] {
  const problems: string[] = [];
  plan.forEach((p, i) => {
    const at = `item ${i + 1} (${p.title ?? p.file})`;
    if (!p.file || !existsSync(p.file)) problems.push(`${at}: no file at ${p.file}`);
    if (!p.title || p.title.length > 100) problems.push(`${at}: title must be 1 to 100 characters (${p.title?.length ?? 0})`);
    if (/[<>]/.test(p.title + p.description)) problems.push(`${at}: titles and descriptions can't contain < or >`);
    if ((p.description ?? '').length > 5000) problems.push(`${at}: description over 5,000 characters`);
    if ((p.tags ?? []).join(',').length > 500) problems.push(`${at}: tags over 500 characters in all`);
    if (p.publishAt && !(new Date(p.publishAt).getTime() > Date.now())) problems.push(`${at}: publishAt must be a time in the future (${p.publishAt})`);
  });
  return problems;
}

/** A resumable upload: the metadata first, then the file, in pieces (survives a dropped connection). */
async function uploadVideo(p: PlanItem): Promise<string> {
  const size = statSync(p.file).size;
  const meta = {
    snippet: { title: p.title, description: p.description, tags: p.tags ?? [], categoryId: GAMING, defaultLanguage: 'en', defaultAudioLanguage: 'en' },
    status: { privacyStatus: 'private', ...(p.publishAt ? { publishAt: new Date(p.publishAt).toISOString() } : {}), selfDeclaredMadeForKids: false, embeddable: true, license: 'youtube' },
  };
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify(meta),
  });
  if (!start.ok) throw new Error(`Starting the upload failed: ${start.status} ${await start.text()}`);
  const session = start.headers.get('location')!;
  const data = readFileSync(p.file);
  const CHUNK = 8 * 1024 * 1024; // must be a multiple of 256 KB
  let sent = 0;
  for (;;) {
    const end = Math.min(sent + CHUNK, size);
    const res = await fetch(session, { method: 'PUT', headers: { 'Content-Length': String(end - sent), 'Content-Range': `bytes ${sent}-${end - 1}/${size}` }, body: data.subarray(sent, end) });
    if (res.status === 308) {
      const range = res.headers.get('range'); // bytes=0-N: what YouTube has
      sent = range ? Number(range.split('-')[1]) + 1 : end;
      process.stdout.write(`\r  ${Math.round((sent / size) * 100)}%   `);
      continue;
    }
    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
    const video = await res.json();
    process.stdout.write('\r');
    return video.id as string;
  }
}

async function playlistId(title: string, cache: Map<string, string>): Promise<string> {
  if (cache.has(title)) return cache.get(title)!;
  let page = '';
  do {
    const r = await api('GET', `/playlists?part=snippet&mine=true&maxResults=50${page ? `&pageToken=${page}` : ''}`);
    for (const pl of r.items ?? []) cache.set(pl.snippet.title, pl.id);
    page = r.nextPageToken ?? '';
  } while (page && !cache.has(title));
  if (cache.has(title)) return cache.get(title)!;
  const made = await api('POST', '/playlists?part=snippet,status', { snippet: { title }, status: { privacyStatus: 'public' } });
  cache.set(title, made.id);
  return made.id;
}

async function upload(planPath: string, dryRun: boolean) {
  const plan: PlanItem[] = JSON.parse(readFileSync(planPath, 'utf8'));
  const todo = plan.filter((p) => !p.videoId);
  const problems = checkPlan(todo);
  if (problems.length) {
    console.error(problems.map((p) => `  ${p}`).join('\n'));
    process.exit(1);
  }
  for (const p of todo) console.log(`${dryRun ? 'Would upload' : 'Uploading'}: ${p.title}\n  ${p.file} (${(statSync(p.file).size / 1048576).toFixed(1)} MB) · ${p.publishAt ? `public at ${new Date(p.publishAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })} UK` : 'private'}${p.playlist ? ` · playlist "${p.playlist}"` : ''}`);
  if (dryRun || !todo.length) return console.log(todo.length ? '\nDry run: nothing uploaded.' : 'Everything in the plan is already uploaded.');
  const playlists = new Map<string, string>();
  for (const p of todo) {
    console.log(`\n${p.title}`);
    p.videoId = await uploadVideo(p);
    writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n'); // record it at once, so a rerun never repeats it
    console.log(`  uploaded: https://youtu.be/${p.videoId}`);
    if (p.playlist) {
      await api('POST', '/playlistItems?part=snippet', { snippet: { playlistId: await playlistId(p.playlist, playlists), resourceId: { kind: 'youtube#video', videoId: p.videoId } } });
      console.log(`  added to "${p.playlist}"`);
    }
  }
}

async function list() {
  const ch = await api('GET', '/channels?part=contentDetails,snippet&mine=true');
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return console.log('No channel found for this sign-in.');
  console.log(ch.items[0].snippet.title);
  const items = await api('GET', `/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}`);
  const ids = (items.items ?? []).map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId).join(',');
  if (!ids) return console.log('  no videos yet');
  const vids = await api('GET', `/videos?part=snippet,status&id=${ids}`);
  for (const v of vids.items ?? []) console.log(`  ${v.status.privacyStatus}${v.status.publishAt ? ` → public ${new Date(v.status.publishAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}` : ''}  ${v.snippet.title}  https://youtu.be/${v.id}`);
}

const [cmd, arg] = process.argv.slice(2);
const run = cmd === 'auth' ? auth() : cmd === 'list' ? list() : cmd === 'upload' && arg ? upload(resolve(arg), process.argv.includes('--dry-run')) : null;
if (!run) {
  console.log('Usage: npx tsx tools/youtube.ts auth | list | upload <plan.json> [--dry-run]');
  process.exit(1);
}
run.catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
