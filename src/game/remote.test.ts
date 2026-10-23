import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { cargoTonnes, newCommander } from './commander';
import { abandon, afterJump, board, collect, COLLECT_JUMPS, deliver, destinationOf, loseContracts, MAX_ACTIVE, reserve, reservedTonnes, standing, take } from './contracts';
import { jobStrip, stepFor } from './jobs';

// Accepting a contract over the comms array, and collecting it at the station
// (docs/design/radio-and-comms.md).

const lave = systemAt(0, 7);
const NOW = Date.UTC(2026, 9, 22, 12);
const starter = () => board(newCommander('modern'), lave, NOW).find((x) => x.needs === 'Casual' && !x.survey)!;

describe('accepting work over the comms array', () => {
  it('reserves it without loading anything: no hold space needed yet', () => {
    const c = newCommander('modern');
    const o = starter();
    expect(reserve(c, o)).toBeNull();
    expect(c.contracts![0]).toMatchObject({ id: o.id, reserved: true, jumpsLeft: COLLECT_JUMPS });
    expect(cargoTonnes(c)).toBe(0);
    expect(reservedTonnes(c)).toBe(o.qty);
    // It's off the board, as if taken there.
    expect(board(c, lave, NOW).some((x) => x.id === o.id)).toBe(false);
    expect(reserve(c, o)).toBeTruthy();
  });

  it('checks standing, the contract limit and the rules at acceptance', () => {
    const o = starter();
    expect(reserve(newCommander('classic'), o)).toMatch(/Modern/);
    const c = newCommander('modern');
    c.standing = { [o.company]: -12 };
    expect(reserve(c, o)).toMatch(/Blacklisted/);
    const d = newCommander('modern');
    d.contracts = Array.from({ length: MAX_ACTIVE }, (_, i) => ({ ...o, id: `x${i}`, jumpsLeft: 3 }));
    expect(reserve(d, o)).toMatch(/at once/);
    // Reserved work counts towards the limit too.
    const e = newCommander('modern');
    for (let i = 0; i < MAX_ACTIVE; i++) expect(reserve(e, { ...o, id: `r${i}` })).toBeNull();
    expect(take(e, o, 100)).toMatch(/at once/);
  });

  it('surveys and special assignments are collected at the station, not over the array', () => {
    const survey = board(newCommander('modern'), lave, NOW).find((x) => x.survey);
    if (survey) expect(reserve(newCommander('modern'), survey)).toMatch(/station/);
    expect(reserve(newCommander('modern'), { ...starter(), special: true })).toMatch(/station/);
  });

  it('is collected when you dock where it waits, if it fits, and the delivery clock starts then', () => {
    const c = newCommander('modern');
    const o = starter();
    reserve(c, o);
    const elsewhere = destinationOf(o);
    expect(collect(c, elsewhere, 20)).toEqual([]); // not here
    expect(collect(c, lave, o.qty - 1)[0]).toMatch(/more room/);
    expect(c.contracts![0].reserved).toBe(true);
    expect(collect(c, lave, o.qty)[0]).toMatch(/loaded/);
    expect(c.contracts![0].reserved).toBeUndefined();
    expect(c.contracts![0].jumpsLeft).toBe(o.jumps);
    expect(cargoTonnes(c)).toBe(o.qty);
    const credits = c.credits;
    expect(deliver(c, elsewhere)).toHaveLength(1);
    expect(c.credits).toBe(credits + o.pay);
  });

  it("isn't delivered before it's collected", () => {
    const c = newCommander('modern');
    const o = starter();
    reserve(c, o);
    expect(deliver(c, destinationOf(o))).toEqual([]);
    expect(c.contracts).toHaveLength(1);
  });

  it('lapses as abandoned if not collected in time, with a warning first', () => {
    const c = newCommander('modern');
    const o = starter();
    reserve(c, o);
    for (let i = 0; i < COLLECT_JUMPS; i++) afterJump(c, NOW);
    expect(c.contracts).toHaveLength(1);
    expect(c.messages![0].subject).toBe('Waiting for you');
    expect(afterJump(c, NOW)[0]).toMatch(/abandoned/);
    expect(c.contracts).toHaveLength(0);
    expect(standing(c, o.company)).toBe(-3);
  });

  it('is not lost with your ship, and can be given up like any contract', () => {
    const c = newCommander('modern');
    const o = starter();
    reserve(c, o);
    expect(loseContracts(c)).toEqual([]);
    expect(c.contracts).toHaveLength(1);
    expect(abandon(c, o.id)).toMatch(/remember/);
  });

  it('the job strip says where to collect it', () => {
    const c = newCommander('modern');
    const o = starter();
    reserve(c, o);
    expect(stepFor(c, lave, c.contracts![0])).toMatchObject({ action: 'dock' });
    expect(stepFor(c, lave, c.contracts![0]).line).toMatch(/^Collect/);
    expect(jobStrip(c, destinationOf(o))!.step.next).toMatch(/collect it|Refuel|Set course|Hyperspace/);
    expect(jobStrip(c, lave)!.all[0].short).toBe('Collect · Lave');
  });
});
