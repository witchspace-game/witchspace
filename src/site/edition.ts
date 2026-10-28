import type { ShipDef } from '../content/types';
import type { Look } from '../render/shipModel';
import { editionCounts } from '../net/shipyard';
import { viewer } from './viewer';

// A numbered edition's page (tools/ships.ts editionPage): she turns in her
// own paint and glow, and the yard's office says how many the maker has
// signed over to contributors (they're given, not sold: Mark).

const view = document.querySelector<HTMLElement>('.edition-view')!;
const def = JSON.parse(document.querySelector('#ship-def')!.textContent!) as ShipDef;

try {
  viewer(view.querySelector<HTMLCanvasElement>('.ship-canvas')!).show(def, JSON.parse(view.dataset.look!) as Look);
  view.classList.add('live');
} catch {
  // No WebGL: the drawing stays.
}

void editionCounts()
  .then((counts) => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-edition-left]')) {
      const c = counts[el.dataset.editionLeft!];
      if (!c?.taken) continue;
      el.textContent = `${Math.min(c.taken, c.limit)} of ${c.limit}`;
      el.nextElementSibling!.textContent = 'signed over';
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-edition-count]')) {
      const c = counts[el.dataset.editionCount!];
      if (!c?.taken) continue;
      el.textContent = c.taken < c.limit ? `${c.taken} of ${c.limit} signed over` : `All ${c.limit} signed over`;
    }
  })
  .catch(() => {
    // The office isn't answering, or none is signed over yet: the page says how many will be built.
  });
