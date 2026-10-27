// Mirrors schemas/ship.schema.json. Keep the two in sync.

export type Vec3 = [number, number, number];

export type ShipRole =
  | 'trader' | 'fighter' | 'multirole' | 'police' | 'marshal' | 'pirate' | 'miner'
  | 'freighter' | 'alien' | 'station' | 'missile' | 'cargo' | 'debris';

export interface ShipDef {
  id: string;
  name: string;
  manufacturer?: string;
  role: ShipRole;
  /** False for a ship that never docks (a carrier, a yard hauler): it needn't fit the slot (src/content/slot.ts). */
  docks?: boolean;
  description: string;
  credits: {
    authors: string[];
    license: 'CC-BY-SA-4.0';
    aiAssisted?: boolean;
    notes?: string;
  };
  geometry: {
    vertices: Vec3[];
    faces: number[][];
    details?: { vertices: Vec3[]; lines: [number, number][] };
  };
  stats: {
    maxSpeed: number;
    pitchRate?: number;
    rollRate?: number;
    yawRate?: number;
    hull: number;
    shields: number;
    cargo: number;
    missiles?: number;
    price: number;
    /** Combat rating points for destroying one, before role, threat and experience (game/rating.ts). */
    ratingValue: number;
    bounty?: number;
  };
  style: { lineColor: string; glow?: number };
  /** A mark on the hull in its own colour (a captain's sign), glowing like the details. */
  insignia?: { color: string; vertices: Vec3[]; lines: [number, number][] };
  /** Built from modules (content/modules), fore to aft: the geometry is their assembly. */
  modules?: string[];
}

/** Where a module belongs in a line-up, from prow to stern. */
export type ModuleZone = 'intake' | 'industry' | 'logistics' | 'crew' | 'fabrication' | 'add-on' | 'power';

// Mirrors schemas/module.schema.json. Keep the two in sync.
export interface ModuleDef {
  id: string;
  name: string;
  zone: ModuleZone;
  /** Metres from fore end to aft end, necks included. */
  length: number;
  /** Which ends take the coupling. */
  couples: { fore: boolean; aft: boolean };
  /** One sentence, in Wexley-Yorozu's catalogue voice. */
  description: string;
  /** The callsign of the commander who designed it, paid when it's first fitted (game/commissions.ts). */
  designer: string;
  /** When an accepted community module goes into service: from this date (YYYY-MM-DD, UTC) a share of new builds carry it. */
  inService?: { from: string; replaces?: string; share?: number };
  /** Accepted improvements, oldest first: each improver is paid when the first build after its date is fitted. */
  revisions?: { by: string; from: string; note?: string }[];
  credits: { authors: string[]; license: 'CC-BY-SA-4.0'; aiAssisted?: boolean; notes?: string };
  /** The body, between the necks: z runs from +length/2 (fore) to -length/2 (aft), less 35 m at each coupled end. */
  geometry: { vertices: Vec3[]; faces: number[][] };
  insignia?: { color: string; vertices: Vec3[]; lines: [number, number][] };
}
