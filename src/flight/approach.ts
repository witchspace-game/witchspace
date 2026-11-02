// The station approach (docs/design/station-approach.md, Mark, 2 November 2026). The rings aren't
// hardware (Mark: "They cannot be physical as they would be damages constantly"): they're the
// station's guidance beam, straight out of its slot, and your ship draws it. So you see them only
// lined up and within range, as a landing beam works; a low-tech station or an anarchy's broadcasts
// none; and a docking computer measures the slot itself, so it draws them anywhere.
//
// One ring at a time is lit, stepping along the corridor: inwards in the owner's colour for come in;
// the mouth ring red for hold, before a ship launches and until she's clear; outwards in red while
// she comes out. Never straight from one to the other.

import * as THREE from 'three';
import { hasEquipment } from '../game/commander';
import { BEAM_RANGE, broadcasts, inBeam, ownerColour } from '../game/approach';
import { APPROACH } from '../render/look';
import { cmdr, currentSystem, game, modern } from '../core';
import { npcs, player, station } from '../scene';
import { launchDueWithin, onSlotAxis } from './traffic';
import { inSlot } from './law';

export type ApproachState = 'clear' | 'hold' | 'launching';

/** Hold this long before a timetabled launch, and after one until she's this far out or this long gone. */
const HOLD_BEFORE = 6_000;
const CLEAR_DISTANCE = 4000;
const CLEAR_AFTER = 15;
/** A ship this close to the mouth, heading out, is launching. */
const LAUNCH_ZONE = 1500;
/** Seconds per ring as the pulse steps along. */
const STEP = 0.25;
const RINGS = 8;

let clock = 0;
let lastLaunch: { npc: (typeof npcs)[number]; at: number } | null = null;
let state: ApproachState = 'clear';

/** What the slot's doing now (for tests and the dev hooks). */
export const approachState = () => state;

/** Each frame in flight (Modern, Neo): work out the slot's state, and draw the rings as your ship would. */
export function updateApproach(dt: number) {
  clock += dt;
  if (game.state !== 'flying' || !game.commander) return;
  const sys = currentSystem();
  const mouth = onSlotAxis(0);
  const out = onSlotAxis(100).sub(mouth).normalize();

  // Launching: a ship by the mouth, heading out. Remember her, to hold until she's clear.
  const launching = npcs.find((n) => n.obj.position.distanceTo(mouth) < LAUNCH_ZONE && inSlot(n.obj.position) && n.ship.forward().dot(out) > 0.8);
  if (launching) lastLaunch = { npc: launching, at: clock };
  const stillClearing = lastLaunch && npcs.includes(lastLaunch.npc) && lastLaunch.npc.obj.position.distanceTo(station.root.position) < CLEAR_DISTANCE && clock - lastLaunch.at < CLEAR_AFTER;
  state = launching ? 'launching' : stillClearing || launchDueWithin(HOLD_BEFORE) ? 'hold' : 'clear';

  // Seen only in the beam, from a station that broadcasts one; a docking computer draws them anywhere in range.
  if (!modern()) return station.showApproach(1, -1, null); // Classic: as it always was
  const computer = hasEquipment(cmdr(), 'docking-computer');
  const near = player.obj.position.distanceTo(mouth) < BEAM_RANGE;
  const seen = computer ? (near ? 1 : 0) : broadcasts(sys) ? inBeam(player.obj.position, mouth, out) : 0;

  const step = Math.floor(clock / STEP) % RINGS;
  const lit = state === 'clear' ? RINGS - 1 - step : state === 'launching' ? step : 0;
  const colour = new THREE.Color(state === 'clear' ? ownerColour(sys) : APPROACH.danger);
  station.showApproach(seen, lit, colour);
}
