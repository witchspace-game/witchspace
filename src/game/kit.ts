// The station's kit, grouped for the Station tab (docs/design/flight-hud-and-touch.md, "Kit, grouped"):
// what it's for, so twenty items read as four short lists rather than one long one.

import { EQUIPMENT, type EquipmentId } from './commander';

export type KitGroup = 'combat' | 'trade' | 'exploration' | 'ship';
export const KIT_GROUPS: KitGroup[] = ['combat', 'trade', 'exploration', 'ship'];
export const KIT_NAMES: Record<KitGroup, string> = { combat: 'Combat', trade: 'Trade', exploration: 'Exploration', ship: 'Ship' };

const GROUP: Record<EquipmentId, KitGroup> = {
  'combat-computer': 'combat',
  ecm: 'combat',
  'energy-bomb': 'combat',
  'extra-energy': 'combat',
  'gimbal-mount': 'combat',
  'weapons-licence': 'combat',
  'distress-jammer': 'combat',
  'large-cargo-bay': 'trade',
  'fuel-scoops': 'trade',
  'comms-array': 'trade',
  'survey-scanner': 'exploration',
  'survey-autopilot': 'exploration',
  'route-autopilot': 'exploration',
  'long-range-tanks': 'exploration',
  'galactic-hyperdrive': 'exploration',
  wisp: 'exploration',
  'docking-computer': 'ship',
  'escape-pod': 'ship',
  transponder: 'ship',
};

export const kitGroup = (id: EquipmentId): KitGroup => GROUP[id] ?? 'ship';
export const everyItemGrouped = () => EQUIPMENT.every((e) => e.id in GROUP);
