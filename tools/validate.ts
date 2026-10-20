// Validates content files against their JSON Schema and the game's geometry rules.
//
//   npm run validate                 check everything in content/
//   npm run validate -- path.json    check specific files
//   npm run validate -- --fix        also correct face winding in place

import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { checkGeometry, fixWinding } from '../src/content/geometry';
import type { ShipDef } from '../src/content/types';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const fix = args.includes('--fix');
const paths = args.filter((a) => !a.startsWith('--'));

const shipDir = join(root, 'content/ships');
const files = paths.length
  ? paths.map((p) => resolve(p))
  : readdirSync(shipDir).filter((f) => f.endsWith('.json')).map((f) => join(shipDir, f));

const ajv = new Ajv2020({ allErrors: true });
const validateShip = ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/ship.schema.json'), 'utf8')));

let failed = 0;
const ids = new Map<string, string>();

for (const file of files) {
  const name = basename(file);
  const errors: string[] = [];
  const warnings: string[] = [];
  let ship: ShipDef;

  try {
    ship = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`✗ ${name}\n    error: not valid JSON (${(e as Error).message})`);
    failed++;
    continue;
  }

  if (!validateShip(ship)) {
    for (const err of validateShip.errors ?? []) {
      errors.push(`${err.instancePath || '(root)'} ${err.message}`);
    }
  } else {
    if (ship.id !== basename(file, '.json')) errors.push(`id "${ship.id}" must match the file name "${basename(file, '.json')}"`);
    if (ids.has(ship.id)) errors.push(`id "${ship.id}" is already used by ${ids.get(ship.id)}`);
    ids.set(ship.id, name);

    let report = checkGeometry(ship.geometry.vertices, ship.geometry.faces, ship.geometry.details);
    if (fix && report.errors.some((e) => e.includes('wound'))) {
      ship.geometry.faces = fixWinding(ship.geometry.vertices, ship.geometry.faces);
      writeFileSync(file, JSON.stringify(ship, null, 2) + '\n');
      console.log(`  fixed face winding in ${name}`);
      report = checkGeometry(ship.geometry.vertices, ship.geometry.faces, ship.geometry.details);
    }
    errors.push(...report.errors);
    warnings.push(...report.warnings);
  }

  console.log(`${errors.length ? '✗' : '✓'} ${name}`);
  for (const e of errors) console.log(`    error: ${e}`);
  for (const w of warnings) console.log(`    warning: ${w}`);
  if (errors.length) failed++;
}

console.log(`\n${files.length - failed}/${files.length} files valid`);
process.exit(failed ? 1 : 0);
