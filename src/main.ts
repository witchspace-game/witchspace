import * as THREE from 'three';
import { track as countEvent } from '@vercel/analytics';
import { cycleSoundMode, danube, music, preloadRecording, sfx, unlockAudio } from './audio/sound';
import { boomAt, EngineSound, setListener, ShipVoice, tailWarning } from './audio/spatial';
import { withLineUp } from './content/moduleFiles';
import { shipById } from './content/ships';
import type { ShipDef } from './content/types';
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
  rollEquipmentDamage,
  rollFragileDamage,
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
  illegalEquipment,
  legalStatus,
  recordCrime,
  scansCargo,
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
  setTouchSpeed,
  toggleControlScheme,
  toggleInvertPitch,
  wantsMouseCapture,
  type FlightInput,
} from './game/input';
import { SENSITIVITY as AIM_SENSITIVITY } from './game/mouseAim';
import { allies, NpcShip } from './game/npc';
import { signedIn, currentAccount } from './net/account';
import { hideCardInvite, showCardInvite } from './ui/cardInvite';
import { claimCallsign, commanderSaved, initAccount, isAccountPanelOpen, titleShown, toggleAccountPanel } from './ui/accountPanel';
import { cleanName } from '../server/src/protocol';
import { think } from './game/ai';
import { combatRating, killPoints, pointsNote, rightOn, type Foe } from './game/rating';
import { EDITIONS } from './content/editions';
import { deliveriesArrived } from './game/shipyard';
import { PLAYER_LASERS, POLICE_LASER, rayHit, type Target } from './game/weapons';
import { PlayerShip } from './game/playerShip';
import { ledgerOf } from './game/ledger';
import { filledLine, isRun, newSince, profitOf, runLine, runOf, seenNow } from './game/tradeMoments';
import { ATMOSPHERE_SCALE, buildPlanet, disposePlanet } from './render/bodies';
import { blinkBeacon, buildBeacon, buildMoon, buildRings, disposeWorldPart, powerDownBeacon } from './render/worlds';
import { cargoName, collect, deliver, destinationOf, forgive, loseContracts, wyWorks } from './game/contracts';
import { checkMessages, collectHeld, STATION_CREW_RANGE, setAdrift, thanksFrom } from './game/assignments';
import { COMPANIES } from './game/companies';
import { advanceTrail, bodiesOf, SIGNAL_REACH, COURIER_POINTS, courierPoiOf, courierRumour, RANK_NEWS, rankReached, trailTip, dataValue, describeWorld, exploreOf, isFound, isSurveyed, poisOf, recordDiscovery, recordSurvey, recordVisit, salvageCargo, SURVEY, trailPoisOf, worldOf, type Poi, type SurveyData } from './game/explore';
import { buildYard } from './render/yard';
import { stageLabel, yardAt, yardsOf } from './game/yards';
import { lineUpFor } from './game/commissions';
import { Explosion } from './render/explosion';
import { camera, isRetro, lens, render, setRetro } from './render/renderer';
import { buildShip, disposeShip, heatShip, UNIDENTIFIED_HEX } from './render/shipModel';
import { stationName } from './galaxy/stationNames';
import { savePhoto, takePhoto } from './ui/photo';
import { clearFlash, flash, setInterference, toggleScannerRange, updateHud, type Blip } from './ui/hud';
import { clearIndicators, showHitDirection, updateIndicators, type Marker } from './ui/indicators';
import { countDevice, countNewCommander } from './net/stats';
import { claimFirsts, firstsIn, loadFirsts } from './net/firsts';
import { closeMap, chooseCursor, focusFind, isMapOpen, moveCursor, openMap, toggleMapMode } from './ui/galaxyMap';
import { distanceLy, galaxy, GOVERNMENTS, systemAt, type StarSystem } from './galaxy/generate';
import { commodityById } from './economy/commodities';
import { marketState, quotes } from './economy/trade';
import { loseDelivery } from './economy/market';
import { activeEvent, EVENT_KINDS, setCausedEvents } from './economy/events';
import { inspectionChance } from './economy/legality';
import { escapeHtml } from './ui/escape';
import { playTunnel } from './ui/tunnel';
import { closeDrawer, initTouch, onTap, updateTouch } from './ui/touch';
import { BEACON_CALLS, beacon, newBeacon, type BeaconCall } from './game/radio';
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
import { aim, beams, dockingComputer, gimbalHold, dust, explosions, HULL_READ, flight, missiles, sharedSpace, npcs, ofRole, voices, planetPos, player, space, station, sun, SUN_POS, SUN_RADIUS, type SceneBody, type ScenePoi } from './scene';
import './style.css';
import { initManual, renderControlsCard, showControlsCardOnce, toggleControlsCard } from './ui/manual';
import { newsLine } from './game/newsLines';
import { answerAdvert, boardSeen, initContracts, markInbox, payCommissions, plotCourse, recruiter } from './ui/contracts';
import { booth, closeBooth, cobraIndex, shipIndex, showShip, showroom, updateShowroom } from './ui/showroom';
import { boardShip, checkSignedOver, checkSiteSpec, myLook, showOwnShip } from './ui/shipyard';
import { markDocked } from './ui/money';
import { initSaloon } from './ui/saloon';
import { initMarket, renderMarket, tradeContext } from './ui/market';
import { initStation, renderDocked, resetBoughtHere, showFittings } from './ui/station';
import { setDockTab, updateDockHead } from './ui/places';
import { FALCON_DISABLES, MAX_PIRATES, PIRATE_CHANCE, TRADERS_BY_GOVERNMENT, alertSecurity, deliveries, escortOf, fightOn, fleeing, forgetDeliveries, initTraffic, legs, markLaunched, pacing, pirateLost, railsOf, removeNpc, resetTraffic, ride, spawnFalcon, spawnPirates, spawnTrader, startEncounters, updateIdentities, updateLegends, updateTraffic, voyageOf } from './flight/traffic';
import { launchSound, laserSound, remoteVoices, shotSound, VOICE_RANGE, voiceOf } from './flight/sounds';
import { EVADE_LASERS, evading, wispShot } from './flight/wisp';
import { bastionDestroyed, carrier, clearMarshalTimer, disposeCarrier, initMarshals, marshalsStandDown, riftInterference, scheduleMarshals, summonCarrier, updateMarshals } from './flight/marshals';
import { energyBomb, explodeMissile, fireMissile, initMissiles, launchMissile, maybeFireNpcMissile, netMissiles, playerEcm, sightedNpc, toggleLock, updateMissileButton, updateMissiles, updateSeekerBox } from './flight/missiles';
import { Drifter, checkAdrift, drifters, initAdrift, restoreAdrift, spillCargo, spillSpecial, updateCaseRaid, updateDrifters, updateSun } from './flight/adrift';
import { CLEARANCE_RANGE, DISTRESS_SHIELDING, FIGHT_RANGE, answerPolice, answerSurrender, arrayNews, arrayOffers, clearanceRefused, distressCall, distresses, hailTarget, hasArray, initComms, lockedDown, messageIds, pirateThreats, radio, radioMessages, spawnDistress, speakerOf, traderColour, traderName, updateClearance, updateDistress, updateJob } from './flight/comms';
import { callsignTag, commanderColour, initSharedSpace, toggleSharedSpace, updateSharedButton, updateSharedSpace } from './flight/sharedSpace';
import { announceEvent, checkCombatComputer, flySurvey, hyperspace, inSystemJump, initTravel, stopCombatComputer, stopSurveyPilot, toggleCombatComputer, toggleGalacticJump, toggleHyperspace, toggleSurveyPilot, updateRouteAutopilot, updateTravel } from './flight/travel';
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
let planet: THREE.Group | null = null;


// --- Police and combat ------------------------------------------------------

const engineSound = new EngineSound();
let tailWarningTimer = 0;
let reinforceTimer = 0;
let stationFlash = 0; // seconds of white-hot glow after being hit
let repopulateTimer = 0;
let thinkTimer = 0;
const MAX_POLICE = 4;
const SCAN_RANGE = 1200; // metres
const SCAN_TIME = 3; // seconds within range for a police scan
let scanned = false; // once per visit to a system
let scanProgress = 0;

const isFugitive = () => Boolean(game.commander) && legalStatus(cmdr()) === 'fugitive';

/** Wanted here, you can pay your way clean at the station rather than launch into the police. */
const canSettle = (c: Commander) => hasLaw(currentSystem()) && legalStatus(c) !== 'clean';

function legalLabel() {
  const c = cmdr();
  const status = legalStatus(c);
  const label = status === 'fugitive' ? 'Fugitive' : status === 'offender' ? 'Offender' : 'Clean';
  if (c.warrant) return `${label} · Marshals warrant`;
  if (!hasLaw(currentSystem())) return `${label} · no law here`;
  return label;
}

function spawnViper(fromSlot: boolean) {
  const i = ofRole('police').length;
  const npc = new NpcShip(shipById('viper')!, 'police', POLICE_LASER, {
    centre: station.root.position.clone(),
    radius: 900 + (i % 3) * 450,
    height: [200, -250, 60][i % 3],
    rate: (i % 2 ? -1 : 1) * 0.14,
    angle: i * 2.1,
  });
  if (fromSlot) {
    station.placeForLaunch(npc.ship);
    npc.ship.speed = 120;
  } else {
    const p = npc.patrol;
    npc.obj.position.set(Math.cos(p.angle) * p.radius, p.height, Math.sin(p.angle) * p.radius).add(p.centre);
    npc.ship.speed = Math.abs(p.rate) * p.radius;
  }
  npc.ecm = Math.random() < 0.6;
  space.scene.add(npc.obj);
  npcs.push(npc);
}

// --- Building a star system -------------------------------------------------------

/** Planet line colour by economy: industrial worlds violet, farm worlds blue-green. */
function planetColour(sys: StarSystem): string {
  return new THREE.Color().setHSL((270 - sys.economy * 17) / 360, 0.75, 0.62).getStyle();
}

/** Police patrols by government: none in anarchies, most in democracies and corporate states. */
const PATROLS_BY_GOVERNMENT = [0, 1, 1, 2, 2, 2, 3, 3];

let builtSystem: StarSystem | null = null;

/** Rebuild the planet, police and debris for a star system. */
function buildSystemScene(sys: StarSystem) {
  builtSystem = sys;
  track.clear(); // a new system: the old fight is over
  if (planet) disposePlanet(planet);
  flight.planetRadius = sys.radius * 1.2;
  flight.atmosphere = flight.planetRadius * ATMOSPHERE_SCALE;
  planetPos.set(0, 0, flight.planetRadius + 9000);
  flight.planetGM = 0.05 * planetPos.z ** 2;
  planet = buildPlanet(flight.planetRadius, planetColour(sys));
  planet.position.copy(planetPos);
  planet.rotation.set(((sys.extraSeed[0] / 255) - 0.5) * 0.8, sys.extraSeed[1] / 40, ((sys.extraSeed[2] / 255) - 0.5) * 0.8);
  space.scene.add(planet);
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
  reinforceTimer = repopulateTimer = 0;
  forgetDeliveries();
  // Some traffic already about, and maybe trouble soon after arrival.
  // Classic: a few traders at random. Modern: the timetable's (syncTraffic).
  resetTraffic();
  if (!modern()) for (let i = 0; i < TRADERS_BY_GOVERNMENT[sys.government] - 1; i++) spawnTrader(true, 5000 + Math.random() * 10000);
  startEncounters();
  scanned = false;
  scanProgress = 0;
  unpinned = hail = null;
  hullChecked = defiedPolice = false;
  buildExploreScene(sys);
  restoreAdrift();
}

/** Make sure the scene matches where the commander is. */
function ensureSystemScene() {
  const here = currentSystem();
  if (builtSystem !== here) buildSystemScene(here);
}

// --- Exploring (game/explore.ts) -----------------------------------------------------
// Rings and moons are drawn for everyone; surveys and signals pay, so they're
// Modern only, like the rest of what we've added to 1984.

let worldParts: THREE.Group[] = [];
let survey: { target: SceneBody; progress: number } | null = null;
const YARD_COLOUR = COMPANIES.wy.colour;
const SIGNAL_DETECT = 6000; // metres: close enough to notice a signal without a survey
const SIGNAL_COLOUR = '#c9b3ff';
const DEAD_HULL = new THREE.Color(0.16, 0.16, 0.17); // no power, no glow
const exploring = () => cmdr().difficulty === 'modern';

function disposeExploreScene() {
  for (const g of worldParts) disposeWorldPart(g);
  for (const p of flight.scenePois) {
    for (const m of p.models) disposeShip(m);
    if (p.beacon) disposeWorldPart(p.beacon);
  }
  worldParts = [];
  flight.scenePois = [];
  flight.sceneBodies = [];
  survey = null;
  flight.yardScene?.dispose();
  flight.yardScene = null;
  $('#survey').hidden = true;
}

function buildExploreScene(sys: StarSystem) {
  disposeExploreScene();
  const w = worldOf(sys);
  const c = game.commander;
  if (w.rings) {
    const rings = buildRings(flight.planetRadius, w.rings, planetColour(sys));
    rings.position.copy(planetPos);
    space.scene.add(rings);
    worldParts.push(rings);
  }
  const bodies = bodiesOf(sys);
  flight.sceneBodies.push({ body: bodies[0], centre: planetPos, radius: flight.planetRadius, range: flight.planetRadius * SURVEY.planet.altitude });
  flight.sceneBodies.push({ body: bodies[1], centre: SUN_POS, radius: SUN_RADIUS, range: SUN_RADIUS * SURVEY.star.altitude });
  w.moons.forEach((m, i) => {
    const radius = m.size * flight.planetRadius;
    let angle = m.angle;
    const at = () => new THREE.Vector3(Math.cos(angle) * Math.cos(m.tilt), Math.sin(m.tilt), Math.sin(angle) * Math.cos(m.tilt)).multiplyScalar(m.orbit * flight.planetRadius).add(planetPos);
    // Keep the station's approach clear.
    if (at().distanceTo(station.root.position) < flight.planetRadius + radius) angle += Math.PI;
    const moon = buildMoon(radius);
    moon.position.copy(at());
    space.scene.add(moon);
    worldParts.push(moon);
    flight.sceneBodies.push({ body: bodies[2 + i], centre: moon.position, radius, range: radius * SURVEY.moon.altitude });
  });
  if (!c || c.difficulty !== 'modern') return;
  // The yard first, so signals can keep clear of it.
  const yard = yardAt(sys, Date.now());
  const quarry = yard && flight.sceneBodies.find((b) => b.body.id === `moon${yard.moon}`);
  if (yard && quarry) {
    const defs = { titan: withLineUp(shipById('titanoboa')!, lineUpFor(yard)), hauler: shipById('bullsnake')!, station: shipById('coriolis')! };
    flight.yardScene = buildYard(space.scene, yard, defs, { centre: quarry.centre, radius: quarry.radius }, station.root.position);
  }
  const planetDone = isSurveyed(c, sys, 'planet');
  const courier = courierPoiOf(c, sys);
  for (const poi of [...poisOf(sys), ...trailPoisOf(c, sys), ...(courier ? [courier] : [])]) {
    const dir = new THREE.Vector3(...poi.direction);
    // Near enough that salvage isn't lost to space, and clear of the moons.
    const position = dir.clone().multiplyScalar(Math.min(poi.distance * flight.planetRadius, 30000)).add(planetPos);
    for (const b of flight.sceneBodies) if (b.body.kind === 'moon' && position.distanceTo(b.centre) < b.radius * 3) position.addScaledVector(dir, b.radius * 4);
    if (flight.yardScene && position.distanceTo(flight.yardScene.centre) < flight.yardScene.radius * 2) position.addScaledVector(dir, flight.yardScene.radius * 3);
    const found = isFound(c, sys, poi.id);
    // A beacon you've found has powered down and drifted off: gone from your sky. (Each commander finds their own.)
    if (found && poi.kind === 'beacon') continue;
    // A trail's later steps are where its clue said: on the scanner from arrival.
    const sp: ScenePoi = { poi, position, revealed: planetDone || found || (poi.trail?.step ?? 0) > 0, models: [], beacon: null };
    if (poi.kind === 'beacon') {
      sp.beacon = buildBeacon();
      sp.beacon.position.copy(position);
      space.scene.add(sp.beacon);
    } else {
      const def = shipById(poi.ship ?? 'sidewinder');
      const hulls = poi.kind === 'wrecks' ? 4 : 1;
      for (let k = 0; def && k < hulls; k++) {
        const model = buildShip(def);
        // Dead ships: dark lines, slowly tumbling.
        for (const l of model.lines) l.material.color.copy(l.base).multiplyScalar(0.08).lerp(DEAD_HULL, 0.6);
        model.root.position.copy(position).add(new THREE.Vector3(Math.sin(k * 2.4), Math.cos(k * 1.7) * 0.5, Math.cos(k * 2.4)).multiplyScalar(k ? 120 + k * 40 : 0));
        model.root.rotation.set(k * 1.1 + poi.direction[0], k * 0.7, poi.direction[2] * 2);
        space.scene.add(model.root);
        sp.models.push(model);
      }
    }
    flight.scenePois.push(sp);
  }
}

/** Surveys under way, signals found, and the moons' surfaces. Returns true if you hit a moon. */
function updateExplore(dt: number): boolean {
  const pos = player.obj.position;
  for (const b of flight.sceneBodies) if (b.body.kind === 'moon' && pos.distanceTo(b.centre) < b.radius) return true;
  flight.yardScene?.update(dt, Date.now());
  for (const p of flight.scenePois) {
    for (const m of p.models) m.root.rotateOnAxis(TUMBLE_AXIS, dt * 0.03);
    if (p.beacon) blinkBeacon(p.beacon, flight.elapsed);
  }
  if (!exploring()) return false;
  const c = cmdr();
  const here = currentSystem();

  // Surveying: hold close to something you haven't surveyed yet.
  const deep = isWorking(c, 'survey-scanner'); // twice the range, half the time
  const near = flight.sceneBodies.find((b) => pos.distanceTo(b.centre) - b.radius < b.range * (deep ? 2 : 1) && !isSurveyed(c, here, b.body.id));
  if (near && survey?.target !== near) survey = { target: near, progress: 0 };
  if (survey) {
    survey.progress = THREE.MathUtils.clamp(survey.progress + (near === survey.target ? dt * (deep ? 2 : 1) : -dt * 0.5), 0, survey.target.body.time);
    if (survey.progress >= survey.target.body.time) {
      const done = survey.target.body;
      const before = exploreOf(c).points;
      recordSurvey(c, here, done);
      noteCardMoment('explore');
      void keepMoment({ kind: 'discovery', text: `Survey complete · ${done.name}`, subject: done.name }, 20, 3);
      noteExplorerRank(before);
      saveCommander(c);
      sfx.beep();
      const grade = done.grade ? ` · ${done.grade === 'Candidate' ? 'terraforming CANDIDATE: Wexley-Yorozu will want this' : done.grade.toLowerCase()}` : '';
      flash(`Survey complete · ${done.name}${grade} · data worth ${dataValue(exploreOf(c).data[exploreOf(c).data.length - 1], here)} Cr here, more further away`, 4);
      survey = null;
      if (done.id === 'planet') {
        const hidden = flight.scenePois.filter((p) => !p.revealed);
        for (const p of hidden) p.revealed = true;
        if (hidden.length) setTimeout(() => game.state === 'flying' && flash(hidden.length === 1 ? 'The survey picked up an unidentified signal' : `The survey picked up ${hidden.length} unidentified signals`, 3), 3800);
      }
    } else if (survey.progress <= 0 && near !== survey.target) survey = null;
  }
  const bar = $('#survey');
  bar.hidden = !survey;
  if (survey) {
    bar.querySelector('.survey-label')!.textContent = `Surveying ${survey.target.body.name} · ${Math.floor((survey.progress / survey.target.body.time) * 100)}%`;
    bar.style.setProperty('--v', String(survey.progress / survey.target.body.time));
  }

  // Signals: noticed close up, and found by flying to them.
  for (const p of flight.scenePois) {
    if (isFound(c, here, p.poi.id)) continue;
    const d = pos.distanceTo(p.position);
    if (!p.revealed && d < SIGNAL_DETECT * (deep ? 4 : 1)) {
      p.revealed = true;
      flash('Unidentified signal nearby', 2.5);
    }
    if (d < SIGNAL_REACH) discover(p);
  }
  return false;
}
const TUMBLE_AXIS = new THREE.Vector3(0.3, 1, 0.2).normalize();

// Wrecks and beacons are solid: they stop lasers, yours and theirs, so you
// can put one between you and a pirate, and they bounce you off.
const BEACON_RADIUS = 22;
function coverTargets<T>(value: T): Target<T>[] {
  const out: Target<T>[] = [];
  for (const p of flight.scenePois) {
    for (const m of p.models) out.push({ value, position: m.root.position, radius: m.radius * 0.8 });
    if (p.beacon) out.push({ value, position: p.beacon.position, radius: BEACON_RADIUS });
  }
  return out;
}

// Hiding in the clutter (docs/design/exploration.md): in a wreck field you're
// lost to ships beyond a short range, unless you've just fired. Your scanner
// is cluttered the same way.
const CLUTTER_RADIUS = 700; // metres round a wreck field's centre
const HIDDEN_BEYOND = 1500; // metres
const HIDDEN_BEYOND_DARK = 600; // metres, transponder off
const SHOT_GIVES_AWAY = 3; // seconds after firing that everyone can see you
let wasInClutter = false;

function inClutter(pos: THREE.Vector3) {
  return flight.scenePois.some((p) => p.poi.kind === 'wrecks' && p.position.distanceTo(pos) < CLUTTER_RADIUS);
}
/** Whether a ship at this distance can pick the player out. */
function playerVisibleAt(distance: number) {
  if (!exploring() || !inClutter(player.obj.position) || flight.elapsed - flight.lastShotAt < SHOT_GIVES_AWAY) return true;
  return distance < (dark() ? HIDDEN_BEYOND_DARK : HIDDEN_BEYOND);
}

/** The wreck or beacon the ship has run into, pushing it back out; null if none. */
function bumpCover(pos: THREE.Vector3, shipRadius: number): string | null {
  for (const p of flight.scenePois) {
    const solids = [...p.models.map((m) => ({ at: m.root.position, r: m.radius * 0.8 })), ...(p.beacon ? [{ at: p.beacon.position, r: BEACON_RADIUS }] : [])];
    for (const { at, r } of solids) {
      const away = pos.clone().sub(at);
      if (away.length() >= r + shipRadius) continue;
      if (away.lengthSq() < 1) away.set(0, 1, 0);
      pos.copy(at).add(away.setLength(r + shipRadius + 5));
      return p.revealed && isFound(cmdr(), currentSystem(), p.poi.id) ? p.poi.name : p.poi.kind === 'beacon' ? 'beacon' : 'wreck';
    }
  }
  return null;
}

function discover(p: ScenePoi) {
  const c = cmdr();
  const before = exploreOf(c).points;
  recordDiscovery(c, currentSystem(), p.poi);
  if (p.beacon) powerDownBeacon(p.beacon); // its message delivered, its lamp goes out
  // The lost courier's prototype: yours now.
  if (p.poi.prize && !hasEquipment(c, p.poi.prize)) {
    c.equipment.push(p.poi.prize);
    exploreOf(c).points += COURIER_POINTS;
    setTimeout(() => game.state === 'flying' && flash('Will-o’-the-Wisp fitted · enemy lasers miss half the time, half the missiles are spoofed · Wexley-Yorozu will want it back', 6), 5200);
  }
  if (p.poi.salvage.length) {
    spillCargo(p.position, new THREE.Vector3(), salvageCargo(p.poi.salvage));
  }
  // A trail step: the clue points on, and the course is plotted for you.
  const next = advanceTrail(c, p.poi);
  let trailNote = '';
  if (next) trailNote = ` · the trail leads to ${next.name}${next.index !== currentSystem().index ? ` · ${plotCourse(c, next.index)}` : ''}`;
  else if (p.poi.trail?.last) trailNote = ' · the end of the trail';
  saveCommander(c);
  sfx.beep();
  flash(`Discovered: ${p.poi.name}${p.poi.salvage.length ? ' · cargo drifting free' : ''}${trailNote}`, trailNote ? 5 : 3);
  showPoiLog(p.poi);
  noteExplorerRank(before);
}

/**
 * Data that has just left the hold at a station (sold, handed in, published):
 * claim it for the chart. The first commander to bring each body home has
 * their callsign on it (signed in only).
 */
function bringHome(held: SurveyData[]) {
  const c = cmdr();
  const gone = held.filter((d) => !exploreOf(c).data.includes(d));
  if (c.difficulty !== 'modern' || !gone.length) return;
  void claimFirsts(gone.map((d) => ({ galaxy: d.galaxy, system: d.system, body: d.body }))).then((won) => {
    if (!won.length) return;
    const one = gone.find((d) => d.galaxy === won[0].galaxy && d.system === won[0].system && d.body === won[0].body);
    const what = won.length === 1 ? (one?.name ?? 'one find') : `${won.length} finds`;
    setTimeout(() => flash(`First to bring it home · your callsign goes on the chart for ${what}`, 5), 2500);
    if (game.state === 'docked') renderDocked();
  });
}

/** The chart's line on who got somewhere first: names on the galaxy. */
function firstsLine(s: StarSystem): string | null {
  const firsts = firstsIn(s.galaxy, s.index);
  if (!firsts.size) return null;
  const bodies = bodiesOf(s);
  const parts: string[] = [];
  for (const [body, callsign] of firsts) {
    const b = bodies.find((x) => x.id === body);
    if (body === 'planet') parts.unshift(`Charted first by CMDR ${callsign}`);
    else if (b?.grade === 'Candidate') parts.push(`${b.name} charter: CMDR ${callsign}`);
    else if (b) parts.push(`${b.name}: CMDR ${callsign}`);
    else parts.push(`${body === 'courier' ? 'The lost courier' : 'A signal'} found first by CMDR ${callsign}`);
  }
  return parts.join(' · ');
}

/** Firsts of yours in this galaxy (from the chart's last look). */
function myFirsts(galaxy: number): number {
  const mine = currentAccount()?.callsign;
  if (!mine) return 0;
  let n = 0;
  for (let i = 0; i < 256; i++) for (const callsign of firstsIn(galaxy, i).values()) if (callsign === mine) n++;
  return n;
}

/** What explorers hear at a station: the nearest trail not yet started (Trailblazers), and bar talk of the courier. */
function explorerTips(c: Commander, here: StarSystem): [string, string][] {
  const rows: [string, string][] = [];
  const tip = trailTip(c, here);
  if (tip) rows.push(['Tip', `${escapeHtml(tip.title)} starts at ${escapeHtml(tip.at.name)}${tip.at === here ? ' (here)' : `, ${tip.ly.toFixed(1)} LY`} · survey the planet to find its first signal${tip.at === here ? '' : ` <button type="button" class="tip-course" data-system="${tip.at.index}">Set course</button>`}`]);
  const rumour = courierRumour(c, here);
  if (rumour) rows.push(['Rumour', escapeHtml(rumour)]);
  return rows;
}

/** Reaching an explorer rank: say what it opened. */
function noteExplorerRank(before: number) {
  const reached = rankReached(before, exploreOf(cmdr()).points);
  if (!reached) return;
  const news = RANK_NEWS[reached];
  setTimeout(() => flash(`Explorer rank: ${reached.toUpperCase()}${news ? ` · ${news}` : ''}`, 7), 4000);
}

let poiLogTimer = 0;
function showPoiLog(poi: Poi) {
  showLog(poi.name, poi.log, 14000);
}

/** A log, or a longer document, in the panel over the dashboard. */
function showLog(title: string, text: string, ms: number) {
  const log = $('#poi-log');
  log.querySelector('h3')!.textContent = title;
  log.querySelector('p')!.textContent = text;
  log.hidden = false;
  clearTimeout(poiLogTimer);
  poiLogTimer = window.setTimeout(() => (log.hidden = true), ms);
}
$('#poi-log').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('p:first-of-type')) return; // scrolling a long report
  clearTimeout(poiLogTimer);
  $('#poi-log').hidden = true;
});
addEventListener('keydown', () => {
  const log = $('#poi-log');
  if (!log.hidden) {
    clearTimeout(poiLogTimer);
    poiLogTimer = window.setTimeout(() => (log.hidden = true), 400); // let the key do its job too
  }
});

/** HUD markers for moons and signals. */
function exploreMarkers(km: (p: THREE.Vector3) => string): Marker[] {
  const out: Marker[] = [];
  // Moons, and (Modern) the planet: bright in the explorer's colour until
  // surveyed, then the plain grey of somewhere done, with a tick for anyone
  // who can't tell the colours apart. Named within 30 km of the surface.
  for (const b of flight.sceneBodies) {
    if (b.body.kind === 'star' || (b.body.kind === 'planet' && !exploring())) continue;
    const near = player.obj.position.distanceTo(b.centre) - b.radius < 30000;
    const surveyed = !exploring() || isSurveyed(cmdr(), currentSystem(), b.body.id);
    const tick = exploring() && surveyed ? ' ✓' : '';
    out.push({ position: b.centre, color: surveyed ? '#9aa3ad' : SIGNAL_COLOUR, radius: b.radius, label: near ? `${b.body.name}${tick} ${km(b.centre)}` : undefined });
  }
  if (!exploring()) return out;
  for (const p of flight.scenePois) {
    if (!p.revealed) continue;
    const found = isFound(cmdr(), currentSystem(), p.poi.id);
    out.push({ position: p.position, color: SIGNAL_COLOUR, radius: 30, label: found ? `${p.poi.name} ${km(p.position)}` : `Signal ${km(p.position)}` });
  }
  // A yard is hard to miss, so it's always named.
  if (flight.yardScene) out.push({ position: flight.yardScene.centre, color: YARD_COLOUR, radius: flight.yardScene.radius, label: `Wexley-Yorozu yard · ${stageLabel(flight.yardScene.yard)} · ${km(flight.yardScene.centre)}` });
  return out;
}

/** On arriving anywhere: note the visit, and say what's special here. */
function arrivalNote(sys: StarSystem): string {
  const before = exploreOf(cmdr()).points;
  const first = recordVisit(cmdr(), sys);
  noteExplorerRank(before);
  const world = describeWorld(worldOf(sys));
  const yard = exploring() && yardAt(sys, Date.now()) ? 'A Wexley-Yorozu yard is building here' : '';
  return [world, yard, first ? 'First visit' : ''].filter(Boolean).join(' · ');
}

// Fitted equipment is only at risk once the hull is badly hurt, and never
// more than one item in quick succession, so a scrape doesn't strip the ship.
const EQUIPMENT_RISK_HULL = 0.5; // fraction of full hull
const EQUIPMENT_HIT_GAP = 10; // seconds between items lost


/**
 * Damage the player's ship. Shields soak hits first; once a hit reaches the
 * hull it may take out fitted equipment. Returns true if the ship is destroyed.
 */
function damagePlayer(amount: number, from?: NpcShip): boolean {
  if (from) lastHitBy = { npc: from, at: flight.elapsed };
  // Under fire on the docking computer, you get the stick back: never a sitting duck on autopilot (Mark). Modern only.
  if (from && flight.autopilot && modern()) setAutopilot(false, 'Under fire · docking computer off · you have control');
  const hullBefore = player.hull;
  let destroyed = player.damage(amount);
  // A Falcon fights to disable: at a third of your hull she stops, and takes her price.
  if (from?.breaksOffAt !== undefined && player.hull < player.def.stats.hull * FALCON_DISABLES) {
    player.hull = Math.min(hullBefore, player.def.stats.hull * FALCON_DISABLES);
    destroyed = false;
    from.won = true;
  }
  const badlyHurt = player.hull < player.def.stats.hull * EQUIPMENT_RISK_HULL;
  // Pirates aim for the comms array: it's how you'd call for help.
  const aimed = from?.role === 'pirate';
  if (!destroyed && player.hull < hullBefore && !badlyHurt && flight.equipmentHitCooldown <= 0 && game.commander) {
    const hit = rollFragileDamage(cmdr(), Math.random, aimed);
    if (hit) {
      flight.equipmentHitCooldown = EQUIPMENT_HIT_GAP;
      sfx.scrape();
      flash(`${hit.name} damaged · plain radio until it's repaired at a station`, 2.5);
    }
  }
  if (!destroyed && player.hull < hullBefore && badlyHurt && flight.equipmentHitCooldown <= 0 && game.commander) {
    const hit = rollEquipmentDamage(cmdr(), Math.random, aimed ? 'comms-array' : undefined);
    if (hit) {
      flight.equipmentHitCooldown = EQUIPMENT_HIT_GAP;
      sfx.scrape();
      flash(cmdr().difficulty === 'classic' ? `${hit.name} destroyed!` : hit.id === 'comms-array' ? `${hit.name} damaged · plain radio until it's repaired at a station` : `${hit.name} damaged · repair at a station`, 2.5);
      if (hit.id === 'docking-computer' && flight.autopilot) setAutopilot(false);
    }
  }
  return destroyed;
}

/**
 * Attacking police makes you a Fugitive here. Serious crimes (destroying
 * police, attacking the station) also bring a Marshals warrant under Modern
 * rules, which follows you to every system with a government.
 */
function becomeFugitive(serious = false) {
  const c = cmdr();
  if (!hasLaw(currentSystem())) return;
  if (!identified()) {
    // Running dark: seen, not known. Police who saw it come after the ship anyway.
    unpinnedCrime('fugitive', serious);
    if (ofRole('police').some((p) => p.obj.position.distanceTo(player.obj.position) < POLICE_SEE)) defiedPolice = true;
    return;
  }
  const hadWarrant = c.warrant;
  const was = isFugitive();
  recordCrime(c, 'fugitive', serious);
  flight.surrenderTimer = null;
  if (c.warrant && !hadWarrant) {
    flash('Co-operative Marshals warrant issued', 2.5);
    scheduleMarshals();
  }
  if (was) return;
  reinforceTimer = 6;
  if (!c.warrant || hadWarrant) flash('You are now a FUGITIVE', 2.5);
}

function becomeOffender(message: string, unknown = !identified()) {
  if (unknown) return unpinnedCrime('offender', false);
  if (legalStatus(cmdr()) !== 'clean') return;
  recordCrime(cmdr(), 'offender');
  flash(message, 3);
}

/** A ship blows up. If the player did it, the law and the combat rating take note. */
function destroyNpc(npc: NpcShip, killer: THREE.Object3D | null) {
  trackBoom(npc);
  const velocity = npc.ship.forward().multiplyScalar(npc.ship.speed);
  const boom = new Explosion(npc.def, npc.obj, velocity);
  space.scene.add(boom.group);
  explosions.push(boom);
  boomAt(npc.obj.position, 2.2, 1600, 1.6);
  // A pirate carrying your lost case drops it again.
  if (npc.carrying && game.commander) {
    const k = cmdr().adrift?.find((x) => x.contract === npc.carrying);
    if (k) {
      const p = npc.obj.position;
      k.position = [p.x, p.y, p.z];
      delete k.fate;
      saveCommander(cmdr());
      spillSpecial(k);
      flash(`The ${k.label} is adrift again`, 2.5);
    }
  }
  // Cargo from a clean ship you destroyed is stolen; from a pirate, or someone else's kill, it's salvage.
  if (Object.keys(npc.cargo).length) spillCargo(npc.obj.position, velocity, npc.cargo, killer === player.obj && npc.role !== 'pirate');
  const lost = deliveries.get(npc);
  if (lost && game.commander) {
    const market = marketState(tradeContext());
    for (const d of lost) loseDelivery(market, d, Date.now());
    saveCommander(cmdr());
    if (npc.obj.position.distanceTo(player.obj.position) < 8000) {
      const goods = lost.map((d) => `${d.qty}${commodityById(d.id)?.unit === 't' ? ' t' : ' ' + commodityById(d.id)?.unit} ${commodityById(d.id)?.name}`).join(', ');
      setTimeout(() => flash(`Delivery lost · ${goods} won't reach ${currentSystem().name}`, 3), 1600);
    }
  }
  // A trader that called for help, and didn't get it.
  if (distresses.some((d) => d.trader === npc && d.heard) && game.state === 'flying') radio('mayday', traderName(npc), 'Signal lost', { colour: traderColour(npc) });
  removeNpc(npc);
  if (carrier?.npc === npc) bastionDestroyed(carrier, velocity, killer === player.obj);
  if (killer !== player.obj) return;
  if (npc.role === 'pirate') pirateLost();

  const c = cmdr();
  const rated = rateKill(npc);
  const note = rated ? ` · ${rated}` : '';
  if (npc.role === 'pirate') {
    c.credits = Math.round((c.credits + npc.bounty) * 10) / 10;
    flash(`${npc.def.name} destroyed · Bounty ${npc.bounty} Cr${note}`, 2.5);
    void keepCombat({ kind: 'kill', text: `${npc.def.name} destroyed · bounty ${npc.bounty} Cr`, subject: npc.def.name }, 20, 4);
  } else {
    flash(`${npc.def.name} destroyed${note}`, 1.5);
    // Killing police or an innocent trader is a serious crime. Under Classic
    // rules, as in 1984, a trader only counts if the station sees it happen;
    // under Modern, only if anyone saw (the victim can't tell anyone now).
    if (npc.role !== 'trader') becomeFugitive(true);
    else if (c.difficulty === 'classic') {
      if (inSafeZone(npc.obj.position)) becomeFugitive(true);
    } else if (witnessed(npc.obj.position, npc)) becomeFugitive(true);
    else flash('No witnesses · but its cargo is stolen goods', 3);
  }
  saveCommander(c);
}

/** What the rating needs to know about a ship you destroyed. */
const foeOf = (npc: NpcShip): Foe => ({
  value: npc.def.stats.ratingValue,
  role: npc.role,
  bounty: npc.bounty,
  firedFirst: Boolean(npc.firedOnPlayer),
  laser: npc.laser.name,
  missiles: npc.missiles,
  ecm: npc.ecm,
  wingmen: npcs.filter((n) => n !== npc && n.hostile && n.target === player).length,
});

/**
 * Rate a kill (docs/design/combat-rating.md). Modern: points weighted by the
 * ship, its role, how well armed it was, the odds and how far it was beneath
 * you, nothing for a crime; Classic: one a kill, as in 1984. Kills the combat
 * computer flew count half. Says when you reach a new rank, and every 256
 * points the old salute. Returns the note for the kill's flash (Modern).
 */
function rateKill(npc: NpcShip | 'crime'): string {
  const c = cmdr();
  const before = c.kills;
  const classic = c.difficulty === 'classic';
  const r = classic ? { points: flight.combatComputer ? 0.5 : 1 } : npc === 'crime' ? { points: 0, none: 'crime' as const } : killPoints(foeOf(npc), c.kills, Boolean(flight.combatComputer));
  c.kills = Math.round((c.kills + r.points) * 100) / 100;
  if (r.points > 0) noteCardMoment('fight');
  if (rightOn(before, c.kills)) setTimeout(() => flash('Right On Commander!', 3), 1200);
  if (combatRating(c.kills) !== combatRating(before)) setTimeout(() => flash(`Combat rating: ${combatRating(c.kills)}`, 3), 2600);
  return classic ? '' : pointsNote(r);
}

/** The station's safe zone: close enough for its guns and its police to see. */
const SAFE_ZONE = 5000; // metres
const inSafeZone = (at: THREE.Vector3) => game.commander !== null && at.distanceTo(station.root.position) < SAFE_ZONE;

/** The player shot or rammed a ship. Pirates are fair game; anyone else is a crime. */
// Friendly fire (Mark: a police Viper flies across you in a fight, catches one shot, and you're a
// fugitive). Under Modern rules, in a fight, the first stray hit on a police or security ship is
// forgiven with a warning; a burst that clips it counts once. Again within half a minute, or with
// no fight on, or a ship you've locked a missile on, and it's no accident. Destroying one still counts.
const STRAY_BURST = 1.5; // seconds: hits this close together are one accident
const STRAY_MEMORY = 30; // seconds before another accident would be forgiven
const strays = new WeakMap<NpcShip, { from: number; at: number }>();
function strayShot(npc: NpcShip): boolean {
  if (!modern() || npc.role === 'marshal' || !(npc.guard || npc.role === 'police') || !fightOn() || flight.locked === npc) return false;
  const s = strays.get(npc);
  if (s && flight.elapsed - s.from <= STRAY_BURST) return (s.at = flight.elapsed), true;
  if (s && flight.elapsed - s.at < STRAY_MEMORY) return false;
  strays.set(npc, { from: flight.elapsed, at: flight.elapsed });
  const sp = speakerOf(npc);
  radio(sp.kind, sp.from, 'Check your fire, Commander!', { colour: sp.colour, flash: 2 });
  return true;
}

function playerHitNpc(npc: NpcShip, damage: number) {
  // Paid off, then shot at: the deal's off.
  if (npc.paid) Object.assign(npc, { paid: false, fights: true });
  // A stray shot in a fight: it hurts, but it's no crime and no grudge (a kill still counts).
  if (strayShot(npc)) {
    if (npc.hit(damage)) destroyNpc(npc, player.obj);
    return;
  }
  alertSecurity(npc, player);
  if (npc.guard) {
    if (witnessed(npc.obj.position, npc)) becomeOffender('Firing on company security · you are an OFFENDER');
  } else if (npc.role === 'police' || npc.role === 'marshal') becomeFugitive();
  else if (npc.role === 'trader') {
    if (witnessed(npc.obj.position, npc)) becomeOffender('Firing on a trader · you are an OFFENDER');
    else {
      // Nobody saw. The trader knows, though, and it's calling for help.
      npc.unreported = true;
      npc.seenDark = !identified();
      mayday(npc);
    }
  }
  if (npc.hit(damage, player)) destroyNpc(npc, player.obj);
}

/** A collision is an accident (a ship launching into you, say): it hurts, but it's no crime, no kill, and no grudge. */
function playerRammedNpc(npc: NpcShip, damage: number) {
  if (npc.hit(damage)) destroyNpc(npc, null);
}

// --- The law beyond the station (docs/design/companies-and-contracts.md, section 4) ----
// Within station space the station sees everything. Out in the lanes, a crime
// needs a witness: police in sight, another ship, or a victim who gets away.
// Under Classic rules (frozen) every crime counts, as before.

const STATION_SPACE = 10000; // metres: the station sees everything inside this
const POLICE_SEE = 8000; // metres: a police ship witnesses anything this close
const SHIPS_SEE = 6000; // metres: another ship sees a crime this close (and lives to tell)

/** Would anyone see a crime here? (The victim doesn't count: it reports only if it gets away.) */
function witnessed(at: THREE.Vector3, victim: NpcShip | null): boolean {
  if (!game.commander || cmdr().difficulty !== 'modern') return true;
  if (at.distanceTo(station.root.position) < STATION_SPACE) return true;
  return npcs.some((n) => {
    if (n === victim || n.role === 'pirate') return false;
    const d = n.obj.position.distanceTo(at);
    return n.role === 'police' || n.role === 'marshal' ? d < POLICE_SEE : d < SHIPS_SEE;
  });
}

// A distress call: police launch from the station and fly to the scene. The
// further out, the longer they take: about 20 s at 12 km, a minute at 20 km.
const responses: { at: number; where: THREE.Vector3 }[] = [];
function forgetResponses() {
  responses.length = 0;
}

function mayday(npc: NpcShip) {
  if (npc.maydayCalled || !hasLaw(currentSystem())) return;
  npc.maydayCalled = true;
  if (isWorking(cmdr(), 'distress-jammer')) return flash(`Distress call jammed · the ${npc.def.name} can't reach the police`, 2.5);
  const where = npc.obj.position.clone();
  const delay = Math.max(10, 10 + (where.distanceTo(station.root.position) - STATION_SPACE) / 200);
  responses.push({ at: flight.elapsed + delay, where });
  const line = `Mayday from the ${npc.company ? COMPANIES[npc.company].name : ''} ${npc.def.name}`.replace('  ', ' ') + ` · police about ${Math.round(delay)} s away`;
  radio('mayday', traderName(npc), `Mayday! We're under attack · police about ${Math.round(delay)} s away`, { colour: traderColour(npc), flash: 3, urgent: true, line });
}

function updateResponses() {
  for (let i = responses.length - 1; i >= 0; i--) {
    if (flight.elapsed < responses[i].at) continue;
    const { where } = responses.splice(i, 1)[0];
    // Two Vipers come out and patrol where the call came from: witnesses now, if anything's still going on.
    // The wait was their flight out: they arrive now, from the station's side.
    const fromStation = station.root.position.clone().sub(where).setLength(1800);
    for (let k = 0; k < 2 && ofRole('police').length < MAX_POLICE; k++) {
      spawnViper(false);
      const cop = npcs[npcs.length - 1];
      cop.patrol.centre.copy(where);
      cop.patrol.radius = 500 + k * 300;
      cop.obj.position.copy(where).add(fromStation).add(new THREE.Vector3().randomDirection().multiplyScalar(200));
      cop.obj.lookAt(where);
      cop.ship.speed = cop.ship.maxSpeed * 0.6;
    }
    radio('police', `${currentSystem().name} police`, 'Police arriving · answering a distress call', { flash: 2 });
  }
}

// The station defends its approach (Mark): in a lawful system under Modern rules, a pirate that
// fires within the safe zone brings the station's police out at once, and inside its guns' reach
// the station fires on it. Anarchies have no law: nobody comes, as there.
const STATION_GUNS = 2000; // metres
const STATION_GUN_INTERVAL = 0.5; // seconds between shots
const STATION_GUN_DAMAGE = 18;
const FIRED_RECENTLY = 5; // seconds a pirate stays a target after its last shot
const pirateFiredAt = new WeakMap<NpcShip, number>();
let stationGunCooldown = 0;
let policeScrambledAt = -Infinity;

function pirateFired(npc: NpcShip) {
  if (!modern() || !hasLaw(currentSystem()) || !inSafeZone(npc.obj.position)) return;
  pirateFiredAt.set(npc, flight.elapsed);
  if (flight.elapsed - policeScrambledAt < 30) return; // one scramble at a time
  policeScrambledAt = flight.elapsed;
  for (let k = 0; k < 2 && ofRole('police').length < MAX_POLICE; k++) spawnViper(true);
  radio('police', `${currentSystem().name} police`, 'Pirate fire on the approach · police launching', { flash: 2 });
}

function updateStationDefence(dt: number) {
  stationGunCooldown -= dt;
  if (stationGunCooldown > 0 || !modern() || !hasLaw(currentSystem())) return;
  const target = npcs.find((n) => n.role === 'pirate' && flight.elapsed - (pirateFiredAt.get(n) ?? -Infinity) < FIRED_RECENTLY && n.obj.position.distanceTo(station.root.position) < STATION_GUNS);
  if (!target) return;
  stationGunCooldown = STATION_GUN_INTERVAL;
  const from = station.root.position.clone().add(target.obj.position.clone().sub(station.root.position).setLength(95));
  beams.fire(from, target.obj.position.clone(), POLICE_LASER.color);
  if (target.hit(STATION_GUN_DAMAGE)) destroyNpc(target, station.root);
}

/** A trader you attacked, getting away: it reports you (in the system where it happened). */
function reportedBy(npc: NpcShip) {
  if (!npc.unreported || !game.commander) return;
  npc.unreported = false;
  becomeOffender('The trader you attacked got away, and reported you · you are an OFFENDER', npc.seenDark);
}

// --- Running dark and the police hail (section 4, Modern rules) -------------
// Switch the transponder off (0) and a witness sees only "an unidentified
// Cobra Mk III": the crime waits for a suspect, and switching back on near
// the law soon after makes you it. Close up (2 km) or in station space your
// hull still gives you away. Lawful stations won't dock a dark ship, and
// police hail one: switch on within 15 s or, if it's broken, cut your speed
// and let a Viper read your hull. Ignore them and they come after you.

const HAIL_TIME = 15; // seconds to answer a police hail
const HAIL_SLOW = 0.2; // fraction of top speed: slow enough for a Viper to read your hull
const SUSPECT_TIME = 180; // seconds after a crime that switching on near the law makes you the suspect

/** A crime seen but not pinned on you. Forgotten when you leave the system. */
let unpinned: { status: 'offender' | 'fugitive'; serious: boolean; at: number } | null = null;
let hail: { by: NpcShip; until: number } | null = null;
/** Police have read your hull this visit (a broken transponder): no more hails. */
let hullChecked = false;
/** You ignored a hail, or fired on police, while dark: they're after you, whoever you are. */
let defiedPolice = false;

const transponderBroken = () => game.commander !== null && cmdr().damaged.includes('transponder');
/** Nobody can read who you are from afar. */
const dark = () => game.commander !== null && cmdr().difficulty === 'modern' && (flight.transponderOff || transponderBroken());

/** Whether the law knows it's you: transponder on, or the station or a police ship close enough to read your hull. */
function identified(): boolean {
  if (!dark()) return true;
  if (player.obj.position.distanceTo(station.root.position) < STATION_SPACE) return true;
  return npcs.some((n) => (n.role === 'police' || n.role === 'marshal') && n.obj.position.distanceTo(player.obj.position) < HULL_READ);
}

function unpinnedCrime(status: 'offender' | 'fugitive', serious: boolean) {
  unpinned = { status: unpinned?.status === 'fugitive' ? 'fugitive' : status, serious: serious || Boolean(unpinned?.serious), at: flight.elapsed };
  flash(`Seen, but not identified · an unidentified ${player.def.name}`, 2.5);
}

// The ship's computer switches it back on for you when that's safe and
// needed: arriving in a new system, and approaching a lawful station to dock.
// Not when it would make you the suspect: then it says why, counts down on
// the DARK light, and switches on when the coast is clear.

/** Seconds until switching on here is safe; 0 if it is now (Infinity: you defied the police here). */
function suspectFor(): number {
  if (defiedPolice) return Infinity;
  return unpinned ? Math.max(0, SUSPECT_TIME - (flight.elapsed - unpinned.at)) : 0;
}


const clock = (secs: number) => {
  const t = Math.ceil(secs);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Switch on for docking if it's safe; otherwise say why not. Returns whether it's on. */
function transponderOnToDock(): boolean {
  if (!flight.transponderOff) return true;
  const wait = suspectFor();
  if (wait > 0) {
    flight.switchOnWhenClear = wait !== Infinity;
    flash(`Transponder left dark: switching on here would make you the suspect · ${wait === Infinity ? 'you ignored a police hail' : clock(wait)} · or jump out`, 4);
    return false;
  }
  flight.switchOnWhenClear = false;
  flight.transponderOff = false;
  showTransponder();
  flash('Transponder on for docking', 2);
  return true;
}

/** 0: switch the transponder off (run dark), or on again. */
function toggleTransponder() {
  if (cmdr().difficulty !== 'modern') return flash('Classic rules: the transponder stays on', 1.5);
  if (transponderBroken()) return flash('Transponder damaged · repair it at a station', 2);
  flight.transponderOff = !flight.transponderOff;
  flight.switchOnWhenClear = false;
  showTransponder();
  if (flight.transponderOff) return flash(hasLaw(currentSystem()) ? 'Transponder off · running dark' : 'Transponder off · nobody here cares', 2);
  // Back on where the law can see, soon after a crime nobody pinned on you: you're the suspect.
  const watched =
    player.obj.position.distanceTo(station.root.position) < STATION_SPACE ||
    ofRole('police').some((p) => p.obj.position.distanceTo(player.obj.position) < POLICE_SEE);
  const crime = unpinned && flight.elapsed - unpinned.at < SUSPECT_TIME ? unpinned : null;
  unpinned = null; // switched on quietly, or too late: the trail goes cold
  if (watched && (crime || defiedPolice)) {
    defiedPolice = false;
    if (crime?.status === 'fugitive') becomeFugitive(crime.serious);
    else becomeOffender(crime ? 'Transponder on, near the scene · you are the suspect · OFFENDER' : 'Transponder on · you ignored a police hail · OFFENDER');
    return;
  }
  if (hail) radio('police', `${currentSystem().name} police`, 'Transponder read · thank you, Commander', { flash: 2, urgent: true, line: 'Transponder read · thank you, Commander' });
  else flash('Transponder on', 2);
}

function showTransponder() {
  const on = dark();
  // While a crime here is fresh, the light counts down to when switching on is safe.
  const wait = flight.transponderOff ? suspectFor() : 0;
  const timer = wait > 0 && wait !== Infinity ? ` ${clock(wait)}` : '';
  const light = $('#dark-light');
  light.classList.toggle('on', on);
  if (light.textContent !== `DARK${timer}`) light.textContent = `DARK${timer}`;
  const button = $('#touch .dark-button');
  button.classList.toggle('armed', flight.transponderOff);
  // The survey autopilot's button, once there's one fitted.
  const survey = $('#touch .survey-button');
  const fitted = hasEquipment(cmdr(), 'survey-autopilot');
  if (survey.hidden === fitted) survey.hidden = !fitted;
  survey.classList.toggle('armed', Boolean(flight.surveyPilot));
  if (button.textContent !== `Dark${timer}`) button.textContent = `Dark${timer}`;
  // Waiting to dock and the coast is now clear: on it goes.
  if (flight.switchOnWhenClear && flight.transponderOff && wait === 0 && player.obj.position.distanceTo(station.root.position) < CLEARANCE_RANGE) {
    flight.switchOnWhenClear = false;
    flight.transponderOff = false;
    flash('Coast clear · transponder on for docking', 2.5);
  }
}

/** Each frame in flight: police hail a dark ship they can see. */
function updateHail() {
  showTransponder();
  const box = $('#hail');
  if (hail && !npcs.includes(hail.by)) hail = null; // the Viper's gone; another may ask
  if (!dark() || !hasLaw(currentSystem()) || defiedPolice || (hullChecked && !flight.transponderOff)) {
    hail = null;
    box.hidden = true;
    return;
  }
  if (!hail) {
    const by = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(player.obj.position) < POLICE_SEE);
    if (!by) return;
    hail = { by, until: flight.elapsed + HAIL_TIME };
    sfx.beep();
    // One hail (Mark got two): in Modern the radio card is it, with the seconds left on it; Classic keeps the banner.
    const deadline = Date.now() + HAIL_TIME * 1000;
    radio('police', `${currentSystem().name} police`, `Unidentified ${player.def.name}, switch on your transponder.`, { flash: 4, urgent: true, line: `Unidentified ${player.def.name}, this is ${currentSystem().name} police. Switch on your transponder.`, answers: transponderBroken() && !flight.transponderOff ? answerPolice() : answerPolice().map((a) => ({ ...a, until: deadline, clock: true })) });
  }
  // The Viper that hailed you comes to look.
  hail.by.patrol.centre.copy(player.obj.position);
  hail.by.patrol.radius = 400;
  const broken = transponderBroken() && !flight.transponderOff;
  if (broken && player.speed <= player.maxSpeed * HAIL_SLOW) {
    hail.until = Math.max(hail.until, flight.elapsed + 5); // holding still for them: the clock waits
    if (hail.by.obj.position.distanceTo(player.obj.position) < HULL_READ) {
      hail = null;
      hullChecked = true;
      box.hidden = true;
      radio('police', `${currentSystem().name} police`, isFugitive() ? 'Hull read · you are wanted here' : 'Hull read · clean · get that transponder seen to at the next station', { flash: 3, urgent: true, line: isFugitive() ? 'Hull read · you are wanted here' : 'Hull read · clean · get that transponder seen to at the next station' });
      return;
    }
  }
  if (flight.elapsed > hail.until) {
    hail = null;
    defiedPolice = true;
    box.hidden = true;
    sfx.beep();
    radio('police', `${currentSystem().name} police`, 'No answer · police are treating you as hostile', { flash: 3, urgent: true, line: 'No answer · police are treating you as hostile' });
    return;
  }
  // In Modern the card carries the hail; the banner stays for a broken transponder, whose clock waits while you hold still.
  box.hidden = modern() && !broken;
  const left = Math.ceil(hail.until - flight.elapsed);
  const text = broken
    ? `Police hail · transponder damaged: cut your speed and let the Viper read your hull · ${left} s`
    : `Police hail · switch on your transponder${document.body.classList.contains('touch') ? '' : ' (0)'} · ${left} s`;
  const span = box.querySelector('span')!;
  if (span.textContent !== text) span.textContent = text;
  box.querySelector('button')!.hidden = broken;
}

/** Lawful stations won't dock a ship that has switched its transponder off. */
const darkRefused = () => flight.transponderOff && checksClearance(currentSystem());

// The hail's own button: answer it in one tap.
$('#hail .hail-on').addEventListener('click', (e) => {
  (e.currentTarget as HTMLButtonElement).blur();
  if (flight.transponderOff) toggleTransponder();
});

type Shot = { kind: 'npc'; npc: NpcShip } | { kind: 'drifter'; drifter: Drifter } | { kind: 'station' } | { kind: 'commander' } | { kind: 'cover' };

// Lasers fire straight ahead unless a gimballed mount is fitted, in which
// case (with mouse aim) they swivel to hit what's under the ring. The ring
// never strays more than 30° from the nose. Gimbals trade a little damage
// for that convenience.
const GIMBAL_DAMAGE = 0.8;

initManual({ gimballed: () => gimballed() });
function gimballed() {
  return controlScheme() === 'mouse' && isMouseCaptured() && Boolean(game.commander) && isWorking(cmdr(), 'gimbal-mount');
}

/**
 * While the combat computer flies (Mark: "my targeting system was all over the place"), the ring
 * rides with the nose instead of staying put in space as the ship throws itself about, and the
 * gimbal swings onto the computer's target, or the nearest hostile, whenever one is within its
 * reach, and back to the nose when none is: the computer flies, the gimbal tracks, you fire.
 */
const GIMBAL_SLEW = THREE.MathUtils.degToRad(150); // degrees a second it can swing
function gimbalRide(dt: number) {
  aim.dir.copy(gimbalHold).applyQuaternion(player.obj.quaternion);
  if (!gimballed() || view !== 'front') return;
  const fwd = player.forward();
  const at = player.obj.position;
  const candidates = [flight.combatComputer?.target, ...npcs.filter((n) => n.hostile)].filter((n): n is NpcShip => Boolean(n) && npcs.includes(n!));
  const lead = (n: NpcShip) => n.obj.position.clone().addScaledVector(n.ship.forward(), n.ship.speed * 0.12).sub(at);
  const target = candidates.find((n) => n.obj.position.distanceTo(at) < playerLaser().range && fwd.angleTo(lead(n)) < GIMBAL_REACH);
  // Nothing within reach: the ring drifts home to the nose, ready for the next pass.
  const want = target ? lead(target).normalize() : fwd;
  const angle = aim.dir.angleTo(want);
  if (angle > 1e-4) aim.dir.lerp(want, Math.min(1, (GIMBAL_SLEW * dt) / angle)).normalize();
  aim.clamp(player);
  gimbalHold.copy(aim.dir).applyQuaternion(player.obj.quaternion.clone().invert());
}
const GIMBAL_REACH = THREE.MathUtils.degToRad(30); // as far as the ring may lead the nose

/** The laser on the mount you're looking along, if any. */
const mountLaser = () => {
  const id = cmdr().lasers[view];
  return id ? PLAYER_LASERS[id] : null;
};
/** For heat and range: the current mount's laser, or the front one. */
const playerLaser = () => mountLaser() ?? PLAYER_LASERS[cmdr().lasers.front ?? 'pulse'];

function laserDirection() {
  if (view === 'front') return gimballed() ? aim.dir.clone() : player.forward();
  const dir = viewDirection();
  if (cmdr().difficulty !== 'modern') return dir;
  // Modern turrets swing onto the nearest ship near the middle of the view.
  let best: THREE.Vector3 | null = null;
  let bestAngle = TURRET_CONE;
  for (const npc of npcs) {
    const to = npc.obj.position.clone().sub(player.obj.position);
    if (to.length() > playerLaser().range) continue;
    const a = dir.angleTo(to);
    if (a < bestAngle) {
      bestAngle = a;
      best = to.normalize();
    }
  }
  return best ?? dir;
}

/** Where the beams leave the hull for the current mount. */
function muzzles(): THREE.Vector3[] {
  const at = (x: number, y: number, z: number) => player.obj.localToWorld(new THREE.Vector3(x, y, z));
  switch (view) {
    case 'rear':
      return [at(-7, -3, -14), at(7, -3, -14)];
    case 'left':
      return [at(20, -2, -4)];
    case 'right':
      return [at(-20, -2, -4)];
    default:
      return [at(-7, -3, 12), at(7, -3, 12)];
  }
}

// Stray shots at the station are easy to make while lining up the slot.
// Under Modern rules the ship's computer holds fire when the station is in the
// line of fire, unless you hold the trigger to override it; under both rules
// the lasers are locked while the docking computer flies, and the station
// warns you before it calls you a Fugitive.
const FIRE_OVERRIDE = 1.5; // seconds holding fire to override the safety
const STATION_GRACE = 1.5; // seconds after a warning to take your finger off the trigger
const STATION_WARNING_MEMORY = 12; // seconds a station remembers its warning
let fireHeld = 0;
let lastSafetyFlash = -Infinity;
let stationWarnedAt = -Infinity;

function safetyFlash(text: string) {
  if (flight.elapsed - lastSafetyFlash < 2) return;
  lastSafetyFlash = flight.elapsed;
  flash(text, 1.6);
}

function firePlayerLaser() {
  wispShot(); // the Wisp goes quiet while you're shooting
  const laser = mountLaser();
  if (!laser) {
    flight.laserCooldown = 0.6;
    flash(`No ${view} laser fitted`, 1.2);
    return;
  }
  if (flight.autopilot) {
    flight.laserCooldown = 0.3;
    safetyFlash('Lasers locked · docking computer flying');
    return;
  }
  const dir = laserDirection();
  const origin = player.obj.position.clone().addScaledVector(dir, 5);
  const targets: Target<Shot>[] = [
    ...npcs.map((npc) => ({ value: { kind: 'npc' as const, npc }, position: npc.obj.position, radius: npc.radius * 0.75 })),
    ...drifters.map((drifter) => ({ value: { kind: 'drifter' as const, drifter }, position: drifter.model.root.position, radius: 7 })),
    { value: { kind: 'station' as const }, position: station.root.position, radius: 90 },
    // Other commanders stop the beam on screen; whether it hurt them is the server's call.
    ...[...sharedSpace.remotes.values()].map((r) => ({ value: { kind: 'commander' as const }, position: r.position, radius: 28 })),
    ...coverTargets({ kind: 'cover' as const }),
  ];
  const hit = rayHit(origin, dir, laser.range, targets);
  if (hit?.target.value.kind === 'station' && cmdr().difficulty === 'modern' && fireHeld < FIRE_OVERRIDE && !isFugitive()) {
    flight.laserCooldown = 0.1;
    safetyFlash('Safety on · station in line of fire · hold fire to override');
    return;
  }
  if (flight.surrenderTimer !== null) breakSurrender();
  flight.laserCooldown = laser.interval;
  flight.lastShotAt = flight.elapsed;
  flight.laserHeat += laser.heat;
  if (flight.laserHeat >= 100) {
    flight.overheated = true;
    flash('Laser overheated', 1.2);
  }
  const end = hit ? hit.point : origin.clone().addScaledVector(dir, laser.range);
  for (const muzzle of muzzles()) beams.fire(muzzle, end, laser.color);
  trackBeam(player, origin, end, laser.color, hit?.target.value.kind === 'npc' ? hit.target.value.npc : null);
  shotSound(player.def, laserSound(laser), null);
  if (sharedSpace.connected) sharedSpace.fire(dir, laser.id);
  if (!hit) return;
  const shot = hit.target.value;
  if (shot.kind === 'npc') {
    sfx.hit();
    playerHitNpc(shot.npc, gimballed() ? laser.damage * GIMBAL_DAMAGE : laser.damage);
  } else if (shot.kind === 'station') {
    stationFlash = 0.25;
    sfx.hit();
    playerHitStation();
  } else if (shot.kind === 'drifter') {
    const d = shot.drifter;
    const flare = new Explosion(d.model.def, d.model.root, d.velocity);
    space.scene.add(flare.group);
    explosions.push(flare);
    disposeShip(d.model);
    drifters.splice(drifters.indexOf(d), 1);
  }
}

/**
 * Coriolis stations shrug off lasers, but firing on one is a crime. The first
 * hit brings a warning and makes you an Offender; keep firing after that and
 * it's a serious crime: you're a Fugitive and the police launch at once.
 */
function playerHitStation() {
  if (!hasLaw(currentSystem())) return;
  const sinceWarning = flight.elapsed - stationWarnedAt;
  if (!isFugitive() && sinceWarning > STATION_WARNING_MEMORY) {
    stationWarnedAt = flight.elapsed;
    recordCrime(cmdr(), 'offender');
    flash('Cease fire, Commander · this is your only warning · you are an OFFENDER', 3);
    return;
  }
  if (!isFugitive() && sinceWarning < STATION_GRACE) return; // time to let go of the trigger
  if (!isFugitive() || !cmdr().warrant) {
    becomeFugitive(true);
    flash('Station under attack · Police launching', 2.5);
  }
  if (ofRole('police').length < MAX_POLICE && reinforceTimer > 1) reinforceTimer = 0.5;
}

/** How much a ship weighs in a collision: its hull and shields together. */
const heft = (def: ShipDef) => def.stats.hull + def.stats.shields;
const CRUSHING = 5; // a ship this many times heavier crushes you

function updateCombat(dt: number, input: { fire: boolean } | null) {
  const alive = game.state === 'flying';
  beams.update(dt);
  fireHeld = alive && input?.fire ? fireHeld + dt : 0;

  if (alive && input) {
    flight.laserCooldown -= dt;
    flight.laserHeat = Math.max(0, flight.laserHeat - playerLaser().cooling * dt);
    if (flight.overheated && flight.laserHeat < 40) flight.overheated = false;
    if (input.fire && !flight.overheated && flight.laserCooldown <= 0) firePlayerLaser();
  }

  // Decide who fights whom a few times a second.
  thinkTimer -= dt;
  if (thinkTimer <= 0) {
    thinkTimer = 0.25;
    const prices = game.commander ? new Map(quotes(tradeContext()).map((q) => [q.commodity.id, q.price])) : new Map<string, number>();
    const holdValue = (cargo: Record<string, number>) => Object.entries(cargo).reduce((v, [id, q]) => v + q * (prices.get(id) ?? 0), 0);
    const world = {
      player,
      playerPresent: alive,
      // Wanted here and known, or a dark ship that defied them.
      playerWanted: (isFugitive() && identified()) || defiedPolice,
      npcs,
      inSafeZone: (at: THREE.Vector3) => cmdr().difficulty === 'classic' && inSafeZone(at),
      canSee: (npc: NpcShip) => playerVisibleAt(npc.obj.position.distanceTo(player.obj.position)),
      cargoValue: (ship: PlayerShip) => (ship === player ? (game.commander ? holdValue(cmdr().cargo) : 0) : holdValue(npcs.find((n) => n.ship === ship)?.cargo ?? {})),
    };
    const hunting = (n: NpcShip) => n.target === player && (n.mode === 'attack' || n.mode === 'breakoff');
    const before = new Map(npcs.map((n) => [n, n.mode === 'search' ? 'search' : hunting(n) ? 'hunt' : '']));
    for (const npc of npcs) if (!fleeing.has(npc)) think(npc, world); // a Falcon breaking off is past arguing with
    // Tell the player: into the clutter, and when the hunt changes (lost, or given up).
    const nowIn = alive && exploring() && inClutter(player.obj.position);
    const lost = alive && npcs.some((n) => before.get(n) === 'hunt' && n.mode === 'search');
    const notes = [
      nowIn && !wasInClutter ? `In the clutter · hidden beyond ${((dark() ? HIDDEN_BEYOND_DARK : HIDDEN_BEYOND) / 1000).toFixed(1)} km` : '',
      lost ? 'Lost them · they’re searching where they last saw you' : '',
      !lost && alive && npcs.some((n) => before.get(n) === 'search' && n.mode !== 'search' && !hunting(n)) ? 'They’ve given up the search' : '',
    ].filter(Boolean);
    if (notes.length) flash(notes.join(' · '), notes.length > 1 ? 4 : 2.5);
    wasInClutter = nowIn;
    for (const npc of npcs) maybeFireNpcMissile(npc);
  }
  updateMissiles(dt);
  updateTraffic(dt);

  for (const npc of [...npcs]) {
    if (!npcs.includes(npc)) continue; // destroyed earlier this frame
    const shot = npc.update(dt);
    ride(npc, Date.now());
    const escorting = escortOf.get(npc);
    if (escorting && npcs.includes(escorting)) npc.patrol.centre.copy(escorting.obj.position);
    if (shot && npc.target === player) npc.firedOnPlayer = true;
    if (shot && npc.role === 'pirate') pirateFired(npc);
    // Keep ships from flying through the station, except traders docking down the slot.
    const fromStation = npc.obj.position.clone().sub(station.root.position);
    if (fromStation.length() < 120 && legs.get(npc) !== 'docking') npc.obj.position.copy(station.root.position).add(fromStation.setLength(120));

    if (shot) {
      for (const { origin, dir: aim } of npc.muzzles(shot)) {
        type Struck = 'player' | 'station' | 'cover' | NpcShip;
        const targets: Target<Struck>[] = [
          { value: 'station', position: station.root.position, radius: 90 },
          ...coverTargets<Struck>('cover'),
          // Ships don't shoot their own side.
          ...npcs.filter((n) => n !== npc && !allies(n.role, npc.role)).map((n) => ({ value: n as Struck, position: n.obj.position, radius: n.radius * 0.75 })),
        ];
        // The Will-o'-the-Wisp jinks the ship out of the way of half the shots.
        if (alive && !(evading() && Math.random() < EVADE_LASERS)) targets.push({ value: 'player', position: player.obj.position, radius: 22 });
        const hit = rayHit(origin, aim, npc.laser.range, targets);
        const beamEnd = hit ? hit.point : origin.clone().addScaledVector(aim, npc.laser.range);
        beams.fire(origin, beamEnd, npc.laser.color);
        trackBeam(npc, origin, beamEnd, npc.laser.color, hit?.target.value === 'player' ? player : hit?.target.value instanceof NpcShip ? hit.target.value : null);
        shotSound(npc.def, laserSound(npc.laser), origin);
        const struck = hit?.target.value;
        if (struck instanceof NpcShip) {
          // A trader calling for help puts everything into its shields, to last until help comes.
          const calling = struck.role === 'trader' && npc.role === 'pirate' && modern();
          if (calling) distressCall(struck, npc);
          if (struck.hit(npc.laser.damage * (calling ? DISTRESS_SHIELDING : 1), npc.ship)) destroyNpc(struck, npc.obj);
        } else if (struck === 'player') {
          sfx.hit();
          hitFeedback(0.35);
          showHitDirection(camera, npc.obj.position);
          if (damagePlayer(npc.laser.damage, npc)) {
            die();
            return;
          }
        }
      }
    }

    // Ramming hurts both ships. Fly into something far heavier, like a
    // Bastion, and it's you that comes off worse: completely.
    if (alive && npc.touches(player.obj.position, 20)) {
      if (heft(npc.def) > heft(player.def) * CRUSHING) {
        sfx.thud();
        hitFeedback(1);
        flash(`Collision with the ${npc.def.name}`, 3);
        playerRammedNpc(npc, 25);
        die();
        return;
      }
      // Back out along the line from its centre until clear of the hull.
      const away = player.obj.position.clone().sub(npc.obj.position).normalize();
      for (let i = 0; i < 100 && npc.touches(player.obj.position, 30); i++) player.obj.position.addScaledVector(away, 10);
      sfx.thud();
      hitFeedback(0.9);
      playerRammedNpc(npc, 25);
      if (damagePlayer(25, npc.breaksOffAt !== undefined ? npc : undefined)) { // a Legend disables, even by collision
        die();
        return;
      }
    }
  }

  // Engine sounds for nearby ships, positioned in 3D.
  for (const npc of npcs) {
    const near = alive && npc.obj.position.distanceTo(player.obj.position) < VOICE_RANGE;
    let voice = voices.get(npc);
    if (near && !voice) voices.set(npc, (voice = new ShipVoice(npc.obj.position, voiceOf(npc.def))));
    if (!near && voice) {
      voice.dispose();
      voices.delete(npc);
    }
    voice?.update(npc.obj.position, npc.ship.speed / npc.ship.maxSpeed);
  }
  // And other commanders', each sounding like her ship; her speed from her last two positions.
  for (const r of sharedSpace.remotes.values()) {
    const near = alive && r.position.distanceTo(player.obj.position) < VOICE_RANGE;
    let voice = remoteVoices.get(r.id);
    if (near && !voice) remoteVoices.set(r.id, (voice = new ShipVoice(r.position, voiceOf(shipById(r.ship)))));
    if (!near && voice) {
      voice.dispose();
      remoteVoices.delete(r.id);
    }
    if (!voice) continue;
    const [a, b] = r.history.slice(-2);
    const max = shipById(r.ship)?.stats.maxSpeed ?? 300;
    voice.update(r.position, a && b && b.t > a.t ? Math.min(1, a.p.distanceTo(b.p) / (b.t - a.t) / max) : 0.5);
  }
  for (const [id, v] of remoteVoices) {
    if (sharedSpace.remotes.has(id)) continue;
    v.dispose();
    remoteVoices.delete(id);
  }

  // Police in lawful-ish systems scan ships that loiter near them.
  if (alive && !scanned && scansCargo(currentSystem())) {
    const scanner = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(player.obj.position) < SCAN_RANGE);
    scanProgress = scanner ? scanProgress + dt : Math.max(0, scanProgress - dt);
    if (scanProgress >= SCAN_TIME) {
      scanned = true;
      if (illegalEquipment(cmdr()).length) becomeOffender('Scanned by police · distress jammer found · you are an OFFENDER');
      else if (carriesContraband(cmdr())) becomeOffender('Scanned by police · contraband found · you are an OFFENDER');
      else radio('police', `${currentSystem().name} police`, 'Scanned · clean', { flash: 1.5, line: 'Scanned by police · clean' });
    }
  }

  // A soft double beep when a hostile is close behind you.
  tailWarningTimer -= dt;
  if (alive && tailWarningTimer <= 0) {
    const fwd = player.forward();
    const onTail = npcs.find((npc) => {
      if (!npc.hostile) return false;
      const to = npc.obj.position.clone().sub(player.obj.position);
      return to.length() < 900 && fwd.angleTo(to) > THREE.MathUtils.degToRad(120);
    });
    if (onTail) {
      tailWarning(onTail.obj.position);
      tailWarningTimer = 2.5;
    }
  }

  // The station sends more police after a fugitive, and replaces patrols otherwise.
  const nearStation = player.obj.position.distanceTo(station.root.position) < 9000;
  if (alive && isFugitive() && nearStation && currentSystem().government > 0) {
    reinforceTimer -= dt;
    if (reinforceTimer <= 0 && ofRole('police').length < MAX_POLICE) {
      spawnViper(true);
      flash('Police launching', 1.5);
      reinforceTimer = 20;
    }
  } else if (!isFugitive() && ofRole('police').length < PATROLS_BY_GOVERNMENT[currentSystem().government]) {
    repopulateTimer -= dt;
    if (repopulateTimer <= 0) {
      spawnViper(true);
      repopulateTimer = 30;
    }
  }
}




const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// --- Views: look front, rear, left or right while the ship flies on ---------------
// Each view fires the laser on that mount. Classic mounts are fixed, as in
// 1984; Modern rear and side mounts are turrets that hit the nearest ship
// near the middle of the view.

const VIEW_TURN: Record<Mount, number> = { front: 0, rear: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
const TURRET_CONE = THREE.MathUtils.degToRad(20);
let view: Mount = 'front';

function setView(next: Mount, glance = false) {
  view = next;
  // The touch view button points where you're looking; its picker marks the view and closes.
  const turn: Record<Mount, number> = { front: 0, right: 90, rear: 180, left: -90 };
  $('#view-button svg').style.transform = `rotate(${turn[view]}deg)`;
  $('#view-button').classList.toggle('away', view !== 'front');
  for (const b of document.querySelectorAll<HTMLButtonElement>('#view-picker [data-view]')) b.classList.toggle('on', b.dataset.view === view);
  if (!glance) showViewPicker(false);
  const label = $('#view-label');
  label.hidden = view === 'front';
  label.textContent = `${view} view`;
  if (view !== 'front' && !glance) {
    const laser = cmdr().lasers[view];
    flash(laser ? `${view} view · ${PLAYER_LASERS[laser].name}` : `${view} view · no ${view} laser fitted`, 1.4);
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
    glancing = view;
    showViewPicker(true);
  }, GLANCE_HOLD);
});
viewButton.addEventListener('pointermove', (e) => {
  if (!glancing) return;
  const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('#view-picker [data-view]');
  const next = (over?.dataset.view as Mount | undefined) ?? glancing;
  if (next !== view) setView(next, true);
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
  if (view === 'rear') input.pitch = rate(-up, player.def.stats.pitchRate ?? 1.5);
  else input.roll = rate(view === 'left' ? up : -up, player.def.stats.rollRate ?? 2);
}

/** Which way the current view looks, in the world. */
function viewDirection(): THREE.Vector3 {
  switch (view) {
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
    } else if (controlScheme() === 'mouse' && isMouseCaptured() && !flight.autopilot && !flight.surveyPilot && !keysTurning && view === 'front') {
      aim.move(player, input.aimDx, input.aimDy);
      const s = aim.steer(player);
      input.pitch = s.pitch;
      input.yaw = s.yaw;
    } else if (view !== 'front' && controlScheme() === 'mouse' && (isMouseCaptured() || isTouch) && !flight.autopilot && !flight.surveyPilot && !keysTurning) {
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
      const hit = lastHitBy && npcs.includes(lastHitBy.npc) ? lastHitBy : null;
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
  if (stationFlash > 0) {
    stationFlash = Math.max(0, stationFlash - dt);
    heatShip(station.model, stationFlash / 0.25);
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
    if (view !== 'front') camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), VIEW_TURN[view]));
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

// --- Situational awareness markers ----------------------------------------------

/** Red if it's after you; otherwise police blue, Marshals gold, trader green, pirate orange. */

/** Can we say who this ship is? Yes, unless it's running dark and too far off to read its hull. */
const npcIdentified = (npc: NpcShip) => !npc.dark || npc.obj.position.distanceTo(player.obj.position) < HULL_READ;

function npcColour(npc: NpcShip) {
  // Unknown until the hull is read; but once it has fired on you, whoever it is, it's hostile.
  if (!npcIdentified(npc)) return npc.firedOnPlayer ? '#ff4d6d' : UNIDENTIFIED_HEX;
  if (npc.hostile) return '#ff4d6d';
  return npc.role === 'police' ? '#4aa8ff' : npc.role === 'marshal' ? '#ffd98a' : npc.role === 'pirate' ? '#ff9a3d' : '#9ef0c0';
}

function updateMarkers() {
  const km = (p: THREE.Vector3) => {
    const d = p.distanceTo(player.obj.position);
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  };
  const calling = new Set(distresses.filter((d) => d.heard).map((d) => d.trader));
  const markers: Marker[] = npcs.map((npc) => ({
    position: npc.obj.position,
    color: npc === flight.locked ? '#ff4d6d' : npcColour(npc),
    radius: npc.radius,
    // A trader's distress call gives its position away, wherever it is.
    label: calling.has(npc) ? `MAYDAY ${km(npc.obj.position)}` : npc.hostile || npc.obj.position.distanceTo(player.obj.position) < 1500 ? km(npc.obj.position) : undefined,
  }));
  markers.push({ position: station.root.position, color: '#ffb347', radius: station.model.radius, label: `Station ${km(station.root.position)}` });
  markers.push({ position: SUN_POS, color: '#ffe08a', radius: SUN_RADIUS, label: `Sun ${km(SUN_POS)}` });
  markers.push(...exploreMarkers(km));
  // Lost company cases beacon to anyone in the system.
  for (const d of drifters) {
    if (!d.special) continue;
    const short = { hexon: 'Hexon', vorg: 'Vorg', mutual: 'Mutual', wy: 'W-Y' }[d.special.company];
    markers.push({ position: d.model.root.position, color: COMPANIES[d.special.company].colour, radius: 6, label: `${short} property · sealed ${km(d.model.root.position)}` });
  }
  for (const r of sharedSpace.remotes.values()) markers.push({ position: r.position, color: commanderColour(r), radius: 30, label: callsignTag(r, km(r.position)) });
  if (carrier?.rift) markers.push({ position: carrier.rift.group.position, color: '#cfe0ff', radius: carrier.rift.radius, label: `Rift ${km(carrier.rift.group.position)}` });
  for (const m of missiles) if (m.target === player) markers.push({ position: m.position, color: '#ff4d6d', radius: 6, label: `MISSILE ${km(m.position)}` });
  const view = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  updateIndicators(camera, view, markers);
}

// --- Combat HUD ------------------------------------------------------------------

const laserGauge = $('#g-laser');
const crosshair = $('.crosshair');
const targetInfo = $('#target-info');
const CARGO_SCAN_RANGE = 2000; // metres: close enough to read another ship's hold

const missilePips = $('#missile-pips');

function updateCombatHud() {
  const rails = player.def.stats.missiles ?? 0;
  if (missilePips.childElementCount !== rails) missilePips.innerHTML = '<i></i>'.repeat(rails);
  missilePips.querySelectorAll('i').forEach((pip, i) => pip.classList.toggle('armed', i < cmdr().missiles));
  missilePips.classList.toggle('locked', Boolean(flight.locked));
  laserGauge.style.setProperty('--v', String(flight.laserHeat / 100));
  laserGauge.classList.toggle('hot', flight.overheated || flight.laserHeat > 75);
  // Name whatever is closest to where the guns point, if it's near enough.
  const fwd = laserDirection();
  // Whichever sight the lasers follow (ring if gimballed, centre cross if
  // fixed) turns red when a shot would hit.
  const onTarget = Boolean(
    rayHit(player.obj.position, fwd, playerLaser().range, npcs.map((npc) => ({ value: npc, position: npc.obj.position, radius: npc.radius * 0.75 }))),
  );
  reticle.classList.toggle('on-target', onTarget && gimballed());
  crosshair.classList.toggle('on-target', onTarget && !gimballed());
  const best = sightedNpc();
  targetInfo.hidden = !best;
  if (best && !npcIdentified(best)) {
    // No transponder, and too far for a hull read: a ship, and nothing more.
    const km = (best.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1);
    targetInfo.textContent = `Unidentified ship · no transponder · ${km} km${best.firedOnPlayer ? ' · HOSTILE' : ''}${best === flight.locked ? ' · LOCKED' : ''}`;
    targetInfo.classList.toggle('hostile', Boolean(best.firedOnPlayer));
  } else if (best) {
    // The transponder: type, role, condition and standing.
    const km = (best.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1);
    const standing = best.role === 'pirate' ? 'WANTED' : best.guard ? 'SECURITY' : best.role === 'police' ? 'POLICE' : best.role === 'marshal' ? 'MARSHALS' : 'CLEAN';
    const owner = best.company ? COMPANIES[best.company].name.toUpperCase() : best.role.toUpperCase();
    targetInfo.textContent = `${best.def.name} · ${owner} · ${km} km · ${Math.round(best.health * 100)}% · ${best.hostile ? 'HOSTILE' : standing}${best === flight.locked ? ' · LOCKED' : ''}`;
    // Close enough, the scanner reads the hold.
    if (best.obj.position.distanceTo(player.obj.position) < CARGO_SCAN_RANGE && best.role !== 'police' && best.role !== 'marshal') {
      const hold = Object.entries(best.cargo)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${q}${commodityById(id)?.unit === 't' ? ' t' : ' ' + commodityById(id)?.unit} ${commodityById(id)?.name ?? id}`);
      const line = document.createElement('span');
      line.className = 'cargo';
      line.textContent = `Hold: ${hold.join(' · ') || 'empty'}`;
      targetInfo.append(line);
    }
    targetInfo.classList.toggle('hostile', best.hostile);
  }
}

// --- Mouse aim display and controls help -------------------------------------

const reticle = $('#reticle');
const mousePrompt = $('#mouse-prompt');
let wasCaptured = false;

function updateAimDisplay() {
  const captured = isMouseCaptured();
  if (captured !== wasCaptured && controlScheme() === 'mouse' && !isTouch) {
    flash(captured ? 'Mouse aim · Esc to release' : 'Mouse released · click to fly', 1.5);
  }
  wasCaptured = captured;
  mousePrompt.hidden = !wantsMouseCapture();
  reticle.hidden = !captured || controlScheme() !== 'mouse' || view !== 'front';
  if (reticle.hidden) return;
  // Project the aim direction onto whichever canvas is showing.
  const p = camera.position.clone().addScaledVector(aim.dir, 1000).project(camera);
  const rect = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  const x = rect.left + ((p.x + 1) / 2) * rect.width;
  const y = rect.top + ((1 - p.y) / 2) * rect.height;
  reticle.style.transform = `translate(${x}px, ${y}px)`;
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
    hullChecked = true;
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

// --- The emergency beacon: fixed calls, from every ship --------------------------------

const beaconState = newBeacon();
let beaconOpen = false;
let beaconTimer = 0;

function toggleBeacon(show = !beaconOpen) {
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

function sendBeacon(call: BeaconCall) {
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
function updateRadio(dt: number) {
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
function updateContextButton() {
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
function toggleSurrender() {
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
  setAutopilot(false);
  flight.countdown = null;
  flight.surrenderTimer = SURRENDER_TIME;
  if (isTouch) setTouchSpeed(0); // the slider drops to all stop with you
  flash('Surrender signalled · all stop, weapons cold', 2.5);
}

/** Firing or throttling up calls it off. No crime in that: you're just not surrendering. */
function breakSurrender(why = 'Weapons fired') {
  flight.surrenderTimer = null;
  flash(`${why} · surrender withdrawn`, 2);
}

/** While surrendering, the ship brakes to a stop by itself; throttling up withdraws. */
function holdForSurrender(input: FlightInput) {
  if (flight.surrenderTimer === null) return;
  if (input.throttle > 0 || input.speedStep > 0 || (input.speedTarget ?? 0) > SURRENDER_SPEED) return breakSurrender('Throttle up');
  input.throttle = 0;
  input.speedTarget = 0;
}

function updateSurrender(dt: number) {
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
  setState('transition');
  sfx.tunnel();
  await playTunnel();
  const c = cmdr();
  const settlement = settle(c);
  saveCommander(c);
  // They know exactly who you are now: whatever you did dark here is settled too.
  defiedPolice = hullChecked = false;
  unpinned = hail = null;
  flight.transponderOff = flight.switchOnWhenClear = false;
  for (const n of ofRole('police')) if (n.target === player) n.target = null;
  enterDocked();
  flash(settlementMessage(settlement, 'You surrendered · record cleared'), 5);
}

// --- The kill cam's track (docs/design/kill-cam.md) ---------------------------
// The last minute of every ship your scanner saw, 20 times a second, and every
// shot and explosion, kept with the black box when you die so the insurers'
// screen can rebuild the fight from outside. Only what your ship knew.

const track = new TrackRecorder();
const trackIds = new WeakMap<object, number>();
let nextTrackId = 2; // 1 is you
let lastHitBy: { npc: NpcShip; at: number } | null = null;
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
  const killer = lastHitBy && flight.elapsed - lastHitBy.at < 5 ? lastHitBy.npc : null;
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
        setView(MOUNTS[(MOUNTS.indexOf(view) + 1) % MOUNTS.length]);
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
      planet: planet ? { position: planetPos, radius: flight.planetRadius } : null,
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

// Timer pauses while the tab is hidden, so there's no huge step on return.
const timer = new THREE.Timer();
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
