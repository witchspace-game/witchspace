// When the flight recorder records, and when it rests (docs/design/flight-recorder.md).
// Recording empty space costs battery for nothing, so the recorder rests in
// open space with nothing about, and wakes the moment anything is near. It
// never rests near a Legend: the Falcon runs dark and never shows on the
// scanner, and spotting it is the whole point. So "near" is what the game
// knows is there, not what the scanner shows.

export interface Point {
  x: number;
  y: number;
  z: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export interface Surroundings {
  me: Point;
  /** Every ship, missile and commander in the system, scanner or not. */
  ships: Point[];
  /** Legends in the system (anywhere: they're always worth a minute). */
  legends: number;
  station: Point | null;
  planet: { position: Point; radius: number } | null;
  /** A rift opening, the Marshals coming through. */
  rift: boolean;
}

/** The scanner's longest range. */
export const SHIP_RANGE = 12_000;
/** Within this of the station: the approach, the slot, the traffic. */
export const STATION_RANGE = 20_000;
/** Within this of a planet's surface: the planet filling the view. */
export const PLANET_RANGE = 15_000;
/** Seconds it carries on after the last thing has gone, so a clip finishes (the explosion, the ship leaving). */
export const TAIL = 8;

export function somethingNear(s: Surroundings): boolean {
  if (s.rift || s.legends > 0) return true;
  if (s.station && distance(s.me, s.station) < STATION_RANGE) return true;
  if (s.planet && distance(s.me, s.planet.position) < s.planet.radius + PLANET_RANGE) return true;
  return s.ships.some((p) => distance(s.me, p) < SHIP_RANGE);
}

/** Tracks quiet time: rest() is true once nothing has been near for TAIL seconds. */
export class RecorderWatch {
  private quiet = 0;

  update(s: Surroundings, dt: number) {
    this.quiet = somethingNear(s) ? 0 : this.quiet + dt;
  }

  get resting() {
    return this.quiet > TAIL;
  }
}
