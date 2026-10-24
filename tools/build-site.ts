// Builds the website's pages from site/ (hand-written pages) and docs/
// (design documents in Markdown). Runs before `vite` and `vite build`.
// Generated pages are git-ignored; edit the sources instead.

import { marked, type Tokens } from 'marked';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { galleryData, galleryHtml, itemPage, links, loadMedia, shareImage } from './media';
import { loadShips, shipPage, shipsIndex } from './ships';

const root = resolve(import.meta.dirname, '..');
const REPO = 'https://github.com/witchspace-game/witchspace/blob/main/';
const SITE = 'https://witchspace.org.uk';
const media = loadMedia(root);
const template = readFileSync(join(root, 'site/template.html'), 'utf8');

const NAV = [
  ['/', 'Home'],
  ['/ships/', 'Ships'],
  ['/design/', 'Design'],
  ['/ideas/', 'Ideas'],
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
  /** The share card image (1200×630); defaults to the featured press image. */
  image?: string;
  /** Extra tags for <head>. */
  head?: string;
  /** This page's own branded share card (tools/share-cards.mjs makes it): the ship on it, a kicker and a line. */
  card?: { ship: string; kicker: string; sub: string; title?: string };
  /** Structured data for search engines (schema.org), besides the site and breadcrumbs added to every page. */
  schema?: Record<string, unknown>[];
}

// --- Share cards and structured data ----------------------------------------------

/** Every page's card, for tools/share-cards.mjs to photograph into public/share/. */
const cards: { file: string; ship: string; kicker: string; title: string; sub: string }[] = [];
const cardFile = (path: string) => (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-')) + '.jpg';

/** Branded cards for the hand-written pages (ships and design docs get theirs where they're made). */
const PAGE_CARDS: Record<string, NonNullable<Page['card']>> = {
  '/': { ship: 'cobra-mk3', kicker: 'A love letter to Elite (1984)', title: 'Trade. Fight. Explore.', sub: 'Glowing vector ships, eight galaxies, and the original look one key away.' },
  '/about/': { ship: 'cobra-mk3', kicker: 'About', sub: 'An unofficial, non-commercial tribute to Elite (1984), made in the open.' },
  '/get-involved/': { ship: 'viper', kicker: 'Get involved', sub: 'Design ships, write lore, build missions, playtest or code.' },
  '/ideas/': { ship: 'cobra-mk3', kicker: 'Ideas', title: 'What should Witchspace do next?', sub: 'Suggest an idea, or vote the ones you care about up or down.' },
  '/press/': { ship: 'falcon', kicker: 'Press kit', sub: 'Screenshots, video, facts and words about Witchspace.' },
  '/privacy/': { ship: 'coriolis', kicker: 'Privacy', sub: 'What Witchspace keeps about you, why, and how to delete it.' },
  '/careers/': { ship: 'bullsnake', kicker: 'Careers', title: 'Careers in the eight galaxies', sub: 'Four companies are hiring pilots. Fly for one.' },
};

const ORG = { '@type': 'Organization', name: 'Witchspace', url: SITE, logo: `${SITE}/icons/icon-512.png`, sameAs: ['https://github.com/witchspace-game/witchspace'] };
const GAME = {
  '@type': 'VideoGame',
  name: 'Witchspace',
  url: `${SITE}/play/`,
  description: 'A free, open-source space trading and combat game in your browser: a love letter to Elite (1984).',
  genre: ['Space trading', 'Space combat', 'Simulation'],
  gamePlatform: 'Web browser',
  applicationCategory: 'Game',
  operatingSystem: 'Any (web browser)',
  playMode: ['SinglePlayer', 'MultiPlayer'],
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
  license: 'https://www.gnu.org/licenses/gpl-3.0.html',
  publisher: ORG,
};

/** Names for breadcrumbs, by URL section. */
const SECTION_NAMES: Record<string, string> = { ships: 'Ships', design: 'Design', press: 'Press kit', ideas: 'Ideas', about: 'About', 'get-involved': 'Get involved', privacy: 'Privacy', careers: 'Careers' };

function structuredData(page: Page, image: string): string {
  const parts = page.path.split('/').filter(Boolean);
  const name = page.title.replace(/ · .*$/, '');
  const crumbs = [{ name: 'Witchspace', url: `${SITE}/` }];
  if (parts.length) crumbs.push({ name: SECTION_NAMES[parts[0]] ?? name, url: `${SITE}/${parts[0]}/` });
  if (parts.length > 1) crumbs.push({ name, url: SITE + page.path });
  const graph: Record<string, unknown>[] = [
    page.path === '/' ? { '@type': 'WebSite', name: 'Witchspace', url: `${SITE}/`, description: page.description, publisher: ORG } : { '@type': 'WebPage', name, url: SITE + page.path, description: page.description, image, isPartOf: { '@type': 'WebSite', name: 'Witchspace', url: `${SITE}/` } },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) },
    ...(page.path === '/' ? [{ ...GAME, image }] : []),
    ...(page.schema ?? []),
  ];
  return `    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function render(page: Page): string {
  const card = page.card ?? PAGE_CARDS[page.path];
  const title = card?.title ?? page.title.replace(/ · .*$/, '');
  if (card) cards.push({ file: cardFile(page.path), ship: card.ship, kicker: card.kicker, title, sub: card.sub });
  const own = card && existsSync(join(root, 'public/share', cardFile(page.path)));
  const image = page.image ?? (own ? `${SITE}/share/${cardFile(page.path)}` : shareImage(media));
  const imageAlt = own ? `${title}: ${card!.sub}` : page.title;
  const section = '/' + (page.path.split('/')[1] ?? '') + (page.path === '/' ? '' : '/');
  const nav = NAV.map(([href, label]) => {
    const current = href === '/' ? page.path === '/' : section === href;
    return `<a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  }).join('\n        ');
  // Every page can be shared (src/site/share.ts), so every page loads it.
  const scripts = [...new Set([...(page.scripts ?? []), '/src/site/share.ts'])].map((src) => `    <script type="module" src="${src}"></script>`).join('\n');
  return template
    .replaceAll('{{title}}', escapeAttr(page.title))
    .replaceAll('{{description}}', escapeAttr(page.description))
    .replaceAll('{{url}}', SITE + page.path)
    .replaceAll('{{image}}', escapeAttr(image))
    .replaceAll('{{imageAlt}}', escapeAttr(imageAlt))
    .replaceAll('{{path}}', page.path)
    .replaceAll('{{shareTitle}}', escapeAttr(title))
    .replace('{{head}}', (page.head ?? '') + structuredData(page, image))
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
  const content = html
    .replace(/^<!--.*?-->\s*/s, '')
    .replace('<!-- press:gallery -->', galleryHtml(media))
    .replace('<!-- press:data -->', galleryData(media))
    // {{media:<id>:large}} and the like: a press item's link at a given size.
    .replace(/\{\{media:([\w-]+):(large|og|direct)\}\}/g, (_, id: string, size: 'large' | 'og' | 'direct') => links(media, media.items.find((i) => i.id === id)!)[size]);
  write({ ...meta, content });
}

// --- A page per press image and video, so each can be shared on its own ------

/** When a file was first committed (for a video's upload date); the trailer's day if history is shallow. */
function addedOn(file: string): string {
  try {
    const dates = execFileSync('git', ['log', '--format=%cs', '--', file], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return dates[dates.length - 1] ?? '2026-10-21';
  } catch {
    return '2026-10-21';
  }
}

for (const item of media.items) {
  const p = itemPage(media, item, SITE);
  const l = links(media, item);
  const object =
    item.kind === 'video'
      ? { '@type': 'VideoObject', name: item.title, description: item.caption, thumbnailUrl: l.og, contentUrl: l.direct, uploadDate: addedOn(item.file), ...(item.duration ? { duration: `PT${Math.round(item.duration)}S` } : {}), publisher: ORG }
      : { '@type': 'ImageObject', name: item.title, description: item.caption, contentUrl: l.direct, thumbnailUrl: l.og, creator: ORG, license: 'https://creativecommons.org/licenses/by-sa/4.0/', acquireLicensePage: `${SITE}/press/` };
  write({ ...p, schema: [object] });
}

// --- The fleet: an index, and a page for each ship ------------------------------

const ships = loadShips(root);
write({ path: '/ships/', title: 'Ships · Witchspace', description: 'The Witchspace fleet: every ship, who flies it, who drew it, and how to make it better.', content: shipsIndex(ships), bodyClass: 'ships-page', card: { ship: 'falcon', kicker: 'The fleet', title: 'Ships', sub: 'Every ship, who flies it, who drew it, and how to make it better.' }, schema: [{ '@type': 'CollectionPage', name: 'Ships', hasPart: ships.map((sh) => ({ '@type': 'CreativeWork', name: sh.name, url: `${SITE}/ships/${sh.id}/` })) }] });
for (const s of ships) write({ path: `/ships/${s.id}/`, ...shipPage(s), scripts: ['/src/site/ship.ts'], bodyClass: 'ships-page' });

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
  { file: 'docs/design/economy-and-exchanges.md', slug: 'economy-and-exchanges', blurb: 'Living markets, news that travels, station exchanges, local currencies, contracts and futures, station shares, and fair play. All virtual, all earned in play.' },
  { file: 'docs/design/markets-and-trade.md', slug: 'markets-and-trade', blurb: 'Real supply and demand: worlds that produce and consume, stations posting orders, NPC traders hauling to where goods are wanted, world events, and the black market for weapons and drugs.' },
  { file: 'docs/design/system-currencies.md', slug: 'system-currencies', blurb: 'A currency for every system, modelled on real crypto: government monetary policies, liquidity pools, pegs and crises, and a ledger anyone can verify. Virtual only.' },
  { file: 'docs/design/stations-and-worlds.md', slug: 'stations-and-worlds', blurb: 'Physical limits: station classes, ship sizes, docking capacity, how many stations a world can support, supply and decline, rivals and allies.' },
  { file: 'docs/design/ship-condition.md', slug: 'ship-condition', blurb: 'Ships wear with use: condition, readable symptoms and breakdowns, servicing at stations, second-hand ships with a history, and engineering. Modern rules only.' },
  { file: 'docs/design/combat-rating.md', slug: 'combat-rating', blurb: 'The road from Harmless to Elite: points weighted by danger, nothing for crimes or easy targets, player kills, and combat missions as the main way up.' },
  { file: 'docs/design/servers-and-hosting.md', slug: 'servers-and-hosting', blurb: 'How the shared galaxy will run: a small server-authoritative setup, what it costs, community-run servers later, and why not peer-to-peer.' },
  { file: 'docs/design/player-stations.md', slug: 'player-stations', blurb: 'Stations run by players, guilds, the community and AI agents, earned by contributing and funded by trading profits.' },
  { file: 'docs/ideas.md', slug: 'ideas', blurb: 'Ideas that aren\'t designed yet, from multicrew ships to a streamer mode. The community votes on what comes next.' },
];
const bySource = new Map(DOCS.map((d) => [d.file, d]));
/** The ship on each design document's share card. */
const DOC_SHIPS: Record<string, string> = {
  'law-and-travel': 'viper', 'economy-and-exchanges': 'bullsnake', 'markets-and-trade': 'cobra-mk3', 'system-currencies': 'coriolis', 'stations-and-worlds': 'coriolis',
  'ship-condition': 'sidewinder', 'combat-rating': 'mamba', 'servers-and-hosting': 'lancer', 'player-stations': 'coriolis', ideas: 'cobra-mk3',
};

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
    card: { ship: DOC_SHIPS[d.slug] ?? 'cobra-mk3', kicker: d.slug === 'ideas' ? 'Ideas' : 'Design', sub: d.blurb.length > 110 ? d.blurb.slice(0, d.blurb.lastIndexOf(' ', 107)).replace(/[,;:·\s]+$/, '') + '…' : d.blurb },
    schema: [{ '@type': 'TechArticle', headline: title, description: d.blurb, url: `${SITE}/design/${d.slug}/`, author: ORG, publisher: ORG, isPartOf: { '@type': 'CreativeWorkSeries', name: 'Witchspace design', url: `${SITE}/design/` } }],
    content: `<article class="section doc">\n<div class="doc-top"><a class="back" href="/design/">← All design documents</a><button type="button" class="button ghost small" data-share data-share-url="/design/${d.slug}/" data-share-title="${escapeAttr(title)}">Share</button></div>\n${html}</article>`,
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
  card: { ship: 'coriolis', kicker: 'Designed in the open', title: 'Design & roadmap', sub: 'Agreed designs, proposals for discussion, the ideas backlog and the roadmap.' },
  schema: [{ '@type': 'CollectionPage', name: 'Witchspace design' }],
  title: 'Design · Witchspace',
  description: 'How Witchspace is being designed, in the open: agreed designs, proposals for discussion, the ideas backlog and the roadmap.',
  content: `<section class="section">
  <div class="section-head">
  <p class="kicker">Designed in the open</p>
  <h2>Design</h2>
  <p class="lede">Witchspace is designed in the open. Ideas are discussed and written down before they're built, so anyone can see where the game is going and help shape it.</p>
  </div>
  <div class="grid">
${docMeta
  .map(
    (d) => `    <a class="card link" href="/design/${d.slug}/">
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

const generated = [
  'index.html',
  ...NAV.slice(1).map(([p]) => p.slice(1) + 'index.html'),
  'press/index.html',
  ...ships.map((s) => `ships/${s.id}/index.html`),
  ...docMeta.map((d) => `design/${d.slug}/index.html`),
  ...media.items.map((i) => `press/${i.id}/index.html`),
];
// The game's own page (play/index.html is written by hand) shares the same way.
cards.push({ file: 'play.jpg', ship: 'cobra-mk3', kicker: 'Play now · free', title: 'Launch your Cobra', sub: 'Trade, fight and explore eight galaxies. No download, no account.' });

// The cards for tools/share-cards.mjs to photograph (git-ignored: it's made here).
writeFileSync(join(root, 'tools/share-cards.json'), JSON.stringify(cards, null, 1));
const missing = cards.filter((c) => !existsSync(join(root, 'public/share', c.file)));
if (missing.length) console.log(`Share cards still to make (npm run cards): ${missing.map((c) => c.file).join(', ')}`);
console.log(`Built ${generated.length} pages: ${generated.map((f) => relative(root, join(root, f))).join(', ')}`);
