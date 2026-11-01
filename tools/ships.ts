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
  /** Built to order: specced, a deposit down, and collected from the yard a few days later (the game's own meaning). */
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
  /** Her outline from above beside a Cobra's, as an <svg> ('' for the Cobra). */
  beside: string;
  /** Her length against a Cobra's, in words ("twice the length"). */
  length: string;
  /** Tilt, drawn (the game's own, src/game/manual.ts): made at build time, so the page needn't load the game's notes. */
  tilt: string;
  /** Degrees off level the slot allows. */
  roll: number;
  /** She leaves the yard with a docking computer (the game's standardKit). */
  dockingFitted: boolean;
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
  colour: string;
  trimColour: string | null;
  /** "Orerve Nebula, with Witch-fire trim". */
  finish: string;
  line: string;
  glow: string;
  fit: string[];
  luxuries: string[];
  /** What's aboard, with what each is: [name, blurb]. */
  aboard: string[][];
  /** How hard she glows (the renderer's number). */
  glowLevel: number;
  /** Days the yard takes to finish one by hand. */
  finishDays: number;
  /** Black-light running lights aboard (the Dark Edition's luxury): drawn on her. */
  lights: boolean;
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

/** What a ship does out in the galaxy, beyond her file: the traffic (docs/design/the-world.md). */
const AT_WORK: Record<string, { heading: string; html: string }> = {
  titanoboa: {
    heading: 'Everyone calls her the Titan',
    html: `<p>Titanoboa is her name on Wexley-Yorozu's papers and in the module standard. Out in the galaxy, the news and the radio call her the Titan.</p>
      <p>She doesn't build alone. While a yard works, a Wexley-Yorozu Bullsnake comes in every eight minutes or so from a real neighbouring system, with what the stage needs: machinery and food while she refines, alloys and minerals for the station’s frame and plating, computers to spin it up. Company Vipers guard her yard, a lost guard replaced from her hold, and most runs to her fly with an escort. Hail a freighter on the way in and she'll say so: <q>Dry Dock, in from Atriso with alloys for the Titan.</q></p>
      <p>It's all the same on every phone: the freighter you pass is the one every commander there sees. <a href="/design/the-world/">How the galaxy flies</a>.</p>`,
  },
  bullsnake: {
    heading: 'Ore hauler and tug',
    html: `<p>Bullsnakes run ore from a moon into the Titan's maw. They're her tugs too: they fetch food and materials from the local station, ferry cargo and prisoners between the Titan and the surface, make repairs, and move her modules to set her up for the job. Every commander sees the same ones, at the same moment.</p>
    <p>They stay in the system: traders carry every good between the stars. The one exception is a module that has to travel. With an engine module and a fuel module stacked on its docking ring, and a Bullsnake docked in as its bridge, it flies to another system on its own. <a href="/design/ship-the-titanoboa/">The Titanoboa</a> · <a href="/design/the-world/">How the galaxy flies</a>.</p>`,
  },
};

const ROLE: Record<string, string> = {
  multirole: 'Multirole', pirate: 'Pirate', police: 'Police', marshal: 'Co-operative Marshals', miner: 'Ore hauler and tug', freighter: 'Constructor', station: 'Station',
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

/** The ship every commander is given: her list price is real (the yards charge it for a second), but nobody pays it to start (Game dev). */
const STARTER = 'cobra-mk3';

const STAT_LABELS: [string, string, (n: number) => string][] = [
  ['maxSpeed', 'Top speed', (n) => (n ? `${n} m/s` : 'None')],
  ['hull', 'Hull', (n) => n.toLocaleString('en-GB')],
  ['shields', 'Shields', (n) => n.toLocaleString('en-GB')],
  ['cargo', 'Hold', (n) => `${n} t`],
  ['missiles', 'Missiles', String],
  ['price', 'Price', (n) => (n ? `${n.toLocaleString('en-GB')} Cr` : 'Not for sale')],
];

function roleLine(s: ShipFile) {
  return [s.concept ? 'Built to order' : '', s.manufacturer && s.manufacturer !== 'None' ? s.manufacturer : '', ROLE[s.role ?? ''] ?? s.role ?? ''].filter(Boolean).join(' · ');
}

const shipCard = (s: ShipFile, own: boolean) => `    <a class="card link ship-card" href="/ships/${s.id}/">
      ${own ? '<span class="ship-badge">You can fly her</span>' : ''}
      ${shipSvg(s)}
      <h3>${esc(s.name)}</h3>
      <p class="muted">${esc(roleLine(s))}</p>
      ${s.stats && (s.stats.maxSpeed || s.stats.cargo) ? `<p class="ship-card-stats"><span>${s.stats.maxSpeed ? `${s.stats.maxSpeed} m/s` : 'No engines'}</span><span>${s.stats.cargo ? `${s.stats.cargo} t hold` : 'No hold'}</span></p>` : ''}
    </a>`;

/** The fleet's groups, in the hub's order: the ships you can own first, then who you'll meet out there. */
export const SHIP_GROUPS: { id: string; name: string; line: string; has: (s: ShipFile, own: boolean) => boolean }[] = [
  { id: 'own', name: 'Ships you can fly', line: 'Every commander starts in a Cobra. The Fer-de-lance is built to order at the shipyards; more hulls go on sale when the yards sell them outright.', has: (_, own) => own },
  { id: 'law', name: 'The law', line: 'The police where a station keeps order, and the Co-operative Marshals when a warrant comes due.', has: (s) => s.role === 'police' || s.role === 'marshal' },
  { id: 'pirates', name: 'Pirates and Legends', line: 'The Sidewinder and the Mamba are the pirates’ favourites, and on the shipyards’ lists for when the yards sell hulls outright. Some ships are only ever met.', has: (s) => s.role === 'pirate' },
  { id: 'industry', name: 'Industry', line: 'Wexley-Yorozu’s yards: the Titan that builds stations, and the freighters that feed her.', has: (s) => s.role === 'miner' || s.role === 'freighter' },
  { id: 'stations', name: 'Stations', line: 'Where you dock, trade, refit and take on work.', has: (s) => s.role === 'station' },
  { id: 'more', name: 'More ships', line: 'The rest of the fleet.', has: () => true },
];

/** The order within a group: the one you meet first, first (the rest after, A to Z). */
const FIRST = ['cobra-mk3', 'fer-de-lance', 'sidewinder', 'mamba', 'falcon', 'viper', 'lancer', 'bastion', 'titanoboa', 'bullsnake'];
const rank = (s: ShipFile) => (FIRST.includes(s.id) ? FIRST.indexOf(s.id) : FIRST.length);

/** Each ship in her group: the first group that has her, so no ship shows twice. */
export function groupShips(ships: ShipFile[], ownable: (s: ShipFile) => boolean) {
  const placed = new Set<string>();
  const ordered = [...ships].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return SHIP_GROUPS.map((g) => ({ ...g, ships: ordered.filter((s) => !placed.has(s.id) && g.has(s, ownable(s)) && placed.add(s.id)) })).filter((g) => g.ships.length);
}

export function shipsIndex(ships: ShipFile[], ownable: (s: ShipFile) => boolean): string {
  const groups = groupShips(ships, ownable);
  return `<section class="section">
  <div class="section-head">
    <p class="kicker">The fleet</p>
    <h1>Ships of Witchspace</h1>
    <p class="lede">Every commander starts in a Cobra. Where you go from there decides what you fly, and what flies at you. Every ship here is a small open file anyone can improve.</p>
    <p class="ship-jump">${groups.map((g) => `<a href="#${g.id}">${esc(g.name)}</a>`).join(' · ')} · <a href="#make">Add to the fleet</a></p>
  </div>
${groups
  .map(
    (g) => `  <div class="ship-group" id="${g.id}">
    <h2>${esc(g.name)}</h2>
    <p class="muted">${g.line}</p>
    <div class="ship-grid">
${g.ships.map((s) => shipCard(s, ownable(s))).join('\n')}
    </div>
  </div>`,
  )
  .join('\n')}
  <div class="ship-group ship-make" id="make">
    <h2>Add to the fleet</h2>
    <p class="muted">Every ship here began as somebody’s idea. The next one could be yours.</p>
    <div class="make-grid">
      <a class="card link make-card" href="/ship-editor/">
        <span class="make-glyph" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M6 30 L24 12 L42 30 L24 36 Z M24 12 L24 36" /></svg></span>
        <h3>Build a ship</h3>
        <p>Shape her from points in the ship editor, watch her glow, and hand her in. No code, no GitHub.</p>
        <span class="button primary small">Open the ship editor</span>
      </a>
      <a class="card link make-card idea" href="/ideas/?about=${encodeURIComponent('A new ship')}">
        <span class="make-glyph" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 8 a11 11 0 0 1 7 19.5 V32 H17 V27.5 A11 11 0 0 1 24 8 Z M18 37 H30 M20 41 H28" /></svg></span>
        <h3>Got an idea for one?</h3>
        <p>Describe the ship you’d love to meet out there, and someone may draw her. Vote up the ideas you want flying.</p>
        <span class="button small">Share your idea</span>
      </a>
    </div>
    <p class="muted small">Rather ask your AI assistant? <a href="/get-involved/#ai">Add Witchspace to it</a>, ask for the ship you have in mind, and it checks her against the game’s rules. Wexley-Yorozu’s fleet office is hiring, too: <a href="/jobs/#build">Hull Designer, Fleet Office</a>. Nods to films and books are welcome, copies of their designs aren’t (<a href="${REPO}CONTRIBUTING.md#legends-and-homages">the rules on homages</a>). If you code: ships live in <a href="https://github.com/witchspace-game/witchspace/tree/main/content/ships">content/ships</a> on GitHub, open to pull requests.</p>
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
      return `<li><strong><a href="${modulePath(m.id)}">${esc(m.name)}</a>${count > 1 ? ` ×${count}` : ''}</strong> <span class="muted small">${m.length} m · ${esc(m.zone)} · designed by ${esc(m.designer)}</span><br>${esc(m.description)} <a class="small" href="/submit/?module=${esc(m.id)}&amp;as=improve">Improve it</a></li>`;
    })
    .join('');
  // Sections that aren't in the Standard line-up but are fitted when the job needs them.
  const extra = [...modules.values()].filter((m) => !s.modules!.includes(m.id)).sort(byZone);
  return `<div class="card ship-modules">
      <h3>Built from modules</h3>
      <p>Fore to aft: ${s.modules.map((id) => esc(modules.get(id)?.name ?? id)).join(' → ')}. Every module couples the same way, so the line-up changes with the job. Every one is open for anyone to improve, and anyone can design a new one to <a href="/design/ship-the-titanoboa/#designing-a-module-the-standard">the standard</a>.</p>
      <ul>${rows}</ul>
      ${extra.length ? `<p class="small">Fitted when the job needs them: ${extra.map((m) => `<a href="${modulePath(m.id)}">${esc(m.name)}</a>`).join(', ')}.</p>` : ''}
    </div>`;
}

const MODULE_ZONES = ['intake', 'industry', 'logistics', 'crew', 'fabrication', 'add-on', 'power'];
const byZone = (a: ModuleFile, b: ModuleFile) => MODULE_ZONES.indexOf(a.zone) - MODULE_ZONES.indexOf(b.zone);
export const modulePath = (id: string) => `/ships/titanoboa/modules/${encodeURIComponent(id)}/`;

/** What each zone is for, in the module standard's words (docs/design/ship-the-titanoboa.md). */
const ZONE_WORDS: Record<string, string> = {
  intake: 'Intake: the prow, facing the moon.',
  industry: 'Industry: the hot, dirty work, where nobody lives.',
  logistics: 'Logistics: storage, and the tugs’ pads.',
  crew: 'Crew: where the workers live, shielded both ways.',
  fabrication: 'Fabrication: where station sections are made.',
  'add-on': 'Add-on: fitted for the job, and often left with the station.',
  power: 'Power: the stern, where its heat and shadow fall on nobody.',
};

/** One Titanoboa module's own page: the section turning, what it does, and how to improve it (Mark: every module open to the community). */
export function modulePage(m: ModuleFile & ModuleBody, titan: ShipFile, all: ModuleFile[]) {
  const order = [...all].sort(byZone);
  const i = order.findIndex((o) => o.id === m.id);
  const prev = order[(i - 1 + order.length) % order.length];
  const next = order[(i + 1) % order.length];
  const inStandard = titan.modules?.filter((id) => id === m.id).length ?? 0;
  const c = m.credits ?? {};
  const ends = [m.couples.fore && 'fore', m.couples.aft && 'aft'].filter(Boolean).join(' and ');
  const asShip = { id: m.id, name: m.name, geometry: m.geometry, style: titan.style } as ShipFile;
  const def = JSON.stringify({ id: m.id, name: m.name, role: titan.role, geometry: m.geometry, style: titan.style ?? {} }).replace(/</g, '\\u003c');
  const label = `Titanoboa ${m.name}`;
  return {
    card: { ship: 'titanoboa', kicker: 'Titanoboa module', title: m.name, sub: firstSentence(m.description) },
    schema: [
      {
        '@type': 'CreativeWork',
        name: label,
        description: m.description,
        creator: (c.authors ?? ['Witchspace contributors']).map((name) => ({ '@type': 'Organization', name })),
        license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        isPartOf: { '@type': 'CreativeWork', name: 'Titanoboa', url: 'https://witchspace.org.uk/ships/titanoboa/' },
      },
    ],
    title: `${m.name}: a Titanoboa module · Witchspace`,
    description: `The Titanoboa's ${m.name.toLowerCase()} module: ${m.description} Open for anyone to improve, in Witchspace, the free space game you play in your browser.`.slice(0, 300),
    content: `<section class="section ship-page module-page">
  <a class="back" href="/ships/titanoboa/">← The Titanoboa</a>
  <div class="ship-hero">
    <div class="ship-view" data-ship="${esc(m.id)}">
      ${shipSvg(asShip, 'ship-svg fallback')}
      <canvas class="ship-canvas" aria-label="The ${esc(m.name)} module, turning: drag to rotate"></canvas>
    </div>
    <div class="ship-copy">
      <p class="kicker">Titanoboa module · ${esc(m.zone)}</p>
      <h1>${esc(m.name)}</h1>
      <p class="lede">${esc(m.description)}</p>
      <dl class="ship-stats">
        <div><dt>Length</dt><dd>${m.length} m</dd></div>
        <div><dt>Couples</dt><dd>${ends ? `${ends[0].toUpperCase()}${ends.slice(1)}` : 'Neither end'}</dd></div>
        <div><dt>In the Standard</dt><dd>${inStandard ? (inStandard > 1 ? `×${inStandard}` : 'Yes') : 'When the job needs it'}</dd></div>
        <div><dt>Designed by</dt><dd>${esc(m.designer)}</dd></div>
      </dl>
      <p class="muted small">${esc(ZONE_WORDS[m.zone] ?? m.zone)}</p>
      <p class="ship-share"><a class="button primary small" href="/submit/?module=${esc(m.id)}&amp;as=improve">Improve this module</a> <button type="button" class="button ghost small" data-share data-share-url="${modulePath(m.id)}" data-share-title="${esc(label)}">Share</button></p>
    </div>
  </div>
  <script type="application/json" id="ship-def">${def}</script>

  <div class="ship-columns">
    <div class="card">
      <h3>Make it better</h3>
      <p>Every section of the Titanoboa is open. Redraw this one: a clearer shape, a better reason for where it sits, something it’s missing. Start from its file on the hand-in page, check it against the standard as you go, and send it. No GitHub needed. If it’s accepted, it goes into the game under your callsign, and the first time it’s fitted Wexley-Yorozu pays your commander 2,000 Cr.</p>
      <p><a class="button primary small" href="/submit/?module=${esc(m.id)}&amp;as=improve">Improve the ${esc(m.name.toLowerCase())}</a> <a class="button ghost small" href="/ideas/?about=${encodeURIComponent(label)}">Suggest an idea instead</a></p>
      <ul class="ship-ideas" data-ship-name="${esc(label)}"><li class="muted">Looking for ideas about the ${esc(m.name.toLowerCase())}…</li></ul>
      <p class="muted small">Drawn by ${esc((c.authors ?? []).join(', ') || m.designer)}${c.aiAssisted ? ', with AI assistance' : ''}. Licence: ${esc(c.license ?? 'CC-BY-SA-4.0')}. <a href="${REPO}content/modules/${esc(m.id)}.json">The file on GitHub</a>.</p>
    </div>
    <div class="card">
      <h3>Or design a new one</h3>
      <p>The Titanoboa is whatever the job needs: sections on one coupling, lined up for the work. Mining, building, hauling, or work the company would rather you didn’t ask about. A prison module is on the drawing board. Couple enough of them to a habitat and a science module (its sealed pods can be ejected if anything gets out) and you have a prison Titanoboa with a research wing, her Bullsnake tugs ferrying inmates down to the surface and back. Wexley-Yorozu calls it rehabilitation. Two more are wanted for the long haul between stars: an engine module and a fuel module, thrown away when it runs dry. Stack them on any module’s docking ring, dock a Bullsnake in its ring as the bridge, and that module can fly to another system on its own. Draw the module you think she’s missing: if it’s built, your commander is paid 5,000 Cr.</p>
      <p><a class="button ghost small" href="/submit/?module=${esc(m.id)}&amp;as=new">Start a new module from this one</a> <a class="button ghost small" href="/design/ship-the-titanoboa/#designing-a-module-the-standard">The standard</a></p>
    </div>
  </div>

  <nav class="module-nav" aria-label="The other modules"><a href="${modulePath(prev.id)}">← ${esc(prev.name)}</a><a href="/ships/titanoboa/">All of the Titan</a><a href="${modulePath(next.id)}">${esc(next.name)} →</a></nav>
</section>`,
  };
}

/** A module file's drawing and credits, beyond what the ship page lists. */
export interface ModuleBody {
  couples: { fore: boolean; aft: boolean };
  geometry: ShipFile['geometry'];
  credits?: ShipFile['credits'];
}

/**
 * A ship's page. `preview` is for a ship file from a link (/ship-preview/):
 * not in the fleet yet, so no GitHub file, ideas or share address of its own.
 */
export function shipPage(s: ShipFile, modules: Map<string, ModuleFile> = new Map(), preview = false, editions: EditionCard[] = [], manual = false) {
  const c = s.credits ?? {};
  const stats = STAT_LABELS.filter(([k]) => s.stats?.[k] !== undefined)
    .map(([k, label, f]) => `<div><dt>${label}</dt><dd>${esc(f(s.stats![k]))}${k === 'price' && s.id === STARTER ? '<small>Every commander starts in one</small>' : ''}</dd></div>`)
    .join('');
  const design = DESIGN[s.id];
  const authors = (c.authors ?? []).join(', ') || 'Witchspace contributors';
  const def = JSON.stringify({ id: s.id, name: s.name, role: s.role, geometry: s.geometry, style: s.style ?? {}, insignia: s.insignia }).replace(/</g, '\\u003c');
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
      ${s.concept ? '<p class="concept-note">Built to order: spec her, put down a tenth, and collect her from the yard in a few days.</p>' : ''}
      ${stats ? `<dl class="ship-stats">${stats}</dl>` : ''}
      <p class="ship-share"><button type="button" class="button ghost small" data-share${preview ? '' : ` data-share-url="/ships/${esc(s.id)}/"`} data-share-title="${esc(s.name)}">Share the ${esc(s.name)}</button>${manual ? ` <a class="button ghost small" href="/ships/${esc(s.id)}/manual/">Owner’s manual</a>` : ''}</p>
      ${manual ? `<p class="ship-build"><a class="button primary" href="/ships/${esc(s.id)}/build/">Build yours</a></p>` : ''}
    </div>
  </div>
  <script type="application/json" id="ship-def">${def}</script>
  ${modulesCard(s, modules)}
  ${!preview && AT_WORK[s.id] ? `<div class="card ship-at-work"><h3>${AT_WORK[s.id].heading}</h3>${AT_WORK[s.id].html}</div>` : ''}
  ${editionsCard(editions, s.id)}

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
function editionsCard(editions: EditionCard[], ship: string): string {
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
      <p class="edition-price"><b>By invitation</b> · signed over to the people who build Witchspace.</p>
      <p class="edition-see"><a class="button ghost small" href="/ships/${esc(ship)}/${esc(e.id)}/">See the ${esc(e.name)} →</a> <a class="button ghost small" href="/ships/${esc(ship)}/build/#edition=${esc(e.id)}">Name yours</a></p>
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
export function buildPage(s: ShipFile, names: Record<string, string>) {
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
      <p class="lede">${s.concept ? `${esc(s.manufacturer ?? 'Her makers')} build her to order. Spec her here, and the deposit is one tap at the next shipyard you dock at.` : `Spec her here, and she’s waiting at the next shipyard you dock at.`}</p>
      <div id="build-models"></div>
      <nav class="build-steps" id="build-steps" aria-label="Steps"></nav>
      <div id="build-options"></div>
      <div class="build-account" id="account" hidden></div>
    </div>
  </div>
  <div class="build-bar" id="build-bar" aria-live="polite"></div>
  <script type="application/json" id="ship-def">${def}</script>
  <script type="application/json" id="yard-names">${JSON.stringify(names).replace(/</g, '\\u003c')}</script>
</section>`,
  };
}

/**
 * A numbered edition's own page (Mark: "surely the special editions would have their own marketing page"): she
 * turns in her paint, and the yard's office says how many are left (src/site/edition.ts). Editions are by
 * invitation: the maker signs them over to contributors (Mark: "if you have to ask, you can't afford it"), so the
 * page sends you to name one in the configurator and share her, not to reserve one, and shows no price.
 */
export function editionPage(s: ShipFile, e: EditionCard, others: EditionCard[]) {
  const def = JSON.stringify({ id: s.id, name: s.name, role: s.role, geometry: s.geometry, style: s.style ?? {}, insignia: s.insignia }).replace(/</g, '\\u003c');
  const look = JSON.stringify({ colour: e.colour, glow: e.glowLevel, trim: e.trimColour, ...(e.lights ? { lights: true } : {}) });
  const no = (n: number) => String(n).padStart(3, '0');
  const maker = s.manufacturer && s.manufacturer !== 'None' ? s.manufacturer : 'The yard';
  return {
    card: { ship: s.id, kicker: `${maker} · ${e.limit} built`, title: e.name, sub: e.blurb.split('. ')[0] + '.', paint: { colour: e.colour, glow: e.glowLevel, trim: e.trimColour, ...(e.lights ? { lights: true } : {}) } },
    schema: [{ '@type': 'CreativeWork', name: `${s.name} ${e.name}`, description: e.blurb, about: { '@type': 'CreativeWork', name: s.name, url: `https://witchspace.org.uk/ships/${s.id}/` }, isPartOf: { '@type': 'VideoGame', name: 'Witchspace', url: 'https://witchspace.org.uk/play/' } }],
    title: `${e.name} · ${s.name} · Ships · Witchspace`,
    description: `The ${s.name} ${e.name}: ${e.blurb} ${e.limit} built, signed over by invitation to the people who build Witchspace. Name yours in the configurator and share her.`.slice(0, 300),
    content: `<section class="section ship-page edition-page" style="--edition:${esc(e.colour)};--trim:${esc(e.trimColour ?? e.colour)}">
  <a class="back" href="/ships/${esc(s.id)}/">← The ${esc(s.name)}</a>
  <div class="edition-stage">
    <div class="ship-view edition-view" data-look='${esc(look)}'>
      ${shipSvg(s, 'ship-svg fallback')}
      <canvas class="ship-canvas" aria-label="The ${esc(e.name)}, turning: drag to rotate"></canvas>
    </div>
  </div>
  <header class="edition-head">
    <p class="kicker">${esc(maker)} · ${esc(s.name)} · Special edition</p>
    <h1>${esc(e.name)}</h1>
    <p class="lede">${esc(e.blurb)}</p>
    <ul class="edition-facts">
      <li><b data-edition-left="${esc(e.id)}" data-limit="${e.limit}">${e.limit}</b><span>built, numbered</span></li>
      <li><b>${esc(e.glow.replace(/ glow$/, ''))}</b><span>glow</span></li>
      <li><b>${e.finishDays} days</b><span>finished by hand</span></li>
    </ul>
    <p class="connect-buttons"><a class="button primary big" href="/ships/${esc(s.id)}/build/#edition=${esc(e.id)}">Name yours and share her</a> <a class="button ghost big" href="/ships/${esc(s.id)}/build/">Spec your own ${esc(s.name)}</a> <button type="button" class="button ghost big" data-share data-share-url="/ships/${esc(s.id)}/${esc(e.id)}/" data-share-title="The ${esc(s.name)} ${esc(e.name)}">Share this page</button></p>
  </header>

  <div class="edition-sections">
    <section class="card edition-number">
      <p class="kicker">One of ${e.limit}</p>
      <h2 data-edition-count="${esc(e.id)}">Numbered 001 to ${no(e.limit)}</h2>
      <p>Each one carries its number painted beside its name, from 001 to ${no(e.limit)}. Numbers are given out in order by the yard’s office, for the whole galaxy: when they’re gone, they’re gone.</p>
    </section>
    <section class="card">
      <p class="kicker">The finish</p>
      <h2><span class="edition-swatch" aria-hidden="true"></span>${esc(e.finish)}</h2>
      ${e.line ? `<p>${esc(e.line)}</p>` : ''}
      <p class="muted">${esc(e.glow.replace(/ glow$/, ''))} glow. These colours are hers alone: nobody can order them on another ship.</p>
    </section>
    <section class="card">
      <p class="kicker">Fitted</p>
      <ul class="edition-list">${e.fit.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    </section>
    <section class="card">
      <p class="kicker">Aboard</p>
      <dl class="edition-aboard">${e.aboard.map(([n, b]) => `<div><dt>${esc(n)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
    </section>
  </div>

  <section class="card edition-reserve" id="invitation">
    <p class="kicker">By invitation</p>
    <h2>If you have to ask, you can’t afford one</h2>
    <p>The ${esc(e.name)} isn’t on the yard’s list. Special editions are by invitation: for now, the maker signs them over to the people who build Witchspace, whether they write code, draw ships, write lore or test.</p>
    <p>Anyone can name one and share her, in the configurator.</p>
    <p class="connect-buttons"><a class="button primary" href="/ships/${esc(s.id)}/build/#edition=${esc(e.id)}">Name yours and share her</a> <a class="button ghost" href="/get-involved/">Get involved</a></p>
  </section>

  <section class="edition-more">
    ${others.map((o) => `<a class="card link edition-other" href="/ships/${esc(s.id)}/${esc(o.id)}/" style="--edition:${esc(o.colour)}"><span class="kicker">Also numbered · ${o.limit} built</span><h3>${esc(o.name)}</h3><p>${esc(o.blurb)}</p></a>`).join('')}
    <a class="card link edition-other" href="/ships/${esc(s.id)}/build/"><span class="kicker">Or your own way</span><h3>Spec your own ${esc(s.name)}</h3><p>Your colour, your glow, your name and your fit-out, priced as you go.</p></a>
  </section>
  <script type="application/json" id="ship-def">${def}</script>
</section>`,
  };
}

/**
 * A numbered ship's papers: the maker's certificate of build, at /ships/<ship>/<edition>/<no>/ (vercel.json sends
 * every number to this one page). Private to her owner: the facts come from the yard's office only with the token
 * in her owner's link (#t=…), so nobody can walk the numbers and list who holds them (docs/design/edition-certificate.md).
 * This is the frame; src/site/papers.ts fills it in.
 */
export function papersPage(s: ShipFile, e: EditionCard) {
  const def = JSON.stringify({ id: s.id, name: s.name, role: s.role, geometry: s.geometry, style: s.style ?? {}, insignia: s.insignia }).replace(/</g, '\\u003c');
  const look = JSON.stringify({ colour: e.colour, glow: e.glowLevel, trim: e.trimColour, ...(e.lights ? { lights: true } : {}) });
  const maker = s.manufacturer && s.manufacturer !== 'None' ? s.manufacturer : 'The yard';
  const paper = JSON.stringify({ ship: s.id, edition: e.id, name: e.name, limit: e.limit, maker }).replace(/</g, '\\u003c');
  return {
    card: { ship: s.id, kicker: `${maker} · Certificate of build`, title: e.name, sub: `One of ${e.limit}, numbered, and signed over by the maker.`, paint: { colour: e.colour, glow: e.glowLevel, trim: e.trimColour, ...(e.lights ? { lights: true } : {}) } },
    schema: [],
    title: `Certificate of build · ${e.name} · Witchspace`,
    description: `${maker}’s certificate of build for a ${s.name} ${e.name}, one of ${e.limit}.`,
    head: '    <meta name="robots" content="noindex" />\n',
    content: `<section class="section papers-page" style="--edition:${esc(e.colour)};--trim:${esc(e.trimColour ?? e.colour)}">
  <article class="papers" aria-labelledby="papers-edition">
    <div class="ship-view papers-view" data-look='${esc(look)}'>
      ${shipSvg(s, 'ship-svg fallback')}
      <canvas class="ship-canvas" aria-label="The ${esc(e.name)}, turning: drag to rotate"></canvas>
    </div>
    <header class="papers-head">
      <p class="papers-maker">${esc(maker)}</p>
      <p class="papers-kind">Certificate of build</p>
      <h1 id="papers-edition">${esc(e.name)}</h1>
      <p class="papers-no"><b id="papers-no">No. ···</b> <span>of ${e.limit}</span></p>
    </header>
    <p class="papers-state" id="papers-state">Reading her papers…</p>
    <dl class="papers-rows" id="papers-rows" hidden></dl>
    <footer class="papers-foot" id="papers-foot" hidden>
      <p class="papers-one">One of ${e.limit}. The number is painted beside her name, and no other ship will carry it.</p>
      <p class="papers-sign">Signed for the yard: <b>${esc(maker)}</b><span id="papers-yard"></span></p>
    </footer>
  </article>
  <p class="connect-buttons papers-actions" id="papers-actions" hidden><button type="button" class="button primary" id="papers-save">Save as image</button> <button type="button" class="button ghost" id="papers-share" data-share data-share-title="${esc(e.name)}: her certificate of build">Share</button></p>
  <p class="papers-small">Witchspace is a free, open-source tribute to Elite (1984), not affiliated with Frontier. This certificate is for a ship in the game. <a href="/ships/${esc(s.id)}/${esc(e.id)}/">The ${esc(e.name)}</a></p>
  <script type="application/json" id="ship-def">${def}</script>
  <script type="application/json" id="papers-def">${paper}</script>
</section>`,
  };
}
