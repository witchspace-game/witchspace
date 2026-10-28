import { editionNo } from '../content/editions';
import { controlRows, DOCKING, drawerHelp, PHONE } from '../game/controls';
import { SAVE_KEY } from '../game/saveKey';
import { fetchSave, refresh, signedIn } from '../net/account';
import { escapeHtml } from '../ui/escape';
import type { ManualData } from '../../tools/ships';
import { signInBox } from './signin';

// A ship's owner's manual (Mark: "they only get the owner's manual when they
// own the ship"). The page is built with the manual's words in it
// (tools/ships.ts manualPage); this shows them only if your save says she's
// yours: the save on this device first, then your cloud save if you're signed
// in (the site shares the game's origin, but not a Home Screen app's storage).
// The words are in the page's source, so this is a perk, not a lock. The
// controls and docking come from the game's own lists (src/game/controls.ts),
// so the manual here and the one in the game can't drift apart.

/** The little of a save the manual reads. */
interface Owner {
  ship?: string;
  paint?: { colour: string; name: string; luxuries: string[]; edition?: { id: string; number: number } };
  equipment?: string[];
  damaged?: string[];
  difficulty?: string;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const m = JSON.parse($('#manual-data').textContent!) as ManualData;
const hullOf = (c: Owner) => c.ship ?? 'cobra-mk3';

function localSave(): Owner | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as Owner) : null;
  } catch {
    return null;
  }
}

async function cloudSave(): Promise<Owner | null> {
  if (!signedIn()) return null;
  try {
    return (await fetchSave()).data as Owner | null;
  } catch {
    return null;
  }
}

function show(c: Owner) {
  const p = c.paint;
  const ed = p?.edition && m.editions[p.edition.id];
  $('#man-title').innerHTML = `${escapeHtml(m.name)}${p?.name ? ` <span>“${escapeHtml(p.name)}”</span>` : ''}${ed ? ` <small>${escapeHtml(ed)} ${editionNo(p!.edition!.number)}</small>` : ''}`;
  if (p) document.querySelector<HTMLElement>('.manual-page')!.style.setProperty('--hull', p.colour);
  const kit = (c.equipment ?? []).map((id) => m.kit[id]).filter(Boolean);
  const aboard = (p?.luxuries ?? []).map((id) => m.luxuries[id]).filter(Boolean);
  const list = (rows: string[][]) => `<dl class="man-keys">${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>`;
  // As the game does: gimballed lasers when the mount is fitted and working; Modern unless you chose Classic.
  const o = { gimballed: Boolean(c.equipment?.includes('gimbal-mount') && !c.damaged?.includes('gimbal-mount')), modern: c.difficulty !== 'classic' };
  const mouse = controlRows(true, o);
  const keys = controlRows(false, o);
  const all = [...mouse, ...keys];
  // Most keys work the same either way: list those once.
  const both = new Set(mouse.map((r) => r.join()).filter((r) => keys.some((k) => k.join() === r)));
  const drawer = m.drawer.map((b) => [b.label, drawerHelp(b.key, b.title, all)]);
  const man = $('#manual');
  man.innerHTML = `
    <nav class="man-toc"><a href="#man-ship">How she flies</a><a href="#man-dock">Docking</a><a href="#man-desk">On a computer</a><a href="#man-phone">On a phone</a>${kit.length ? '<a href="#man-kit">Your kit</a>' : ''}${aboard.length ? '<a href="#man-aboard">Aboard</a>' : ''}</nav>
    <section class="card" id="man-ship"><h3>How she flies</h3>
      ${m.notes.length ? `<ul>${m.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
      <table class="man-table"><thead><tr><th></th><th>${escapeHtml(m.name)}</th><th>${m.span ? 'against a Cobra' : ''}</th></tr></thead>
      <tbody>${m.handling.map(([label, value, versus]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td><td>${escapeHtml(versus)}</td></tr>`).join('')}</tbody></table>
    </section>
    <section class="card" id="man-dock"><h3>Docking</h3>
      <ol>${DOCKING(m.roll).map((step) => `<li>${step}</li>`).join('')}</ol>
      ${m.span ? `<p class="muted">${escapeHtml(m.name)}: ${escapeHtml(m.span)}.</p>` : ''}
    </section>
    <section class="card" id="man-desk"><h3>On a computer</h3>
      <p>Two ways to fly: <b>mouse and keyboard</b> (the ship follows the ring) or <b>keyboard only</b>, as in 1984. K switches between them, F1 shows the card in flight.</p>
      <h4>Mouse and keyboard</h4>${list(mouse.filter((r) => !both.has(r.join())))}
      <h4>Keyboard only</h4>${list(keys.filter((r) => !both.has(r.join())))}
      <h4>Both ways</h4>${list(mouse.filter((r) => both.has(r.join())))}
    </section>
    <section class="card" id="man-phone"><h3>On a phone</h3>
      ${list(PHONE)}
      <h4>The drawer: everything else</h4>
      <p>Tap the <b>‹</b> tab on the right edge of the screen to slide it open, and again to close it.</p>
      ${list(drawer)}
      <p class="muted">Tilt steers by tilting the phone, like a flight stick: tip the top towards you to climb. Invert swaps up and down, for dragging and tilting. Turn the phone on its side for the widest view.</p>
    </section>
    ${kit.length ? `<section class="card" id="man-kit"><h3>Your kit</h3>${list(kit)}</section>` : ''}
    ${aboard.length ? `<section class="card" id="man-aboard"><h3>Aboard</h3>${list(aboard)}</section>` : ''}`;
  // On a phone, the phone's controls come first.
  if (matchMedia('(pointer: coarse)').matches) {
    $('#man-desk').before($('#man-phone'));
    man.querySelector('.man-toc a[href="#man-desk"]')!.before(man.querySelector('.man-toc a[href="#man-phone"]')!);
  }
  man.hidden = false;
  $('#manual-gate').hidden = true;
}

function locked(why: string, signIn: boolean) {
  $('#manual-why').innerHTML = why;
  $('#account').hidden = !signIn;
  $('#manual-gate').hidden = false;
  $('#manual').hidden = true;
}

const NOT_YOURS = (flying: string) =>
  `Every ${escapeHtml(m.name)} comes with her manual: how she flies against a Cobra, how to dock her, and where every button is. You fly ${flying}: buy a ${escapeHtml(m.name)} at a shipyard and her manual is yours, here and in the game.`;

async function check() {
  const here = localSave();
  if (here && hullOf(here) === m.id) return show(here);
  if (!signedIn()) await refresh();
  const cloud = await cloudSave();
  if (cloud && hullOf(cloud) === m.id) return show(cloud);
  const known = cloud ?? here;
  if (known) return locked(NOT_YOURS(hullOf(known) === 'cobra-mk3' ? 'a Cobra' : 'another ship'), false);
  locked(`Every ${escapeHtml(m.name)} comes with her manual: how she flies against a Cobra, how to dock her, and where every button is. If she’s yours, sign in with your game account and it opens here.`, true);
  box.render();
}

const box = signInBox($('#account'), { why: 'Your save tells us which ship is yours.', callsignWhy: 'it’s how other pilots know you.' }, () => void check());
void check();
