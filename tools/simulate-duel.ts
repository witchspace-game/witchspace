// One Cobra against one pirate, many times over, to tune a pirate's fight. The Cobra is flown by
// the combat computer's pilot with a human's limits: it fires a pulse laser only when the pirate is
// really in its sights, and the laser heats as yours does. The pirate flies as it does in the game.
// Runs headless in Node.
//
//   npx tsx tools/simulate-duel.ts            each opponent, 200 duels
//   npx tsx tools/simulate-duel.ts --runs 50
//
// What to look for (docs/design/pilot-skill.md, Tuning): a pack pirate goes down in seconds; a
// renowned pirate is a real fight you can lose, and running from him works.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ShipDef } from '../src/content/types';
import { CombatPilot } from '../src/game/combatPilot';
import { NpcShip, type FightStyle } from '../src/game/npc';
import { PlayerShip } from '../src/game/playerShip';
import { PIRATE_LASER, PULSE_LASER, RENOWNED_LASER, type Laser } from '../src/game/weapons';

const root = resolve(import.meta.dirname, '..');
const load = (id: string): ShipDef => JSON.parse(readFileSync(resolve(root, `content/ships/${id}.json`), 'utf8'));

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const RUNS = arg('runs', 200);
const DT = 1 / 60;
const TIMEOUT = 150; // seconds: a draw
const HEAT_LIMIT = 100;
/** A human's aim: how far off each shot goes (radians), and how close they wait to fire. */
const AIM_ERROR = arg('aim', 0.03);
const OPEN_FIRE = arg('open', 2000);
const GOT_AWAY = 7000;

let seed = 1984;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
Math.random = rand; // the ships' own randomness too, so runs compare

interface Opponent {
  name: string;
  ship: string;
  laser: Laser;
  style: FightStyle;
  gimbal?: number;
}

const OPPONENTS: Opponent[] = [
  { name: 'Sidewinder (pack)', ship: 'sidewinder', laser: PIRATE_LASER, style: 'joust' },
  { name: 'Mamba (pack)', ship: 'mamba', laser: PIRATE_LASER, style: 'joust' },
  { name: 'Renowned Cobra', ship: 'cobra-mk3', laser: RENOWNED_LASER, style: 'holdBack', gimbal: THREE.MathUtils.degToRad(4) },
];

/** Does a shot along `dir` from `from` pass within `radius` of `at`, inside `range`? */
function hits(from: THREE.Vector3, dir: THREE.Vector3, at: THREE.Vector3, radius: number, range: number) {
  const rel = at.clone().sub(from);
  const along = rel.dot(dir);
  return along > 0 && along < range && rel.addScaledVector(dir, -along).length() < radius;
}

function duel(o: Opponent, run: boolean) {
  const cobra = new PlayerShip(load('cobra-mk3'));
  cobra.speed = 150;
  const npc = new NpcShip(load(o.ship), 'pirate', o.laser, { centre: new THREE.Vector3(), radius: 1000, height: 0, rate: 0.1, angle: 0 });
  npc.style = o.style;
  npc.gimbal = o.gimbal;
  const dir = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.4, 1).normalize();
  npc.obj.position.copy(dir.multiplyScalar(4000));
  npc.obj.lookAt(cobra.obj.position);
  npc.ship.speed = npc.ship.maxSpeed * 0.6;
  npc.target = cobra;
  npc.mode = 'attack';
  const pilot = new CombatPilot(rand);
  let heat = 0;
  let cooldown = 0;
  let hitAgo = 99;
  for (let t = 0; t < TIMEOUT; t += DT) {
    // You: fight, or (run) turn away flat out and keep going.
    if (run) {
      const away = cobra.obj.position.clone().sub(npc.obj.position).normalize();
      cobra.steer(DT, { ...steerAway(cobra, away), throttle: 0, speedStep: 0, aimDx: 0, aimDy: 0, fire: false, active: false });
      cobra.speed += THREE.MathUtils.clamp(cobra.maxSpeed - cobra.speed, -80 * DT, 80 * DT);
      if (cobra.obj.position.distanceTo(npc.obj.position) > GOT_AWAY) return { won: false, lost: false, escaped: true, t, hull: cobra.hull };
    } else {
      pilot.fly(DT, cobra, [npc], npc, undefined, { heat: heat / HEAT_LIMIT, hitBy: hitAgo < 3 ? npc : null, hitAgo });
      cooldown -= DT;
      heat = Math.max(0, heat - PULSE_LASER.cooling * DT);
      const to = npc.obj.position.clone().sub(cobra.obj.position);
      const inSights = cobra.forward().angleTo(to) < Math.atan2(npc.radius * 0.8, to.length()) + THREE.MathUtils.degToRad(0.4);
      if (inSights && to.length() < OPEN_FIRE && cooldown <= 0 && heat < HEAT_LIMIT * 0.95) {
        cooldown = PULSE_LASER.interval;
        heat += PULSE_LASER.heat;
        // A human's aim: a little spread on every shot.
        const shot = cobra.forward().add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(AIM_ERROR * 2)).normalize();
        if (hits(cobra.obj.position, shot, npc.obj.position, npc.radius * 0.8, PULSE_LASER.range) && npc.hit(PULSE_LASER.damage, cobra)) return { won: true, lost: false, escaped: false, t, hull: cobra.hull };
      }
    }
    cobra.move(DT);
    cobra.recharge(DT);
    hitAgo += DT;
    const shot = npc.update(DT);
    if (shot && hits(npc.obj.position, shot, cobra.obj.position, 30, npc.laser.range)) {
      hitAgo = 0;
      if (cobra.damage(npc.laser.damage)) return { won: false, lost: true, escaped: false, t, hull: 0 };
    }
  }
  return { won: false, lost: false, escaped: false, t: TIMEOUT, hull: cobra.hull };
}

function steerAway(ship: PlayerShip, away: THREE.Vector3) {
  const local = away.clone().applyQuaternion(ship.obj.quaternion.clone().invert());
  const yaw = THREE.MathUtils.clamp(3 * Math.atan2(-local.x, local.z), -1, 1);
  const pitch = THREE.MathUtils.clamp(3 * Math.atan2(local.y, Math.hypot(local.x, local.z)), -1, 1);
  return { pitch, yaw, roll: 0 };
}

const pct = (n: number) => `${Math.round((n / RUNS) * 100)}%`.padStart(4);
console.log(`${RUNS} duels each: a combat-computer Cobra with a pulse laser, a human's aim\n`);
for (const o of OPPONENTS) {
  for (const run of [false, true]) {
    let won = 0, lost = 0, escaped = 0, time = 0, hull = 0;
    for (let i = 0; i < RUNS; i++) {
      const r = duel(o, run);
      won += Number(r.won);
      lost += Number(r.lost);
      escaped += Number(r.escaped);
      time += r.t;
      hull += r.hull;
    }
    const what = run ? 'you run  ' : 'you fight';
    console.log(`${o.name.padEnd(18)} ${what}  won ${pct(won)}  lost ${pct(lost)}  got away ${pct(escaped)}  avg ${(time / RUNS).toFixed(0).padStart(3)} s  hull left ${(hull / RUNS).toFixed(0).padStart(3)}`);
  }
}
