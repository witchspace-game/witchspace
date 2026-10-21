// Uploads the press kit's images and videos (site/media.json) to Cloudinary,
// so the website can serve them at any size and people can share them.
//
//   CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud> npx tsx tools/upload-media.ts
//
// Each item goes to <folder>/<id> in the account named in media.json. Only
// files that have changed since the last upload are sent; the version,
// size and a hash of each upload are written back to media.json, which is
// what the website builds its links from. The credentials are only ever
// read from the environment: never put them in a file in this repo.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = join(root, 'site/media.json');

interface Item {
  id: string;
  kind: 'image' | 'video';
  file: string;
  hash?: string;
  version?: number;
  width?: number;
  height?: number;
  bytes?: number;
  duration?: number;
}

const url = process.env.CLOUDINARY_URL;
const match = url?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
if (!match) {
  console.error('Set CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud> to upload.');
  process.exit(1);
}
const [, apiKey, apiSecret, cloud] = match;

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { cloud: string; folder: string; items: Item[] };
if (cloud !== manifest.cloud) {
  console.error(`CLOUDINARY_URL is for "${cloud}", but site/media.json is for "${manifest.cloud}".`);
  process.exit(1);
}

/** Cloudinary's signature: the sorted parameters, then the secret, hashed with SHA-1. */
function sign(params: Record<string, string>): string {
  const text = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(text + apiSecret).digest('hex');
}

let uploaded = 0;
for (const item of manifest.items) {
  const data = readFileSync(join(root, item.file));
  const hash = createHash('sha1').update(data).digest('hex');
  if (item.hash === hash && item.version) continue;

  const params: Record<string, string> = {
    public_id: `${manifest.folder}/${item.id}`,
    overwrite: 'true',
    invalidate: 'true',
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', apiKey);
  form.append('signature', sign(params));
  form.append('file', new Blob([data]), item.file.split('/').pop());

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${item.kind}/upload`, { method: 'POST', body: form });
  const body = (await res.json()) as { version?: number; width?: number; height?: number; bytes?: number; duration?: number; error?: { message: string } };
  if (!res.ok || !body.version) {
    console.error(`${item.id}: ${body.error?.message ?? res.statusText}`);
    process.exitCode = 1;
    continue;
  }
  Object.assign(item, { hash, version: body.version, width: body.width, height: body.height, bytes: body.bytes });
  if (body.duration) item.duration = Math.round(body.duration * 10) / 10;
  uploaded++;
  console.log(`${item.id}: v${body.version} ${body.width}×${body.height} ${Math.round((body.bytes ?? 0) / 1024)} KB`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(uploaded ? `Uploaded ${uploaded} of ${manifest.items.length}.` : 'Everything is up to date.');
