// What the flight recorder keeps, and the words that go with it
// (docs/design/flight-recorder.md). A moment is built from what the game
// knows (who died, where, what was in view), never from looking at the
// pictures, so its title, description and tags are true. The flight log, the
// death replay and (later) the channel agent all write from here.

export type MomentKind = 'death' | 'marshals' | 'legend' | 'discovery' | 'kill' | 'kept';

export interface MomentEvent {
  kind: MomentKind;
  /** One line about it: "Mamba destroyed · bounty 80 Cr". */
  text: string;
  /** For kills: the ship destroyed. For legends: which one. */
  subject?: string;
}

export interface MomentContext {
  callsign: string;
  system: string;
  galaxy: number; // 1..8
  /** "Anarchy", "Corporate State"... */
  government: string;
  rank: string;
  when: number;
}

/** The order a moment is named by when several happen in one clip: the most remarkable first. */
const WEIGHT: Record<MomentKind, number> = { death: 6, marshals: 5, legend: 4, discovery: 3, kill: 2, kept: 1 };

export function leadEvent(events: MomentEvent[]): MomentEvent {
  return [...events].sort((a, b) => WEIGHT[b.kind] - WEIGHT[a.kind])[0];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A short title, under 100 characters (YouTube's limit). */
export function momentTitle(events: MomentEvent[], ctx: MomentContext): string {
  const lead = leadEvent(events);
  const kills = events.filter((e) => e.kind === 'kill');
  const at = ` at ${ctx.system}`;
  let title: string;
  switch (lead.kind) {
    case 'death':
      title = kills.length ? `Took ${plural(kills.length, 'pirate')} with me${at}` : `How I died${at}`;
      break;
    case 'marshals':
      title = `The Marshals came for me${at}`;
      break;
    case 'legend':
      title = `${lead.subject ?? 'A Legend'}, running dark${at}`;
      break;
    case 'discovery':
      title = `Survey of ${lead.subject ?? ctx.system} complete`;
      break;
    case 'kill':
      title = kills.length > 1 ? `${plural(kills.length, 'kill')} in one fight${at}` : `${lead.subject ?? 'Pirate'} down${at}`;
      break;
    default:
      title = `From my flight recorder${at}`;
  }
  return `CMDR ${ctx.callsign}: ${title}`.slice(0, 100);
}

/** The description: what happened, where, and how to play. */
export function momentDescription(events: MomentEvent[], ctx: MomentContext): string {
  const lines = events.map((e) => `· ${e.text}`);
  const when = new Date(ctx.when).toISOString().slice(0, 16).replace('T', ' ');
  return [
    `Recovered from CMDR ${ctx.callsign}'s flight recorder, ${ctx.system} (galaxy ${ctx.galaxy}, ${ctx.government}), ${when} UTC.`,
    '',
    ...lines,
    '',
    `Rank: ${ctx.rank}.`,
    'Witchspace is a free, open-source space game in your browser, a love letter to Elite (1984). Play free: https://witchspace.org.uk/play',
  ].join('\n');
}

/** Tags: the game's, then what happened. */
export function momentTags(events: MomentEvent[], ctx: MomentContext): string[] {
  const tags = new Set(['witchspace', 'elite 1984', 'space game', 'flight recorder', 'browser game']);
  const kinds = new Set(events.map((e) => e.kind));
  if (kinds.has('kill') || kinds.has('death')) ['space combat', 'dogfight'].forEach((t) => tags.add(t));
  if (kinds.has('death')) tags.add('how i died');
  if (kinds.has('marshals')) ['co-operative marshals', 'capital ship'].forEach((t) => tags.add(t));
  if (kinds.has('legend')) ['legend', 'space pirate'].forEach((t) => tags.add(t));
  if (kinds.has('discovery')) ['exploration', 'first discovery'].forEach((t) => tags.add(t));
  for (const e of events) if (e.subject) tags.add(e.subject.toLowerCase());
  tags.add(ctx.system.toLowerCase());
  return [...tags];
}
