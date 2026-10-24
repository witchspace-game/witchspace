// The website's ship pages: an index of the fleet, and a page for each ship
// with its story, its stats, who designed it, and how to make it better.
// Everything comes from the ship's own file in content/ships/.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'https://github.com/witchspace-game/witchspace/blob/main/';

interface ShipFile {
  id: string;
  name: string;
  manufacturer?: string;
  role?: string;
  description?: string;
  credits?: { authors?: string[]; license?: string; aiAssisted?: boolean; notes?: string };
  geometry: { vertices: number[][]; faces: number[][]; details?: { vertices: number[][]; lines: number[][] } };
  stats?: Record<string, number>;
  style?: { lineColor?: string };
}

/** Ships worth a page: the fleet, not the props. */
const SKIP = new Set(['missile', 'cargo-canister']);
/** Shown first: the ship every commander starts in. */
const FIRST = 'cobra-mk3';

/** Where a ship's design is written down, when it has more than its file. */
const DESIGN: Record<string, { href: string; label: string }> = {
  falcon: { href: REPO + 'docs/design/legends-the-falcon.md', label: 'The Falcons, a Legend' },
  titanoboa: { href: REPO + 'docs/design/companies-and-contracts.md#4b-building-worlds', label: 'Building worlds: the yards' },
  bullsnake: { href: REPO + 'docs/companies.md#its-ship-the-bullsnake', label: 'Wexley-Yorozu and its ships' },
  lancer: { href: '/design/law-and-travel/#9-power-and-protection', label: 'The Co-operative Marshals' },
  bastion: { href: '/design/law-and-travel/#9-power-and-protection', label: 'The Co-operative Marshals' },
};

const ROLE: Record<string, string> = {
  multirole: 'Multirole', pirate: 'Pirate', police: 'Police', marshal: 'Co-operative Marshals', miner: 'Ore hauler', freighter: 'Constructor', station: 'Station',
};

/** The first sentence, for a share card's line. */
const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim().slice(0, 120);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loadShips(root: string): ShipFile[] {
  const dir = join(root, 'content/ships');
  const all = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ShipFile)
    .filter((s) => !SKIP.has(s.id));
  return all.sort((a, b) => (a.id === FIRST ? -1 : b.id === FIRST ? 1 : a.name.localeCompare(b.name)));
}

/**
 * A wireframe drawing of the ship, seen from above and to one side, as an
 * SVG: drawn when the site is built, so the index costs nothing to load.
 */
export function shipSvg(s: ShipFile, cls = 'ship-svg'): string {
  const yaw = -0.7;
  const pitch = 0.45;
  const project = ([x, y, z]: number[]) => {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    return [x1, -y1];
  };
  const edges = new Set<string>();
  const hull: [number[], number[]][] = [];
  for (const f of s.geometry.faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (edges.has(k)) continue;
      edges.add(k);
      hull.push([project(s.geometry.vertices[a]), project(s.geometry.vertices[b])]);
    }
  }
  const d = s.geometry.details;
  const detail = (d?.lines ?? []).map(([a, b]) => [project(d!.vertices[a]), project(d!.vertices[b])] as [number[], number[]]);
  const pts = [...hull, ...detail].flat();
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
  ['maxSpeed', 'Top speed', (n) => `${n} m/s`],
  ['hull', 'Hull', (n) => n.toLocaleString('en-GB')],
  ['shields', 'Shields', (n) => n.toLocaleString('en-GB')],
  ['cargo', 'Hold', (n) => `${n} t`],
  ['missiles', 'Missiles', String],
  ['price', 'Price', (n) => (n ? `${n.toLocaleString('en-GB')} Cr` : 'Not for sale')],
];

function roleLine(s: ShipFile) {
  return [s.manufacturer && s.manufacturer !== 'None' ? s.manufacturer : '', ROLE[s.role ?? ''] ?? s.role ?? ''].filter(Boolean).join(' · ');
}

export function shipsIndex(ships: ShipFile[]): string {
  return `<section class="section">
  <div class="section-head">
    <p class="kicker">The fleet</p>
    <h2>Ships</h2>
    <p class="lede">Every ship in Witchspace is a small file anyone can read, improve or add to. Here's the fleet so far, who flies each one, and who drew it.</p>
  </div>
  <div class="ship-grid">
${ships
  .map(
    (s) => `    <a class="card link ship-card" href="/ships/${s.id}/">
      ${shipSvg(s)}
      <h3>${esc(s.name)}</h3>
      <p class="muted">${esc(roleLine(s))}</p>
    </a>`,
  )
  .join('\n')}
  </div>
  <div class="ship-make">
    <h3>Design a ship</h3>
    <p>Ships are JSON files in <a href="https://github.com/witchspace-game/witchspace/tree/main/content/ships">content/ships</a>: points, faces and a few glowing details. Drop one in and it's in the game. Read <a href="${REPO}CONTRIBUTING.md">how to contribute</a>, including <a href="${REPO}CONTRIBUTING.md#legends-and-homages">the rules on homages</a>: nods to films and books are welcome, copies of their designs aren't.</p>
  </div>
</section>`;
}

export function shipPage(s: ShipFile) {
  const c = s.credits ?? {};
  const stats = STAT_LABELS.filter(([k]) => s.stats?.[k] !== undefined)
    .map(([k, label, f]) => `<div><dt>${label}</dt><dd>${esc(f(s.stats![k]))}</dd></div>`)
    .join('');
  const design = DESIGN[s.id];
  const authors = (c.authors ?? []).join(', ') || 'Witchspace contributors';
  const def = JSON.stringify({ id: s.id, name: s.name, geometry: s.geometry, style: s.style ?? {} }).replace(/</g, '\\u003c');
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
  <div class="ship-hero">
    <div class="ship-view" data-ship="${esc(s.id)}">
      ${shipSvg(s, 'ship-svg fallback')}
      <canvas class="ship-canvas" aria-label="${esc(s.name)}, turning: drag to rotate"></canvas>
    </div>
    <div class="ship-copy">
      <p class="kicker">${esc(roleLine(s))}</p>
      <h1>${esc(s.name)}</h1>
      <p class="lede">${esc(s.description ?? '')}</p>
      ${stats ? `<dl class="ship-stats">${stats}</dl>` : ''}
      <p class="ship-share"><button type="button" class="button ghost small" data-share data-share-url="/ships/${esc(s.id)}/" data-share-title="${esc(s.name)}">Share the ${esc(s.name)}</button></p>
    </div>
  </div>
  <script type="application/json" id="ship-def">${def}</script>

  <div class="ship-columns">
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
      <p class="muted small">Want to redraw it yourself? Edit <a href="${REPO}content/ships/${esc(s.id)}.json">its file</a> and open a pull request: see <a href="${REPO}CONTRIBUTING.md">how to contribute</a>.</p>
    </div>
  </div>
</section>`,
  };
}
