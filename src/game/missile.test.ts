import { describe, expect, it } from 'vitest';
import { shipById } from '../content/ships';
import { Missile, MISSILE } from './missile';
import { PlayerShip } from './playerShip';

const cobra = () => new PlayerShip(shipById('cobra-mk3')!);

function fly(m: Missile, target: PlayerShip | null, seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    if (target) target.move(dt);
    const r = m.update(dt);
    if (r !== 'flying') return { result: r, time: t };
  }
  return { result: 'flying' as const, time: seconds };
}

describe('missiles', () => {
  it('home in on a ship flying across their path', () => {
    const shooter = cobra();
    const target = cobra();
    target.obj.position.set(0, 0, 2000);
    target.obj.rotateY(Math.PI / 2); // crossing at right angles
    target.speed = 250;
    const m = new Missile(shipById('missile')!, shooter, target);
    const { result, time } = fly(m, target, 20);
    expect(result).toBe('hit');
    expect(time).toBeLessThan(8);
  });

  it('turn too slowly to catch a target right behind them up close', () => {
    const shooter = cobra();
    const target = cobra();
    target.obj.position.set(0, 0, -300);
    const m = new Missile(shipById('missile')!, shooter, target);
    // It has to come all the way round, so it can't hit within the first two seconds.
    expect(fly(m, target, 2).result).toBe('flying');
  });

  it('fly straight on and burn out when they lose their target', () => {
    const m = new Missile(shipById('missile')!, cobra(), null);
    const { result, time } = fly(m, null, 40);
    expect(result).toBe('expired');
    expect(time).toBeCloseTo(MISSILE.lifetime, 0);
    expect(m.position.z).toBeGreaterThan(10000);
  });
});
