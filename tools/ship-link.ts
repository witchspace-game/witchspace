// A preview link for a ship file, to see it on a phone before it's merged:
//   npx tsx tools/ship-link.ts content/ships/fer-de-lance.json
// The whole file travels in the link's hash, so it needs no deploy and never
// reaches a server (src/site/shipLink.ts). Add --editor for the ship editor.

import { readFileSync } from 'node:fs';
import { shipFromHash, shipHash } from '../src/site/shipLink';

const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: npx tsx tools/ship-link.ts <ship file> [--editor]');
  process.exit(1);
}
const ship = JSON.parse(readFileSync(file, 'utf8'));
const hash = await shipHash(ship);
if (!(await shipFromHash(hash))) {
  console.error(`${file} doesn't look like a ship file (a name, geometry, stats and style).`);
  process.exit(1);
}
const page = process.argv.includes('--editor') ? 'ship-editor' : 'ship-preview';
console.log(`https://witchspace.org.uk/${page}/#${hash}`);
