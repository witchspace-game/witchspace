import type { ShipDef } from '../content/types';
import { shipPage } from '../../tools/ships';
import { fromShip, shipFile } from './shipDraft';
import { shipFromHash, shipHash } from './shipLink';
import { viewer } from './viewer';

// The ship preview (/ship-preview/#ship=…): a ship file from a link, shown as
// its ship page would show it, before it's in the fleet. The file travels in
// the hash, so nothing reaches a server: a draft on a branch, or one from the
// ship editor, can be sent to a phone.

async function open() {
  const ship = await shipFromHash(location.hash);
  const empty = document.querySelector<HTMLElement>('#preview-empty')!;
  if (!ship) {
    empty.hidden = false;
    document.querySelector('#preview-why')!.innerHTML = location.hash
      ? 'This link doesn’t hold a ship we can read. It may have been cut short: copy all of it and try again.'
      : 'Open a ship’s preview link to see it here. The <a href="/ship-editor/">ship editor</a> makes one for your own design.';
    return;
  }
  empty.hidden = true;
  document.querySelector('#preview-ship')?.remove();
  const page = shipPage({ ...ship, id: ship.id || 'preview' }, new Map(), true);
  empty.insertAdjacentHTML('afterend', page.content.replace('<section class="section ship-page">', '<section class="section ship-page" id="preview-ship">'));
  document.title = `${ship.name} (preview) · Witchspace`;
  // Shared, it's this link: the ship has no page of its own yet.
  for (const b of document.querySelectorAll<HTMLElement>('[data-share]')) b.dataset.shareUrl = location.pathname + location.hash;

  const view = document.querySelector<HTMLElement>('#preview-ship .ship-view')!;
  try {
    viewer(view.querySelector<HTMLCanvasElement>('.ship-canvas')!).show(ship);
    view.classList.add('live');
  } catch {
    // No WebGL: the drawing stays.
  }

  // The editor makes ships from convex parts, so a hand-made file may change shape there.
  const kept = shipFile(fromShip(ship, 'improve')).geometry as ShipDef['geometry'];
  const lost = ship.geometry.vertices.length - kept.vertices.length;
  if (lost > 0) {
    const note = document.querySelector<HTMLElement>('#preview-editor-note')!;
    note.textContent = `The ship editor builds a ship from convex parts, so ${lost} of this one’s ${ship.geometry.vertices.length} points would change there. This page shows it exactly as drawn.`;
    note.hidden = false;
  }
  document.querySelector<HTMLAnchorElement>('#preview-edit')!.href = `/ship-editor/#${await shipHash(ship)}`;
  document.querySelector('#preview-download')!.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(ship, null, 2) + '\n'], { type: 'application/json' }));
    a.download = `${ship.id || 'ship'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

void open();
// A second link opened while the page is open (on a phone, it's the same tab).
addEventListener('hashchange', () => void open());
