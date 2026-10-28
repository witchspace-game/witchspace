import { SLOT, slotProblem } from '../content/slot';
import type { ShipDef, Vec3 } from '../content/types';
import { API } from '../net/account';
import { escapeHtml } from '../ui/escape';
import { blueprint, blueprintSvg, VIEWS, type Handle, type Scene } from './blueprint';
import { convexHull, mirrorX, partBodies, type Mirror, type Part } from './hull';
import { blank, extent, fromShip, MAKERS, readDraft, ROLES, shipFile, slug, type Draft } from './shipDraft';
import { asShip, shipFromHash, shipHash } from './shipLink';
import { plainly, type Check } from './submission';
import { viewer, type Viewer } from './viewer';

// The ship editor (docs/design/community-platform.md, stage 3): shape a ship
// from points in three blueprints beside it glowing in 3D, give it a name, a
// maker and a story, check it with the server's own checks as you go, and hand
// it in on /submit/. The geometry is in hull.ts and the file in shipDraft.ts.

const SAVE_KEY = 'ws-ship-draft';
const CHECK_DELAY = 1000;
const FLEET = Object.values(import.meta.glob<ShipDef>('../../content/ships/*.json', { eager: true, import: 'default' }))
  .filter((s) => !s.modules && ROLES.includes(s.role))
  .sort((a, b) => a.name.localeCompare(b.name));

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const store = {
  get: () => {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string) => {
    try {
      localStorage.setItem(SAVE_KEY, v);
    } catch {
      /* private browsing: the drawing just isn't kept */
    }
  },
};

let draft: Draft = readDraft(store.get()) ?? blank();
let sel: { part: number; point: number | null } = { part: 0, point: null };
let adding = false;
let snapTo = 1;
const undo: string[] = [];
const redo: string[] = [];
/** The draft before the change in progress (a drag), for the undo history. */
let before: string | null = null;

// --- Changing the draft, with undo ------------------------------------------------------

/** Make a change; `final` false while dragging, so a drag is one step to undo. */
function change(fn: () => void, final = true) {
  before ??= JSON.stringify(draft);
  fn();
  if (final) {
    if (before !== JSON.stringify(draft)) {
      undo.push(before);
      if (undo.length > 100) undo.shift();
      redo.length = 0;
    }
    before = null;
  }
  render();
}

function restore(from: string[], to: string[]) {
  const s = from.pop();
  if (!s) return;
  to.push(JSON.stringify(draft));
  draft = JSON.parse(s) as Draft;
  const p = Math.min(sel.part, draft.parts.length - 1);
  sel = { part: p, point: sel.point !== null && sel.point < draft.parts[p].points.length ? sel.point : null };
  render();
  fillShip();
}

const part = () => draft.parts[sel.part] as Part | undefined;

// --- The blueprints and the 3D view ---------------------------------------------------------

const views = $('#views');
const tabs = $('.editor-tabs');
const drawn = VIEWS.map((view, i) => {
  const box = document.createElement('figure');
  box.className = 'editor-view';
  box.dataset.view = String(i);
  box.innerHTML = `<figcaption>${view.name}</figcaption>`;
  const svg = blueprintSvg(view);
  box.append(svg);
  views.append(box);
  tabs.insertAdjacentHTML('beforeend', `<button type="button" role="tab" data-tab="${i}" aria-selected="${i === 0}">${view.name}</button>`);
  return blueprint(svg, view, {
    select(p, point) {
      sel = { part: p, point };
      render();
    },
    move(p, point, to, done) {
      change(() => {
        const target = draft.parts[p];
        // Half a hull mirrored onto itself stays on its own side.
        if (target.mirror === 'centre') to[0] = Math.max(0, to[0]);
        target.points[point] = to;
      }, done);
    },
    add(at) {
      const target = part();
      if (!target) return;
      if (target.mirror === 'centre') at[0] = Math.abs(at[0]);
      change(() => target.points.push(at));
      sel.point = target.points.length - 1;
      render();
    },
    snap: (c) => (snapTo ? Math.round(c / snapTo) * snapTo : Math.round(c * 100) / 100),
  });
});
views.dataset.tab = '0';
tabs.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
  if (!b) return;
  views.dataset.tab = b.dataset.tab!;
  for (const t of tabs.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t === b));
});

let view3d: Viewer | null = null;
try {
  view3d = viewer($<HTMLCanvasElement>('#editor-canvas'));
} catch {
  $('.editor-3d').innerHTML = '<p class="muted small">Your browser can’t show the 3D view (no WebGL), but the blueprints work.</p>';
}
let showQueued = false;
function show3d(file: Record<string, unknown>) {
  if (!view3d || showQueued) return;
  showQueued = true;
  requestAnimationFrame(() => {
    showQueued = false;
    const g = file.geometry as ShipDef['geometry'];
    if (g.faces.length) view3d!.show({ ...(file as unknown as ShipDef), credits: { authors: ['you'], license: 'CC-BY-SA-4.0' } });
  });
}

/** The blueprints' half width, in metres, as last drawn. */
let frame = 0;

/** What the blueprints draw: every part's edges, and the chosen part's points. */
function scene(): Scene {
  const edges: Scene['edges'] = [];
  const handles: Handle[] = [];
  const key = (p: Vec3) => p.map((c) => c.toFixed(3)).join(',');
  draft.parts.forEach((p, pi) => {
    const corners = new Set<string>();
    for (const body of partBodies(p)) {
      const h = convexHull(body);
      h.vertices.forEach((v) => corners.add(key(v)));
      const seen = new Set<string>();
      for (const f of h.faces)
        f.forEach((a, i) => {
          const b = f[(i + 1) % f.length];
          const k = a < b ? `${a}-${b}` : `${b}-${a}`;
          if (!seen.has(k)) {
            seen.add(k);
            edges.push({ a: h.vertices[a], b: h.vertices[b], part: pi });
          }
        });
    }
    p.points.forEach((at, i) => {
      const inside = !corners.has(key(at));
      handles.push({ part: pi, point: i, at, ghost: false, inside });
      if (p.mirror !== 'none' && at[0] !== 0) handles.push({ part: pi, point: i, at: mirrorX(at), ghost: true, inside });
    });
  });
  // The frame holds still while a point is dragged: refitting under the pointer
  // moved the point further out, which grew the frame again, and so on.
  const half = drawn.some((d) => d.dragging()) && frame ? frame : Math.max(10, Math.ceil((extent(draft.parts) * 1.15) / 5) * 5);
  frame = half;
  const slot = draft.docks === false ? undefined : { halfW: SLOT.halfW, halfH: SLOT.halfH, out: Boolean(slotProblem(shipFile(draft) as Pick<ShipDef, 'role' | 'geometry'>)) };
  return { edges, handles, selected: sel, half, colour: draft.style.lineColor, adding, slot };
}

// --- The panels -----------------------------------------------------------------------------

const MIRROR_WORDS: Record<Mirror, string> = { centre: 'mirrored', pair: 'a pair', none: 'one side' };

function render() {
  const s = scene();
  for (const d of drawn) d.draw(s);
  const file = shipFile(draft);
  show3d(file);
  store.set(JSON.stringify(draft));

  $('#parts').innerHTML = draft.parts
    .map((p, i) => `<button type="button" data-part="${i}" aria-pressed="${i === sel.part}">${escapeHtml(p.name || `Part ${i + 1}`)} <small>${MIRROR_WORDS[p.mirror]} · ${p.points.length} points</small></button>`)
    .join('');
  const p = part();
  $<HTMLInputElement>('#part-name').value = p?.name ?? '';
  $<HTMLSelectElement>('#part-mirror').value = p?.mirror ?? 'centre';
  $<HTMLButtonElement>('#part-delete').disabled = draft.parts.length <= 1;

  const point = p && sel.point !== null ? p.points[sel.point] : undefined;
  $('#point-panel').classList.toggle('empty', !point);
  (['x', 'y', 'z'] as const).forEach((a, i) => {
    const input = $<HTMLInputElement>(`#p${a}`);
    input.disabled = !point;
    if (document.activeElement !== input) input.value = point ? String(point[i]) : '';
  });
  $<HTMLButtonElement>('#point-delete').disabled = !point;
  $('#add-mode').setAttribute('aria-pressed', String(adding));
  $<HTMLButtonElement>('#undo').disabled = !undo.length;
  $<HTMLButtonElement>('#redo').disabled = !redo.length;
  $('#tip').textContent = adding
    ? 'Tap in a blueprint to add a point to this part. Its depth comes from the chosen point.'
    : 'Drag a point to move it. Hollow points are mirror images. Grey ones are inside the hull, so they don’t change its shape.';

  localCheck(file);
}

$('#parts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-part]');
  if (!b) return;
  sel = { part: Number(b.dataset.part), point: null };
  render();
});
$('#part-name').addEventListener('change', (e) => change(() => (part()!.name = (e.target as HTMLInputElement).value.trim())));
$('#part-mirror').addEventListener('change', (e) =>
  change(() => {
    const p = part()!;
    const to = (e.target as HTMLSelectElement).value as Mirror;
    // From one side to a hull: the left-hand points move to the right; from a hull to one side: both halves.
    if (to === 'centre') p.points = p.points.map((v) => [Math.abs(v[0]), v[1], v[2]] as Vec3);
    else if (p.mirror === 'centre' && to === 'none') p.points = [...p.points, ...p.points.filter((v) => v[0] !== 0).map(mirrorX)];
    p.mirror = to;
    sel.point = null;
  }),
);
$('#part-add').addEventListener('click', () =>
  change(() => {
    // A small box beside the ship, as a pair: the usual start for a wing or a pod.
    const x = Math.ceil(extent(draft.parts) * 0.6) + 3;
    const box: Vec3[] = [];
    for (const dx of [0, 4]) for (const dy of [-1, 1]) for (const dz of [-3, 3]) box.push([x + dx, dy, dz]);
    draft.parts.push({ name: `Part ${draft.parts.length + 1}`, mirror: 'pair', points: box });
    sel = { part: draft.parts.length - 1, point: null };
  }),
);
$('#part-copy').addEventListener('click', () =>
  change(() => {
    const p = part()!;
    draft.parts.push({ ...structuredClone(p), name: `${p.name || 'Part'} copy` });
    sel = { part: draft.parts.length - 1, point: null };
  }),
);
$('#part-delete').addEventListener('click', () =>
  change(() => {
    draft.parts.splice(sel.part, 1);
    sel = { part: Math.max(0, sel.part - 1), point: null };
  }),
);

(['x', 'y', 'z'] as const).forEach((a, i) =>
  $(`#p${a}`).addEventListener('change', (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    const p = part();
    if (!p || sel.point === null || !Number.isFinite(v)) return;
    change(() => (p.points[sel.point!][i] = i === 0 && p.mirror === 'centre' ? Math.abs(v) : v));
  }),
);
function deletePoint() {
  const p = part();
  if (!p || sel.point === null) return;
  change(() => p.points.splice(sel.point!, 1));
  sel.point = null;
  render();
}
$('#point-delete').addEventListener('click', deletePoint);

$('#add-mode').addEventListener('click', () => {
  adding = !adding;
  render();
});
$('#undo').addEventListener('click', () => restore(undo, redo));
$('#redo').addEventListener('click', () => restore(redo, undo));
$<HTMLSelectElement>('#snap').addEventListener('change', (e) => (snapTo = Number((e.target as HTMLSelectElement).value)));
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, select')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) restore(redo, undo);
    else restore(undo, redo);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deletePoint();
  } else if (e.key === 'Escape' && adding) {
    adding = false;
    render();
  }
});

// --- Starting points --------------------------------------------------------------------------

const start = $<HTMLSelectElement>('#start');
start.insertAdjacentHTML('beforeend', FLEET.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}${s.concept ? ' (concept)' : ''}</option>`).join(''));
const improveButton = $<HTMLButtonElement>('#improve');
const syncStart = () => (improveButton.disabled = !start.value);
start.addEventListener('change', syncStart);
syncStart();

/** Replace the drawing, with a second press to be sure if there's one to lose. */
function armed(b: HTMLButtonElement, words: string): boolean {
  const disarm = () => {
    clearTimeout(Number(b.dataset.timer));
    b.classList.remove('armed');
    b.textContent = b.dataset.words!;
  };
  if (b.classList.contains('armed')) {
    disarm();
    return true;
  }
  b.dataset.words ??= b.textContent ?? '';
  b.classList.add('armed');
  b.textContent = words;
  b.dataset.timer = String(setTimeout(disarm, 4000));
  return false;
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-start]'))
  b.addEventListener('click', () => {
    if (!armed(b, 'Press again: this replaces your drawing')) return;
    const ship = FLEET.find((s) => s.id === start.value);
    change(() => (draft = ship ? fromShip(ship, b.dataset.start as 'new' | 'improve') : blank()));
    sel = { part: 0, point: null };
    fillShip();
    render();
  });
$('#reset').addEventListener('click', (e) => {
  if (!armed(e.target as HTMLButtonElement, 'Press again to start again')) return;
  change(() => (draft = blank()));
  sel = { part: 0, point: null };
  fillShip();
  render();
});

// --- The rest of the ship file --------------------------------------------------------------

const form = $<HTMLFormElement>('#ship');
const field = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
form.querySelector('[name="role"]')!.innerHTML = ROLES.map((r) => `<option value="${r}">${r[0].toUpperCase()}${r.slice(1)}</option>`).join('');
$('#makers').innerHTML = MAKERS.map((m) => `<option value="${escapeHtml(m)}"></option>`).join('');

// The Cobra's own numbers, for scale: from its file, so they never go stale.
const cobra = FLEET.find((s) => s.id === 'cobra-mk3')?.stats;
const like = (key: keyof ShipDef['stats'], unit = '') => [unit, cobra?.[key] !== undefined ? `Cobra ${cobra[key]}` : ''].filter(Boolean).join(' · ');
const STATS: { key: keyof ShipDef['stats']; label: string; step: number; hint: string }[] = [
  { key: 'maxSpeed', label: 'Top speed', step: 10, hint: like('maxSpeed', 'm/s') },
  { key: 'pitchRate', label: 'Pitch', step: 0.1, hint: like('pitchRate', 'rad/s') },
  { key: 'rollRate', label: 'Roll', step: 0.1, hint: like('rollRate', 'rad/s') },
  { key: 'hull', label: 'Hull', step: 10, hint: like('hull') },
  { key: 'shields', label: 'Shields', step: 10, hint: like('shields') },
  { key: 'cargo', label: 'Hold', step: 1, hint: like('cargo', 'tonnes') },
  { key: 'missiles', label: 'Missiles', step: 1, hint: 'up to 8' },
  { key: 'price', label: 'Price', step: 1000, hint: 'Cr' },
  { key: 'ratingValue', label: 'Rating value', step: 0.05, hint: 'for shooting one down' },
];
$('#stats').innerHTML = STATS.map((s) => `<label>${s.label} <input type="number" min="0" step="${s.step}" data-stat="${s.key}" /><small class="hint">${s.hint}</small></label>`).join('');

/** Put the draft's fields into the form (on load, and after starting again or undoing). */
function fillShip() {
  field('name').value = draft.name;
  field('id').value = draft.id;
  field('manufacturer').value = draft.manufacturer;
  (form.querySelector('[name="role"]') as HTMLSelectElement).value = draft.role;
  field('docks').checked = draft.docks === false;
  (form.querySelector('[name="description"]') as HTMLTextAreaElement).value = draft.description;
  field('lineColor').value = draft.style.lineColor;
  for (const input of form.querySelectorAll<HTMLInputElement>('[data-stat]')) {
    const v = draft.stats[input.dataset.stat as keyof ShipDef['stats']];
    input.value = v === undefined ? '' : String(v);
  }
  field('id').placeholder = slug(draft.name) || 'ice-hauler';
}

form.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  change(() => {
    if (t.dataset.stat) {
      const key = t.dataset.stat as keyof ShipDef['stats'];
      if (t.value === '') delete draft.stats[key];
      else draft.stats[key] = Number(t.value);
    } else if (t.name === 'lineColor') draft.style.lineColor = t.value;
    else if (t.name === 'role') draft.role = t.value as Draft['role'];
    else if (t.name === 'docks') {
      if (t.checked) draft.docks = false;
      else delete draft.docks;
    }
    else if (t.name === 'name' || t.name === 'id' || t.name === 'manufacturer' || t.name === 'description') draft[t.name] = t.value;
  }, false);
  field('id').placeholder = slug(draft.name) || 'ice-hauler';
});
// A typing session is one step to undo.
form.addEventListener('change', () => change(() => {}));

// --- Checks -------------------------------------------------------------------------------------

const checkBox = $('#check');
let checkTimer = 0;
let lastChecked = '';
let local: string[] = [];

/** What the editor can tell at once; the server's checks follow. */
function localCheck(file: Record<string, unknown>) {
  local = [];
  draft.parts.forEach((p, i) => {
    const bodies = partBodies(p).map(convexHull);
    if (bodies.some((b) => !b.faces.length)) local.push(`${p.name || `Part ${i + 1}`} needs at least three points that aren't in a line.`);
  });
  if (slotProblem(file as Pick<ShipDef, 'role' | 'docks' | 'geometry'>)) {
    const g = (file as unknown as ShipDef).geometry.vertices;
    const reach = (axis: number) => Math.round(Math.max(...g.map((v) => Math.abs(v[axis]))));
    const over = [reach(0) >= SLOT.halfW ? `${reach(0)} m out to the side (the slot allows ${SLOT.halfW})` : '', reach(1) >= SLOT.halfH ? `${reach(1)} m above or below its centre (the slot allows ${SLOT.halfH})` : ''].filter(Boolean).join(' and ');
    local.push(`It doesn't fit the docking slot, the dashed box in the Front view, ${SLOT.halfW * 2} m wide and ${SLOT.halfH * 2} m tall around the ship's centre: it reaches ${over}. Make it fit, or tick "Never docks" if it's a carrier or a yard hauler.`);
  }
  if (!draft.name.trim()) local.push('Give it a name.');
  if (draft.description.trim().length < 10) local.push('Give it a description: who flies it, and why.');
  clearTimeout(checkTimer);
  checkTimer = window.setTimeout(() => {
    void serverCheck(file);
    void previewLink(file);
  }, CHECK_DELAY);
  showCheck(null);
}

let result: Check | null = null;
let failed = false;

async function serverCheck(file: Record<string, unknown>) {
  const text = JSON.stringify(file);
  if (text === lastChecked) return;
  lastChecked = text;
  try {
    const res = await fetch(`${API}/submissions/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'ship', file }) });
    const data = (await res.json()) as Check & { error?: string };
    // A slow answer about an older drawing: a newer check is on its way.
    if (text !== lastChecked) return;
    if (!res.ok) throw new Error(data.error);
    result = data;
    failed = false;
  } catch {
    if (text !== lastChecked) return;
    failed = true;
    lastChecked = '';
  }
  showCheck(result);
}

function showCheck(r: Check | null) {
  if (r) result = r;
  // The server's word on a field the editor has already asked for (a name, a description) would say it twice.
  const asked = [!draft.name.trim() ? /^(name|id):/ : null, draft.description.trim().length < 10 ? /^description:/ : null, /^dock:/].filter((r): r is RegExp => r !== null);
  const server = (result?.problems ?? []).filter((p) => !asked.some((r) => r.test(p)));
  const problems = [...local, ...server.map((p) => p.replace(/^([\w.[\]]+): (.+)$/s, (_, w: string, what: string) => `${w}: ${plainly(what)}`))];
  // The server's warnings, sorted: balance notes on their own, the homage rule as standing
  // guidance below, and the AI question left to /submit/, which asks it.
  const all = result?.warnings ?? [];
  const balance = all.filter((w) => w.startsWith('balance:')).map((w) => w.replace(/^balance:\s*/, ''));
  const homage = all.find((w) => w.startsWith('homage:'))?.replace(/^homage:\s*/, '');
  const warnings = all.filter((w) => !/^(balance|homage|credits):/.test(w));
  const list = (items: string[], cls: string) => (items.length ? `<ul class="${cls}">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '');
  checkBox.innerHTML =
    (problems.length ? `<p class="check-head bad">To fix before it can be handed in:</p>${list([...new Set(problems)], 'problems')}` : result ? '<p class="check-head good">It passes the checks.</p>' : '<p class="muted">Checking…</p>') +
    (warnings.length ? `<p class="check-head">Worth a look:</p>${list(warnings, 'warnings')}` : '') +
    (balance.length ? `<p class="check-head">Balance, against the fleet:</p>${list(balance, 'warnings')}` : '') +
    (homage ? `<p class="small muted homage">${escapeHtml(homage[0].toUpperCase() + homage.slice(1))}</p>` : '') +
    (failed ? '<p class="small muted">We couldn’t reach the server’s checks just now; they’ll run again when you change something.</p>' : '') +
    `<p class="small muted">${countLine()}</p>`;
  $<HTMLButtonElement>('#hand-in').disabled = problems.length > 0;
}

function countLine() {
  const g = shipFile(draft).geometry as ShipDef['geometry'];
  const size = (axis: number) => {
    const c = g.vertices.map((v) => v[axis]);
    return c.length ? Math.round(Math.max(...c) - Math.min(...c)) : 0;
  };
  return `${g.vertices.length} points, ${g.faces.length} faces · ${size(0)} m wide, ${size(1)} m tall, ${size(2)} m long`;
}

// --- Handing it in -------------------------------------------------------------------------

$('#hand-in').addEventListener('click', () => {
  try {
    sessionStorage.setItem('ws-submit-file', JSON.stringify(shipFile(draft), null, 2));
  } catch {
    return download();
  }
  location.href = '/submit/?kind=ship&from=editor';
});

function download() {
  const file = shipFile(draft);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2) + '\n'], { type: 'application/json' }));
  a.download = `${String(file.id) || 'ship'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#download').addEventListener('click', download);

/** Its preview page, a link with the whole file in it, to send to anyone (or your phone). */
async function previewLink(file: Record<string, unknown>) {
  $<HTMLAnchorElement>('#preview').href = `/ship-preview/#${await shipHash(file)}`;
}

// --- A ship from a link (/ship-editor/#ship=…, from a preview page) or a file -------------------

const offer = $('#link-offer');
async function fromLink() {
  const ship = await shipFromHash(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (ship) openShip(ship);
}
addEventListener('hashchange', () => void fromLink());

const fileInput = $<HTMLInputElement>('#open-file');
$('#open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  fileInput.value = '';
  if (!f) return;
  let ship = null;
  try {
    ship = asShip(JSON.parse(await f.text()));
  } catch {
    /* not JSON */
  }
  const note = $('#open-note');
  note.hidden = Boolean(ship);
  note.textContent = ship ? '' : `${f.name} isn't a ship file we can read: it needs a name, geometry, stats and style, as the ships in the fleet have.`;
  if (ship) openShip(ship);
});

/** Open a ship file as the drawing; one of your own is never replaced without asking. */
function openShip(ship: ShipDef) {
  const take = () => {
    offer.hidden = true;
    const linked = fromShip(ship, 'improve');
    // It improves a fleet ship only if there is one by that id.
    if (!FLEET.some((s) => s.id === ship.id)) linked.improves = undefined;
    change(() => (draft = linked));
    sel = { part: 0, point: null };
    if (draft.improves) start.value = draft.improves;
    syncStart();
    fillShip();
    render();
  };
  if (JSON.stringify(draft) === JSON.stringify(blank())) return take();
  offer.querySelector('strong')!.textContent = ship.name || 'the ship';
  offer.hidden = false;
  offer.querySelector<HTMLButtonElement>('[data-link="open"]')!.onclick = take;
  offer.querySelector<HTMLButtonElement>('[data-link="keep"]')!.onclick = () => (offer.hidden = true);
  offer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// --- Start ------------------------------------------------------------------------------------

if (draft.improves) start.value = draft.improves;
syncStart();
fillShip();
render();
void fromLink();
