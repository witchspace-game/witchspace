// A renowned pirate in flight (src/game/renowned.ts has who he is and what he remembers): the word
// on the radio, the heads-up that he's coming, his arrival, the fight, and how it ends. Beaten, he
// ejects in a pod; shoot the pod and he never forgets. Win, and his tally grows. Run (jump or dock
// once he's coming), and so does his legend.

import { sharedRecord, tellRenowned } from '../net/renowned';
import * as THREE from 'three';
import { boomAt } from '../audio/spatial';
import { sfx } from '../audio/sound';
import { shipById } from '../content/ships';
import { saveCommander } from '../game/commander';
import { ARRIVES_IN, arrival, comingFor, EJECTS_AT, foughtHim, fromThePod, killedHisMan, memoryOf, overYourWreck, warning, type Renowned } from '../game/renowned';
import type { NpcShip } from '../game/npc';
import { cmdr, currentSystem, game } from '../core';
import { explosions, flight, npcs, player, space } from '../scene';
import { Explosion } from '../render/explosion';
import { flash } from '../ui/hud';
import { spillCargo } from './adrift';
import { computer, radio } from './comms';
import { rateKill } from './law';
import { keepCombat } from './moments';
import { addNpc, removeNpc, RENOWNED_COLOUR, spawnRenowned } from './traffic';

/** Him, in flight, and his pod once he's out of it. */
export const renownedNpc = new Map<NpcShip, Renowned>();
const pods = new Map<NpcShip, { who: Renowned; gone: number }>();
/** He's on his way: who, and when he arrives (flight seconds), in this system. */
let coming: { who: Renowned; at: number } | null = null;
/** He came for you in this system: if you leave before it's settled, you ran. */
let facing: Renowned | null = null;

const POD_TIME = 25; // seconds before his people pick the pod up

/** How it went, for everyone's story (signed in with a callsign; net/renowned.ts). */
const tell = (who: Renowned, how: 'beaten' | 'won' | 'ran') => {
  const [g, s] = who.key.split(':').map(Number);
  if (Number.isInteger(g) && Number.isInteger(s)) void tellRenowned(g, s, how);
};

/** One of the pirates here is down, by your hand: is anyone going to answer for it? */
export function pirateKilled(npc: NpcShip) {
  if (!game.commander || renownedNpc.has(npc) || pods.has(npc)) return;
  const now = Date.now();
  const here = currentSystem();
  const got = killedHisMan(cmdr(), here, now, sharedRecord(here.galaxy, here.index));
  if (!got) return;
  saveCommander(cmdr());
  if (got.what === 'warn') {
    setTimeout(() => game.state === 'flying' && radio('pirate', 'Pirate', warning(got.who), { colour: RENOWNED_COLOUR, urgency: 'worth' }), 2500);
    return;
  }
  coming = { who: got.who, at: flight.elapsed + ARRIVES_IN };
  facing = got.who;
  setTimeout(() => {
    if (game.state !== 'flying') return;
    radio('pirate', got.who.name, `I hear you've been busy, Commander. Stay where you are.`, { colour: RENOWNED_COLOUR, urgent: true, flash: 4 });
    computer('Combat computer', comingFor(got.who), 6, RENOWNED_COLOUR);
  }, 2500);
}

/** Bring him in now (the dev hook, and his arrival). */
export function bringRenowned(who: Renowned) {
  const ahead = player.forward();
  const side = new THREE.Vector3().randomDirection().projectOnPlane(ahead).normalize();
  const at = player.obj.position.clone().addScaledVector(ahead, 3500).addScaledVector(side, 2500);
  const npc = spawnRenowned(at, player.obj.position);
  npc.breaksOffAt = EJECTS_AT;
  npc.hostile = true;
  npc.firedOnPlayer = false;
  npc.target = player;
  npc.mode = 'attack';
  renownedNpc.set(npc, who);
  facing = who;
  const here = currentSystem();
  radio('pirate', who.name, arrival(who, memoryOf(cmdr(), who.key), sharedRecord(here.galaxy, here.index)), { colour: RENOWNED_COLOUR, urgent: true, flash: 5 });
  return npc;
}

/** Each frame, in flight or not. */
export function updateRenowned(dt: number) {
  // Gone from the system before it's settled: you ran.
  if (game.state === 'docked' || game.state === 'transition') {
    if (facing && game.commander) {
      foughtHim(cmdr(), facing, 'ran', Date.now());
      saveCommander(cmdr());
      tell(facing, 'ran');
    }
    coming = null;
    facing = null;
    renownedNpc.clear();
    pods.clear();
    return;
  }
  if (game.state !== 'flying') return;
  if (coming && flight.elapsed >= coming.at) {
    const who = coming.who;
    coming = null;
    bringRenowned(who);
  }
  for (const [npc, who] of renownedNpc) {
    if (!npcs.includes(npc)) {
      renownedNpc.delete(npc);
      continue;
    }
    if (npc.brokeOff) eject(npc, who);
  }
  for (const [pod, p] of pods) {
    if (!npcs.includes(pod)) {
      pods.delete(pod);
      continue;
    }
    p.gone -= dt;
    if (p.gone > 0) continue;
    pods.delete(pod);
    removeNpc(pod);
    if (pod.obj.position.distanceTo(player.obj.position) < 12000) flash(`${p.who.name}'s pod is picked up`, 2.5);
  }
}

/** Down to his last fifth: his Cobra goes up, and he's out in a pod. */
function eject(npc: NpcShip, who: Renowned) {
  renownedNpc.delete(npc);
  const at = npc.obj.position.clone();
  const velocity = npc.ship.forward().multiplyScalar(npc.ship.speed);
  const boom = new Explosion(npc.def, npc.obj, velocity);
  space.scene.add(boom.group);
  explosions.push(boom);
  boomAt(at, 2.2, 1600, 1.6);
  if (Object.keys(npc.cargo).length) spillCargo(at, velocity, npc.cargo);
  const beatHim = npc.attacker === player;
  const rated = beatHim ? rateKill(npc) : '';
  removeNpc(npc);
  // The pod: small, quick, running for home.
  const canister = shipById('cargo-canister')!;
  const pod = addNpc({ ...canister, id: 'escape-pod', name: 'Escape pod', stats: { ...canister.stats, maxSpeed: 220, hull: 12 } }, 'pirate', at, at);
  Object.assign(pod, { mode: 'flee', hostile: false, fights: false, target: player, bounty: 0 });
  pod.ship.speed = 120;
  pod.obj.lookAt(at.clone().sub(player.obj.position).add(at));
  pods.set(pod, { who, gone: POD_TIME });
  facing = null;
  sfx.ecm();
  setTimeout(() => game.state === 'flying' && flash(`${who.name}'s escape pod is clear`, 3), 900);
  setTimeout(() => game.state === 'flying' && radio('pirate', who.name, fromThePod(who), { colour: RENOWNED_COLOUR, urgency: 'worth' }), 2600);
  if (!beatHim || !game.commander) return;
  const c = cmdr();
  c.credits = Math.round((c.credits + npc.bounty) * 10) / 10;
  foughtHim(c, who, 'beaten', Date.now());
  saveCommander(c);
  tell(who, 'beaten');
  flash(`${who.name} beaten · Bounty ${npc.bounty} Cr${rated ? ` · ${rated}` : ''}`, 3.5);
  void keepCombat({ kind: 'kill', text: `Beat ${who.name}, ${who.by} · bounty ${npc.bounty} Cr`, subject: who.name }, 20, 6);
}

/** You destroyed something: if it was his pod, he'll remember. Returns true when it was. */
export function podDestroyed(npc: NpcShip, byYou: boolean): boolean {
  const p = pods.get(npc);
  if (!p) return false;
  pods.delete(npc);
  if (byYou && game.commander) {
    memoryOf(cmdr(), p.who.key).podShot = true;
    saveCommander(cmdr());
    flash(`You shot ${p.who.name}'s escape pod · he'll live, and he won't forget · and that's a crime`, 4);
  }
  return true;
}

/** You died: if he did it, his tally grows. */
export function renownedKilledYou(killer: NpcShip | null) {
  const who = killer ? renownedNpc.get(killer) : undefined;
  if (!who || !game.commander) return;
  const c = cmdr();
  foughtHim(c, who, 'won', Date.now());
  tell(who, 'won');
  radio('pirate', who.name, overYourWreck(who, memoryOf(c, who.key).beat), { colour: RENOWNED_COLOUR });
  facing = null;
  renownedNpc.clear();
}
