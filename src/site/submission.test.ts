import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromModule, kindOf, limitsLine, pinProblems, previewOf, readFile } from './submission';

const root = join(import.meta.dirname, '../..');
const hold = JSON.parse(readFileSync(join(root, 'content/modules/hold.json'), 'utf8')) as Record<string, unknown>;
const cobra = JSON.parse(readFileSync(join(root, 'content/ships/cobra-mk3.json'), 'utf8')) as Record<string, unknown>;

describe('reading a pasted file', () => {
  it('says where broken JSON breaks, in plain words', () => {
    const r = readFile('{\n  "id": "x",\n  "name": "X"\n  "zone": "crew"\n}');
    expect('error' in r && r.error).toMatch(/line 4/);
  });

  it('wants one object', () => {
    expect('error' in readFile('[1, 2]')).toBe(true);
    expect('error' in readFile('   ')).toBe(true);
    expect(readFile(JSON.stringify(hold))).toEqual({ file: hold });
  });

  it('tells a module from a ship', () => {
    expect(kindOf(hold)).toBe('module');
    expect(kindOf(cobra)).toBe('ship');
    expect(kindOf({ id: 'x' })).toBeNull();
  });
});

describe('the preview', () => {
  it('draws the game’s own files', () => {
    expect(previewOf('module', hold)?.geometry.vertices.length).toBe((hold.geometry as { vertices: unknown[] }).vertices.length);
    expect(previewOf('ship', cobra)?.style.lineColor).toBe((cobra.style as { lineColor: string }).lineColor);
  });

  it('waits for geometry that makes sense', () => {
    expect(previewOf('module', { geometry: { vertices: [[0, 0, 0]], faces: [[0, 1, 2]] } })).toBeNull();
    expect(previewOf('module', { geometry: { vertices: [[0, 0, 'a']], faces: [] } })).toBeNull();
    expect(previewOf('module', {})).toBeNull();
  });
});

describe('the server’s problems', () => {
  it('go under the field they name, and the rest in a list', () => {
    const { byField, rest } = pinProblems(['id: a short kebab-case id', 'name: must NOT have more than 40 characters', 'geometry.vertices[3]: must be array', 'file: something odd']);
    expect(byField).toEqual({ id: ['a short kebab-case id'], name: ['at most 40 characters'] });
    expect(rest).toEqual(['geometry.vertices[3]: must be array', 'file: something odd']);
    expect(pinProblems(["file: must have required property 'name'"]).rest).toEqual(['file: needs "name"']);
  });
});

describe('the limits', () => {
  it('say what’s left, or why not', () => {
    expect(limitsLine({ today: 2, perDay: 5, waiting: 1, maxWaiting: 10 })).toMatch(/^3 of 5 left today/);
    expect(limitsLine({ today: 5, perDay: 5, waiting: 1, maxWaiting: 10 })).toMatch(/tomorrow/);
    expect(limitsLine({ today: 1, perDay: 5, waiting: 10, maxWaiting: 10 })).toMatch(/withdrawing/);
  });
});

describe('starting from a core module', () => {
  it('keeps the id to improve it, or makes it yours', () => {
    expect(fromModule(hold, 'improve').id).toBe('hold');
    const mine = fromModule(hold, 'new');
    expect(mine.id).toBe('my-hold');
    expect(mine.designer).toBeUndefined();
    expect(mine.credits).toEqual({ authors: [], license: 'CC-BY-SA-4.0' });
    expect(mine.geometry).toEqual(hold.geometry);
    expect(hold.id).toBe('hold'); // the original isn't touched
  });
});
