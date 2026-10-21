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
    bounty?: number;
  };
  style: { lineColor: string; glow?: number };
}
