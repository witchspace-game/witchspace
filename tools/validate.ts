// Validates content files against their JSON Schema and the game's geometry rules:
// ships in content/ships, and the Titanoboa's modules in content/modules.
//
//   npm run validate                 check everything in content/
//   npm run validate -- path.json    check specific files
//   npm run validate -- --fix        also correct face winding in place

import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { checkGeometry, fixWinding } from '../src/content/geometry';
import { assemble, checkModule } from '../src/content/modules';
import type { ModuleDef, ShipDef } from '../src/content/types';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const fix = args.includes('--fix');
const paths = args.filter((a) => !a.startsWith('--'));

const shipDir = join(root, 'content/ships');
const moduleDir = join(root, 'content/modules');
const inDir = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f));
const files = paths.length ? paths.map((p) => resolve(p)) : [...inDir(moduleDir), ...inDir(shipDir)];
const isModule = (file: string) => file.startsWith(moduleDir);

const ajv = new Ajv2020({ allErrors: true });
const validateShip = ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/ship.schema.json'), 'utf8')));
const validateModule = ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/module.schema.json'), 'utf8')));
const allModules = new Map<string, ModuleDef>(inDir(moduleDir).map((f) => [basename(f, '.json'), JSON.parse(readFileSync(f, 'utf8'))]));

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

  if (isModule(file)) {
    const m = ship as unknown as ModuleDef;
    if (!validateModule(m)) {
      for (const err of validateModule.errors ?? []) errors.push(`${err.instancePath || '(root)'} ${err.message}`);
    } else {
      if (m.id !== basename(file, '.json')) errors.push(`id "${m.id}" must match the file name "${basename(file, '.json')}"`);
      const report = checkModule(m);
      errors.push(...report.errors);
      warnings.push(...report.warnings);
    }
    report(`modules/${name}`, errors, warnings);
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
    // The insignia's lines must point at its own vertices.
    ship.insignia?.lines.forEach(([a, b], li) => {
      if (a >= ship.insignia!.vertices.length || b >= ship.insignia!.vertices.length) report.errors.push(`insignia line ${li}: vertex index out of range`);
    });
    if (fix && report.errors.some((e) => e.includes('wound'))) {
      ship.geometry.faces = fixWinding(ship.geometry.vertices, ship.geometry.faces);
      writeFileSync(file, JSON.stringify(ship, null, 2) + '\n');
      console.log(`  fixed face winding in ${name}`);
      report = checkGeometry(ship.geometry.vertices, ship.geometry.faces, ship.geometry.details);
    }
    errors.push(...report.errors);
    warnings.push(...report.warnings);
    // A modular hull is generated from its modules: it must match them exactly.
    if (ship.modules) {
      const missing = ship.modules.filter((id) => !allModules.has(id));
      if (missing.length) errors.push(`no such module: ${missing.join(', ')}`);
      else {
        try {
          const line = assemble(ship.modules.map((id) => allModules.get(id)!));
          if (JSON.stringify(line.geometry) !== JSON.stringify({ vertices: ship.geometry.vertices, faces: ship.geometry.faces })) errors.push('the geometry no longer matches its modules: run `npx tsx tools/titanoboa.ts`');
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
    }
  }

  report(name, errors, warnings);
}

function report(name: string, errors: string[], warnings: string[]) {
  console.log(`${errors.length ? '✗' : '✓'} ${name}`);
  for (const e of errors) console.log(`    error: ${e}`);
  for (const w of warnings) console.log(`    warning: ${w}`);
  if (errors.length) failed++;
}

console.log(`\n${files.length - failed}/${files.length} files valid`);
process.exit(failed ? 1 : 0);
