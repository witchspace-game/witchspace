// The flight recorder and its moments (moved from main.ts): the kill cam's track and dying,
// the recorder, the moments it keeps (fights, firsts and trades) and the kill cam itself.

import { sfx } from '../audio/sound';
import { shipById } from '../content/ships';
import { deleteCommander, hasEquipment, removeEquipment, saveCommander, hullOf } from '../game/commander';
import { claimInsurance } from '../game/insurance';
import { NpcShip } from '../game/npc';
import { signedIn, currentAccount } from '../net/account';
import { combatRating } from '../game/rating';
import { ledgerOf } from '../game/ledger';
import { filledLine, isRun, newSince, profitOf, runLine, runOf, seenNow } from '../game/tradeMoments';
import { loseContracts } from '../game/contracts';
import { collectHeld, STATION_CREW_RANGE, setAdrift } from '../game/assignments';
import { Explosion } from '../render/explosion';
import { camera, isRetro } from '../render/renderer';
import { takePhoto } from '../ui/photo';
import { clearFlash, flash } from '../ui/hud';
import { GOVERNMENTS, systemAt } from '../galaxy/generate';
import { commodityById } from '../economy/commodities';
import { activeEvent, EVENT_KINDS } from '../economy/events';
import { FlightRecorder, type Clip } from '../game/recorder';
import { RecorderWatch } from '../game/recorderWatch';
import { addMoment, attachTrack, deleteMoment, type LoggedMoment } from '../game/flightLog';
import { readTrack, TrackRecorder, trackBlob, type Pose } from '../game/track';
import { momentDescription, momentTags, momentTitle, whoIs, type MomentContext, type MomentEvent } from '../game/moments';
import { closeReplay, openReplay, renderFlightLog, setOutsideView, shareMoment } from '../ui/flightLog';
import { shareVideo as shareVideoPlain, KillCam } from '../ui/killCam';
import { $, cmdr, currentSystem, game } from '../core';
import { explosions, flight, missiles, sharedSpace, npcs, planetPos, player, space, station, SUN_POS } from '../scene';
import { myLook } from '../ui/shipyard';
import { carrier, marshalsStandDown } from './marshals';
import { spillCargo, spillSpecial } from './adrift';
import { npcIdentified } from './hud';
import { deathCam, hitFeedback, setAutopilot, setView } from './flying';
import * as THREE from 'three';

import type { State } from '../core';
import type { StarSystem } from '../galaxy/generate';
/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  setState: (next: State) => void;
  showTitle: () => void;
  enterDocked: (newShip?: boolean) => void;
  setFlightLog: (open: boolean) => void;
  planetColour: (sys: StarSystem) => string;
  handleKey: (code: string) => void;
};
export const initMoments = (hooks: typeof main) => Object.assign(main, hooks);

// --- The kill cam's track (docs/design/kill-cam.md) ---------------------------
// The last minute of every ship your scanner saw, 20 times a second, and every
// shot and explosion, kept with the black box when you die so the insurers'
// screen can rebuild the fight from outside. Only what your ship knew.

export const track = new TrackRecorder();
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

export function recordTrack() {
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

export function trackBeam(from: object, a: THREE.Vector3, b: THREE.Vector3, color: string, hit: object | null) {
  if (classicRules()) return;
  track.event({ t: flight.elapsed, kind: 'beam', from: trackId(from), a: a.toArray(), b: b.toArray(), color, ...(hit ? { hit: trackId(hit) } : {}) });
}

export function trackBoom(npc: NpcShip) {
  if (!classicRules()) track.event({ t: flight.elapsed, kind: 'boom', id: trackId(npc), p: npc.obj.position.toArray() });
}

function trackScene() {
  const sys = currentSystem();
  return { system: sys.name, when: Date.now(), you: 1, planet: { p: planetPos.toArray(), r: flight.planetRadius, color: main.planetColour(sys) }, sun: SUN_POS.toArray() };
}

export function die() {
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
  main.setState('dead');
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
      main.showTitle();
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
    main.enterDocked(true); // a new ship from the insurers
    flash(message, 5);
    void blackBox.then((m) => m && game.state === 'docked' && openReplay(m, 'Flight recorder recovered', refreshFlightLog, recorderIntroduced() ? undefined : RECORDER_INTRO));
  }, 5000);
}

// --- The flight recorder (docs/design/flight-recorder.md) --------------------
// The ship's black box: the last minute of the view, always, in memory.
// Moments worth keeping go to the flight log on this device; nothing leaves it
// unless the commander shares it.

const RECORDER_KEY = 'witchspace-recorder';
/** Classic stays as 1984 had it: no recorder (photos still work). */
export const classicRules = () => !!game.commander && cmdr().difficulty !== 'modern';
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
export const recorder = new FlightRecorder<MomentMeta>(recorderOn);
export const recorderWatch = new RecorderWatch();
const LEGENDS = new Set(['falcon']);

/** Whether anything is about worth recording: what the game knows is there, not just what the scanner shows. */
export function watchSurroundings(dt: number) {
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
export const viewCanvas = () => $<HTMLCanvasElement>(isRetro() ? '#retro' : '#neo');

/**
 * The name what you share carries: your account's callsign, signed in. A guest shares as "A commander",
 * as the site already titles them (Mark: "if they are flying as Jameson they are not signed in" — CMDR
 * Jameson is his); the share sheet offers to claim a callsign by email while it's free.
 */
const shareName = (): string | null => (signedIn() && currentAccount()?.callsign) || null;

export function momentContext(): MomentContext | null {
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
export function noticeTrades(): boolean {
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
    if (!isRun(r) || (tripBest.trip === game.flightFrom && profit <= tripBest.profit)) continue;
    tripBest = { trip: game.flightFrom, profit };
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
export async function logMoment({ events, ctx }: MomentMeta, media: Pick<LoggedMoment, 'video' | 'photo' | 'poster' | 'seconds'>): Promise<LoggedMoment | null> {
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
    trip: game.flightFrom,
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
export function keepMoment(event: MomentEvent, before: number, after: number, events: MomentEvent[] = [event]): Promise<LoggedMoment | null> {
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

export function keepCombat(event: MomentEvent, before: number, after: number): Promise<LoggedMoment | null> {
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
export const recorderIntroduced = () => {
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

export function refreshFlightLog() {
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
      if (game.logForIntro) {
        game.logForIntro = false;
        main.setFlightLog(false);
        flash(on ? 'Flight recorder on · your best moments wait in the flight log (F)' : 'Flight recorder off · turn it on again in the flight log (F)', 3);
        return;
      }
      refreshFlightLog();
    },
  });
}
void recorder.ready.then(() => game.state === 'docked' && refreshFlightLog());

/** Shift+P, or holding the camera button: keep the last 30 seconds yourself. */
export function keepByHand() {
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
    if (!long && held) main.handleKey('KeyP');
    held = 0;
  };
  cam.addEventListener('pointerup', release);
  cam.addEventListener('pointercancel', () => {
    clearTimeout(held);
    held = 0;
  });
}

// --- The kill cam (docs/design/kill-cam.md) -----------------------------------

export const killCam = new KillCam(camera);
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
