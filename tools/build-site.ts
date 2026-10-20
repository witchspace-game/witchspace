// Builds the website's pages from site/ (hand-written pages) and docs/
// (design documents in Markdown). Runs before `vite` and `vite build`.
// Generated pages are git-ignored; edit the sources instead.

import { marked, type Tokens } from 'marked';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const REPO = 'https://github.com/witchspace-game/witchspace/blob/main/';
const template = readFileSync(join(root, 'site/template.html'), 'utf8');

const NAV = [
  ['/', 'Home'],
  ['/design/', 'Design'],
  ['/get-involved/', 'Get involved'],
  ['/about/', 'About'],
] as const;

interface Page {
  path: string; // URL path, ending in '/'
  title: string;
  description: string;
  content: string;
  scripts?: string[];
  bodyClass?: string;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function render(page: Page): string {
  const section = '/' + (page.path.split('/')[1] ?? '') + (page.path === '/' ? '' : '/');
  const nav = NAV.map(([href, label]) => {
    const current = href === '/' ? page.path === '/' : section === href;
    return `<a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  }).join('\n        ');
  const scripts = (page.scripts ?? []).map((src) => `    <script type="module" src="${src}"></script>`).join('\n');
  return template
    .replaceAll('{{title}}', escapeAttr(page.title))
    .replaceAll('{{description}}', escapeAttr(page.description))
    .replace('{{bodyClass}}', page.bodyClass ?? '')
    .replace('{{nav}}', nav)
    .replace('{{content}}', page.content)
    .replace('{{scripts}}', scripts);
}

function write(page: Page) {
  const file = join(root, page.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(page));
}

// --- Hand-written pages ---------------------------------------------------------

for (const name of readdirSync(join(root, 'site/pages'))) {
  const html = readFileSync(join(root, 'site/pages', name), 'utf8');
  const meta = JSON.parse(html.match(/^<!--\s*(\{.*?\})\s*-->/s)![1]);
  write({ ...meta, content: html.replace(/^<!--.*?-->\s*/s, '') });
}

// --- Design documents from Markdown -------------------------------------------

/** GitHub-style heading anchors, so links like #9-power-and-protection work. */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\- ]/gu, '')
    .trim()
    .replace(/ /g, '-');

const DOCS: { file: string; slug: string; blurb: string }[] = [
  { file: 'docs/design/law-and-travel.md', slug: 'law-and-travel', blurb: 'Transponders, the law, surrender, getting caught, disabling and capture, fuel and rescue, insurance, loans and loan sharks, the Co-operative Marshals, and travel pacing.' },
  { file: 'docs/design/economy-and-exchanges.md', slug: 'economy-and-exchanges', blurb: 'Living markets, news that travels, station exchanges, local currencies, contracts and futures, station shares, and fair play. All in-game, no crypto.' },
  { file: 'docs/design/stations-and-worlds.md', slug: 'stations-and-worlds', blurb: 'Physical limits: station classes, ship sizes, docking capacity, how many stations a world can support, supply and decline, rivals and allies.' },
  { file: 'docs/design/player-stations.md', slug: 'player-stations', blurb: 'Stations run by players, guilds, the community and AI agents, earned by contributing and funded by trading profits.' },
  { file: 'docs/ideas.md', slug: 'ideas', blurb: 'Ideas that aren\'t designed yet, from multicrew ships to a streamer mode. The community votes on what comes next.' },
];
const bySource = new Map(DOCS.map((d) => [d.file, d]));

let currentSource = '';

/** Point links at site pages where we have them, otherwise at GitHub. */
function rewriteHref(href: string): string {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [path, hash] = href.split('#');
  const target = posix.normalize(posix.join(posix.dirname(currentSource), path || posix.basename(currentSource)));
  const doc = bySource.get(target);
  if (doc) return `/design/${doc.slug}/${hash ? '#' + hash : ''}`;
  if (target === 'README.md' && hash === 'roadmap') return '/design/#roadmap';
  return REPO + target + (hash ? '#' + hash : '');
}

marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }: Tokens.Heading) {
      return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
  walkTokens(token) {
    if (token.type === 'link') token.href = rewriteHref(token.href);
  },
});

const docMeta = DOCS.map((d) => {
  const md = readFileSync(join(root, d.file), 'utf8');
  const raw = md.match(/^# (.+)$/m)![1].replace(/^(Design|Proposal):\s*/, '');
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);
  const status = /status: \*\*proposal/i.test(md) ? 'proposal' : d.slug === 'ideas' ? 'ideas' : 'agreed';
  currentSource = d.file;
  const html = marked.parse(md) as string;
  write({
    path: `/design/${d.slug}/`,
    title: `${title} · Witchspace`,
    description: d.blurb,
    content: `<article class="section doc">\n<a class="back" href="/design/">← All design documents</a>\n${html}</article>`,
  });
  return { ...d, title, status };
});

// --- Design index -------------------------------------------------------------

const roadmap = readFileSync(join(root, 'README.md'), 'utf8').match(/## Roadmap\n([\s\S]*?)\n## /)![1];
currentSource = 'README.md';
const roadmapHtml = marked.parse(roadmap) as string;
const statusLabel = { agreed: 'Agreed', proposal: 'Proposal', ideas: 'Ideas' } as const;

write({
  path: '/design/',
  title: 'Design · Witchspace',
  description: 'How Witchspace is being designed, in the open: agreed designs, proposals for discussion, the ideas backlog and the roadmap.',
  content: `<section class="section">
  <h2>Design</h2>
  <p class="lede">Witchspace is designed in the open. Ideas are discussed and written down before they're built, so anyone can see where the game is going and help shape it.</p>
  <div class="grid">
${docMeta
  .map(
    (d) => `    <a class="card" href="/design/${d.slug}/" style="text-decoration:none">
      <span class="tag ${d.status}">${statusLabel[d.status as keyof typeof statusLabel]}</span>
      <h3>${d.title}</h3>
      <p>${d.blurb}</p>
    </a>`,
  )
  .join('\n')}
  </div>
</section>
<section class="section doc" id="roadmap">
  <h2>Roadmap</h2>
${roadmapHtml}
</section>`,
});

const generated = ['index.html', ...NAV.slice(1).map(([p]) => p.slice(1) + 'index.html'), ...docMeta.map((d) => `design/${d.slug}/index.html`)];
console.log(`Built ${generated.length} pages: ${generated.map((f) => relative(root, join(root, f))).join(', ')}`);
