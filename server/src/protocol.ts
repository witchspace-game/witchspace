// Messages between the game and a star system's server (shared space,
// stage 1). Shared by both sides, so they always agree. JSON over a
// WebSocket; positions in metres in the system's frame, rotations as
// quaternions [x, y, z, w], speeds in m/s.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

/** What the server knows about a commander in the system. */
export interface Commander {
  id: string;
  name: string;
  /** Combat rank, shown as insignia beside the callsign. */
  rank: string;
  /** Signed in, with the callsign their account holds; otherwise a guest. */
  verified: boolean;
  ship: string;
  p: Vec3;
  q: Quat;
  s: number;
  /** Lasers firing. */
  f: boolean;
  /** Running dark (transponder off): others see an unidentified ship until close. */
  d?: boolean;
}

export type ClientMessage =
  /** First message: who you are, what you fly, and the lasers fitted. */
  | { type: 'hello'; name: string; ship: string; lasers?: string[]; rank?: string; missiles?: number; ecm?: boolean; session?: string }
  /** About ten times a second: where you are, and your shields and hull (which can only go down this way). */
  | { type: 'state'; p: Vec3; q: Quat; s: number; f: boolean; h?: [number, number]; d?: boolean }
  /** A laser shot: the direction it went, and which laser. The server decides what it hit. */
  | { type: 'fire'; d: Vec3; l: string }
  /** Launch a missile at a commander. The server flies it and decides whether it hits. */
  | { type: 'missile'; target: string }
  /** Fire the ECM: destroys missiles nearby. */
  | { type: 'ecm' };

export type ServerMessage =
  /** Your id, and everyone already here. */
  | { type: 'welcome'; id: string; others: Commander[] }
  | { type: 'join'; commander: Commander }
  | { type: 'state'; id: string; p: Vec3; q: Quat; s: number; f: boolean; d?: boolean }
  | { type: 'leave'; id: string }
  /** The server didn't accept a move: you're put back here. */
  | { type: 'correct'; p: Vec3 }
  /** You were hit: by whom, how hard, and what you have left. */
  | { type: 'hit'; by: string; damage: number; shields: number; hull: number }
  /** Your shot hit this commander. */
  | { type: 'hitconfirm'; id: string }
  /** You collided with a commander: the damage, what you have left, and which way you were pushed. */
  | { type: 'bump'; with: string; damage: number; shields: number; hull: number; push: Vec3 }
  /** A commander was destroyed, and by whom (none for a collision). */
  | { type: 'destroyed'; id: string; by: string; cause?: 'laser' | 'missile' | 'collision' }
  /** A missile is away: who fired it at whom, and where it starts. */
  | { type: 'missile'; id: string; owner: string; target: string; p: Vec3; d: Vec3; s: number }
  /** A missile is gone: it hit, an ECM got it, or its motor burned out. */
  | { type: 'missileEnd'; id: string; how: 'hit' | 'ecm' | 'expired'; p: Vec3 }
  /** Someone fired an ECM, here. */
  | { type: 'ecm'; id: string; p: Vec3 };

/** The ships commanders can fly in shared space (stage 1: the Cobra). Must match content/ships. */
export const SHIPS: Record<string, { maxSpeed: number; shields: number; hull: number; radius: number; missiles: number }> = {
  'cobra-mk3': { maxSpeed: 280, shields: 100, hull: 150, radius: 28, missiles: 3 },
};

/** Player lasers, as in src/game/weapons.ts (a test checks they match). */
export const LASERS: Record<string, { interval: number; damage: number; range: number }> = {
  pulse: { interval: 0.2, damage: 14, range: 3000 },
  beam: { interval: 0.1, damage: 9, range: 3200 },
  military: { interval: 0.1, damage: 13, range: 3600 },
};

export const SHIELD_RECHARGE = 6; // per second, as in the game
export const GIMBAL_DAMAGE = 0.8; // shots well off the nose are gimballed or turret shots: a little weaker
export const REWIND = 0.2; // seconds: hits are judged where the shooter saw the target
export const SPREAD = 0.006; // radians: every laser's own scatter
/** Missiles, as in src/game/missile.ts (a test checks they match). */
export const MISSILE = { launchSpeed: 120, maxSpeed: 650, acceleration: 260, turnRate: 1.5, fuse: 40, lifetime: 30, damage: 140 };
export const LOCK_RANGE = 5000; // metres: how far away you can lock on
export const ECM_RANGE = 4000;
export const ECM_COOLDOWN = 4000; // ms

export const COLLIDE = 0.75; // of a ship's radius: how close counts as touching
export const BUMP_COOLDOWN = 1000; // ms: one contact between two ships only hurts once

/** How far apart two state messages may put you: speed with some slack, plus an in-system jump. */
export const JUMP = 10_500; // metres: the J jump
export const JUMP_COOLDOWN = 1000; // ms between jumps
export const SLACK = 1.3; // allowance for lag and timing
export const SYSTEM_RADIUS = 250_000; // metres from the station: nothing legitimate is further out

/** The combat ranks, as in src/game/rating.ts (a test checks they match). Claimed by the browser until commanders are saved on the server. */
export const RANKS = ['Harmless', 'Mostly Harmless', 'Poor', 'Average', 'Above Average', 'Competent', 'Dangerous', 'Deadly', 'Elite'];

/** A display name: printable, trimmed, at most 24 characters. */
export function cleanName(name: unknown): string {
  const s = typeof name === 'string' ? name.replace(/[^\p{L}\p{N} .'_-]/gu, '').trim().slice(0, 24) : '';
  return s || 'Commander';
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
export const isQuat = (v: unknown): v is Quat => Array.isArray(v) && v.length === 4 && v.every(finite);
