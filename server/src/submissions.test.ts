import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModuleDef, ShipDef } from '../../src/content/types';
import { validateShip, type McpData } from '../../src/mcp/tools';
import { compileSchemaCheck } from '../../tools/mcp-data';
import { moduleCheck, parseFile, prepare, pullRequestText, repoFile, tidy, type Checks } from './submissions';

// The same checks the Worker runs (checks.ts), built from the real schemas and files.
const root = resolve(import.meta.dirname, '../..');
const load = <T>(dir: string) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(root, dir, f), 'utf8')) as T);
const ships = load<ShipDef>('content/ships');
const modules = new Map(load<ModuleDef>('content/modules').map((m) => [m.id, m]));
const shipSchema = compileSchemaCheck(readFileSync(join(root, 'schemas/ship.schema.json'), 'utf8'));
const moduleSchema = compileSchemaCheck(readFileSync(join(root, 'schemas/module.schema.json'), 'utf8'));
const data = { ships, checkSchema: shipSchema } as unknown as McpData;
const checks: Checks = {
  ship: (s) => validateShip(s, data),
  module: moduleCheck(moduleSchema, modules),
  ships: new Map(ships.map((s) => [s.id, s])),
  modules,
};

const copy = <T>(v: T): Record<string, unknown> => JSON.parse(JSON.stringify(v));
const cobra = ships.find((s) => s.id === 'cobra-mk3')!;
const hold = modules.get('hold')!;

describe('a new module', () => {
  const sent = { ...copy(hold), id: 'ice-hold', name: 'Ice hold', designer: 'Witchspace', inService: { from: '2026-11-01', replaces: 'hold' }, credits: { authors: ['A friend'], license: 'CC-BY-SA-4.0' } };

  it('is credited to the callsign, whatever the file says, and put into service by a maintainer, not the file', () => {
    const { prepared, problems } = prepare('module', copy(sent), 'NOVA', true, checks);
    expect(problems).toBeUndefined();
    const m = prepared!.file as ModuleDef;
    expect(m.designer).toBe('NOVA');
    expect(m.inService).toBeUndefined();
    expect(m.credits).toEqual({ authors: ['NOVA', 'A friend'], license: 'CC-BY-SA-4.0', aiAssisted: true });
    expect(prepared).toMatchObject({ itemId: 'ice-hold', title: 'Ice hold', revises: false });
  });

  it('fails the coupling standard like any module, and says why', () => {
    const narrow = { ...copy(sent), geometry: { ...hold.geometry, vertices: hold.geometry.vertices.map(([x, y, z]) => [x * 0.5, y * 0.5, z]) } };
    const { prepared, problems } = prepare('module', narrow, 'NOVA', false, checks);
    expect(prepared).toBeUndefined();
    expect(problems!.join()).toMatch(/necks|coupling/);
    expect(problems!.every((p) => p.startsWith('geometry: '))).toBe(true);
  });

  it('must be the kind it says it is, with a proper id', () => {
    expect(prepare('ship', copy(sent), 'NOVA', true, checks).problems![0]).toMatch(/looks like a module/);
    expect(prepare('module', { ...copy(sent), id: '../../evil' }, 'NOVA', true, checks).problems![0]).toMatch(/kebab-case/);
  });
});

describe('an improvement to something in the game', () => {
  it('a module keeps its designer and service; the maintainer adds the revision', () => {
    const better = { ...copy(hold), designer: 'NOVA', description: `${hold.description} Cleaner docks.` };
    const { prepared } = prepare('module', better, 'WREN', true, checks);
    expect(prepared!.revises).toBe(true);
    expect((prepared!.file as ModuleDef).designer).toBe(hold.designer);
    expect((prepared!.file as ModuleDef).credits.authors[0]).toBe('WREN');
  });

  it('a ship with an id in the fleet is a revision, without the "id taken" warning', () => {
    const { prepared } = prepare('ship', copy(cobra), 'WREN', false, checks);
    expect(prepared!.revises).toBe(true);
    expect(prepared!.warnings.some((w) => w.startsWith('id:'))).toBe(false);
    expect((prepared!.file as ShipDef).credits).toMatchObject({ authors: ['WREN', 'Witchspace contributors'], aiAssisted: false });
  });
});

describe('a new ship', () => {
  it('passes the same checks as validate_ship', () => {
    const ship = { ...copy(cobra), id: 'cobra-mk3-courier', name: 'Cobra Courier' };
    expect(prepare('ship', ship, 'NOVA', true, checks).prepared).toMatchObject({ itemId: 'cobra-mk3-courier', revises: false });
    const broken = { ...copy(ship), geometry: { vertices: [[0, 0, 0]], faces: [] } };
    expect(prepare('ship', broken, 'NOVA', true, checks).problems!.length).toBeGreaterThan(0);
  });
});

describe('the file as sent', () => {
  it('takes an object or its text, and nothing too big', () => {
    expect(parseFile('{"id":"x"}').file).toEqual({ id: 'x' });
    expect(parseFile({ id: 'x' }).file).toEqual({ id: 'x' });
    expect(parseFile('{nope').error).toMatch(/valid JSON/);
    expect(parseFile([1]).error).toMatch(/object/);
    expect(parseFile({ big: 'x'.repeat(70_000) }).error).toMatch(/KB/);
  });
});

describe('the pull request', () => {
  const s = { id: 'abc123def4', kind: 'module' as const, itemId: 'ice-hold', title: 'Ice hold', revises: false, callsign: 'NOVA', ai: true, via: 'connector' as const, note: 'Keeps the ice cold.\nAnd the crew warm.', review: null, version: 2 };

  it('puts the file where it belongs, as the content files are written', () => {
    const f = repoFile('module', 'ice-hold', { id: 'ice-hold' });
    expect(f.path).toBe('content/modules/ice-hold.json');
    expect(JSON.parse(f.text)).toEqual({ $schema: '../../schemas/module.schema.json', id: 'ice-hold' });
    expect(f.text.endsWith('}\n')).toBe(true);
  });

  it('credits the callsign, says it was AI-assisted, and tells the maintainer what to add', () => {
    const pr = pullRequestText(s);
    expect(pr.branch).toBe('submission/abc123def4');
    expect(pr.title).toBe('Ice hold: a new module by CMDR NOVA');
    expect(pr.body).toContain('**AI-assisted:** yes');
    expect(pr.body).toContain('> And the crew warm.');
    expect(pr.body).toContain('inService');
    expect(pr.commit).toMatch(/Submitted-by: CMDR NOVA/);
    expect(pullRequestText({ ...s, revises: true }).body).toContain('"by": "NOVA"');
  });
});

describe('every problem says where', () => {
  const WHERE = /^[A-Za-z][\w.[\]-]*: /;

  it('turns schema paths into the file\'s own field paths', () => {
    expect(tidy('schema: /length must be >= 100')).toBe('length: must be >= 100');
    expect(tidy('schema: /geometry/vertices/3 must have 3 items')).toBe('geometry.vertices[3]: must have 3 items');
    expect(tidy("schema: (the ship) must have required property 'role'")).toBe("file: must have required property 'role'");
    expect(tidy('geometry: hull is not closed')).toBe('geometry: hull is not closed');
    expect(tidy('a sentence with no place')).toBe('file: a sentence with no place');
  });

  it('for real failures and warnings, of both kinds', () => {
    const badShip = { ...copy(cobra), id: 'x-wing-ish', role: 'spaceship', geometry: { vertices: [[0, 0, 0]], faces: [] }, manufacturer: undefined, description: 'Short.' };
    const badModule = { ...copy(hold), id: 'tiny', length: 40, zone: 'nowhere' };
    const lines = [
      ...prepare('ship', badShip, 'NOVA', true, checks).problems!,
      ...prepare('module', badModule, 'NOVA', true, checks).problems!,
      ...prepare('ship', { ...copy(cobra), id: 'cobra-new', description: 'Short.' }, 'NOVA', false, checks).prepared!.warnings,
    ];
    expect(lines.length).toBeGreaterThan(3);
    for (const l of lines) expect(l).toMatch(WHERE);
    expect(lines).toContain('length: must be >= 100');
  });
});
