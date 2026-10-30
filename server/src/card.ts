// The commander's card (docs/design/callsign-card.md, Website's page /callsign/): a picture of your
// ship and callsign to share, kept by the server so it has one link of its own. The rules are Mark's:
// only ships you own, the edition cards for their owners only, and Legend earned at Elite. The
// finish follows: titanium for founding members, alloy after launch, black at Elite. The server
// decides the finish and whether Legend is allowed; the page only chooses within that.

import { combatRating } from '../../src/game/rating';
import { editionById } from '../../src/content/editions';

/** Founding members: a callsign first claimed before Show HN, 3 November 2026, 14:00 UK (GMT). */
export const FOUNDING_BEFORE = Date.UTC(2026, 10, 3, 14, 0, 0);
export const CARD_W = 1200;
export const CARD_H = 630;
export const MAX_CARD_BYTES = 200_000;
export const CAREERS = ['trade', 'fight', 'explore', 'build'] as const;
export type Career = (typeof CAREERS)[number];
export type Finish = 'titanium' | 'alloy' | 'black';
/** The page's scenes (Website); Legend only at Elite. */
export const SCENES = ['coriolis', 'coriolis-below', 'crossfire', 'pack-closing', 'mamba-close', 'debris', 'low-over-diso', 'beacon', 'rift', 'station-rising', 'yard', 'legend'];

export interface CardChoices {
  career: Career;
  scene: string;
  ship: string;
  /** An edition's card (Witch-fire, Dark): only for the account that holds that number. */
  edition?: { id: string; number: number };
  angle: { x: number; y: number };
}

/** Just what the card needs from a cloud save: the ship flown, the fleet, the kills. */
export interface SaveFacts {
  ship?: string;
  fleet?: { ship?: string }[];
  kills?: number;
}

export const isFounding = (memberSince: number | null) => memberSince !== null && memberSince < FOUNDING_BEFORE;
export const isElite = (save: SaveFacts | null) => combatRating(save?.kills ?? 0) === 'Elite';
export const finishFor = (memberSince: number | null, save: SaveFacts | null): Finish => (isElite(save) ? 'black' : isFounding(memberSince) ? 'titanium' : 'alloy');

/** The hulls a save says you own: the one you fly and those in your fleet. No save yet: the starter Cobra. */
export function ownedShips(save: SaveFacts | null): Set<string> {
  const out = new Set<string>([save?.ship ?? 'cobra-mk3']);
  for (const f of save?.fleet ?? []) if (typeof f?.ship === 'string') out.add(f.ship);
  return out;
}

/**
 * Check a card's choices against what the account owns. `editions` are the numbered editions the
 * server's own records say the account holds. Returns the cleaned choices, or why not.
 */
export function checkCard(body: unknown, save: SaveFacts | null, editions: { id: string; number: number }[]): { choices: CardChoices } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!CAREERS.includes(b.career as Career)) return { error: `career must be one of: ${CAREERS.join(', ')}` };
  const scene = typeof b.scene === 'string' ? b.scene : '';
  if (!SCENES.includes(scene)) return { error: 'That scene isn’t one we know' };
  if (scene === 'legend' && !isElite(save)) return { error: 'The Legend card is earned at Elite' };
  const ship = typeof b.ship === 'string' ? b.ship : '';
  const ed = b.edition as { id?: unknown; number?: unknown } | null | undefined;
  const edition = ed && typeof ed.id === 'string' && Number.isInteger(ed.number) ? { id: ed.id, number: ed.number as number } : undefined;
  if (ed && !edition) return { error: 'That edition doesn’t look right' };
  if (edition) {
    const e = editionById(edition.id);
    if (!e || e.ship !== ship) return { error: 'No such edition of that ship' };
    if (!editions.some((x) => x.id === edition.id && x.number === edition.number)) return { error: 'That edition’s card is for its owner' };
  } else if (!ownedShips(save).has(ship)) return { error: 'Only ships you own can go on your card' };
  const a = (b.angle ?? {}) as Record<string, unknown>;
  const x = Number(a.x);
  const y = Number(a.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 10 || Math.abs(y) > 10) return { error: 'That angle doesn’t look right' };
  return { choices: { career: b.career as Career, scene, ship, ...(edition ? { edition } : {}), angle: { x, y } } };
}

/** A card's link: ten random letters and digits, never the callsign. */
export function cardId(): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return [...crypto.getRandomValues(new Uint8Array(10))].map((b) => abc[b % 36]).join('');
}
