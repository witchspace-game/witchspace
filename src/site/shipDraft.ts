import type { ShipDef, ShipRole, Vec3 } from '../content/types';
import { partsOf, shipGeometry, type Part } from './hull';

// The ship editor's draft: the parts you're drawing and the rest of the ship
// file, saved as you go, and made into a ship file to check and hand in. No
// DOM here, so it can be tested.

export interface Draft {
  parts: Part[];
  id: string;
  name: string;
  manufacturer: string;
  role: ShipRole;
  description: string;
  stats: ShipDef['stats'];
  style: ShipDef['style'];
  /** Panel lines from the ship you started from; they don't follow your points. */
  details?: ShipDef['geometry']['details'];
  /** The fleet ship this improves (it keeps that ship's id), if it does. */
  improves?: string;
  /** False for a ship that never docks (a carrier, a yard hauler), so it needn't fit the slot. */
  docks?: false;
}

/** The roles a player's ship can have (stations, missiles and the like are scenery). */
export const ROLES: ShipRole[] = ['trader', 'fighter', 'multirole', 'police', 'pirate', 'miner', 'freighter'];

/** Every maker in the canon (docs/design/ships-and-classes.md), for the maker field's suggestions. */
export const MAKERS = ['Cowell & MgRath', 'Faulcon deLacy', 'Zorgon Petterson', 'Solo & Sons', 'Halloran Sisters', 'Wexley-Yorozu', 'Co-operative Naval Yards'];

/** "Ice Hauler" → "ice-hauler". */
export const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-|-$/g, '');

/** A plain wedge to start from: four points, seven once mirrored, and a Cobra's stats. */
export function blank(): Draft {
  const points: Vec3[] = [
    [0, 0, 20],
    [16, 0, -12],
    [6, 5, -12],
    [6, -4, -12],
  ];
  return {
    parts: [{ name: 'Hull', mirror: 'centre', points }],
    id: '',
    name: '',
    manufacturer: '',
    role: 'trader',
    description: '',
    stats: { maxSpeed: 300, pitchRate: 1, rollRate: 2, hull: 100, shields: 60, cargo: 20, missiles: 3, price: 60000, ratingValue: 0.5 },
    style: { lineColor: '#4dffd2', glow: 1 },
  };
}

/**
 * A fleet ship to start from: "new" makes it yours (a new name, no
 * description), "improve" keeps its id, so it's handed in as a revision.
 */
export function fromShip(ship: ShipDef, as: 'new' | 'improve'): Draft {
  return {
    parts: partsOf(ship.geometry),
    // A new one takes its id from its name, as you rename it.
    id: as === 'improve' ? ship.id : '',
    name: as === 'improve' ? ship.name : `My ${ship.name}`,
    manufacturer: ship.manufacturer ?? '',
    role: ship.role,
    description: as === 'improve' ? ship.description : '',
    stats: structuredClone(ship.stats),
    style: { ...ship.style },
    details: ship.geometry.details ? structuredClone(ship.geometry.details) : undefined,
    improves: as === 'improve' ? ship.id : undefined,
    // A new ship has to fit the slot, or say it never docks, on purpose.
    docks: as === 'improve' && ship.docks === false ? false : undefined,
  };
}

/** The ship file to check and hand in. The server puts your callsign in its credits. */
export function shipFile(d: Draft): Record<string, unknown> {
  const geometry: ShipDef['geometry'] = shipGeometry(d.parts);
  if (d.details?.lines.length) geometry.details = d.details;
  return {
    id: d.id || slug(d.name),
    name: d.name,
    ...(d.manufacturer ? { manufacturer: d.manufacturer } : {}),
    role: d.role,
    ...(d.docks === false ? { docks: false } : {}),
    description: d.description,
    credits: { authors: [], license: 'CC-BY-SA-4.0' },
    geometry,
    stats: d.stats,
    style: d.style,
  };
}

/** A draft saved earlier, if it still makes sense. */
export function readDraft(raw: string | null): Draft | null {
  try {
    const d = JSON.parse(raw ?? '') as Draft;
    const ok = Array.isArray(d?.parts) && d.parts.every((p) => Array.isArray(p.points) && ['centre', 'pair', 'none'].includes(p.mirror)) && typeof d.stats === 'object' && typeof d.style?.lineColor === 'string';
    return ok ? d : null;
  } catch {
    return null;
  }
}

/** The biggest distance from the middle, in metres, for the blueprints' scale. */
export function extent(parts: Part[]): number {
  let m = 0;
  for (const p of parts) for (const v of p.points) m = Math.max(m, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  return m;
}
