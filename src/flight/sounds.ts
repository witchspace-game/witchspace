// How ships sound (moved from main.ts): engines by their ship file's style, and a grand tourer's
// lasers and missile launch.

import * as THREE from 'three';
import { sfx } from '../audio/sound';
import { grandShot, precisionLaunch, rocketAt, zapAt, type EngineVoice, type LaserSound, type ShipVoice } from '../audio/spatial';
import type { ShipDef } from '../content/types';

/** Other commanders' engines in shared space, by their id, each with her own voice. */
export const remoteVoices = new Map<string, ShipVoice>();
/** How a ship's engines sound: her ship file's style.engine (the Fer-de-lance's is a grand tourer's, Mark). */
export const voiceOf = (def: ShipDef | undefined): EngineVoice => def?.style.engine ?? 'drone';

// A grand tourer's weapons sound like her engines (Mark): heavy lasers with an echo, each kind its own, and a
// precision missile launch. Every other ship keeps the old zap and clunk.
export const laserSound = (l: object): LaserSound => {
  const id = (l as { id?: string }).id;
  return id === 'beam' || id === 'military' ? id : 'pulse';
};
export function shotSound(def: ShipDef, kind: LaserSound, at: THREE.Vector3 | null) {
  if (voiceOf(def) === 'grand') grandShot(kind, at);
  else if (at) zapAt(at, 700, 120, 0.15, 0.5);
  else sfx.laser();
}
export function launchSound(def: ShipDef, at: THREE.Vector3 | null) {
  if (voiceOf(def) === 'grand') precisionLaunch(at);
  else if (at) rocketAt(at, 0.5);
  else sfx.missileLaunch();
}
export const VOICE_RANGE = 2000; // hear other ships' engines within this distance
