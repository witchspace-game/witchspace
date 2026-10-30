import * as THREE from 'three';
import { track as countEvent } from '@vercel/analytics';
import { cycleSoundMode, danube, music, preloadRecording, sfx, unlockAudio } from './audio/sound';
import { setListener } from './audio/spatial';
import { shipById } from './content/ships';
import {
  cargoCapacity,
  cargoTonnes,
  DIFFICULTIES,
  deleteCommander,
  EQUIPMENT,
  FUEL_PRICE,
  fuelCapacity,
  hasEquipment,
  isWorking,
  loadCommander,
  REPAIR_FRACTION,
  type Mount,
  MOUNTS,
  newCommander,
  onSave,
  removeEquipment,
  saveCommander,
  type Commander,
  hullOf,
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
import { claimInsurance } from './game/insurance';
import {
  controlScheme,
  flightInput,
  gamepadPresses,
  isMouseCaptured,
  isTouch,
  setFlightInputSuppressed,
  setFlying,
  toggleControlScheme,
  toggleInvertPitch,
  type FlightInput,
} from './game/input';
import { SENSITIVITY as AIM_SENSITIVITY } from './game/mouseAim';
import { NpcShip } from './game/npc';
import { signedIn, currentAccount } from './net/account';
import { hideCardInvite, showCardInvite } from './ui/cardInvite';
import { claimCallsign, commanderSaved, initAccount, isAccountPanelOpen, titleShown, toggleAccountPanel } from './ui/accountPanel';
import { cleanName } from '../server/src/protocol';
import { combatRating } from './game/rating';
import { EDITIONS } from './content/editions';
import { deliveriesArrived } from './game/shipyard';
import { PLAYER_LASERS } from './game/weapons';
import { ledgerOf } from './game/ledger';
import { filledLine, isRun, newSince, profitOf, runLine, runOf, seenNow } from './game/tradeMoments';
import { ATMOSPHERE_SCALE, buildPlanet, disposePlanet } from './render/bodies';
import { cargoName, collect, deliver, destinationOf, forgive, loseContracts, wyWorks } from './game/contracts';
import { checkMessages, collectHeld, STATION_CREW_RANGE, setAdrift, thanksFrom } from './game/assignments';
import { COMPANIES } from './game/companies';
import { bodiesOf, exploreOf, isFound, isSurveyed, poisOf, recordVisit } from './game/explore';
import { yardsOf } from './game/yards';
import { Explosion } from './render/explosion';
import { camera, isRetro, lens, render, setRetro } from './render/renderer';
import { disposeShip, heatShip } from './render/shipModel';
import { stationName } from './galaxy/stationNames';
import { savePhoto, takePhoto } from './ui/photo';
import { clearFlash, flash, setInterference, toggleScannerRange, updateHud, type Blip } from './ui/hud';
import { clearIndicators } from './ui/indicators';
import { countDevice, countNewCommander } from './net/stats';
import { loadFirsts } from './net/firsts';
import { closeMap, chooseCursor, focusFind, isMapOpen, moveCursor, openMap, toggleMapMode } from './ui/galaxyMap';
import { distanceLy, galaxy, GOVERNMENTS, systemAt, type StarSystem } from './galaxy/generate';
import { commodityById } from './economy/commodities';
import { activeEvent, EVENT_KINDS, setCausedEvents } from './economy/events';
import { inspectionChance } from './economy/legality';
import { escapeHtml } from './ui/escape';
import { playTunnel } from './ui/tunnel';
import { closeDrawer, initTouch, onTap, updateTouch } from './ui/touch';
import { BEACON_CALLS } from './game/radio';
import { acceptLatest, clearRadio, initRadio, toggleRadio, wakeRadio } from './ui/radio';
import { FlightRecorder, type Clip } from './game/recorder';
import { RecorderWatch } from './game/recorderWatch';
import { addMoment, attachTrack, deleteMoment, listMoments, type LoggedMoment } from './game/flightLog';
import { readTrack, TrackRecorder, trackBlob, type Pose } from './game/track';
import { momentDescription, momentTags, momentTitle, whoIs, type MomentContext, type MomentEvent } from './game/moments';
import { closeReplay, closeTrip, isReplayOpen, isTripOpen, openReplay, openTrip, renderFlightLog, setOutsideView, setWatchClip, shareMoment } from './ui/flightLog';
import { shareVideo as shareVideoPlain, KillCam } from './ui/killCam';
import { showClipView } from './ui/clipView';
import { checkBtcOrders } from './net/bitcoin';
import { getClip, heartClip, reportClip } from './net/clips';
import { $, cmdr, currentSystem, game, modern, type State } from './core';
import { aim, engineSound, timer, dockingComputer, gimbalHold, dust, explosions, flight, missiles, sharedSpace, npcs, voices, planetPos, player, space, station, sun, SUN_POS } from './scene';
import './style.css';
import { renderControlsCard, showControlsCardOnce, toggleControlsCard } from './ui/manual';
import { newsLine } from './game/newsLines';
import { answerAdvert, boardSeen, initContracts, markInbox, payCommissions, plotCourse, recruiter } from './ui/contracts';
import { booth, closeBooth, cobraIndex, shipIndex, showShip, showroom, updateShowroom } from './ui/showroom';
import { boardShip, checkSignedOver, checkSiteSpec, myLook, showOwnShip } from './ui/shipyard';
import { markDocked } from './ui/money';
import { initSaloon } from './ui/saloon';
import { initMarket, renderMarket } from './ui/market';
import { initStation, renderDocked, resetBoughtHere, showFittings } from './ui/station';
import { setDockTab, updateDockHead } from './ui/places';
import { TRADERS_BY_GOVERNMENT, escortOf, forgetDeliveries, initTraffic, legs, markLaunched, pacing, railsOf, resetTraffic, spawnFalcon, spawnPirates, spawnTrader, startEncounters, updateIdentities, updateLegends, voyageOf } from './flight/traffic';
import { launchSound, remoteVoices, voiceOf } from './flight/sounds';
import { carrier, clearMarshalTimer, disposeCarrier, initMarshals, marshalsStandDown, riftInterference, scheduleMarshals, summonCarrier, updateMarshals } from './flight/marshals';
import { energyBomb, explodeMissile, fireMissile, initMissiles, launchMissile, netMissiles, playerEcm, sightedNpc, toggleLock, updateMissileButton, updateSeekerBox } from './flight/missiles';
import { checkAdrift, drifters, initAdrift, restoreAdrift, spillCargo, spillSpecial, updateCaseRaid, updateDrifters, updateSun } from './flight/adrift';
import { clearanceRefused, distresses, hailTarget, initComms, lockedDown, messageIds, radio, radioMessages, spawnDistress, speakerOf, traderName, updateClearance, updateJob } from './flight/comms';
import { commanderColour, initSharedSpace, toggleSharedSpace, updateSharedButton, updateSharedSpace } from './flight/sharedSpace';
import { announceEvent, checkCombatComputer, flySurvey, hyperspace, inSystemJump, initTravel, stopCombatComputer, stopSurveyPilot, toggleCombatComputer, toggleGalacticJump, toggleHyperspace, toggleSurveyPilot, updateRouteAutopilot, updateTravel } from './flight/travel';
import { HIDDEN_BEYOND, YARD_COLOUR, arrivalNote, bringHome, buildExploreScene, bumpCover, explorerTips, exploring, firstsLine, inClutter, initExplore, myFirsts, showLog, survey, updateExplore } from './flight/explore';
import { becomeFugitive, becomeOffender, canSettle, damagePlayer, dark, darkRefused, destroyNpc, forgetResponses, identified, initLaw, isFugitive, legalLabel, playerHitNpc, rateKill, reportedBy, spawnViper, toggleTransponder, transponderBroken, transponderOnToDock, updateHail, updateResponses, updateStationDefence, PATROLS_BY_GOVERNMENT } from './flight/law';
import { gimbalRide, initCombat, laserDirection, updateCombat } from './flight/combat';
import { npcColour, npcIdentified, updateAimDisplay, updateCombatHud, updateMarkers } from './flight/hud';
import { beaconOpen, breakSurrender, holdForSurrender, initBeacon, sendBeacon, toggleBeacon, toggleSurrender, updateContextButton, updateRadio, updateSurrender } from './flight/beacon';
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

let inSpace = false;


function setState(next: State) {
  if (next !== 'title' && isAccountPanelOpen()) toggleAccountPanel(false);
  if (next !== 'docked' && logOpen) setFlightLog(false);
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
  bankHeld = false;
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
  inSpace = false;
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
let newCommanderArmed = false;

function armNewCommander(saved: Commander) {
  newCommanderArmed = true;
  const b = $('#new-button');
  b.classList.add('armed');
  b.innerHTML = `<span class="key">N again · </span><span class="touch-word">Tap again to </span>delete ${escapeHtml(saved.name)} (${DIFFICULTIES[saved.difficulty].name} · ${saved.credits.toLocaleString()} Cr · ${combatRating(saved.kills)})`;
}

function disarmNewCommander() {
  newCommanderArmed = false;
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
  flightFrom = Date.now();
  tripSeen = true;
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
  inSpace = false;
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
let flightFrom = savedTrip?.from ?? Date.now(); // when this flight began: moments after it are this trip's
let tripSeen = savedTrip?.seen ?? false;
/** This trip's sheet has been seen: dismissed, or the log opened over it. */
function tripDone() {
  setLogBadge(0);
  tripSeen = true;
  keepTrip();
}
function keepTrip() {
  try {
    localStorage.setItem(TRIP_KEY, JSON.stringify({ from: flightFrom, seen: tripSeen }));
  } catch {
    /* storage blocked: the trip lasts as long as the page */
  }
}

/** Badge the Flight log button with what's new, and show this trip's moments if there are any. */
async function showNewMoments(newShip: boolean) {
  if (classicRules()) return setLogBadge(0);
  const fresh = (await listMoments().catch(() => [])).filter((m) => m.created >= flightFrom).length;
  setLogBadge(fresh);
  if (game.state !== 'docked' || isMapOpen()) return;
  if (fresh && !tripSeen)
    void openTrip(flightFrom, {
      onClose: tripDone,
      onLibrary: () => setFlightLog(true),
      onChange: () => logOpen && refreshFlightLog(),
    });
  // The recorder asks once whether to stay on: after a first flight, not before a new commander has flown at all.
  else if (!newShip && recorder.available && !recorderIntroduced()) {
    setFlightLog(true);
    logForIntro = logOpen;
  }
}
/** The flight log opened only to ask about the recorder: answering closes it, back to the station. */
let logForIntro = false;

function setLogBadge(n: number) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.log-button')) b.innerHTML = `<span class="key">F · </span>Flight log${n ? ` · ${n} new` : ''}`;
}

// The flight log belongs to the ship, not the station: it opens full screen,
// a gallery, from the button beside the galaxy map (F).
let logOpen = false;
function setFlightLog(open: boolean) {
  logOpen = open && game.state === 'docked';
  if (!logOpen) logForIntro = false;
  $('#flight-log-view').hidden = !logOpen;
  if (logOpen) {
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


const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// --- Views: look front, rear, left or right while the ship flies on ---------------
// Each view fires the laser on that mount. Classic mounts are fixed, as in
// 1984; Modern rear and side mounts are turrets that hit the nearest ship
// near the middle of the view.

const VIEW_TURN: Record<Mount, number> = { front: 0, rear: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

function setView(next: Mount, glance = false) {
  flight.view = next;
  // The touch view button points where you're looking; its picker marks the view and closes.
  const turn: Record<Mount, number> = { front: 0, right: 90, rear: 180, left: -90 };
  $('#view-button svg').style.transform = `rotate(${turn[flight.view]}deg)`;
  $('#view-button').classList.toggle('away', flight.view !== 'front');
  for (const b of document.querySelectorAll<HTMLButtonElement>('#view-picker [data-view]')) b.classList.toggle('on', b.dataset.view === flight.view);
  if (!glance) showViewPicker(false);
  const label = $('#view-label');
  label.hidden = flight.view === 'front';
  label.textContent = `${flight.view} view`;
  if (flight.view !== 'front' && !glance) {
    const laser = cmdr().lasers[flight.view];
    flash(laser ? `${flight.view} view · ${PLAYER_LASERS[laser].name}` : `${flight.view} view · no ${flight.view} laser fitted`, 1.4);
  }
}

// Tap the scanner to switch its range (R on a keyboard; a phone had no way: Mark).
onTap($('#scanner'), () => flash(`Scanner range ${toggleScannerRange() / 1000} km`, 1.2));

/** The touch view picker: four directions round the view button, one tap each (Mark). */
function showViewPicker(show: boolean) {
  $('#view-picker').hidden = !show;
  $('#view-button').setAttribute('aria-expanded', String(show));
}
// Tap: the four open, to choose a view that stays. Press and hold: they open under your thumb, the
// view follows it onto a direction, and letting go looks ahead again: a glance (Mark).
const GLANCE_HOLD = 220; // ms
let glanceTimer = 0;
let glancing: Mount | null = null; // the view to go back to
const viewButton = $<HTMLButtonElement>('#view-button');
viewButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try {
    viewButton.setPointerCapture(e.pointerId); // keep the press if the thumb slides off
  } catch {
    /* no such pointer (a synthetic event): carry on without */
  }
  glanceTimer = window.setTimeout(() => {
    glancing = flight.view;
    showViewPicker(true);
  }, GLANCE_HOLD);
});
viewButton.addEventListener('pointermove', (e) => {
  if (!glancing) return;
  const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('#view-picker [data-view]');
  const next = (over?.dataset.view as Mount | undefined) ?? glancing;
  if (next !== flight.view) setView(next, true);
});
const endGlance = (tap: boolean) => {
  clearTimeout(glanceTimer);
  viewButton.blur();
  if (glancing) {
    const back = glancing;
    glancing = null;
    setView(back); // let go: eyes front again (or wherever you were)
    return;
  }
  if (tap) showViewPicker($('#view-picker').hidden === true);
};
viewButton.addEventListener('pointerup', () => endGlance(true));
viewButton.addEventListener('pointercancel', () => endGlance(false));
for (const b of document.querySelectorAll<HTMLButtonElement>('#view-picker [data-view]'))
  onTap(b, () => {
    b.blur();
    setView(b.dataset.view as Mount);
  });
// A tap anywhere else closes it.
document.addEventListener('pointerdown', (e) => {
  const t = e.target as Node;
  if (!glancing && !$('#view-picker').hidden && !$('#view-picker').contains(t) && !$('#view-button').contains(t)) showViewPicker(false);
}, true);

/**
 * Steering in a rear or side view (Mark: dragging did nothing there). The drag turns the view you're
 * looking through, as it turns the nose ahead: across, the ship yaws (the same in every view, all
 * turning about her up); up and down, she pitches (the other way, looking back) or rolls (looking aside).
 */
function steerInView(input: FlightInput, dt: number) {
  const k = AIM_SENSITIVITY / Math.max(dt, 1e-3);
  const across = input.aimDx * k; // how fast the view should swing right, radians a second
  const up = -input.aimDy * k; // and tip up
  const rate = (r: number, max: number) => THREE.MathUtils.clamp(r / max, -1, 1);
  input.yaw = rate(across, player.yawRate);
  if (flight.view === 'rear') input.pitch = rate(-up, player.def.stats.pitchRate ?? 1.5);
  else input.roll = rate(flight.view === 'left' ? up : -up, player.def.stats.rollRate ?? 2);
}

/** Which way the current view looks, in the world. */
function viewDirection(): THREE.Vector3 {
  switch (flight.view) {
    case 'rear':
      return player.forward().negate();
    case 'left':
      return player.right().negate();
    case 'right':
      return player.right();
    default:
      return player.forward();
  }
}
let lastAltitudeWarning = -Infinity;
const deathCam = { centre: new THREE.Vector3(), offset: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0), t: 0 };


// Modern rules: near the station and pointing roughly at the slot, the ship
// matches the station's spin by itself whenever the pilot isn't rolling.
// Classic rules leave it all to you, as in 1984.
const ROLL_ASSIST_RANGE = 2500; // metres
const ROLL_ASSIST_HEADING = THREE.MathUtils.degToRad(35);
const ROLL_ASSIST_GAIN = 3; // holds within ~3° of the slot (tested in simulation)
const AUTO_LEVEL_GAIN = 2.5; // levels 50° of tilt in about half a second (tested in simulation)
let rollAssist = false;
/** The pilot rolled with the mouse: hold that bank until they tap to level. */
let bankHeld = false;

function rollAssistApplies() {
  return (
    player.obj.position.distanceTo(station.root.position) < ROLL_ASSIST_RANGE &&
    station.headingError(player) < ROLL_ASSIST_HEADING
  );
}

function setAutopilot(on: boolean, message?: string) {
  flight.autopilot = on;
  if (on) {
    flight.surveyPilot = null;
    dockingComputer.reset();
    danube.start(!isRetro());
  } else {
    danube.stop();
  }
  if (message) flash(message, 2);
}

function hitFeedback(strength: number) {
  flight.shake = Math.max(flight.shake, strength);
  const el = $('#hit');
  el.classList.remove('on');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('on');
}

function updateSpace(dt: number) {
  flight.elapsed += dt;
  station.update(dt);
  updateDrifters(dt);
  updateCaseRaid(dt);
  updateResponses();
  updateStationDefence(dt);
  updateHail();
  updateMissileButton();
  for (let i = explosions.length - 1; i >= 0; i--) if (!explosions[i].update(dt)) explosions.splice(i, 1);
  updateMarshals(dt);

  let input: ReturnType<typeof flightInput> | null = null;
  if (game.state === 'flying') {
    const prev = station.toLocal(player.obj.position);
    input = flightInput();
    if (flight.autopilot && input.active) setAutopilot(false, 'Docking computer off');
    if (flight.surveyPilot && input.active) stopSurveyPilot('Survey autopilot off · you have control');
    checkCombatComputer(input);

    // Mouse aim: steer the nose towards the reticle. Turning with keys or
    // while the computer flies puts the reticle back on the nose.
    const keysTurning = input.pitch !== 0 || input.yaw !== 0;
    if (input.recentre) aim.reset(player);
    if (flight.combatComputer) {
      // The computer flies; the mouse (or aim pad) only aims the guns, relative to the nose.
      aim.move(player, input.aimDx, input.aimDy);
      aim.clamp(player);
      gimbalHold.copy(aim.dir).applyQuaternion(player.obj.quaternion.clone().invert());
    } else if (controlScheme() === 'mouse' && isMouseCaptured() && !flight.autopilot && !flight.surveyPilot && !keysTurning && flight.view === 'front') {
      aim.move(player, input.aimDx, input.aimDy);
      const s = aim.steer(player);
      input.pitch = s.pitch;
      input.yaw = s.yaw;
    } else if (flight.view !== 'front' && controlScheme() === 'mouse' && (isMouseCaptured() || isTouch) && !flight.autopilot && !flight.surveyPilot && !keysTurning) {
      aim.reset(player);
      steerInView(input, dt);
    } else {
      aim.reset(player);
    }

    // A roll you make (mouse or keys) holds its bank until you tap to level: the flight
    // assist mustn't undo it the moment you let go (a Stardot pilot found the keys "obstinate").
    if (input.mouseRoll || input.roll !== 0) bankHeld = true;
    if (input.level) bankHeld = false;
    rollAssist = !flight.autopilot && !flight.surveyPilot && !flight.combatComputer && cmdr().difficulty === 'modern' && input.roll === 0 && rollAssistApplies();
    if (rollAssist) {
      input.roll = THREE.MathUtils.clamp(-ROLL_ASSIST_GAIN * station.rollError(player), -1, 1);
    } else if (!flight.autopilot && !flight.surveyPilot && !flight.combatComputer && controlScheme() === 'mouse' && input.roll === 0 && !bankHeld) {
      // Flight assist: with no roll input, level the wings with the star
      // system's "up" so there's always a horizon. Weaker when pointing
      // steeply up or down, where "level" stops meaning much.
      const steep = Math.abs(player.forward().y);
      input.roll = THREE.MathUtils.clamp(AUTO_LEVEL_GAIN * player.right().y * (1 - steep), -1, 1);
    }
    if (flight.autopilot) dockingComputer.update(dt, player, station);
    else if (flight.combatComputer) {
      const hit = flight.lastHitBy && npcs.includes(flight.lastHitBy.npc) ? flight.lastHitBy : null;
      const status = { heat: Math.min(1, flight.laserHeat / 100), hitBy: hit?.npc ?? null, hitAgo: hit ? flight.elapsed - hit.at : Infinity };
      if (!flight.combatComputer.fly(dt, player, npcs, flight.locked, { centre: planetPos, radius: flight.planetRadius }, status)) stopCombatComputer('No hostiles · combat computer standing down · you have control');
      else if (flight.combatComputer.announce) {
        flash(`Combat computer · ${flight.combatComputer.announce}`, 1.8);
        flight.combatComputer.announce = null;
      }
    } else if (flight.surveyPilot) flySurvey(dt, flight.surveyPilot);
    else {
      holdForSurrender(input);
      player.steer(dt, input);
    }
    player.move(dt);
    if (flight.combatComputer) gimbalRide(dt);
    player.recharge(dt, isWorking(cmdr(), 'extra-energy') ? 2 : 1);

    if (updateSun(dt)) {
      sfx.thud();
      die();
      return;
    }
    const altitude = player.obj.position.distanceTo(planetPos) - flight.planetRadius;
    if (altitude < 0 || updateExplore(dt)) {
      sfx.thud();
      die();
      return;
    }
    if (altitude < flight.planetRadius * 0.12 && flight.elapsed - lastAltitudeWarning > 4) {
      lastAltitudeWarning = flight.elapsed;
      sfx.beep();
      flash('Altitude warning', 1.5);
    }

    const wreck = bumpCover(player.obj.position, 20);
    if (wreck) {
      sfx.thud();
      const damage = 10 + player.speed * 0.15;
      player.speed *= 0.2;
      if (damagePlayer(damage)) {
        die();
        return;
      }
      hitFeedback(0.8);
      flash(`Hull impact · ${wreck}`, 1.2);
    }

    // The yard: the constructor is as solid as a moon, the rest bounces you off.
    const bumped = flight.yardScene?.contact(player.obj.position, player.speed);
    if (bumped?.kind === 'crash') {
      sfx.thud();
      hitFeedback(1);
      flash(`Collision with the ${bumped.what}`, 3);
      die();
      return;
    }
    if (bumped) {
      sfx.thud();
      player.speed *= 0.2;
      if (damagePlayer(bumped.damage)) {
        die();
        return;
      }
      hitFeedback(0.8);
      flash(`Hull impact · ${bumped.what}`, 1.2);
    }

    const contact = station.contact(player, prev, cmdr().difficulty === 'classic');
    if (contact?.kind === 'docked' && lockedDown()) {
      station.turnAway(player);
      sfx.thud();
      setAutopilot(false);
      flash('Docking refused · station in lockdown · containment breach', 3);
    } else if (contact?.kind === 'docked' && darkRefused()) {
      station.turnAway(player);
      sfx.thud();
      setAutopilot(false);
      flash('Docking refused · unidentified ship · switch on your transponder (0)', 3);
    } else if (contact?.kind === 'docked' && clearanceRefused()) {
      station.turnAway(player);
      sfx.thud();
      setAutopilot(false);
      flash('Docking refused · Fugitive · U to surrender', 3);
    } else if (contact?.kind === 'docked') {
      void dock();
    } else if (contact) {
      if (contact.kind === 'scrape') sfx.scrape();
      else sfx.thud();
      if (cmdr().difficulty === 'classic' || damagePlayer(contact.damage)) {
        die();
      } else {
        hitFeedback(0.8);
        flash(contact.kind === 'scrape' ? 'Slot impact' : 'Hull impact', 1.2);
      }
    }
  }

  updateCombat(dt, input);
  updateSharedSpace(dt, input);
  if (game.state === 'flying' || game.state === 'dead') recordTrack();
  // A cue ends with its moment: the Falcon gone (jumped, driven off), the Marshals gone.
  if (music.playing === 'falcon' && !npcs.some((n) => n.def.id === 'falcon')) music.stop('falcon');
  if (music.playing === 'marshals' && !carrier) music.stop('marshals');
  if (game.state === 'flying') {
    updateClearance();
    updateSurrender(dt);
    updateRouteAutopilot();
    updateIdentities();
    updateLegends(dt);
    updateRadio(dt);
  }
  if (flight.stationFlash > 0) {
    flight.stationFlash = Math.max(0, flight.stationFlash - dt);
    heatShip(station.model, flight.stationFlash / 0.25);
  }

  if (game.state === 'dead') {
    // Watch the wreck from outside, slowly circling, as the original did.
    deathCam.t += dt;
    const orbit = deathCam.offset.clone().applyAxisAngle(deathCam.axis, deathCam.t * 0.25);
    camera.position.copy(deathCam.centre).add(orbit);
    camera.lookAt(deathCam.centre);
  } else {
    camera.position.copy(player.obj.position);
    camera.quaternion.copy(player.obj.quaternion).multiply(FLIP);
    if (flight.view !== 'front') camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), VIEW_TURN[flight.view]));
    if (flight.shake > 0.01) {
      camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(flight.shake * 2.5));
      flight.shake *= Math.exp(-dt * 6);
    }
  }
  space.stars.position.copy(camera.position);
  camera.updateMatrixWorld();
  setListener(camera);
  dust.update(camera.position, game.state === 'flying' ? player.forward().multiplyScalar(player.speed) : new THREE.Vector3());

  const sighted = game.state === 'flying' ? sightedNpc() : null;
  // In a wreck field your scanner is cluttered too: far contacts drop off it.
  const cluttered = game.state === 'flying' && exploring() && inClutter(player.obj.position);
  const blips: Blip[] = [
    { position: station.root.position, color: '#ffb347', kind: 'station' },
    ...npcs
      .filter((p) => !cluttered || p.obj.position.distanceTo(player.obj.position) < HIDDEN_BEYOND)
      .map((p): Blip => ({ position: p.obj.position, color: npcColour(p), kind: 'ship', sighted: p === sighted, locked: p === flight.locked })),
    ...drifters.map((d): Blip => ({ position: d.model.root.position, color: '#ffd166', kind: 'cargo' })),
    ...missiles.map((m): Blip => ({ position: m.position, color: '#ff6b6b', kind: 'missile' })),
  ];
  if (carrier?.rift) blips.push({ position: carrier.rift.group.position, color: '#cfe0ff', kind: 'station' });
  if (flight.yardScene) {
    blips.push({ position: flight.yardScene.centre, color: YARD_COLOUR, kind: 'station' });
    for (const h of flight.yardScene.haulers) blips.push({ position: h.root.position, color: YARD_COLOUR, kind: 'ship' });
  }
  for (const r of sharedSpace.remotes.values()) blips.push({ position: r.position, color: commanderColour(r), kind: 'commander', locked: r === flight.lockedCommander });
  for (const n of netMissiles.values()) blips.push({ position: n.missile.position, color: '#ff6b6b', kind: 'missile' });
  // Near a rift, contacts jitter about on the scanner.
  const noise = game.state === 'flying' ? riftInterference() : 0;
  if (noise > 0) for (const b of blips) b.position = b.position.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(noise * 600 * Math.random()));
  setInterference(noise);
  updateSeekerBox();
  if (game.state === 'flying') {
    updateHud(player, station, blips, flight.autopilot || Boolean(flight.combatComputer), rollAssist);
    updateTouch(dt, player.speed / player.maxSpeed);
    updateAimDisplay();
    updateCombatHud();
    updateJob(dt);
    updateTravel(dt);
    updateMarkers();
    const turn = Math.abs(player.pitchGauge) + Math.abs(player.yawGauge) + Math.abs(player.rollGauge) * 0.6;
    engineSound.update(player.speed / player.maxSpeed, Math.min(1, turn / 1.2), dt);
  }
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

async function launch() {
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
  inSpace = true;
  closeDrawer(); // a clean screen to fly from
  sharedSpace.resume(); // launching here means flying here, even if another window had the ship
  player.repair();
  station.placeForLaunch(player);
  markLaunched();
  flightFrom = Date.now();
  tripSeen = false;
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
    if (logOpen || isTripOpen() || !$('#handover').hidden) return void setTimeout(offer, 1500);
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

// --- The kill cam's track (docs/design/kill-cam.md) ---------------------------
// The last minute of every ship your scanner saw, 20 times a second, and every
// shot and explosion, kept with the black box when you die so the insurers'
// screen can rebuild the fight from outside. Only what your ship knew.

const track = new TrackRecorder();
const trackIds = new WeakMap<object, number>();
let nextTrackId = 2; // 1 is you
const TRACK_RANGE = 12000; // metres: the scanner's long range

function trackId(o: object): number {
  if (o === player) return 1;
  let id = trackIds.get(o);
  if (id === undefined) {
    id = nextTrackId++;
    if (nextTrackId > 0x7fff) nextTrackId = 2;
    trackIds.set(o, id);
  }
  return id;
}

const poseOf = (id: number, obj: THREE.Object3D, unknown = false): Pose => ({ id, p: obj.position.toArray(), q: obj.quaternion.toArray() as Pose['q'], ...(unknown ? { unknown } : {}) });

function recordTrack() {
  if (classicRules() || !track.due(flight.elapsed)) return;
  const here = player.obj.position;
  const poses: Pose[] = [];
  if (game.state === 'flying') {
    track.ship({ id: 1, def: player.def.id, role: 'you', label: whoIs({ callsign: shareName() }), ...(myLook() ? { look: myLook()! } : {}) });
    poses.push(poseOf(1, player.obj));
  }
  for (const npc of npcs) {
    if (npc.obj.position.distanceTo(here) > TRACK_RANGE) continue;
    const id = trackId(npc);
    track.ship({ id, def: npc.def.id, role: npc.role, label: `${npc.def.name} · ${npc.role}${npc.bounty ? ` · ${npc.bounty} Cr` : ''}` });
    poses.push(poseOf(id, npc.obj, npc.dark && !npcIdentified(npc)));
  }
  for (const m of missiles) {
    if (m.position.distanceTo(here) > TRACK_RANGE) continue;
    const id = trackId(m);
    track.ship({ id, def: 'missile', role: 'missile', label: 'Missile' });
    poses.push(poseOf(id, m.model.root));
  }
  if (station.root.position.distanceTo(here) < TRACK_RANGE) {
    const id = trackId(station);
    track.ship({ id, def: 'coriolis', role: 'station', label: `${currentSystem().name} station` });
    poses.push(poseOf(id, station.root));
  }
  track.sample(flight.elapsed, poses);
}

function trackBeam(from: object, a: THREE.Vector3, b: THREE.Vector3, color: string, hit: object | null) {
  if (classicRules()) return;
  track.event({ t: flight.elapsed, kind: 'beam', from: trackId(from), a: a.toArray(), b: b.toArray(), color, ...(hit ? { hit: trackId(hit) } : {}) });
}

function trackBoom(npc: NpcShip) {
  if (!classicRules()) track.event({ t: flight.elapsed, kind: 'boom', id: trackId(npc), p: npc.obj.position.toArray() });
}

function trackScene() {
  const sys = currentSystem();
  return { system: sys.name, when: Date.now(), you: 1, planet: { p: planetPos.toArray(), r: flight.planetRadius, color: planetColour(sys) }, sun: SUN_POS.toArray() };
}

function die() {
  const c = cmdr();
  // The black box: the last seconds, and the ship going up, for the insurers' screen.
  const killer = flight.lastHitBy && flight.elapsed - flight.lastHitBy.at < 5 ? flight.lastHitBy.npc : null;
  // Who did it, when someone did: a death worth watching from outside (ui/flightLog.ts worthWatching).
  const blackBox = keepCombat({ kind: 'death', text: `Ship destroyed at ${currentSystem().name}`, ...(killer ? { subject: killer.def.name } : {}) }, 26, 4);
  track.event({ t: flight.elapsed, kind: 'boom', id: trackId(player), p: player.obj.position.toArray() });
  track.event({ t: flight.elapsed, kind: 'death', ...(killer ? { by: trackId(killer) } : {}) });
  // The kill cam: the black box keeps the fight's track as every clip does
  // (logMoment); once it's kept, the old fight is over.
  void blackBox.then(() => track.clear());
  setView('front');
  setAutopilot(false);
  setState('dead');
  sfx.explosion();
  hitFeedback(1.5);

  const velocity = player.forward().multiplyScalar(player.speed);
  // It goes up in its own paint.
  const look = myLook();
  const boom = new Explosion(look ? { ...player.def, style: { ...player.def.style, lineColor: look.colour } } : player.def, player.obj, velocity);
  space.scene.add(boom.group);
  explosions.push(boom);
  // Whatever was in the hold is now floating free for anyone with fuel scoops.
  spillCargo(player.obj.position, velocity, c.cargo);
  c.cargo = {};
  // A company's special cargo is built to survive: it holds station here, beaconing.
  if (c.difficulty === 'modern') {
    const p = player.obj.position;
    const nearStation = p.distanceTo(station.root.position) < STATION_CREW_RANGE;
    for (const k of setAdrift(c, currentSystem(), [p.x, p.y, p.z], Date.now(), nearStation)) if (!k.held) spillSpecial(k);
  }
  c.stolen = {};
  // Classic, as in 1984: a new ship is a clean slate and the police lose
  // interest. Under Modern rules your record stands (see claimInsurance).
  if (c.difficulty === 'classic') {
    c.records = {};
    c.warrant = false;
  }
  flight.surrenderTimer = null;
  flight.laserHeat = 0;
  flight.overheated = false;

  deathCam.centre.copy(player.obj.position).addScaledVector(velocity, 0.6);
  // Watch from the side away from the nearest big body, so it never blocks the view.
  const fromStation = deathCam.centre.distanceTo(station.root.position);
  const fromPlanet = deathCam.centre.distanceTo(planetPos) - flight.planetRadius;
  const away = deathCam.centre.clone().sub(fromPlanet < fromStation ? planetPos : station.root.position);
  if (away.lengthSq() < 1) away.copy(player.up());
  away.normalize();
  deathCam.axis.copy(away);
  deathCam.offset.copy(away).multiplyScalar(280).addScaledVector(new THREE.Vector3().randomDirection().cross(away).normalize(), 110);
  deathCam.t = 0;
  player.speed = 0;

  const classic = c.difficulty === 'classic';
  const pod = hasEquipment(c, 'escape-pod');
  const gameOver = classic && !pod;
  setTimeout(() => flash(gameOver ? 'GAME OVER' : pod ? 'Escape pod launched' : 'Ship destroyed', 0), 1200);

  setTimeout(() => {
    clearFlash();
    if (gameOver) {
      deleteCommander();
      game.commander = null;
      showTitle();
      return;
    }
    let message: string;
    if (classic) {
      removeEquipment(c, 'escape-pod');
      message = 'Picked up. Your insurers have replaced the ship.';
    } else {
      const lost = loseContracts(c);
      const adrift = (c.adrift ?? [])
        .filter((k) => Date.now() - k.lost < 10_000)
        .map((k) => (k.held ? `The ${k.label} survived: the station crew picked it up` : `The ${k.label} survived: it's adrift, beaconing. Recover it within 24 hours`));
      // You wake at this system's station: if its crew picked your case up, it's handed back here.
      const returned = collectHeld(c, currentSystem());
      if (lost.length || adrift.length || returned.length) setTimeout(() => flash([...lost, ...(returned.length ? returned : adrift)].join(' · '), 6), 5500);
      const claim = claimInsurance(c);
      if (claim.kind === 'void') {
        message = `Insurance void: you were a Fugitive · ${hullOf(c) === 'cobra-mk3' && player.def.id !== 'cobra-mk3' ? `your ${player.def.name} is gone, and ` : ''}the Co-operative has issued you a bare Cobra`;
        if (claim.stake) message += ` and ${claim.stake.toLocaleString()} Cr to start again`;
        message += ' · settle with the law before you launch';
      } else {
        message = `${claim.pod ? 'Picked up. ' : ''}Insurance paid out${hullOf(c) !== 'cobra-mk3' ? ` · a new ${shipById(hullOf(c))?.name ?? 'ship'}${c.paint?.name ? ` “${c.paint.name}”` : ''}, as you had her` : ''} · excess ${claim.paid.toLocaleString()} Cr`;
        if (claim.paid < claim.excess) message += ` (the rest written off)`;
      }
    }
    // Bitcoin isn't in the hold: the keys were in your head.
    if (c.sats) setTimeout(() => flash('Your Bitcoin is safe: the keys were in your head', 4), 11_000);
    saveCommander(c);
    marshalsStandDown();
    enterDocked(true); // a new ship from the insurers
    flash(message, 5);
    void blackBox.then((m) => m && game.state === 'docked' && openReplay(m, 'Flight recorder recovered', refreshFlightLog, recorderIntroduced() ? undefined : RECORDER_INTRO));
  }, 5000);
}

// --- Photos -----------------------------------------------------------------


/** P: copy the frame just drawn, with a shutter flash, into the flight log (or saved or shared, where there's no log). */
function snapPhoto() {
  const canvas = $<HTMLCanvasElement>(isRetro() ? '#retro' : '#neo');
  const shot = takePhoto(canvas, isRetro());
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
    news: newsLine,
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
    if (logOpen) setFlightLog(false);
    toggleGalaxyMap();
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
        if (saved && !newCommanderArmed) armNewCommander(saved);
        else showNewGame();
      } else if (code === 'KeyS') {
        toggleSharedSpace();
      } else if (code === 'KeyA' || (code === 'Escape' && isAccountPanelOpen())) {
        toggleAccountPanel();
      }
      if (code !== 'KeyN' && newCommanderArmed) disarmNewCommander();
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
      } else if (code === 'KeyF' || (code === 'Escape' && logOpen)) setFlightLog(!logOpen);
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
      } else if (code === 'KeyU') {
        toggleSurrender();
      } else if (code === 'KeyT') {
        toggleLock();
      } else if (code === 'KeyX') {
        fireMissile();
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
        flash(s === 'mouse' ? 'Mouse + keyboard · click to aim' : 'Keyboard only (classic)', 2);
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

// --- The flight recorder (docs/design/flight-recorder.md) --------------------
// The ship's black box: the last minute of the view, always, in memory.
// Moments worth keeping go to the flight log on this device; nothing leaves it
// unless the commander shares it.

const RECORDER_KEY = 'witchspace-recorder';
/** Classic stays as 1984 had it: no recorder (photos still work). */
const classicRules = () => !!game.commander && cmdr().difficulty !== 'modern';
const recorderOn = () => {
  if (classicRules()) return false;
  try {
    return localStorage.getItem(RECORDER_KEY) !== 'off';
  } catch {
    return true;
  }
};
interface MomentMeta {
  events: MomentEvent[];
  ctx: MomentContext;
}
const recorder = new FlightRecorder<MomentMeta>(recorderOn);
const recorderWatch = new RecorderWatch();
const LEGENDS = new Set(['falcon']);

/** Whether anything is about worth recording: what the game knows is there, not just what the scanner shows. */
function watchSurroundings(dt: number) {
  const ships = [
    ...npcs.map((n) => n.obj.position),
    ...missiles.map((m) => m.position),
    ...[...sharedSpace.remotes.values()].map((r) => r.position),
    ...(flight.yardScene ? [flight.yardScene.centre] : []),
  ];
  recorderWatch.update(
    {
      me: player.obj.position,
      ships,
      legends: npcs.filter((n) => LEGENDS.has(n.def.id)).length,
      station: station.root.position,
      planet: flight.planet ? { position: planetPos, radius: flight.planetRadius } : null,
      rift: Boolean(carrier?.rift),
    },
    dt,
  );
}
const viewCanvas = () => $<HTMLCanvasElement>(isRetro() ? '#retro' : '#neo');

/**
 * The name what you share carries: your account's callsign, signed in. A guest shares as "A commander",
 * as the site already titles them (Mark: "if they are flying as Jameson they are not signed in" — CMDR
 * Jameson is his); the share sheet offers to claim a callsign by email while it's free.
 */
const shareName = (): string | null => (signedIn() && currentAccount()?.callsign) || null;

function momentContext(): MomentContext | null {
  if (!game.commander) return null;
  const c = cmdr();
  const sys = currentSystem();
  return { callsign: shareName(), system: sys.name, galaxy: sys.galaxy + 1, government: GOVERNMENTS[sys.government], rank: combatRating(c.kills), when: Date.now() };
}

// --- Trade moments (game/tradeMoments.ts, Mark) --------------------------------
// A run worth boasting of, and an order that filled while you were away, kept in
// the flight log like a kill, with a share button. A run's clip is the docking
// at the station you sold at (the recorder still holds the approach); without
// one, or for an order filled elsewhere, a photo of where you are.

/** The trip's best run so far: only a better one is kept. */
let tripBest = { trip: 0, profit: 0 };

/** Look through the ledger's new sales for moments worth keeping. Returns whether anything was looked at (save it). */
function noticeTrades(): boolean {
  const c = cmdr();
  if (classicRules() || game.state !== 'docked') return false;
  const l = ledgerOf(c);
  const from = newSince(l.entries, c.tradeSeen);
  const last = seenNow(l.entries);
  if (last === c.tradeSeen) return false;
  c.tradeSeen = last;
  const here = currentSystem();
  for (let i = from; i < l.entries.length; i++) {
    const r = runOf(l.entries, i);
    const profit = r && profitOf(r);
    if (!r || profit === null || profit <= 0) continue;
    const at = systemAt(r.at[0], r.at[1]);
    if (at.galaxy !== here.galaxy || at.index !== here.index) {
      void keepTrade(filledLine(at.name, here.name), profit, false);
      continue;
    }
    if (!isRun(r) || (tripBest.trip === flightFrom && profit <= tripBest.profit)) continue;
    tripBest = { trip: flightFrom, profit };
    const ev = activeEvent(here, Date.now());
    const wanted = ev && (EVENT_KINDS[ev.type].effects[r.good as keyof (typeof EVENT_KINDS)[typeof ev.type]['effects']] ?? 0) < 0;
    void keepTrade(runLine(commodityById(r.good)?.name ?? r.good, wanted ? EVENT_KINDS[ev.type].name : null), profit, true);
  }
  return true;
}

async function keepTrade(subject: string, credits: number, docking: boolean) {
  const event: MomentEvent = { kind: 'trade', text: `${subject}: +${Math.round(credits).toLocaleString('en-GB')} Cr`, subject, credits };
  let m = docking ? await keepMoment(event, 14, 0) : null;
  const ctx = momentContext();
  if (!m && ctx) {
    const photo = await takePhoto($<HTMLCanvasElement>(isRetro() ? '#retro' : '#neo'), isRetro());
    if (photo) m = await logMoment({ events: [event], ctx }, { photo, poster: null, seconds: 0 });
  }
  if (!m) return;
  flash(`${event.text} · in your flight log`, 3.5);
  if (game.state === 'docked') refreshFlightLog();
}

/** Write a clip or photo into the flight log. Resolves with the logged moment, or null if there was no room. */
async function logMoment({ events, ctx }: MomentMeta, media: Pick<LoggedMoment, 'video' | 'photo' | 'poster' | 'seconds'>): Promise<LoggedMoment | null> {
  const m: LoggedMoment = {
    id: `${ctx.when}-${Math.random().toString(36).slice(2, 8)}`,
    created: ctx.when,
    title: momentTitle(events, ctx),
    description: momentDescription(events, ctx),
    tags: momentTags(events, ctx),
    events,
    system: ctx.system,
    ...media,
    saved: false,
    trip: flightFrom,
  };
  if (!(await addMoment(m))) {
    flash('Your moments are full · let one go, or unstar one, in the flight log', 3);
    return null;
  }
  // Every clip keeps its fight's track (the last minute, as numbers), so any
  // moment can be watched from outside and filmed upright, not only a death.
  // A trade moment's clip is a docking, not a fight: no track (its page would title it as a fight).
  const data = media.video && !classicRules() && !events.every((e) => e.kind === 'trade') ? track.snapshot(trackScene()) : null;
  if (data) {
    m.track = await trackBlob(data);
    await attachTrack(m.id, m.track).catch(() => undefined);
  }
  return m;
}

// Moments that land together share one clip: each clip is logged once, whoever asked for it.
const logged = new WeakMap<Clip<MomentMeta>, Promise<LoggedMoment | null>>();
const sameEvents = (a: MomentMeta, b: MomentMeta): MomentMeta => ({ events: [...a.events, ...b.events.filter((e) => !a.events.includes(e))], ctx: a.ctx });

/** Keep the seconds around now in the flight log. Resolves with the logged moment (or null: no recorder, or nothing to keep). */
function keepMoment(event: MomentEvent, before: number, after: number, events: MomentEvent[] = [event]): Promise<LoggedMoment | null> {
  const ctx = momentContext();
  if (!ctx) return Promise.resolve(null);
  return recorder.keep({ events, ctx }, before, after, sameEvents).then((clip) => {
    if (!clip) return null;
    let m = logged.get(clip);
    if (!m) {
      m = logMoment(clip.meta, { video: clip.video, poster: clip.poster, seconds: clip.seconds });
      logged.set(clip, m);
      void m.then((x) => x && introduceRecorder(x));
    }
    return m;
  });
}

// A fight is one clip, not one per kill: each kill (and a death) within
// FIGHT_GAP seconds of the last re-cuts the fight's clip from its start, up to
// a minute, and the earlier cut is replaced.
const FIGHT_GAP = 25;
const FIGHT_MAX = 60;
let combatClip: { start: number; last: number; events: MomentEvent[]; moment: Promise<LoggedMoment | null> } | null = null;

function keepCombat(event: MomentEvent, before: number, after: number): Promise<LoggedMoment | null> {
  const t = recorder.time;
  if (!combatClip || t - combatClip.last > FIGHT_GAP || t + after - combatClip.start > FIGHT_MAX) combatClip = { start: t - before, last: t, events: [], moment: Promise.resolve(null) };
  const f = combatClip;
  f.events.push(event);
  f.last = t;
  const earlier = f.moment;
  f.moment = keepMoment(event, Math.max(before, t - f.start), after, [...f.events]);
  void Promise.all([earlier, f.moment]).then(async ([old, now]) => {
    if (old && now && old.id !== now.id) {
      await deleteMoment(old.id);
      if (game.state === 'docked') refreshFlightLog();
    }
  });
  return f.moment;
}

// The first time a moment is kept, say what the flight recorder is; the
// flight log asks once whether to keep it on.
const RECORDER_INTRO_KEY = 'witchspace-recorder-intro';
const RECORDER_INTRO = "Your ship keeps your best moments. Share one, star it, or let it go: they're in the flight log.";
const recorderIntroduced = () => {
  try {
    return localStorage.getItem(RECORDER_INTRO_KEY) === 'done';
  } catch {
    return true;
  }
};
let introFlashed = false;
function introduceRecorder(m: LoggedMoment) {
  if (introFlashed || recorderIntroduced() || game.state !== 'flying' || m.events.some((e) => e.kind === 'death')) return;
  introFlashed = true;
  setTimeout(() => flash('Flight recorder kept that · watch it in the flight log when you dock · Shift+P keeps any moment', 5), 2600);
}

function refreshFlightLog() {
  void renderFlightLog({
    available: recorder.available && !classicRules(),
    unavailable: classicRules() ? 'Classic rules, as in 1984: no flight recorder.' : `This browser can't record video, so there's no flight recorder here${recorder.why ? ` (${recorder.why})` : ''}.`,
    enabled: recorderOn(),
    intro: !recorderIntroduced(),
    quality: { hd: recorder.quality === 'hd', canRetry: !recorder.hdUnsupported, retry: () => recorder.tryHd() },
    onToggle: (on = !recorderOn()) => {
      try {
        localStorage.setItem(RECORDER_KEY, on ? 'on' : 'off');
        localStorage.setItem(RECORDER_INTRO_KEY, 'done');
      } catch {
        /* storage blocked: stays as it is */
      }
      if (logForIntro) {
        logForIntro = false;
        setFlightLog(false);
        flash(on ? 'Flight recorder on · your best moments wait in the flight log (F)' : 'Flight recorder off · turn it on again in the flight log (F)', 3);
        return;
      }
      refreshFlightLog();
    },
  });
}
void recorder.ready.then(() => game.state === 'docked' && refreshFlightLog());

/** Shift+P, or holding the camera button: keep the last 30 seconds yourself. */
function keepByHand() {
  if (game.state !== 'flying') return;
  if (classicRules()) return flash('Classic rules: no flight recorder', 2);
  if (!recorder.available || !recorderOn()) return flash(recorder.available ? 'Flight recorder is off · turn it on in the flight log' : `This browser can't record video${recorder.why ? ` · ${recorder.why}` : ''}`, 4);
  flash('Flight recorder · last 30 seconds kept', 2);
  sfx.shutter();
  void keepMoment({ kind: 'kept', text: 'Kept by hand' }, 30, 0);
}

// The camera button: tap for a photo, hold for the last 30 seconds.
{
  const cam = $<HTMLButtonElement>('#photo-button');
  let held = 0;
  let long = false;
  cam.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    long = false;
    held = window.setTimeout(() => {
      long = true;
      keepByHand();
    }, 600);
  });
  const release = () => {
    clearTimeout(held);
    if (!long && held) handleKey('KeyP');
    held = 0;
  };
  cam.addEventListener('pointerup', release);
  cam.addEventListener('pointercancel', () => {
    clearTimeout(held);
    held = 0;
  });
}

// --- The kill cam (docs/design/kill-cam.md) -----------------------------------

const killCam = new KillCam(camera);
if (import.meta.env.DEV) Object.assign(window, { __kc: killCam });
// A saved reconstruction goes into the flight log, like any moment.
// Of your own fight, it keeps the track, so sharing it can put up a page that plays this very video (Mark: the sharer decides).
let lastRecon: LoggedMoment | null = null;
killCam.onVideo = async (v) => {
  const when = Date.now();
  const m: LoggedMoment = { id: `${when}-recon`, created: when, title: v.title, description: v.description, tags: ['witchspace', 'reconstruction', 'killcam'], events: [], system: v.system, seconds: v.seconds, video: v.video, poster: v.poster, saved: false, ...(v.track ? { track: await trackBlob(v.track) } : {}) };
  lastRecon = (await addMoment(m)) ? m : null;
  if (game.state === 'docked') refreshFlightLog();
};
// Sharing it shares that moment, with its page when it's your own fight.
killCam.onShare = (v) => (lastRecon && lastRecon.video === v.video ? shareMoment(lastRecon) : shareVideoPlain(v));
setOutsideView(async (m) => {
  const data = m.track ? await readTrack(m.track).catch(() => null) : null;
  if (!data) return flash("This reconstruction is from an older version of the game and can't be rebuilt", 3);
  document.querySelector<HTMLVideoElement>('#replay video')?.pause();
  // Its ✕ means done: back to the game, not to the replay underneath (Mark: "closing it didn't close it").
  killCam.open(data, { seconds: m.seconds, title: m.title, onClose: () => closeReplay() });
});

// --- Main loop --------------------------------------------------------------

timer.connect(document);

// The battery (Mark: his phone went flat much quicker): never more than 60 frames a second, even on
// a 120 Hz screen, and docked behind a screen that covers the hangar, a few a second.
const MIN_FRAME = 1000 / 61;
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
  const resting = !inSpace && game.state === 'docked' && !booth && !killCam.active && hangarCovered(t);
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
  if (inSpace) {
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
initRadio();
setDockTab('station');
showTitle();
answerAdvert();

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
