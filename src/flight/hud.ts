// What the flight display shows (moved from main.ts): markers on the ships about you, their
// colours and whether you can read who they are, the combat HUD and the mouse-aim reticle.

import { controlScheme, isMouseCaptured, isTouch, wantsMouseCapture } from '../game/input';
import { NpcShip } from '../game/npc';
import { rayHit } from '../game/weapons';
import { COMPANIES } from '../game/companies';
import { camera, isRetro } from '../render/renderer';
import { UNIDENTIFIED_HEX } from '../render/shipModel';
import { flash } from '../ui/hud';
import { updateIndicators, type Marker } from '../ui/indicators';
import { commodityById } from '../economy/commodities';
import { $, cmdr } from '../core';
import { aim, HULL_READ, flight, missiles, sharedSpace, npcs, player, station, SUN_POS, SUN_RADIUS } from '../scene';
import { carrier } from './marshals';
import { sightedNpc } from './missiles';
import { drifters } from './adrift';
import { distresses } from './comms';
import { callsignTag, commanderColour } from './sharedSpace';
import { exploreMarkers } from './explore';
import { gimballed, laserDirection, playerLaser } from './combat';
import * as THREE from 'three';

// --- Situational awareness markers ----------------------------------------------

/** Red if it's after you; otherwise police blue, Marshals gold, trader green, pirate orange. */

/** Can we say who this ship is? Yes, unless it's running dark and too far off to read its hull. */
export const npcIdentified = (npc: NpcShip) => !npc.dark || npc.obj.position.distanceTo(player.obj.position) < HULL_READ;

export function npcColour(npc: NpcShip) {
  // Unknown until the hull is read; but once it has fired on you, whoever it is, it's hostile.
  if (!npcIdentified(npc)) return npc.firedOnPlayer ? '#ff4d6d' : UNIDENTIFIED_HEX;
  if (npc.hostile) return '#ff4d6d';
  return npc.role === 'police' ? '#4aa8ff' : npc.role === 'marshal' ? '#ffd98a' : npc.role === 'pirate' ? '#ff9a3d' : '#9ef0c0';
}

export function updateMarkers() {
  const km = (p: THREE.Vector3) => {
    const d = p.distanceTo(player.obj.position);
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  };
  const calling = new Set(distresses.filter((d) => d.heard).map((d) => d.trader));
  const markers: Marker[] = npcs.map((npc) => ({
    position: npc.obj.position,
    color: npc === flight.locked ? '#ff4d6d' : npcColour(npc),
    radius: npc.radius,
    // A trader's distress call gives its position away, wherever it is.
    label: calling.has(npc) ? `MAYDAY ${km(npc.obj.position)}` : npc.hostile || npc.obj.position.distanceTo(player.obj.position) < 1500 ? km(npc.obj.position) : undefined,
  }));
  markers.push({ position: station.root.position, color: '#ffb347', radius: station.model.radius, label: `Station ${km(station.root.position)}` });
  markers.push({ position: SUN_POS, color: '#ffe08a', radius: SUN_RADIUS, label: `Sun ${km(SUN_POS)}` });
  markers.push(...exploreMarkers(km));
  // Lost company cases beacon to anyone in the system.
  for (const d of drifters) {
    if (!d.special) continue;
    const short = { hexon: 'Hexon', vorg: 'Vorg', mutual: 'Mutual', wy: 'W-Y' }[d.special.company];
    markers.push({ position: d.model.root.position, color: COMPANIES[d.special.company].colour, radius: 6, label: `${short} property · sealed ${km(d.model.root.position)}` });
  }
  for (const r of sharedSpace.remotes.values()) markers.push({ position: r.position, color: commanderColour(r), radius: 30, label: callsignTag(r, km(r.position)) });
  if (carrier?.rift) markers.push({ position: carrier.rift.group.position, color: '#cfe0ff', radius: carrier.rift.radius, label: `Rift ${km(carrier.rift.group.position)}` });
  for (const m of missiles) if (m.target === player) markers.push({ position: m.position, color: '#ff4d6d', radius: 6, label: `MISSILE ${km(m.position)}` });
  const view = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  updateIndicators(camera, view, markers);
}

// --- Combat HUD ------------------------------------------------------------------

const laserGauge = $('#g-laser');
const crosshair = $('.crosshair');
const targetInfo = $('#target-info');
const CARGO_SCAN_RANGE = 2000; // metres: close enough to read another ship's hold

const missilePips = $('#missile-pips');

export function updateCombatHud() {
  const rails = player.def.stats.missiles ?? 0;
  if (missilePips.childElementCount !== rails) missilePips.innerHTML = '<i></i>'.repeat(rails);
  missilePips.querySelectorAll('i').forEach((pip, i) => pip.classList.toggle('armed', i < cmdr().missiles));
  missilePips.classList.toggle('locked', Boolean(flight.locked));
  laserGauge.style.setProperty('--v', String(flight.laserHeat / 100));
  laserGauge.classList.toggle('hot', flight.overheated || flight.laserHeat > 75);
  // Name whatever is closest to where the guns point, if it's near enough.
  const fwd = laserDirection();
  // Whichever sight the lasers follow (ring if gimballed, centre cross if
  // fixed) turns red when a shot would hit.
  const onTarget = Boolean(
    rayHit(player.obj.position, fwd, playerLaser().range, npcs.map((npc) => ({ value: npc, position: npc.obj.position, radius: npc.radius * 0.75 }))),
  );
  reticle.classList.toggle('on-target', onTarget && gimballed());
  crosshair.classList.toggle('on-target', onTarget && !gimballed());
  const best = sightedNpc();
  targetInfo.hidden = !best;
  if (best && !npcIdentified(best)) {
    // No transponder, and too far for a hull read: a ship, and nothing more.
    const km = (best.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1);
    targetInfo.textContent = `Unidentified ship · no transponder · ${km} km${best.firedOnPlayer ? ' · HOSTILE' : ''}${best === flight.locked ? ' · LOCKED' : ''}`;
    targetInfo.classList.toggle('hostile', Boolean(best.firedOnPlayer));
  } else if (best) {
    // The transponder: type, role, condition and standing.
    const km = (best.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1);
    const standing = best.role === 'pirate' ? 'WANTED' : best.guard ? 'SECURITY' : best.role === 'police' ? 'POLICE' : best.role === 'marshal' ? 'MARSHALS' : 'CLEAN';
    const owner = best.company ? COMPANIES[best.company].name.toUpperCase() : best.role.toUpperCase();
    targetInfo.textContent = `${best.def.name} · ${owner} · ${km} km · ${Math.round(best.health * 100)}% · ${best.hostile ? 'HOSTILE' : standing}${best === flight.locked ? ' · LOCKED' : ''}`;
    // Close enough, the scanner reads the hold.
    if (best.obj.position.distanceTo(player.obj.position) < CARGO_SCAN_RANGE && best.role !== 'police' && best.role !== 'marshal') {
      const hold = Object.entries(best.cargo)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${q}${commodityById(id)?.unit === 't' ? ' t' : ' ' + commodityById(id)?.unit} ${commodityById(id)?.name ?? id}`);
      const line = document.createElement('span');
      line.className = 'cargo';
      line.textContent = `Hold: ${hold.join(' · ') || 'empty'}`;
      targetInfo.append(line);
    }
    targetInfo.classList.toggle('hostile', best.hostile);
  }
}

// --- Mouse aim display and controls help -------------------------------------

const reticle = $('#reticle');
const mousePrompt = $('#mouse-prompt');
let wasCaptured = false;

export function updateAimDisplay() {
  const captured = isMouseCaptured();
  if (captured !== wasCaptured && controlScheme() === 'mouse' && !isTouch) {
    flash(captured ? 'Mouse aim · Esc to release' : 'Mouse released · click to fly', 1.5);
  }
  wasCaptured = captured;
  mousePrompt.hidden = !wantsMouseCapture();
  reticle.hidden = !captured || controlScheme() !== 'mouse' || flight.view !== 'front';
  if (reticle.hidden) return;
  // Project the aim direction onto whichever canvas is showing.
  const p = camera.position.clone().addScaledVector(aim.dir, 1000).project(camera);
  const rect = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  const x = rect.left + ((p.x + 1) / 2) * rect.width;
  const y = rect.top + ((1 - p.y) / 2) * rect.height;
  reticle.style.transform = `translate(${x}px, ${y}px)`;
}
