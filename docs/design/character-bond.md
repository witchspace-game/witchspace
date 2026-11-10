---
title: CMDR Bond's ship
status: proposed
pillar: world
summary: A one-off grand tourer, coachbuilt for the Bureau of Continuity's courier service and never returned. Long, low and quick, in racing green, with four quiet party pieces. His alone, like an edition, never for sale.
stages:
  - The hull, drawn and approved from pictures | proposed
  - In the game - the ship file, checked against the fleet | proposed
  - The party pieces - what she does when he takes her out | proposed
---

# Design: CMDR Bond's ship

*Proposed, 10 November 2026. Mark: "Lets build the ship and only CMDR BOND" (un-parked; the brief is [the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired) and [ideas](../ideas.md)). Colour, Mark: racing green rather than silver, with the spirit of a 1960s British grand tourer. Change by pull request.*

## The rules for this one

Bond is an easter egg, and he leans on a famous character, so the lines are held tighter than usual:

- **His name is CMDR Bond, and only that.** Never his first name, anywhere: game text, ship names, files, commits, the changelog. Member **007** stays held as it is.
- **The hull is ours.** It's in the *spirit* of a 1960s British grand tourer (a long bonnet, a short tail, a low fastback roof, power held back), drawn from scratch. No real car's lines are traced, and none of a real car's signature details (grille shape, side vents, badge) appear. No real maker is named anywhere, in the game or out of it.
- **Nothing from the films.** No film names, no quotes, no music cues, no film gadget names. The party pieces below have plain, in-world names of their own.
- **The Neo look holds.** She glows like every hull, never dimmed; her colour is a line colour, and look numbers stay in `src/render/look.ts`. Mark's yes on pictures comes before any ship file.

## Who made her, and why she exists

- **The maker: Hollis & Thorne**, coachbuilders of a rich Democracy, who never built more than a dozen hulls a year, all to order. (A one-off maker, not one of the [shipbuilders](shipbuilders.md)' line-ups.)
- **The hull type: the Attaché.** The Bureau of Continuity ([lore](../lore.md)) ordered six, in the years after the Grey Fever, to carry what couldn't go by any company's ship: sealed reports, a sample, a person. Fast enough to outrun a pirate, quiet enough not to be noticed, comfortable enough for a long run alone.
- **Her name: *On Loan*.** When the Bureau let him retire, nobody asked for her back. Five of the six were scrapped when the courier service closed. Hers is the one in his hangar, still with her fittings.

## How she flies, against the fleet

A courier, not a warship: faster than a Falcon, as quick to turn as a Viper, a light hull, a small hold, one missile.

| | Speed | Pitch | Roll | Hull | Shields | Hold | Missiles |
|---|---|---|---|---|---|---|---|
| Cobra Mk III | 280 | 0.80 | 1.5 | 150 | 100 | 20 t | 4 |
| Viper | 320 | 1.00 | 1.8 | 90 | 80 | 0 | 1 |
| Falcon | 340 | 0.95 | 1.8 | 230 | 320 | 10 t | 3 |
| Fer-de-lance | 330 | 0.85 | 1.6 | 200 | 240 | 30 t | 3 |
| **Attaché, *On Loan*** | **360** | **1.0** | **1.8** | **120** | **180** | **6 t** | **1** |

A first guess, to be checked with `balance_check` against the fleet once the hull exists. Never for sale, so no price; her `ratingValue` puts her among the fighters, not the freighters.

**Her colour:** a racing green glow, deeper and truer than the yard's Witchspace Green (#3dffb0) and nothing like Reorte Acid (#b6ff5c). Candidates to see side by side in the Neo look are in the pictures.

## The party pieces

Four fittings, his alone, used when he flies her (she's an NPC's ship; no player can buy or fit them). Each has a plain in-world name and does something you can see and understand on the scanner.

| Fitting | What it does | What you see |
|---|---|---|
| **Smoke screen** | A cloud from the stern that breaks missile locks and hides her from scanners for a few seconds | A grey-green cloud; she drops off your scanner |
| **Stern mine** | One mine, left in her wake; it drifts, then goes off near a ship | A small glowing point behind her, then a flash |
| **Tail plate** | Armour that rises over the stern, and rear shots do nothing while it's up | A plate rising behind her canopy |
| **Tracer tag** | Tags a ship so she can find it anywhere in the system | (On his side) a tagged ship stays on his scanner |

*None of these is a film gadget's name, and the ideas are common to every spy story: a smoke screen, a mine, armour, a tracker. If a name feels too close, it changes.*

## Where she appears

As [the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired) says: most days, nowhere. Now and then he takes her out, when something on the Constrictor trail interests him. That's the rare sighting commanders talk about. Building where and when is the third stage; this design starts with the hull.

## Stages

1. **The hull.** Side-on and top-down sketches of two or three shapes, in two greens, for Mark to choose. Then the geometry, original vertices only, checked with `validate_ship` and `preview_ship`, and pictures in the Neo look at lane distance and on a phone. *Mark's yes on the pictures before any ship file.*
2. **In the game.** The ship file (`content/ships/attache.json`, maker Hollis & Thorne, `aiAssisted: true`, never for sale), `balance_check` against the fleet, and the stats above tuned to what it says.
3. **The party pieces, and his outings.** The four fittings as NPC behaviour, and the rare sighting on the trail.
