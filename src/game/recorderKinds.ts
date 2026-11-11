// Which moments the flight recorder keeps (an idea from a player on the ideas board,
// "Selectively disable flight recorder": surveys are recorded too, and they're boring).
// One switch per kind, kept on this device. Surveys start off; everything else on.
// Moments you keep by hand (Shift+P, holding the camera button) and photos always save.

import type { MomentKind } from './moments';

export type ChoosableKind = Exclude<MomentKind, 'kept' | 'photo'>;

/** The switches, in the order the flight log shows them. */
export const RECORDER_KINDS: { kind: ChoosableKind; label: string }[] = [
  { kind: 'kill', label: 'Fights' },
  { kind: 'death', label: 'Ship lost' },
  { kind: 'legend', label: 'Legends' },
  { kind: 'marshals', label: 'Marshals' },
  { kind: 'crime', label: 'Crimes' },
  { kind: 'trade', label: 'Trade runs' },
  { kind: 'discovery', label: 'Surveys' },
];

const DEFAULT_OFF: ChoosableKind[] = ['discovery'];
const KEY = 'witchspace-recorder-kinds';

function chosen(): Partial<Record<ChoosableKind, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Whether the recorder keeps this kind of moment. */
export function recordsKind(kind: MomentKind): boolean {
  if (kind === 'kept' || kind === 'photo') return true;
  return chosen()[kind] ?? !DEFAULT_OFF.includes(kind);
}

export function setRecordsKind(kind: ChoosableKind, on: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...chosen(), [kind]: on }));
  } catch {
    /* storage blocked: the defaults stand */
  }
}
