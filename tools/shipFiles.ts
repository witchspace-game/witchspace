// The ship and module files, read from content/ for the site's build
// (the pages themselves are made in tools/ships.ts).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ShipDef } from '../src/content/types';
import { EDITIONS } from '../src/content/editions';
import { EQUIPMENT } from '../src/game/commander';
import { depositFor, editionQuote, GLOWS, LUXURIES, PALETTE, standardKit } from '../src/game/shipyard';
import { handling, inYards, notesFor } from '../src/game/manual';
import { MAX_ROLL_ERROR } from '../src/game/station';
import { PLAYER_LASERS } from '../src/game/weapons';
import type { EditionCard, ManualData, ModuleFile, ShipFile } from './ships';

/** Ships worth a page: the fleet, not the props. */
const SKIP = new Set(['missile', 'cargo-canister']);
/** Shown first: the ship every commander starts in. */
const FIRST = 'cobra-mk3';

export function loadShips(root: string): ShipFile[] {
  const dir = join(root, 'content/ships');
  const all = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ShipFile)
    .filter((s) => !SKIP.has(s.id));
  return all.sort((a, b) => (a.id === FIRST ? -1 : b.id === FIRST ? 1 : a.name.localeCompare(b.name)));
}

/** The Titanoboa's modules, from content/modules. */
export function loadModules(root: string): Map<string, ModuleFile> {
  const dir = join(root, 'content/modules');
  return new Map(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const m = JSON.parse(readFileSync(join(dir, f), 'utf8')) as ModuleFile;
    return [m.id, m];
  }));
}

/** A ship's special editions, in words and at the price the shipyard asks. */
export function editionsFor(s: ShipFile): EditionCard[] {
  const named = (colour: string | null) => (colour ? (PALETTE.find((p) => p.colour === colour) ?? null) : null);
  return EDITIONS.filter((e) => e.ship === s.id).map((e) => {
    const colour = named(e.colour);
    const trim = named(e.trim);
    return {
      id: e.id,
      name: e.name,
      blurb: e.blurb,
      limit: e.limit,
      price: editionQuote(s as unknown as ShipDef, e),
      colour: e.colour,
      trimColour: e.trim,
      finish: [colour?.name, trim ? `${trim.name} trim` : ''].filter(Boolean).join(', with '),
      line: colour?.line ?? '',
      glow: GLOWS[e.glow].name,
      fit: [PLAYER_LASERS[e.laser].name, ...(e.rear ? [`${PLAYER_LASERS[e.rear].name} at the rear`] : []), ...e.upgrades.map((id) => EQUIPMENT.find((q) => q.id === id)?.name ?? id)],
      luxuries: e.luxuries.map((id) => LUXURIES.find((l) => l.id === id)?.name ?? id),
      aboard: e.luxuries.map((id) => LUXURIES.find((l) => l.id === id)).filter((l) => l !== undefined).map((l) => [l.name, l.blurb]),
      glowLevel: GLOWS[e.glow].glow,
      finishDays: Math.round(e.finishHours / 24),
      deposit: depositFor(editionQuote(s as unknown as ShipDef, e)),
    };
  });
}

// --- Owner's manuals ------------------------------------------------------------------------

/** Ships the yard sells, so ships that can be owned: the yard's own rule (src/game/manual.ts). */
export const ownable = (s: ShipFile) => inYards(s as unknown as ShipDef);

/** The phone's drawer buttons, read from the game's page as the game reads them (src/main.ts openManual). */
export function drawerButtons(root: string): ManualData['drawer'] {
  const html = readFileSync(join(root, 'play/index.html'), 'utf8');
  const block = html.match(/<div class="touch-actions">([\s\S]*?)<\/div>/)![1];
  const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  return [...block.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, tag, label]) => ({ key: attr(tag, 'data-key'), label: label.trim(), title: attr(tag, 'title') ?? attr(tag, 'aria-label') ?? '' }));
}

/** What a ship's owner's manual says, for the page to show its owner (src/site/manual.ts). */
export function manualFor(s: ShipFile, cobra: ShipFile, drawer: ManualData['drawer']): ManualData {
  const def = s as unknown as ShipDef;
  const rows = handling(def, cobra as unknown as ShipDef);
  return {
    id: s.id,
    name: s.name,
    colour: s.style?.lineColor ?? '#7fd4ff',
    meta: `${s.concept ? 'Concept' : (s.manufacturer ?? 'Witchspace')} · ${s.role ?? ''}`,
    description: s.description ?? '',
    notes: notesFor(def),
    handling: rows.map((h) => [h.label, h.value, s.id === 'cobra-mk3' ? '' : h.versus]),
    span: s.id === 'cobra-mk3' ? '' : rows.find((h) => h.label === 'Span')!.versus,
    roll: Math.round((MAX_ROLL_ERROR * 180) / Math.PI),
    dockingFitted: standardKit(def).includes('docking-computer'),
    kit: Object.fromEntries(EQUIPMENT.map((e) => [e.id, [e.name, e.blurb]])),
    luxuries: Object.fromEntries(LUXURIES.map((l) => [l.id, [l.name, l.blurb]])),
    editions: Object.fromEntries(EDITIONS.map((e) => [e.id, e.name])),
    drawer,
  };
}
