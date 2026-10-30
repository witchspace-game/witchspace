// The emergency beacon and surrender (moved from main.ts): the fixed calls every ship can make,
// who answers them, holding still for the police, and the radio's own frame.

import { sfx } from '../audio/sound';
import { FUEL_PRICE, fuelCapacity, hasEquipment, saveCommander } from '../game/commander';
import { carriesContraband, hasLaw, legalStatus, settle } from '../game/law';
import { isTouch, setTouchSpeed, type FlightInput } from '../game/input';
import { COMPANIES } from '../game/companies';
import { isSurveyed } from '../game/explore';
import { stationName } from '../galaxy/stationNames';
import { flash } from '../ui/hud';
import { distanceLy, galaxy, systemAt } from '../galaxy/generate';
import { escapeHtml } from '../ui/escape';
import { playTunnel } from '../ui/tunnel';
import { onTap } from '../ui/touch';
import { BEACON_CALLS, beacon, newBeacon, type BeaconCall } from '../game/radio';
import { $, cmdr, currentSystem, game, modern } from '../core';
import { flight, sharedSpace, npcs, ofRole, player, station } from '../scene';
import { MAX_PIRATES, PIRATE_CHANCE, fightOn } from './traffic';
import { CLEARANCE_RANGE, FIGHT_RANGE, answerSurrender, arrayNews, arrayOffers, clearanceRefused, distresses, hasArray, lockedDown, pirateThreats, radio, spawnDistress, updateDistress } from './comms';
import { exploring } from './explore';
import { MAX_POLICE, STATION_SPACE, becomeOffender, identified, isFugitive, responses, spawnViper } from './law';

import type { State } from '../core';
import type { Settlement } from '../game/law';
/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  setState: (next: State) => void;
  enterDocked: (newShip?: boolean) => void;
  setAutopilot: (on: boolean, message?: string | undefined) => void;
  settlementMessage: (s: Settlement, lead: string) => string;
};
export const initBeacon = (hooks: typeof main) => Object.assign(main, hooks);

// --- The emergency beacon: fixed calls, from every ship --------------------------------

const beaconState = newBeacon();
export let beaconOpen = false;
let beaconTimer = 0;

export function toggleBeacon(show = !beaconOpen) {
  if (show && !modern()) return flash('Classic rules: no emergency beacon', 1.5);
  beaconOpen = show;
  $('#beacon').hidden = !show;
  clearTimeout(beaconTimer);
  if (show) beaconTimer = window.setTimeout(() => toggleBeacon(false), 8000);
}

$('#beacon .beacon-calls').innerHTML = BEACON_CALLS.map((b, i) => `<button type="button" data-call="${b.call}">${isTouch ? '' : `${i + 1} · `}${escapeHtml(b.label)}</button>`).join('');
$('#beacon .beacon-calls')
  .querySelectorAll<HTMLButtonElement>('button')
  .forEach((b) => onTap(b, () => sendBeacon(b.dataset.call as BeaconCall)));

export function sendBeacon(call: BeaconCall) {
  toggleBeacon(false);
  if (game.state !== 'flying') return;
  const c = cmdr();
  const here = currentSystem();
  const pos = player.obj.position;
  const label = BEACON_CALLS.find((b) => b.call === call)!.label;
  const police = `${here.name} police`;
  const nearest = galaxy(here.galaxy)
    .filter((s) => s !== here)
    .reduce((a, b) => (distanceLy(here, a) <= distanceLy(here, b) ? a : b));
  const out = beacon(beaconState, call, flight.elapsed, {
    lawful: hasLaw(here),
    hostilesNear: npcs.some((n) => n.hostile && n.obj.position.distanceTo(pos) < FIGHT_RANGE) || [...sharedSpace.remotes.values()].some((r) => sharedSpace.isHostile(r) && r.position.distanceTo(pos) < FIGHT_RANGE),
    hull: player.hull / player.def.stats.hull,
    fuel: c.fuel,
    nearestLy: distanceLy(here, nearest),
    canDock: !clearanceRefused() && !lockedDown(),
    system: `${here.galaxy}:${here.index}`,
  });
  if (out.kind === 'wait') return flash(`Beacon recharging · ${out.seconds} s`, 1.5);
  sfx.beep();
  radio('beacon', 'Beacon', `${label} sent`);
  switch (out.kind) {
    case 'police': {
      if (isFugitive() && identified()) return radio('police', police, 'We know who you are, Commander. Surrender (U).', { flash: 3, urgent: true, answers: [answerSurrender()] });
      const delay = Math.round(Math.max(10, 10 + (pos.distanceTo(station.root.position) - STATION_SPACE) / 200));
      responses.push({ at: flight.elapsed + delay, where: pos.clone() });
      // Any Viper already out comes too.
      const near = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(pos) < 15000);
      if (near) near.patrol.centre.copy(pos);
      return radio('police', police, `Mayday received. Vipers on their way, about ${delay} s.`, { flash: 3, urgent: true });
    }
    case 'unanswered':
      return radio('beacon', 'Beacon', "No answer: there's no law here to send help");
    case 'false':
      if (out.offence) {
        radio('police', police, 'Second false alarm. Wasting police time is an offence, Commander.');
        return becomeOffender('Wasting police time · you are an OFFENDER');
      }
      return radio('police', police, "Nothing on our scanner, Commander. Don't make a habit of it.", { flash: 3, urgent: true });
    case 'escort': {
      let npc = ofRole('police').filter((p) => !p.hostile).sort((a, b) => a.obj.position.distanceTo(pos) - b.obj.position.distanceTo(pos))[0];
      if (!npc && ofRole('police').length < MAX_POLICE) {
        spawnViper(true);
        npc = npcs[npcs.length - 1];
      }
      if (npc) flight.escort = { npc, until: flight.elapsed + 150 };
      return radio('police', police, call === 'hull' ? 'Emergency berth ready, Commander. A Viper will see you in.' : 'Escort on its way. Head for the station.', { flash: 3, urgent: true });
    }
    case 'fuel-ok':
      return radio('station', stationName(here).name, `Your tanks read ${c.fuel.toFixed(1)} LY, and ${nearest.name} is ${distanceLy(here, nearest).toFixed(1)}. You'll make it.`);
    case 'dock-for-fuel':
      return radio('station', stationName(here).name, `Come in and fill up, Commander: ${FUEL_PRICE} Cr a light year at the pump.`);
    case 'tender': {
      const paid = Math.min(c.credits, out.cost);
      c.credits = Math.round((c.credits - paid) * 10) / 10;
      c.fuel = Math.min(fuelCapacity(c), Math.round((c.fuel + out.ly) * 10) / 10);
      saveCommander(c);
      return radio('company', "Carriers' Mutual", `Fuel tender alongside: ${out.ly.toFixed(1)} LY transferred · ${paid.toLocaleString()} Cr${paid < out.cost ? ', all you had' : ''}. Nobody gets stranded on our watch.`, { colour: COMPANIES.mutual.colour, flash: 4, urgent: true });
    }
    case 'tendered':
      return radio('company', "Carriers' Mutual", "We've sent you one tender here already, Commander. Try a pair of fuel scoops.", { colour: COMPANIES.mutual.colour });
  }
}

/** Each frame in flight (Modern): the radio's business. */
export function updateRadio(dt: number) {
  if (!modern()) return;
  pirateThreats();
  updateDistress();
  if (flight.escort) {
    const { npc, until } = flight.escort;
    if (!npcs.includes(npc) || npc.hostile || flight.elapsed > until) {
      if (npcs.includes(npc)) Object.assign(npc.patrol, { radius: 900 }).centre.copy(station.root.position);
      flight.escort = null;
    } else {
      npc.patrol.centre.copy(player.obj.position);
      npc.patrol.radius = 350;
    }
  }
  flight.arrayTimer -= dt;
  if (flight.arrayTimer <= 0) {
    flight.arrayTimer = 20;
    if (hasArray()) {
      arrayOffers();
      arrayNews();
    }
  }
  flight.distressTimer -= dt;
  if (flight.distressTimer <= 0) {
    flight.distressTimer = 100 + Math.random() * 120;
    if (hasArray() && !distresses.length && !fightOn() && ofRole('pirate').length < MAX_PIRATES - 1 && Math.random() < PIRATE_CHANCE[currentSystem().government] + 0.15) spawnDistress();
  }
}

/** On a touch screen, the obvious next step comes out of the drawer by itself. */
const contextButton = $<HTMLButtonElement>('#touch .context-button');
export function updateContextButton() {
  if (!isTouch) return;
  const c = cmdr();
  const here = currentSystem();
  const pos = player.obj.position;
  const hop = c.target !== null && c.target !== here.index ? systemAt(here.galaxy, c.target) : null;
  const surveyNear =
    exploring() && flight.sceneBodies.some((b) => b.body.kind !== 'star' && pos.distanceTo(b.centre) - b.radius < b.range * 2 && !isSurveyed(c, here, b.body.id));
  let next: [string, string] = ['KeyJ', 'Jump'];
  if (pos.distanceTo(station.root.position) < CLEARANCE_RANGE && hasEquipment(c, 'docking-computer')) next = ['KeyC', flight.autopilot ? 'Dock: on' : 'Dock'];
  else if (surveyNear && hasEquipment(c, 'survey-autopilot')) next = ['Digit9', flight.surveyPilot ? 'Survey: on' : 'Survey'];
  else if (flight.countdown !== null) next = ['KeyH', 'Cancel jump'];
  else if (hop && distanceLy(here, hop) <= c.fuel + 1e-9) next = ['KeyH', `Hyper · ${hop.name}`];
  if (contextButton.dataset.key !== next[0]) contextButton.dataset.key = next[0];
  if (contextButton.textContent !== next[1]) contextButton.textContent = next[1];
}

const SURRENDER_TIME = 5; // seconds holding still before the police take you in
const SURRENDER_SPEED = 0.15; // fraction of top speed

/** U: hand yourself in. Always works where there's law, and always hurts. */
export function toggleSurrender() {
  const c = cmdr();
  if (flight.surrenderTimer !== null) {
    flight.surrenderTimer = null;
    flash('Surrender withdrawn', 1.5);
    return;
  }
  if (!hasLaw(currentSystem())) {
    flash('No law here to surrender to', 2);
    return;
  }
  if (legalStatus(c) === 'clean' && !carriesContraband(c)) {
    flash('Nothing on your record here', 2);
    return;
  }
  main.setAutopilot(false);
  flight.countdown = null;
  flight.surrenderTimer = SURRENDER_TIME;
  if (isTouch) setTouchSpeed(0); // the slider drops to all stop with you
  flash('Surrender signalled · all stop, weapons cold', 2.5);
}

/** Firing or throttling up calls it off. No crime in that: you're just not surrendering. */
export function breakSurrender(why = 'Weapons fired') {
  flight.surrenderTimer = null;
  flash(`${why} · surrender withdrawn`, 2);
}

/** While surrendering, the ship brakes to a stop by itself; throttling up withdraws. */
export function holdForSurrender(input: FlightInput) {
  if (flight.surrenderTimer === null) return;
  if (input.throttle > 0 || input.speedStep > 0 || (input.speedTarget ?? 0) > SURRENDER_SPEED) return breakSurrender('Throttle up');
  input.throttle = 0;
  input.speedTarget = 0;
}

export function updateSurrender(dt: number) {
  if (flight.surrenderTimer === null) return;
  // The escort's clock starts once you've slowed down.
  if (player.speed > player.maxSpeed * SURRENDER_SPEED) return;
  const before = Math.ceil(flight.surrenderTimer);
  flight.surrenderTimer -= dt;
  if (Math.ceil(flight.surrenderTimer) < before && flight.surrenderTimer > 0) flash(`Police escort on its way · ${Math.ceil(flight.surrenderTimer)}`, 1.1);
  if (flight.surrenderTimer <= 0) {
    flight.surrenderTimer = null;
    void surrender();
  }
}

async function surrender() {
  main.setState('transition');
  sfx.tunnel();
  await playTunnel();
  const c = cmdr();
  const settlement = settle(c);
  saveCommander(c);
  // They know exactly who you are now: whatever you did dark here is settled too.
  flight.defiedPolice = flight.hullChecked = false;
  flight.unpinned = flight.hail = null;
  flight.transponderOff = flight.switchOnWhenClear = false;
  for (const n of ofRole('police')) if (n.target === player) n.target = null;
  main.enterDocked();
  flash(main.settlementMessage(settlement, 'You surrendered · record cleared'), 5);
}
