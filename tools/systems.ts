// The galaxy on the site: a page for every star system in the first galaxy, and the hub that charts them
// (Mark, 1 Nov 2026: "i like the idea of building a star system page"; words by Marketing). Everything on
// a page comes from the seed, as the game makes it: its facts and its neighbours are fixed, and what's
// happening there now is written in at build time and worked out again in the browser (src/site/systemNow.ts).

import { distanceLy, ECONOMIES, galaxy, GOVERNMENTS, type StarSystem } from '../src/galaxy/generate';
import { stationName } from '../src/galaxy/stationNames';
import { LANE_LY } from '../src/game/traffic';
import { systemNowHtml, systemUrl } from '../src/site/systemNow';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The first galaxy: the one with pages. */
export const SYSTEMS = galaxy(0);
const LAVE = SYSTEMS.find((s) => s.name === 'Lave')!;

/** The game's words, lowercased, as nouns: "a poor agricultural anarchy", "a rich industrial feudal world". */
const GOVERNMENT_NOUN = ['anarchy', 'feudal world', 'multi-government', 'dictatorship', 'communist state', 'confederacy', 'democracy', 'corporate state'];
const a = (word: string) => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);
export const kindOf = (s: StarSystem) => `${ECONOMIES[s.economy].toLowerCase()} ${GOVERNMENT_NOUN[s.government]}`;

/** About how wide a letter is on the chart, in chart units (its labels are 1.6 units high). */
const LETTER = 0.95;
const ly = (d: number) => `${d.toFixed(1)} LY`;
const byDistance = (s: StarSystem) =>
  SYSTEMS.filter((o) => o !== s)
    .map((o) => ({ o, d: distanceLy(s, o) }))
    .sort((x, y) => x.d - y.d);

/** Chart position as drawn: the galaxy is twice as wide as it's tall, as the game's chart shows it. */
const at = (s: StarSystem) => ({ x: s.x, y: s.y / 2 });

/** The neighbourhood: systems around her, the jump circle, and a line to each one in reach. */
function localChart(s: StarSystem, near: { o: StarSystem; d: number }[]): string {
  const R = 30;
  const c = at(s);
  const inView = SYSTEMS.filter((o) => Math.abs(at(o).x - c.x) <= R && Math.abs(at(o).y - c.y) <= R);
  const reach = new Set(near.filter((n) => n.d <= LANE_LY).map((n) => n.o));
  // 7 LY is 17.5 chart units across (distanceLy halves the height, as we've already done here).
  const jump = (LANE_LY / 0.4).toFixed(1);
  // Labels: hers first, then the ones in reach, then the rest nearest first; any that would overlap one
  // already placed, or run off the frame, are left off (the dot stays, and its name shows on hover).
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const labelled = new Set<StarSystem>();
  for (const o of [...inView].sort((p, q) => rank(p) - rank(q) || distanceLy(s, p) - distanceLy(s, q))) {
    const p = at(o);
    const box = { x0: p.x - 0.6, x1: p.x + 1.3 + o.name.length * LETTER, y0: p.y - 1.1, y1: p.y + 1.1 };
    if (box.x1 > c.x + R - 0.5 || boxes.some((b) => box.x0 < b.x1 && b.x0 < box.x1 && box.y0 < b.y1 && b.y0 < box.y1)) continue;
    boxes.push(box);
    labelled.add(o);
  }
  function rank(o: StarSystem) {
    return o === s ? 0 : reach.has(o) ? 1 : 2;
  }
  const dot = (o: StarSystem) => {
    const p = at(o);
    const here = o === s;
    return `<a href="${systemUrl(o.name)}"${here ? ' aria-current="page"' : ''}><title>${esc(o.name)}</title><circle cx="${p.x}" cy="${p.y}" r="${here ? 0.9 : 0.55}" class="${here ? 'here' : reach.has(o) ? 'reach' : ''}"/>${labelled.has(o) ? `<text x="${p.x + 1.3}" y="${p.y + 0.55}">${esc(o.name)}</text>` : ''}</a>`;
  };
  return `<svg class="sys-chart" viewBox="${c.x - R} ${c.y - R} ${R * 2} ${R * 2}" role="img" aria-label="${esc(s.name)} and the systems around it, with a circle showing a ${LANE_LY} light-year jump">
      <circle class="jump" cx="${c.x}" cy="${c.y}" r="${jump}"/>
      ${[...reach].map((o) => `<line x1="${c.x}" y1="${c.y}" x2="${at(o).x}" y2="${at(o).y}"/>`).join('')}
      ${inView.map(dot).join('\n      ')}
    </svg>`;
}

/** A sentence or two of her own: what's near, and how far from where everyone starts. */
function situation(s: StarSystem, near: { o: StarSystem; d: number }[]): string {
  const inReach = near.filter((n) => n.d <= LANE_LY);
  const out: string[] = [];
  if (s === LAVE) out.push('Every commander starts here, with 100 credits and a Cobra.');
  else out.push(`${esc(s.name)} is ${ly(distanceLy(s, LAVE))} from <a href="${systemUrl('Lave')}">Lave</a>, where every commander starts.`);
  if (!inReach.length) out.push(`No other system lies within a ${LANE_LY} light-year jump: the nearest is <a href="${systemUrl(near[0].o.name)}">${esc(near[0].o.name)}</a>, ${ly(near[0].d)} away.`);
  else out.push(`${inReach.length === 1 ? 'One system lies' : `${inReach.length} systems lie`} within a ${LANE_LY} light-year jump, the nearest <a href="${systemUrl(inReach[0].o.name)}">${esc(inReach[0].o.name)}</a> at ${ly(inReach[0].d)}.`);
  if (s.government !== 0) {
    const anarchy = near.find((n) => n.o.government === 0);
    if (anarchy && anarchy.d <= 15) out.push(`The nearest anarchy, <a href="${systemUrl(anarchy.o.name)}">${esc(anarchy.o.name)}</a>, is ${ly(anarchy.d)} away: pirates’ country.`);
  } else out.push('There’s no law here: no police, and nobody to answer a distress call but other ships.');
  return out.join(' ');
}

export function systemPage(s: StarSystem, now: number, hullName: (id: string) => string, intro?: string) {
  const near = byDistance(s);
  const station = stationName(s);
  const kind = kindOf(s);
  const people = `home to ${s.population} billion ${s.species}`;
  // The people are the most clickable part ("2 billion Harmless Rodents"): kept unless they push it past 155 characters (Marketing).
  let description = `${s.name} is ${a(kind)} at tech level ${s.techLevel}, ${people}. Its news, prices and traffic now. Fly free in your browser.`;
  if (description.length > 155) description = `${s.name} is ${a(kind)} at tech level ${s.techLevel}. Its news, prices and traffic right now. Fly free in your browser.`;
  const facts: [string, string][] = [
    ['Government', GOVERNMENTS[s.government]],
    ['Economy', ECONOMIES[s.economy]],
    ['Tech level', String(s.techLevel)],
    ['Population', `${s.population} billion`],
    ['Productivity', `${s.productivity.toLocaleString('en-GB')} M Cr`],
    ['Planet radius', `${s.radius.toLocaleString('en-GB')} km`],
  ];
  const reach = near.filter((n) => n.d <= LANE_LY);
  const neighbours = (reach.length ? reach : near.slice(0, 3))
    .map((n) => `<li><a href="${systemUrl(n.o.name)}">${esc(n.o.name)}</a> <small>${ly(n.d)} · ${esc(kindOf(n.o))}</small></li>`)
    .join('');
  return {
    title: `${s.name}: ${a(kind)} | Witchspace`,
    description,
    name: s.name,
    content: `<section class="section system-page">
  <a class="back" href="/galaxy/">← The galaxy</a>
  <div class="sys-hero">
    <div class="sys-copy">
      <p class="kicker">${esc(GOVERNMENTS[s.government])} · ${esc(ECONOMIES[s.economy])} · Tech level ${s.techLevel}</p>
      <h1>${esc(s.name)}</h1>
      <p class="lede">${esc(s.name)} is ${a(kind)}, ${esc(people)}.${intro ? '' : ` Its station is ${esc(station.name)}${station.honours ? `, named for ${esc(station.honours)}` : ''}.`}</p>
      ${intro ? `<p class="lede sys-intro">${esc(intro).replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>')}</p>` : ''}
      ${intro ? '' : `<p>${situation(s, near)}</p>`}
      <dl class="ship-stats">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="sys-play"><a class="button primary" href="/play/?system=${s.name.toLowerCase()}">Fly there free</a> <span class="muted small">The game opens its chart on ${esc(s.name)}: plot a course from where you are.</span></p>
    </div>
    <figure class="sys-map">
      ${localChart(s, near)}
      <figcaption>${esc(s.name)} and its neighbours. The circle is a ${LANE_LY} light-year jump, a Cobra’s full tank.</figcaption>
    </figure>
  </div>

  <section class="sys-now" id="sys-now" data-index="${s.index}" aria-live="polite">
    <h2>${esc(s.name)} right now</h2>
    <div id="sys-now-body">${systemNowHtml(s, now, hullName)}</div>
  </section>

  <section class="sys-near">
    <h2>${reach.length ? 'Within a jump' : 'The nearest systems'}</h2>
    <ul class="sys-neighbours">${neighbours}</ul>
  </section>
</section>`,
  };
}

/** Labels for the hub's chart, 3 units high: each where it doesn't cover another label or a dot (Lave first). */
function hubLabels(named: StarSystem[]): string {
  const W = 1.85; // a letter's width at this size
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const hits = (b: { x0: number; x1: number; y0: number; y1: number }, own: StarSystem) =>
    b.x0 < -3 || b.x1 > 259 || b.y0 < -3 || b.y1 > 131 ||
    placed.some((o) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1) ||
    SYSTEMS.some((o) => o !== own && at(o).x > b.x0 - 1 && at(o).x < b.x1 + 1 && at(o).y > b.y0 - 1 && at(o).y < b.y1 + 1);
  return [...named]
    .sort((p, q) => Number(q === LAVE) - Number(p === LAVE))
    .map((s) => {
      const p = at(s);
      const w = s.name.length * W;
      const tries = [
        { x: p.x + 2, y: p.y + 1.1, anchor: 'start' },
        { x: p.x - 2, y: p.y + 1.1, anchor: 'end' },
        { x: p.x, y: p.y - 2.2, anchor: 'middle' },
        { x: p.x, y: p.y + 4.4, anchor: 'middle' },
      ];
      const box = (t: (typeof tries)[number]) => {
        const x0 = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2;
        return { x0, x1: x0 + w, y0: t.y - 2.6, y1: t.y + 0.6 };
      };
      const t = tries.find((c) => !hits(box(c), s)) ?? tries[0];
      placed.push(box(t));
      return `<text x="${t.x}" y="${t.y}" text-anchor="${t.anchor}"${s === LAVE ? ' class="here"' : ''}>${esc(s.name)}</text>`;
    })
    .join('');
}

/** The whole first galaxy, every system a link, Lave marked. */
function galaxyChart(famous: string[]): string {
  const dot = (s: StarSystem) => {
    const p = at(s);
    return `<a href="${systemUrl(s.name)}"><circle cx="${p.x}" cy="${p.y}" r="${s === LAVE ? 1.6 : 1}"${s === LAVE ? ' class="here"' : ''}/><title>${esc(s.name)}: ${esc(a(kindOf(s)))}</title></a>`;
  };
  return `<svg class="sys-chart galaxy-chart" viewBox="-4 -4 264 136" role="img" aria-label="The first galaxy's 256 star systems; Lave, where every commander starts, is marked">
      ${SYSTEMS.map(dot).join('')}
      ${hubLabels(SYSTEMS.filter((s) => s === LAVE || famous.includes(s.name)))}
    </svg>`;
}

/** `famous`: the systems with words of their own, labelled on the chart so it says "click me". */
export function galaxyHub(famous: string[]) {
  const sorted = [...SYSTEMS].sort((x, y) => x.name.localeCompare(y.name));
  // Grouped by first letter, with a row to jump between them: 256 names in one column is two dozen screens on a phone (Marketing).
  const letters = [...new Set(sorted.map((s) => s.name[0]))];
  return {
    title: 'The galaxy right now: 256 star systems | Witchspace',
    description: 'Every star system in Witchspace’s first galaxy: its government, economy and people, and what’s happening there right now. Fly free in your browser.',
    name: 'The galaxy',
    content: `<section class="section galaxy-hub">
  <div class="section-head">
    <h1>The galaxy, right now</h1>
    <p class="lede">256 star systems, all worked out from one seed and one clock: the trick that fitted eight galaxies into 22KB in 1984, taken from places to time. Every page shows what’s happening there now, exactly as the game sees it, because both calculate it the same way.</p>
    <p class="muted">This is the first of eight galaxies. Choose any world on the chart.</p>
  </div>
  <figure class="sys-map wide">${galaxyChart(famous)}</figure>
  <h2 id="a-to-z">Every system, A to Z</h2>
  <nav class="galaxy-letters" aria-label="Jump to a letter">${letters.map((l) => `<a href="#letter-${l}">${l}</a>`).join('')}</nav>
  ${letters
    .map(
      (l) => `<section class="galaxy-letter" id="letter-${l}"><h3>${l}</h3><ul class="galaxy-list">${sorted
        .filter((s) => s.name[0] === l)
        .map((s) => `<li><a href="${systemUrl(s.name)}">${esc(s.name)}</a> <small>${esc(kindOf(s))}</small></li>`)
        .join('')}</ul></section>`,
    )
    .join('\n  ')}
</section>`,
    list: sorted,
  };
}
