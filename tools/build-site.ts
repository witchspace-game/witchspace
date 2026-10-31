// Builds the website's pages from site/ (hand-written pages) and docs/
// (design documents in Markdown). Runs before `vite` and `vite build`.
// Generated pages are git-ignored; edit the sources instead.

import { marked, type Tokens } from 'marked';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { galleryData, galleryHtml, itemPage, links, loadMedia, shareImage } from './media';
import { docPanel, helpSkillsHtml, helpWantedHtml, libraryHtml, loadDocs, PILLARS, roadmapCompactHtml, roadmapHtml, roadmapSummaryHtml, STATUS } from './docs';
import { currencyExamplesHtml } from './economy';
import { companiesHub, companyPage, jobsPage, loadJobs } from './jobs';
import { drawerButtons, editionsFor, loadModules, loadShips, manualFor, ownable } from './shipFiles';
import { buildPage, editionPage, groupShips, manualPage, papersPage, shipPage, shipsIndex } from './ships';
import { COMPANIES, COMPANY_IDS } from '../src/game/companies';
import { CAREERS, careerLine } from '../src/site/callsignWords';

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
  card?: { ship: string; kicker: string; sub: string; title?: string; paint?: { colour: string; glow: number; trim: string | null; lights?: boolean } };
  /** Structured data for search engines (schema.org), besides the site and breadcrumbs added to every page. */
  schema?: Record<string, unknown>[];
  /** Its short name, for breadcrumbs and its card, when the title is written for search ("Cobra Mk III"). */
  name?: string;
  /** A level between the section and this page in the breadcrumbs (an edition's ship). */
  parent?: { name: string; path: string };
}

/** A page's short name: its own, or its title up to the first " · " or " | ". */
const nameOf = (page: Page) => page.name ?? page.title.replace(/ (·|\|) .*$/, '');

// --- Share cards and structured data ----------------------------------------------

/** Every page's card, for tools/share-cards.mjs to photograph into public/share/. */
const cards: { file: string; ship: string; kicker: string; title: string; sub: string; paint?: { colour: string; glow: number; trim: string | null; lights?: boolean } }[] = [];
const cardFile = (path: string) => (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-')) + '.jpg';

/** Branded cards for the hand-written pages (ships and design docs get theirs where they're made). */
/** The ship on each career's share card (the campaign's links): a Cobra trades, a Viper fights, a Sidewinder scouts, the Titanoboa builds. */
const CAREER_SHIPS: Record<string, string> = { trade: 'cobra-mk3', fight: 'viper', explore: 'sidewinder', build: 'titanoboa' };

const PAGE_CARDS: Record<string, NonNullable<Page['card']>> = {
  '/': { ship: 'cobra-mk3', kicker: 'A love letter to Elite (1984)', title: 'Trade. Fight. Explore. Build.', sub: 'Eight galaxies of glowing vector space, built with the people who fly it.' },
  '/about/': { ship: 'cobra-mk3', kicker: 'About', sub: 'An unofficial, non-commercial tribute to Elite (1984), made in the open.' },
  '/get-involved/': { ship: 'viper', kicker: 'Get involved', sub: 'Design ships, write lore, build missions, playtest or code.' },
  '/ideas/': { ship: 'cobra-mk3', kicker: 'Ideas', title: 'What should Witchspace do next?', sub: 'Suggest an idea, or vote the ones you care about up or down.' },
  '/press/': { ship: 'falcon', kicker: 'Press kit', sub: 'A new trailer, short films, screenshots, facts and words about Witchspace.' },
  '/review/': { ship: 'falcon', kicker: 'Build', title: 'Review submissions', sub: 'For maintainers: accept a design, or send it back with notes.' },
  '/ship-preview/': { ship: 'cobra-mk3', kicker: 'Ships', title: 'Ship preview', sub: 'A ship that isn’t in the fleet yet, from a link.' },
  '/connect/': { ship: 'titanoboa', kicker: 'Build connector', title: 'Connect your AI assistant', sub: 'Let your assistant hand in ships and modules as you. Nothing goes public until it is accepted.' },
  '/ship-editor/': { ship: 'falcon', kicker: 'Build', title: 'Ship editor', sub: 'Shape a ship from points, see it glow, and hand it in. No code, no GitHub.' },
  '/submit/': { ship: 'titanoboa', kicker: 'Build', title: 'Hand in a design', sub: 'A ship or a Titanoboa module, checked as you go. No GitHub needed.' },
  '/economy/': { ship: 'falcon', kicker: 'Trade · the galaxy’s money', title: 'Money and markets', sub: 'Living markets, real-time Bitcoin, a currency for every system, company coins and liquidity pools. All in-game.' },
  '/shared-space/': { ship: 'viper', kicker: 'Multiplayer · in beta', title: 'Shared space', sub: 'The other ship on your scanner might be a person. Fly with other commanders, live, in your browser.' },
  '/privacy/': { ship: 'coriolis', kicker: 'Privacy', sub: 'What Witchspace keeps about you, why, and how to delete it.' },
  '/callsign/': { ship: 'cobra-mk3', kicker: 'Trade · Fight · Explore · Build', title: 'Every pilot needs a callsign.', sub: 'Claim yours, and build the card that carries it. Free, in your browser.' },
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
const SECTION_NAMES: Record<string, string> = { ships: 'Ships', roadmap: 'Roadmap', design: 'Design', press: 'Press kit', ideas: 'Ideas', about: 'About', 'get-involved': 'Get involved', privacy: 'Privacy', jobs: 'Jobs', companies: 'Companies', submit: 'Hand in a design', connect: 'Connect your AI assistant', 'ship-editor': 'Ship editor', review: 'Review submissions', 'ship-preview': 'Ship preview', 'shared-space': 'Shared space', economy: 'Money and markets', callsign: 'Claim your callsign' };
/** Sections without an index page of their own: their breadcrumb points here instead. */
const SECTION_URLS: Record<string, string> = {};

function structuredData(page: Page, image: string): string {
  const parts = page.path.split('/').filter(Boolean);
  const name = nameOf(page);
  const crumbs = [{ name: 'Witchspace', url: `${SITE}/` }];
  if (parts.length) crumbs.push({ name: SECTION_NAMES[parts[0]] ?? name, url: SITE + (SECTION_URLS[parts[0]] ?? `/${parts[0]}/`) });
  if (page.parent) crumbs.push({ name: page.parent.name, url: SITE + page.parent.path });
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
  const title = card?.title ?? nameOf(page);
  if (card) cards.push({ file: cardFile(page.path), ship: card.ship, kicker: card.kicker, title, sub: card.sub, ...(card.paint ? { paint: card.paint } : {}) });
  const own = card && existsSync(join(root, 'public/share', cardFile(page.path)));
  const image = page.image ?? (own ? `${SITE}/share/${cardFile(page.path)}` : shareImage(media));
  const imageAlt = own ? `${title}: ${card!.sub}` : page.title;
  const section = '/' + (page.path.split('/')[1] ?? '') + (page.path === '/' ? '' : '/');
  const nav = NAV.map(([href, label]) => {
    // Design documents belong to the roadmap.
    const current = section === href || (href === '/roadmap/' && section === '/design/');
    return `<a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  }).join('\n        ');
  // Every page can be shared (src/site/share.ts), so every page loads it; and every page may offer the callsign
  // card once, on a computer, as a visitor leaves (src/site/nudge.ts).
  const scripts = [...new Set([...(page.scripts ?? []), '/src/site/share.ts', '/src/site/nav.ts', '/src/site/analytics.ts', '/src/site/nudge.ts'])].map((src) => `    <script type="module" src="${src}"></script>`).join('\n');
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

/** Every page search engines may index, for the sitemap: anything marked noindex stays out. */
const indexable: string[] = ['/play/'];
/** The files each hand-written page is made from, for its lastmod. */
const sources = new Map<string, string[]>([['/play/', ['play/index.html']]]);

function write(page: Page) {
  if (!page.head?.includes('noindex')) indexable.push(page.path);
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
    .replace('<!-- economy:currencies -->', currencyExamplesHtml())
    // {{media:<id>:large}} and the like: a press item's link at a given size.
    .replace(/\{\{media:([\w-]+):(large|og|direct|video|embed)\}\}/g, (_, id: string, size: 'large' | 'og' | 'direct' | 'video' | 'embed') => links(media, media.items.find((i) => i.id === id)!)[size]!);
  write({ ...meta, content });
  sources.set(meta.path, [`site/pages/${name}`]);
  // Claim your callsign, once more for each career: the same page with that career chosen and its own share
  // card ("Every trader needs a callsign"), for the campaign's links. Kept out of search: /callsign/ is the page.
  if (meta.path === '/callsign/')
    for (const c of CAREERS)
      write({
        ...meta,
        path: `/callsign/${c.id}/`,
        title: `${careerLine(c).replace(/\.$/, '')} · Witchspace`,
        content,
        head: `${meta.head ?? ''}    <meta name="robots" content="noindex" />\n`,
        card: { ship: CAREER_SHIPS[c.id], kicker: `${c.name} · Claim your callsign`, title: careerLine(c), sub: 'One name, yours alone, and the card that carries it. Free, in your browser.' },
      });
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
      ? { '@type': 'VideoObject', name: item.title, description: item.caption, thumbnailUrl: l.og, contentUrl: l.direct, uploadDate: item.added ?? addedOn(item.file), ...(item.duration ? { duration: `PT${Math.round(item.duration)}S` } : {}), ...(item.youtube ? { embedUrl: `https://www.youtube.com/embed/${item.youtube}` } : {}), publisher: ORG }
      : { '@type': 'ImageObject', name: item.title, description: item.caption, contentUrl: l.direct, thumbnailUrl: l.og, creator: ORG, license: 'https://creativecommons.org/licenses/by-sa/4.0/', acquireLicensePage: `${SITE}/press/` };
  write({ ...p, schema: [object] });
}

// --- The fleet: an index, and a page for each ship ------------------------------

const ships = loadShips(root);
/** Ships a commander can fly today: the Cobra every career starts in, and a hull built to order (the game's
 *  `concept`: deposit, then collect). The yards list the others (ownable), but don't sell hulls outright yet. */
const flyable = (s: (typeof ships)[number]) => s.id === 'cobra-mk3' || (ownable(s) && Boolean(s.concept));
// In the hub's order, group by group (tools/ships.ts SHIP_GROUPS), for its ItemList.
const fleetOrder = groupShips(ships, flyable).flatMap((g) => g.ships);
write({
  path: '/ships/',
  title: 'Ships of Witchspace: the fleet you fly, fight and build',
  description: 'Every ship in Witchspace, from the Cobra you start in to the Fer-de-lance built to order and the Titan that builds stations. Fly free in your browser.',
  content: shipsIndex(ships, flyable),
  bodyClass: 'ships-page',
  card: { ship: 'falcon', kicker: 'The fleet', title: 'Ships', sub: 'Every ship, who flies it, who drew it, and how to make it better.' },
  schema: [
    {
      '@type': 'CollectionPage',
      name: 'Ships of Witchspace',
      url: `${SITE}/ships/`,
      about: { '@type': 'VideoGame', name: 'Witchspace', url: `${SITE}/` },
      mainEntity: { '@type': 'ItemList', numberOfItems: fleetOrder.length, itemListElement: fleetOrder.map((sh, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/ships/${sh.id}/`, name: sh.name, image: `${SITE}/share/${cardFile(`/ships/${sh.id}/`)}` })) },
    },
  ],
});
const shipModules = loadModules(root);
/** Ship and edition pages' titles and descriptions, written for search by Marketing: path → { title, description }. */
const SHIP_SEO: Record<string, { title: string; description: string }> = JSON.parse(readFileSync(join(root, 'site/ships-seo.json'), 'utf8'));
const forSearch = (path: string, name: string, p: Omit<Page, 'path'>): Page => {
  const seo = SHIP_SEO[path];
  return { ...p, path, name, ...(seo ? { title: `${seo.title} | Witchspace`, description: seo.description } : {}) };
};
for (const s of ships) write({ ...forSearch(`/ships/${s.id}/`, s.name, shipPage(s, shipModules, false, editionsFor(s), ownable(s))), scripts: ['/src/site/ship.ts'], bodyClass: 'ships-page' });
// Owner's manuals: one for every ship the yard sells, shown only to her owner.
const cobra = ships.find((s) => s.id === 'cobra-mk3')!;
const drawer = drawerButtons(root);
for (const s of ships.filter(ownable)) write({ path: `/ships/${s.id}/manual/`, ...manualPage(s, manualFor(s, cobra, drawer)), scripts: ['/src/site/manual.ts'], bodyClass: 'ships-page' });
// Each numbered edition's own page, at /ships/<ship>/<edition>/.
for (const s of ships) {
  const eds = editionsFor(s);
  for (const e of eds) write({ ...forSearch(`/ships/${s.id}/${e.id}/`, e.name, editionPage(s, e, eds.filter((o) => o !== e))), parent: { name: s.name, path: `/ships/${s.id}/` }, scripts: ['/src/site/edition.ts'], bodyClass: 'ships-page edition-body' });
  // Her papers: one page for every number, which vercel.json serves at /ships/<ship>/<edition>/<no>/.
  for (const e of eds) write({ path: `/ships/${s.id}/${e.id}/papers/`, ...papersPage(s, e), scripts: ['/src/site/papers.ts'], bodyClass: 'ships-page papers-body' });
}
// The configurator: spec any hull the yard sells, and order her for the yard.
const yardNames = Object.fromEntries(ships.filter(ownable).map((s) => [s.id, s.name]));
// Kept out of search, like the manuals and the papers: a tool, not a page to land on.
for (const s of ships.filter(ownable)) write({ path: `/ships/${s.id}/build/`, ...buildPage(s, yardNames), head: '    <meta name="robots" content="noindex, follow" />\n', scripts: ['/src/site/build.ts'], bodyClass: 'ships-page build-body' });

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
write({
  path: '/companies/',
  title: 'The companies of Witchspace: work for the Big Four',
  name: 'Companies',
  description: 'Four companies post the work on every station’s board in Witchspace: freight, escorts, surveys and salvage. Who they are, what they want, and their jobs.',
  content: companiesHub(jobs, companiesMd, shipIds),
  bodyClass: 'jobs-page',
  card: { ship: 'titanoboa', kicker: 'A galaxy at work', title: 'The companies', sub: 'Four companies post the work on every station’s board. Who you work for decides who trusts you.' },
  schema: [{ '@type': 'CollectionPage', name: 'The companies of Witchspace', about: GAME_REF, mainEntity: { '@type': 'ItemList', itemListElement: COMPANY_IDS.map((id, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/companies/${id}/`, name: COMPANIES[id].name })) } }],
});
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

// The sitemaps, from the pages just written (git-ignored: they're made on every build). An index of one sitemap
// per section, so Search Console reports each section on its own, and every URL's lastmod is the last commit
// to the files it's made from: honest, so search engines can trust it (never the build's own time).

/** Each file's last commit date, newest first from one walk of the history. Empty if there's no history to read. */
const lastCommit = new Map<string, string>();
try {
  // A shallow clone (as a host's build may be) would date everything to its one commit: deepen it, or go without.
  if (execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).trim() === 'true') execFileSync('git', ['fetch', '--unshallow', '--quiet'], { cwd: root, stdio: 'ignore', timeout: 60_000 });
  let date = '';
  for (const line of execFileSync('git', ['log', '--format=@%cs', '--name-only', '--no-renames'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\n')) {
    if (line.startsWith('@')) date = line.slice(1);
    else if (line && !lastCommit.has(line)) lastCommit.set(line, date);
  }
} catch {
  lastCommit.clear(); // no history: no lastmod, rather than a wrong one
}
/** The newest commit among these files (a path ending in / means everything under it). */
function lastmod(files: string[]): string | null {
  let newest: string | null = null;
  for (const f of files)
    for (const [, date] of f.endsWith('/') ? [...lastCommit].filter(([k]) => k.startsWith(f)) : [[f, lastCommit.get(f)] as const])
      if (date && (!newest || date > newest)) newest = date;
  return newest;
}
/** What each page is made from. */
function sourcesOf(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  if (sources.has(path)) return sources.get(path)!;
  switch (parts[0]) {
    case 'ships':
      if (parts.length === 1) return ['content/ships/', 'site/ships-seo.json'];
      return [`content/ships/${parts[1]}.json`, 'site/ships-seo.json', ...(parts.length > 2 ? ['src/content/editions.ts'] : [])];
    case 'press': {
      const item = media.items.find((i) => i.id === parts[1]);
      return ['site/media.json', ...(item ? [item.file] : [])];
    }
    case 'design':
      return parts.length > 1 ? [docs.find((d) => d.slug === parts[1])?.file ?? 'docs/'] : ['docs/'];
    case 'roadmap':
      return ['docs/'];
    case 'jobs':
      return ['site/jobs.json'];
    case 'companies':
      return ['site/jobs.json', 'docs/companies.md'];
  }
  return [];
}
const SECTIONS = ['pages', 'ships', 'companies', 'design', 'press'] as const;
const sectionOf = (path: string): (typeof SECTIONS)[number] => {
  const first = path.split('/')[1];
  if (first === 'ships') return 'ships';
  if (first === 'companies' || first === 'jobs') return 'companies';
  if (first === 'design' || first === 'roadmap') return 'design';
  if (first === 'press') return 'press';
  return 'pages';
};
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A ship page's picture (her share card), and a press film, for Google Images and Video. */
function extras(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'ships' && parts.length > 1 && existsSync(join(root, 'public/share', cardFile(path)))) return `<image:image><image:loc>${SITE}/share/${cardFile(path)}</image:loc></image:image>`;
  const item = parts[0] === 'press' && parts.length === 2 ? media.items.find((i) => i.id === parts[1]) : undefined;
  if (item?.kind !== 'video') return '';
  const l = links(media, item);
  return `<video:video><video:thumbnail_loc>${xml(l.og!)}</video:thumbnail_loc><video:title>${xml(item.title)}</video:title><video:description>${xml(item.caption)}</video:description><video:content_loc>${xml(l.direct!)}</video:content_loc>${item.duration ? `<video:duration>${Math.round(item.duration)}</video:duration>` : ''}<video:publication_date>${item.added ?? addedOn(item.file)}</video:publication_date></video:video>`;
}
const urls = [...new Set(indexable)].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
const index: string[] = [];
for (const section of SECTIONS) {
  const mine = urls.filter((u) => sectionOf(u) === section);
  const dates = mine.map((u) => lastmod(sourcesOf(u)));
  writeFileSync(
    join(root, `public/sitemap-${section}.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${mine.map((u, i) => `  <url><loc>${SITE}${u}</loc>${dates[i] ? `<lastmod>${dates[i]}</lastmod>` : ''}${extras(u)}</url>`).join('\n')}\n</urlset>\n`,
  );
  const newest = dates.filter(Boolean).sort().pop();
  index.push(`  <sitemap><loc>${SITE}/sitemap-${section}.xml</loc>${newest ? `<lastmod>${newest}</lastmod>` : ''}</sitemap>`);
}
writeFileSync(join(root, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${index.join('\n')}\n</sitemapindex>\n`);
const missing = cards.filter((c) => !existsSync(join(root, 'public/share', c.file)));
if (missing.length) console.log(`Share cards still to make (npm run cards): ${missing.map((c) => c.file).join(', ')}`);
console.log(`Built ${generated.length} pages: ${generated.map((f) => relative(root, join(root, f))).join(', ')}`);
