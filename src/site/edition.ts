import type { ShipDef } from '../content/types';
import type { Look } from '../render/shipModel';
import { editionCounts } from '../net/shipyard';
import { viewer } from './viewer';

// A numbered edition's page (tools/ships.ts editionPage): she turns in her
// own paint and glow, and the yard's office says how many are left.

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
      if (!c) continue;
      const left = Math.max(0, c.limit - c.taken);
      el.textContent = left ? `${left} of ${c.limit}` : `All ${c.limit}`;
      el.nextElementSibling!.textContent = left ? 'left, numbered' : 'spoken for';
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-edition-count]')) {
      const c = counts[el.dataset.editionCount!];
      if (!c) continue;
      const left = Math.max(0, c.limit - c.taken);
      el.textContent = left ? `${left} of ${c.limit} left` : `All ${c.limit} spoken for`;
    }
  })
  .catch(() => {
    // The office isn't answering: the page says how many will be built.
  });
