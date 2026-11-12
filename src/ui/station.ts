// The station screen (moved from main.ts): your ship and what's fitted, the hold, the record, fuel,
// missiles and kit to buy or sell, and refunds for a change of mind before launch.

import { sfx } from '../audio/sound';
import { cargoCapacity, cargoTonnes, DIFFICULTIES, EQUIPMENT, FUEL_PRICE, fuelCapacity, MISSILE_PRICE, hasEquipment, REPAIR_FRACTION, type Mount, MOUNTS, removeEquipment, saveCommander, type Commander } from '../game/commander';
import { fineDue, legalStatus, redeemImpound, scansCargo, settle, systemKey } from '../game/law';
import { isTouch } from '../game/input';
import { claimCallsign } from './accountPanel';
import { cleanName } from '../../server/src/protocol';
import { combatRating, nextRating, ratingPoints } from '../game/rating';
import { buildFittings, disposeFittings, type Fittings, type Loadout } from '../render/fittings';
import { KIT_GROUPS, KIT_NAMES, kitGroup, type KitGroup } from '../game/kit';
import { laserLocked, production, specKitLines } from '../game/shipyard';
import { PLAYER_LASERS, type LaserId } from '../game/weapons';
import { forDevice } from './deviceWords';
import { addStanding, cargoName, destinationOf, forContract, wyWorks } from '../game/contracts';
import { COMPANIES } from '../game/companies';
import { dataValue, exploreOf, explorerRank, publishReports, NINEFOLD_REPORT, REPORT_PRICE, sellData, trailsUnderWay } from '../game/explore';
import { stationName } from '../galaxy/stationNames';
import { flash } from './hud';
import { systemAt } from '../galaxy/generate';
import { commodityById } from '../economy/commodities';
import { escapeHtml } from './escape';
import { editionById, editionNo } from '../content/editions';
import { $, cmdr, currentSystem, game } from '../core';
import { player } from '../scene';
import { openManual } from './manual';
import { hasRecord, openRapSheet } from './rapSheet';
import { plotCourse, renderContracts } from './contracts';
import { openBooth, showroomModels } from './showroom';
import { hasShipyard, renderShipyard, showOwnShip, waitingSpecKit } from './shipyard';
import { renderSaloon } from './saloon';
import { VENN, vennAtStation, vennAway } from '../game/odile';
import { venue } from '../game/saloon';
import { renderMarket, renderNews } from './market';
import type { DockTab } from '../core';
import type { SurveyData } from '../game/explore';
import type { StarSystem } from '../galaxy/generate';
import type { Settlement } from '../game/law';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  setDockTab: (tab: DockTab) => void;
  updateDockHead: () => void;
  canSettle: (c: Commander) => boolean;
  legalLabel: () => string;
  bringHome: (held: SurveyData[]) => void;
  myFirsts: (galaxy: number) => number;
  explorerTips: (c: Commander, here: StarSystem) => [string, string][];
  showLog: (title: string, text: string, ms: number) => void;
  settlementMessage: (s: Settlement, lead: string) => string;
  refreshFlightLog: () => void;
};
export const initStation = (hooks: typeof main) => Object.assign(main, hooks);

// What was bought on this visit, so a change of mind before launch gets the
// full price back. Anything older sells for half, like a laser part exchange.
let boughtHere: {
  equipment: Set<string>;
  /** Per mount: what was fitted before, and what the swap cost. */
  lasers: Partial<Record<Mount, { previous?: LaserId; paid: number }>>;
  missiles: number;
} = { equipment: new Set(), lasers: {}, missiles: 0 };
/** A new visit: nothing bought here yet. */
export function resetBoughtHere() {
  boughtHere = { equipment: new Set(), lasers: {}, missiles: 0 };
}

/** A sale at half price loses money, so it asks for a second click. */
function confirmSale(button: HTMLButtonElement, label: string, sell: () => void) {
  button.addEventListener('click', () => {
    if (button.dataset.armed) return sell();
    button.dataset.armed = '1';
    button.textContent = label;
    button.classList.add('armed');
  });
  button.addEventListener('blur', () => {
    if (button.dataset.armed) renderDocked();
  });
}

// The commander's lasers, missiles and equipment, drawn on the hangar ship.
let fittings: Fittings | null = null;

export function showFittings(c: Commander | null) {
  if (fittings) disposeFittings(fittings);
  fittings = null;
  const model = showroomModels.find((m) => m.def.id === player.def.id);
  if (!c || !model) return;
  const size = { pulse: 1, beam: 2, military: 3 };
  const lasers: Loadout['lasers'] = {};
  for (const mount of MOUNTS) {
    const id = c.lasers[mount];
    if (id) lasers[mount] = { color: PLAYER_LASERS[id].color, size: size[id] };
  }
  fittings = buildFittings(model.def, { lasers, missiles: c.missiles, equipment: c.equipment });
  model.root.add(fittings.group);
}

/** Change your callsign at a station: the name becomes a little form until you save or cancel. */
function startRename() {
  const c = cmdr();
  const dd = $('#cmdr-card .cc-top');
  dd.innerHTML = `<form class="rename-form"><input maxlength="24" value="${escapeHtml(c.name).replace(/"/g, '&quot;')}" aria-label="Callsign" /> <button type="submit">Save</button> <button type="button" data-cancel>Cancel</button><small class="cc-rules">${DIFFICULTIES[c.difficulty].name} rules</small></form>`;
  const input = dd.querySelector('input')!;
  input.focus();
  input.select();
  dd.querySelector('[data-cancel]')!.addEventListener('click', () => renderDocked());
  dd.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName(input.value);
    if (name === c.name) return renderDocked();
    // Signed in, your callsign is your account's: it has to be free.
    claimCallsign(name)
      .then((claimed) => {
        c.name = claimed;
        saveCommander(c);
        flash(`Callsign changed: CMDR ${claimed}`, 2);
      })
      .catch((err: Error) => flash(err.message, 3))
      .finally(() => renderDocked());
  });
}

/** What's in the hold, company cargo included, for the Station tab's cargo tile. */
function holdItems(c: Commander): { t: number; name: string }[] {
  const own = Object.entries(c.cargo)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ t: q, name: commodityById(id)?.name ?? id }));
  const company = (c.contracts ?? []).filter((a) => !a.adrift).map((a) => ({ t: a.qty, name: `${cargoName(a)} (${COMPANIES[a.company].name}, for ${destinationOf(a).name})` }));
  return [...own, ...company];
}

/** Your ship at the top of the Station screen: maker and role, her name, her own name and edition, and her setup. */
function renderShipWindow(c: Commander) {
  const def = player.def;
  const win = $('#ship-window');
  win.style.setProperty('--hull', c.paint?.colour ?? def.style.lineColor);
  win.querySelector('.sw-meta')!.textContent = [def.manufacturer, def.role].filter(Boolean).join(' · ');
  win.querySelector('.sw-name')!.textContent = def.name;
  const ed = c.paint?.edition ? editionById(c.paint.edition.id) : undefined;
  const own = [c.paint?.name ? `“${c.paint.name}”` : '', ed ? `${ed.name} ${editionNo(c.paint!.edition!.number)}` : ''].filter(Boolean).join(' · ');
  const ownEl = win.querySelector<HTMLElement>('.sw-own')!;
  // In grey like any other secondary line, with a swatch of her paint (Mark: no paint-coloured text).
  ownEl.innerHTML = own ? `${c.paint ? '<i class="swatch" aria-hidden="true"></i>' : ''}${escapeHtml(own)}` : '';
  ownEl.hidden = !own;
  const kit = [
    ...MOUNTS.filter((m) => c.lasers[m]).map((m) => `${m[0].toUpperCase()}${m.slice(1)} ${PLAYER_LASERS[c.lasers[m]!].name.replace(' laser', '').toLowerCase()}`),
    ...(c.paint?.luxuries.includes('black-light-lights') ? [c.paint.ghost ? 'Lights off' : 'Black-light'] : []),
  ];
  win.querySelector('.sw-kit')!.innerHTML = kit.map((k) => `<li>${escapeHtml(k)}</li>`).join('');
  win.querySelector('.sw-hint')!.textContent = isTouch ? 'Drag to turn her' : 'Drag to turn her · scroll to zoom';
}

// Wanted here, the station says so first, with the way out (Mark, 31 October 2026: the Settle
// button "would be missed by users and they would launch and immediately get attacked and not
// understand why"). The first Launch while wanted only warns (main.ts launch).
function renderWanted(c: Commander) {
  const box = $('#wanted');
  box.hidden = !main.canSettle(c);
  if (box.hidden) return;
  const fugitive = legalStatus(c) === 'fugitive';
  const what = [
    fugitive ? 'The police here will open fire as soon as you launch.' : 'You’re on the police’s books here: another crime and they’ll open fire.',
    c.warrant ? 'The Co-operative Marshals are hunting you, and their carrier will come for you.' : '',
  ].filter(Boolean).join(' ');
  const fine = fineDue(c);
  box.innerHTML = `<b>Wanted · ${escapeHtml(main.legalLabel())}</b><p>${what} Settle here for a clean record in this system${c.warrant ? ' and the warrant lifted' : ''}.</p>
    <button type="button" class="settle primary" title="Pay the fine here (never more than half of what you have above 100 Cr): a clean record in this system, any warrant lifted, contraband confiscated">${fine ? `Settle · ${fine.toLocaleString()} Cr` : 'Settle · no charge'}</button>`;
  box.classList.toggle('fugitive', fugitive || c.warrant);
}

/** Launching now would be into police who'll fire: the station's warning, held a moment. */
export function wantedOnLaunch(c: Commander): boolean {
  return main.canSettle(c) && (legalStatus(c) === 'fugitive' || c.warrant);
}

$('#wanted').addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.settle')) return;
  const c = cmdr();
  const settlement = settle(c);
  saveCommander(c);
  sfx.beep();
  renderDocked();
  flash(main.settlementMessage(settlement, 'Settled with the law'), 5);
});
$('#tab-station .ship-actions .manual-open').addEventListener('click', () => openManual(player.def));
$('#tab-station .ship-actions .booth-open').addEventListener('click', () => {
  showOwnShip();
  openBooth();
});

/** Odile Venn on the arrivals board (game/odile.ts): in port, and where to find her, or when she's due. */
function renderArrivals(here: StarSystem) {
  const row = $('#arrivals');
  const now = Date.now();
  const due = cmdr().difficulty === 'modern' && !vennAway(cmdr().venn, now) ? vennAtStation(here, now) : null;
  row.hidden = !due || (!due.inPort && due.visit.docks - now > ARRIVALS_AHEAD);
  if (row.hidden || !due) return;
  const from = systemAt(here.galaxy, due.visit.from).name;
  const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const who = `${VENN.name}'s ${VENN.ship}`;
  row.innerHTML = due.inPort
    ? `<span>In port: <b>${escapeHtml(who)}</b>, in from ${escapeHtml(from)} · in the ${escapeHtml(venue(here).kind)} until about ${clock(due.visit.launches)}</span><button type="button" class="arrivals-saloon">Find her</button>`
    : `<span>Expected: <b>${escapeHtml(who)}</b>, in from ${escapeHtml(from)} about ${clock(due.visit.docks)}</span>`;
  row.querySelector('.arrivals-saloon')?.addEventListener('click', () => document.querySelector<HTMLButtonElement>('.tabs [data-tab="saloon"]')?.click());
}
/** How far ahead the board lists her. */
const ARRIVALS_AHEAD = 4 * 3600_000;

export function renderDocked() {
  // The saloon is Modern's: Classic stations are as they were in 1984.
  document.querySelector<HTMLElement>('.tabs [data-tab="saloon"]')!.hidden = cmdr().difficulty === 'classic';
  // The Money tab gave way to the wallet (Mark): its screen opens from there.
  document.querySelector<HTMLElement>('.tabs [data-tab="money"]')!.hidden = true;
  if (cmdr().difficulty === 'classic' && game.dockTab === 'money') main.setDockTab('station');
  const noYard = cmdr().difficulty === 'classic' || !hasShipyard(currentSystem());
  document.querySelector<HTMLElement>('.tabs [data-tab="shipyard"]')!.hidden = noYard;
  if (noYard && game.dockTab === 'shipyard') main.setDockTab('station');
  else if (game.dockTab === 'shipyard') renderShipyard(); // docking put your own ship in the berth
  const c = cmdr();
  // A ship waiting for you at this yard: a dot on the header, "ready" on the place.
  const hereNow = currentSystem();
  const atYard = (at?: { galaxy: number; system: number }) => at && at.galaxy === hereNow.galaxy && at.system === hereNow.index;
  const ready = (c.order && atYard(c.order) && production(c.order, Date.now()).built) || (c.gift && (!c.gift.at || atYard(c.gift.at)));
  $('.tabs [data-tab="shipyard"]').innerHTML = ready ? 'Shipyard <b class="tab-badge">ready</b>' : 'Shipyard';
  showFittings(c);
  main.refreshFlightLog();
  const here = currentSystem();
  const st = stationName(here);
  $('#dock-location').textContent = `${here.name} · ${st.name}`;
  $('#dock-location').title = st.honours ? `Named for ${st.honours}` : '';
  main.updateDockHead();
  // Company contracts are Modern work; Classic stays as 1984.
  $('.tabs [data-tab="contracts"]').hidden = c.difficulty !== 'modern';
  if (game.dockTab === 'contracts') renderContracts();
  if (game.dockTab === 'market') renderMarket();
  if (game.dockTab === 'news') renderNews();
  // Docked somewhere new with the saloon still open: that station's regulars, not the last one's (Mark).
  if (game.dockTab === 'saloon') renderSaloon();
  renderShipWindow(c);
  // The Commander card (Mark, 12 November 2026): callsign (tap it to rename), the law (tap it for your record),
  // the rank and how far to the next, and the explorer, on one card.
  const status = legalStatus(c);
  const legal = main.legalLabel();
  const rank = combatRating(c.kills);
  const next = nextRating(c.kills);
  const from = ratingPoints(rank);
  const toNext = next ? Math.max(0, Math.min(1, (c.kills - from) / (next.at - from))) : 1;
  const left = next ? next.at - c.kills : 0;
  const ex = exploreOf(c);
  const firsts = main.myFirsts(here.galaxy);
  const badge = `${escapeHtml(legal)}`;
  $('#cmdr-card').innerHTML = `
    <div class="cc-top"><button type="button" class="cc-name rename" title="Your callsign: tap to change it">${escapeHtml(c.name)}</button>${
      hasRecord(c) ? `<button type="button" class="badge rap-open${status === 'clean' ? '' : ' warn'}" title="Your record">${badge} ›</button>` : `<span class="badge${status === 'clean' ? '' : ' warn'}">${badge}</span>`
    }</div>
    <div class="cc-rank"><b>${rank}</b>${c.difficulty === 'classic' || !next ? '' : `<span>${left < 10 ? left.toFixed(1) : Math.ceil(left).toLocaleString()} to ${next.name}</span>`}</div>
    ${c.difficulty === 'classic' ? '' : `<div class="meter" role="progressbar" aria-label="Towards ${next?.name ?? 'Elite'}" aria-valuenow="${Math.round(toNext * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(toNext * 100).toFixed(1)}%"></i></div>`}
    <p class="cc-explore"><b>${explorerRank(ex.points)}</b> · ${ex.visited.length} visited${firsts ? ` · ${firsts} first${firsts === 1 ? '' : 's'}` : ''}</p>`;
  // Anything else worth a line: trails under way, and the explorer's tips.
  const rows: [string, string][] = [
    ...trailsUnderWay(c, here.galaxy).map((t): [string, string] => ['Trail', `${escapeHtml(t.title)} · ${t.found} of ${t.of} found · the clue points to ${escapeHtml(t.next)}`]),
    ...main.explorerTips(c, here),
  ];
  $('#cmdr').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  renderWanted(c);
  $('#cmdr-card .rename').addEventListener('click', () => startRename());
  document.querySelector<HTMLButtonElement>('#cmdr-card .rap-open')?.addEventListener('click', () => void openRapSheet(c));
  document.querySelector<HTMLButtonElement>('#cmdr .tip-course')?.addEventListener('click', (e) => {
    flash(plotCourse(c, Number((e.currentTarget as HTMLButtonElement).dataset.system)), 3);
    saveCommander(c);
    renderDocked();
  });
  // Where you're going rides on the Launch button (Mark: "Launch → Anarlaqu").
  document.querySelectorAll('.launch-label').forEach((l) => (l.textContent = c.target === null ? 'Launch' : `Launch → ${systemAt(here.galaxy, c.target).name}`));

  // The tiles: fuel, missiles, cargo and the running lights, two by two.
  const tile = (label: string, value: string, extra = '') => `<span class="t-label">${label}</span><span class="t-row"><b class="t-val">${value}</b>${extra}</span>`;
  const full = '<span class="t-ok">✓ Full</span>';
  // Fuel: top up to a full tank at the station.
  const missing = Math.round((fuelCapacity(c) - c.fuel) * 10) / 10;
  const affordable = Math.min(missing, Math.floor((c.credits / FUEL_PRICE) * 10) / 10);
  const lyNow = Number.isInteger(c.fuel) ? `${c.fuel}` : c.fuel.toFixed(1);
  $('#fuel').innerHTML = tile('Fuel', `${lyNow} / ${fuelCapacity(c)} LY`, missing <= 0 ? full : '');
  if (missing > 0) {
    const refuel = document.createElement('button');
    refuel.textContent = affordable <= 0 ? 'No credits' : `${affordable < missing ? `+${affordable.toFixed(1)} LY` : 'Fill'} · ${(Math.round(affordable * FUEL_PRICE * 10) / 10).toFixed(1)} Cr`;
    refuel.disabled = affordable <= 0;
    refuel.title = affordable < missing ? 'Refuel as far as your credits allow' : 'Fill the tank';
    refuel.addEventListener('click', () => {
      c.credits = Math.round((c.credits - affordable * FUEL_PRICE) * 10) / 10;
      c.fuel = Math.round((c.fuel + affordable) * 10) / 10;
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    $('#fuel .t-row').append(refuel);
  }

  // Cargo: how full, with a bar (amber when it's full), and what most of it is.
  const used = +cargoTonnes(c).toFixed(1);
  const room = cargoCapacity(c, player.def.stats.cargo);
  const held = holdItems(c).sort((a, b) => b.t - a.t);
  const top = held[0];
  const rest = held.slice(1).reduce((s, h) => s + h.t, 0);
  const line = top ? `${top.t} t ${escapeHtml(top.name)}${rest ? ` · ${+rest.toFixed(1)} t other` : ''}` : 'Empty';
  $('#cargo-tile').innerHTML = `${tile('Cargo', `${used} / ${room} t`)}<span class="meter${used >= room ? ' full' : ''}"><i style="width:${room ? Math.min(100, (used / room) * 100).toFixed(1) : 0}%"></i></span><small class="t-sub">${line}${c.compartment ? ` · ${c.compartment.tonnes} t shielded` : ''}</small>`;
  $('#cargo-tile').title = held.map((h) => `${h.t} t ${h.name}`).join('\n');

  // The Dark Edition's running lights, or the full ghost: just the hull (Mark).
  const lightsTile = $('#lights-tile');
  const lights = Boolean(c.paint?.luxuries.includes('black-light-lights'));
  lightsTile.hidden = !lights;
  $('#cargo-tile').classList.toggle('wide', !lights);
  if (lights) {
    lightsTile.innerHTML = tile('Running lights', c.paint!.ghost ? 'Ghost' : 'Black-light', `<button type="button" class="lights-toggle" title="${c.paint!.ghost ? 'Running lights on: black-light, seen only close to' : 'Running lights off: the full ghost, just the hull'}">${c.paint!.ghost ? 'Lights' : 'Ghost'}</button>`);
    lightsTile.querySelector('.lights-toggle')!.addEventListener('click', () => {
      if (!c.paint) return;
      c.paint.ghost = !c.paint.ghost;
      saveCommander(c);
      showOwnShip();
      flash(c.paint.ghost ? 'Running lights off · the full ghost' : 'Running lights on', 2);
      renderDocked();
    });
  }

  renderArrivals(here);

  // Survey data: sold here, for more the further it's come.
  const dataRow = $('#data-row');
  const data = exploreOf(c).data;
  // Nothing to sell, no row (Mark): it comes back when there's data.
  dataRow.hidden = c.difficulty !== 'modern' || !data.length;
  if (!dataRow.hidden) {
    // Wexley-Yorozu pays best, and is the only one the Science Division's report goes to.
    const wy = wyWorks(here);
    // Moons a survey contract is for are the contract's: kept for it, never sold off cheap.
    const kept = data.filter((d) => forContract(c, d));
    const sellable = data.filter((d) => (wy || !d.report) && !kept.includes(d));
    const worth = sellable.reduce((sum, d) => sum + dataValue(d, here, wy), 0);
    const keptLine = kept.length ? `${kept.map((d) => d.name).join(', ')}: kept for your Wexley-Yorozu survey contract` : '';
    // One row (Mark: the hint was cut off on an iPhone). What's in it is on the title, and on a long press.
    dataRow.innerHTML = `<span>Survey data <b>${data.length || 'none'}</b>${data.length ? ` <small>· ${wy ? 'W-Y pays 25% more here' : 'W-Y pays 25% more'}${kept.length ? ` · ${kept.length} kept for your contract` : ''}</small>` : ''}</span>`;
    dataRow.title = data.length ? [...data.map((d) => `${d.name}: ${forContract(c, d) ? 'kept for your contract' : `${dataValue(d, here, wy)} Cr`}`), keptLine, wy ? 'This is a Wexley-Yorozu station: data sells for 25% more here' : 'Wexley-Yorozu stations pay 25% more: look for them on the galaxy map'].filter(Boolean).join('\n') : 'Fly low over planets, moons and the star to survey them, then sell the data at any station';
    const sell = document.createElement('button');
    sell.textContent = sellable.length ? `Sell · ${worth.toLocaleString()} Cr` : 'Nothing to sell';
    sell.disabled = !sellable.length;
    if (wy && data.some((d) => d.report)) sell.title = `Includes the Ninefold report: the Science Division pays ${REPORT_PRICE.wy.toLocaleString()} Cr, remembers you kindly, and goes looking for Sam Dray`;
    sell.addEventListener('click', () => {
      const held = [...data];
      const { credits, reports } = sellData(c, here, wy, (d) => forContract(c, d));
      main.bringHome(held);
      if (reports) addStanding(c, 'wy', 3);
      saveCommander(c);
      sfx.beep();
      flash(reports ? `The Science Division takes the Ninefold report · ${credits.toLocaleString()} Cr with your data · Wexley-Yorozu is grateful, and the relay keeps saying all well` : `Survey data sold · ${credits.toLocaleString()} Cr`, 4);
      renderDocked();
    });
    dataRow.append(sell);
    // The report: read it before you decide who gets it.
    if (data.some((d) => d.report)) {
      const read = document.createElement('button');
      read.className = 'read-report';
      read.textContent = 'Read the Ninefold report';
      read.addEventListener('click', () => {
        sfx.beep();
        main.showLog(NINEFOLD_REPORT.title, NINEFOLD_REPORT.lines.join('\n\n'), 60000);
      });
      dataRow.querySelector('span')!.append(read);
    }
    // The report, anywhere else: publish it, and live with it.
    if (!wy && data.some((d) => d.report)) {
      const publish = document.createElement('button');
      publish.textContent = `Publish the Ninefold report · ${REPORT_PRICE.published} Cr`;
      publish.title = "The Mutual's newsletter pays, the families learn what happened to the Ninefold, and Mira's message reaches her gran. Wexley-Yorozu will remember. Or keep it for a Wexley-Yorozu station.";
      confirmSale(publish, 'Publish it? Wexley-Yorozu will remember', () => {
        const held = [...data];
        const paid = publishReports(c);
        main.bringHome(held);
        addStanding(c, 'wy', -3);
        saveCommander(c);
        sfx.beep();
        flash(`The Ninefold report is published · ${paid} Cr · the families know now, and so does Wexley-Yorozu`, 5);
        renderDocked();
      });
      dataRow.append(publish);
    }
  }

  // Missiles: one more at a time, and a small − to sell one back (full price if bought on this visit).
  const rails = player.def.stats.missiles ?? 0;
  const short = rails - c.missiles;
  const mrow = $('#missile-row');
  mrow.innerHTML = tile('Missiles', rails ? `${c.missiles} / ${rails}` : 'None', rails && short <= 0 ? full : '');
  const mButtons = document.createElement('span');
  mButtons.className = 't-buttons';
  if (c.missiles > 0) {
    const undo = boughtHere.missiles > 0;
    const back = undo ? MISSILE_PRICE : MISSILE_PRICE / 2;
    const sell = document.createElement('button');
    sell.className = 'minus';
    sell.textContent = '−';
    sell.setAttribute('aria-label', `Sell one missile, +${back} Cr`);
    sell.title = `Sell one · +${back} Cr${undo ? ' (bought here: full refund)' : ' (half price)'}`;
    sell.addEventListener('click', () => {
      c.credits += back;
      c.missiles -= 1;
      if (undo) boughtHere.missiles -= 1;
      saveCommander(c);
      sfx.beep();
      flash(`Missile sold · +${back} Cr`, 2);
      renderDocked();
    });
    mButtons.append(sell);
  }
  if (short > 0) {
    const rearm = document.createElement('button');
    rearm.textContent = `+1 · ${MISSILE_PRICE} Cr`;
    rearm.disabled = c.credits < MISSILE_PRICE;
    rearm.addEventListener('click', () => {
      c.credits -= MISSILE_PRICE;
      c.missiles += 1;
      boughtHere.missiles += 1;
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    mButtons.append(rearm);
  }
  if (mButtons.childElementCount) mrow.querySelector('.t-row')!.append(mButtons);

  const list = $('#equip');
  list.innerHTML = '';
  // A website spec's kit for the ship you fly (Mark, 12 November 2026): a list, ticked off as you buy it below.
  const wanted = c.specKit ?? waitingSpecKit(c);
  if (wanted) {
    const lines = specKitLines(c, player.def, wanted);
    if (c.specKit && lines.every((l) => l.done)) {
      delete c.specKit;
      saveCommander(c);
    } else if (lines.length) {
      const li = document.createElement('li');
      li.className = 'spec-list';
      li.innerHTML = `<span>From your website spec</span><small>${lines.map((l) => `${l.done ? '✓ ' : ''}${escapeHtml(l.what)} · ${l.price.toLocaleString()} Cr`).join('<br>')}</small>`;
      list.append(li);
    }
  }
  // The kit, grouped (Combat · Trade · Exploration · Ship) with what you can buy here first and what
  // isn't sold here folded to one line, saying why (Mark and Marketing's walkthrough). Repairs first.
  const kit: { group: KitGroup | 'repair'; kind: 'buy' | 'owned' | 'away'; li: HTMLLIElement; short?: string }[] = [];
  const add = (group: KitGroup | 'repair', kind: 'buy' | 'owned' | 'away', li: HTMLLIElement, short?: string) => kit.push({ group, kind, li, short });
  const needMore = (b: HTMLButtonElement, price: number) => {
    if (c.credits >= price) return;
    b.textContent = `Need ${Math.ceil(price - c.credits).toLocaleString()} Cr more`;
    b.classList.add('short');
  };
  // Equipment held here until a fine is paid.
  if (c.impound) {
    const imp = c.impound;
    const li = document.createElement('li');
    const names = imp.items.map((id) => EQUIPMENT.find((e) => e.id === id)?.name ?? id).join(', ') || 'Nothing';
    const atHere = imp.at === systemKey(here);
    const where = atHere ? 'this station' : systemAt(Number(imp.at.split(':')[0]), Number(imp.at.split(':')[1])).name;
    li.innerHTML = `<span>Impounded <em class="damaged">${imp.owed.toLocaleString()} Cr owed</em></span><small>${names}, held at ${where} until it's paid.</small>`;
    const pay = document.createElement('button');
    pay.textContent = atHere ? `Pay · ${imp.owed.toLocaleString()} Cr` : 'Pay there';
    pay.disabled = !atHere || c.credits < imp.owed;
    pay.addEventListener('click', () => {
      if (!redeemImpound(c)) return;
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    li.append(pay);
    add('repair', 'buy', li);
  }
  // Lasers, for each of the four mounts. Whatever was on the mount is taken
  // in part exchange at half its price.
  for (const laser of Object.values(PLAYER_LASERS)) {
    const li = document.createElement('li');
    const sold = here.techLevel >= laser.minTech;
    li.innerHTML = `<span>${laser.name}</span><small>${laser.blurb} ${laser.price.toLocaleString()} Cr per mount.</small>`;
    const mounts = document.createElement('div');
    mounts.className = 'mounts';
    for (const mount of MOUNTS) {
      const old = c.lasers[mount];
      const tradeIn = old ? Math.round(PLAYER_LASERS[old].price / 2) : 0;
      const cost = laser.price - tradeIn;
      const fit = document.createElement('button');
      const fitted = old === laser.id;
      fit.classList.toggle('fitted', fitted);
      fit.textContent = mount;
      if (fitted) {
        // Fitted this visit: put back what was there and refund the swap.
        // Otherwise take it off for half price.
        const undo = boughtHere.lasers[mount];
        const back = undo ? undo.paid : Math.round(laser.price / 2);
        fit.title = undo
          ? `Undo: ${undo.previous ? `refit the ${PLAYER_LASERS[undo.previous].name.toLowerCase()} and ` : ''}refund ${back.toLocaleString()} Cr`
          : `Remove from the ${mount} mount: sells for ${back.toLocaleString()} Cr`;
        const remove = () => {
          c.credits += back;
          if (undo?.previous) c.lasers[mount] = undo.previous;
          else delete c.lasers[mount];
          delete boughtHere.lasers[mount];
          saveCommander(c);
          sfx.beep();
          renderDocked();
        };
        if (undo) fit.addEventListener('click', remove);
        // Selling the only laser leaves the ship unarmed: say so.
        else confirmSale(fit, Object.values(c.lasers).filter(Boolean).length === 1 ? `Your only laser! Sell · +${back.toLocaleString()} Cr?` : `Sell · +${back.toLocaleString()} Cr?`, remove);
        mounts.append(fit);
        continue;
      }
      const locked = laserLocked(c, laser.id as LaserId);
      fit.disabled = !sold || Boolean(locked) || c.credits < cost;
      fit.title = !sold
          ? `Needs tech level ${laser.minTech}`
          : locked
          ? locked
          : `Fit to the ${mount} mount: ${cost.toLocaleString()} Cr${tradeIn ? ` after ${tradeIn.toLocaleString()} Cr for the ${PLAYER_LASERS[old!].name.toLowerCase()}` : ''}`;
      fit.addEventListener('click', () => {
        c.credits -= cost;
        // Swapping twice in one visit undoes back to what was fitted on arrival.
        const earlier = boughtHere.lasers[mount];
        boughtHere.lasers[mount] = { previous: earlier ? earlier.previous : old, paid: (earlier?.paid ?? 0) + cost };
        c.lasers[mount] = laser.id as LaserId;
        saveCommander(c);
        sfx.beep();
        renderDocked();
      });
      mounts.append(fit);
    }
    const onIt = MOUNTS.filter((m) => c.lasers[m] === laser.id);
    if (onIt.length) li.querySelector('span')!.insertAdjacentHTML('afterbegin', '<i class="tick" aria-label="Fitted">✓</i> ');
    const cheapest = Math.min(...MOUNTS.map((m) => laser.price - (c.lasers[m] ? Math.round(PLAYER_LASERS[c.lasers[m]!].price / 2) : 0)));
    if (sold && !onIt.length && c.credits < cheapest) li.querySelector('small')!.insertAdjacentHTML('beforeend', ` <b class="short">Need ${Math.ceil(cheapest - c.credits).toLocaleString()} Cr more</b>`);
    li.append(mounts);
    add('combat', onIt.length ? 'owned' : sold ? 'buy' : 'away', li, `${laser.name} · tech level ${laser.minTech}`);
  }

  for (const item of EQUIPMENT) {
    if (item.classicOnly && c.difficulty !== 'classic') continue;
    if (item.modernOnly && c.difficulty !== 'modern') continue;
    const li = document.createElement('li');
    const owned = hasEquipment(c, item.id);
    const damaged = c.damaged.includes(item.id);
    if (item.standard && !damaged) continue; // fitted to every ship: listed only when it needs repair
    if (item.found && !owned) continue; // never sold: found out there
    const repairCost = Math.round(item.price * REPAIR_FRACTION);
    const banned = Boolean(item.illegal) && scansCargo(here); // illegal here: not sold
    const unranked = Boolean(item.explorer) && exploreOf(c).points < item.explorer!; // explorers only
    const sold = here.techLevel >= item.minTech && !banned && !unranked;
    li.innerHTML = `<span>${owned && !damaged ? '<i class="tick" aria-label="Fitted">✓</i> ' : ''}${item.name}${damaged ? ' <em class="damaged">Damaged</em>' : ''}</span><small>${forDevice(item.blurb)}</small>`;
    const group = damaged ? 'repair' : kitGroup(item.id);
    const buy = document.createElement('button');
    if (damaged) {
      buy.textContent = `Repair · ${repairCost.toLocaleString()} Cr`;
      buy.disabled = c.credits < repairCost;
      needMore(buy, repairCost);
    } else if (!owned && !sold) {
      // High-tech gear needs a high-tech world; illegal gear, a lawless one; explorer's gear, an explorer.
      buy.textContent = unranked ? `${explorerRank(item.explorer!)} rank` : banned ? 'Illegal here' : `Needs tech level ${item.minTech}`;
      buy.title = unranked ? `You're ${explorerRank(exploreOf(c).points)}: survey, find signals and follow trails to rise` : banned ? 'Sold only where police don\'t scan: anarchies and feudal worlds' : `${here.name} is tech level ${here.techLevel}`;
      buy.disabled = true;
      add(group, 'away', li, `${item.name} · ${unranked ? `${explorerRank(item.explorer!)} rank` : banned ? 'illegal here' : `tech level ${item.minTech}`}`);
      li.append(buy);
      continue;
    } else if (owned && item.found) {
      buy.textContent = 'Fitted';
      buy.classList.add('fitted');
      buy.disabled = true;
      buy.title = 'Found, not bought: nobody will buy it from you, and you would not want them to';
      li.append(buy);
      add(group, 'owned', li);
      continue;
    } else if (owned) {
      const undo = boughtHere.equipment.has(item.id);
      const back = undo ? item.price : Math.round(item.price / 2);
      const remove = () => {
        c.credits += back;
        removeEquipment(c, item.id);
        boughtHere.equipment.delete(item.id);
        saveCommander(c);
        sfx.beep();
        renderDocked();
      };
      // The hold can't shrink below what's in it.
      const full = item.id === 'large-cargo-bay' && cargoTonnes(c) > player.def.stats.cargo;
      buy.textContent = undo ? `Undo · +${back.toLocaleString()} Cr` : `Sell · +${back.toLocaleString()} Cr`;
      buy.classList.add('fitted');
      buy.disabled = full;
      buy.title = full ? 'Sell cargo first: it would not fit in the smaller hold' : undo ? 'Bought here: full refund' : 'Sells for half price';
      if (undo) buy.addEventListener('click', remove);
      else confirmSale(buy, `Sell for ${back.toLocaleString()} Cr?`, remove);
      li.append(buy);
      add(group, 'owned', li);
      continue;
    } else {
      buy.textContent = `Buy · ${item.price.toLocaleString()} Cr`;
      buy.disabled = c.credits < item.price;
      needMore(buy, item.price);
    }
    buy.addEventListener('click', () => {
      if (damaged) {
        c.credits -= repairCost;
        c.damaged = c.damaged.filter((id) => id !== item.id);
      } else {
        c.credits -= item.price;
        c.equipment.push(item.id);
        boughtHere.equipment.add(item.id);
      }
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    li.append(buy);
    add(group, 'buy', li);
  }

  for (const g of ['repair', ...KIT_GROUPS] as const) {
    const items = kit.filter((k) => k.group === g);
    if (!items.length) continue;
    const here = items.filter((k) => k.kind !== 'away');
    const away = items.filter((k) => k.kind === 'away');
    const head = document.createElement('li');
    head.className = 'kit-head';
    head.innerHTML = g === 'repair' ? 'Repairs' : `${KIT_NAMES[g]} <small>${here.length ? `${here.length} here` : 'none here'}</small>`;
    list.append(head, ...here.filter((k) => k.kind === 'buy').map((k) => k.li), ...here.filter((k) => k.kind === 'owned').map((k) => k.li));
    if (!away.length) continue;
    // Not sold here: one line saying why, opening to the items themselves.
    const fold = document.createElement('li');
    fold.className = 'kit-away';
    const shown = away.slice(0, 2).map((k) => k.short).join(' · ');
    const open = kitOpen.has(g);
    fold.innerHTML = `<button type="button" aria-expanded="${open}"><span>Not sold here: ${escapeHtml(shown)}${away.length > 2 ? ` · ${away.length - 2} more` : ''}</span></button>`;
    fold.querySelector('button')!.addEventListener('click', () => {
      if (kitOpen.has(g)) kitOpen.delete(g);
      else kitOpen.add(g);
      renderDocked();
    });
    list.append(fold);
    if (open) for (const k of away) list.append(Object.assign(k.li, { className: 'away' }));
  }
}

/** Which groups of kit not sold here are opened out, this session. */
const kitOpen = new Set<string>();
