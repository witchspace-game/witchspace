// Shared space in flight (moved from main.ts): other commanders' ships, tags and lasers, what
// the server says happened, and the button that joins or leaves.

import { sfx } from '../audio/sound';
import { boomAt, grandShot } from '../audio/spatial';
import { shipById } from '../content/ships';
import { isWorking, saveCommander, hullOf } from '../game/commander';
import { type Remote, type SpaceEvent } from '../net/space';
import { sessionToken, signedIn, currentAccount } from '../net/account';
import { toggleAccountPanel } from '../ui/accountPanel';
import { combatRating, rankInsignia } from '../game/rating';
import { type LaserId } from '../game/weapons';
import { Explosion } from '../render/explosion';
import { camera } from '../render/renderer';
import { buildPainted, disposeShip, showUnidentified, UNIDENTIFIED_HEX, type ShipModel } from '../render/shipModel';
import { flash } from '../ui/hud';
import { showHitDirection } from '../ui/indicators';
import { $, cmdr, currentSystem, game } from '../core';
import { beams, explosions, HULL_READ, flight, hearSpace, sharedSpace, player, space } from '../scene';
import { myLook } from '../ui/shipyard';
import { voiceOf } from './sounds';
import { explodeNetMissile, netMissiles, startNetMissile } from './missiles';
import * as THREE from 'three';
import type { NpcShip } from '../game/npc';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  becomeFugitive: (serious?: boolean) => void;
  becomeOffender: (message: string, unknown?: boolean) => void;
  rateKill: (npc: NpcShip | "crime") => string;
  hitFeedback: (strength: number) => void;
  die: () => void;
};
export const initSharedSpace = (hooks: typeof main) => Object.assign(main, hooks);

// --- Shared space (stage 1) ------------------------------------------------
// Opt-in, Modern rules: other commanders in your system, from its server
// (see net/space.ts and server/). The server judges the fighting; nothing is
// saved there yet. Signed-in commanders with a callsign only (Mark: no guests).

const COMMANDER_COLOUR = '#dfe9ff'; // their tags and scanner marks; ships keep their own colours

/** Another commander's tag: rank insignia, callsign and range, e.g. "◆◆ CMDR Moxon · 0.8 km". */
export const callsignTag = (r: Remote, range: string) => (remoteUnidentified(r) ? `Unidentified ship · ${range}` : `${rankInsignia(r.rank)} CMDR ${r.name} · ${range}`.trim());
/** A commander running dark, too far off for a hull read: we can see them, not say who they are. */
const remoteUnidentified = (r: Remote) => r.dark && r.position.distanceTo(player.obj.position) > HULL_READ;
export const commanderColour = (r: Remote) => (sharedSpace.isHostile(r) ? '#ff4d6d' : remoteUnidentified(r) ? UNIDENTIFIED_HEX : COMMANDER_COLOUR);
const BUMP_SEPARATION = 40; // metres each ship moves apart after a collision
const remoteModels = new Map<string, { model: ShipModel; fireCooldown: number; unidentified: boolean }>();
hearSpace(onSpaceEvent);

function sharedSpaceWanted(): boolean {
  try {
    return localStorage.getItem('witchspace.shared') === '1';
  } catch {
    return false;
  }
}

/** Shared space is for commanders with a callsign (Mark): signed in, with one claimed. */
const canShare = () => signedIn() && Boolean(currentAccount()?.callsign);
const SIGN_IN_TO_SHARE = 'Shared space is for commanders with a callsign. Claim yours: it takes a minute.';

export function toggleSharedSpace() {
  const on = !sharedSpaceWanted();
  if (on && !canShare()) toggleAccountPanel(true, SIGN_IN_TO_SHARE);
  try {
    localStorage.setItem('witchspace.shared', on ? '1' : '0');
  } catch {
    // Not saved; it still applies until the page is closed.
  }
  updateSharedButton();
  if (on) sharedSpace.resume();
  // Signed out, the account panel says why it opened; no banner over it.
  if (!on || canShare()) flash(on ? 'Shared space (beta) on: fly with other commanders · Modern rules only' : 'Shared space off: single-player', 2.5);
}

export function updateSharedButton() {
  $('#shared-button').innerHTML = `<span class="key">S · </span>Shared space (beta): ${sharedSpaceWanted() ? 'on' : 'off'}`;
}

function onSpaceEvent(e: SpaceEvent) {
  switch (e.kind) {
    case 'connected':
      flash(e.others ? `Shared space · ${e.others} other commander${e.others === 1 ? '' : 's'} in ${currentSystem().name}` : `Shared space · nobody else in ${currentSystem().name} yet`, 3);
      break;
    case 'joined':
      flash(`${`${rankInsignia(e.remote.rank)} CMDR ${e.remote.name}`.trim()} (${e.remote.rank}) has arrived`, 2.5);
      break;
    case 'left': {
      const m = remoteModels.get(e.remote.id);
      if (m) disposeShip(m.model);
      remoteModels.delete(e.remote.id);
      break;
    }
    case 'full':
      if (game.state === 'flying') flash(e.busy ? `${e.busy} · flying solo for now` : `Shared space in ${currentSystem().name} is full (${e.max} commanders) · flying solo for now`, 3.5);
      break;
    case 'lost':
      if (game.state === 'flying') flash('Shared space: connection lost · reconnecting', 2.5);
      break;
    case 'signin':
      flash(e.need === 'callsign' ? 'Shared space · claim a callsign first (A on the title screen) · flying solo for now' : 'Shared space is for commanders with a callsign · sign in on the title screen (A) · flying solo for now', 4.5);
      break;
    case 'replaced':
      flash('Shared space · you joined from another window or device, so this one has left · launch again to fly here', 4.5);
      break;
    case 'hit':
      // The server's word on our shields and hull.
      if (game.state !== 'flying') break;
      player.shields = e.shields;
      player.hull = e.hull;
      sfx.hit();
      main.hitFeedback(0.35);
      if (e.by) showHitDirection(camera, e.by.position);
      break;
    case 'hitconfirm':
      sfx.hit();
      // Firing on another commander is like firing on any clean ship.
      main.becomeOffender(`Firing on Commander ${e.remote.name} · you are an OFFENDER`);
      break;
    case 'missile':
      startNetMissile(e);
      break;
    case 'missileEnd': {
      const n = netMissiles.get(e.id);
      if (!n) break;
      netMissiles.delete(e.id);
      n.missile.position.copy(e.p);
      explodeNetMissile(n.missile);
      break;
    }
    case 'ecm':
      if (e.p.distanceTo(player.obj.position) < 6000) sfx.ecm();
      if (e.by) flash(`CMDR ${e.by.name} fired an ECM`, 1.2);
      break;
    case 'bump':
      // The server's word on the damage; move apart so we're not still touching.
      if (game.state !== 'flying') break;
      player.shields = e.shields;
      player.hull = e.hull;
      player.obj.position.addScaledVector(e.push, BUMP_SEPARATION);
      player.speed *= 0.5;
      sfx.thud();
      main.hitFeedback(0.9);
      flash(e.with ? `Collision with Commander ${e.with.name}` : 'Collision', 2);
      break;
    case 'destroyed':
      if (e.me) {
        if (game.state === 'flying') {
          flash(e.collision ? 'Destroyed in a collision' : e.by ? `Destroyed by Commander ${e.by.name}` : 'Ship destroyed', 3);
          main.die();
        }
        break;
      }
      if (e.remote) commanderDestroyed(e.remote, e.byMe, e.collision);
      break;
  }
}

/** Another commander's ship breaks up. If we did it, the law and the rating take note. */
function commanderDestroyed(r: Remote, byMe: boolean, collision = false) {
  const m = remoteModels.get(r.id);
  if (m) {
    const boom = new Explosion(m.model.def, m.model.root, new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion).multiplyScalar(100));
    space.scene.add(boom.group);
    explosions.push(boom);
    boomAt(r.position, 2.2, 1600, 1.6);
    m.model.root.visible = false; // gone; the server tells us when they leave
  }
  // A collision is an accident: no kill, and no crime.
  if (!byMe || collision) {
    flash(collision ? `Commander ${r.name} was destroyed in a collision` : `Commander ${r.name} has been destroyed`, 2.5);
    return;
  }
  const c = cmdr();
  flash(`Commander ${r.name} destroyed · ${main.rateKill('crime')}`, 2.5);
  main.becomeFugitive(true); // killing a clean commander is a serious crime: no rating
  saveCommander(c);
}

export function updateSharedSpace(dt: number, input: { fire: boolean } | null) {
  const share = game.state === 'flying' && Boolean(game.commander) && cmdr().difficulty === 'modern' && sharedSpaceWanted() && canShare();
  if (!share) {
    if (sharedSpace.connected) sharedSpace.leave();
    return;
  }
  const here = currentSystem();
  const look = myLook();
  sharedSpace.join(here.galaxy, here.index, cmdr().name, hullOf(cmdr()), Object.values(cmdr().lasers).filter((l): l is LaserId => Boolean(l)), combatRating(cmdr().kills), cmdr().missiles, isWorking(cmdr(), 'ecm'), sessionToken(), look ? { c: look.colour, g: look.glow, ...(look.trim ? { t: look.trim } : {}), ...(look.lights ? { l: 1 as const } : {}) } : undefined);
  const back = sharedSpace.takeCorrection();
  if (back) player.obj.position.copy(back);
  sharedSpace.update(dt, {
    position: player.obj.position,
    quaternion: player.obj.quaternion,
    speed: player.speed,
    firing: Boolean(input?.fire) && !flight.overheated,
    shields: player.shields,
    hull: player.hull,
    dark: flight.transponderOff,
  });
  for (const r of sharedSpace.remotes.values()) {
    let m = remoteModels.get(r.id);
    if (!m) {
      // Other commanders fly their ships in their own paint, or the maker's colours; their callsign tag says who they are.
      const model = buildPainted(shipById(r.ship) ?? shipById('cobra-mk3')!, r.paint ? { colour: r.paint.c, glow: r.paint.g ?? 1, trim: r.paint.t ?? null, lights: r.paint.l === 1 } : null);
      space.scene.add(model.root);
      m = { model, fireCooldown: 0, unidentified: false };
      remoteModels.set(r.id, m);
    }
    // Running dark: a cold white unknown until we're close enough to read the hull.
    const unknown = remoteUnidentified(r);
    if (unknown !== m.unidentified) {
      showUnidentified(m.model, unknown);
      m.unidentified = unknown;
    }
    m.model.root.position.copy(r.position);
    m.model.root.quaternion.copy(r.quaternion);
    // Their lasers, drawn straight ahead; they don't hit anything yet.
    m.fireCooldown -= dt;
    if (r.firing && m.fireCooldown <= 0) {
      m.fireCooldown = 0.25;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion);
      const origin = r.position.clone().addScaledVector(fwd, 20);
      beams.fire(origin, origin.clone().addScaledVector(fwd, 2000), COMMANDER_COLOUR);
      // A commander in a Fer-de-lance is heard by her guns (other commanders' lasers stay silent for now).
      if (voiceOf(shipById(r.ship)) === 'grand') grandShot('pulse', origin);
    }
  }
}
