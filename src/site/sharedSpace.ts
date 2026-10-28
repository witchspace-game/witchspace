import cobra from '../../content/ships/cobra-mk3.json';
import type { ShipDef } from '../content/types';
import { API } from '../net/account';
import { flyingLine, parseFeed, type FirstEvent } from './feed';
import { viewer } from './viewer';

// The shared space page: another commander's Cobra turning in their own paint,
// with the tag and the scanner diamond the game gives them. If the feed answers,
// the tag carries a real callsign from the last two days, and the hero says how
// many are flying now.

const view = document.querySelector<HTMLElement>('.shared-view');
if (view)
  try {
    // Somebody's Cobra: Diso Amber, as a commander might have had her painted.
    viewer(view.querySelector<HTMLCanvasElement>('.ship-canvas')!).show(cobra as unknown as ShipDef, { colour: '#ffb347', glow: 1, trim: null });
    view.classList.add('live');
  } catch {
    // No WebGL: the tag and the scanner tell the story.
  }

void (async () => {
  try {
    const res = await fetch(`${API}/feed`, { cache: 'no-cache' });
    const feed = parseFeed(await res.json());
    const callsign = (feed.events.find((e) => e.kind === 'first') as FirstEvent | undefined)?.callsign;
    // A real commander's callsign, without a rank: we don't know theirs.
    if (callsign) document.querySelector('#shared-tag')!.textContent = `CMDR ${callsign} · 0.8 km`;
    const line = flyingLine(feed.flying);
    const live = document.querySelector<HTMLElement>('#shared-live')!;
    if (line) {
      live.textContent = `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
      live.hidden = false;
    }
  } catch {
    // The feed isn't answering: the page stands without it.
  }
})();
