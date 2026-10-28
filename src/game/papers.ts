// An edition's papers (the edition delivery pack, Mark): every fact about a
// numbered ship given to a contributor, worked out from the game's own data so
// the maker's email, the build certificate, the handover and the owner's manual
// all say the same thing and none of it is typed in. An edition is given, not
// sold (by invitation), so what she carries is the gift's fit-out
// (editionGiftSpec), not the edition's catalogue spec.

import { editionNo, type Edition } from '../content/editions';
import { systemAt } from '../galaxy/generate';
import { stationName } from '../galaxy/stationNames';
import { EQUIPMENT } from './commander';
import { editionGiftSpec, GLOWS, LUXURIES, PALETTE } from './shipyard';
import { PLAYER_LASERS } from './weapons';

export const SITE = 'https://witchspace.org.uk';

export interface Papers {
  editionId: string;
  /** "Witch-fire Edition". */
  edition: string;
  shipId: string;
  /** "Fer-de-lance". */
  ship: string;
  number: number;
  /** "001". */
  no: string;
  limit: number;
  /** "Orerve Nebula, with Witch-fire trim". */
  finish: string;
  /** "Blazing". */
  glow: string;
  /** For a list: "Beam lasers, front and rear", "Docking computer", … */
  fitted: string[];
  /** For a sentence: "beam lasers front and rear, a docking computer and a combat computer". */
  fittedLine: string;
  /** The edition's luxuries, with the game's own descriptions. */
  aboard: { name: string; blurb: string }[];
  /** For a sentence: "an owner’s suite, a name in gold leaf and a starlight cabin". */
  aboardLine: string;
  /** The yard where she waits: "Goddard Ring", and its system, "Onrira". */
  yard: string;
  system: string;
  colour: string;
  trim: string | null;
}

const colourName = (c: string | null) => PALETTE.find((p) => p.colour === c)?.name ?? 'the maker’s own';
/** "Docking Computer" → "Docking computer"; an initialism (E.C.M.) stays as it is. */
const sentenceCase = (s: string) => s.split(' ').map((w, i) => (i && /^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w)).join(' ');
/** The first letter small, unless it starts an initialism. */
const lower = (s: string) => (/^[A-Z][a-z’' -]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** "a, b and c". */
export const sentence = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** A thing in a sentence: "an owner’s suite", "a starlight cabin", "black-light running lights". */
const article = (name: string) => {
  const s = lower(name);
  if (/^(a|an) /.test(s) || /s$/.test(s)) return s;
  return `${/^[aeiouAEIOU]/.test(s) ? 'an' : 'a'} ${s}`;
};

/**
 * The papers for number `number` of an edition, waiting at (or built at) the yard in that
 * system. The hull's name is passed in: the game and the server read the ships differently.
 */
export function papersFor(e: Edition, number: number, ship: string, at = e.yard): Papers {
  const spec = editionGiftSpec(e);
  const front = PLAYER_LASERS[spec.laser].name;
  const lasers =
    spec.rear === spec.laser ? [`${front}s, front and rear`] : [`${front}, front`, ...(spec.rear ? [`${PLAYER_LASERS[spec.rear].name}, rear`] : [])];
  const kit = spec.upgrades.map((id) => sentenceCase(EQUIPMENT.find((q) => q.id === id)?.name ?? id));
  const aboard = spec.luxuries.map((id) => LUXURIES.find((l) => l.id === id)).filter((l) => l !== undefined).map((l) => ({ name: l.name, blurb: l.blurb }));
  const sys = systemAt(at.galaxy, at.system);
  return {
    editionId: e.id,
    edition: e.name,
    shipId: e.ship,
    ship,
    number,
    no: editionNo(number),
    limit: e.limit,
    finish: `${colourName(e.colour)}${e.trim ? `, with ${colourName(e.trim)} trim` : ''}`,
    glow: GLOWS[e.glow].name,
    fitted: [...lasers, ...kit],
    fittedLine: sentence([...lasers.map((l) => lower(l).replace(',', '')), ...kit.map(article)]),
    aboard,
    aboardLine: sentence(aboard.map((l) => article(l.name))),
    yard: stationName(sys).name,
    system: sys.name,
    colour: e.colour,
    trim: e.trim,
  };
}

/** Her certificate's private link: the token after the #, so it stays out of every server's logs. */
export const papersLink = (p: Pick<Papers, 'shipId' | 'editionId' | 'no'>, token: string) => `${SITE}/ships/${p.shipId}/${p.editionId}/${p.no}/#t=${token}`;
