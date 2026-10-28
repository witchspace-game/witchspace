// The yard tells you when your ship is ready (Mark: "ask anyone ordering a ship
// to turn on notifications"). Read from the cloud save, like the ship's log: an
// order whose finishing time has passed gets one notification, once.

import { productionHours } from '../../src/game/production';
import { editionById, editionNo } from '../../src/content/editions';

export interface SavedOrder {
  ship: string;
  name?: string;
  placed: number;
  gifted?: boolean;
  edition?: { id: string; number: number };
}

/** The notification for a finished order, or null if it isn't finished (or is a gift, ready the moment it's redeemed). */
export function readyMessage(o: SavedOrder | undefined, shipName: (id: string) => string, now: number): { key: string; title: string; body: string } | null {
  if (!o || o.gifted || now - o.placed < productionHours(o) * 3_600_000) return null;
  const e = o.edition ? editionById(o.edition.id) : undefined;
  const what = `${e ? `${e.name} ${editionNo(o.edition!.number)}` : `your ${shipName(o.ship)}`}${o.name ? ` “${o.name}”` : ''}`;
  return { key: `yard:${o.placed}`, title: 'Your ship is ready', body: `${what.charAt(0).toUpperCase()}${what.slice(1)} is finished and waiting for you at the yard where you ordered her.` };
}
