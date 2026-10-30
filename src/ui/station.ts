// The station screen (moved from main.ts): your ship and what's fitted, the hold, the record, fuel,
// missiles and kit to buy or sell, and refunds for a change of mind before launch.

import { sfx } from '../audio/sound';
import { cargoCapacity, cargoTonnes, DIFFICULTIES, EQUIPMENT, FUEL_PRICE, fuelCapacity, MISSILE_PRICE, hasEquipment, REPAIR_FRACTION, type Mount, MOUNTS, removeEquipment, saveCommander, type Commander } from '../game/commander';
import { fineDue, redeemImpound, scansCargo, settle, systemKey } from '../game/law';
import { isTouch } from '../game/input';
import { claimCallsign } from './accountPanel';
import { cleanName } from '../../server/src/protocol';
import { combatRating, ratingProgress } from '../game/rating';
import { buildFittings, disposeFittings, type Fittings, type Loadout } from '../render/fittings';
import { KIT_GROUPS, KIT_NAMES, kitGroup, type KitGroup } from '../game/kit';
import { laserLocked, production } from '../game/shipyard';
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
import { $, cmdr, currentSystem, game } from '../core';
import { player } from '../scene';
import { openManual } from './manual';
import { plotCourse, renderContracts } from './contracts';
import { openBooth, showroomModels } from './showroom';
import { hasShipyard, renderShipyard, showOwnShip } from './shipyard';
import { renderSaloon } from './saloon';
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
  const dd = $('#cmdr .rename').parentElement!;
  dd.innerHTML = `<form class="rename-form"><input maxlength="24" value="${escapeHtml(c.name).replace(/"/g, '&quot;')}" aria-label="Callsign" /> <button type="submit">Save</button> <button type="button" data-cancel>Cancel</button></form>`;
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

/** What's in the hold, company cargo included, for the Station tab. */
function holdList(c: Commander): string {
  const own = Object.entries(c.cargo)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${q}${commodityById(id)?.unit === 't' ? ' t' : ' ' + commodityById(id)?.unit} ${escapeHtml(commodityById(id)?.name ?? id)}`);
  const company = (c.contracts ?? []).filter((a) => !a.adrift).map((a) => `${a.qty} t ${escapeHtml(cargoName(a))} <small>(${escapeHtml(COMPANIES[a.company].name)}, for ${escapeHtml(destinationOf(a).name)})</small>`);
  const all = [...own, ...company];
  return all.length ? `<br><small class="hold-list">${all.join(' · ')}</small>` : '';
}

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
  $('#dock-location').textContent = `${st.name} · ${here.name}`;
  $('#dock-location').title = st.honours ? `Named for ${st.honours}` : '';
  main.updateDockHead();
  // Company contracts are Modern work; Classic stays as 1984.
  $('.tabs [data-tab="contracts"]').hidden = c.difficulty !== 'modern';
  if (game.dockTab === 'contracts') renderContracts();
  if (game.dockTab === 'market') renderMarket();
  if (game.dockTab === 'news') renderNews();
  // Docked somewhere new with the saloon still open: that station's regulars, not the last one's (Mark).
  if (game.dockTab === 'saloon') renderSaloon();
  const rows: [string, string][] = [
    ['Commander', `${escapeHtml(c.name)} <button type="button" class="rename" title="Change your callsign">Rename</button>`],
    ['Rules', DIFFICULTIES[c.difficulty].name],
    ['Ship', `${escapeHtml(player.def.name)} <button type="button" class="small manual-open">Owner's manual</button> <button type="button" class="small manual-open booth-open">Photograph her</button>`],
    // The Dark Edition's running lights, or the full ghost: just the hull (Mark).
    ...(c.paint?.luxuries.includes('black-light-lights')
      ? ([['Running lights', `${c.paint.ghost ? 'Off: the full ghost, just the hull' : 'Black-light, seen only close to'} <button type="button" class="small lights-toggle">${c.paint.ghost ? 'Lights on' : 'Go full ghost'}</button>`]] as [string, string][])
      : []),
    ['Cargo', `${+cargoTonnes(c).toFixed(1)} / ${cargoCapacity(c, player.def.stats.cargo)} t${c.compartment ? ` · ${c.compartment.tonnes} t shielded` : ''}${holdList(c)}`],
    ['Lasers', MOUNTS.filter((m) => c.lasers[m]).map((m) => `${m[0].toUpperCase()}${m.slice(1)} ${PLAYER_LASERS[c.lasers[m]!].name.replace(' laser', '').toLowerCase()}`).join(' · ') || 'None'],
    ['Legal status', `${main.legalLabel()}${main.canSettle(c) ? ` <button type="button" class="settle" title="Pay the fine here (never more than half of what you have above 100 Cr): a clean record in this system, any warrant lifted, contraband confiscated">${fineDue(c) ? `Settle · ${fineDue(c).toLocaleString()} Cr` : 'Settle · no charge'}</button>` : ''}`],
    ['Destination', c.target === null ? (isTouch ? 'None (choose on the Galaxy map)' : 'None (press G)') : systemAt(here.galaxy, c.target).name],
    ['Rating', c.difficulty === 'classic' ? combatRating(c.kills) : ratingProgress(c.kills)],
    ['Explorer', `${explorerRank(exploreOf(c).points)} · ${exploreOf(c).visited.length} system${exploreOf(c).visited.length === 1 ? '' : 's'} visited${main.myFirsts(here.galaxy) ? ` · ${main.myFirsts(here.galaxy)} first${main.myFirsts(here.galaxy) === 1 ? '' : 's'} on the chart` : ''}`],
    ...trailsUnderWay(c, here.galaxy).map((t): [string, string] => ['Trail', `${escapeHtml(t.title)} · ${t.found} of ${t.of} found · the clue points to ${escapeHtml(t.next)}`]),
    ...main.explorerTips(c, here),
  ];
  $('#cmdr').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#cmdr .manual-open:not(.booth-open)')?.addEventListener('click', () => openManual(player.def));
  $('#cmdr .lights-toggle')?.addEventListener('click', () => {
    if (!c.paint) return;
    c.paint.ghost = !c.paint.ghost;
    saveCommander(c);
    showOwnShip();
    flash(c.paint.ghost ? 'Running lights off · the full ghost' : 'Running lights on', 2);
    renderDocked();
  });
  $('#cmdr .booth-open')?.addEventListener('click', () => {
    showOwnShip();
    openBooth();
  });
  $('#cmdr .rename').addEventListener('click', () => startRename());
  document.querySelector<HTMLButtonElement>('#cmdr .tip-course')?.addEventListener('click', (e) => {
    flash(plotCourse(c, Number((e.currentTarget as HTMLButtonElement).dataset.system)), 3);
    saveCommander(c);
    renderDocked();
  });
  document.querySelector('#cmdr .settle')?.addEventListener('click', () => {
    const settlement = settle(c);
    saveCommander(c);
    sfx.beep();
    renderDocked();
    flash(main.settlementMessage(settlement, 'Settled with the law'), 5);
  });

  // Fuel: top up to a full tank at the station.
  const missing = Math.round((fuelCapacity(c) - c.fuel) * 10) / 10;
  const fuelCost = Math.round(missing * FUEL_PRICE * 10) / 10;
  const affordable = Math.min(missing, Math.floor((c.credits / FUEL_PRICE) * 10) / 10);
  $('#fuel').innerHTML = `<span>Fuel <b>${c.fuel.toFixed(1)} / ${fuelCapacity(c)} LY</b></span>`;
  const refuel = document.createElement('button');
  refuel.textContent = missing <= 0 ? 'Full' : affordable < missing ? `${affordable.toFixed(1)} LY · ${(affordable * FUEL_PRICE).toFixed(1)} Cr` : `Refuel · ${fuelCost.toFixed(1)} Cr`;
  refuel.disabled = missing <= 0 || affordable <= 0;
  refuel.title = affordable < missing ? `Refuel as far as your credits allow` : `Fill the tank`;
  refuel.addEventListener('click', () => {
    c.credits = Math.round((c.credits - affordable * FUEL_PRICE) * 10) / 10;
    c.fuel = Math.round((c.fuel + affordable) * 10) / 10;
    saveCommander(c);
    sfx.beep();
    renderDocked();
  });
  $('#fuel').append(refuel);

  // Survey data: sold here, for more the further it's come.
  const dataRow = $('#data-row');
  const data = exploreOf(c).data;
  dataRow.hidden = c.difficulty !== 'modern';
  if (!dataRow.hidden) {
    // Wexley-Yorozu pays best, and is the only one the Science Division's report goes to.
    const wy = wyWorks(here);
    // Moons a survey contract is for are the contract's: kept for it, never sold off cheap.
    const kept = data.filter((d) => forContract(c, d));
    const sellable = data.filter((d) => (wy || !d.report) && !kept.includes(d));
    const worth = sellable.reduce((sum, d) => sum + dataValue(d, here, wy), 0);
    // Say what's in it (a tooltip doesn't show on a phone), and that a company station pays more.
    const names = data.filter((d) => !kept.includes(d)).map((d) => d.name).join(', ');
    const keptLine = kept.length ? `${kept.map((d) => d.name).join(', ')}: kept for your Wexley-Yorozu survey contract` : '';
    dataRow.innerHTML = `<span>Survey data <b>${data.length ? `${data.length} record${data.length === 1 ? '' : 's'}` : 'None'}</b>${data.length ? ` <small>${[escapeHtml(names), escapeHtml(keptLine), wy ? 'This is a Wexley-Yorozu station: data sells for 25% more here' : 'Wexley-Yorozu stations pay 25% more: look for them on the galaxy map'].filter(Boolean).join(' · ')}</small>` : ''}</span>`;
    dataRow.title = data.length ? data.map((d) => `${d.name}: ${dataValue(d, here, wy)} Cr`).join('\n') : 'Fly low over planets, moons and the star to survey them, then sell the data at any station';
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

  // Missiles: top up the rails.
  const rails = player.def.stats.missiles ?? 0;
  const short = rails - c.missiles;
  const canAfford = Math.min(short, Math.floor(c.credits / MISSILE_PRICE));
  $('#missile-row').innerHTML = `<span>Missiles <b>${c.missiles} / ${rails}</b></span>`;
  const rearm = document.createElement('button');
  rearm.textContent = short <= 0 ? 'Full' : `Buy ${canAfford || short} · ${(canAfford || short) * MISSILE_PRICE} Cr`;
  rearm.disabled = short <= 0 || canAfford <= 0;
  rearm.addEventListener('click', () => {
    c.credits -= canAfford * MISSILE_PRICE;
    c.missiles += canAfford;
    boughtHere.missiles += canAfford;
    saveCommander(c);
    sfx.beep();
    renderDocked();
  });
  const missileButtons = document.createElement('div');
  missileButtons.className = 'buttons';
  missileButtons.append(rearm);
  $('#missile-row').append(missileButtons);
  if (c.missiles > 0) {
    const undo = boughtHere.missiles > 0;
    const back = undo ? MISSILE_PRICE : MISSILE_PRICE / 2;
    const sell = document.createElement('button');
    sell.textContent = `Sell 1 · +${back} Cr`;
    sell.title = undo ? 'Bought here: full refund' : 'Sells for half price';
    sell.addEventListener('click', () => {
      c.credits += back;
      c.missiles -= 1;
      if (undo) boughtHere.missiles -= 1;
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    missileButtons.append(sell);
  }

  const list = $('#equip');
  list.innerHTML = '';
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
