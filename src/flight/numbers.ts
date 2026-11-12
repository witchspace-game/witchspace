// Transponder numbers on the ships around you (game/transponder.ts). A timetabled ship's comes from her
// voyage and a renowned pirate's from his home, so everyone sees the same number on the same ship; a
// ship that's only in your game gets one from this visit. Running dark hides it (flight/hud.ts).

import type { NpcShip } from '../game/npc';
import { npcNumber } from '../game/transponder';
import { systemAt } from '../galaxy/generate';
import { currentSystem } from '../core';
import { renownedNpc } from './renowned';
import { voyageOf } from './traffic';

/** Written by hand, like the famous pirates (Mark): the same for everyone, always. */
const BY_HAND: Record<string, string> = { falcon: 'FA-0001' };

const numbers = new WeakMap<NpcShip, string>();
let serial = 0;
const visit = Date.now().toString(36);

export function numberOf(npc: NpcShip): string {
  const known = numbers.get(npc);
  if (known) return known;
  const here = currentSystem();
  const renowned = renownedNpc.get(npc);
  const voyage = voyageOf.get(npc);
  let n: string;
  if (BY_HAND[npc.def.id]) n = BY_HAND[npc.def.id];
  else if (renowned) {
    const [g, s] = renowned.key.split(':').map(Number);
    n = npcNumber(systemAt(g, s).name, `renowned:${renowned.key}`);
  } else if (voyage) n = npcNumber(here.name, `voyage:${voyage.id}`);
  else n = npcNumber(here.name, `${here.galaxy}:${here.index}:${npc.def.id}:${npc.role}:${visit}:${serial++}`);
  numbers.set(npc, n);
  return n;
}
