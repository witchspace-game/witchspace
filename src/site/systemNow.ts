import type { StarSystem } from '../galaxy/generate';
import { galaxyNow } from '../mcp/galaxyNow';
import { escapeHtml } from '../ui/escape';

// A star system's page, the part that changes: what's happening there right now, worked out from the
// seed and the clock exactly as the game works it out (galaxy_now, src/mcp/galaxyNow.ts). The build
// writes it once into the page, stamped with its time, so every page has its own words for search;
// the page's script (system.ts) works it out again as you read.

/** A system's page on the site: the first galaxy's, by name (every name there is unique, and plain letters). */
export const systemUrl = (name: string) => `/galaxy/${name.toLowerCase()}/`;

const link = (name: string) => `<a href="${systemUrl(name)}">${escapeHtml(name)}</a>`;

const list = (items: string[]) => (items.length ? escapeHtml(items.join(', ')) : 'nothing in particular');

/** `hullName` turns a ship id into her name: the build has the ship files, the browser the bundled fleet. */
export function systemNowHtml(s: StarSystem, now: number, hullName: (id: string) => string): string {
  const n = galaxyNow(s, now, hullName);
  const time = new Date(now).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const event = n.event
    ? `<div class="sys-event"><h3>${escapeHtml(n.event.headline)}</h3><p>${escapeHtml(n.event.name)} · wanted: ${escapeHtml(n.event.wanted)} · eases in about ${escapeHtml(n.event.endsIn)}</p></div>`
    : `<div class="sys-event quiet"><h3>All quiet at ${escapeHtml(n.system)}</h3><p>No famine, war or boom here right now.</p></div>`;
  const yard = n.yard
    ? `<p class="sys-yard"><b>Wexley-Yorozu’s yard:</b> ${escapeHtml(n.yard.stage)}, ${escapeHtml(n.yard.through)} through. ${escapeHtml(n.yard.news)}</p>`
    : n.yardsNearby.length
      ? `<p class="sys-yard">The nearest Wexley-Yorozu yard: ${link(n.yardsNearby[0].system)}, ${n.yardsNearby[0].distanceLy} LY away (${escapeHtml(n.yardsNearby[0].stage.toLowerCase())}).</p>`
      : '';
  const price = (x: { good: string; price: string; vsUsual: string }) => `<li>${escapeHtml(x.good)} <b>${escapeHtml(x.price)}</b> <small>${escapeHtml(x.vsUsual)} on the usual</small></li>`;
  const market = `<div class="sys-market">
      <div><h3>Dear today</h3>${n.market.dearToday.length ? `<ul>${n.market.dearToday.map(price).join('')}</ul>` : '<p class="muted">Nothing unusually dear.</p>'}</div>
      <div><h3>Cheap today</h3>${n.market.cheapToday.length ? `<ul>${n.market.cheapToday.map(price).join('')}</ul>` : '<p class="muted">Nothing unusually cheap.</p>'}</div>
      <p class="muted small">Usually buys in ${list(n.market.imports)}; usually sells ${list(n.market.exports)}.</p>
    </div>`;
  const ships = n.timetable.length
    ? `<ol class="sys-traffic">${n.timetable
        .map(
          (v) =>
            `<li><time>${escapeHtml(v.in)}</time><span><b>${escapeHtml(v.ship)}</b> <small>${escapeHtml(v.company === 'independent' ? 'Independent' : v.company)} ${escapeHtml(v.hull)}</small></span><small>${'arriving' in v ? `in from ${link(v.from)}` : `out to ${link(v.to)}`}${'for' in v ? ` for ${escapeHtml(String(v.for))}` : ''} with ${escapeHtml(v.cargo)}${v.escorts ? ` · ${v.escorts} escort${v.escorts > 1 ? 's' : ''}` : ''}</small></li>`,
        )
        .join('')}</ol>`
    : '<p class="muted">No ships due in the next half hour.</p>';
  const news = n.news.length
    ? `<ul class="sys-news">${n.news.map((x) => `<li>${escapeHtml(x.headline)} <small>${x.distanceLy} LY away · heard ${escapeHtml(x.heard)}${x.mayBeOver ? ' · may be over by now' : ''}</small></li>`).join('')}</ul>`
    : '<p class="muted">No news from elsewhere has reached here.</p>';
  return `${event}
    ${yard}
    ${market}
    <div class="sys-cols">
      <div><h3>Due in the next half hour</h3>${ships}</div>
      <div><h3>News heard here</h3>${news}</div>
    </div>
    <p class="caption">Worked out from the galaxy’s clock at ${escapeHtml(time)} UTC, as the game works it out: the same for every commander. Its ships are the galaxy’s traffic, not other players.</p>`;
}
