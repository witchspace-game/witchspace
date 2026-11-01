// The home page's four careers as a deck of callsign cards (Mark: "cards that rotate with the front card being
// rotated with the smaller cards behind it"; brief by Marketing). Each card is the callsign card in small: the
// career's own scene, a Cobra in the career's colour, and "CMDR YOUR CALLSIGN". Pictures and a drawing, not
// live canvases, so the deck is light on a phone; src/site/careerDeck.ts turns it.

import { CAREERS } from '../src/site/callsignWords';
import { shipSvg, type ShipFile } from './ships';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function careerDeck(cobra: ShipFile): string {
  const cards = CAREERS.map(
    (c, i) => `<button type="button" class="deck-card" data-career="${c.id}" data-pos="${i}" style="--c: ${c.colour}; --scene: url('/callsign/${c.scenes[0]}.jpg')" aria-label="${esc(c.noun)}: the card a ${esc(c.noun.toLowerCase())} carries">
        <span class="deck-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 18 L12 9 L20 9 L28 18 L18 23 L14 23 Z M12 9 L14 23 M20 9 L18 23" /></svg>WITCHSPACE</span>
        ${shipSvg(cobra, 'deck-ship')}
        <span class="deck-copy"><span class="deck-cmdr">CMDR</span><span class="deck-name">Your callsign</span><span class="deck-sub">${esc(c.noun)} · Cobra Mk III</span></span>
      </button>`,
  ).join('\n      ');
  return `<div class="deck" id="career-deck" role="group" aria-label="The four careers: choose a card">
      ${cards}
    </div>`;
}
