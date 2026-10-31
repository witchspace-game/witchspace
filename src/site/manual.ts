import { editionById, editionNo } from '../content/editions';
import { controlRows, DASHBOARD, DOCKING, drawerHelp, PHONE, PHONE_DRAWER, RECORDER, SCHEMES, TILT } from '../game/controls';
import { papersFor } from '../game/papers';
import { SAVE_KEY } from '../game/saveKey';
import { fetchSave, refresh, signedIn } from '../net/account';
import { heldEditions } from '../net/shipyard';
import { forDevice } from '../ui/deviceWords';
import { escapeHtml } from '../ui/escape';
import type { ManualData } from '../../tools/ships';
import { signInBox } from './signin';
import SHOTS from '../content/manualShots.json';

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

// The pictures, as the game's manual shows them (src/ui/manual.ts): pictures from the game (public/manual/) with
// numbered callouts, whose numbers match the dashboard's and the phone's lists.
type Shot = { w: number; h: number; callouts?: { label: string; x: number; y: number }[] };
const shots = SHOTS as Record<string, Shot>;

/** One or more pictures from the game under one caption, with numbered callouts. */
function figure(names: string[], caption: string, cls = '') {
  const shot = (name: string) => {
    const s = shots[name];
    if (!s) return '';
    const marks = (s.callouts ?? []).map((c, i) => `<b style="left:${c.x}%;top:${c.y}%">${i + 1}</b>`).join('');
    return `<div class="man-shot"><img src="/manual/${name}.jpg" width="${s.w}" height="${s.h}" loading="lazy" alt="" />${marks}</div>`;
  };
  return `<figure class="man-fig ${cls}"><div class="man-shots">${names.map(shot).join('')}</div><figcaption>${caption}</figcaption></figure>`;
}

/** A list row's callout number on a picture, as a badge for its <dt>. */
function numbered(name: string, label: string) {
  const i = shots[name]?.callouts?.findIndex((c) => c.label === label) ?? -1;
  return i < 0 ? label : `<b class="man-num">${i + 1}</b>${label}`;
}

/** Tilt, drawn: a phone on its side, its top edge tipping towards you, and the ship climbing. */
const TILT_DRAWING = `<svg class="man-draw" viewBox="0 0 260 110" role="img" aria-label="Tip the top of the phone towards you, and she climbs">
  <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 92 L70 22" stroke-width="7" stroke="var(--muted)" />
    <path d="M28 88 L58 18" stroke-dasharray="3 5" stroke="var(--muted)" />
    <path d="M86 30 C 92 14, 80 6, 66 8" stroke="var(--accent)" /><path d="M72 3 L66 8 L72 13" stroke="var(--accent)" />
    <path d="M150 74 L230 74 L190 92 Z" stroke="var(--accent)" transform="rotate(-18 190 80)" />
    <path d="M192 52 L208 22" stroke="var(--accent)" /><path d="M199 24 L208 22 L211 31" stroke="var(--accent)" />
  </g>
  <text x="18" y="108" fill="var(--muted)" font-size="11">the top, towards you</text>
  <text x="166" y="108" fill="var(--muted)" font-size="11">she climbs</text>
</svg>`;
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
  const kit = (c.equipment ?? []).map((id) => m.kit[id]).filter(Boolean).map(([name, blurb]) => [name, forDevice(blurb)]);
  const aboard = (p?.luxuries ?? []).map((id) => m.luxuries[id]).filter(Boolean);
  const list = (rows: string[][]) => `<dl class="man-keys">${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>`;
  // The game's own lists carry a little markup (<b>), as the game shows them; a picture's numbers go beside its rows.
  const html = (rows: string[][], shot?: string) => `<dl class="man-keys">${rows.map(([k, v]) => `<dt>${shot ? numbered(shot, k) : k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  // As the game does: gimballed lasers when the mount is fitted and working; Modern unless you chose Classic.
  const o = { gimballed: Boolean(c.equipment?.includes('gimbal-mount') && !c.damaged?.includes('gimbal-mount')), modern: c.difficulty !== 'classic' };
  const mouse = controlRows(true, o);
  const keys = controlRows(false, o);
  const all = [...mouse, ...keys];
  // Most keys work the same either way: list those once.
  const both = new Set(mouse.map((r) => r.join()).filter((r) => keys.some((k) => k.join() === r)));
  // Said for a phone, as the game says it: each button's own words, or the keyboard list's with its keys taken out.
  const drawer = m.drawer.map((b) => [b.label, PHONE_DRAWER[b.key ?? ''] ?? drawerHelp(b.key, b.title, all).replace(/\s*\((?:[A-Z0-9]|[A-Z0-9] again[^)]*)\)/g, '')]);
  // An edition's owner gets her edition's page, from the game's own papers (src/game/papers.ts).
  const edition = p?.edition && editionById(p.edition.id);
  const papers = edition ? papersFor(edition, p!.edition!.number, m.name) : null;
  // On a phone its own controls come first, and the keyboard's fold away (Mark), as in the game.
  const touch = matchMedia('(pointer: coarse)').matches;
  const desk = `<section class="card" id="man-desk"><h3>On a computer</h3>
      <p>${SCHEMES}</p>
      <h4>Mouse and keyboard</h4>${list(mouse.filter((r) => !both.has(r.join())))}
      <h4>Keyboard only</h4>${list(keys.filter((r) => !both.has(r.join())))}
      <h4>Both ways</h4>${list(mouse.filter((r) => both.has(r.join())))}
    </section>`;
  const man = $('#manual');
  man.innerHTML = `
    <nav class="man-toc">${papers ? '<a href="#man-edition">Your edition</a>' : ''}<a href="#man-ship">How she flies</a><a href="#man-dash">The dashboard</a><a href="#man-dock">Docking</a>${touch ? '<a href="#man-phone">On your phone</a>' : '<a href="#man-desk">On a computer</a><a href="#man-phone">On a phone</a>'}<a href="#man-rec">The flight recorder</a>${kit.length ? '<a href="#man-kit">Your kit</a>' : ''}${aboard.length ? '<a href="#man-aboard">Aboard</a>' : ''}</nav>
    ${
      papers
        ? `<section class="card" id="man-edition"><h3>Your edition</h3>
      ${list([['Finish', papers.finish], ['Glow', papers.glow], ...papers.aboard.map((a) => [a.name, a.blurb])])}
      <p class="muted man-papers">One of ${papers.limit}, built at ${escapeHtml(papers.yard)}, ${escapeHtml(papers.system)}.</p>
    </section>`
        : ''
    }
    <section class="card" id="man-ship"><h3>How she flies</h3>
      ${m.notes.length ? `<ul>${m.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
      <table class="man-table"><thead><tr><th></th><th>${escapeHtml(m.name)}</th>${m.span ? '<th>against a Cobra</th>' : ''}</tr></thead>
      <tbody>${m.handling.map(([label, value, versus]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td>${m.span ? `<td>${escapeHtml(versus)}</td>` : ''}</tr>`).join('')}</tbody></table>
    </section>
    <section class="card" id="man-dash"><h3>The dashboard</h3>
      ${figure(['dashboard'], 'Everything she can tell you, at a glance. Shields and hull on the left, speed and heat on the right, the scanner in the middle.')}
      ${html(DASHBOARD, 'dashboard')}
      ${figure(['scanner'], `You’re at the centre, facing up. A stalk up means it’s above you, down means below. Diamonds are commanders; bars are ships the game flies; red has just fired on you. ${touch ? 'Tap the scanner' : 'Press R'} to switch between 4 km and 12 km.`, 'man-small')}
      ${figure(['compass-ahead', 'compass-behind'], 'Solid: the station is ahead. Hollow: it’s behind you.', 'man-tiny')}
    </section>
    <section class="card" id="man-dock"><h3>Docking</h3>
      <ol>${DOCKING(m.roll, m.dockingFitted).map((step) => `<li>${step}</li>`).join('')}</ol>
      ${figure(['approach'], 'Slow down, line up, roll until the marker’s centred, and fly straight in. Green is good.')}
      ${m.beside ? `<figure class="man-fig">${m.beside}<figcaption>The ${escapeHtml(m.name)} beside a Cobra, from above: ${escapeHtml(m.length)}, ${escapeHtml(m.span)}.</figcaption></figure>` : ''}
    </section>
    ${touch ? '' : desk}
    <section class="card" id="man-phone"><h3>${touch ? 'On your phone' : 'On a phone'}</h3>
      ${figure(['flight'], 'Aim on the left, fight on the right. The big button always offers the obvious next thing.')}
      ${html(PHONE, 'flight')}
      ${figure(['speed'], 'The tick is the speed you asked for; the fill is the speed you’re doing.', 'man-tiny')}
      ${figure(['views-picker', 'views-glance'], 'Tap the arrow to choose a view. Hold and slide to glance, and let go to look ahead again. Your lasers fire the way you’re looking, if one is fitted there.', 'man-two')}
      <h4>The drawer: everything else</h4>
      <p>Tap the <b>‹</b> tab on the right edge of the screen to slide it open, and again to close it.</p>
      ${figure(['drawer'], 'Everything that isn’t the fight. Tap ‹ to open it, and again to close.')}
      ${list(drawer)}
      <figure class="man-fig">${TILT_DRAWING}<figcaption>${TILT}</figcaption></figure>
    </section>
    ${touch ? `<details class="card man-more"><summary>On a computer, with a keyboard</summary>${desk}</details>` : ''}
    <section class="card" id="man-rec"><h3>The flight recorder</h3>${RECORDER.map((r) => `<p>${r}</p>`).join('')}
      ${figure(['moments'], 'The best first. Share it, star it to keep it forever, or swipe it away.', 'man-upright')}
    </section>
    ${kit.length ? `<section class="card" id="man-kit"><h3>Your kit</h3>${list(kit)}</section>` : ''}
    ${aboard.length ? `<section class="card" id="man-aboard"><h3>Aboard</h3>${list(aboard)}</section>` : ''}`;
  // Her certificate of build, for her owner when signed in: a private link, from the yard's office.
  if (papers && signedIn())
    void heldEditions().then((r) => {
      const link = 'error' in r ? null : r.editions.find((e) => e.edition === papers.editionId && e.number === papers.number)?.link;
      const line = man.querySelector('.man-papers');
      if (link && line) line.insertAdjacentHTML('beforeend', ` <a href="${escapeHtml(link)}">Her certificate of build</a> (a private link: share it only if you want to).`);
    });
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
