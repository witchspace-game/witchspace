import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { jumpsBetween } from './contracts';
import { cargoTonnes, newCommander } from './commander';
import { consequence, contentsOf, ADRIFT_FALL, ADRIFT_HOLD, ASSIGNMENT_SLOT, assignmentFor, assignmentWaiting, blackmailPrice, checkMessages, companyHere, offerFor, collectHeld, decide, expireCases, PIRATES_FIND, ransomPrice, fileOn, recoverCase, rivalPrice, sellToRival, setAdrift } from './assignments';
import { deliver, destinationOf, loseContracts, logOf, standing, take } from './contracts';
import { legalStatus } from './law';
import { eventsAt, setCausedEvents } from '../economy/events';

const lave = systemAt(0, 7);
const T0 = Date.UTC(2026, 9, 22, 12);

/** A time when Hexon has something for this callsign, within the next few windows. */
function waitingTime(callsign: string) {
  for (let k = 0; k < 20; k++) {
    const t = T0 + k * ASSIGNMENT_SLOT + 3600_000;
    if (assignmentWaiting(callsign, 'hexon', 10, t)) return t;
  }
  throw new Error('no window');
}

describe('special assignments', () => {
  it('say what you can do about them: take it here, where to go, or that it has gone (Mark)', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const t = waitingTime(c.name);
    const m = checkMessages(c, lave, t).find((x) => x.company === 'hexon')!;
    const galaxy = Array.from({ length: 256 }, (_, i) => systemAt(0, i));
    const there = galaxy.find((s) => companyHere('hexon', s))!;
    const away = galaxy.find((s) => !companyHere('hexon', s))!;
    expect(offerFor(c, m, there, t)?.kind).toBe('here');
    const elsewhere = offerFor(c, m, away, t);
    expect(elsewhere?.kind).toBe('elsewhere');
    if (elsewhere?.kind === 'elsewhere' && elsewhere.station) {
      expect(companyHere('hexon', elsewhere.station.system)).toBe(true);
      expect(jumpsBetween(away, elsewhere.station.system, 8)).toBe(elsewhere.station.jumps);
    }
    expect(offerFor(c, m, there, t + 10 * ASSIGNMENT_SLOT)?.kind).toBe('closed');
    const offer = (offerFor(c, m, there, t) as { offer: Parameters<typeof take>[1] }).offer;
    expect(take(c, offer, 20)).toBeNull();
    expect(offerFor(c, m, there, t)?.kind).toBe('taken');
    expect(offerFor(c, { ...m, id: `${m.id}:delivered` }, there, t)).toBeNull(); // a receipt has nothing to answer
  });

  it('only come once a company trusts you', () => {
    const c = newCommander('modern');
    const t = waitingTime(c.name);
    expect(assignmentFor(c, 'hexon', lave, t)).toBeNull();
    c.standing = { hexon: 5 };
    expect(assignmentFor(c, 'hexon', lave, t)).not.toBeNull();
  });

  it('are the same in the game and on the notification server', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 8 };
    const t = waitingTime(c.name);
    expect(assignmentWaiting(c.name, 'hexon', 8, t)).toBe(true);
    expect(assignmentFor(c, 'hexon', lave, t)!.id).toBe(assignmentFor(c, 'hexon', lave, t + 60_000)!.id);
  });

  it('arrive as a message once, and pay well with standing to match', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const t = waitingTime(c.name);
    const msgs = checkMessages(c, lave, t);
    expect(msgs.some((m) => m.company === 'hexon')).toBe(true);
    expect(checkMessages(c, lave, t)).toHaveLength(0);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    expect(offer.pay).toBeGreaterThan(400);
    expect(take(c, offer, 20)).toBeNull();
    deliver(c, destinationOf(offer));
    expect(standing(c, 'hexon')).toBe(9);
    expect(logOf(c, 'hexon').special).toBe(1);
    expect(assignmentFor(c, 'hexon', lave, t)).toBeNull(); // done
  });

  it('companies keep a file on you, with redactions', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const file = fileOn(c, 'hexon', lave, T0);
    expect(file.title).toMatch(/Hexon/);
    expect(file.lines.some((l) => l.redacted)).toBe(true);
    expect(file.lines[0].text).toContain(c.name);
  });

  it('Classic commanders are left alone', () => {
    const c = newCommander('classic');
    c.standing = { hexon: 50 };
    expect(checkMessages(c, lave, waitingTime(c.name))).toHaveLength(0);
  });

  it('survives the ship: adrift, recoverable, and gone if left too long', () => {
    const c = newCommander('modern');
    c.standing = { wy: 6, hexon: 6 };
    const t = waitingTime(c.name);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    take(c, offer, 20);
    expect(setAdrift(c, lave, [1, 2, 3], t)).toHaveLength(1);
    expect(loseContracts(c)).toHaveLength(0); // the special one isn't lost with the ship
    expect(cargoTonnes(c)).toBe(0); // it's out there, not in the hold
    expect(recoverCase(c, offer.id)).toMatch(/recovered/);
    expect(cargoTonnes(c)).toBe(offer.qty);

    setAdrift(c, lave, [1, 2, 3], t);
    expect(expireCases(c, t + PIRATES_FIND - 1, () => false)).toHaveLength(0); // still holding
    // Later, pirates find it, or it falls.
    const note = [...expireCases(c, t + PIRATES_FIND + 1, () => false), ...expireCases(c, t + ADRIFT_HOLD + ADRIFT_FALL + 1, () => false)][0];
    expect(note).toMatch(/Pirates|failed/);
    if (/failed/.test(note)) {
      expect(c.contracts).toHaveLength(0);
      expect(standing(c, 'hexon')).toBeLessThan(6);
    }
  });

  it('rivals will buy what the owner is carrying, and the owner finds out', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const t = waitingTime(c.name);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    take(c, offer, 20);
    const vorgWorld = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.government === 0)!;
    const credits = c.credits;
    expect(sellToRival(c, offer.id, vorgWorld)).toMatch(/Vorg/);
    expect(c.credits).toBe(credits + rivalPrice(offer));
    expect(standing(c, 'hexon')).toBe(-4);
    expect(standing(c, 'vorg')).toBe(3);
  });

  it('lost at the station mouth, the station crew picks it up, for a fee', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    c.credits = 1000;
    const t = waitingTime(c.name);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    take(c, offer, 20);
    const [k] = setAdrift(c, lave, [0, 0, 0], t, true);
    expect(k.held).toBe(true);
    k.fate = 'honest';
    expect(expireCases(c, t + 10 * ADRIFT_HOLD, () => false)).toHaveLength(0); // the crew keeps it safe
    expect(collectHeld(c, systemAt(0, 8))).toHaveLength(0); // only at that station
    expect(collectHeld(c, lave)[0]).toMatch(/station crew/);
    expect(c.credits).toBe(1000 - Math.round(offer.pay / 10));
    expect(c.contracts![0].adrift).toBe(false);
  });

  /** A commander holding a lost Vorg case at Lave's station, with the given fate. */
  function lostWith(fate: 'police' | 'blackmail' | 'ransom') {
    const c = newCommander('modern');
    c.standing = { vorg: 6 };
    c.credits = 5000;
    const t = waitingTime(c.name);
    let offer = null;
    for (let k = 0; !offer && k < 30; k++) offer = assignmentFor(c, 'vorg', lave, t + k * ASSIGNMENT_SLOT);
    take(c, offer!, 20);
    const [k] = setAdrift(c, lave, [0, 0, 0], t, true);
    k.fate = fate;
    k.held = fate !== 'ransom';
    return { c, offer: offer!, k };
  }

  it('the station police want a word: open it, refuse, or call the company', () => {
    const open = lostWith('police');
    expect(decide(open.c, open.offer.id, 'open', systemAt(0, 8))).toBeNull(); // only at their station
    expect(decide(open.c, open.offer.id, 'open', lave)).toMatch(/OFFENDER/); // Vorg's crates were armed
    expect(legalStatus(open.c, lave)).toBe('offender');
    expect(open.c.contracts).toHaveLength(0);

    const call = lostWith('police');
    expect(decide(call.c, call.offer.id, 'call', lave)).toMatch(/lawyers/);
    expect(call.c.contracts![0].adrift).toBe(false);
    expect(call.c.favours?.vorg).toBe(1);
  });

  it('a blackmailer wants paying; pirates want a ransom', () => {
    const b = lostWith('blackmail');
    decide(b.c, b.offer.id, 'pay', lave);
    expect(b.c.credits).toBe(5000 - blackmailPrice(b.offer.pay) - Math.round(b.offer.pay / 10));
    expect(b.c.contracts![0].adrift).toBe(false);

    const r = lostWith('ransom');
    expect(decide(r.c, r.offer.id, 'refuse', lave)).toMatch(/fence/);
    expect(r.c.contracts).toHaveLength(0);
    const p = lostWith('ransom');
    decide(p.c, p.offer.id, 'pay', systemAt(0, 8));
    expect(p.c.credits).toBe(5000 - ransomPrice(p.offer.pay));
    expect(p.c.adrift![0].held).toBe(true); // waiting at the station
  });

  it('left in the lanes too long, pirates may find it first', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const t = waitingTime(c.name);
    take(c, assignmentFor(c, 'hexon', lave, t)!, 20);
    setAdrift(c, lave, [5000, 0, 0], t);
    const notes = expireCases(c, t + PIRATES_FIND + 1, () => false);
    const k = c.adrift?.[0];
    // Either the pirates have it, or it's still out there (and falls later).
    if (k) expect(k.fate === 'ransom' || notes.length === 0).toBe(true);
  });

  it('what was inside decides what happens when it is opened or falls', () => {
    const c = newCommander('modern');
    const base = { company: 'hexon' as const, good: 'special', label: 'Sealed container', qty: 1, from: { galaxy: 0, system: 7 }, to: { galaxy: 0, system: 7 }, jumps: 3, pay: 800, danger: 0, rush: false, needs: 'Contractor' as const };
    // Find a pathogen and a harmless one among Hexon's.
    const ids = Array.from({ length: 200 }, (_, i) => `special:hexon:${i}`);
    const pathogen = ids.find((id) => contentsOf({ id, company: 'hexon' }) === 'pathogen')!;
    const benign = ids.find((id) => contentsOf({ id, company: 'hexon' }) === 'benign')!;
    expect(contentsOf({ id: pathogen, company: 'hexon' })).toBe('pathogen'); // fixed, not random each time
    expect(consequence(c, { ...base, id: benign }, 'station', lave, T0)).toBeNull();

    expect(consequence(c, { ...base, id: pathogen }, 'station', lave, T0)).toMatch(/lockdown/);
    const types = eventsAt(lave, T0 + 60_000, T0 + 60_000).map((e) => e.type);
    expect(types).toContain('plague');
    expect(types).toContain('lockdown');
    expect(c.messages?.[0].from).toBe('Hexon Holdings'); // the medicine is already on its way
    // One at a time per world.
    expect(consequence(c, { ...base, id: pathogen + 'x' }, 'planet', lave, T0 + 1000)).toBeNull();
    // A specimen falling to a planet takes root there.
    const wy = Array.from({ length: 200 }, (_, i) => `special:wy:${i}`).find((id) => contentsOf({ id, company: 'wy' }) === 'specimen')!;
    const leesti = systemAt(0, 129);
    expect(consequence(c, { ...base, company: 'wy', id: wy }, 'planet', leesti, T0)).toMatch(/bloom/);
    expect(eventsAt(leesti, T0 + 60_000, T0 + 60_000).some((e) => e.type === 'bloom')).toBe(true);
    expect(fileOn(c, 'mutual', lave, T0).lines.some((l) => /bloom/.test(l.text) && !l.redacted)).toBe(true);
    setCausedEvents([]);
  });
});

