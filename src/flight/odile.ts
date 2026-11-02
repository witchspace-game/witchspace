// Odile Venn in flight, step 2 (docs/design/character-odile-venn.md): what she notices and remembers.
// Her distress call when pirates are on her, and her thanks if you saw them off; a leg flown
// alongside her, jump-in to dock; a shot at her, forgiven once with a warning; and her loss, when her
// escape pod gets clear and Second Wind is away a day. What she remembers is a few counters in your
// save (game/odile.ts); the saloon reads them.

import { saveCommander } from '../game/commander';
import { freshMemory, VENN, type VennMemory } from '../game/odile';
import type { NpcShip } from '../game/npc';
import { cmdr, game, modern } from '../core';
import { npcs, player } from '../scene';
import { legs, voyageOf } from './traffic';
import { radio } from './comms';
import { flash } from '../ui/hud';

const FROM = `${VENN.name} · ${VENN.ship}`;
/** Close enough to count as company, and long enough for it to be a leg flown together. */
const COMPANY_RANGE = 3000;
const NOTICED_AFTER = 20; // seconds alongside before she says so
const LEG_FLOWN = 60; // seconds alongside, before she docks, to count
/** Close enough to have answered her call. */
const ANSWER_RANGE = 8000;

const memory = (): VennMemory => (cmdr().venn ??= freshMemory());
const save = () => saveCommander(cmdr());
const say = (text: string, urgent = false) => radio(urgent ? 'mayday' : 'ship', FROM, text, { colour: VENN.colour, flash: urgent ? 4 : 2.5, urgent });
const isVenn = (npc: NpcShip) => voyageOf.get(npc)?.character === 'venn';
export const vennNpc = () => npcs.find(isVenn) ?? null;

// Per voyage of hers, this visit: what's already been said and counted.
let voyage = '';
let alongside = 0;
let noticed = false;
let flown = false;
let hailed = false;
let warned = false;
let distress = false;

function sameVoyage(npc: NpcShip) {
  const id = voyageOf.get(npc)!.id;
  if (id === voyage) return;
  voyage = id;
  alongside = 0;
  noticed = flown = hailed = warned = distress = false;
}

/** You hailed her and she answered: she knows your voice now. */
export function vennHailed(npc: NpcShip) {
  if (!isVenn(npc)) return;
  sameVoyage(npc);
  if (hailed) return;
  hailed = true;
  memory().hails++;
  save();
}

/** You fired on her. The first is forgiven, with a warning; a second and she's done with you. */
export function vennShot(npc: NpcShip) {
  if (!isVenn(npc) || !modern()) return;
  sameVoyage(npc);
  const m = memory();
  m.shots++;
  if (!warned) {
    warned = true;
    say("Mutual ship. You'll want to look before you shoot.");
  } else if (m.crossedAt === undefined || Date.now() - m.crossedAt > 60_000) {
    m.crossedAt = Date.now();
    say(`That's enough, ${cmdr().name}. I'll remember it.`);
  }
  save();
}

/** Second Wind is lost: her pod gets clear, and she's away a day. By your hand, and you've crossed her. */
export function vennLost(npc: NpcShip, byYou: boolean) {
  if (!isVenn(npc) || !game.commander || !modern()) return;
  const m = memory();
  m.lostAt = Date.now();
  if (byYou) m.crossedAt = Date.now();
  save();
  setTimeout(() => flash(`${VENN.ship}'s escape pod is clear · ${VENN.name} is picked up`, 3.5), 1800);
}

/** A pirate fired: if it was at her, she calls the Mutual. */
export function vennUnderFire(pirate: NpcShip) {
  const her = vennNpc();
  if (!her || pirate.target !== her.ship || !modern()) return;
  sameVoyage(her);
  if (distress) return;
  distress = true;
  const n = npcs.filter((p) => p.role === 'pirate' && p.target === her.ship).length;
  const ships = n > 1 ? `${['', '', 'Two', 'Three', 'Four'][n] ?? n} ${pirate.def.name}s` : `A ${pirate.def.name}`;
  say(`Mutual, Mutual, this is Venn, Second Wind. ${ships} on me. Anyone near.`, true);
}

/** Each frame in flight: her distress resolved, and company on the road. */
export function updateVenn(dt: number) {
  if (!game.commander || !modern() || game.state !== 'flying') return;
  const her = vennNpc();
  if (!her) return;
  sameVoyage(her);
  const near = her.obj.position.distanceTo(player.obj.position);
  // Seen off: no pirate still on her, and you were there.
  if (distress && !npcs.some((p) => p.role === 'pirate' && p.target === her.ship)) {
    distress = false;
    if (near < ANSWER_RANGE) {
      memory().saved++;
      save();
      say(`That's one I owe you, ${cmdr().name}. I don't forget those either.`);
    }
  }
  // Company on the road: alongside her on her way in, until she docks.
  const leg = legs.get(her);
  if (leg !== 'inbound' && leg !== 'docking') return;
  if (near < COMPANY_RANGE) alongside += dt;
  if (!noticed && alongside >= NOTICED_AFTER) {
    noticed = true;
    say(`Keeping me company, ${cmdr().name}? Suit yourself.`);
  }
  if (!flown && leg === 'docking' && alongside >= LEG_FLOWN) {
    flown = true;
    memory().legs++;
    save();
    say('Thanks for the company.');
  }
}
