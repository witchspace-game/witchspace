// Builds the website's pages from site/ (hand-written pages) and docs/
// (design documents in Markdown). Runs before `vite` and `vite build`.
// Generated pages are git-ignored; edit the sources instead.

import { marked, type Tokens } from 'marked';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { galleryData, galleryHtml, itemPage, links, loadMedia, shareImage } from './media';
import { docPanel, helpSkillsHtml, helpWantedHtml, libraryHtml, loadDocs, PILLARS, roadmapCompactHtml, roadmapHtml, roadmapSummaryHtml, STATUS } from './docs';
import { companyPage, jobsPage, loadJobs } from './jobs';
import { loadModules, loadShips, shipPage, shipsIndex } from './ships';
import { COMPANIES, COMPANY_IDS } from '../src/game/companies';

const root = resolve(import.meta.dirname, '..');
const REPO = 'https://github.com/witchspace-game/witchspace/blob/main/';
const SITE = 'https://witchspace.org.uk';
const media = loadMedia(root);
const template = readFileSync(join(root, 'site/template.html'), 'utf8');

const NAV = [
  ['/ships/', 'Ships'],
  ['/roadmap/', 'Roadmap'],
  ['/jobs/', 'Jobs'],
  ['/ideas/', 'Ideas'],
  ['/get-involved/', 'Get involved'],
  ['/about/', 'About'],
] as const;
/** The phone menu: everything, since there's no room for the bar. */
const MENU = [['/', 'Home'], ...NAV, ['/design/', 'Design documents'], ['/press/', 'Press kit'], ['/privacy/', 'Privacy']] as const;

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
  '/': { ship: 'cobra-mk3', kicker: 'A love letter to Elite (1984)', title: 'Trade. Fight. Explore. Build.', sub: 'Eight galaxies of glowing vector space, built with the people who fly it.' },
  '/about/': { ship: 'cobra-mk3', kicker: 'About', sub: 'An unofficial, non-commercial tribute to Elite (1984), made in the open.' },
  '/get-involved/': { ship: 'viper', kicker: 'Get involved', sub: 'Design ships, write lore, build missions, playtest or code.' },
  '/ideas/': { ship: 'cobra-mk3', kicker: 'Ideas', title: 'What should Witchspace do next?', sub: 'Suggest an idea, or vote the ones you care about up or down.' },
  '/press/': { ship: 'falcon', kicker: 'Press kit', sub: 'A new trailer, short films, screenshots, facts and words about Witchspace.' },
  '/connect/': { ship: 'titanoboa', kicker: 'Build connector', title: 'Connect your AI assistant', sub: 'Let your assistant hand in ships and modules as you. Nothing goes public until it is accepted.' },
  '/ship-editor/': { ship: 'falcon', kicker: 'Build', title: 'Ship editor', sub: 'Shape a ship from points, see it glow, and hand it in. No code, no GitHub.' },
  '/submit/': { ship: 'titanoboa', kicker: 'Build', title: 'Hand in a design', sub: 'A ship or a Titanoboa module, checked as you go. No GitHub needed.' },
  '/privacy/': { ship: 'coriolis', kicker: 'Privacy', sub: 'What Witchspace keeps about you, why, and how to delete it.' },
};

const ORG = { '@type': 'Organization', name: 'Witchspace', url: SITE, logo: `${SITE}/icons/icon-512.png`, sameAs: ['https://github.com/witchspace-game/witchspace', 'https://www.instagram.com/witchspace_game/', 'https://www.youtube.com/channel/UC0ZD9s_rEYbGhXb3S6ai-Iw'] };
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
const SECTION_NAMES: Record<string, string> = { ships: 'Ships', roadmap: 'Roadmap', design: 'Design', press: 'Press kit', ideas: 'Ideas', about: 'About', 'get-involved': 'Get involved', privacy: 'Privacy', jobs: 'Jobs', companies: 'Jobs', submit: 'Hand in a design', connect: 'Connect your AI assistant', 'ship-editor': 'Ship editor' };
/** Sections without an index page of their own: their breadcrumb points here instead. */
const SECTION_URLS: Record<string, string> = { companies: '/jobs/' };

function structuredData(page: Page, image: string): string {
  const parts = page.path.split('/').filter(Boolean);
  const name = page.title.replace(/ · .*$/, '');
  const crumbs = [{ name: 'Witchspace', url: `${SITE}/` }];
  if (parts.length) crumbs.push({ name: SECTION_NAMES[parts[0]] ?? name, url: SITE + (SECTION_URLS[parts[0]] ?? `/${parts[0]}/`) });
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
    // Design documents belong to the roadmap.
    const current = section === href || (href === '/roadmap/' && section === '/design/');
    return `<a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  }).join('\n        ');
  // Every page can be shared (src/site/share.ts), so every page loads it.
  const scripts = [...new Set([...(page.scripts ?? []), '/src/site/share.ts', '/src/site/nav.ts'])].map((src) => `    <script type="module" src="${src}"></script>`).join('\n');
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
    .replace('{{menu}}', MENU.map(([href, label]) => `<a href="${href}"${href === page.path ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ') + '\n      <a class="button primary" href="/play/">Play free</a>')
    .replace('{{content}}', page.content)
    .replace('{{scripts}}', scripts);
}

function write(page: Page) {
  const file = join(root, page.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(page));
}

// --- Hand-written pages ---------------------------------------------------------

const docs = loadDocs(root);

for (const name of readdirSync(join(root, 'site/pages'))) {
  const html = readFileSync(join(root, 'site/pages', name), 'utf8');
  const meta = JSON.parse(html.match(/^<!--\s*(\{.*?\})\s*-->/s)![1]);
  const content = html
    .replace(/^<!--.*?-->\s*/s, '')
    .replace('<!-- press:gallery -->', galleryHtml(media))
    .replace('<!-- press:data -->', galleryData(media))
    .replace('<!-- help:wanted -->', helpWantedHtml(docs))
    .replace('<!-- roadmap:summary -->', roadmapSummaryHtml(docs))
    .replace('<!-- roadmap:compact -->', roadmapCompactHtml(docs))
    .replace('<!-- help:skills -->', helpSkillsHtml(docs))
    // {{media:<id>:large}} and the like: a press item's link at a given size.
    .replace(/\{\{media:([\w-]+):(large|og|direct|video|embed)\}\}/g, (_, id: string, size: 'large' | 'og' | 'direct' | 'video' | 'embed') => links(media, media.items.find((i) => i.id === id)!)[size]!);
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
      ? { '@type': 'VideoObject', name: item.title, description: item.caption, thumbnailUrl: l.og, contentUrl: l.direct, uploadDate: item.added ?? addedOn(item.file), ...(item.duration ? { duration: `PT${Math.round(item.duration)}S` } : {}), publisher: ORG }
      : { '@type': 'ImageObject', name: item.title, description: item.caption, contentUrl: l.direct, thumbnailUrl: l.og, creator: ORG, license: 'https://creativecommons.org/licenses/by-sa/4.0/', acquireLicensePage: `${SITE}/press/` };
  write({ ...p, schema: [object] });
}

// --- The fleet: an index, and a page for each ship ------------------------------

const ships = loadShips(root);
write({ path: '/ships/', title: 'Ships · Witchspace', description: 'The Witchspace fleet: every ship, who flies it, who drew it, and how to make it better.', content: shipsIndex(ships), bodyClass: 'ships-page', card: { ship: 'falcon', kicker: 'The fleet', title: 'Ships', sub: 'Every ship, who flies it, who drew it, and how to make it better.' }, schema: [{ '@type': 'CollectionPage', name: 'Ships', hasPart: ships.map((sh) => ({ '@type': 'CreativeWork', name: sh.name, url: `${SITE}/ships/${sh.id}/` })) }] });
const shipModules = loadModules(root);
for (const s of ships) write({ path: `/ships/${s.id}/`, ...shipPage(s, shipModules), scripts: ['/src/site/ship.ts'], bodyClass: 'ships-page' });

// --- Design documents, the roadmap and the library (tools/docs.ts) --------------

/** GitHub-style heading anchors, so links like #9-power-and-protection work. */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\- ]/gu, '')
    .trim()
    .replace(/ /g, '-');

const bySource = new Map(docs.map((d) => [d.file, d]));
let currentSource = '';

/** Point links at site pages where we have them, otherwise at GitHub. */
function rewriteHref(href: string): string {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [path, hash] = href.split('#');
  const target = posix.normalize(posix.join(posix.dirname(currentSource), path || posix.basename(currentSource)));
  const doc = bySource.get(target);
  if (doc) return `/design/${doc.slug}/${hash ? '#' + hash : ''}`;
  if (target === 'README.md' && hash === 'roadmap') return '/roadmap/';
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
    // Images in docs point at public/ so they show on GitHub too; the site serves public/ at its root.
    if (token.type === 'image' && token.href.startsWith('../../public/')) token.href = token.href.slice('../../public'.length);
  },
});

// --- The jobs board and the company pages (tools/jobs.ts) ------------------------

const jobs = loadJobs(root);
const GAME_REF = { '@type': 'VideoGame', name: 'Witchspace', url: `${SITE}/play/` };
// Never JobPosting: these are jobs in a game, and must never sit beside real vacancies.
const fictional = (id: (typeof COMPANY_IDS)[number]) => ({ '@type': 'CreativeWork', name: COMPANIES[id].name, url: `${SITE}/companies/${id}/`, description: `A fictional company in the game Witchspace. ${COMPANIES[id].motto}`, isPartOf: GAME_REF });
write({
  path: '/jobs/',
  title: 'Jobs at Lave · Witchspace',
  description: jobs.jobs.description,
  content: jobsPage(jobs),
  scripts: ['/src/site/jobs.ts'],
  bodyClass: 'jobs-page',
  card: { ship: jobs.jobs.card.ship, kicker: 'Jobs in Witchspace', title: 'Work for the Big Four', sub: jobs.jobs.card.sub },
  schema: [{ '@type': 'CollectionPage', name: 'Jobs at Lave', about: GAME_REF, hasPart: COMPANY_IDS.map(fictional) }],
});
const companiesMd = readFileSync(join(root, 'docs/companies.md'), 'utf8');
const shipIds = new Set(ships.map((s) => s.id));
for (const id of COMPANY_IDS) {
  const c = jobs.companies[id];
  write({
    path: `/companies/${id}/`,
    title: `${COMPANIES[id].name} · Witchspace`,
    description: c.description,
    content: companyPage(jobs, id, companiesMd, (md) => {
      currentSource = 'docs/companies.md';
      return marked.parse(md) as string;
    }, shipIds),
    scripts: ['/src/site/jobs.ts'],
    bodyClass: 'jobs-page company-page',
    card: { ship: c.card.ship, kicker: 'A company in Witchspace', title: COMPANIES[id].name, sub: c.card.sub },
    schema: [fictional(id)],
  });
}

const shortLine = (s: string) => (s.length > 110 ? s.slice(0, s.lastIndexOf(' ', 107)).replace(/[,;:·\s]+$/, '') + '…' : s);

for (const d of docs) {
  currentSource = d.file;
  const html = marked.parse(d.body) as string;
  write({
    path: `/design/${d.slug}/`,
    title: `${d.title} · Witchspace`,
    description: d.summary,
    card: { ship: d.card, kicker: `${PILLARS[d.pillar].name} · ${STATUS[d.status].label}`, title: d.title, sub: shortLine(d.summary) },
    schema: [{ '@type': 'TechArticle', headline: d.title, description: d.summary, url: `${SITE}/design/${d.slug}/`, author: ORG, publisher: ORG, isPartOf: { '@type': 'CreativeWorkSeries', name: 'Witchspace design', url: `${SITE}/design/` } }],
    content: `<article class="section doc">
<div class="doc-top"><a class="back" href="/roadmap/">← Roadmap</a><button type="button" class="button ghost small" data-share data-share-url="/design/${d.slug}/" data-share-title="${escapeAttr(d.title)}">Share</button></div>
${docPanel(d)}
${html}
<p class="doc-edit muted small">Think something here should change? <a href="/ideas/?about=${encodeURIComponent(d.title)}">Say so on the ideas board</a>, where others can vote it up, or email <a href="mailto:hello@witchspace.org.uk?subject=${encodeURIComponent(d.title)}">hello@witchspace.org.uk</a>. If you code: this page is <a href="${REPO}${d.file}">${d.file}</a> on GitHub, open to pull requests.</p>
</article>`,
  });
}

write({
  path: '/roadmap/',
  title: 'Roadmap · Witchspace',
  description: "Everything that's built, being built and still to come in Witchspace, and where you could help.",
  card: { ship: 'titanoboa', kicker: 'Built in the open', title: 'Roadmap', sub: "What's built, what's being built, what's next, and where you could help." },
  schema: [{ '@type': 'CollectionPage', name: 'Witchspace roadmap', hasPart: docs.filter((d) => d.status !== 'guide').map((d) => ({ '@type': 'TechArticle', headline: d.title, url: `${SITE}/design/${d.slug}/` })) }],
  content: roadmapHtml(docs),
});

write({
  path: '/design/',
  card: { ship: 'coriolis', kicker: 'Designed in the open', title: 'Design documents', sub: 'Every design, and where each one stands.' },
  schema: [{ '@type': 'CollectionPage', name: 'Witchspace design', hasPart: docs.map((d) => ({ '@type': 'TechArticle', headline: d.title, url: `${SITE}/design/${d.slug}/` })) }],
  title: 'Design documents · Witchspace',
  description: 'Every Witchspace design document, in the open: what each feature is, where it stands, and what help it needs.',
  content: libraryHtml(docs),
});

const generated = [
  'index.html',
  ...NAV.map(([p]) => p.slice(1) + 'index.html'),
  'press/index.html',
  ...ships.map((s) => `ships/${s.id}/index.html`),
  'roadmap/index.html',
  ...docs.map((d) => `design/${d.slug}/index.html`),
  ...media.items.map((i) => `press/${i.id}/index.html`),
];
// The game's own page (play/index.html is written by hand) shares the same way.
cards.push({ file: 'play.jpg', ship: 'cobra-mk3', kicker: 'Play now · free', title: 'Launch your Cobra', sub: 'Trade, fight and explore eight galaxies. No download, no account.' });

// The cards for tools/share-cards.mjs to photograph (git-ignored: it's made here).
writeFileSync(join(root, 'tools/share-cards.json'), JSON.stringify(cards, null, 1));
const missing = cards.filter((c) => !existsSync(join(root, 'public/share', c.file)));
if (missing.length) console.log(`Share cards still to make (npm run cards): ${missing.map((c) => c.file).join(', ')}`);
console.log(`Built ${generated.length} pages: ${generated.map((f) => relative(root, join(root, f))).join(', ')}`);
