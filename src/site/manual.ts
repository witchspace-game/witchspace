import { editionNo } from '../content/editions';
import { fetchSave, refresh, signedIn } from '../net/account';
import { escapeHtml } from '../ui/escape';
import type { ManualData } from '../../tools/ships';
import { signInBox } from './signin';

// A ship's owner's manual (Mark: "they only get the owner's manual when they
// own the ship"). The page is built with the manual's words in it
// (tools/ships.ts manualPage); this shows them only if your save says she's
// yours: the save on this device first, then your cloud save if you're signed
// in. The words are in the page's source, so this is a perk, not a lock.

/** The game's save on this device (src/game/commander.ts, KEY): the site shares the game's origin. */
const SAVE_KEY = 'witchspace.commander.v1';

/** The little of a save the manual reads. */
interface Owner {
  ship?: string;
  paint?: { colour: string; name: string; luxuries: string[]; edition?: { id: string; number: number } };
  equipment?: string[];
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
  const man = $('#manual');
  man.innerHTML = `
    <nav class="man-toc"><a href="#man-ship">How she flies</a>${kit.length ? '<a href="#man-kit">Your kit</a>' : ''}${aboard.length ? '<a href="#man-aboard">Aboard</a>' : ''}</nav>
    <section class="card" id="man-ship"><h3>How she flies</h3>
      ${m.notes.length ? `<ul>${m.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
      <table class="man-table"><thead><tr><th></th><th>${escapeHtml(m.name)}</th><th>${m.span ? 'against a Cobra' : ''}</th></tr></thead>
      <tbody>${m.handling.map(([label, value, versus]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td><td>${escapeHtml(versus)}</td></tr>`).join('')}</tbody></table>
    </section>
    ${kit.length ? `<section class="card" id="man-kit"><h3>Your kit</h3>${list(kit)}</section>` : ''}
    ${aboard.length ? `<section class="card" id="man-aboard"><h3>Aboard</h3>${list(aboard)}</section>` : ''}`;
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
