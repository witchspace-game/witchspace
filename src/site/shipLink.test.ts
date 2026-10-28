import { describe, expect, it } from 'vitest';
import cobra from '../../content/ships/cobra-mk3.json';
import titanoboa from '../../content/ships/titanoboa.json';
import { shipFromHash, shipHash } from './shipLink';

describe('ship links', () => {
  it('carry a ship file there and back', async () => {
    const hash = await shipHash(cobra);
    expect(hash).toMatch(/^ship=[\w-]+$/);
    expect(await shipFromHash(`#${hash}`)).toEqual(cobra);
  });

  it('stay short enough for a phone, even for the biggest ship', async () => {
    expect((await shipHash(titanoboa)).length).toBeLessThan(16_000);
  });

  it('turn away anything that isn’t a ship', async () => {
    expect(await shipFromHash('#ship=not-a-ship')).toBeNull();
    expect(await shipFromHash(`#${await shipHash({ name: 'Nothing' })}`)).toBeNull();
    expect(await shipFromHash('#other=1')).toBeNull();
  });
});
