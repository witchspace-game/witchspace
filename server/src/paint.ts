// A commander's paint in shared space (moved out of index.ts): cleaned as sent, then an edition
// shown only by the account that holds it.

import { editionById } from '../../src/content/editions';
import type { Paint } from './protocol';

/** A ship's paint, as sent: hex colours and a glow in range, or nothing. */
export function cleanPaint(p: unknown): Paint | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const { c, g, t, l, e } = p as { c?: unknown; g?: unknown; t?: unknown; l?: unknown; e?: unknown };
  const hex = (x: unknown) => (typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x) ? x : undefined);
  const colour = hex(c);
  if (!colour) return undefined;
  const glow = typeof g === 'number' && g >= 1 && g <= 1.5 ? g : undefined;
  const trim = hex(t);
  const ed = e && typeof e === 'object' ? (e as { i?: unknown; n?: unknown }) : null;
  const edition = ed && typeof ed.i === 'string' && Number.isInteger(ed.n) && (ed.n as number) > 0 ? { i: ed.i, n: ed.n as number } : undefined;
  return { c: colour, ...(glow ? { g: glow } : {}), ...(trim ? { t: trim } : {}), ...(l === 1 ? { l: 1 as const } : {}), ...(edition ? { e: edition } : {}) };
}

/**
 * An edition is shown only by its owner (Mark: his Fer-de-lance, numbered, is something to show
 * off): the number has to be one this account holds, and the Dark Edition's black-light running
 * lights come only with a Dark Edition. Anything else is dropped, and the paint flies plain.
 */
export function ownPaint(p: Paint | undefined, held: { id: string; number: number }[]): Paint | undefined {
  if (!p) return p;
  const { e, l, ...plain } = p;
  const mine = e && held.some((h) => h.id === e.i && h.number === e.n) ? e : undefined;
  const lights = l === 1 && held.some((h) => editionById(h.id)?.luxuries.includes('black-light-lights'));
  return { ...plain, ...(lights ? { l: 1 as const } : {}), ...(mine ? { e: mine } : {}) };
}
