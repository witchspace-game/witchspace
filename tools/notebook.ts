// The notebook pack: every design document, gathered into a few themed
// Markdown files for a notebook tool (NotebookLM and the like), with a
// first file saying what's built today, made from the same headers as the
// roadmap. `npm run notebook [out-dir]`; the default folder is git-ignored.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadDocs, PILLARS, STATUS, type Doc } from './docs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'notebook'));
const SITE = 'https://witchspace.org.uk';
const REPO = 'https://github.com/witchspace-game/witchspace/blob/main/';
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The themed files, in reading order, and the documents in each (by slug, or a repo path). */
const PACK: { file: string; title: string; about: string; parts: string[] }[] = [
  { file: '01-lore.md', title: 'The lore of Witchspace', about: 'The galaxy as the people in it know it, by the four lives a commander can lead: Trade, Fight, Explore and Build.', parts: ['lore'] },
  {
    file: '02-trade.md',
    title: 'Trade',
    about: 'Trader to trading house: the trading companies and their contracts, markets and the exchange, news that travels, the saloon, Bitcoin and system currencies, and the comms that reach you while you\'re away.',
    parts: ['trading', 'markets-and-trade', 'economy-and-exchanges', 'companies', 'companies-and-contracts', 'system-currencies', 'radio-and-comms'],
  },
  {
    file: '03-fight.md',
    title: 'Fight',
    about: 'Harmless to Elite: the law, debt and capture, the Marshals, the combat rating, how pirates fight, the Falcons, the flight HUD, and the flight recorder and kill cam.',
    parts: ['law-and-travel', 'combat-rating', 'pilot-skill', 'combat-computer-routines', 'legends-the-falcon', 'flight-hud-and-touch', 'flight-recorder', 'kill-cam'],
  },
  {
    file: '04-explore.md',
    title: 'Explore',
    about: 'Tourist to Voyager: surveys, signals and trails, discovery to development, the galaxy chart, and stations and worlds.',
    parts: ['exploration', 'discovery-to-development', 'galaxy-chart', 'stations-and-worlds'],
  },
  {
    file: '05-build.md',
    title: 'Build',
    about: 'Contributor to station charter: the ships and their makers, the modular Titanoboa, keeping a ship flying, stations run by players, and building the galaxy together (the worldbuilding rules, the platform, the servers and the ideas).',
    parts: ['worldbuilding', 'ships-and-classes', 'ship-the-titanoboa', 'ship-the-dragonfly', 'ship-the-shrike', 'ship-condition', 'player-stations', 'community-platform', 'README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'servers-and-hosting', 'mcp-server', 'ideas', 'CREDITS.md'],
  },
];

/** A document's text for reading: no front matter, links made absolute, HTML comments gone. */
function clean(md: string, from: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // pictures don't travel
    .replace(/\]\((?!https?:|mailto:|#)([^)]+)\)/g, (_, href: string) => {
      const [path, hash] = href.split('#');
      if (/(^|\/)design\/([a-z0-9-]+)\.md$/.test(path) || /^[a-z0-9-]+\.md$/.test(path) && from.startsWith('docs/design/')) {
        const slug = path.split('/').pop()!.replace(/\.md$/, '');
        return `](${SITE}/design/${slug}/${hash ? `#${hash}` : ''})`;
      }
      const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : '';
      const full = new URL(path, `https://x/${base}`).pathname.slice(1);
      return `](${REPO}${full}${hash ? `#${hash}` : ''})`;
    })
    .replace(/^(#{1,5}) /gm, '#$1 ') // each document sits one level down in its file
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function statusLine(d: Doc): string {
  const built = d.stages.filter((s) => s.status === 'built').length;
  return `*Status: ${STATUS[d.status].label.toLowerCase()}${d.stages.length ? ` (${built} of ${d.stages.length} stages built)` : ''} · ${PILLARS[d.pillar].name} · ${SITE}/design/${d.slug}/*`;
}

function stagesList(d: Doc): string {
  if (!d.stages.length) return '';
  return `\n\n**Stages:**\n${d.stages.map((s) => `- ${s.name}: ${(STATUS[s.status]?.label ?? s.status).toLowerCase()}`).join('\n')}`;
}

const docs = loadDocs(ROOT);
const bySlug = new Map(docs.map((d) => [d.slug, d]));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// The first file: what Witchspace is, and where everything stands today.
const overview = (() => {
  const by = (status: string) => docs.filter((d) => d.status === status && d.status !== 'guide');
  const stageRows = (filter: (s: string) => boolean) =>
    docs.flatMap((d) => d.stages.filter((s) => filter(s.status)).map((s) => `- **${d.title}:** ${s.name}`)).join('\n');
  return `# Witchspace today

*Compiled ${today} from the design documents in the repository (github.com/witchspace-game/witchspace), the same source as the roadmap at ${SITE}/roadmap/. Play at ${SITE}/play/.*

Witchspace is a free, open-source space trading game that plays in a web browser: a tribute to Elite (1984) by Ian Bell and David Braben, not affiliated with Frontier Developments. Ships are glowing "neo-vector" wireframes drawn with three.js, and there's a switchable authentic 1984 mode. Modern rules are the main game, with a living economy, companies, the law, shared space with other commanders, and more; Classic rules stay faithful to the original. Everything in the game is a small, validated file anyone (or their AI assistant) can improve. Nothing can be bought with real money.

**How to read the status words:** *built* is in the game now; *being built* is partly in; *designed* or *proposed* is written up but not built; *idea* is a sketch.

## The files in this pack

${PACK.map((p) => `- **${p.file}**: ${p.about}`).join('\n')}

## Being built now

${by('building').map((d) => `- **${d.title}** (${d.stages.filter((s) => s.status === 'built').length} of ${d.stages.length} stages built): ${d.summary}`).join('\n')}

## Designed or proposed, not yet built

${[...by('designed'), ...by('proposed'), ...by('idea')].map((d) => `- **${d.title}** (${STATUS[d.status].label.toLowerCase()}): ${d.summary}`).join('\n')}

## Built: every finished stage

${stageRows((s) => s === 'built')}

## Next: stages in progress

${stageRows((s) => s === 'building')}
`;
})();
writeFileSync(join(OUT, '00-witchspace-today.md'), overview);

for (const p of PACK) {
  const parts = p.parts.map((part) => {
    if (part.endsWith('.md')) {
      const text = readFileSync(join(ROOT, part), 'utf8');
      return clean(text, part);
    }
    const d = bySlug.get(part);
    if (!d) throw new Error(`No design document called ${part}`);
    const body = clean(readFileSync(join(ROOT, d.file), 'utf8'), d.file);
    const titled = /^## /.test(body) ? body : `## ${d.title}\n\n${body}`;
    return titled.replace(/^(## .*\n)/, `$1\n${statusLine(d)}\n\n> ${d.summary}${stagesList(d)}\n`);
  });
  writeFileSync(join(OUT, p.file), `# ${p.title}\n\n*Part of the Witchspace notebook pack, compiled ${today}. ${p.about}*\n\n${parts.join('\n\n---\n\n')}\n`);
}

console.log(`Notebook pack: ${PACK.length + 1} files in ${OUT}`);
