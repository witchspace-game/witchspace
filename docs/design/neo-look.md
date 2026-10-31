---
title: The Neo look
status: built
pillar: build
summary: Witchspace's signature, written down and locked: glowing lines in role colours, elegance over detail, never dimmer. Every number in one file, and a look check that photographs it, so it never changes by accident.
card: cobra-mk3
stages:
  - The look, in one file (src/render/look.ts), and the look check (tools/look-check.mjs) | built
  - Engine glow, drawn in the same lines and light | proposed
help:
  - Look at the glow on deep blues and violets (issue #292) and send a fix that passes the look check | code
---

# Design: the Neo look *(Mark, 31 October 2026)*

Mark: *"The look of the Neo world is our 'signature' look. Lets get this right and locked down so we do not go changing it without serious consideration."*

## What it is

- **Glowing lines, in role colours.** Every ship is a few glowing lines with a strong silhouette: traders green, police blue, pirates red and orange, the Marshals gold, editions in their own paint. Glow is identity: a ship is never dimmed to look stealthy or menacing; menace comes from shape and behaviour ([ships and classes](ships-and-classes.md)).
- **Elegance over detail.** No textures, no surface clutter, no modelled interiors. When in doubt, take a line away (Mark, 25 October 2026: *"theres something very elegant about our 'neo' world of ships that I love"*).
- **The glow hugs the lines.** Five blurs, weighted to the tight ones, so a ship glows without sitting in a screen-sized haze.
- **Space is dark and quiet.** Faint blue-white stars at infinity that never outshine a ship; planets as lit globes with a grid and a soft rim of air; one sun that blazes.
- **1984 mode is the other look,** white lines on black in hard pixels, and keeps the original's rules. Nothing here changes it.

## Where it lives

**Every number is in [`src/render/look.ts`](../../src/render/look.ts)**, and nowhere else: the glow (strength, threshold, the five weights, the phone's lighter glow), the pixel ratio, anti-aliasing by screen, the brightness cap, the grain, a ship's lines and fill, the stars, the planet and its air, and the sun. The game reads them, and so do the site's pages, so the game and the site glow alike.

**Screens differ, on purpose:**
- **A computer at 1×:** 4× anti-aliasing for the image the glow is made from, so long shallow lines don't break into crawling dashes (#351). Free at that size.
- **A Retina screen:** no anti-aliasing there (its steps are half the size, and it cost nearly half the frame rate).
- **A phone:** no anti-aliasing, and the glow worked out at three-quarters resolution, for the battery (#306). It looks the same.
- **Frame rate:** a computer draws at its screen's rate (144 on a 144 Hz monitor); a phone at most 60 (#350).

## How it changes: never by accident

**The look check** (`node tools/look-check.mjs`, with the dev server running) draws fixed scenes with the game's own code, the clock stopped and the stars seeded, and compares them with the reference pictures in `tools/look/reference/`:
- **the fleet:** every role colour, and a Dark Edition's deep violet;
- **a planet's edge** against the stars;
- **the hangar;**
- **the stars alone;**

each on a computer's 1× screen and on a phone. Identical runs come out pixel for pixel the same; a 10% weaker glow shows on six of the eight pictures.

**To change the look:**
1. Change `look.ts` (or the drawing code), and run the look check.
2. Show Mark the pictures it flags (`tools/look/out/`): the pictures, not just the numbers.
3. Only with his yes, `node tools/look-check.mjs --accept`, and the new references go in the same pull request.

Any pull request that touches `src/render/` runs the look check first, including from contributors.

## Open

- **Deep blues and violets can glow unevenly** ([issue #292](https://github.com/witchspace-game/witchspace/issues/292), spotted by jankfactor on Stardot). The threshold is on brightness, where pure blue counts for about 7%, so a blue line's pixels sit right at it and only some glow. The anti-aliasing half of that issue is done (#351). The fix must keep the glow cleaner, never dimmer, across the palette, and pass the look check on everything but the pictures it's meant to improve.

## Engine glow *(idea, Mark, 31 October 2026)*

Mark: *"We could always use some of this to simulate engine effects etc."*

The same light could show what a ship is doing, without breaking the rule of lines:
- **A drive plume:** a few short lines behind each engine, in the ship's colour, growing with the throttle and flickering slightly; brighter than the hull (so it glows), gone at zero speed. A Cobra's two drives, a Fer-de-lance's long trail, a Lancer's hard white burn.
- **The in-system jump and hyperspace:** the plume stretching to a streak as the drive spools up.
- **Damage:** a damaged drive sputters, its plume breaking up; a ship on fire leaves a short glowing trail.
- **Seen by others:** other ships' plumes show their speed at a glance, and in shared space a commander's throttle becomes visible.

Within the look: lines and glow only, never particles or smoke; driven by `look.ts` like everything else; and checked by a new look-check picture of a ship under thrust before it's merged.
