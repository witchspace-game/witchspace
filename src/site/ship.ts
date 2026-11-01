import type { ShipDef } from '../content/types';
import { API as SPACE } from '../net/account';
import { escapeHtml } from '../ui/escape';
import { onPaper } from './ink';
import { viewer, type Viewer } from './viewer';

// A ship's page: the ship turning in neo-vector (drag to turn it), and the
// ideas board's suggestions that mention it. The page itself is built from
// the ship's file (tools/ships.ts); this only brings it to life.

const view = document.querySelector<HTMLElement>('.ship-view')!;
const canvas = view.querySelector<HTMLCanvasElement>('.ship-canvas')!;
const def = JSON.parse(document.querySelector('#ship-def')!.textContent!) as ShipDef;

try {
  const v = viewer(canvas, { ink: true });
  v.show(def);
  view.classList.add('live'); // the drawing gives way to the live model
  if (onPaper()) lightSwitch(v);
} catch {
  // No WebGL: the drawing stays.
}

// On paper she's first a drawing, as in her manual; a moment after she's in view she catches light and
// flies, and the switch takes her back to the drawing and out again.
function lightSwitch(v: Viewer) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ship-light';
  view.append(button);
  const set = (on: boolean) => {
    v.light(on);
    view.classList.toggle('lit', on);
    button.textContent = on ? 'The drawing' : 'Light her up';
    button.setAttribute('aria-pressed', String(on));
  };
  set(false);
  button.addEventListener('click', () => set(!view.classList.contains('lit')));
  const seen = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    seen.disconnect();
    setTimeout(() => set(true), 1600);
  }, { threshold: 0.6 });
  seen.observe(view);
}

// --- Its special editions: how many are left, from the server ---------------------------------

const counts = document.querySelectorAll<HTMLElement>('.edition-count[data-edition]');
if (counts.length)
  void (async () => {
    try {
      const res = await fetch(`${SPACE}/shipyard/editions`);
      const { editions } = (await res.json()) as { editions: { id: string; limit: number; taken: number }[] };
      for (const el of counts) {
        const e = editions.find((x) => x.id === el.dataset.edition);
        if (!e) continue;
        // Signed over to contributors, not sold: how many the maker has given (Mark).
        const given = Math.min(e.taken, e.limit);
        if (!given) continue;
        el.innerHTML = given < e.limit ? `<b>${given} of ${e.limit} signed over.</b> Numbered 001 to ${String(e.limit).padStart(3, '0')}, each painted beside its name.` : `<b>All ${e.limit} signed over.</b> Every one numbered, and every one given.`;
        el.classList.toggle('gone', given >= e.limit);
      }
    } catch {
      // The numbers stay as built: no count, nothing wrong.
    }
  })();

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
