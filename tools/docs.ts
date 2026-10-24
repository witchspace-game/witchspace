// The design documents as the site's single source of truth
// (docs/design/community-platform.md): each starts with a short header
// (status, pillar, summary, stages, help wanted), and the roadmap, the design
// library, help wanted and each design's page are all made from those.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Status = 'idea' | 'proposed' | 'designed' | 'building' | 'built' | 'guide';
export type Pillar = 'trade' | 'fight' | 'explore' | 'core' | 'world' | 'shared' | 'platform';

export interface Doc {
  file: string; // relative to the repo
  slug: string;
  title: string;
  status: Status;
  pillar: Pillar;
  summary: string;
  card: string;
  stages: { name: string; status: Status }[];
  help: { task: string; skill: string }[];
  body: string; // the Markdown after the header
}

export const STATUS: Record<Status, { label: string; order: number }> = {
  building: { label: 'Being built', order: 0 },
  designed: { label: 'Designed', order: 1 },
  proposed: { label: 'Proposed', order: 2 },
  idea: { label: 'Ideas', order: 3 },
  built: { label: 'Built', order: 4 },
  guide: { label: 'Guide', order: 5 },
};

export const PILLARS: Record<Pillar, { name: string; blurb: string }> = {
  trade: { name: 'Trade', blurb: 'Markets, companies and contracts, and the money that moves between the stars.' },
  fight: { name: 'Fight', blurb: 'Pirates, police and Marshals, the law, and the road to Elite.' },
  explore: { name: 'Explore', blurb: 'Surveys, signals, trails and the worlds beyond the lanes.' },
  core: { name: 'Flight and the ship', blurb: 'How it flies, what you see, and the ship you live in.' },
  world: { name: 'The world', blurb: 'The ships, stations, companies and people of the eight galaxies.' },
  shared: { name: 'Shared space', blurb: 'Flying with other commanders, and the galaxy you share.' },
  platform: { name: 'The platform', blurb: 'How Witchspace is built in the open, and how you can help.' },
};

export const SKILLS: Record<string, string> = {
  ships: 'Ships and design',
  writing: 'Writing',
  art: 'Art and interface',
  playtest: 'Playtesting',
  design: 'Game design',
  code: 'Code',
};

/** Every document with a header: docs/design/*.md, plus the worldbuilding, companies and ideas documents. */
export function loadDocs(root: string): Doc[] {
  const files = [
    ...readdirSync(join(root, 'docs/design'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `docs/design/${f}`),
    'docs/companies.md',
    'docs/worldbuilding.md',
    'docs/ideas.md',
  ];
  return files.flatMap((file) => {
    const doc = parseDoc(file, readFileSync(join(root, file), 'utf8'));
    return doc ? [doc] : [];
  });
}

/** The header: `key: value` lines and `  - item | tag` lists between --- lines. Simple on purpose. */
export function parseDoc(file: string, text: string): Doc | null {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fields: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  let list = '';
  for (const line of m[1].split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && list) {
      lists[list].push(item[1].trim());
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    if (kv[2] === '') lists[(list = kv[1])] = [];
    else {
      fields[kv[1]] = kv[2].trim();
      list = '';
    }
  }
  const split = (s: string) => {
    const i = s.lastIndexOf('|');
    return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
  };
  const slug = file.split('/').pop()!.replace(/\.md$/, '');
  return {
    file,
    slug,
    title: fields.title ?? slug,
    status: (fields.status as Status) ?? 'proposed',
    pillar: (fields.pillar as Pillar) ?? 'platform',
    summary: fields.summary ?? '',
    card: fields.card ?? 'cobra-mk3',
    stages: (lists.stages ?? []).map((s) => {
      const [name, status] = split(s);
      return { name, status: (status as Status) || 'proposed' };
    }),
    help: (lists.help ?? []).map((s) => {
      const [task, skill] = split(s);
      return { task, skill: skill || 'design' };
    }),
    body: text.slice(m[0].length),
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A design's stages as a row of steps: built, being built, and still to come. */
export function stagesHtml(doc: Doc): string {
  if (!doc.stages.length) return '';
  return `<ol class="stages">${doc.stages
    .map((s) => `<li class="${s.status}"><span class="dot" aria-hidden="true"></span><span>${esc(s.name)}</span><em>${esc(STATUS[s.status]?.label ?? s.status)}</em></li>`)
    .join('')}</ol>`;
}

/** How many stages are built, as "3 of 5 built". */
const progress = (doc: Doc) => {
  if (!doc.stages.length) return '';
  const done = doc.stages.filter((s) => s.status === 'built').length;
  return `${done} of ${doc.stages.length} built`;
};

/** The panel at the top of a design's page: where it stands and what help it needs. */
export function docPanel(doc: Doc): string {
  const help = doc.help.length
    ? `<div class="doc-help"><h3>Help wanted</h3><ul>${doc.help.map((h) => `<li><span class="skill ${esc(h.skill)}">${esc(SKILLS[h.skill] ?? h.skill)}</span> ${esc(h.task)}</li>`).join('')}</ul><p class="muted small">Pick one up: say so in <a href="https://github.com/witchspace-game/witchspace/discussions">Discussions</a> or at <a href="mailto:hello@witchspace.org.uk">hello@witchspace.org.uk</a>, or <a href="/ideas/?about=${encodeURIComponent(doc.title)}">suggest an idea</a> about it.</p></div>`
    : '';
  return `<aside class="doc-panel">
  <p class="doc-status"><span class="tag ${doc.status}">${STATUS[doc.status].label}</span><span class="muted">${esc(PILLARS[doc.pillar].name)}${progress(doc) ? ` · ${progress(doc)}` : ''}</span></p>
  ${stagesHtml(doc)}
  ${help}
</aside>`;
}

/** The roadmap: every design, by pillar, with its status and stages; built ones last. */
export function roadmapHtml(docs: Doc[]): string {
  const counts = (Object.keys(STATUS) as Status[])
    .filter((s) => s !== 'guide')
    .map((s) => {
      const n = docs.filter((d) => d.status === s).length;
      return `<li><b>${n}</b> ${s === 'idea' ? (n === 1 ? 'idea' : 'ideas') : STATUS[s].label.toLowerCase()}</li>`;
    })
    .join('');
  const pillars = (Object.keys(PILLARS) as Pillar[])
    .map((p) => {
      const items = docs.filter((d) => d.pillar === p && d.status !== 'guide').sort((a, b) => STATUS[a.status].order - STATUS[b.status].order || a.title.localeCompare(b.title));
      if (!items.length) return '';
      return `<section class="pillar" id="${p}">
    <div class="pillar-head"><h2>${PILLARS[p].name}</h2><p class="muted">${PILLARS[p].blurb}</p></div>
    <div class="road-items">
${items
  .map(
    (d) => `      <a class="road-item card link ${d.status}" href="/design/${d.slug}/">
        <span class="tag ${d.status}">${STATUS[d.status].label}</span>
        <h3>${esc(d.title)}</h3>
        <p>${esc(d.summary)}</p>
        ${d.stages.length ? `<span class="road-steps" aria-label="${progress(d)}">${d.stages.map((s) => `<i class="${s.status}" title="${esc(s.name)}: ${esc(STATUS[s.status]?.label ?? s.status)}"></i>`).join('')}<small>${progress(d)}</small></span>` : ''}
        ${d.help.length ? `<span class="road-help">${d.help.length} way${d.help.length === 1 ? '' : 's'} to help</span>` : ''}
      </a>`,
  )
  .join('\n')}
    </div>
  </section>`;
    })
    .join('\n');
  return `<section class="section roadmap-page">
  <div class="section-head">
    <p class="kicker">Built in the open</p>
    <h1>Roadmap</h1>
    <p class="lede">Everything that's built, being built and still to come, and where you could help. Each card opens its design: what it is, how far along, and what it needs.</p>
    <ul class="road-counts">${counts}</ul>
    <p><a class="button primary small" href="/get-involved/#help-wanted">See all the help wanted</a> <a class="button ghost small" href="/design/">All design documents</a> <a class="button ghost small" href="/ideas/">Suggest an idea</a></p>
    <nav class="pillar-nav" aria-label="Pillars">${(Object.keys(PILLARS) as Pillar[]).map((p) => `<a href="#${p}">${PILLARS[p].name}</a>`).join('')}</nav>
  </div>
  ${pillars}
</section>`;
}

/** The design library: every document, by pillar. */
export function libraryHtml(docs: Doc[]): string {
  return `<section class="section">
  <div class="section-head">
    <p class="kicker">Designed in the open</p>
    <h1>Design documents</h1>
    <p class="lede">Ideas are written down and argued over before they're built, so anyone can see where the game is going and help shape it. Here's every design, and where each one stands. For the big picture, see the <a href="/roadmap/">roadmap</a>.</p>
  </div>
${(Object.keys(PILLARS) as Pillar[])
  .map((p) => {
    const items = docs.filter((d) => d.pillar === p).sort((a, b) => a.title.localeCompare(b.title));
    if (!items.length) return '';
    return `  <h2 class="library-head">${PILLARS[p].name}</h2>
  <div class="grid">
${items.map((d) => `    <a class="card link" href="/design/${d.slug}/"><span class="tag ${d.status}">${STATUS[d.status].label}</span><h3>${esc(d.title)}</h3><p>${esc(d.summary)}</p></a>`).join('\n')}
  </div>`;
  })
  .join('\n')}
</section>`;
}

/** Every task from every design, by skill, for the get-involved page. */
export function helpWantedHtml(docs: Doc[]): string {
  const bySkill = new Map<string, { task: string; doc: Doc }[]>();
  for (const d of docs) for (const h of d.help) bySkill.set(h.skill, [...(bySkill.get(h.skill) ?? []), { task: h.task, doc: d }]);
  const skills = Object.keys(SKILLS).filter((s) => bySkill.has(s));
  return `<section class="section" id="help-wanted">
  <div class="section-head">
    <p class="kicker">Help wanted</p>
    <h2>Pick something up</h2>
    <p class="lede">Every design lists what it needs. Here's all of it, by what you're good at. Say which you'd like in <a href="https://github.com/witchspace-game/witchspace/discussions">Discussions</a> or at <a href="mailto:hello@witchspace.org.uk">hello@witchspace.org.uk</a>, and we'll help you get started. No code needed for most of it.</p>
  </div>
  <div class="help-grid">
${skills
  .map(
    (s) => `    <div class="card help-skill">
      <h3><span class="skill ${s}">${SKILLS[s]}</span></h3>
      <ul>${bySkill
        .get(s)!
        .map((h) => `<li>${esc(h.task)} <a href="/design/${h.doc.slug}/">${esc(h.doc.title)}</a></li>`)
        .join('')}</ul>
    </div>`,
  )
  .join('\n')}
  </div>
</section>`;
}

/** For the home page: what's being built right now, with its progress. */
export function roadmapSummaryHtml(docs: Doc[]): string {
  const now = docs.filter((d) => d.status === 'building').sort((a, b) => b.stages.filter((s) => s.status === 'built').length - a.stages.filter((s) => s.status === 'built').length);
  return `<div class="road-items">
${now
  .slice(0, 6)
  .map(
    (d) => `    <a class="road-item card link building" href="/design/${d.slug}/">
      <span class="tag building">${esc(PILLARS[d.pillar].name)}</span>
      <h3>${esc(d.title)}</h3>
      <p>${esc(d.summary)}</p>
      ${d.stages.length ? `<span class="road-steps" aria-label="${progress(d)}">${d.stages.map((s) => `<i class="${s.status}" title="${esc(s.name)}"></i>`).join('')}<small>${progress(d)}</small></span>` : ''}
    </a>`,
  )
  .join('\n')}
  </div>`;
}
