import type { ShipDef } from '../content/types';
import { escapeHtml } from '../ui/escape';
import { viewer } from './viewer';

// A ship's page: the ship turning in neo-vector (drag to turn it), and the
// ideas board's suggestions that mention it. The page itself is built from
// the ship's file (tools/ships.ts); this only brings it to life.

const view = document.querySelector<HTMLElement>('.ship-view')!;
const canvas = view.querySelector<HTMLCanvasElement>('.ship-canvas')!;
const def = JSON.parse(document.querySelector('#ship-def')!.textContent!) as ShipDef;

try {
  viewer(canvas).show(def);
  view.classList.add('live'); // the drawing gives way to the live model
} catch {
  // No WebGL: the drawing stays.
}

// --- Ideas about this ship ----------------------------------------------------------

const API = import.meta.env.DEV ? 'http://127.0.0.1:8787/ideas' : 'https://space.witchspace.org.uk/ideas';
const list = document.querySelector<HTMLUListElement>('.ship-ideas')!;
const name = list.dataset.shipName!;

void (async () => {
  try {
    const res = await fetch(`${API}?sort=top`);
    const { ideas } = (await res.json()) as { ideas: { id: string; title: string; body: string; up: number; down: number; status: string }[] };
    const about = ideas.filter((i) => `${i.title} ${i.body}`.toLowerCase().includes(name.toLowerCase())).slice(0, 5);
    list.innerHTML = about.length
      ? about
          .map((i) => `<li><a href="/ideas/#idea-${escapeHtml(i.id)}">${escapeHtml(i.title)}</a> <span class="muted">${i.up - i.down >= 0 ? '+' : ''}${i.up - i.down}${i.status !== 'open' ? ` · ${escapeHtml(i.status)}` : ''}</span></li>`)
          .join('')
      : `<li class="muted">No ideas about the ${escapeHtml(name)} yet. Be the first.</li>`;
  } catch {
    list.innerHTML = '<li class="muted">The ideas board isn’t answering just now.</li>';
  }
})();
