// The shipyard (moved from main.ts): a showroom of hulls for now, the configurator's spec for the one
// you're looking at, the yard's orders, editions signed over to you, and boarding a ship you own.

import { sfx } from '../audio/sound';
import { shipById, ships } from '../content/ships';
import type { ShipDef } from '../content/types';
import { cargoTonnes, EQUIPMENT, saveCommander, type Commander, type EquipmentId, hullOf, type ShipOrder } from '../game/commander';
import { signedIn } from '../net/account';
import { EDITIONS, editionById, editionNo, type Edition } from '../content/editions';
import { papersFor } from '../game/papers';
import { showHandover } from './handover';
import { accountSpec, editionCounts, forgetAccountSpec, heldEditions, papersLinkFor, signedOver } from '../net/shipyard';
import { clearLocalSpec, localSpec, newerSpec, validSpec, type WaitingSpec } from '../game/spec';
import { enablePush, needsHomeScreen } from '../net/notify';
import { ORDERABLE_LUXURIES, standardKit, cancelOrder, collection, collectOrder, giftTradeIn, tradeIn, deliverShip, deliveryQuote, swapShip, defaultSpec, laserLocked, ORDERABLE, paintable, repaint, repaintLabour, repaintQuote, standardLaser, editionGiftSpec, editionQuote, editionSpec, depositFor, fitScale, GLOWS, LUXURIES, PALETTE, placeOrder, priceLines, production, PRODUCTION_HOURS, quote, TRIM_PRICE, UPGRADES, type GlowId, type Spec } from '../game/shipyard';
import { PLAYER_LASERS, type LaserId } from '../game/weapons';
import { inYards } from '../game/manual';
import { jumpsBetween } from '../game/contracts';
import { buildPainted, disposeShip, type Look } from '../render/shipModel';
import { stationName } from '../galaxy/stationNames';
import { flash, setDashColour } from './hud';
import { distanceLy, systemAt, type StarSystem } from '../galaxy/generate';
import { escapeHtml } from './escape';
import { $, cmdr, currentSystem, game } from '../core';
import { player } from '../scene';
import { openManual } from './manual';
import { markInbox, plotCourse } from './contracts';
import { openBooth, ownIndex, resetShowroomView, shipIndex, showShip, showroom, showroomModels } from './showroom';

// --- The shipyard: a showroom for now ------------------------------------------
// Higher-tech stations show the hulls you'll be able to buy, each turning in the
// berth, and the makers' concepts, coming soon (docs/design/ships-and-classes.md:
// "something to drool over"). Buying, selling and trading in come later.

/** Stations with a shipyard: the better-built worlds. */
const SHIPYARD_TECH = 7;
export const hasShipyard = (s: StarSystem) => s.techLevel >= SHIPYARD_TECH;
let yardPick: string | null = null;
/** The ship being specced, while the configurator is open. */
let spec: Spec | null = null;
/** Leaving the yard: your own ship back in the berth, the yard's hulls in their own glow. */
export function clearSpec() {
  spec = null;
}
/** What the configurator is doing: your own spec, naming a numbered edition, or a gift signed over to you. */
let yardMode: 'spec' | 'edition' | 'gift' | 'repaint' = 'spec';
/** The special edition you're looking at in the yard, if any. */
let editionSel: string | null = null;
let editionsLeft: Record<string, { limit: number; taken: number }> = {};
let editionsAsked = 0;
/** Special editions are by invitation (Mark): signed over by the maker, never reserved at the counter. */
const INVITATION = '<p class="yard-note yard-invite"><b>If you have to ask, you can’t afford one.</b> Special editions are by invitation: for now, the maker signs them over to the people who build Witchspace.</p>';
let yardMessage = '';
/** A ship specced on the site, waiting for you at the next shipyard: the newer of this browser's and your account's. */
let siteSpec: WaitingSpec | null = null;

/** Look for a spec from the site; when there is one and nothing's in production, the yard says so. */
export async function checkSiteSpec(announce: boolean) {
  siteSpec = localSpec();
  if (signedIn()) {
    const r = await accountSpec();
    const spec = 'error' in r ? null : validSpec(r.spec);
    if (spec && !('error' in r) && r.at) siteSpec = newerSpec(siteSpec, { spec, at: r.at });
  }
  const def = siteSpec && shipById(siteSpec.spec.ship);
  if (!def || cmdr().order || game.state !== 'docked' || !hasShipyard(currentSystem())) return;
  if (announce) flash(`The yard: your ${def.name} spec from the website is here · see the Shipyard`, 5);
  if (game.dockTab === 'shipyard' && !spec) renderShipyard();
}

/**
 * A ship signed over to you by the yard's office (no code to type: Mark, for Mark Moxon's 001): she
 * becomes your gift, waiting at the maker's own yard, and the maker writes to say so. Asked on load
 * and on docking, signed in; one already had (waiting, on order, or flown) is left alone.
 */
/** The maker hands over the keys: her certificate, full screen (the edition delivery pack). */
function handOver(c: Commander, def: ShipDef, ed: Edition) {
  const number = c.paint!.edition!.number;
  // The maker's letter now points to her papers.
  const letter = c.messages?.find((m) => m.id === `gift:${def.id}:${ed.id}:${number}`);
  if (letter && !letter.body.includes('Her papers')) {
    letter.body += ' Her papers: see your certificate, linked in her owner’s manual.';
    saveCommander(c);
  }
  showHandover($('#handover'), {
    papers: papersFor(ed, number, def.name, { galaxy: currentSystem().galaxy, system: currentSystem().index }),
    maker: def.manufacturer ?? 'The yard',
    name: c.paint?.name ?? '',
    callsign: c.name,
    at: Date.now(),
    link: papersLinkFor(ed.id, number),
  }, () => renderShipyard());
}

export async function checkSignedOver() {
  if (!signedIn() || !game.commander || game.commander.difficulty !== 'modern') return;
  const r = await signedOver();
  if ('error' in r) return;
  const c = cmdr();
  for (const g of r.gifts) {
    const def = shipById(g.ship);
    const id = `gift:${g.ship}:${g.edition ?? ''}:${g.number ?? ''}`;
    const same = (e?: { id: string; number: number }) => Boolean(g.edition && e && e.id === g.edition && e.number === g.number);
    if (!def || c.messages?.some((m) => m.id === id) || same(c.gift?.edition) || same(c.order?.edition) || same(c.paint?.edition) || c.fleet?.some((f) => same(f.paint?.edition)) || (c.gift && !g.edition)) continue;
    const at = systemAt(g.galaxy, g.system);
    const edition = g.edition ? editionById(g.edition) : undefined;
    const what = edition && g.number ? `${edition.name} ${editionNo(g.number)}` : `A ${def.name}`;
    c.gift = { ship: g.ship, ...(edition && g.number ? { edition: { id: edition.id, number: g.number } } : {}), at: { galaxy: g.galaxy, system: g.system } };
    c.messages = [
      {
        id,
        company: 'hexon' as const, // shown as from the maker, not a company
        from: def.manufacturer ?? 'The yard',
        subject: `${what} is yours`,
        body: `Commander ${c.name}, ${what} has been signed over to you, built and paid for. She's waiting at our own yard, ${stationName(at).name}, ${at.name}. Bring your ship: keep her in your hangar or let us take her, and we'll hand you the keys.`,
        at: Date.now(),
      },
      ...(c.messages ?? []),
    ].slice(0, 20);
    saveCommander(c);
    markInbox(c);
    flash(`${def.manufacturer ?? 'The yard'}: ${what} has been signed over to you · see Contracts`, 6);
    if (game.state === 'docked' && game.dockTab === 'shipyard' && !spec) renderShipyard();
  }
}

/** The site's spec is ordered: it's done with, here and on the account. */
function forgetSiteSpec() {
  if (!siteSpec) return;
  siteSpec = null;
  clearLocalSpec();
  if (signedIn()) void forgetAccountSpec();
}

const berthLooks: string[] = [];

/** A hull in the berth in another finish: rebuilt from its file with the look changed. */
function recolourShowroom(i: number, look: Look) {
  const base = ships[i];
  const key = `${look.colour}|${look.glow}|${look.trim ?? ''}|${look.lights ? 'l' : ''}`;
  if ((berthLooks[i] ?? `${base.style.lineColor}|${base.style.glow ?? 1}||`) === key) return;
  berthLooks[i] = key;
  const old = showroomModels[i];
  const m = buildPainted(base, look);
  showroom.scene.remove(old.root);
  disposeShip(old);
  showroom.scene.add(m.root);
  m.root.visible = i === shipIndex;
  showroomModels[i] = m;
}
const plainLook = (def: ShipDef): Look => ({ colour: def.style.lineColor, glow: def.style.glow ?? 1, trim: null });
const paintLook = (def: ShipDef, p: { colour: string; glow?: GlowId; trim?: string | null; luxuries?: string[]; ghost?: boolean }): Look => ({
  colour: p.colour,
  glow: GLOWS[p.glow ?? 'standard'].glow * (def.style.glow ?? 1),
  trim: p.trim ?? null,
  // Black-light running lights, unless the owner flies her as a full ghost.
  ...(p.luxuries?.includes('black-light-lights') && !p.ghost ? { lights: true } : {}),
});

/** Your own ship's look, for the kill cam, clips and other commanders; null in the maker's colours. */
export const myLook = (): Look | null => {
  const c = game.commander;
  return c?.paint ? paintLook(player.def, c.paint) : null;
};

/** Your hull in the berth, in its paint, and every other hull in its maker's own. */
export function showOwnShip() {
  const c = game.commander;
  ships.forEach((def, i) => recolourShowroom(i, c?.paint && def.id === hullOf(c) ? paintLook(def, c.paint) : plainLook(def)));
  showShip(ownIndex());
}

/** Fly the hull your commander owns, with its paint on the dashboard and its name on the plate. */
export function boardShip() {
  const c = cmdr();
  const def = shipById(hullOf(c)) ?? shipById('cobra-mk3')!;
  if (player.def.id !== def.id) player.fly(def);
  setDashColour(c.paint?.colour ?? null);
  const plate = $('#dash-plate');
  const ed = c.paint?.edition && editionById(c.paint.edition.id);
  const words = [c.paint?.name, ed ? `${ed.name} ${editionNo(c.paint!.edition!.number)}` : c.paint ? def.name : ''].filter(Boolean);
  plate.textContent = words.join(' · ');
  plate.hidden = !words.length;
}

/** Whether this device has been asked (or has said yes) to notifications for the yard, this session. */
let notifyAsked = false;

/** Ask to be told when she's ready (Mark: "ask anyone ordering a ship to turn on notifications"). */
function notifyPrompt(): string {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && signedIn()) return '<span class="yard-note">The yard will send you a notification when she’s ready for collection.</span>';
  const why = !signedIn() ? 'Sign in (from the menu), then turn on notifications' : needsHomeScreen() ? 'On iPhone, add Witchspace to your Home Screen, then turn on notifications there' : '';
  return why
    ? `<span class="yard-note">Want to know the moment she’s ready? ${why}.</span>`
    : '<button type="button" class="yard-notify">Tell me when she’s ready: turn on notifications</button>';
}

/**
 * Collecting a ship: what happens to the one you came in (Mark). Keep her in your hangar, as she is,
 * free; or let the yard take her (a gift's yard pays for her kit at the dock's price; an order's, its
 * trade-in). Kept unless you choose otherwise.
 */
let keepOld = true;
function oldShipChoice(gift: boolean): string {
  const c = cmdr();
  const name = `${player.def.name}${c.paint?.name ? ` “${c.paint.name}”` : ''}`;
  const kit = c.equipment.filter((id) => UPGRADES.some((e) => e.id === id)).map((id) => EQUIPMENT.find((e) => e.id === id)?.name ?? id);
  const lasers = Object.values(c.lasers).filter(Boolean).map((l) => PLAYER_LASERS[l!].name);
  const aboard = [...lasers, ...kit];
  const taken = gift ? giftTradeIn(c, player.def) : tradeIn(c, player.def);
  const pays = taken ? `${taken.toLocaleString()} Cr` : 'nothing';
  const here = stationName(currentSystem()).name;
  return `<div class="yard-old" role="radiogroup" aria-label="Your ${escapeHtml(player.def.name)}">
      <p class="yard-old-head">Your ${escapeHtml(name)}</p>
      <button type="button" role="radio" data-old="keep" aria-checked="${keepOld}"><b>Keep her in your hangar</b><span>As she is, for later${aboard.length ? `: ${escapeHtml(aboard.join(', '))}` : ''}. Free. She waits here at ${escapeHtml(here)}.</span></button>
      <button type="button" role="radio" data-old="sell" aria-checked="${!keepOld}"><b>Let the yard take her</b><span>${gift ? `The yard pays ${pays} for her kit, what the dock pays for each item.${c.paint?.gifted ? ' Her hull was a gift, so it pays nothing.' : c.ship === undefined ? ' She came with your licence, so her hull pays nothing.' : ''}` : `The yard gives ${pays} for her and her kit.`}</span></button>
    </div>`;
}

/** The way to take delivery: here at the yard that built it, the bill with your trade-in; elsewhere, where to go. */
function collectButton(o: ShipOrder): string {
  const here = currentSystem();
  if (o.galaxy !== here.galaxy || o.system !== here.index) return '';
  const bill = collection(cmdr(), player.def, keepOld)!;
  const pay = bill.due >= 0 ? `pay ${Math.ceil(bill.due).toLocaleString()} Cr` : `receive ${Math.floor(-bill.due).toLocaleString()} Cr`;
  return `${o.gifted ? '' : oldShipChoice(false)}${keepOld ? '' : `<span>Balance ${bill.balance.toLocaleString()} Cr, less ${bill.tradeIn.toLocaleString()} Cr for your ${escapeHtml(player.def.name)} and its kit</span>`}
    ${o.gifted ? oldShipChoice(true) : ''}
    <button type="button" class="primary yard-collect" ${cmdr().credits < bill.due ? 'disabled' : ''}>Collect her${bill.due ? ` · ${pay}` : ''}</button>`;
}

/** The hull you fly, in the yard's list: yours, not one to spec (Mark: "its asking me to spec my Fdl but i have the Dark Edition!"). */
function ownCard(c: Commander, def: ShipDef): string {
  const ed = c.paint?.edition && editionById(c.paint.edition.id);
  const what = ed ? `${escapeHtml(ed.name)} ${editionNo(c.paint!.edition!.number)}` : `your ${escapeHtml(def.name)}`;
  return `<div class="yard-order" style="--hull:${c.paint?.colour ?? def.style.lineColor}"><strong>She’s yours: ${what}${c.paint?.name ? ` “${escapeHtml(c.paint.name)}”` : ''}</strong><span>In the berth and ready to fly.</span></div>`;
}

/** Your fleet: the ships waiting in hangars, where each is, and swapping or sending for her (Mark). */
function fleetCard(): string {
  const c = cmdr();
  if (!c.fleet?.length) return '';
  const here = currentSystem();
  const now = Date.now();
  const rows = c.fleet.map((s) => {
    const def = shipById(s.ship);
    const name = `${def?.name ?? s.ship}${s.paint?.name ? ` “${escapeHtml(s.paint.name)}”` : ''}${s.paint?.edition ? ` · ${escapeHtml(editionById(s.paint.edition.id)?.name ?? '')} ${editionNo(s.paint.edition.number)}` : ''}`;
    const where = s.at.galaxy === here.galaxy ? systemAt(s.at.galaxy, s.at.system) : null;
    let line: string;
    let act = '';
    if (s.delivery) {
      const to = systemAt(s.delivery.to.galaxy, s.delivery.to.system);
      const h = Math.max(0.1, (s.delivery.arrives - now) / 3600_000);
      line = `On her way to ${escapeHtml(stationName(to).name)}, ${escapeHtml(to.name)} · about ${h < 1 ? `${Math.ceil(h * 60)} min` : `${h.toFixed(1)} h`}`;
    } else if (where && s.at.system === here.index) {
      line = 'In the hangar here';
      act = `<button type="button" class="primary" data-fly="${s.id}">Fly her</button>`;
    } else if (where && def) {
      const ly = distanceLy(here, where);
      const q = deliveryQuote(def, ly);
      line = `In the hangar at ${escapeHtml(stationName(where).name)}, ${escapeHtml(where.name)} · ${ly.toFixed(1)} LY`;
      act = `<button type="button" data-deliver="${s.id}" ${c.credits < q.cost ? 'disabled' : ''}>Have her delivered here · ${q.cost.toLocaleString()} Cr · about ${(q.ms / 3600_000).toFixed(1)} h</button>`;
    } else line = `In a hangar in galaxy ${s.at.galaxy + 1}`;
    return `<li style="--hull:${s.paint?.colour ?? def?.style.lineColor ?? 'var(--accent)'}"><strong>${name}</strong><span>${line}</span>${act}</li>`;
  });
  return `<div class="yard-fleet"><p class="yard-old-head">Your fleet · ${c.fleet.length + 1} ships</p><ul>${rows.join('')}</ul>${c.fleet.some((s) => !s.delivery && !(s.at.galaxy === here.galaxy && s.at.system === here.index)) ? '<p class="yard-note">The Carriers’ Mutual carry her, at their haulage rate. Or fly there to swap.</p>' : ''}</div>`;
}

export function renderShipyard() {
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  // A ship signed over to you waits at one yard (the maker's own): elsewhere, the yard says where.
  const giftAt = c.gift?.at;
  const giftWaiting = giftAt && !(giftAt.galaxy === here.galaxy && giftAt.system === here.index) ? systemAt(giftAt.galaxy, giftAt.system) : null;
  const yard = ships
    .map((def, i) => ({ def, i }))
    .filter(({ def }) => inYards(def))
    // Concepts first: the reveal, then the yard's line from the dearest.
    .sort((a, b) => Number(Boolean(b.def.concept)) - Number(Boolean(a.def.concept)) || b.def.stats.price - a.def.stats.price);
  // How many of each edition are left: asked of the server now and then, and shown when it answers.
  if (now - editionsAsked > 60_000) {
    editionsAsked = now;
    void editionCounts().then((r) => {
      editionsLeft = r;
      if (game.state === 'docked' && game.dockTab === 'shipyard' && !spec) renderShipyard();
    });
  }
  const edition = editionSel ? editionById(editionSel) : undefined;
  const pick = yard.find((y) => y.def.id === (spec?.ship ?? edition?.ship ?? yardPick)) ?? yard[0];
  if (!pick) return;
  yardPick = pick.def.id;
  // The berth shows the glow you're choosing, the edition you're looking at, or the one you ordered.
  const lookOf = (def: ShipDef): Look => {
    const o = spec && def.id === spec.ship ? spec : !spec && edition?.ship === def.id ? edition : c.order?.ship === def.id ? c.order : c.paint && hullOf(c) === def.id ? c.paint : null;
    return o ? paintLook(def, o) : plainLook(def);
  };
  for (const { i, def } of yard) recolourShowroom(i, lookOf(def));
  const nameOf = (colour: string | null) => PALETTE.find((p) => p.colour === colour)?.name ?? 'the maker’s own';
  if (shipIndex !== pick.i) showShip(pick.i);
  const el = $('#shipyard');
  const msg = `<p class="yard-funds">You have <b>${Math.floor(c.credits).toLocaleString()} Cr</b></p>${yardMessage ? `<p class="yard-message">${escapeHtml(yardMessage)}</p>` : ''}`;
  yardMessage = '';

  // Your ship in production, at the top whatever you're looking at.
  let orderCard = '';
  if (c.order) {
    const o = c.order;
    const def = shipById(o.ship);
    const p = production(o, now);
    const at = o.galaxy === here.galaxy ? systemAt(o.galaxy, o.system) : null;
    const where = at ? `${stationName(at).name}, ${at.name}` : 'a yard in another galaxy';
    orderCard = `<div class="yard-order" style="--hull:${o.colour}">
      <strong>Your ${escapeHtml(def?.name ?? o.ship)}${o.name ? ` “${escapeHtml(o.name)}”` : ''}</strong>
      ${o.edition ? `<span class="yard-edition-no">${escapeHtml(editionById(o.edition.id)?.name ?? '')} ${editionNo(o.edition.number)}${o.gifted ? ' · a gift' : ''}</span>` : o.gifted ? '<span class="yard-edition-no">A gift</span>' : ''}
      <span>${p.built ? `Ready, and waiting for you at ${escapeHtml(where)}.` : `Being finished at ${escapeHtml(where)}: ${p.stage.toLowerCase()} · about ${p.hoursLeft} h to go`}</span>
      <div class="rec-meter"><span style="width:${(p.fraction * 100).toFixed(1)}%"></span></div>
      <span>${o.gifted ? 'Built for you by the yard, with its thanks: nothing to pay' : `Deposit ${o.deposit.toLocaleString()} Cr paid · ${(o.quoted - o.deposit).toLocaleString()} Cr on collection`}</span>
      ${!p.built && !notifyAsked ? notifyPrompt() : ''}
      ${p.built ? collectButton(o) : o.gifted ? '' : `<button type="button" class="yard-cancel">Cancel and refund ${o.deposit.toLocaleString()} Cr</button>`}
    </div>`;
  }

  if (spec) {
    const def = pick.def;
    const fixed = yardMode === 'edition' ? editionById(editionSel ?? '') : undefined;
    const gift = yardMode === 'gift';
    const giftEdition = gift && c.gift?.edition ? editionById(c.gift.edition.id) : undefined;
    const total = fixed ? editionQuote(def, fixed) : gift ? 0 : quote(def, spec);
    const lines = priceLines(def, spec);
    const deposit = depositFor(total);
    const cost = (n: number) => (n ? `${n.toLocaleString()} Cr` : 'Included');
    const swatches = (attr: string, chosen: string | null) =>
      `<div class="yard-colours">${(yardMode === 'repaint' ? PALETTE.filter((p) => paintable(c, p.colour)) : ORDERABLE).map((p) => `<button type="button" ${attr}="${p.colour}" aria-pressed="${chosen === p.colour}" title="${escapeHtml(p.line)}" style="--sw:${p.colour}" ${gift && p.price ? 'disabled' : ''}><i></i><span>${p.name}</span><small>${p.price ? `${p.price.toLocaleString()} Cr` : 'Included'}</small></button>`).join('')}</div>`;
    const chosenColour = PALETTE.find((p) => p.colour === spec!.colour);
    const laserRow = (Object.keys(PLAYER_LASERS) as LaserId[])
      .map((id) => `<button type="button" data-laser="${id}" aria-pressed="${spec!.laser === id}" ${laserLocked(c, id) ? `disabled title="${escapeHtml(laserLocked(c, id)!)}"` : ''}>${escapeHtml(PLAYER_LASERS[id].name)}<small>${Math.round(PLAYER_LASERS[id].price * fitScale(def)).toLocaleString()} Cr</small></button>`)
      .join('');
    const kit = UPGRADES.filter((e) => !e.modernOnly || c.difficulty === 'modern')
      .map((e) =>
        standardKit(def).includes(e.id)
          ? `<label><input type="checkbox" checked disabled /> <span>${escapeHtml(e.name)}</span><small>Standard</small></label>`
          : `<label><input type="checkbox" data-up="${e.id}" ${spec!.upgrades.includes(e.id) ? 'checked' : ''} /> <span>${escapeHtml(e.name)}</span><small>${Math.round(e.price * fitScale(def)).toLocaleString()} Cr</small></label>`,
      )
      .join('');
    const repainting = yardMode === 'repaint';
    const repaintCost = repainting ? repaintQuote(def, { colour: spec.colour, glow: spec.glow, trim: spec.trim }, c.paint) : 0;
    const action = repainting
      ? `<button type="button" class="primary yard-repaint" ${c.credits < repaintCost ? 'disabled' : ''}>Repaint her · ${repaintCost.toLocaleString()} Cr</button>
        <p class="yard-note">Done while you wait. Her name${c.paint?.edition ? ', her number' : ''} and what's aboard stay as they are.</p>`
      : fixed
      ? INVITATION
      : gift
        ? c.order
          ? '<p class="meta">One ship in production at a time: collect that one first.</p>'
          : `${oldShipChoice(true)}<button type="button" class="primary yard-gift">Take her now · a gift</button>
            <p class="yard-note">${giftEdition ? 'In the edition’s colours' : 'The hull as it leaves the yard, in your colour'}, with your name on her: built and waiting. Upgrades are yours to earn.</p>`
        : def.concept
      ? c.order
        ? '<p class="meta">One ship in production at a time.</p>'
        : `<button type="button" class="primary yard-deposit" ${c.credits < deposit ? 'disabled' : ''}>Place a deposit · ${deposit.toLocaleString()} Cr</button>
          <p class="yard-note">${escapeHtml(def.manufacturer ?? 'The yard')} lay down a ${escapeHtml(def.name)} every few months, so there's always one on the line: yours is the next off it. Finishing her to your spec takes about ${PRODUCTION_HOURS / 24} days, here at ${escapeHtml(stationName(here).name)}, at this price. A tenth now, refundable until she's ready.</p>`
      : '<p class="yard-note">Shipyards open soon: you\'ll buy it outright then.</p>';
    const nameField = `<label class="yard-label" for="spec-name">Its name, painted on${fixed ? ' beside its number' : ''}</label>
      <input id="spec-name" maxlength="24" placeholder="Halcyon, Brass Neck, Last Orders…" value="${escapeHtml(spec.name)}" />`;
    const body = fixed
      ? `<p class="yard-desc">${escapeHtml(fixed.blurb)}</p>
        <p class="yard-label">The edition</p>
        <ul class="yard-spec-list">
          <li>${escapeHtml(nameOf(fixed.colour))}${fixed.trim ? `, the fine lines in ${escapeHtml(nameOf(fixed.trim))}` : ''}, ${GLOWS[fixed.glow].name.toLowerCase()}</li>
          <li>${fixed.rear === fixed.laser ? `${escapeHtml(PLAYER_LASERS[fixed.laser].name)}s front and rear` : `${escapeHtml(PLAYER_LASERS[fixed.laser].name)}${fixed.rear ? `, a ${escapeHtml(PLAYER_LASERS[fixed.rear].name.toLowerCase())} aft` : ''}`} · ${fixed.upgrades.map((u) => escapeHtml(UPGRADES.find((e) => e.id === u)?.name ?? u)).join(' · ')}</li>
          <li>${fixed.luxuries.map((l) => escapeHtml(LUXURIES.find((x) => x.id === l)?.name ?? l)).join(' · ')}</li>
          <li>Its number painted beside its name</li>
        </ul>
        ${nameField}
        <p class="yard-total"><span>The spec ${quote(def, spec).toLocaleString()} · numbered ${(total - quote(def, spec)).toLocaleString()}</span><b>${total.toLocaleString()} Cr</b></p>`
      : repainting
        ? `<p class="yard-label">Her colour <span>${escapeHtml(nameOf(spec.colour))}</span></p>
          ${swatches('data-colour', spec.colour)}
          <p class="yard-label">How hard she glows</p>
          <div class="yard-lasers">${(Object.keys(GLOWS) as GlowId[]).map((g) => `<button type="button" data-glow="${g}" aria-pressed="${spec!.glow === g}">${GLOWS[g].name}<small>${cost(GLOWS[g].price)}</small></button>`).join('')}</div>
          <label class="yard-check"><input type="checkbox" class="yard-two-tone" ${spec.trim ? 'checked' : ''} /> <span>Two-tone: the fine lines in a second colour</span><small>${TRIM_PRICE.toLocaleString()} Cr</small></label>
          ${spec.trim ? swatches('data-trim', spec.trim) : ''}
          <p class="yard-total"><span>Labour ${repaintLabour(def, spec.glow).toLocaleString()} · finish ${(repaintCost - repaintLabour(def, spec.glow)).toLocaleString()}</span><b>${repaintCost.toLocaleString()} Cr</b></p>`
        : gift && giftEdition
        ? `<p class="yard-desc">${escapeHtml(giftEdition.blurb)}</p>
          <ul class="yard-spec-list">
            <li>${escapeHtml(nameOf(giftEdition.colour))}${giftEdition.trim ? `, the fine lines in ${escapeHtml(nameOf(giftEdition.trim))}` : ''}, ${GLOWS[giftEdition.glow].name.toLowerCase()}</li>
            <li>${giftEdition.luxuries.map((l) => escapeHtml(LUXURIES.find((x) => x.id === l)?.name ?? l)).join(' · ')}</li>
            <li>${editionNo(c.gift!.edition!.number)} beside its name</li>
            <li>Beam lasers front and rear, a docking computer and a combat computer: the rest is yours to earn</li>
          </ul>
          ${nameField}
          <p class="yard-total"><span>${escapeHtml(giftEdition.name)} ${editionNo(c.gift!.edition!.number)}</span><b>A gift</b></p>`
        : gift
        ? `<p class="yard-label">Its colour <span>${escapeHtml(nameOf(spec.colour))} · the included colours</span></p>
          ${swatches('data-colour', spec.colour)}
          ${nameField}
          <p class="yard-total"><span>Hull, ${escapeHtml(PLAYER_LASERS[standardLaser(def)].name.toLowerCase())}, standard fit</span><b>A gift</b></p>`
        : '';
    el.innerHTML = `${msg}${orderCard}<button type="button" class="yard-back">‹ The yard</button> <button type="button" class="yard-photo">Photograph her</button>
      <h3 class="yard-title" style="--hull:${spec.colour}">${repainting ? `Repaint your ${escapeHtml(def.name)}` : fixed ? `${escapeHtml(fixed.name)}: ${escapeHtml(def.name)}` : giftEdition ? `Your gift: ${escapeHtml(giftEdition.name)} ${editionNo(c.gift!.edition!.number)}` : gift ? `Your gift: a ${escapeHtml(def.name)}` : `Spec your ${escapeHtml(def.name)}`}</h3>
      ${body ? `${body}${action}` : `<p class="yard-label">Its colour <span>${chosenColour ? `${chosenColour.name} · ${cost(chosenColour.price)}` : 'The maker’s own'}</span></p>
      ${swatches('data-colour', spec.colour)}
      ${chosenColour ? `<p class="yard-note">${escapeHtml(chosenColour.line)}</p>` : ''}
      <p class="yard-label">How hard it glows</p>
      <div class="yard-lasers">${(Object.keys(GLOWS) as GlowId[]).map((g) => `<button type="button" data-glow="${g}" aria-pressed="${spec!.glow === g}">${GLOWS[g].name}<small>${cost(GLOWS[g].price)}</small></button>`).join('')}</div>
      <label class="yard-check"><input type="checkbox" class="yard-two-tone" ${spec.trim ? 'checked' : ''} /> <span>Two-tone: the fine lines in a second colour</span><small>${TRIM_PRICE.toLocaleString()} Cr</small></label>
      ${spec.trim ? swatches('data-trim', spec.trim) : ''}
      <label class="yard-label" for="spec-name">Its name, painted on</label>
      <input id="spec-name" maxlength="24" placeholder="Halcyon, Brass Neck, Last Orders…" value="${escapeHtml(spec.name)}" />
      <p class="yard-label">Its laser</p>
      <div class="yard-lasers">${laserRow}</div>
      <p class="yard-label">Rear laser</p>
      <div class="yard-lasers yard-rear"><button type="button" data-rear="" aria-pressed="${!spec.rear}">None<small>—</small></button>${(Object.keys(PLAYER_LASERS) as LaserId[]).map((id) => `<button type="button" data-rear="${id}" aria-pressed="${spec!.rear === id}" ${laserLocked(c, id) ? `disabled title="${escapeHtml(laserLocked(c, id)!)}"` : ''}>${escapeHtml(PLAYER_LASERS[id].name)}<small>${Math.round(PLAYER_LASERS[id].price * fitScale(def)).toLocaleString()} Cr</small></button>`).join('')}</div>
      <p class="yard-label">Upgrades <span>fitted to a hull this size: ×${fitScale(def).toFixed(1)}</span></p>
      <div class="yard-kit">${kit}</div>
      <p class="yard-label">Luxuries <span>comfort and showing off, nothing that flies or fights better</span></p>
      <div class="yard-kit yard-lux">${ORDERABLE_LUXURIES.map((l) => `<label><input type="checkbox" data-lux="${l.id}" ${spec!.luxuries.includes(l.id) ? 'checked' : ''} /> <span>${escapeHtml(l.name)}<em>${escapeHtml(l.blurb)}</em></span><small>${l.price.toLocaleString()} Cr</small></label>`).join('')}</div>
      <p class="yard-total"><span>Hull ${lines.hull.toLocaleString()} · fit-out ${lines.fit.toLocaleString()} · finish ${lines.finish.toLocaleString()}</span><b>${total.toLocaleString()} Cr</b></p>
      ${action}`}`;
    const keep = () => renderShipyard();
    el.querySelector<HTMLButtonElement>('.yard-back')!.onclick = () => {
      spec = null;
      yardMode = 'spec';
      keep();
    };
    el.querySelector<HTMLButtonElement>('.yard-photo')!.onclick = openBooth;
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-colour]'))
      b.onclick = () => {
        spec!.colour = b.dataset.colour!;
        keep();
      };
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-trim]'))
      b.onclick = () => {
        spec!.trim = b.dataset.trim!;
        keep();
      };
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-glow]'))
      b.onclick = () => {
        spec!.glow = b.dataset.glow as GlowId;
        keep();
      };
    el.querySelector<HTMLInputElement>('.yard-two-tone')?.addEventListener('change', (e) => {
      spec!.trim = (e.target as HTMLInputElement).checked ? (ORDERABLE.find((p) => p.colour !== spec!.colour)?.colour ?? '#f2f6ff') : null;
      keep();
    });
    for (const box of el.querySelectorAll<HTMLInputElement>('[data-lux]'))
      box.onchange = () => {
        const id = box.dataset.lux!;
        spec!.luxuries = box.checked ? [...spec!.luxuries, id] : spec!.luxuries.filter((l) => l !== id);
        keep();
      };
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-rear]'))
      b.onclick = () => {
        spec!.rear = (b.dataset.rear || undefined) as LaserId | undefined;
        keep();
      };
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-laser]'))
      b.onclick = () => {
        spec!.laser = b.dataset.laser as LaserId;
        keep();
      };
    for (const box of el.querySelectorAll<HTMLInputElement>('[data-up]'))
      box.onchange = () => {
        const id = box.dataset.up as EquipmentId;
        spec!.upgrades = box.checked ? [...spec!.upgrades, id] : spec!.upgrades.filter((u) => u !== id);
        keep();
      };
    const name = el.querySelector<HTMLInputElement>('#spec-name');
    if (name) name.oninput = () => (spec!.name = name.value);
    const dep = el.querySelector<HTMLButtonElement>('.yard-deposit');
    if (dep)
      dep.onclick = () => {
        if (!dep.dataset.armed) {
          dep.dataset.armed = '1';
          dep.textContent = `Pay ${deposit.toLocaleString()} Cr now? Press again`;
          return;
        }
        const r = placeOrder(c, def, spec!, { galaxy: here.galaxy, system: here.index }, Date.now());
        if (!r.ok) yardMessage = r.message;
        else {
          yardMessage = `Deposit paid. Your ${def.name}${r.order.name ? ` “${r.order.name}”` : ''} is the next off the line: the yard at ${stationName(here).name} is finishing her to your spec.`;
          spec = null;
          forgetSiteSpec();
          saveCommander(c);
          sfx.beep();
        }
        renderShipyard();
      };
    const paintGo = el.querySelector<HTMLButtonElement>('.yard-repaint');
    if (paintGo && repainting)
      paintGo.onclick = () => {
        if (!paintGo.dataset.armed) {
          paintGo.dataset.armed = '1';
          paintGo.textContent = `Pay ${repaintCost.toLocaleString()} Cr and repaint her? Press again`;
          return;
        }
        const r = repaint(c, def, { colour: spec!.colour, glow: spec!.glow, trim: spec!.trim });
        if (!r.ok) yardMessage = r.message;
        else {
          yardMessage = `Repainted in ${nameOf(spec!.colour)}. She looks the part.`;
          spec = null;
          yardMode = 'spec';
          saveCommander(c);
          sfx.beep();
        }
        renderShipyard();
      };
    const giftGo = el.querySelector<HTMLButtonElement>('.yard-gift');
    if (giftGo && gift)
      giftGo.onclick = () => {
        const at = { galaxy: here.galaxy, system: here.index };
        const r = placeOrder(c, def, spec!, at, Date.now(), { gift: true });
        // Built and waiting: you fly out in her now.
        const got = r.ok ? collectOrder(c, player.def, def, at, cargoTonnes(c), Date.now(), keepOld) : null;
        if (!r.ok) yardMessage = r.message;
        else if (got && !got.ok) yardMessage = `Built and waiting for you here: ${got.message}.`;
        else {
          boardShip();
          const ed = c.paint?.edition && editionById(c.paint.edition.id);
          yardMessage = `She's yours: your ${def.name}${c.paint?.name ? ` “${c.paint.name}”` : ''}${ed ? `, ${ed.name} ${editionNo(c.paint!.edition!.number)}` : ''}, in the berth and ready to fly. With the yard's thanks.`;
          yardPick = def.id;
          if (ed) handOver(c, def, ed);
        }
        if (r.ok) {
          spec = null;
          yardMode = 'spec';
          saveCommander(c);
          sfx.beep();
        }
        renderShipyard();
      };
  } else {
    el.innerHTML = `${msg}${orderCard}${fleetCard()}<p class="meta">Shipyards open soon: you'll buy, sell and trade in here. Spec your perfect ship now, and put a deposit on a concept to have it built for you.</p>
      <ul class="yard">${yard
        .map(({ def }) => {
          const st = def.stats;
          const tag = def.id === hullOf(c) ? `<em>Your ship${c.paint?.name ? ` “${escapeHtml(c.paint.name)}”` : ''}</em>` : def.concept ? '<em class="yard-concept">Concept · coming soon</em>' : '';
          const mine = def.id === hullOf(c) && c.paint;
          const ed = mine && c.paint!.edition ? editionById(c.paint!.edition.id) : undefined;
          return `<li><button type="button" data-yard="${def.id}" aria-pressed="${def.id === yardPick}" style="--hull:${mine ? c.paint!.colour : def.style.lineColor}">
            <strong>${escapeHtml(def.name)}${ed ? ` · ${escapeHtml(ed.name)} ${editionNo(c.paint!.edition!.number)}` : ''}</strong> ${tag}
            <span>${[def.manufacturer, def.role].filter(Boolean).map((x) => escapeHtml(x!)).join(' · ')}</span>
            <span>${st.maxSpeed} m/s · hull ${st.hull} · shields ${st.shields} · ${st.cargo} t · ${st.missiles ?? 0} missiles</span>
            <b>${def.concept ? 'About ' : ''}${st.price.toLocaleString()} Cr</b>
          </button></li>`;
        })
        .join('')}${EDITIONS.map((e) => {
          const d = shipById(e.ship);
          if (!d) return '';
          const taken = editionsLeft[e.id]?.taken ?? 0;
          return `<li><button type="button" data-edition="${e.id}" aria-pressed="${editionSel === e.id}" style="--hull:${e.colour}">
            <strong>${escapeHtml(e.name)}</strong> <em class="yard-concept">${escapeHtml(d.name)} · numbered</em>
            <span>${taken ? `${taken} of ${e.limit} signed over` : `${e.limit} will be built`} · for contributors</span>
            <span>${escapeHtml(nameOf(e.colour))}${e.trim ? ` · ${escapeHtml(nameOf(e.trim))} trim` : ''} · ${GLOWS[e.glow].name}</span>
            <b>By invitation</b>
          </button></li>`;
        }).join('')}</ul>
      <p class="yard-desc">${escapeHtml(edition ? edition.blurb : pick.def.description)}</p>
      ${siteSpec && !c.order && shipById(siteSpec.spec.ship) ? `<div class="yard-order" style="--hull:${siteSpec.spec.colour}"><strong>Your ${escapeHtml(shipById(siteSpec.spec.ship)!.name)} spec from the website is here</strong><span>${siteSpec.spec.name ? `“${escapeHtml(siteSpec.spec.name)}”, ` : ''}${escapeHtml(nameOf(siteSpec.spec.colour))}: ${quote(shipById(siteSpec.spec.ship)!, siteSpec.spec).toLocaleString()} Cr as specced.</span><button type="button" class="primary yard-open-site">Open it</button></div>` : ''}
      ${c.gift ? `<div class="yard-order" style="--hull:var(--accent)"><strong>A gift is waiting</strong><span>${c.gift.edition ? `${escapeHtml(editionById(c.gift.edition.id)?.name ?? '')} ${editionNo(c.gift.edition.number)}: a ${escapeHtml(shipById(c.gift.ship)?.name ?? c.gift.ship)}, yours to name.` : `A ${escapeHtml(shipById(c.gift.ship)?.name ?? c.gift.ship)}, yours to colour and name.`}</span>${giftWaiting ? `<span>Waiting for you at the maker’s own yard: ${escapeHtml(stationName(giftWaiting).name)}, ${escapeHtml(giftWaiting.name)}${giftWaiting.galaxy === here.galaxy ? `, ${jumpsBetween(here, giftWaiting, 12)} jumps from here` : ''}.</span>${giftWaiting.galaxy === here.galaxy ? `<button type="button" class="primary yard-gift-course">${c.target === giftWaiting.index ? 'On course' : 'Set course'}</button>` : ''}` : '<button type="button" class="primary yard-open-gift">Spec your gift</button>'}</div>` : ''}
      ${pick.def.id === hullOf(c) && !edition ? `<button type="button" class="yard-manual yard-repaint-open">Repaint your ${escapeHtml(pick.def.name)}</button>` : ''}
      <button type="button" class="yard-manual">The ${escapeHtml(edition ? (shipById(edition.ship)?.name ?? '') : pick.def.name)} owner's manual</button>
      ${edition ? INVITATION : pick.def.id === hullOf(c) ? `${ownCard(c, pick.def)}<button type="button" class="yard-manual yard-spec">Spec another ${escapeHtml(pick.def.name)}</button>` : `<button type="button" class="primary yard-spec">Spec your ${escapeHtml(pick.def.name)}</button>`}`;
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-yard]'))
      b.onclick = () => {
        yardPick = b.dataset.yard!;
        editionSel = null;
        resetShowroomView();
        renderShipyard();
      };
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-edition]'))
      b.onclick = () => {
        editionSel = b.dataset.edition!;
        resetShowroomView();
        renderShipyard();
      };
    el.querySelector<HTMLButtonElement>('.yard-repaint-open')?.addEventListener('click', () => {
      yardMode = 'repaint';
      const p = c.paint;
      spec = { ...defaultSpec(pick.def), colour: p?.colour ?? pick.def.style.lineColor, glow: p?.glow ?? 'standard', trim: p?.trim ?? null };
      renderShipyard();
    });
    el.querySelector<HTMLButtonElement>('.yard-manual:not(.yard-repaint-open)')!.onclick = () => openManual(edition ? shipById(edition.ship)! : pick.def);
    const specOpen = el.querySelector<HTMLButtonElement>('.yard-spec');
    if (specOpen) specOpen.onclick = () => {
      if (edition) {
        yardMode = 'edition';
        spec = editionSpec(edition);
      } else {
        yardMode = 'spec';
        spec = defaultSpec(pick.def);
      }
      renderShipyard();
    };
    const openGift = () => {
      const d = c.gift && shipById(c.gift.ship);
      if (!d) return;
      yardMode = 'gift';
      editionSel = null;
      const e = c.gift!.edition && editionById(c.gift!.edition.id);
      spec = e ? editionGiftSpec(e, c.name) : { ...defaultSpec(d), name: c.name };
      renderShipyard();
    };
    el.querySelector<HTMLButtonElement>('.yard-open-gift')?.addEventListener('click', openGift);
    el.querySelector<HTMLButtonElement>('.yard-gift-course')?.addEventListener('click', () => {
      if (!giftWaiting) return;
      yardMessage = plotCourse(c, giftWaiting.index);
      saveCommander(c);
      sfx.beep();
      renderShipyard();
    });
    el.querySelector<HTMLButtonElement>('.yard-open-site')?.addEventListener('click', () => {
      if (!siteSpec) return;
      yardMode = 'spec';
      editionSel = null;
      yardPick = siteSpec.spec.ship;
      spec = { ...siteSpec.spec, upgrades: [...siteSpec.spec.upgrades], luxuries: [...siteSpec.spec.luxuries] };
      resetShowroomView();
      renderShipyard();
    });
    // No voucher box (Mark: "nobody gets a gift voucher for a 500K ship!"): an edition is signed
    // over to a contributor's account (tools/voucher.ts gift) and is waiting when they sign in.
  }
  const tell = el.querySelector<HTMLButtonElement>('.yard-notify');
  if (tell)
    tell.onclick = async () => {
      tell.disabled = true;
      try {
        await enablePush();
        yardMessage = 'Notifications on: the yard will tell you the moment she’s ready for collection.';
      } catch (e) {
        yardMessage = (e as Error).message;
      }
      notifyAsked = true;
      renderShipyard();
    };
  el.querySelectorAll<HTMLButtonElement>('[data-old]').forEach((b) => {
    b.onclick = () => {
      keepOld = b.dataset.old === 'keep';
      renderShipyard();
    };
  });
  el.querySelectorAll<HTMLButtonElement>('[data-fly]').forEach((b) => {
    b.onclick = () => {
      const s = c.fleet?.find((x) => x.id === b.dataset.fly);
      const next = s && shipById(s.ship);
      if (!next) return;
      const r = swapShip(c, player.def, next, s.id, { galaxy: here.galaxy, system: here.index }, cargoTonnes(c), Date.now());
      if (!r.ok) yardMessage = r.message;
      else {
        boardShip();
        showOwnShip();
        saveCommander(c);
        sfx.beep();
        yardMessage = `You're in your ${next.name}${c.paint?.name ? ` “${c.paint.name}”` : ''}. Your old ship waits in the hangar here.`;
        yardPick = next.id;
      }
      renderShipyard();
    };
  });
  el.querySelectorAll<HTMLButtonElement>('[data-deliver]').forEach((b) => {
    b.onclick = () => {
      const s = c.fleet?.find((x) => x.id === b.dataset.deliver);
      const def = s && shipById(s.ship);
      if (!def) return;
      if (!b.dataset.armed) {
        b.dataset.armed = '1';
        b.textContent = `Send for her? Press again`;
        return;
      }
      const r = deliverShip(c, def, s.id, here, distanceLy(systemAt(s.at.galaxy, s.at.system), here), Date.now());
      if (!r.ok) yardMessage = r.message;
      else {
        saveCommander(c);
        sfx.beep();
        yardMessage = `The Carriers’ Mutual have her: your ${def.name} arrives here in about ${((r.arrives - Date.now()) / 3600_000).toFixed(1)} h.`;
      }
      renderShipyard();
    };
  });
  const take = el.querySelector<HTMLButtonElement>('.yard-collect');
  if (take && c.order)
    take.onclick = async () => {
      if (!take.dataset.armed) {
        take.dataset.armed = '1';
        take.textContent = keepOld ? `Keep your ${player.def.name} in the hangar and take her? Press again` : `Trade in your ${player.def.name} and take her? Press again`;
        return;
      }
      const next = shipById(c.order!.ship)!;
      // A numbered edition is handed over only if the yard's office has the number down as yours.
      const ed = c.order!.edition;
      if (ed) {
        take.disabled = true;
        const held = await heldEditions();
        if ('error' in held || !held.editions.some((x) => x.edition === ed.id && x.number === ed.number)) {
          yardMessage = 'error' in held ? held.error : 'The yard’s office has no record of that number in your name. Get in touch: hello@witchspace.org.uk';
          renderShipyard();
          return;
        }
      }
      const r = collectOrder(c, player.def, next, { galaxy: here.galaxy, system: here.index }, cargoTonnes(c), Date.now(), keepOld);
      if (!r.ok) yardMessage = r.message;
      else {
        boardShip();
        saveCommander(c);
        sfx.beep();
        yardMessage = `She's yours: your ${next.name}${c.paint?.name ? ` “${c.paint.name}”` : ''}, in the berth and ready to fly.`;
        yardPick = next.id;
        const owned = c.paint?.edition && editionById(c.paint.edition.id);
        if (owned) handOver(c, next, owned);
      }
      renderShipyard();
    };
  const cancel = el.querySelector<HTMLButtonElement>('.yard-cancel');
  if (cancel)
    cancel.onclick = () => {
      if (!cancel.dataset.armed) {
        cancel.dataset.armed = '1';
        cancel.textContent = 'Cancel the build? Press again';
        return;
      }
      const back = cancelOrder(c, Date.now());
      yardMessage = back ? `Cancelled. ${back.toLocaleString()} Cr refunded.` : '';
      saveCommander(c);
      renderShipyard();
    };
}
