// What's said to you in flight (moved from main.ts): docking clearance and surrender, the context
// button ("what's next"), the radio and who's speaking (ui/radio.ts draws it), the comms array's
// offers and news, and distress calls.

import { sfx } from '../audio/sound';
import { cargoCapacity, cargoTonnes, isWorking, saveCommander } from '../game/commander';
import { checksClearance, legalStatus } from '../game/law';
import { isTouch, setTouchSpeed } from '../game/input';
import { NpcShip } from '../game/npc';
import { addStanding, board, BOARD_SLOT, cannotReserve, cargoName, COLLECT_JUMPS, destinationOf, reserve, reservedTonnes, type Contract } from '../game/contracts';
import { COMPANIES, type CompanyId } from '../game/companies';
import { voyageHail } from '../game/traffic';
import { UNIDENTIFIED_HEX } from '../render/shipModel';
import { stationName } from '../galaxy/stationNames';
import { flash } from '../ui/hud';
import { galaxy, systemAt, type StarSystem } from '../galaxy/generate';
import { quotes } from '../economy/trade';
import { eventsAt } from '../economy/events';
import { escapeHtml } from '../ui/escape';
import { onTap } from '../ui/touch';
import { COMPANY_SHORT, jobStrip, routeWork, workInReach, type JobStep } from '../game/jobs';
import { distressReward, hailReply, newsInReach, pirateAnswer, pirateThreat, RADIO_RANGE, tollFor, type HailContext, type Speaker } from '../game/radio';
import { say, setRadioFight, type RadioAction, type RadioKind, type RadioOpts } from '../ui/radio';
import { $, cmdr, currentSystem, game, modern } from '../core';
import { flight, sharedSpace, npcs, ofRole, planetPos, player, station } from '../scene';
import { plotCourse } from '../ui/contracts';
import { tradeContext } from '../ui/market';
import { BOUNTIES, MAX_PIRATES, addNpc, escortOf, flyForCompany, legs, onSlotAxis, randomCargo, removeNpc, voyageOf } from './traffic';
import { sightedNpc } from './missiles';
import * as THREE from 'three';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  isFugitive: () => boolean;
  transponderBroken: () => boolean;
  dark: () => boolean;
  identified: () => boolean;
  transponderOnToDock: () => boolean;
  toggleTransponder: () => void;
  darkRefused: () => boolean;
  npcIdentified: (npc: NpcShip) => boolean;
  updateContextButton: () => void;
  toggleSurrender: () => void;
};
export const initComms = (hooks: typeof main) => Object.assign(main, hooks);

// --- Docking clearance and surrender ------------------------------------------------

export const CLEARANCE_RANGE = 5000; // metres

/** Fugitives are turned away by any station that checks; anarchies and feudal worlds don't. */
export const clearanceRefused = () => checksClearance(currentSystem()) && main.isFugitive();
/** A station in lockdown (something got loose aboard) lets nobody in. */
export const lockedDown = () => eventsAt(currentSystem(), Date.now(), Date.now()).some((e) => e.type === 'lockdown');

export function updateClearance() {
  const d = player.obj.position.distanceTo(station.root.position);
  if (d > CLEARANCE_RANGE * 1.6) flight.clearanceAnnounced = false;
  if (flight.clearanceAnnounced || d > CLEARANCE_RANGE) return;
  flight.clearanceAnnounced = true;
  const name = stationName(currentSystem()).name;
  // Running dark into a lawful station: switch on to dock, if that's safe.
  if (main.darkRefused() && !lockedDown() && !clearanceRefused() && !main.transponderOnToDock()) return;
  if (lockedDown()) radio('station', name, 'Lockdown: containment breach · docking suspended', { flash: 4, urgent: true });
  else if (clearanceRefused()) radio('station', name, 'Docking refused: you are a Fugitive · U to surrender', { flash: 4, urgent: true, answers: [answerSurrender()] });
  else if (main.darkRefused()) radio('station', name, 'Unidentified ship: switch on your transponder to dock', { flash: 4, urgent: true });
  else if (checksClearance(currentSystem())) radio('station', name, 'Transponder checked · Docking clearance granted', { flash: 2.5 });
  else radio('station', name, 'No questions asked', { flash: 2.5 });
  if (!lockedDown() && !clearanceRefused()) setTimeout(() => game.state === 'flying' && offerRouteWork(), 3000);
}

// --- What you're doing, and what's next (docs/design/flight-hud-and-touch.md) -------

/** Offers already mentioned, so traffic control says each once. */
const routeWorkSaid = new Set<string>();

/** Approaching a station: traffic control mentions one job on its board that goes your way. */
function offerRouteWork() {
  const c = cmdr();
  if (c.difficulty !== 'modern') return;
  const here = currentSystem();
  const now = Date.now();
  const fit = routeWork(c, here, board(c, here, now), cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
  if (!fit || routeWorkSaid.has(fit.offer.id)) return;
  routeWorkSaid.add(fit.offer.id);
  const o = fit.offer;
  const what = `${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}`;
  radio('station', stationName(here).name, `${COMPANY_SHORT[o.company]} has ${what}, ${fit.why} · ${o.pay.toLocaleString()} Cr · dock to take it`, { flash: 5 });
  routeMessage(o, here, fit.why);
  saveCommander(c);
}

const jobBox = $('#job');
let jobStep: JobStep | null = null;
let jobKey = '';
let jobTimer = 0;
let jobListOpen = false;
/** A fight under way, and how long it's been quiet: when it's over, the computer says what's next. */
const fight = { on: false, calm: 0 };
export const FIGHT_RANGE = 8000; // metres
const CALM_AFTER = 4; // seconds without a hostile in range

export function updateJob(dt: number) {
  const pos = player.obj.position;
  const hostile =
    npcs.some((n) => n.hostile && n.obj.position.distanceTo(pos) < FIGHT_RANGE) ||
    [...sharedSpace.remotes.values()].some((r) => sharedSpace.isHostile(r) && r.position.distanceTo(pos) < FIGHT_RANGE);
  if (hostile) {
    // A fight: the strip folds away to keep the screen clear, and so does the radio log.
    if (!fight.on && jobOpen) {
      jobOpen = false;
      jobKey = '';
    }
    if (!fight.on) setRadioFight(true);
    Object.assign(fight, { on: true, calm: 0 });
  }
  else if (fight.on && (fight.calm += dt) >= CALM_AFTER) {
    fight.on = false;
    setRadioFight(false);
    const s = cmdr().difficulty === 'modern' ? jobStrip(cmdr(), currentSystem()) : null;
    if (s) radio('company', COMPANIES[s.step.contract.company].name, `Back on course · ${s.step.line.split(' · ')[0]} · ${s.step.next}`, { colour: COMPANIES[s.step.contract.company].colour });
  }
  jobTimer -= dt;
  if (jobTimer > 0) return;
  jobTimer = 0.5;
  renderJob();
  main.updateContextButton();
}

function renderJob() {
  const s = cmdr().difficulty === 'modern' ? jobStrip(cmdr(), currentSystem()) : null;
  jobStep = s?.step ?? null;
  jobBox.hidden = !s;
  if (!s) return;
  const key = JSON.stringify([s.all.map((x) => [x.line, x.next]), jobListOpen, jobOpen]);
  if (key === jobKey) return;
  jobKey = key;
  jobBox.className = `${s.step.urgency}${s.step.action === 'course' ? ' actionable' : ''}${jobOpen ? ' open' : ''}`;
  $('#job .job-short').textContent = `▸ ${s.step.short}${s.more ? ` · +${s.more}` : ''}`;
  $('#job .job-line').textContent = `▸ ${s.step.line}`;
  $('#job .job-next').textContent = `Next: ${s.step.next}`;
  const go = $('#job .job-go');
  go.hidden = !(s.step.action === 'course' && s.step.hop);
  go.textContent = `Set course · ${s.step.hop?.name ?? ''}`;
  const more = $('#job .job-more');
  more.hidden = !s.more;
  more.textContent = jobListOpen ? 'Hide' : `+${s.more} more`;
  const list = $('#job .job-list');
  list.hidden = !jobListOpen || !s.more;
  list.innerHTML = s.all
    .slice(1)
    .map((x) => `<li>${escapeHtml(x.line)}<small>${escapeHtml(x.next)}</small></li>`)
    .join('');
}

/** On a phone, the strip is a pill until tapped open. */
let jobOpen = false;
onTap($('#job .job-main'), () => {
  if (isTouch) jobOpen = !jobOpen;
  else if (jobStep?.action === 'course' && jobStep.end) setJobCourse();
  jobKey = '';
  renderJob();
});
onTap($('#job .job-go'), setJobCourse);
function setJobCourse() {
  if (!jobStep?.end) return;
  flash(plotCourse(cmdr(), jobStep.end.index), 2.5);
  saveCommander(cmdr());
  jobKey = '';
  renderJob();
}
onTap($('#job .job-more'), () => {
  jobListOpen = !jobListOpen;
  jobKey = '';
  renderJob();
});
// A tap anywhere else folds the list away again.
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!jobListOpen || $('#job').contains(e.target as Node)) return;
    jobListOpen = false;
    jobKey = '';
    renderJob();
  },
  true,
);

// --- The radio (docs/design/radio-and-comms.md) -------------------------------------
// Under Modern rules, everything said to you in flight goes in the radio log:
// station traffic, police, pirates, traders and the companies, each in its
// own colour. The few lines that matter this second still flash as well.
// Classic keeps its flashes, as in 1984.

/** A working comms array: the companies reach you anywhere, and you hear further. */
export const hasArray = () => modern() && isWorking(cmdr(), 'comms-array');

export function radio(kind: RadioKind, from: string, text: string, o: RadioOpts = {}) {
  const line = o.line ?? `${from} · ${text}`;
  if (!modern()) {
    if (o.flash) flash(line, o.flash);
    return;
  }
  say({ kind, from, text, colour: o.colour, action: o.action, answers: o.answers });
  // A card carries the words itself; flash only what has no card.
  if (o.urgent && o.flash && !o.answers?.length && !o.action) flash(line, o.flash);
}

const companyVoice = (id: CompanyId) => ({ from: COMPANIES[id].name, colour: COMPANIES[id].colour });

/** The companies' notes (the ones kept in Messages) are heard on the radio too. */
export const messageIds = () => new Set((cmdr().messages ?? []).map((m) => m.id));
export function radioMessages(seen: Set<string>) {
  if (!modern()) return;
  for (const m of [...(cmdr().messages ?? [])].reverse()) {
    if (seen.has(m.id)) continue;
    say({ kind: 'company', ...companyVoice(m.company), ...(m.from ? { from: m.from } : {}), text: `${m.subject}: ${m.body}` });
  }
}

// Who's speaking, and what they know: a ship's serial and how often you've
// hailed it pick the line (the station's, the minute).
const serials = new WeakMap<NpcShip, number>();
let nextSerial = 0;
const serialOf = (n: NpcShip) => serials.get(n) ?? (serials.set(n, ++nextSerial), nextSerial);
const minute = () => Math.floor(Date.now() / 60_000);
const hailsOf = new WeakMap<NpcShip, number>();

export function speakerOf(npc: NpcShip): { who: Speaker; kind: RadioKind; from: string; colour?: string } {
  if (!main.npcIdentified(npc)) return { who: npc.def.id === 'falcon' ? 'falcon' : npc.role === 'trader' ? 'trader' : 'pirate', kind: 'ship', from: `Unidentified ${npc.def.name}`, colour: UNIDENTIFIED_HEX };
  if (npc.def.id === 'falcon') return { who: 'falcon', kind: 'pirate', from: 'Falcon' };
  if (npc.guard && npc.company) return { who: 'security', kind: 'police', from: `${COMPANIES[npc.company].name} ${escortOf.has(npc) ? 'escort' : 'yard security'}`, colour: COMPANIES[npc.company].colour };
  switch (npc.role) {
    case 'police':
      return { who: 'police', kind: 'police', from: `${currentSystem().name} police` };
    case 'marshal':
      return { who: 'marshal', kind: 'police', from: 'Co-operative Marshals', colour: '#ffd98a' };
    case 'trader':
      return { who: 'trader', kind: 'ship', from: traderName(npc), colour: traderColour(npc) };
    default:
      return { who: 'pirate', kind: 'pirate', from: npc.def.name };
  }
}

function hailContext(k: number, npc?: NpcShip): HailContext {
  const sys = currentSystem();
  return {
    system: sys,
    k,
    status: legalStatus(cmdr()),
    dark: main.dark() && !main.identified(),
    scared: npc ? npc.attackedAgo < 12 : false,
    wronged: npc ? npc.attacker === player && npc.attackedAgo < 120 : false,
    company: npc?.company ? COMPANIES[npc.company].name : undefined,
    escort: npc ? escortOf.has(npc) : undefined,
    lawless: !checksClearance(sys),
  };
}

/** What's in your hold, as a pirate's scanner reads it. */
function playerHoldValue(): number {
  const prices = new Map(quotes(tradeContext()).map((q) => [q.commodity.id, q.price]));
  return Object.entries(cmdr().cargo).reduce((v, [id, q]) => v + q * (prices.get(id) ?? 0), 0);
}

/** L: hail the ship in your sights (or your missile's target); with nothing there, the station. */
export function hailTarget() {
  if (!modern()) return flash('Classic rules: only the station talks to you', 1.5);
  const pos = player.obj.position;
  const npc = (flight.locked && npcs.includes(flight.locked) ? flight.locked : null) ?? sightedNpc(RADIO_RANGE, isTouch ? 14 : 8);
  sfx.beep();
  if (npc) {
    const sp = speakerOf(npc);
    const d = npc.obj.position.distanceTo(pos);
    if (d > RADIO_RANGE) return radio('ship', 'Radio', `No answer from the ${npc.def.name}: ${(d / 1000).toFixed(1)} km, out of radio range`);
    // Ask again and you may get another line; the same ship, asked the same number of times, says the same.
    const asked = (hailsOf.get(npc) ?? 0) + 1;
    hailsOf.set(npc, asked);
    const ctx = hailContext(serialOf(npc) * 1000 + asked, npc);
    if (npc.paid) return radio('pirate', sp.from, "We had a deal. Don't push it.");
    const voyage = voyageOf.get(npc);
    if (voyage && asked === 1 && main.npcIdentified(npc) && !ctx.scared && !ctx.wronged)
      return radio(sp.kind, sp.from, voyageHail(voyage, galaxy(currentSystem().galaxy)[voyage.other].name), { colour: sp.colour });
    if (sp.who === 'pirate' && main.npcIdentified(npc)) {
      const r = pirateAnswer(ctx, playerHoldValue(), cmdr().credits);
      return radio('pirate', sp.from, r.text, { colour: sp.colour, answers: r.toll ? [payOff(npc, r.toll), noDeal(npc)] : undefined, flash: r.toll ? 4 : undefined, urgent: Boolean(r.toll) });
    }
    return radio(sp.kind, sp.from, hailReply(sp.who, ctx).text, { colour: sp.colour });
  }
  const d = pos.distanceTo(station.root.position);
  const name = stationName(currentSystem()).name;
  if (d > CLEARANCE_RANGE && !hasArray()) return radio('station', 'Radio', `Nothing in your sights, and ${name} is out of range: traffic control answers within ${CLEARANCE_RANGE / 1000} km`);
  radio('station', name, hailReply('station', hailContext(minute())).text);
}

/** A pirate's price, on the radio: pay it, and the band leaves you be. */
function payOff(npc: NpcShip, toll: number): RadioAction {
  return {
    label: `Pay ${toll} Cr`,
    done: 'Paid',
    until: Date.now() + 30_000,
    run: () => {
      const c = cmdr();
      if (!npcs.includes(npc)) return { kind: 'pirate', from: npc.def.name, text: '...' };
      if (c.credits < toll) return { kind: 'pirate', from: npc.def.name, text: "Can't pay? Then we'll take it." };
      c.credits = Math.round((c.credits - toll) * 10) / 10;
      saveCommander(c);
      const away = npc.obj.position.clone().sub(player.obj.position).normalize();
      for (const p of ofRole('pirate').filter((p) => p.obj.position.distanceTo(npc.obj.position) < 3000)) {
        Object.assign(p, { paid: true, fights: false, hostile: false, target: null, mode: 'travel' });
        p.destination = p.obj.position.clone().addScaledVector(away, 30000);
      }
      return { kind: 'pirate', from: npc.def.name, text: `Pleasure doing business. ${toll} Cr paid; we never saw you.` };
    },
  };
}

/** Turning a pirate's price down: they say so, and get on with it. */
function noDeal(npc: NpcShip): RadioAction {
  return { label: 'No deal', done: 'Refused', until: Date.now() + 30_000, run: () => ({ kind: 'pirate', from: npc.def.name, text: npcs.includes(npc) ? 'Your funeral, Commander.' : '...' }) };
}

/**
 * Answering a pirate's threat (Mark: answering the radio should be easy). Ask their price: with
 * something worth taking in your hold, and the credits to pay, they name one; or tell them to come
 * and take it, which changes nothing but your dignity.
 */
function answerPirate(p: NpcShip): RadioAction[] {
  const until = Date.now() + 20_000;
  return [
    {
      label: 'Name your price',
      done: 'Asked',
      until,
      run: () => {
        if (!npcs.includes(p) || p.paid) return null;
        const hold = playerHoldValue();
        const toll = tollFor(hold);
        if (hold <= 0) return { kind: 'pirate', from: p.def.name, text: "Nothing in your hold worth the trouble. We'll take the ship." };
        if (cmdr().credits < toll) return { kind: 'pirate', from: p.def.name, text: `${toll} Cr. You haven't got it, have you? Then we'll take the cargo.` };
        radio('pirate', p.def.name, `${toll} Cr and we never saw you.`, { answers: [payOff(p, toll), noDeal(p)], flash: 4, urgent: true });
        return null;
      },
    },
    { label: 'Come and take it', done: 'Defied', until, run: () => ({ kind: 'pirate', from: p.def.name, text: npcs.includes(p) ? 'Brave words, Commander. Let\'s see your shields.' : '...' }) },
  ];
}

/** Answering the police's order: switch on, or hold still for a hull read if it's broken. */
export function answerPolice(): RadioAction[] {
  if (main.transponderBroken() && !flight.transponderOff)
    return [{ label: 'Hold still', done: 'Holding still', run: () => {
      if (isTouch) setTouchSpeed(0);
      flash('Slow right down and hold still · they\'ll read your hull', 2.5);
      return { kind: 'police', from: 'You', text: 'Transponder damaged. Holding still for your scan.' };
    } }];
  return [{ label: 'Switch on', done: 'Switched on', run: () => {
    if (flight.transponderOff) main.toggleTransponder();
    return null;
  } }];
}

/** Answering a Mayday: you're coming, and the trader knows it (the Carriers' Mutual remembers who answered). */
function onMyWay(trader: NpcShip): RadioAction {
  return { label: 'On my way', done: 'On your way', until: Date.now() + 40_000, run: () => {
    if (!npcs.includes(trader)) return null;
    const d = trader.obj.position.distanceTo(player.obj.position);
    return { kind: 'mayday', from: traderName(trader), colour: traderColour(trader), text: `Thank you, Commander! ${(d / 1000).toFixed(1)} km, follow our marker. Hurry!` };
  } };
}

/** Surrendering when asked to: the same as U. */
export function answerSurrender(): RadioAction {
  return { label: 'Surrender', done: 'Surrendering', run: () => {
    if (flight.surrenderTimer === null) main.toggleSurrender();
    return null;
  } };
}

// Pirates say something before they open fire, if you're in range to hear.
const threatened = new WeakSet<NpcShip>();
let lastThreat = -Infinity;
export function pirateThreats() {
  for (const p of ofRole('pirate')) {
    if (!p.hostile || threatened.has(p)) continue;
    threatened.add(p);
    if (flight.elapsed - lastThreat < 20 || !main.npcIdentified(p) || p.obj.position.distanceTo(player.obj.position) > RADIO_RANGE) continue;
    lastThreat = flight.elapsed;
    radio('pirate', p.def.name, pirateThreat(hailContext(serialOf(p) * 1000 + (minute() % 1000), p)), { answers: answerPirate(p) });
  }
  // Paid-off pirates, gone over the horizon.
  for (const p of ofRole('pirate')) if (p.paid && p.obj.position.distanceTo(player.obj.position) > 25000) removeNpc(p);
}

// --- The comms array: the companies reach you anywhere ---------------------------------

/** Offers already put to you over the array. */
const offersHeard = new Set<string>();
const newsHeard = new Set<string>();

/** Keep the company's note in Messages, as traffic control's mention does. */
function routeMessage(o: Contract, at: StarSystem, why: string) {
  const c = cmdr();
  const id = `route:${o.id}`;
  if (c.messages?.some((m) => m.id === id)) return;
  const what = `${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}`;
  c.messages = [{ id, company: o.company, subject: 'Work on your route', body: `${what} at ${stationName(at).name}, ${at.name}: ${why}. ${o.pay.toLocaleString()} Cr on delivery.${o.until ? ` On the board until ${new Date(o.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}`, at: Date.now() }, ...(c.messages ?? [])].slice(0, 20);
}

/** Work on your route from here and your next jump, with an Accept button. */
export function arrayOffers() {
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  const next = c.target !== null && c.target !== here.index ? systemAt(here.galaxy, c.target) : null;
  const free = cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c) - reservedTonnes(c);
  for (const { offer: o, why, at } of workInReach(c, here, next, now, free)) {
    if (offersHeard.has(o.id) || cannotReserve(c, o)) continue;
    offersHeard.add(o.id);
    if (at === here) routeWorkSaid.add(o.id); // traffic control needn't say it again
    routeMessage(o, at, why);
    const where = at === here ? stationName(here).name : `${stationName(at).name}, ${at.name}`;
    radio('company', COMPANIES[o.company].name, `Work on your route: ${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}, ${why} · waiting at ${where} · ${o.pay.toLocaleString()} Cr`, {
      colour: COMPANIES[o.company].colour,
      action: acceptOffer(o, at),
    });
  }
  saveCommander(c);
}

/** Accept over the array: reserved now, collected when you dock where it waits. */
function acceptOffer(o: Contract, at: StarSystem): RadioAction {
  const voice = { kind: 'company' as const, ...companyVoice(o.company) };
  return {
    label: 'Accept',
    done: 'Accepted',
    until: o.until ?? (Math.floor(Date.now() / BOARD_SLOT) + 1) * BOARD_SLOT,
    run: () => {
      const c = cmdr();
      if (!isWorking(c, 'comms-array')) return { ...voice, text: "We can't hear you: your comms array is down. Dock and take it at the station." };
      if (!board(c, at, Date.now()).some((x) => x.id === o.id)) return { ...voice, text: "Sorry, Commander: that one's gone to someone else." };
      const why = reserve(c, o);
      if (why) return { ...voice, text: why };
      saveCommander(c);
      sfx.beep();
      jobKey = '';
      renderJob();
      return { ...voice, text: `Accepted: ${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}. We'll hold it at ${stationName(at).name}, ${at.name}: collect it within ${COLLECT_JUMPS} jumps, and the clock starts when it's loaded.` };
    },
  };
}

/** Market news from a jump or two out, before the station's news has it. */
export function arrayNews() {
  for (const n of newsInReach(currentSystem(), Date.now())) {
    const key = `${n.where.galaxy}:${n.where.index}:${n.event.start}`;
    if (newsHeard.has(key)) continue;
    newsHeard.add(key);
    radio('news', 'Comms array', n.line);
  }
}

// --- Distress calls ---------------------------------------------------------------------
// A trader under attack by pirates calls for help. You hear it within radio
// range, or anywhere in the system with the array, which also picks up
// attacks far out in the lanes. Get there while the pirates are still at it
// and see them off (destroyed or running), and the trader's company pays a
// little and remembers; the Carriers' Mutual remembers more.

interface Distress {
  trader: NpcShip;
  pirates: Set<NpcShip>;
  heard: boolean;
  /** You got there while it was still going on. */
  arrived: boolean;
  until: number;
}
export const distresses: Distress[] = [];
const DISTRESS_ARRIVE = 5000; // metres: close enough to count as answering
const DISTRESS_TIME = 240; // seconds a call stays open
const DISTRESS_PIRATE_RANGE = 6000; // metres: pirates further than this from the trader have given up
/** Damage a trader under attack takes while it calls for help: about a minute and a half against one pirate. */
export const DISTRESS_SHIELDING = 0.4;

export const traderName = (t: NpcShip) => `${t.company ? `${COMPANIES[t.company].name} ` : ''}${t.def.name}${voyageOf.get(t) ? ` ${voyageOf.get(t)!.name}` : ''}`;
export const traderColour = (t: NpcShip) => (t.company ? COMPANIES[t.company].colour : '#9ef0c0');

export function distressCall(trader: NpcShip, pirate: NpcShip) {
  if (!modern()) return;
  const known = distresses.find((x) => x.trader === trader);
  if (known) {
    known.pirates.add(pirate);
    return;
  }
  const d = trader.obj.position.distanceTo(player.obj.position);
  const heard = game.state === 'flying' && (d < RADIO_RANGE || hasArray());
  distresses.push({ trader, pirates: new Set([pirate]), heard, arrived: false, until: flight.elapsed + DISTRESS_TIME });
  if (!heard) return;
  sfx.beep();
  radio('mayday', traderName(trader), `Mayday! Pirates on us, ${(d / 1000).toFixed(1)} km from you. Anyone?`, { colour: traderColour(trader), flash: 3.5, urgent: true, answers: [onMyWay(trader)] });
}

export function updateDistress() {
  const pos = player.obj.position;
  for (let i = distresses.length - 1; i >= 0; i--) {
    const d = distresses[i];
    const t = d.trader;
    if (!npcs.includes(t) || flight.elapsed > d.until) {
      distresses.splice(i, 1);
      continue;
    }
    const still = [...d.pirates].filter((p) => npcs.includes(p) && !p.paid && p.mode !== 'flee' && p.obj.position.distanceTo(t.obj.position) < DISTRESS_PIRATE_RANGE);
    if (still.length && pos.distanceTo(t.obj.position) < DISTRESS_ARRIVE) d.arrived = true;
    if (still.length) continue;
    distresses.splice(i, 1);
    if (d.arrived && game.state === 'flying') rescued(d);
  }
}

function rescued(d: Distress) {
  const c = cmdr();
  const t = d.trader;
  const r = distressReward(d.pirates.size, t.company);
  c.credits = Math.round((c.credits + r.credits) * 10) / 10;
  if (t.company) {
    addStanding(c, t.company, r.standing);
    const mutual = t.company === 'mutual';
    c.messages = [
      {
        id: `rescue:${t.company}:${Date.now()}`,
        company: t.company,
        subject: mutual ? 'The Mutual remembers' : 'With thanks',
        body: mutual
          ? `You answered one of our crews' calls in ${currentSystem().name} and saw the pirates off. ${r.credits} Cr, and the Mutual's thanks. We look after those who look after us.`
          : `You saw pirates off one of our ships in ${currentSystem().name}. ${r.credits} Cr, with our thanks.`,
        at: Date.now(),
      },
      ...(c.messages ?? []),
    ].slice(0, 20);
  }
  saveCommander(c);
  sfx.beep();
  radio('ship', traderName(t), `Thank you, Commander. ${r.credits} Cr, with our thanks${r.standing ? ` · ${COMPANIES[t.company!].name} standing +${r.standing}` : ''}`, { colour: traderColour(t), flash: 4, urgent: true });
}

/** With the array you hear attacks far out in the lanes: now and then, one starts somewhere you can't see. */
export function spawnDistress(): boolean {
  const room = MAX_PIRATES - ofRole('pirate').filter((p) => !p.paid).length;
  if (room < 1) return false;
  for (let tries = 0; tries < 8; tries++) {
    const at = player.obj.position.clone().addScaledVector(new THREE.Vector3().randomDirection(), 13000 + Math.random() * 7000);
    if (at.distanceTo(station.root.position) < 7000 || at.distanceTo(planetPos) < flight.planetRadius * 1.4) continue;
    const trader = addNpc('cobra-mk3', 'trader', at);
    flyForCompany(trader);
    trader.cargo = randomCargo();
    trader.obj.lookAt(station.root.position);
    trader.ship.speed = trader.ship.maxSpeed * 0.5;
    trader.destination = onSlotAxis(900);
    legs.set(trader, 'inbound');
    const band = Math.min(room, Math.random() < 0.4 ? 2 : 1);
    for (let i = 0; i < band; i++) {
      const def = Math.random() < 0.6 ? 'sidewinder' : 'mamba';
      const p = addNpc(def, 'pirate', at.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(1500)), at);
      p.obj.lookAt(at);
      p.ship.speed = p.ship.maxSpeed * 0.5;
      p.bounty = BOUNTIES[def] ?? 40;
      Object.assign(p, { target: trader.ship, mode: 'attack' });
    }
    return true;
  }
  return false;
}
