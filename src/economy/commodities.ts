// The classic trade goods. Names are the original's; the prices and balance
// are Witchspace's own.

export type Unit = 't' | 'kg' | 'g';
export type Legality = 'legal' | 'illegal';

export interface Commodity {
  id: string;
  name: string;
  unit: Unit;
  /** Credits per unit at an average world. */
  basePrice: number;
  /**
   * How the price shifts per step from industrial (economy 0) towards
   * agricultural (7), as a fraction of the base price. Negative: produced on
   * farm worlds, so cheaper there (food). Positive: made on industrial worlds,
   * so dearer out on the farms (computers).
   */
  economyBias: number;
  /** Typical stock at an average world, in units. */
  baseSupply: number;
  /** How much prices vary between worlds and visits (0..1). */
  volatility: number;
  legality: Legality;
  /** A Witchspace addition, traded under Modern rules only; Classic keeps the original list. */
  modernOnly?: boolean;
}

export const COMMODITIES: Commodity[] = [
  { id: 'food', name: 'Food', unit: 't', basePrice: 5.2, economyBias: -0.07, baseSupply: 22, volatility: 0.08, legality: 'legal' },
  { id: 'textiles', name: 'Textiles', unit: 't', basePrice: 6.8, economyBias: -0.05, baseSupply: 18, volatility: 0.08, legality: 'legal' },
  { id: 'radioactives', name: 'Radioactives', unit: 't', basePrice: 22, economyBias: 0.06, baseSupply: 12, volatility: 0.1, legality: 'legal' },
  { id: 'slaves', name: 'Slaves', unit: 't', basePrice: 9.5, economyBias: -0.05, baseSupply: 6, volatility: 0.25, legality: 'illegal' },
  { id: 'liquor', name: 'Liquor/Wines', unit: 't', basePrice: 26, economyBias: -0.05, baseSupply: 14, volatility: 0.12, legality: 'legal' },
  { id: 'luxuries', name: 'Luxuries', unit: 't', basePrice: 92, economyBias: 0.07, baseSupply: 8, volatility: 0.12, legality: 'legal' },
  { id: 'narcotics', name: 'Narcotics', unit: 't', basePrice: 120, economyBias: 0.02, baseSupply: 4, volatility: 0.4, legality: 'illegal' },
  { id: 'computers', name: 'Computers', unit: 't', basePrice: 82, economyBias: 0.09, baseSupply: 10, volatility: 0.1, legality: 'legal' },
  { id: 'machinery', name: 'Machinery', unit: 't', basePrice: 56, economyBias: 0.07, baseSupply: 10, volatility: 0.1, legality: 'legal' },
  { id: 'alloys', name: 'Alloys', unit: 't', basePrice: 36, economyBias: 0.05, baseSupply: 12, volatility: 0.08, legality: 'legal' },
  { id: 'firearms', name: 'Firearms', unit: 't', basePrice: 72, economyBias: 0.06, baseSupply: 6, volatility: 0.15, legality: 'illegal' },
  { id: 'furs', name: 'Furs', unit: 't', basePrice: 52, economyBias: -0.05, baseSupply: 10, volatility: 0.15, legality: 'legal' },
  { id: 'minerals', name: 'Minerals', unit: 't', basePrice: 11, economyBias: -0.03, baseSupply: 18, volatility: 0.06, legality: 'legal' },
  { id: 'gold', name: 'Gold', unit: 'kg', basePrice: 38, economyBias: -0.01, baseSupply: 160, volatility: 0.1, legality: 'legal' },
  { id: 'platinum', name: 'Platinum', unit: 'kg', basePrice: 66, economyBias: -0.01, baseSupply: 110, volatility: 0.1, legality: 'legal' },
  { id: 'gems', name: 'Gem-stones', unit: 'g', basePrice: 17, economyBias: -0.01, baseSupply: 400, volatility: 0.15, legality: 'legal' },
  { id: 'alien', name: 'Alien Items', unit: 't', basePrice: 60, economyBias: 0, baseSupply: 0, volatility: 0.2, legality: 'legal' },
  // Witchspace's additions, after the originals so their prices don't change.
  { id: 'water', name: 'Water', unit: 't', basePrice: 2.4, economyBias: -0.05, baseSupply: 30, volatility: 0.06, legality: 'legal', modernOnly: true },
  { id: 'hydrogen', name: 'Hydrogen Fuel Cells', unit: 't', basePrice: 14, economyBias: 0.04, baseSupply: 16, volatility: 0.12, legality: 'legal', modernOnly: true },
  { id: 'electronics', name: 'Electronics', unit: 't', basePrice: 42, economyBias: 0.08, baseSupply: 10, volatility: 0.1, legality: 'legal', modernOnly: true },
  { id: 'medicine', name: 'Medicine', unit: 't', basePrice: 48, economyBias: 0.06, baseSupply: 8, volatility: 0.2, legality: 'legal', modernOnly: true },
];

export const commodityById = (id: string) => COMMODITIES.find((c) => c.id === id);

/** How many units weigh one tonne in the hold. */
export const UNITS_PER_TONNE: Record<Unit, number> = { t: 1, kg: 1000, g: 1_000_000 };

/** Tonnes taken up in the hold by a cargo manifest. */
export function cargoTonnage(cargo: Record<string, number>): number {
  let tonnes = 0;
  for (const [id, qty] of Object.entries(cargo)) {
    const c = commodityById(id);
    if (c && qty > 0) tonnes += qty / UNITS_PER_TONNE[c.unit];
  }
  return tonnes;
}
