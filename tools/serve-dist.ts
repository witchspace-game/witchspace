// Serve the production build with the same headers as vercel.json, to test
// security headers locally: npx tsx tools/serve-dist.ts [port]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'dist');
const config = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'vercel.json'), 'utf8'));
const headers: { key: string; value: string }[] = config.headers[0].headers;
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.png': 'image/png',
};
const port = Number(process.argv[2] ?? 4173);

createServer((req, res) => {
  let path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  for (const h of headers) res.setHeader(h.key, h.value);
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(port, () => console.log(`Serving dist with vercel.json headers on http://localhost:${port}`));
