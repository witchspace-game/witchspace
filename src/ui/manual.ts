// The owner's manual and the controls card (moved from main.ts). Both read the controls from the
// game's own lists (ui/controls.ts), so neither can drift from the buttons.

import { shipById } from '../content/ships';
import type { ShipDef } from '../content/types';
import { EQUIPMENT, isWorking, hullOf } from '../game/commander';
import { controlScheme, isTouch } from '../game/input';
import { editionById, editionNo } from '../content/editions';
import { papersFor } from '../game/papers';
import { papersLinkFor } from '../net/shipyard';
import { standardKit, LUXURIES } from '../game/shipyard';
import { MAX_ROLL_ERROR } from '../game/station';
import { handling, notesFor } from '../game/manual';
import { controlRows as sharedControlRows, DASHBOARD, DOCKING, drawerHelp, PHONE, PHONE_DRAWER, RECORDER, SCHEMES, TILT } from '../game/controls';
import { forDevice } from './deviceWords';
import { flash } from './hud';
import { escapeHtml } from './escape';
import { $, cmdr, game } from '../core';
import SHOTS from '../content/manualShots.json';
import * as THREE from 'three';

/** From main.ts: whether the laser is gimballed right now (it fills this in at start). */
let gimballed = () => false;
export function initManual(hooks: { gimballed: () => boolean }) {
  gimballed = hooks.gimballed;
}

const KEYS_HINT = {
  mouse: 'Mouse aim · Click fire · W/S throttle · A/D roll · T arm missile · X fire it · G map · H hyperspace · J jump · C docking computer · P photo · F1 controls',
  keyboard: 'W/S pitch · A/D roll · Space/Shift throttle · F fire · T arm missile · X fire it · G map · H hyperspace · J jump · C docking · P photo · F1 controls',
};

/** Every control, as key and what it does: the controls card and the owner's manual both read this. */
export function controlRows(mouse: boolean): string[][] {
  return sharedControlRows(mouse, { gimballed: gimballed() || Boolean(game.commander && isWorking(cmdr(), 'gimbal-mount')), modern: game.commander?.difficulty === 'modern' });
}

// --- The owner's manual ---------------------------------------------------------
// Every ship comes with one (Mark: "that's how owners find where the buttons are,
// how Tilt works and Invert, and it will help them dock early on"). The controls
// are read from the game's own lists, so the manual can't drift from the buttons.

/** What a phone button does: from the key it presses (the controls list), or its own title. */
const touchHelp = (b: HTMLElement, rows: string[][]) => drawerHelp(b.dataset.key, b.title || b.getAttribute('aria-label') || '', rows);

// --- Pictures (Mark: "the owners manuals have no images!") ---------------------------------
// Taken from the game on a phone by tools/manual-shots.mjs, which also measures where each control
// is, so the numbers sit on the controls. The numbers follow the manual's own lists (PHONE and
// DASHBOARD), and each list row carries its number.

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
    <path d="M40 92 L70 22" stroke-width="7" stroke="var(--dim)" />
    <path d="M28 88 L58 18" stroke-dasharray="3 5" stroke="var(--dim)" />
    <path d="M86 30 C 92 14, 80 6, 66 8" stroke="var(--accent)" /><path d="M72 3 L66 8 L72 13" stroke="var(--accent)" />
    <path d="M150 74 L230 74 L190 92 Z" stroke="var(--accent)" transform="rotate(-18 190 80)" />
    <path d="M192 52 L208 22" stroke="var(--accent)" /><path d="M199 24 L208 22 L211 31" stroke="var(--accent)" />
  </g>
  <text x="18" y="108" fill="var(--dim)" font-size="11">the top, towards you</text>
  <text x="166" y="108" fill="var(--dim)" font-size="11">she climbs</text>
</svg>`;

/** Her outline from above beside a Cobra's, to scale (Marketing: "explains the Fer-de-lance's 'line up early for the slot'"). */
function besideACobra(def: ShipDef, cobra: ShipDef) {
  const PX = 0.9; // pixels a metre
  const top = (d: ShipDef) => {
    const v = d.geometry.vertices;
    const xs = v.map((p) => p[0]);
    const zs = v.map((p) => p[2]);
    const [x0, z1] = [Math.min(...xs), Math.max(...zs)];
    const at = (p: number[]) => `${((p[0] - x0) * PX).toFixed(1)},${((z1 - p[2]) * PX).toFixed(1)}`;
    return { w: (Math.max(...xs) - x0) * PX, h: (z1 - Math.min(...zs)) * PX, path: d.geometry.faces.map((f) => `M${f.map((i) => at(v[i])).join('L')}Z`).join('') };
  };
  const [a, b] = [top(def), top(cobra)];
  const gap = 28;
  const h = Math.max(a.h, b.h);
  const w = a.w + gap + b.w;
  const ship = (t: typeof a, x: number, colour: string, name: string) =>
    `<g transform="translate(${x.toFixed(1)} ${(h - t.h).toFixed(1)})"><path d="${t.path}" fill="none" stroke="${colour}" stroke-width="1" stroke-linejoin="round" /></g><text x="${(x + t.w / 2).toFixed(1)}" y="${(h + 16).toFixed(1)}" text-anchor="middle" fill="var(--dim)" font-size="11">${escapeHtml(name)}</text>`;
  return `<svg class="man-draw" viewBox="-4 -4 ${(w + 8).toFixed(0)} ${(h + 26).toFixed(0)}" style="max-width:${Math.round(w + 8)}px" role="img" aria-label="${escapeHtml(def.name)} beside a Cobra Mk III, from above, to scale">
    ${ship(a, 0, def.style.lineColor, def.name)}${ship(b, a.w + gap, 'var(--dim)', cobra.name)}
  </svg>`;
}

/** "Twice the length", said from her Length row against a Cobra's. */
function lengthWords(def: ShipDef, cobra: ShipDef) {
  const len = (d: ShipDef) => Math.max(...d.geometry.vertices.map((v) => v[2])) - Math.min(...d.geometry.vertices.map((v) => v[2]));
  const r = len(def) / len(cobra);
  if (r > 1.85 && r < 2.15) return 'twice the length';
  if (r >= 1.15) return `${r.toFixed(1)} times the length`;
  if (r <= 0.87) return `${Math.round(r * 100)}% of the length`;
  return 'about the same length';
}

export function openManual(def: ShipDef) {
  const c = game.commander;
  const mine = c && def.id === hullOf(c);
  const cobra = shipById('cobra-mk3')!;
  const ed = mine && c!.paint?.edition ? editionById(c!.paint.edition.id) : undefined;
  const title = `${def.name}${mine && c!.paint?.name ? ` “${c!.paint.name}”` : ''}${ed ? ` · ${ed.name} ${editionNo(c!.paint!.edition!.number)}` : ''}`;
  const rows = (m: boolean) => controlRows(m).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const all = [...controlRows(true), ...controlRows(false)];
  const label = (b: HTMLElement) => escapeHtml(b.textContent?.trim() || b.getAttribute('aria-label') || '');
  // Said for a phone: each button's own words, or the keyboard list's with its keys taken out.
  const drawer = [...document.querySelectorAll<HTMLElement>('#touch .touch-actions button')]
    .map((b) => `<dt>${label(b)}</dt><dd>${escapeHtml(PHONE_DRAWER[b.dataset.key ?? ''] ?? touchHelp(b, all).replace(/\s*\((?:[A-Z0-9]|[A-Z0-9] again[^)]*)\)/g, ''))}</dd>`)
    .join('');
  const notes = notesFor(def);
  const kit = mine ? c!.equipment.map((id) => EQUIPMENT.find((e) => e.id === id)).filter(Boolean) : [];
  const roll = Math.round(THREE.MathUtils.radToDeg(MAX_ROLL_ERROR));
  // An edition's owner gets a manual made theirs: her own cover, and her edition's page (the edition delivery pack).
  const papers = ed ? papersFor(ed, c!.paint!.edition!.number, def.name) : null;
  const cover = papers
    ? `<section class="man-cover man-edition-cover" style="--hull:${c!.paint!.colour}">
      <p class="meta">${escapeHtml(def.manufacturer ?? 'Witchspace')} · ${escapeHtml(papers.edition)} ${papers.no}</p>
      <h3>${c!.paint!.name ? `“${escapeHtml(c!.paint!.name)}”` : escapeHtml(`${papers.edition} ${papers.no}`)}</h3>
      <p>The owner’s manual, prepared for Commander ${escapeHtml(c!.name)}</p>
    </section>`
    : `<section class="man-cover" style="--hull:${mine && c!.paint ? c!.paint.colour : def.style.lineColor}">
      <p class="meta">${escapeHtml(def.concept ? 'Concept' : def.manufacturer ?? 'Witchspace')} · ${escapeHtml(def.role)}</p>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(def.description)}</p>
    </section>`;
  const yours = papers
    ? `<section id="man-edition"><h3>Your edition</h3>
      <dl class="man-keys">
        <dt>Finish</dt><dd>${escapeHtml(papers.finish)}</dd>
        <dt>Glow</dt><dd>${escapeHtml(papers.glow)}</dd>
${papers.aboard.map((a) => `        <dt>${escapeHtml(a.name)}</dt><dd>${escapeHtml(a.blurb)}</dd>
`).join('')}      </dl>
      <p class="man-papers meta">One of ${papers.limit}, built at ${escapeHtml(papers.yard)}, ${escapeHtml(papers.system)}.</p>
    </section>`
    : '';
  // On a phone its own controls come first, and the keyboard's fold away (Mark).
  const desk = `<section id="man-desk"><h3>On a computer</h3>
      <p>${SCHEMES}</p>
      <h4>Mouse and keyboard</h4><dl class="man-keys">${rows(true)}</dl>
      <h4>Keyboard only</h4><dl class="man-keys">${rows(false)}</dl>
    </section>`;
  $('#manual-body').innerHTML = `
    ${cover}
    <nav class="man-toc">${papers ? '<a href="#man-edition">Your edition</a>' : ''}<a href="#man-ship">How she flies</a><a href="#man-dash">The dashboard</a><a href="#man-dock">Docking</a>${isTouch ? '<a href="#man-phone">On your phone</a>' : '<a href="#man-desk">On a computer</a><a href="#man-phone">On a phone</a>'}<a href="#man-rec">The flight recorder</a>${kit.length ? '<a href="#man-kit">Your kit</a>' : ''}</nav>
    ${yours}

    <section id="man-ship"><h3>How she flies</h3>
      ${notes.length ? `<ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
      <table class="man-table"><tr><th></th><th>${escapeHtml(def.name)}</th>${def.id === 'cobra-mk3' ? '' : '<th>against a Cobra</th>'}</tr>
      ${handling(def, cobra).map((h) => `<tr><td>${h.label}</td><td>${h.value}</td>${def.id === 'cobra-mk3' ? '' : `<td>${h.versus}</td>`}</tr>`).join('')}</table>
    </section>

    <section id="man-dash"><h3>The dashboard</h3>
      ${figure(['dashboard'], 'Everything she can tell you, at a glance. Shields and hull on the left, speed and heat on the right, the scanner in the middle.')}
      <dl class="man-keys">${DASHBOARD.map(([k, v]) => `<dt>${numbered('dashboard', k)}</dt><dd>${v}</dd>`).join('')}</dl>
      ${figure(['scanner'], `You’re at the centre, facing up. A stalk up means it’s above you, down means below. Diamonds are commanders; bars are ships the game flies; red has just fired on you. ${isTouch ? 'Tap the scanner' : 'Press R'} to switch between 4 km and 12 km.`, 'man-small')}
      ${figure(['compass-ahead', 'compass-behind'], 'Solid: the station is ahead. Hollow: it’s behind you.', 'man-tiny')}
    </section>

    <section id="man-dock"><h3>Docking</h3>
      <ol>
${DOCKING(roll, standardKit(def).includes('docking-computer')).map((li) => `        <li>${li}</li>
`).join('')}      </ol>
      ${figure(['approach'], 'Slow down, line up, roll until the marker’s centred, and fly straight in. Green is good.')}
      ${
        def.id !== 'cobra-mk3'
          ? `<figure class="man-fig">${besideACobra(def, cobra)}<figcaption>The ${escapeHtml(def.name)} beside a Cobra, from above: ${lengthWords(def, cobra)}, ${escapeHtml(handling(def, cobra).find((h) => h.label === 'Span')!.versus)}.</figcaption></figure>`
          : ''
      }
    </section>

    ${isTouch ? '' : desk}

    <section id="man-phone"><h3>${isTouch ? 'On your phone' : 'On a phone'}</h3>
      ${figure(['flight'], 'Aim on the left, fight on the right. The big button always offers the obvious next thing.')}
      <dl class="man-keys">
${PHONE.map(([k, v]) => `        <dt>${numbered('flight', k)}</dt><dd>${v}</dd>
`).join('')}      </dl>
      ${figure(['speed'], 'The tick is the speed you asked for; the fill is the speed you’re doing.', 'man-tiny')}
      ${figure(['views-picker', 'views-glance'], 'Tap the arrow to choose a view. Hold and slide to glance, and let go to look ahead again. Your lasers fire the way you’re looking, if one is fitted there.', 'man-two')}
      <h4>The drawer: everything else</h4>
      <p>Tap the <b>‹</b> tab on the right edge of the screen to slide it open, and again to close it.</p>
      ${figure(['drawer'], 'Everything that isn’t the fight. Tap ‹ to open it, and again to close.')}
      <dl class="man-keys">${drawer}</dl>
      <figure class="man-fig">${TILT_DRAWING}<figcaption>${TILT}</figcaption></figure>
    </section>
    ${isTouch ? `<details class="man-more"><summary>On a computer, with a keyboard</summary>${desk}</details>` : ''}

    <section id="man-rec"><h3>The flight recorder</h3>${RECORDER.map((p) => `<p>${p}</p>`).join('')}
      ${figure(['moments'], 'The best first. Share it, star it to keep it forever, or swipe it away.', 'man-upright')}
    </section>

    ${kit.length ? `<section id="man-kit"><h3>Your kit</h3><dl class="man-keys">${kit.map((e) => `<dt>${escapeHtml(e!.name)}</dt><dd>${escapeHtml(forDevice(e!.blurb))}</dd>`).join('')}</dl></section>` : ''}
    ${mine && c!.paint?.luxuries?.length ? `<section><h3>Aboard</h3><ul>${c!.paint.luxuries.map((l) => LUXURIES.find((x) => x.id === l)).filter(Boolean).map((l) => `<li><b>${escapeHtml(l!.name)}</b>: ${escapeHtml(l!.blurb)}</li>`).join('')}</ul></section>` : ''}`;
  if (papers)
    void papersLinkFor(papers.editionId, papers.number).then((link) => {
      const line = $('#manual-body').querySelector('.man-papers');
      if (link && line) line.insertAdjacentHTML('beforeend', ` <a href="${escapeHtml(link)}" target="_blank" rel="noopener">Her certificate of build</a> (a private link: share it only if you want to).`);
    });
  $('#manual').hidden = false;
  $('#manual').scrollTop = 0;
}
$('#manual .manual-close').addEventListener('click', () => ($('#manual').hidden = true));
$('#manual').addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('.man-toc a');
  if (!a) return;
  e.preventDefault();
  $('#manual').querySelector(a.getAttribute('href')!)?.scrollIntoView({ behavior: 'smooth' });
});

export function renderControlsCard() {
  const mouse = controlScheme() === 'mouse';
  $('#keys-hint').textContent = KEYS_HINT[controlScheme()];
  $('#controls-scheme').textContent = mouse ? 'Mouse + keyboard' : 'Keyboard only (classic)';
  $('#controls-list').innerHTML = controlRows(mouse)
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join('');
}

export function toggleControlsCard(show = $('#controls-card').hidden) {
  renderControlsCard();
  $('#controls-card').hidden = !show;
}

/** First flight: a nudge towards the controls card, rather than opening it over the view. */
export function showControlsCardOnce() {
  renderControlsCard();
  if (isTouch) return; // touch has its own on-screen controls
  try {
    if (localStorage.getItem('witchspace.seenControls')) return;
    localStorage.setItem('witchspace.seenControls', '1');
  } catch {
    // Storage blocked: a nudge every launch is harmless.
  }
  setTimeout(() => game.state === 'flying' && flash('Press F1 for the controls', 4), 1500);
}
