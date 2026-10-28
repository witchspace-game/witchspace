// The website's ship pages: an index of the fleet, and a page for each ship
// with its story, its stats, who designed it, and how to make it better.
// Everything comes from the ship's own file in content/ships/. No Node here: the
// ship preview page (src/site/shipPreview.ts) builds its page in the browser.

const REPO = 'https://github.com/witchspace-game/witchspace/blob/main/';

export interface ShipFile {
  id: string;
  name: string;
  manufacturer?: string;
  role?: string;
  description?: string;
  credits?: { authors?: string[]; license?: string; aiAssisted?: boolean; notes?: string };
  geometry: { vertices: number[][]; faces: number[][]; details?: { vertices: number[][]; lines: number[][] } };
  stats?: Record<string, number>;
  style?: { lineColor?: string };
  insignia?: { color: string; vertices: number[][]; lines: number[][] };
  modules?: string[];
  /** A maker's concept: shown off, not flying yet. */
  concept?: true;
}

/** A ship's owner's manual, as its page carries it for src/site/manual.ts (made in tools/shipFiles.ts). */
export interface ManualData {
  id: string;
  name: string;
  colour: string;
  meta: string;
  description: string;
  notes: string[];
  /** Label, value, against a Cobra. */
  handling: string[][];
  /** Room to spare in the slot ('' for the Cobra). */
  span: string;
  /** Degrees off level the slot allows. */
  roll: number;
  /** Equipment, luxuries and editions by id: [name, blurb]. */
  kit: Record<string, string[]>;
  luxuries: Record<string, string[]>;
  editions: Record<string, string>;
  /** The phone's drawer, from play/index.html: what each button does comes from the controls list (src/game/controls.ts drawerHelp). */
  drawer: { key?: string; label: string; title: string }[];
}

/** A special edition, as its ship's page shows it (made in tools/shipFiles.ts). */
export interface EditionCard {
  id: string;
  name: string;
  blurb: string;
  limit: number;
  price: number;
  colour: string;
  trimColour: string | null;
  /** "Orerve Nebula, with Witch-fire trim". */
  finish: string;
  line: string;
  glow: string;
  fit: string[];
  luxuries: string[];
}

export interface ModuleFile {
  id: string;
  name: string;
  zone: string;
  length: number;
  description: string;
  designer: string;
}

/** Where a ship's design is written down, when it has more than its file. */
const DESIGN: Record<string, { href: string; label: string }> = {
  falcon: { href: REPO + 'docs/design/legends-the-falcon.md', label: 'The Falcons, a Legend' },
  titanoboa: { href: '/design/ship-the-titanoboa/', label: 'The Titanoboa, a modular factory' },
  bullsnake: { href: REPO + 'docs/companies.md#its-ship-the-bullsnake', label: 'Wexley-Yorozu and its ships' },
  lancer: { href: '/design/law-and-travel/#9-power-and-protection', label: 'The Co-operative Marshals' },
  bastion: { href: '/design/law-and-travel/#9-power-and-protection', label: 'The Co-operative Marshals' },
};

const ROLE: Record<string, string> = {
  multirole: 'Multirole', pirate: 'Pirate', police: 'Police', marshal: 'Co-operative Marshals', miner: 'Ore hauler', freighter: 'Constructor', station: 'Station',
};

/** The first sentence, for a share card's line. */
const firstSentence = (text: string) => {
  const first = (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();
  // Too long for a card: end at a word, with an ellipsis, never mid-phrase.
  return first.length > 120 ? first.slice(0, first.lastIndexOf(' ', 117)).replace(/[,;:·\s]+$/, '').replace(/\s(and|or|a|the)$/, '') + '…' : first;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A wireframe drawing of the ship, seen from above and to one side, as an
 * SVG: drawn when the site is built, so the index costs nothing to load.
 */
/** Ships drawn from another side: the station faces you, slot and all. */
const VIEW: Record<string, { yaw: number; pitch: number }> = { coriolis: { yaw: -0.7 + Math.PI, pitch: 0.3 } };

export function shipSvg(s: ShipFile, cls = 'ship-svg'): string {
  const { yaw, pitch } = VIEW[s.id] ?? { yaw: -0.7, pitch: 0.45 };
  // Screen x and y, and depth (smaller is nearer the viewer).
  const project = ([x, y, z]: number[]) => {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    return [x1, -y1, z2];
  };
  const { vertices, faces } = s.geometry;
  const v = vertices.map(project);
  // The hull's faces as triangles, to hide what's behind them, as the game does.
  const tris: number[][][] = [];
  for (const f of faces) for (let i = 1; i < f.length - 1; i++) tris.push([v[f[0]], v[f[i]], v[f[i + 1]]]);
  const span = Math.max(...v.map((p) => p[0])) - Math.min(...v.map((p) => p[0])) || 1;
  const eps = span * 0.004;
  const hidden = (p: number[]) =>
    tris.some(([a, b, c]) => {
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-9) return false;
      const l1 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / den;
      const l2 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / den;
      const l3 = 1 - l1 - l2;
      if (l1 < 0.001 || l2 < 0.001 || l3 < 0.001) return false;
      return l1 * a[2] + l2 * b[2] + l3 * c[2] < p[2] - eps;
    });
  // Each line, cut into short steps, keeping the runs nothing stands in front of.
  const visible = (a: number[], b: number[]): [number[], number[]][] => {
    const steps = Math.max(2, Math.ceil((Math.hypot(b[0] - a[0], b[1] - a[1]) / span) * 60));
    const at = (t: number) => a.map((x, i) => x + (b[i] - x) * t);
    const out: [number[], number[]][] = [];
    let start: number | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const seen = !hidden(at(t));
      if (seen && start === null) start = t;
      if ((!seen || i === steps) && start !== null) {
        const end = seen ? t : (i - 0.5) / steps;
        const [p, q] = [at(start), at(end)];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) > span * 0.01) out.push([p, q]); // no specks
        start = null;
      }
    }
    return out;
  };
  const edges = new Set<string>();
  const all: [number[], number[]][] = [];
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (edges.has(k)) continue;
      edges.add(k);
      all.push([v[a], v[b]]);
    }
  }
  const hull = all.flatMap(([a, b]) => visible(a, b));
  const d = s.geometry.details;
  const detail = (d?.lines ?? []).flatMap(([a, b]) => visible(project(d!.vertices[a]), project(d!.vertices[b])));
  // Framed on the whole ship, hidden lines and all, so it sits where it always has.
  const pts = [...all, ...(d?.lines ?? []).map(([a, b]) => [project(d!.vertices[a]), project(d!.vertices[b])])].flat();
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const size = Math.max(maxX - minX, maxY - minY) * 1.12;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const line = ([a, b]: [number[], number[]]) => `M${(a[0] - cx).toFixed(1)} ${(a[1] - cy).toFixed(1)}L${(b[0] - cx).toFixed(1)} ${(b[1] - cy).toFixed(1)}`;
  const colour = s.style?.lineColor ?? '#3dffb0';
  const w = size / 160;
  return `<svg class="${cls}" viewBox="${(-size / 2).toFixed(1)} ${(-size / 2).toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}" style="--ship:${esc(colour)}" role="img" aria-label="${esc(s.name)}, wireframe">
  <path d="${hull.map(line).join('')}" stroke-width="${w.toFixed(2)}" />
  <path class="detail" d="${detail.map(line).join('')}" stroke-width="${(w * 0.6).toFixed(2)}" />
</svg>`;
}

const STAT_LABELS: [string, string, (n: number) => string][] = [
  ['maxSpeed', 'Top speed', (n) => (n ? `${n} m/s` : 'None')],
  ['hull', 'Hull', (n) => n.toLocaleString('en-GB')],
  ['shields', 'Shields', (n) => n.toLocaleString('en-GB')],
  ['cargo', 'Hold', (n) => `${n} t`],
  ['missiles', 'Missiles', String],
  ['price', 'Price', (n) => (n ? `${n.toLocaleString('en-GB')} Cr` : 'Not for sale')],
];

function roleLine(s: ShipFile) {
  return [s.concept ? 'Concept' : '', s.manufacturer && s.manufacturer !== 'None' ? s.manufacturer : '', ROLE[s.role ?? ''] ?? s.role ?? ''].filter(Boolean).join(' · ');
}

const shipCard = (s: ShipFile) => `    <a class="card link ship-card${s.concept ? ' concept' : ''}" href="/ships/${s.id}/">
      ${shipSvg(s)}
      <h3>${esc(s.name)}</h3>
      <p class="muted">${esc(roleLine(s))}</p>
    </a>`;

export function shipsIndex(ships: ShipFile[]): string {
  const concepts = ships.filter((s) => s.concept);
  return `<section class="section">
  <div class="section-head">
    <p class="kicker">The fleet</p>
    <h2>Ships</h2>
    <p class="lede">Every ship in Witchspace is a small file anyone can read, improve or add to. Here's the fleet so far, who flies each one, and who drew it.</p>
  </div>
  <div class="ship-grid">
${ships.filter((s) => !s.concept).map(shipCard).join('\n')}
  </div>
${concepts.length ? `  <div class="ship-concepts">
    <h3>Coming soon</h3>
    <p class="muted">Concepts: what the makers are showing off before they fly.</p>
    <div class="ship-grid">
${concepts.map(shipCard).join('\n')}
    </div>
  </div>` : ''}
  <div class="ship-make">
    <h3>Design a ship</h3>
    <p>A ship is a small file: points, faces and a few glowing details. You don't need to code to make one. <a href="/get-involved/#ai">Add Witchspace to your AI assistant</a>, ask it for the ship you have in mind, and it checks the design against the game's rules and draws it beside a Cobra. Then email the file to <a href="mailto:hello@witchspace.org.uk?subject=A%20ship%20for%20Witchspace">hello@witchspace.org.uk</a>, or <a href="/ideas/">put the idea on the ideas board</a> for someone to draw. Nods to films and books are welcome, copies of their designs aren't (<a href="${REPO}CONTRIBUTING.md#legends-and-homages">the rules on homages</a>).</p>
    <p class="muted small">If you code: ships live in <a href="https://github.com/witchspace-game/witchspace/tree/main/content/ships">content/ships</a> on GitHub, open to pull requests (<a href="${REPO}CONTRIBUTING.md">how to contribute</a>).</p>
  </div>
</section>`;
}

/** A modular ship's sections, fore to aft, each with its job and its designer. */
function modulesCard(s: ShipFile, modules: Map<string, ModuleFile>): string {
  if (!s.modules) return '';
  const rows = [...new Set(s.modules)]
    .map((id) => modules.get(id))
    .filter((m): m is ModuleFile => m !== undefined)
    .map((m) => {
      const count = s.modules!.filter((id) => id === m.id).length;
      return `<li><strong>${esc(m.name)}${count > 1 ? ` ×${count}` : ''}</strong> <span class="muted small">${m.length} m · ${esc(m.zone)} · designed by ${esc(m.designer)}</span><br>${esc(m.description)} <a class="small" href="${REPO}content/modules/${esc(m.id)}.json">File</a></li>`;
    })
    .join('');
  return `<div class="card ship-modules">
      <h3>Built from modules</h3>
      <p>Fore to aft: ${s.modules.map((id) => esc(modules.get(id)?.name ?? id)).join(' → ')}. Every module couples the same way, so the line-up changes with the job, and anyone can design a new one to <a href="/design/ship-the-titanoboa/#designing-a-module-the-standard">the standard</a>.</p>
      <ul>${rows}</ul>
    </div>`;
}

/**
 * A ship's page. `preview` is for a ship file from a link (/ship-preview/):
 * not in the fleet yet, so no GitHub file, ideas or share address of its own.
 */
export function shipPage(s: ShipFile, modules: Map<string, ModuleFile> = new Map(), preview = false, editions: EditionCard[] = [], manual = false) {
  const c = s.credits ?? {};
  const stats = STAT_LABELS.filter(([k]) => s.stats?.[k] !== undefined)
    // A concept's numbers are the makers' promises.
    .map(([k, label, f]) => `<div><dt>${label}</dt><dd>${s.concept && k === 'price' && s.stats![k] ? 'About ' : ''}${esc(f(s.stats![k]))}</dd></div>`)
    .join('');
  const design = DESIGN[s.id];
  const authors = (c.authors ?? []).join(', ') || 'Witchspace contributors';
  const def = JSON.stringify({ id: s.id, name: s.name, geometry: s.geometry, style: s.style ?? {}, insignia: s.insignia }).replace(/</g, '\\u003c');
  return {
    card: { ship: s.id, kicker: roleLine(s) || 'Ship', sub: firstSentence(s.description ?? '') },
    schema: [
      {
        '@type': 'CreativeWork',
        name: s.name,
        description: s.description ?? '',
        creator: (c.authors ?? ['Witchspace contributors']).map((name) => ({ '@type': 'Organization', name })),
        license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        isPartOf: { '@type': 'VideoGame', name: 'Witchspace', url: 'https://witchspace.org.uk/play/' },
        ...(s.manufacturer && s.manufacturer !== 'None' ? { brand: { '@type': 'Brand', name: s.manufacturer } } : {}),
      },
    ],
    title: `${s.name} · Ships · Witchspace`,
    description: `${s.name}${roleLine(s) ? ` (${roleLine(s)})` : ''}: ${s.description ?? 'a ship in Witchspace'}`.slice(0, 300),
    content: `<section class="section ship-page">
  <a class="back" href="/ships/">← All ships</a>
  ${preview ? '<p class="preview-note">A preview: this ship isn’t in the fleet or the game yet. It’s the ship file from the link you opened, exactly as drawn.</p>' : ''}
  <div class="ship-hero">
    <div class="ship-view" data-ship="${esc(s.id)}">
      ${shipSvg(s, 'ship-svg fallback')}
      <canvas class="ship-canvas" aria-label="${esc(s.name)}, turning: drag to rotate"></canvas>
    </div>
    <div class="ship-copy">
      <p class="kicker">${esc(roleLine(s))}</p>
      <h1>${esc(s.name)}</h1>
      <p class="lede">${esc(s.description ?? '')}</p>
      ${s.concept ? '<p class="concept-note">Coming soon. A concept: its makers are showing it off, and it isn’t flying yet. Its numbers may change before it does.</p>' : ''}
      ${stats ? `<dl class="ship-stats">${stats}</dl>` : ''}
      <p class="ship-share"><button type="button" class="button ghost small" data-share${preview ? '' : ` data-share-url="/ships/${esc(s.id)}/"`} data-share-title="${esc(s.name)}">Share the ${esc(s.name)}</button>${manual ? ` <a class="button ghost small" href="/ships/${esc(s.id)}/manual/">Owner’s manual</a>` : ''}</p>
      ${manual ? `<p class="ship-build"><a class="button primary" href="/ships/${esc(s.id)}/build/">Build yours</a></p>` : ''}
    </div>
  </div>
  <script type="application/json" id="ship-def">${def}</script>
  ${modulesCard(s, modules)}
  ${editionsCard(editions)}

  ${preview ? previewCard(s) : `<div class="ship-columns">
    <div class="card">
      <h3>Its design</h3>
      ${c.notes ? `<p>${esc(c.notes)}</p>` : ''}
      <p class="muted">Drawn by ${esc(authors)}${c.aiAssisted ? ', with AI assistance' : ''}. Licence: ${esc(c.license ?? 'CC-BY-SA-4.0')}.</p>
      <p><a href="${REPO}content/ships/${esc(s.id)}.json">The ship file on GitHub</a>${design ? ` · <a href="${esc(design.href)}">${esc(design.label)}</a>` : ''}</p>
    </div>
    <div class="card">
      <h3>Make it better</h3>
      <p>Got an idea for the ${esc(s.name)}: a better shape, a detail it's missing, a story for it? Suggest it on the ideas board, where others can vote it up.</p>
      <ul class="ship-ideas" data-ship-name="${esc(s.name)}"><li class="muted">Looking for ideas about the ${esc(s.name)}…</li></ul>
      <p><a class="button primary small" href="/ideas/?about=${encodeURIComponent(s.name)}">Suggest an improvement</a></p>
      <p class="muted small">Want to redraw it yourself? <a href="/get-involved/#ai">Ask your AI assistant</a> to rework <a href="${REPO}content/ships/${esc(s.id)}.json">its file</a> and email the result to <a href="mailto:hello@witchspace.org.uk?subject=${encodeURIComponent(`A better ${s.name}`)}">hello@witchspace.org.uk</a>. If you code, a pull request works too.</p>
    </div>
  </div>`}
</section>`,
  };
}

/** Numbered special editions: a set spec, a hundred built. How many are left comes live (src/site/ship.ts). */
function editionsCard(editions: EditionCard[]): string {
  if (!editions.length) return '';
  return `<div class="ship-editions">
    ${editions
      .map(
        (e) => `<article class="edition" id="edition-${esc(e.id)}" style="--edition:${esc(e.colour)};--trim:${esc(e.trimColour ?? e.colour)}">
      <p class="kicker">Special edition · ${e.limit} built</p>
      <h3>${esc(e.name)}</h3>
      <p>${esc(e.blurb)}</p>
      <dl class="edition-spec">
        <div><dt>Finish</dt><dd><span class="edition-swatch" aria-hidden="true"></span>${esc(e.finish)}${e.line ? `<br><small>${esc(e.line)}</small>` : ''}</dd></div>
        <div><dt>Glow</dt><dd>${esc(e.glow)}</dd></div>
        <div><dt>Fitted</dt><dd>${e.fit.map(esc).join(', ')}</dd></div>
        <div><dt>Aboard</dt><dd>${e.luxuries.map(esc).join(', ')}</dd></div>
      </dl>
      <p class="edition-count" data-edition="${esc(e.id)}" data-limit="${e.limit}">Numbered 001 to ${String(e.limit).padStart(3, '0')}, each painted beside its name.</p>
      <p class="edition-price"><b>${e.price.toLocaleString('en-GB')} Cr</b> · Reserve one in the game, at a shipyard.</p>
    </article>`,
      )
      .join('')}
  </div>`;
}

/** A preview's file: who drew it, and what you can do with it. */
function previewCard(s: ShipFile): string {
  const c = s.credits ?? {};
  const authors = (c.authors ?? []).join(', ');
  return `<div class="card ship-preview-file">
    <h3>The file</h3>
    ${c.notes ? `<p>${esc(c.notes)}</p>` : ''}
    ${authors ? `<p class="muted">Drawn by ${esc(authors)}${c.aiAssisted ? ', with AI assistance' : ''}.</p>` : ''}
    <p class="muted small" id="preview-editor-note" hidden></p>
    <p class="connect-buttons"><a class="button primary small" id="preview-edit" href="/ship-editor/">Open it in the ship editor</a> <button type="button" class="button ghost small" id="preview-download">Download the file</button></p>
  </div>`;
}

/** A ship's owner's manual: only its owner sees it. The page checks the save (src/site/manual.ts); everyone else is told it comes with the ship. */
export function manualPage(s: ShipFile, m: ManualData) {
  const data = JSON.stringify(m).replace(/</g, '\\u003c');
  return {
    card: { ship: s.id, kicker: 'Owner’s manual', title: `The ${s.name} owner’s manual`, sub: 'Comes with the ship: how she flies, how to dock her, and where every button is.' },
    schema: [{ '@type': 'CreativeWork', name: `${s.name} owner’s manual`, about: { '@type': 'CreativeWork', name: s.name, url: `https://witchspace.org.uk/ships/${s.id}/` }, isPartOf: { '@type': 'VideoGame', name: 'Witchspace', url: 'https://witchspace.org.uk/play/' } }],
    title: `${s.name} owner’s manual · Ships · Witchspace`,
    description: `The ${s.name} owner’s manual comes with the ship: how she flies against a Cobra, how to dock her, and every control. Owners only.`,
    head: '    <meta name="robots" content="noindex" />\n',
    content: `<section class="section ship-page manual-page" style="--hull:${esc(m.colour)}">
  <a class="back" href="/ships/${esc(s.id)}/">← The ${esc(s.name)}</a>
  <header class="man-cover">
    <p class="kicker">Owner’s manual · ${esc(m.meta)}</p>
    <h1 id="man-title">${esc(s.name)}</h1>
    <p class="lede">${esc(m.description)}</p>
  </header>
  <div class="card manual-gate" id="manual-gate">
    <h3>For owners only</h3>
    <p id="manual-why">Every ${esc(s.name)} comes with her manual: how she flies against a Cobra, how to dock her, and where every button is. Checking whether she’s yours…</p>
    <div id="account" hidden></div>
    <p class="connect-buttons"><a class="button primary small" href="/ships/${esc(s.id)}/">See the ${esc(s.name)}</a> <a class="button ghost small" href="/play/">Play Witchspace</a></p>
  </div>
  <article class="manual" id="manual" hidden></article>
  <script type="application/json" id="manual-data">${data}</script>
</section>`,
  };
}

/** The configurator: spec her as you would a new car, then order her for the yard (docs/design/ship-configurator.md). The choices and prices come from the game's own code (src/site/build.ts). */
export function buildPage(s: ShipFile, editions: EditionCard[], names: Record<string, string>) {
  const def = JSON.stringify(s).replace(/</g, '\\u003c');
  return {
    card: { ship: s.id, kicker: 'Build yours', title: `Spec your ${s.name}`, sub: 'Her colour, her glow, her name and her fit-out, priced as you go. Order her, and she’s waiting at the yard.' },
    schema: [{ '@type': 'WebApplication', name: `${s.name} configurator`, applicationCategory: 'GameApplication', about: { '@type': 'CreativeWork', name: s.name, url: `https://witchspace.org.uk/ships/${s.id}/` }, isPartOf: { '@type': 'VideoGame', name: 'Witchspace', url: 'https://witchspace.org.uk/play/' } }],
    title: `Build your ${s.name} · Ships · Witchspace`,
    description: `Spec your own ${s.name}: her colour, glow, trim, name and fit-out, priced as you go. Order her, and the shipyard has her ready for your deposit when you next dock.`,
    content: `<section class="section ship-page build-page" style="--hull:${esc(s.style?.lineColor ?? '#7fd4ff')}">
  <a class="back" href="/ships/${esc(s.id)}/">← The ${esc(s.name)}</a>
  <div class="build">
    <div class="build-stage">
      <div class="ship-view build-view">
        ${shipSvg(s, 'ship-svg fallback')}
        <canvas class="ship-canvas" aria-label="Your ${esc(s.name)}, turning in your paint: drag to rotate"></canvas>
      </div>
      <p class="build-caption" id="build-caption"></p>
    </div>
    <div class="build-panel">
      <p class="kicker">${esc(roleLine(s))}</p>
      <h1>Spec your ${esc(s.name)}</h1>
      <p class="lede">${s.concept ? `A concept: ${esc(s.manufacturer ?? 'her makers')} build her to order. Spec her here, and the deposit is one tap at the next shipyard you dock at.` : `Spec her here, and she’s waiting at the next shipyard you dock at.`}</p>
      <nav class="build-steps" id="build-steps" aria-label="Steps"></nav>
      <div id="build-options"></div>
      <div class="build-account" id="account" hidden></div>
    </div>
  </div>
  ${editions.length ? `<p class="build-editions">Or one of the numbered editions: ${editions.map((e) => `<a href="/ships/${esc(s.id)}/#edition-${esc(e.id)}" style="--edition:${esc(e.colour)}">${esc(e.name)}</a>`).join(' · ')}, each one set by the maker, and ordered at a shipyard.</p>` : ''}
  <div class="build-bar" id="build-bar" aria-live="polite"></div>
  <script type="application/json" id="ship-def">${def}</script>
  <script type="application/json" id="yard-names">${JSON.stringify(names).replace(/</g, '\\u003c')}</script>
</section>`,
  };
}
