---
title: CMDR Bond's ship
status: proposed
pillar: world
summary: An Anaconda the Bureau of Continuity had rebuilt as a cruiser for people, not cargo, with a saloon raised on her crest and an experimental shield from the same secret programme as the Constrictor. Racing green, never returned, never for sale.
stages:
  - The hull, drawn and approved from pictures | proposed
  - In the game - our Anaconda and his conversion, checked against the fleet | proposed
  - The experimental shield, the party pieces, and his outings | proposed
---

# Design: CMDR Bond's ship

*Proposed, 10 November 2026. Mark: "Lets build the ship and only CMDR BOND" (un-parked; the brief is [the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired) and [ideas](../ideas.md)). Mark, through the day: racing green rather than silver; "It needs to be a cruiser and have quarters for entertainment"; "instead of guessing, look for inspiration first"; "I think he should have an anaconda 2 inspired ship" (our own Anaconda, his a one-off); "compared to the Fdl it's quite ugly" (redrawn); "much better"; "For the lore etc she should have an experimental shielding". Change by pull request.*

## The rules for this one

Bond is an easter egg, and he leans on a famous character, so the lines are held tighter than usual:

- **His name is CMDR Bond, and only that.** Never his first name, anywhere: game text, ship names, files, commits, the changelog. Member **007** stays held as it is.
- **The hull is ours.** It's our Anaconda, in the *spirit* of a 1960s British grand tourer and gentleman's motor yacht. No real car's or yacht's lines are traced, and no real maker is named anywhere, in the game or out of it.
- **Nothing from the films.** No film names, no quotes, no music cues, no film gadget names. Every fitting has a plain, in-world name of its own.
- **The Neo look holds.** She glows like every hull, never dimmed. Her colour is a line colour, and look numbers stay in `src/render/look.ts`. Mark's yes on pictures comes before any ship file merges.

## Where the shape came from

Looked for first, not guessed (Mark):

- **The Fer-de-lance's elegance:** a needle nose, a hexagonal hull with a crest along her spine, a swell to the shoulders and a taper to the tail, and air in the silhouette. The first Anaconda drawn without these was a slab ("quite ugly"); the second used them.
- **1960s British grand tourers:** a long bonnet and a roof that falls away to the tail.
- **1960s gentlemen's motor yachts:** a deck saloon set behind a long foredeck.
- **Streamliner observation cars:** the lounge as the end of the vehicle, looking back.
- **Concept "space yachts":** hide the windows and let one sculptural shape carry it, which is our rule anyway (no windows, ports or panels).

## Two ships, one family

### Our Anaconda (Cowell & MgRath)

The Cobra's maker's halo ship, an open brief until now ([the shipbuilders](shipbuilders.md), [ships and classes](ships-and-classes.md)).

- **Shape:** one hexagon scaled along her length so every panel is flat. A needle nose, a crest along her spine, widest at the shoulders two-thirds back, narrowing to the tail, with a drive sponson down each flank for the Cobra family's broad arrowhead. About 171 m long, 80 m across the sponsons and 18 m high, so she docks.
- **Stats (first draft):** speed 200, pitch 0.45, roll 0.9, hull 600, shields 400, 6 missiles, 650,000 Cr.
- **Her hold is 180 t, not 350.** `balance_check` puts a hull her size at most about 185 t, at the density the fleet carries. She can't grow bigger and still dock, so the proportions table in [ships and classes](ships-and-classes.md) should come down to match.

### His: an Anaconda the Bureau had converted

- **Why she exists:** the Bureau of Continuity ([lore](../lore.md)) had six Anacondas rebuilt in the years after the Grey Fever by **Hollis & Thorne**, coachbuilders who never built more than a dozen hulls a year, all to order. They became couriers for people, not cargo: envoys, witnesses, a scientist who couldn't be seen to travel. Most of the hold gave way to quarters.
- **Her name: *On Loan*.** Five were scrapped when the courier service closed. When the Bureau let him retire, nobody asked for the sixth back.
- **Shape:** the Anaconda's hull with a **saloon raised on her crest** two-thirds back: a steep front like a windscreen, a flat roof over the lounge and the bar, falling away to the tail like a grand tourer's roof. No windows: the raised shape alone says people live and entertain aboard. 25.6 m high, inside the 26 m slot.
- **Colour:** racing green (#26c46a), deeper and truer than the yard's Witchspace Green (#3dffb0).
- **Stats (first draft):** speed 250 (faster than any Anaconda has a right to be), pitch 0.55, roll 1.0, hull 520, shields 480, hold 120 t, 3 missiles. Never for sale.

## The experimental shield *(Mark, 10 November 2026)*

**Where it came from:** the Co-operative Naval Yards' prototype programme, the one that built the **Constrictor**, the stolen prototype that is Bond's unclosed case ([the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired); [exploration](exploration.md#stage-4-legends)). The Bureau borrowed the programme's shield for its couriers, on trial. The trial was never written up, and his set was never taken back. So his ship carries a piece of the same secret as the ship he's still hunting, and he knows it.

**What it does (to decide):** a shield that learns. Whatever keeps hitting her does less and less, down to about half, while it keeps hitting; let up, or hit her with something else, and it starts again. So the way to hurt her is to change weapons, or to use missiles, never to hold the trigger. It's readable on screen: each hit's flash on her shield grows brighter as it hardens (the glow only ever gets brighter, never dimmer).

**What it isn't:** for sale, or fittable, or anyone else's. If a player ever sees it on another hull, it's because the Constrictor story has moved.

## The party pieces

Four fittings, his alone, used when he flies her (she's an NPC's ship; no player can buy or fit them). Each has a plain in-world name and does something you can see and understand on the scanner.

| Fitting | What it does | What you see |
|---|---|---|
| **Smoke screen** | A cloud from the stern that breaks missile locks and hides her from scanners for a few seconds | A grey-green cloud; she drops off your scanner |
| **Stern mine** | One mine, left in her wake; it drifts, then goes off near a ship | A small glowing point behind her, then a flash |
| **Tail plate** | Armour that rises over the stern, and rear shots do nothing while it's up | A plate rising over her stern |
| **Tracer tag** | Tags a ship so she can find it anywhere in the system | (On his side) a tagged ship stays on his scanner |

*None of these is a film gadget's name, and the ideas are common to every spy story: a smoke screen, a mine, armour, a tracker. If a name feels too close, it changes.* Whether a cruiser keeps all four, or trades some for a host's touches (a welcome hail as you pass, an invitation aboard), is Mark's call.

## Where she appears

As [the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired) says: most days, nowhere. Now and then he takes her out, when something on the Constrictor trail interests him. That's the rare sighting commanders talk about.

## Stages

1. **The hull.** *Done as pictures, 10 November 2026:* our Anaconda (redrawn after "quite ugly"; "much better") and his conversion with the saloon on her crest. Next: pictures of both flying in the game in the Neo look, at lane distance and on a phone, for Mark's yes.
2. **In the game.** `content/ships/anaconda.json` (Cowell & MgRath) and his conversion (`aiAssisted: true`, never for sale), checked with `validate_ship` and `balance_check`, stats tuned.
3. **The experimental shield, the party pieces, and his outings.** The shield and the fittings as NPC behaviour, tuned in the duel simulation, and the rare sighting on the trail.
