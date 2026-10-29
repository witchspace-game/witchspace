import { describe, expect, it } from 'vitest';
import { packTrack, SAMPLE_RATE, TrackRecorder, unpackTrack, type TrackData } from '../../src/game/track';
import { checkTrack } from './clipCheck';

const SHIPS = new Map([
  ['cobra-mk3', 'Cobra Mk III'],
  ['mamba', 'Mamba'],
  ['falcon', 'Falcon'],
  ['coriolis', 'Coriolis Station'],
  ['missile', 'Missile'],
]);

function fight(): TrackData {
  const r = new TrackRecorder();
  r.ship({ id: 1, def: 'cobra-mk3', role: 'you', label: 'CMDR Jameson' });
  r.ship({ id: 2, def: 'mamba', role: 'pirate', label: 'Mamba · pirate · 80 Cr' });
  for (let i = 0; i <= 10 * SAMPLE_RATE; i++) {
    const t = i / SAMPLE_RATE;
    r.sample(t, [
      { id: 1, p: [t * 50, 0, 0], q: [0, 0, 0, 1] },
      { id: 2, p: [600 - t * 20, 30, 0], q: [0, 0, 0, 1] },
    ]);
  }
  r.event({ t: 6, kind: 'beam', from: 1, a: [0, 0, 0], b: [500, 30, 0], color: '#3dffb0', hit: 2 });
  return r.snapshot({ system: 'Lave', when: 0, you: 1, planet: { p: [0, -9000, 40000], r: 6000, color: 'rgb(127,178,255)' } })!;
}

const check = (d: TrackData, callsign: string | null = 'Kestrel') => checkTrack(packTrack(d), SHIPS, callsign, 20);

describe('a shared clip is checked, and its words written by the server', () => {
  it('keeps a real fight and titles it from the track', () => {
    const c = check(fight());
    expect(typeof c).toBe('object');
    if (typeof c === 'string') return;
    expect(c.title).toBe('CMDR Kestrel: fighting a Mamba at Lave');
    expect(c.focusDef).toBe('mamba');
    expect(c.system).toBe('Lave');
  });

  it('credits only the signed-in callsign, never the one in the track', () => {
    const d = fight();
    d.ships[0].label = 'CMDR SomeoneElse';
    const c = check(d, null);
    if (typeof c === 'string') throw new Error(c);
    expect(c.title).toBe('A commander: fighting a Mamba at Lave');
    expect(unpackTrack(c.packed)!.ships[0].label).toBe('A commander');
  });

  it('writes every label itself: nothing typed survives', () => {
    const d = fight();
    d.ships[1].label = 'visit my site example.com';
    const c = check(d);
    if (typeof c === 'string') throw new Error(c);
    expect(unpackTrack(c.packed)!.ships[1].label).toBe('Mamba · pirate');
  });

  it('titles a death by what shot you down', () => {
    const d = fight();
    d.events.push({ t: 9, kind: 'death', by: 2 });
    const c = check(d);
    if (typeof c === 'string') throw new Error(c);
    expect(c.title).toBe('CMDR Kestrel: shot down by a Mamba at Lave');
  });

  it('refuses ships that do not exist, odd roles, colours that are not colours, and names that are not systems', () => {
    const a = fight();
    a.ships[1].def = 'x-wing';
    expect(check(a)).toBe('Unknown ship');
    const b = fight();
    b.ships[1].role = 'admin';
    expect(check(b)).toBe('Unknown ship');
    const c = fight();
    (c.events[0] as { color: string }).color = 'url(javascript:alert(1))';
    expect(check(c)).toBe('Bad shot');
    const e = fight();
    e.scene.system = '<b>Lave</b>';
    expect(check(e)).toBe('Unknown system');
  });

  it('refuses nonsense numbers and things that are not tracks', () => {
    const d = fight();
    d.samples[5].poses[0].p = [Infinity, 0, 0];
    expect(check(d)).toBe('Bad pose');
    expect(checkTrack(new TextEncoder().encode('not a track at all'), SHIPS, null, 20)).toBe("That isn't a track");
  });
});

describe('a fight with kills is called that, as the flight log calls it', () => {
  /** The fight, with more Mambas, each hit by you (or by someone else) and going up. */
  function kills(byYou: number, byOthers = 0): TrackData {
    const d = fight();
    for (let k = 0; k < byYou + byOthers; k++) {
      const id = 10 + k;
      d.ships.push({ id, def: k === 0 ? 'mamba' : 'falcon', role: 'pirate', label: 'x' });
      d.events.push({ t: 7 + k * 0.1, kind: 'beam', from: k < byYou ? 1 : 2, a: [0, 0, 0], b: [500, 30, 0], color: '#3dffb0', hit: id });
      d.events.push({ t: 7.05 + k * 0.1, kind: 'boom', id, p: [500, 30, 0] });
    }
    return d;
  }

  it('counts three kills in one fight', () => {
    const c = check(kills(3));
    if (typeof c === 'string') throw new Error(c);
    expect(c.title).toBe('CMDR Kestrel: 3 kills in one fight at Lave');
  });

  it('names a single kill', () => {
    const c = check(kills(1));
    if (typeof c === 'string') throw new Error(c);
    expect(c.title).toBe('CMDR Kestrel: Mamba down at Lave');
  });

  it("doesn't count a ship someone else finished off", () => {
    const c = check(kills(1, 2));
    if (typeof c === 'string') throw new Error(c);
    expect(c.title).toBe('CMDR Kestrel: Mamba down at Lave');
  });
});
