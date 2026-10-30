import * as THREE from 'three';
import { steerTowards, type NpcShip } from './npc';
import type { PlayerShip } from './playerShip';

// The combat computer (Modern rules, needs a turret): flies your ship in a fight so you can work
// the guns. Mark: "It should be properly clever and rotate through proper evasive flying
// techniques and know who or what is attacking the ship!" So it watches every hostile (who's on
// your tail, whose nose is on you, who just hit you), fights the one that matters, and picks a
// manoeuvre for the moment: an attack run, a break turn into whoever's behind you, scissors when
// they're close, jinking under fire, or extending away to cool the lasers and let the shields
// come back. It never flies the same defensive move twice running, and says what it's doing.
// It still flies no better than a good commander, and kills made with it count half.

export const PILOT_RANGE = 6000; // metres: it fights ships this close
const BREAKOFF_RANGE = 450; // metres: peel away early (two ships close fast)
const BREAKOFF_TIME = 2.4; // seconds, at least, before coming round again
const BREAKOFF_CLEAR = 900; // metres: open the range this far first, so the next run is a real one
const BREAKOFF_MAX = 6; // seconds: come round by then regardless
const LEAD = 0.15; // seconds: aim where the target will be
const CLOSE = 900; // metres: slow down to fight inside this
const ACCEL = 80; // m/s per second
const PLANET_MARGIN = 1.25; // planet radii: turn away inside this

const TAIL_CONE = THREE.MathUtils.degToRad(55); // behind you, within this of dead astern
const NOSE_CONE = THREE.MathUtils.degToRad(25); // pointing at you, within this
const DANGER_RANGE = 1600; // metres: a ship on your tail this close is a threat to answer
const SCISSORS_RANGE = 700; // metres: close enough to make it overshoot
const UNDER_FIRE = 2.5; // seconds since a hit that count as being under fire
const LOW_SHIELDS = 0.3; // of full: extend to let them come back
const HOT_LASER = 0.8; // of the overheat limit: extend to cool

export type Manoeuvre = 'attack' | 'breakoff' | 'break' | 'scissors' | 'jink' | 'extend';

const NAMES: Record<Manoeuvre, string> = {
  attack: 'Attack run',
  breakoff: 'Breaking off',
  break: 'Break turn',
  scissors: 'Scissors',
  jink: 'Jinking',
  extend: 'Extending',
};

export interface Planet {
  centre: THREE.Vector3;
  radius: number;
}

/** What the ship knows about itself: how hot the laser is, and who last hit it. */
export interface PilotStatus {
  /** Laser heat, 0 (cold) to 1 (overheated). */
  heat: number;
  hitBy: NpcShip | null;
  /** Seconds since that hit. */
  hitAgo: number;
}

/** How a hostile stands towards you. */
interface Threat {
  npc: NpcShip;
  dist: number;
  onTail: boolean;
  noseOn: boolean;
  hitMe: boolean;
  score: number;
}

function assess(ship: PlayerShip, npcs: NpcShip[], status?: PilotStatus): Threat[] {
  const at = ship.obj.position;
  const astern = ship.forward().negate();
  const out: Threat[] = [];
  for (const npc of npcs) {
    if (!npc.hostile) continue;
    const to = npc.obj.position.clone().sub(at);
    const dist = to.length();
    if (dist > PILOT_RANGE) continue;
    const onTail = astern.angleTo(to) < TAIL_CONE;
    const noseOn = npc.ship.forward().angleTo(to.clone().negate()) < NOSE_CONE;
    const hitMe = status?.hitBy === npc && status.hitAgo < UNDER_FIRE;
    const score = (hitMe ? 3 : 0) + (noseOn ? 2 : 0) + (onTail ? 1.5 : 0) + (1 - dist / PILOT_RANGE);
    out.push({ npc, dist, onTail, noseOn, hitMe, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Who to fight: the ship your missile is locked on, if it's close enough;
 * otherwise the nearest ship that's after you; otherwise the nearest pirate.
 */
export function chooseTarget(at: THREE.Vector3, npcs: NpcShip[], locked: NpcShip | null): NpcShip | null {
  const near = (n: NpcShip) => n.obj.position.distanceTo(at) < PILOT_RANGE;
  if (locked && npcs.includes(locked) && near(locked)) return locked;
  const by = (pick: (n: NpcShip) => boolean) =>
    npcs.filter((n) => pick(n) && near(n)).sort((a, b) => a.obj.position.distanceTo(at) - b.obj.position.distanceTo(at))[0] ?? null;
  return by((n) => n.hostile) ?? by((n) => n.role === 'pirate');
}

export class CombatPilot {
  target: NpcShip | null = null;
  mode: Manoeuvre = 'attack';
  /** A line for the HUD when the manoeuvre or the target changes; the caller clears it. */
  announce: string | null = null;
  private timer = 0; // seconds left in this manoeuvre (counts down)
  private elapsed = 0; // seconds into it
  private side = 1; // which way a turn goes: +1 or -1
  private period = 2.5; // seconds: a scissors reversal or a jink's corkscrew
  private lastDefence: Manoeuvre | null = null;
  private readonly breakDir = new THREE.Vector3();
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  private begin(mode: Manoeuvre, seconds: number, why?: string) {
    // Only the moves worth knowing about are said: not every pass and break-off of a chase.
    if (why) this.announce = `${NAMES[mode]} · ${why}`;
    this.mode = mode;
    this.timer = seconds;
    this.elapsed = 0;
    if (mode === 'break' || mode === 'scissors' || mode === 'jink') this.lastDefence = mode;
  }

  /** Answer a ship on your tail: never the same move twice running, and suited to the range. */
  private defend(t: Threat) {
    const name = t.npc.def.name;
    const options: Manoeuvre[] = [];
    if (t.dist < SCISSORS_RANGE) options.push('scissors');
    if (t.hitMe) options.push('jink');
    options.push('break');
    const fresh = options.filter((m) => m !== this.lastDefence);
    const pick = (fresh.length ? fresh : options)[Math.floor(this.random() * (fresh.length || options.length))];
    this.side = this.random() < 0.5 ? -1 : 1;
    // Long enough for the hull to follow: a reversal about a quarter-turn in, a corkscrew it can fly.
    this.period = pick === 'scissors' ? 2.2 + this.random() * 0.6 : 3 + this.random();
    const why = t.hitMe ? `${name} firing on you` : `${name} on your tail`;
    if (pick === 'scissors') this.begin('scissors', 5, why);
    else if (pick === 'jink') this.begin('jink', 2 + this.random(), why);
    else this.begin('break', 1.6 + this.random() * 0.8, why);
  }

  /**
   * Fly the ship for one frame. Returns false when there's nothing left to fight. `status` tells
   * it the laser's heat and who last hit you; without it, it flies the textbook chase alone.
   */
  fly(dt: number, ship: PlayerShip, npcs: NpcShip[], locked: NpcShip | null, planet?: Planet, status?: PilotStatus): boolean {
    const at = ship.obj.position;
    const threats = assess(ship, npcs, status);
    const danger = threats.find((t) => t.onTail && t.noseOn && t.dist < DANGER_RANGE) ?? threats.find((t) => t.hitMe);

    // Who to fight: your missile's target if you've locked one; whoever is hurting you; else the old choice.
    const lockedNear = locked && npcs.includes(locked) && locked.obj.position.distanceTo(at) < PILOT_RANGE ? locked : null;
    const lost = !this.target || !npcs.includes(this.target) || this.target.obj.position.distanceTo(at) > PILOT_RANGE * 1.2;
    const next = lockedNear ?? (danger ? danger.npc : lost ? (threats[0]?.npc ?? chooseTarget(at, npcs, locked)) : this.target);
    if (next !== this.target) {
      this.target = next;
      if (next && !lost && !danger) this.announce = `Target · ${next.def.name}`;
      if (lost && !danger) this.begin('attack', 0);
    }
    const target = this.target;
    if (!target) return false;

    this.timer -= dt;
    this.elapsed += dt;
    const shields = ship.shields / (ship.def.stats.shields || 1);
    const defending = this.mode === 'break' || this.mode === 'scissors' || this.mode === 'jink';

    // Choose: a threat behind you comes first; then weak shields or a hot laser; then the attack.
    if (danger && !defending && this.mode !== 'extend') this.defend(danger);
    else if (defending && this.timer <= 0) {
      if (danger) this.defend(danger);
      else this.begin('attack', 0, `${target.def.name} in front`);
    } else if (this.mode === 'attack' && !danger && (shields < LOW_SHIELDS || (status?.heat ?? 0) > HOT_LASER)) {
      this.begin('extend', 7, shields < LOW_SHIELDS ? 'shields recharging' : 'laser cooling');
    } else if (this.mode === 'extend' && (this.timer <= 0 || (shields > 0.7 && (status?.heat ?? 0) < 0.4))) {
      this.begin('attack', 0, `back for the ${target.def.name}`);
    }

    const to = target.obj.position.clone().sub(at);
    const dist = to.length();
    const fwd = ship.forward();
    let aimAt: THREE.Vector3;
    let speed = ship.maxSpeed;
    switch (this.mode) {
      case 'attack': {
        if (dist < BREAKOFF_RANGE) {
          // Peel away to the side and back from the target, never past it.
          const away = to.clone().normalize().negate();
          const sideways = new THREE.Vector3().randomDirection().projectOnPlane(away).normalize();
          this.breakDir.copy(sideways).addScaledVector(away, 0.6).normalize();
          this.begin('breakoff', BREAKOFF_TIME);
        }
        aimAt = target.obj.position.clone().addScaledVector(target.ship.forward(), target.ship.speed * LEAD);
        if (dist < CLOSE) speed = ship.maxSpeed * 0.65;
        break;
      }
      case 'breakoff': {
        if ((this.timer <= 0 && dist > BREAKOFF_CLEAR) || this.timer <= BREAKOFF_TIME - BREAKOFF_MAX) this.begin('attack', 0);
        aimAt = at.clone().addScaledVector(this.breakDir, 1000);
        break;
      }
      case 'break': {
        // A sustained hard pull, at full speed: the line between you swings faster than a
        // pursuer can turn to follow, and it falls out of its sight.
        aimAt = at.clone().addScaledVector(ship.up(), 1000 * this.side).addScaledVector(fwd, 100);
        break;
      }
      case 'scissors': {
        // Turn hard one way, then the other, throttled back, until it overshoots in front.
        const flip = Math.floor(this.elapsed / this.period) % 2 ? -1 : 1;
        aimAt = at.clone().addScaledVector(ship.up(), 1000 * this.side * flip).addScaledVector(fwd, 100);
        speed = ship.maxSpeed * 0.8;
        if (fwd.angleTo(to) < THREE.MathUtils.degToRad(40)) this.timer = Math.min(this.timer, 0); // it's in front: take the shot
        break;
      }
      case 'jink': {
        // A corkscrew round the line of flight: hard to hold in a sight.
        const w = (Math.PI * 2 * this.elapsed) / this.period;
        aimAt = at.clone().addScaledVector(fwd, 300).addScaledVector(ship.right(), 1000 * Math.cos(w) * this.side).addScaledVector(ship.up(), 1000 * Math.sin(w));
        break;
      }
      case 'extend': {
        // Away from everyone after you, with a gentle weave.
        const away = new THREE.Vector3();
        for (const t of threats) away.add(at.clone().sub(t.npc.obj.position).normalize());
        if (away.lengthSq() < 1e-6) away.copy(fwd);
        const weave = Math.sin(this.elapsed * 1.3) * 0.35;
        aimAt = at.clone().addScaledVector(away.normalize(), 1000).addScaledVector(ship.right(), 1000 * weave);
        break;
      }
    }
    // Never fly into the planet chasing someone.
    if (planet) {
      const fromPlanet = at.clone().sub(planet.centre);
      if (fromPlanet.length() < planet.radius * PLANET_MARGIN && fwd.dot(fromPlanet) < 0) aimAt = at.clone().add(fromPlanet.setLength(1000));
    }

    ship.steer(dt, { ...steerTowards(ship.obj, aimAt), throttle: 0, speedStep: 0, aimDx: 0, aimDy: 0, fire: false, active: false });
    ship.speed += THREE.MathUtils.clamp(speed - ship.speed, -ACCEL * dt, ACCEL * dt);
    return true;
  }
}
