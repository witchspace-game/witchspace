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
  ship: string;
  p: Vec3;
  q: Quat;
  s: number;
  /** Lasers firing. */
  f: boolean;
}

export type ClientMessage =
  /** First message: who you are and what you fly. */
  | { type: 'hello'; name: string; ship: string }
  /** About ten times a second: where you are. */
  | { type: 'state'; p: Vec3; q: Quat; s: number; f: boolean };

export type ServerMessage =
  /** Your id, and everyone already here. */
  | { type: 'welcome'; id: string; others: Commander[] }
  | { type: 'join'; commander: Commander }
  | { type: 'state'; id: string; p: Vec3; q: Quat; s: number; f: boolean }
  | { type: 'leave'; id: string }
  /** The server didn't accept a move: you're put back here. */
  | { type: 'correct'; p: Vec3 };

/** The ships commanders can fly in shared space (stage 1: the Cobra). */
export const SHIPS: Record<string, { maxSpeed: number }> = { 'cobra-mk3': { maxSpeed: 280 } };

/** How far apart two state messages may put you: speed with some slack, plus an in-system jump. */
export const JUMP = 10_500; // metres: the J jump
export const JUMP_COOLDOWN = 1000; // ms between jumps
export const SLACK = 1.3; // allowance for lag and timing
export const SYSTEM_RADIUS = 250_000; // metres from the station: nothing legitimate is further out

/** A display name: printable, trimmed, at most 24 characters. */
export function cleanName(name: unknown): string {
  const s = typeof name === 'string' ? name.replace(/[^\p{L}\p{N} .'_-]/gu, '').trim().slice(0, 24) : '';
  return s || 'Commander';
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
export const isQuat = (v: unknown): v is Quat => Array.isArray(v) && v.length === 4 && v.every(finite);
