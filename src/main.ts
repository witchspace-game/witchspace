import * as THREE from 'three';
import { track as countEvent } from '@vercel/analytics';
import { cycleSoundMode, music, preloadRecording, sfx, unlockAudio } from './audio/sound';
import { shipById } from './content/ships';
import {
  cargoCapacity,
  cargoTonnes,
  DIFFICULTIES,
  EQUIPMENT,
  FUEL_PRICE,
  fuelCapacity,
  hasEquipment,
  isWorking,
  loadCommander,
  REPAIR_FRACTION,
  MOUNTS,
  newCommander,
  onSave,
  saveCommander,
  type Commander,
  type Difficulty,
} from './game/commander';
import { weighsShips, WEIGHBRIDGE_CHANCE } from './game/compartment';
import {
  carriesContraband,
  checksClearance,
  hasLaw,
  hidingSomething,
  legalStatus,
  settle,
  type Settlement,
} from './game/law';
import {
  gamepadPresses,
  isTouch,
  setFlightInputSuppressed,
  setFlying,
  toggleControlScheme,
  controlScheme,
  toggleInvertPitch,
} from './game/input';
import { signedIn, currentAccount } from './net/account';
import { hideCardInvite, showCardInvite } from './ui/cardInvite';
import { claimCallsign, commanderSaved, initAccount, isAccountPanelOpen, titleShown, toggleAccountPanel } from './ui/accountPanel';
import { cleanName } from '../server/src/protocol';
import { combatRating } from './game/rating';
import { EDITIONS } from './content/editions';
import { deliveriesArrived } from './game/shipyard';
import { ATMOSPHERE_SCALE, buildPlanet, disposePlanet } from './render/bodies';
import { cargoName, collect, deliver, destinationOf, forgive, wyWorks } from './game/contracts';
import { checkMessages, collectHeld, thanksFrom } from './game/assignments';
import { COMPANIES } from './game/companies';
import { bodiesOf, exploreOf, isFound, isSurveyed, poisOf, recordVisit } from './game/explore';
import { yardsOf } from './game/yards';
import { camera, isRetro, lens, render, setRetro } from './render/renderer';
import { disposeShip } from './render/shipModel';
import { stationName } from './galaxy/stationNames';
import { savePhoto, takePhoto } from './ui/photo';
import { flash, toggleScannerRange } from './ui/hud';
import { clearIndicators } from './ui/indicators';
import { countDevice, countNewCommander } from './net/stats';
import { loadFirsts } from './net/firsts';
import { closeMap, chooseCursor, focusFind, isMapOpen, moveCursor, openMap, toggleMapMode } from './ui/galaxyMap';
import { distanceLy, galaxy, systemAt, type StarSystem } from './galaxy/generate';
import { commodityById } from './economy/commodities';
import { setCausedEvents } from './economy/events';
import { inspectionChance } from './economy/legality';
import { escapeHtml } from './ui/escape';
import { playTunnel } from './ui/tunnel';
import { closeDrawer, initTouch, onTap } from './ui/touch';
import { BEACON_CALLS } from './game/radio';
import { acceptLatest, clearRadio, initRadio, toggleRadio, wakeRadio } from './ui/radio';
import { listMoments } from './game/flightLog';
import { readTrack } from './game/track';
import { closeReplay, closeTrip, isReplayOpen, isTripOpen, openTrip, setWatchClip } from './ui/flightLog';
import { showClipView } from './ui/clipView';
import { checkBtcOrders } from './net/bitcoin';
import { getClip, heartClip, reportClip } from './net/clips';
import { $, cmdr, currentSystem, game, modern, type State } from './core';
import { aim, engineSound, timer, dockingComputer, explosions, flight, missiles, sharedSpace, npcs, voices, planetPos, player, space, station, sun, SUN_POS } from './scene';
import './style.css';
import { renderControlsCard, showControlsCardOnce, toggleControlsCard } from './ui/manual';
import { initKeyboard } from './ui/keyboard';
import { newsLine } from './game/newsLines';
import { answerAdvert, answerChart, boardSeen, initContracts, markInbox, payCommissions, plotCourse, recruiter, showWantedChart } from './ui/contracts';
import { booth, closeBooth, cobraIndex, shipIndex, showShip, showroom, updateShowroom } from './ui/showroom';
import { boardShip, checkSignedOver, checkSiteSpec, showOwnShip } from './ui/shipyard';
import { markDocked } from './ui/money';
import { initSaloon } from './ui/saloon';
import { initMarket, renderMarket } from './ui/market';
import { initStation, renderDocked, resetBoughtHere, showFittings, wantedOnLaunch } from './ui/station';
import { setDockTab, updateDockHead } from './ui/places';
import { TRADERS_BY_GOVERNMENT, escortOf, forgetDeliveries, initTraffic, legs, markLaunched, pacing, railsOf, resetTraffic, spawnFalcon, spawnPirates, spawnTrader, startEncounters, voyageOf } from './flight/traffic';
import { launchSound, remoteVoices, voiceOf } from './flight/sounds';
import { carrier, clearMarshalTimer, disposeCarrier, initMarshals, scheduleMarshals, summonCarrier } from './flight/marshals';
import { energyBomb, explodeMissile, fireMissile, initMissiles, launchMissile, netMissiles, playerEcm, toggleLock } from './flight/missiles';
import { checkAdrift, drifters, initAdrift, restoreAdrift, spillCargo } from './flight/adrift';
import { distresses, hailTarget, initComms, messageIds, radio, radioMessages, spawnDistress, speakerOf, traderName } from './flight/comms';
import { initSharedSpace, toggleSharedSpace, updateSharedButton } from './flight/sharedSpace';
import { announceEvent, hyperspace, inSystemJump, initTravel, stopCombatComputer, toggleCombatComputer, toggleGalacticJump, toggleHyperspace, toggleSurveyPilot } from './flight/travel';
import { arrivalNote, bringHome, buildExploreScene, explorerTips, exploring, firstsLine, initExplore, myFirsts, showLog, survey } from './flight/explore';
import { becomeFugitive, becomeOffender, canSettle, damagePlayer, dark, darkRefused, destroyNpc, forgetResponses, identified, initLaw, isFugitive, legalLabel, playerHitNpc, rateKill, reportedBy, spawnViper, toggleTransponder, transponderBroken, transponderOnToDock, PATROLS_BY_GOVERNMENT } from './flight/law';
import { initCombat, laserDirection } from './flight/combat';
import { npcIdentified } from './flight/hud';
import { beaconOpen, breakSurrender, initBeacon, sendBeacon, toggleBeacon, toggleSurrender, updateContextButton } from './flight/beacon';
import { hitFeedback, initFlying, releaseBank, rollAssistApplies, setAutopilot, setView, updateSpace, viewDirection } from './flight/flying';
import { classicRules, die, initMoments, keepByHand, keepCombat, keepMoment, killCam, logMoment, momentContext, noticeTrades, recordTrack, recorder, recorderIntroduced, recorderWatch, refreshFlightLog, track, trackBeam, trackBoom, viewCanvas, watchSurroundings } from './flight/moments';
initMoments({ setState, showTitle, enterDocked, setFlightLog, planetColour, handleKey });
initFlying({ dock, recordTrack, die });
initBeacon({ setState, enterDocked, setAutopilot, settlementMessage });
initCombat({ viewDirection, hitFeedback, breakSurrender, trackBeam, die });
initLaw({ setAutopilot, noteCardMoment, trackBoom, keepCombat });
initExplore({ planetColour, dark: () => dark(), noteCardMoment, keepMoment });
initTravel({ setState, buildSystemScene, arrivalNote, forgetResponses, reportedBy, setView, setAutopilot, hitFeedback, toggleGalaxyMap });
initSharedSpace({ becomeFugitive, becomeOffender, rateKill, hitFeedback, die });
initComms({ isFugitive: () => isFugitive(), transponderBroken: () => transponderBroken(), dark: () => dark(), identified, transponderOnToDock, toggleTransponder, darkRefused: () => darkRefused(), npcIdentified: (npc) => npcIdentified(npc), updateContextButton, toggleSurrender });
initAdrift({ damagePlayer });
initMissiles({ launchSound, damagePlayer, destroyNpc, playerHitNpc, laserDirection, hitFeedback, npcIdentified: (npc) => npcIdentified(npc), breakSurrender, die });
initMarshals({ damagePlayer, spillCargo, die, keepMoment });
initTraffic({ rateKill, reportedBy, explodeMissile, spillCargo, rollAssistApplies, npcIdentified: (npc) => npcIdentified(npc), radio, keepMoment, keepCombat });
initStation({ setDockTab, updateDockHead, canSettle: (c) => canSettle(c), legalLabel, bringHome, myFirsts, explorerTips, showLog, settlementMessage, refreshFlightLog });
initMarket({ exploring: () => exploring(), noticeTrades: () => noticeTrades(), updateDockHead: () => updateDockHead() });
initSaloon({ setDockTab });
initContracts({ showNewGame, enterDocked, setDockTab, checkSiteSpec, checkSignedOver, updateDockHead, renderDocked, toggleGalaxyMap });



function setState(next: State) {
  if (next !== 'title' && isAccountPanelOpen()) toggleAccountPanel(false);
  if (next !== 'docked' && game.logOpen) setFlightLog(false);
  if (next !== 'docked') closeTrip();
  if (next !== 'docked') hideCardInvite();
  if (next !== 'flying') music.stop(); // the moment's over: docked, jumped or dead
  if (next !== 'flying') {
    flight.countdown = null; // leaving flight cancels a hyperspace countdown
    flight.combatComputer = null;
    flight.surveyPilot = null;
    flight.routeJumpAt = null;
    sharedSpace.leave(); // back in when flying again, wherever that is
    flight.lockedCommander = null;
    for (const n of netMissiles.values()) n.missile.dispose();
    netMissiles.clear();
    // Overlays that only make sense in flight; they're updated each frame while flying.
    for (const id of ['#mouse-prompt', '#reticle', '#seeker', '#target-info', '#countdown', '#hail', '#job', '#beacon']) $(id).hidden = true;
  }
  if (isMapOpen()) {
    closeMap();
    setFlightInputSuppressed(false);
  }
  game.state = next;
  document.body.dataset.state = next;
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach((el) => {
    el.hidden = !el.dataset.screen!.split(' ').includes(next);
  });
  layoutForScreen();
  if (next !== 'flying') $('#dock-aid').hidden = true;
  setFlying(next === 'flying');
  releaseBank();
  if (next === 'flying') {
    showControlsCardOnce();
    engineSound.start(voiceOf(player.def));
  } else {
    engineSound.stop();
    clearIndicators();
    for (const v of voices.values()) v.dispose();
    voices.clear();
    for (const v of remoteVoices.values()) v.dispose();
    remoteVoices.clear();
  }
}

/**
 * Panels sit above the row of buttons, whose height depends on the screen
 * width (they wrap on phones), so measure it rather than guess.
 */
function layoutForScreen() {
  const controls = [...document.querySelectorAll<HTMLElement>('nav.controls')].find((el) => !el.hidden);
  document.documentElement.style.setProperty('--controls-h', `${controls?.offsetHeight ?? 0}px`);
  fitDashboard();
  updateTurnHint();
}

/**
 * On a touch screen in landscape the dashboard sits at the bottom, between
 * your thumbs: the speed slider and fire button on the right, and the aim
 * pad's corner on the left. Size it to fit that gap, so nothing covers the
 * scanner on any phone.
 */
function fitDashboard() {
  const dash = document.querySelector<HTMLElement>('.dash');
  const fly = document.querySelector<HTMLElement>('#touch .touch-fly');
  if (!dash || !document.body.classList.contains('touch')) return;
  const natural = dash.offsetWidth; // unscaled: transforms don't change offsetWidth
  if (!natural) return;
  const landscape = innerHeight < 500;
  const AIM_LABEL = 190; // "Drag to aim", bottom left
  const left = landscape && fly ? Math.max(AIM_LABEL, innerWidth - fly.getBoundingClientRect().left + 10) : 10;
  const room = innerWidth - 2 * left; // centred, so the same margin both sides
  const most = landscape ? 0.62 : 0.72;
  document.documentElement.style.setProperty('--dash-scale', String(Math.max(0.4, Math.min(most, room / natural))));
}
addEventListener('resize', layoutForScreen);

// Coming back to the app (or turning the phone), iPhone can leave the page
// shifted, so what you tap isn't what you see. Put everything back.
function realign() {
  window.scrollTo(0, 0);
  // Some resizes land a moment late; lay out again once they have.
  setTimeout(() => {
    window.scrollTo(0, 0);
    dispatchEvent(new Event('resize'));
  }, 350);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') realign();
  // Away to another app: finish any clip being recorded with what there is, so the moment is in the
  // flight log even if the phone closes the page while it's in the background.
  else recorder.pause();
});
addEventListener('pageshow', realign);
addEventListener('orientationchange', realign);
visualViewport?.addEventListener('resize', realign);
// The row also changes height when its buttons change or fonts load, so watch it.
const controlsWatch = new ResizeObserver(layoutForScreen);
for (const nav of document.querySelectorAll<HTMLElement>('nav.controls')) controlsWatch.observe(nav);
// The dashboard and flight buttons appear on launch: fit them then too.
for (const el of document.querySelectorAll<HTMLElement>('.dash, #touch .touch-actions')) controlsWatch.observe(el);

// --- Which way up --------------------------------------------------------------
// On a phone the title and station screens are laid out upright, and flight
// sideways. Safari can't turn the screen for us, so when it's the wrong way
// round we say so: once per screen, for a few seconds or until it's turned.

let turnSeen = '';
let turnTimer: ReturnType<typeof setTimeout> | undefined;

function updateTurnHint() {
  const hint = $('#turn');
  const phone = document.body.classList.contains('touch') && Math.min(innerWidth, innerHeight) < 500;
  const upright = innerHeight > innerWidth;
  const want = game.state === 'flying' ? 'sideways' : game.state === 'title' || game.state === 'docked' ? 'upright' : null;
  if (!phone || !want || upright === (want === 'upright')) {
    hint.hidden = true;
    turnSeen = '';
    return;
  }
  if (turnSeen === game.state) return; // already said, for this screen
  turnSeen = game.state;
  hint.className = `turn ${want}`;
  hint.textContent = game.state === 'flying' ? 'Turn your phone sideways to fly' : game.state === 'docked' ? 'Turn your phone upright in the station' : 'Best upright here · sideways to fly';
  hint.hidden = false;
  clearTimeout(turnTimer);
  turnTimer = setTimeout(() => (hint.hidden = true), 5000);
}


// --- Title, new commander and docked screens --------------------------------

function showTitle() {
  game.inSpace = false;
  showFittings(null);
  showShip(cobraIndex);
  const saved = loadCommander();
  if (saved && testStartAt && !testStartDone) {
    testStartDone = true;
    startAtForTesting(saved);
    saveCommander(saved);
  }
  const load = $<HTMLButtonElement>('#load-button');
  load.hidden = !saved;
  if (saved) load.innerHTML = `<span class="key">Y · Load </span><span class="touch-word">Play as CMDR </span>${escapeHtml(saved.name)} <small>(${DIFFICULTIES[saved.difficulty].name})</small>`;
  $('#new-button').classList.toggle('primary', !saved);
  countDevice(saved?.difficulty ?? 'none', isRetro() ? '1984' : 'neo');
  updateSharedButton();
  disarmNewCommander();
  setState('title');
  titleShown();
}

// There's one commander at a time, and their rules can't change, so starting
// again deletes them. That takes a second press.
function armNewCommander(saved: Commander) {
  game.newCommanderArmed = true;
  const b = $('#new-button');
  b.classList.add('armed');
  b.innerHTML = `<span class="key">N again · </span><span class="touch-word">Tap again to </span>delete ${escapeHtml(saved.name)} (${DIFFICULTIES[saved.difficulty].name} · ${saved.credits.toLocaleString()} Cr · ${combatRating(saved.kills)})`;
}

function disarmNewCommander() {
  game.newCommanderArmed = false;
  const b = $('#new-button');
  b.classList.remove('armed');
  b.innerHTML = '<span class="key">N · </span>New commander';
}

/**
 * Modern is Witchspace: the default for everyone. Classic (the 1984 rules) is
 * kept as it was, but frozen: bug fixes only, no new features. The original
 * itself is a click away for anyone who wants pure 1984.
 */
const defaultDifficulty = (): Difficulty => 'modern';

function showNewGame() {
  const list = $('#rules');
  list.innerHTML = '';
  (['modern', 'classic'] as Difficulty[]).forEach((d, i) => {
    const b = document.createElement('button');
    const isDefault = d === defaultDifficulty();
    b.classList.toggle('primary', isDefault);
    b.innerHTML = `<b>${i + 1} · ${DIFFICULTIES[d].name}</b><strong>${DIFFICULTIES[d].tagline}</strong><small>${DIFFICULTIES[d].blurb}</small>${isDefault ? '<em>Default · Enter</em>' : ''}`;
    b.addEventListener('click', () => startCommander(d));
    list.append(b);
  });
  // Signed in with a callsign: that's the one this commander flies under, shown rather than "Jameson"
  // (Mark, signing in a second account, was asked for a callsign again). Typing another claims it instead.
  const own = currentAccount()?.callsign;
  $<HTMLInputElement>('#callsign').placeholder = own ?? 'Jameson';
  setState('newgame');
}

/**
 * Testing on a phone against the Mac's copy: /play/?at=Zaalela puts your commander (saved or new)
 * docked there. Only on a local or private-network address, never on the live site.
 */
const testStartAt = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname) ? new URL(location.href).searchParams.get('at')?.toLowerCase() : undefined;
function startAtForTesting(c: Commander) {
  const at = testStartAt ? galaxy(c.location.galaxy).find((s) => s.name.toLowerCase() === testStartAt) : undefined;
  if (at) c.location = { galaxy: at.galaxy, system: at.index };
}
let testStartDone = false;

function startCommander(difficulty: Difficulty) {
  game.commander = newCommander(difficulty);
  // A new commander hasn't flown: the last commander's trip isn't theirs (Marketing saw "How I died at Lave").
  game.flightFrom = Date.now();
  game.tripSeen = true;
  keepTrip();
  clearRadio();
  countNewCommander(difficulty, isRetro() ? '1984' : 'neo');
  setCausedEvents([]);
  startAtForTesting(game.commander);
  // Your callsign: what other commanders see. Blank keeps your account's, or the original's Jameson.
  const typed = $<HTMLInputElement>('#callsign').value.trim();
  game.commander.name = cleanName(typed || currentAccount()?.callsign || game.commander.name);
  if (signedIn() && game.commander.name !== currentAccount()?.callsign) {
    const wanted = game.commander.name;
    claimCallsign(wanted).catch((e: Error) => {
      // Taken or reserved: keep the account's callsign, if it has one.
      const kept = currentAccount()?.callsign;
      game.commander!.name = kept ?? 'Jameson';
      saveCommander(game.commander!);
      flash(kept ? `${e.message} · you're CMDR ${kept}` : `${e.message} · choose a callsign at the station`, 4);
    });
  }
  saveCommander(game.commander);
  sfx.beep();
  enterDocked(!recruiter); // a new ship: the flight log first, unless a recruiter is waiting
  if (recruiter && difficulty === 'modern') setDockTab('contracts');
}

function enterDocked(newShip = false) {
  resetBoughtHere();
  ensureSystemScene();
  game.inSpace = false;
  boardShip();
  player.repair();
  showOwnShip();
  forgive(cmdr(), Date.now());
  boardSeen();
  markDocked();
  payCommissions();
  // Work that's due here is handed in however you arrived: docking does it
  // first, but waking here in a new ship or loading the game docked must too
  // (a survey finished just before a fight was never paid).
  const handedIn = deliver(cmdr(), currentSystem());
  if (handedIn.length) {
    saveCommander(cmdr());
    setTimeout(() => flash(handedIn.join(' · '), 6), newShip ? 6500 : 300);
  }
  // Bitcoin limit orders that the real price reached while you were out filled then: say so.
  if (cmdr().btcOrders?.length)
    void checkBtcOrders(cmdr()).then((fills) => {
      if (!fills.length) return;
      saveCommander(cmdr());
      if (game.state === 'docked') renderDocked();
      setTimeout(() => flash(fills.join(' · '), 6), newShip ? 7000 : 1200);
    });
  // Ships the Carriers' Mutual were bringing here may have arrived.
  const arrived = deliveriesArrived(cmdr(), Date.now());
  if (arrived.length) {
    saveCommander(cmdr());
    const words = arrived.map((s) => `Your ${shipById(s.ship)?.name ?? 'ship'} has arrived at ${systemAt(s.at.galaxy, s.at.system).name}`);
    setTimeout(() => flash(words.join(' · '), 5), newShip ? 8000 : 1500);
  }
  // The companies may have been in touch while you were away.
  if (checkMessages(cmdr(), currentSystem(), Date.now()).length) saveCommander(cmdr());
  // Modern: the station fills your tank as you dock, as far as your credits go (Mark: forgetting
  // meant docking again). Fuel is cheap; the chore was the cost. Classic keeps 1984's pump.
  const refuelled = modern() ? autoRefuel(cmdr()) : null;
  if (refuelled) setTimeout(() => flash(refuelled, 3), newShip ? 7500 : 900);
  showWantedChart(); // a system's page on the site asked for the chart on it
  markInbox(cmdr());
  renderDocked();
  setState('docked');
  void showNewMoments(newShip);
  // Orders left elsewhere that filled while you were away are learned on docking (as the news arrives).
  if (noticeTrades()) saveCommander(cmdr());
}

/** Fill the tank as far as the credits go; what to say, or null if it was already full or there was nothing to pay with. */
function autoRefuel(c: Commander): string | null {
  const missing = Math.round((fuelCapacity(c) - c.fuel) * 10) / 10;
  const affordable = Math.min(missing, Math.floor((c.credits / FUEL_PRICE) * 10) / 10);
  if (missing <= 0 || affordable <= 0) return missing > 0 ? 'Not enough credits for fuel' : null;
  c.credits = Math.round((c.credits - affordable * FUEL_PRICE) * 10) / 10;
  c.fuel = Math.round((c.fuel + affordable) * 10) / 10;
  saveCommander(c);
  return `Refuelled · +${affordable.toFixed(1)} LY · ${(affordable * FUEL_PRICE).toFixed(1)} Cr${affordable < missing ? ' · as far as your credits go' : ''}`;
}

// Docking with new moments shows this trip's, to keep, share or delete there and then; the
// library is the flight log, from the button beside the map (Mark, 28 October 2026). A quiet
// trip kept nothing, so nothing opens. A new commander's first ship opens the log once, for
// the recorder's introduction.
// The trip's start is kept, with whether its sheet was seen, so the Home Screen app reopening
// (as iOS does) neither forgets the trip nor shows it twice.
const TRIP_KEY = 'witchspace.trip.v1';
const savedTrip = ((): { from: number; seen?: boolean } | null => {
  try {
    return JSON.parse(localStorage.getItem(TRIP_KEY) ?? 'null');
  } catch {
    return null;
  }
})();
game.flightFrom = savedTrip?.from ?? Date.now();
game.tripSeen = savedTrip?.seen ?? false;
/** This trip's sheet has been seen: dismissed, or the log opened over it. */
function tripDone() {
  setLogBadge(0);
  game.tripSeen = true;
  keepTrip();
}
function keepTrip() {
  try {
    localStorage.setItem(TRIP_KEY, JSON.stringify({ from: game.flightFrom, seen: game.tripSeen }));
  } catch {
    /* storage blocked: the trip lasts as long as the page */
  }
}

/** Badge the Flight log button with what's new, and show this trip's moments if there are any. */
async function showNewMoments(newShip: boolean) {
  if (classicRules()) return setLogBadge(0);
  const fresh = (await listMoments().catch(() => [])).filter((m) => m.created >= game.flightFrom).length;
  setLogBadge(fresh);
  if (game.state !== 'docked' || isMapOpen()) return;
  if (fresh && !game.tripSeen)
    void openTrip(game.flightFrom, {
      onClose: tripDone,
      onLibrary: () => setFlightLog(true),
      onChange: () => game.logOpen && refreshFlightLog(),
    });
  // The recorder asks once whether to stay on: after a first flight, not before a new commander has flown at all.
  else if (!newShip && recorder.available && !recorderIntroduced()) {
    setFlightLog(true);
    game.logForIntro = game.logOpen;
  }
}

function setLogBadge(n: number) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.log-button')) b.innerHTML = `<span class="key">F · </span>Flight log${n ? ` · ${n} new` : ''}`;
}

// The flight log belongs to the ship, not the station: it opens full screen,
// a gallery, from the button beside the galaxy map (F).
function setFlightLog(open: boolean) {
  game.logOpen = open && game.state === 'docked';
  if (!game.logOpen) game.logForIntro = false;
  $('#flight-log-view').hidden = !game.logOpen;
  if (game.logOpen) {
    if (isTripOpen()) tripDone();
    closeTrip();
    refreshFlightLog();
    setLogBadge(0); // seen
  }
}

// --- Space ------------------------------------------------------------------

// The station sits at the origin with its slot facing the planet, as in the
// original. Everything else about the system is rebuilt on arrival.


// --- Building a star system -------------------------------------------------------

/** Planet line colour by economy: industrial worlds violet, farm worlds blue-green. */
function planetColour(sys: StarSystem): string {
  return new THREE.Color().setHSL((270 - sys.economy * 17) / 360, 0.75, 0.62).getStyle();
}


let builtSystem: StarSystem | null = null;

/** Rebuild the planet, police and debris for a star system. */
function buildSystemScene(sys: StarSystem) {
  builtSystem = sys;
  track.clear(); // a new system: the old fight is over
  if (flight.planet) disposePlanet(flight.planet);
  flight.planetRadius = sys.radius * 1.2;
  flight.atmosphere = flight.planetRadius * ATMOSPHERE_SCALE;
  planetPos.set(0, 0, flight.planetRadius + 9000);
  flight.planetGM = 0.05 * planetPos.z ** 2;
  flight.planet = buildPlanet(flight.planetRadius, planetColour(sys));
  flight.planet.position.copy(planetPos);
  flight.planet.rotation.set(((sys.extraSeed[0] / 255) - 0.5) * 0.8, sys.extraSeed[1] / 40, ((sys.extraSeed[2] / 255) - 0.5) * 0.8);
  space.scene.add(flight.planet);
  // The sun sits somewhere different in each system.
  const a = (sys.extraSeed[3] / 255) * Math.PI * 2;
  SUN_POS.set(Math.cos(a) * 70000, 20000 + sys.extraSeed[1] * 40, Math.sin(a) * 70000 - 30000);
  sun.position.copy(SUN_POS);
  space.sun.position.copy(SUN_POS);

  disposeCarrier();
  clearMarshalTimer();
  for (const npc of npcs) {
    voices.get(npc)?.dispose();
    npc.dispose();
  }
  voices.clear();
  npcs.length = 0;
  for (const m of missiles) m.dispose();
  missiles.length = 0;
  flight.locked = null;
  flight.seeker = null;
  for (const d of drifters) disposeShip(d.model);
  drifters.length = 0;
  for (const e of explosions) e.dispose();
  explosions.length = 0;
  for (let i = 0; i < PATROLS_BY_GOVERNMENT[sys.government]; i++) spawnViper(false);
  flight.reinforceTimer = flight.repopulateTimer = 0;
  forgetDeliveries();
  // Some traffic already about, and maybe trouble soon after arrival.
  // Classic: a few traders at random. Modern: the timetable's (syncTraffic).
  resetTraffic();
  if (!modern()) for (let i = 0; i < TRADERS_BY_GOVERNMENT[sys.government] - 1; i++) spawnTrader(true, 5000 + Math.random() * 10000);
  startEncounters();
  flight.scanned = false;
  flight.scanProgress = 0;
  flight.unpinned = flight.hail = null;
  flight.hullChecked = flight.defiedPolice = false;
  buildExploreScene(sys);
  restoreAdrift();
}

/** Make sure the scene matches where the commander is. */
function ensureSystemScene() {
  const here = currentSystem();
  if (builtSystem !== here) buildSystemScene(here);
}


// --- Full screen on phones ---------------------------------------------------
// Android can go full screen from the page. iPhone Safari can't: its bars only
// go when the game is added to the Home Screen (manifest + apple meta in
// play/index.html), and only then can the companies reach an iPhone. So the
// title screen says how, until it's done or put off for a few days.

const standalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

const INSTALL_LATER = 'witchspace.installLater';
const INSTALL_PAUSE = 3 * 86_400_000; // "Not now" holds for three days
/** Chrome's own install prompt, kept for our button (Android). */
let installPrompt: (Event & { prompt(): Promise<void> }) | null = null;

function showInstall() {
  let later = 0;
  try {
    later = Number(localStorage.getItem(INSTALL_LATER) ?? 0);
  } catch {
    // Storage blocked: offer it each visit, which is harmless.
  }
  const offer = isTouch && !standalone() && (isIos || installPrompt !== null) && Date.now() - later > INSTALL_PAUSE;
  $('#install').hidden = !offer;
  if (!offer) return;
  $('#install-go').hidden = !installPrompt;
  $('#install-how').innerHTML = installPrompt
    ? 'Install Witchspace and play from its icon, like an app.'
    : 'Tap <b>Share</b> (under <b>•••</b> on newer iPhones), then <b>Add to Home Screen</b>, and play from the icon.<span class="install-why"> The companies can only send notifications to an iPhone that way.</span>';
}
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e as typeof installPrompt;
  showInstall();
});
$('#install-go').addEventListener('click', async () => {
  await installPrompt?.prompt();
  installPrompt = null;
  showInstall();
});
$('#install-later').addEventListener('click', () => {
  try {
    localStorage.setItem(INSTALL_LATER, String(Date.now()));
  } catch {
    // Storage blocked: it's back next visit.
  }
  $('#install').hidden = true;
});
showInstall();

if (isTouch && !isIos) {
  addEventListener(
    'touchend',
    () => void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}),
    { once: true },
  );
}

/** Whether this page load has launched yet: the first launch is counted once (Vercel Web Analytics: the rules and the controls, nothing personal). */
let launchCounted = false;

/** When the station last warned that you're wanted: Launch again soon after to go anyway. */
let wantedWarnedAt = -Infinity;
const WANTED_CONFIRM = 6000; // ms

async function launch() {
  if (wantedOnLaunch(cmdr()) && Date.now() - wantedWarnedAt > WANTED_CONFIRM) {
    wantedWarnedAt = Date.now();
    setDockTab('station');
    const box = $('#wanted');
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    box.classList.remove('pulse');
    void box.offsetWidth; // restart the pulse
    box.classList.add('pulse');
    sfx.beep();
    flash('Wanted here · the police will open fire · settle first, or Launch again to go anyway', 4);
    return;
  }
  wantedWarnedAt = -Infinity;
  if (booth) closeBooth();
  if (!launchCounted) {
    launchCounted = true;
    countEvent('launch', { rules: cmdr().difficulty, controls: isTouch ? 'touch' : 'keys' }); // how many who arrive actually fly; nothing personal
  }
  const repaired = fitTransponderForLaunch();
  ensureSystemScene();
  setState('transition');
  if (!isRetro() && isWorking(cmdr(), 'docking-computer')) preloadRecording();
  sfx.tunnel();
  await playTunnel();
  game.inSpace = true;
  closeDrawer(); // a clean screen to fly from
  sharedSpace.resume(); // launching here means flying here, even if another window had the ship
  player.repair();
  station.placeForLaunch(player);
  markLaunched();
  game.flightFrom = Date.now();
  game.tripSeen = false;
  keepTrip();
  aim.reset(player);
  player.speed = player.maxSpeed * 0.3;
  flight.cabinTemp = 0;
  flight.locked = null;
  flight.seeker = null;
  scheduleMarshals(); // still wanted? they'll be back
  flight.raidClock = 0;
  setView('front');
  flight.clearanceAnnounced = true; // you've just left; no need to tell you
  setState('flying');
  engineSound.spool(); // a grand tourer winds up as she leaves (Mark); a drone just runs
  // The station that launched you knows exactly who you are: a broken
  // transponder is logged, not hailed, for the rest of this visit.
  if (repaired !== null) {
    flash(`${stationName(currentSystem()).name} · No launch clearance without a working transponder · repaired${repaired ? ` · ${repaired.toLocaleString()} Cr` : ' on the house'}`, 4.5);
  } else if (transponderBroken() && hasLaw(currentSystem())) {
    flight.hullChecked = true;
    flash(`${stationName(currentSystem()).name} · Transponder damaged · your hull is logged, police won't hail you here · repair it when you dock`, 4.5);
  } else flash(`${stationName(currentSystem()).name} · ${currentSystem().name}`, 2.5);
  if (recordVisit(cmdr(), currentSystem())) saveCommander(cmdr()); // where you started counts
  // The radio (Modern): what was said while you were docked, and the array listening from the start.
  for (const b of document.querySelectorAll<HTMLElement>('#touch .radio-button')) b.hidden = !modern();
  wakeRadio();
  flight.arrayTimer = 6;
  distresses.length = 0;
  flight.escort = null;
  announceEvent(currentSystem(), 2800);
}

/**
 * Stations that check transponders won't clear a ship without a working one:
 * a broken transponder is fixed before launch, for what you can pay (and on
 * the house if you can't). Returns what it cost, or null if nothing was done.
 */
function fitTransponderForLaunch(): number | null {
  const c = cmdr();
  if (c.difficulty !== 'modern' || !checksClearance(currentSystem())) return null;
  flight.transponderOff = false; // cleared out with it on; switch it off once you're away
  if (!transponderBroken()) return null;
  const cost = Math.min(c.credits, Math.round(EQUIPMENT.find((e) => e.id === 'transponder')!.price * REPAIR_FRACTION));
  c.credits = Math.round((c.credits - cost) * 10) / 10;
  c.damaged = c.damaged.filter((id) => id !== 'transponder');
  saveCommander(c);
  return cost;
}

/** A moment worth a callsign card (the first kill or survey), kept for the next docking. */
function noteCardMoment(career: 'fight' | 'explore') {
  const c = cmdr();
  if (!c.cardInvite && !signedIn()) c.cardInvite = career;
}

/** Docked: invite a signed-out commander to make their callsign card, once ever, after the dock's own news. */
function offerCard() {
  const c = cmdr();
  if (signedIn() || c.cardInvite === 'asked') return;
  const career = c.cardInvite ?? 'trade';
  c.cardInvite = 'asked';
  saveCommander(c);
  // After the dock's own news, and never over another sheet (your moments, the flight log): wait for them.
  const offer = () => {
    if (game.state !== 'docked' || signedIn()) return;
    if (game.logOpen || isTripOpen() || !$('#handover').hidden) return void setTimeout(offer, 1500);
    showCardInvite(c.name, career);
  };
  setTimeout(offer, 3000);
}

async function dock() {
  setAutopilot(false);
  flight.surrenderTimer = null;
  setState('transition');
  sfx.tunnel();
  await playTunnel();
  const c = cmdr();
  // Offenders are fined on arrival; lawful stations also inspect the hold.
  const sys = currentSystem();
  // Inspections are certain under Classic rules and likely, not certain, under Modern.
  const smuggling = carriesContraband(c);
  const inspected = smuggling && Math.random() < inspectionChance(c, sys);
  // Strict stations weigh ships: one heavier than its papers gets its hidden compartment opened.
  const weighed = !smuggling && checksClearance(sys) && weighsShips(sys) && hidingSomething(c, sys) && Math.random() < WEIGHBRIDGE_CHANCE;
  if (weighed) delete c.compartment;
  const due = checksClearance(sys) && (legalStatus(c) === 'offender' || inspected || weighed);
  const settlement = due ? settle(c) : null;
  const specialsDue = (c.contracts ?? []).filter((a) => a.special && a.to.system === sys.index && a.to.galaxy === sys.galaxy && a.jumpsLeft >= 0).map((a) => a.company);
  const held = [...exploreOf(c).data];
  const seen = messageIds();
  const delivered = deliver(c, sys);
  // Work accepted over the comms array, waiting here: loaded if it fits.
  const collected = collect(c, sys, cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
  bringHome(held);
  void loadFirsts(sys.galaxy);
  const news = checkMessages(c, sys, Date.now());
  const gone = [...collectHeld(c, sys), ...checkAdrift()];
  saveCommander(c);
  enterDocked();
  radioMessages(seen); // heard on the radio too, for the log when you launch
  markInbox(c);
  if (settlement) flash(settlementMessage(settlement, weighed ? 'Weighbridge: heavier than your papers · hidden compartment opened' : inspected ? 'Hold inspected' : 'Fined on arrival'), 6);
  else if (delivered.length || collected.length) flash([...delivered, ...specialsDue.map(thanksFrom), ...collected].join(' · '), 6);
  else if (gone.length) flash(gone.join(' · '), 5);
  else if (news.length) flash(`New message from ${COMPANIES[news[0].company].name}: ${news[0].subject}`, 5);
  else if (smuggling && inspectionChance(c, sys) > 0) flash('Docked · your hold was not inspected this time', 3);
  // The yard's word on a spec from the site, unless the dock had more pressing news.
  void checkSiteSpec(!settlement && !delivered.length && !collected.length && !gone.length && !news.length);
  void checkSignedOver();
  offerCard();
}

function settlementMessage(s: Settlement, lead: string) {
  const parts = [`${lead} · ${s.fine.toLocaleString()} Cr`];
  if (s.confiscated.length) parts.push(`${s.confiscated.map((id) => commodityById(id)?.name ?? EQUIPMENT.find((e) => e.id === id)?.name ?? id).join(', ')} confiscated`);
  if (s.owed > 0) parts.push(`couldn't pay ${s.owed.toLocaleString()} Cr · equipment impounded`);
  return parts.join(' · ');
}

// --- Photos -----------------------------------------------------------------


/** What the scanner shows of the ship in your sights, line by line, for the photo's card (none if nothing's sighted). */
function scannerCaption(): string[] {
  const info = $('#target-info');
  if (info.hidden || game.state !== 'flying') return [];
  const hold = info.querySelector('.cargo')?.textContent ?? '';
  const ship = (info.textContent ?? '').slice(0, (info.textContent ?? '').length - hold.length).trim();
  return [ship, hold].filter(Boolean);
}

/** P: copy the frame just drawn, with a shutter flash, into the flight log (or saved or shared, where there's no log). */
function snapPhoto() {
  const canvas = $<HTMLCanvasElement>(isRetro() ? '#retro' : '#neo');
  const shot = takePhoto(canvas, isRetro(), scannerCaption());
  const ctx = momentContext();
  sfx.shutter();
  const el = $('#photo-flash');
  el.classList.remove('on');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('on');
  void shot.then(async (photo) => {
    if (!photo) return flash('Photo failed', 2.5);
    const m = ctx && (await logMoment({ events: [{ kind: 'photo', text: 'Photo taken' }], ctx }, { photo, poster: null, seconds: 0 }));
    flash(m ? 'Photo · in your flight log' : await savePhoto(photo), 2.5);
    if (m && game.state === 'docked') refreshFlightLog();
  });
}

// --- Input ------------------------------------------------------------------

function updateModeLabel() {
  $('#mode').textContent = isRetro() ? '1984 MODE' : 'NEO-VECTOR';
  $('#look').classList.toggle('retro', isRetro());
}

/** Gamepad buttons map onto the keyboard action for the current screen. */
function padToKey(button: 'PadA' | 'PadB' | 'PadY' | 'PadStart'): string | null {
  if (button === 'PadY') return 'KeyM';
  if (button === 'PadB') return game.state === 'newgame' ? 'Escape' : null;
  switch (game.state) {
    case 'title':
    case 'newgame':
      return 'Enter';
    case 'docked':
      return 'KeyL';
    case 'flying':
      return button === 'PadA' ? 'KeyC' : null;
    default:
      return null;
  }
}

// --- Where you are, and the galaxy charts ---------------------------------------



function toggleGalaxyMap() {
  if (isMapOpen()) {
    closeMap();
    setFlightInputSuppressed(false);
    return;
  }
  const c = cmdr();
  if (c.difficulty === 'modern') void loadFirsts(currentSystem().galaxy); // fresh names for next time; cached for five minutes
  const here = currentSystem();
  openMap({
    current: here,
    range: c.fuel,
    target: c.courseTo != null ? systemAt(here.galaxy, c.courseTo) : c.target === null ? null : systemAt(here.galaxy, c.target),
    news: (s) => newsLine(s, currentSystem()),
    // Contracts in hand, so you can see where they're going once you've launched.
    contracts: (c.contracts ?? []).map((a) => {
      const to = destinationOf(a);
      const left = a.jumpsLeft >= 0 ? `${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'} left` : 'late: half pay';
      const adrift = a.adrift ? ' · adrift: see Contracts when docked' : '';
      return { to, colour: COMPANIES[a.company].colour, line: `${a.qty} t ${cargoName(a)} → ${to.name} · ${left} · ${a.pay.toLocaleString()} Cr · ${COMPANIES[a.company].name}${adrift}` };
    }),
    firsts: (s) => (c.difficulty === 'modern' ? firstsLine(s) : null),
    // Where Wexley-Yorozu runs the station, data sells for more (Mark: "how do I get to a W-Y station?").
    station: (s) => (c.difficulty === 'modern' && wyWorks(s) ? 'Wexley-Yorozu · pays 25% more for survey data' : null),
    explored: (s) => {
      const e = exploreOf(c);
      if (!e.visited.includes(`${s.galaxy}:${s.index}`)) return { visited: false, line: 'Not yet' };
      if (c.difficulty !== 'modern') return { visited: true, line: 'Visited' };
      const surveyed = bodiesOf(s).filter((b) => isSurveyed(c, s, b.id)).length;
      const found = poisOf(s).filter((p) => isFound(c, s, p.id)).length;
      return { visited: true, line: `Visited · surveyed ${surveyed} of ${bodiesOf(s).length}${found ? ` · ${found} signal${found === 1 ? '' : 's'} found` : ''}` };
    },
    onTarget: (s) => {
      // Within a jump: straight there. Further: plot the route, a hop at a time.
      const route = distanceLy(here, s) > fuelCapacity(c) ? plotCourse(c, s.index) : '';
      if (!route) {
        c.target = s.index;
        c.courseTo = null;
      } else flash(route, 3);
      saveCommander(c);
      sfx.beep();
      if (game.state === 'docked') renderDocked();
      else flash(`Destination: ${s.name}`, 1.5);
    },
  });
  // The galactic hyperdrive is launched from here, in flight.
  const galactic = $('#galaxy-map .map-galactic');
  galactic.hidden = !(game.state === 'flying' && hasEquipment(c, 'galactic-hyperdrive'));
  galactic.textContent = `Y · Galactic hyperdrive to Galaxy ${((here.galaxy + 1) % 8) + 1}`;
  setFlightInputSuppressed(true);
}

/** Keys while a chart is open. Returns true if the key was used. */
function handleMapKey(code: string): boolean {
  if (!isMapOpen()) return false;
  if (code === 'KeyG' || code === 'Escape') toggleGalaxyMap();
  else if (code === 'Tab') toggleMapMode();
  else if (code === 'KeyF') setTimeout(focusFind); // after this key, so the F isn't typed into the box
  else if (code === 'ArrowLeft') moveCursor(-1, 0);
  else if (code === 'ArrowRight') moveCursor(1, 0);
  else if (code === 'ArrowUp') moveCursor(0, -1);
  else if (code === 'ArrowDown') moveCursor(0, 1);
  else if (code === 'Enter' || code === 'NumpadEnter') chooseCursor();
  else return false;
  return true;
}

function handleKey(code: string) {
  unlockAudio();
  if (killCam.key(code)) return;
  if (handleMapKey(code)) return;
  if (code === 'KeyG' && (game.state === 'docked' || game.state === 'flying') && game.commander) {
    if (game.logOpen) setFlightLog(false);
    toggleGalaxyMap();
    return;
  }
  // The BBC Micro's keys put the missile on M, as in 1984; 1984 mode stays on M when not flying.
  if (code === 'KeyM' && game.state === 'flying' && controlScheme() === 'bbc') {
    fireMissile();
    return;
  }
  if (code === 'KeyM') {
    setRetro(!isRetro());
    updateModeLabel();
    if (game.state === 'newgame') showNewGame(); // the default rules follow the mode
    if (game.state === 'docked' && game.dockTab === 'market') renderMarket(); // exchange or 1984 price list
    return;
  }
  if (code === 'KeyP' && game.state !== 'newgame') {
    game.photoPending = true; // taken right after the next frame is drawn
    return;
  }
  if (code === 'KeyN' && game.state !== 'title') {
    const mode = cycleSoundMode();
    flash(mode === 'full' ? 'Sound: full' : mode === 'effects' ? 'Sound: effects only (no engine hum)' : 'Sound: off', 1.6);
    return;
  }
  switch (game.state) {
    case 'title':
      if (code === 'ArrowRight') showShip(shipIndex + 1);
      else if (code === 'ArrowLeft') showShip(shipIndex - 1);
      else if (code === 'KeyY' || code === 'Enter') {
        game.commander = loadCommander();
        setCausedEvents(game.commander?.caused);
        if (game.commander) {
          enterDocked();
          void checkSiteSpec(true);
          void checkSignedOver();
        } else showNewGame();
      } else if (code === 'KeyN') {
        const saved = loadCommander();
        if (saved && !game.newCommanderArmed) armNewCommander(saved);
        else showNewGame();
      } else if (code === 'KeyS') {
        toggleSharedSpace();
      } else if (code === 'KeyA' || (code === 'Escape' && isAccountPanelOpen())) {
        toggleAccountPanel();
      }
      if (code !== 'KeyN' && game.newCommanderArmed) disarmNewCommander();
      break;
    case 'newgame':
      if (code === 'Digit1') startCommander('modern');
      else if (code === 'Digit2') startCommander('classic');
      else if (code === 'Enter') startCommander(defaultDifficulty());
      else if (code === 'Escape') showTitle();
      break;
    case 'docked':
      if (code === 'Escape' && isTripOpen()) {
        closeTrip();
        tripDone();
      } else if (code === 'KeyF' || (code === 'Escape' && game.logOpen)) setFlightLog(!game.logOpen);
      else if (code === 'KeyL' || code === 'Enter') void launch();
      else if (code === 'KeyT') setDockTab(game.dockTab === 'market' ? 'station' : 'market');
      break;
    case 'flying':
      // The beacon's calls, while its panel is open: 1-4 send, Esc or ` cancel.
      if (beaconOpen && /^Digit[1-4]$/.test(code)) return sendBeacon(BEACON_CALLS[Number(code.slice(5)) - 1].call);
      if (beaconOpen && code === 'Escape') return toggleBeacon(false);
      if (code === 'Escape' && !$('#controls-card').hidden) return toggleControlsCard(false);
      if (code === 'F1') {
        toggleControlsCard();
      } else if (code === 'KeyH') {
        toggleHyperspace();
      } else if (code === 'KeyR') {
        flash(`Scanner range ${toggleScannerRange() / 1000} km`, 1.2);
      } else if (code === 'KeyJ') {
        inSystemJump();
      } else if (code === 'KeyU' && controlScheme() === 'bbc') {
        if (flight.seeker || flight.locked) toggleLock(); // unarm
      } else if (code === 'KeyQ' && controlScheme() === 'bbc') {
        toggleSurrender();
      } else if (code === 'KeyE' && controlScheme() === 'bbc') {
        playerEcm();
      } else if (code === 'KeyU') {
        toggleSurrender();
      } else if (code === 'KeyT') {
        toggleLock();
      } else if (code === 'KeyX') {
        if (controlScheme() !== 'bbc') fireMissile(); // the BBC Micro's keys climb on X
      } else if (code === 'KeyZ') {
        playerEcm();
      } else if (code === 'KeyB') {
        energyBomb();
      } else if (code === 'KeyV') {
        setView(MOUNTS[(MOUNTS.indexOf(flight.view) + 1) % MOUNTS.length]);
      } else if (code === 'Digit0') {
        toggleTransponder();
      } else if (/^Digit[1-4]$/.test(code)) {
        setView(MOUNTS[Number(code.slice(5)) - 1]);
      } else if (code === 'KeyL') {
        hailTarget();
      } else if (code === 'Quote') {
        if (modern()) toggleRadio();
      } else if (code === 'Backquote') {
        toggleBeacon();
      } else if (code === 'Enter') {
        if (modern() && !acceptLatest()) flash('Nothing on the radio to accept', 1.2);
      } else if (code === 'KeyY') {
        toggleGalacticJump();
      } else if (code === 'KeyK') {
        const s = toggleControlScheme();
        renderControlsCard();
        flash(s === 'mouse' ? 'Mouse + keyboard · click to aim' : s === 'bbc' ? 'BBC Micro keys · X/S climb and dive, A fire, M missile' : 'Keyboard only (classic)', 2);
      } else if (code === 'KeyI') {
        flash(toggleInvertPitch() ? 'Pitch inverted' : 'Pitch normal', 2);
      } else if (code === 'KeyO') {
        toggleCombatComputer();
      } else if (code === 'Digit9') {
        toggleSurveyPilot();
      } else if (code === 'KeyC') {
        stopCombatComputer();
        if (flight.autopilot) setAutopilot(false, 'Docking computer off');
        else if (!hasEquipment(cmdr(), 'docking-computer')) flash('Docking computer not fitted', 2);
        else if (!isWorking(cmdr(), 'docking-computer')) flash('Docking computer damaged · repair at a station', 2);
        else if (player.obj.position.distanceTo(station.root.position) > 10000) flash('Too far from the station', 2);
        else if (!darkRefused() || transponderOnToDock()) setAutopilot(true, 'Docking computer on');
      }
      break;
  }
}

addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest?.('input, textarea')) return; // typing, not flying
  if (e.code === 'Tab' && isMapOpen()) e.preventDefault(); // Tab switches charts, not focus
  if (e.code === 'Escape' && isReplayOpen()) return closeReplay();
  if (e.code === 'KeyP' && e.shiftKey) {
    if (!e.repeat) keepByHand();
    return;
  }
  if (!e.repeat) handleKey(e.code);
});
// Enter in the callsign box confirms it and starts with the default rules, as Enter does on that screen.
$<HTMLInputElement>('#callsign').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  (e.target as HTMLInputElement).blur();
  handleKey('Enter');
});
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) => {
  const press = () => {
    b.blur(); // otherwise Space (throttle) would click it again
    handleKey(b.dataset.key!);
  };
  // The flight buttons are pressed mid-fight, with a finger on the aim pad.
  if (b.closest('#touch')) onTap(b, press);
  else b.addEventListener('click', press);
});

// --- Main loop --------------------------------------------------------------

timer.connect(document);

// The battery (Mark: his phone went flat much quicker): on a phone or tablet, never more than 60 frames
// a second, even on a 120 Hz screen. A computer runs at its screen's full rate, 144 on a 144 Hz monitor
// (Mark: "the 144 is true if you have the hardware!"). Docked behind a screen that covers the hangar,
// a few a second on either.
const MIN_FRAME = isTouch ? 1000 / 61 : 0;
const RESTING_FRAME = 1000 / 6;
let lastDrawn = -Infinity;
let coveredAt = 0;
let covered = false;
/** Docked, with the station's screens (or the flight log) over the whole hangar: nothing to see moving. */
function hangarCovered(t: number): boolean {
  if (t - coveredAt < 500) return covered;
  coveredAt = t;
  // Whatever's on top at a few points across the screen: if none of them is the 3D view, it's hidden.
  const neo = document.querySelector('#neo');
  const points = [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8], [0.7, 0.5]];
  covered = points.every(([x, y]) => document.elementFromPoint(innerWidth * x, innerHeight * y) !== neo);
  return covered;
}

function frame(now?: number) {
  const t = now ?? performance.now();
  const resting = !game.inSpace && game.state === 'docked' && !booth && !killCam.active && hangarCovered(t);
  if (t - lastDrawn < (resting ? RESTING_FRAME : MIN_FRAME) - 1) {
    requestAnimationFrame(frame);
    return;
  }
  lastDrawn = t;
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  if (killCam.active) {
    // The kill cam has the screen: the game holds still underneath (and while it saves a video, it draws its own frames).
    if (!killCam.exporting) {
      lens.aim(camera, null, 0, 0);
      killCam.update(dt);
      render(killCam.space.scene);
    }
    recorder.pause();
    requestAnimationFrame(frame);
    return;
  }
  for (const button of gamepadPresses()) {
    const code = padToKey(button);
    if (code) handleKey(code);
  }
  if (game.inSpace) {
    if (camera.view?.enabled) camera.clearViewOffset();
    if (game.state !== 'transition') updateSpace(dt);
    const rift = carrier?.rift;
    lens.aim(camera, rift ? rift.group.position : null, rift ? rift.radius * rift.open : 0, rift ? rift.open : 0);
    render(space.scene);
    if (game.state === 'flying') watchSurroundings(dt);
    if (game.state === 'flying' || game.state === 'dead') recorder.capture(viewCanvas(), dt, game.state === 'flying' && recorderWatch.resting);
    else recorder.pause();
  } else {
    lens.aim(camera, null, 0, 0);
    updateShowroom(dt);
    render(showroom.scene);
    recorder.pause();
  }
  if (game.photoPending) {
    game.photoPending = false;
    snapPhoto();
  }
  requestAnimationFrame(frame);
}

// Handy for poking at the game from the browser console during development.
// Dev only: /play/?demo=fdl starts you docked at Leesti in a Witch-fire Edition 001 of your own, to see it.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('demo') === 'fdl') {
  const leesti = galaxy(0).find((s) => s.name === 'Leesti')!;
  const e = EDITIONS[0];
  const c = newCommander('modern');
  c.name = 'Moxon';
  c.location = { galaxy: 0, system: leesti.index };
  c.ship = e.ship;
  c.paint = { colour: e.colour, glow: e.glow, trim: e.trim, name: 'Moxon', luxuries: [...e.luxuries], edition: { id: e.id, number: 1 }, gifted: true };
  saveCommander(c);
  history.replaceState(null, '', location.pathname);
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    witchspace: {
      player, station, dockingComputer, drifters, explosions, spillCargo, sun, npcs, missiles, launchMissile, spawnPirates, recorder, recorderWatch, music, spawnFalcon: () => spawnFalcon(player.obj.position.clone().addScaledVector(player.forward(), 6000), player.obj.position), spawnTrader, spawnDistress, sendBeacon, hailTarget, playerHitNpc, becomeFugitive, damagePlayer, die, legalStatus, renderDocked, aim, summonCarrier, setAutopilot,
      get carrier() { return carrier; },
      get locked() { return flight.locked; },
      get distresses() { return distresses; },
      get laserHeat() { return flight.laserHeat; },
      get escort() { return flight.escort; },
      get view() { return flight.view; },
      get seeker() { return flight.seeker; },
      get commander() { return game.commander; },
      get state() { return game.state; },
      get autopilot() { return flight.autopilot; },
      get explore() { return { bodies: flight.sceneBodies, pois: flight.scenePois, planetPos, survey }; },
      get yard() { return flight.yardScene; },
      /** The timetable's ships here now: who, which leg, riding their lane or flying themselves, and where. */
      traffic: () => npcs.filter((n) => voyageOf.has(n)).map((n) => ({ id: voyageOf.get(n)!.id, name: traderName(n), leg: legs.get(n), riding: railsOf.has(n), at: n.obj.position.toArray().map(Math.round), km: +(n.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1) })),
      security: () => npcs.filter((n) => n.guard).map((n) => ({ who: speakerOf(n).from, mode: n.mode, km: +(n.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1), with: escortOf.get(n) ? traderName(escortOf.get(n)!) : null })),
      /** Encounter pacing: the next roll, the last fight, and how wary the pirates are here. */
      get pacing() { return pacing(); },
      /** Yards at work in this galaxy now. */
      yards: () => yardsOf(currentSystem().galaxy, Date.now()),
      /** Hyperspace straight to a system in this galaxy, fuel or not. */
      jumpTo(index: number) {
        cmdr().target = index;
        cmdr().fuel = fuelCapacity(cmdr());
        void hyperspace();
      },
    },
  });
}

setRetro(false);
updateModeLabel();
initTouch();
initKeyboard();
initRadio();
setDockTab('station');
showTitle();
answerAdvert();
answerChart();

// A shared clip's link (witchspace.org.uk/clip/<id>, or /play/?clip=<id>): straight
// into the kill cam on it, with its hearts; closing it leaves you at the title
// screen, a key from playing (docs/design/flight-recorder.md, "Clip pages").
const sharedClipId = location.pathname.match(/^\/clip\/([a-z0-9]{8,12})\/?$/)?.[1] ?? new URLSearchParams(location.search).get('clip');
if (sharedClipId && /^[a-z0-9]{8,12}$/.test(sharedClipId)) void openSharedClip(sharedClipId);
// One of your clips, from the flight log's list: played over the log, and closing comes back to it (Mark).
setWatchClip((id) => void openSharedClip(id, true));
async function openSharedClip(id: string, fromGame = false) {
  const clip = await getClip(id);
  const data = clip ? await readTrack(clip.track).catch(() => null) : null;
  if (!clip || !data) return flash(fromGame ? "That clip isn't on the site any more" : "That clip isn't here any more · but the galaxy is: press Enter to fly", 5);
  if (fromGame) document.querySelector<HTMLVideoElement>('#replay video')?.pause();
  else document.title = `${clip.title} · Witchspace`;
  const closed = () => {
    if (fromGame) return; // back to the flight log, as it was
    document.title = 'Play · Witchspace';
    history.replaceState(null, '', '/play/');
  };
  const outside = () =>
    killCam.open(data, {
      seconds: clip.seconds,
      title: clip.title,
      shared: { hearts: clip.hearts, mine: clip.mine, heart: (on) => heartClip(id, on), report: () => reportClip(id) },
      onClose: closed,
    });
  // The video its sharer shared plays first (Mark); the rebuilt fight is a tap away. A clip shared before
  // videos went up, or whose video hasn't, opens on the rebuilt fight as before.
  if (clip.video) showClipView({ title: clip.title, video: clip.video, hearts: clip.hearts, mine: clip.mine, heart: (on) => heartClip(id, on), report: () => reportClip(id), outside, closed });
  else outside();
}
frame();

// Accounts: every save also goes to the cloud when signed in; sign-in links land here.
onSave(commanderSaved);
onSave((c) => setCausedEvents(c.caused));
void initAccount({
  flash,
  commanderReplaced: () => {
    if (game.state === 'title') showTitle();
  },
  onTitle: () => game.state === 'title',
}).then(() => {
  // Signed in after docking (the account loads in the background): a commission may be waiting.
  if (game.state === 'docked' && game.commander) payCommissions();
});

// Started: the old-browser note (public/old-browser.js) stays away.
(window as unknown as { __witchspaceStarted: boolean }).__witchspaceStarted = true;
