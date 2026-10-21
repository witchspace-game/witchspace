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
  ship: string;
  p: Vec3;
  q: Quat;
  s: number;
  /** Lasers firing. */
  f: boolean;
}

export type ClientMessage =
  /** First message: who you are, what you fly, and the lasers fitted. */
  | { type: 'hello'; name: string; ship: string; lasers?: string[]; rank?: string }
  /** About ten times a second: where you are, and your shields and hull (which can only go down this way). */
  | { type: 'state'; p: Vec3; q: Quat; s: number; f: boolean; h?: [number, number] }
  /** A laser shot: the direction it went, and which laser. The server decides what it hit. */
  | { type: 'fire'; d: Vec3; l: string };

export type ServerMessage =
  /** Your id, and everyone already here. */
  | { type: 'welcome'; id: string; others: Commander[] }
  | { type: 'join'; commander: Commander }
  | { type: 'state'; id: string; p: Vec3; q: Quat; s: number; f: boolean }
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
  | { type: 'destroyed'; id: string; by: string; cause?: 'laser' | 'collision' };

/** The ships commanders can fly in shared space (stage 1: the Cobra). Must match content/ships. */
export const SHIPS: Record<string, { maxSpeed: number; shields: number; hull: number; radius: number }> = {
  'cobra-mk3': { maxSpeed: 280, shields: 100, hull: 150, radius: 28 },
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
