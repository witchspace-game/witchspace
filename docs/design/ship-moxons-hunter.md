---
title: Mark Moxon's ship
status: idea
pillar: build
summary: A long-haul bounty hunter, briefed by Mark Moxon of bbcelite.com. It goes out to the middle of nowhere, hunts the baddies there and lives in a bit of luxury. Built as a genuine 6502 ship blueprint, so in principle it could fly in the 1984 code too.
card: viper
stages:
  - Brief, and the blueprint's limits | built
  - Sketches, for Mark Moxon to steer | proposed
  - The blueprint (6502 source) and the ship file made from it | proposed
  - Its place in the game: long-range kit and warrants | proposed
help:
  - Sketch a long-haul hunter within the blueprint's limits, at most 16 faces | ships
---

# Design: Mark Moxon's ship

*Design, 27 October 2026. (Mark Moxon's brief, via Mark.) The name is open: Mark Moxon may suggest one.*

Mark Moxon's annotated Elite source and deep dives ([bbcelite.com](https://elite.bbcelite.com/deep_dives/)) guided much of Witchspace. To thank him, Mark offered him the callsign CMDR Moxon and a ship of his own. He said yes to both.

## The brief

In his words: *"a kind of Fer-de-Lance-type deep space bounty hunter ship, designed for long-haul missions out to the middle of nowhere, hunting down the baddies while living in a bit of luxury."*

- **Fer-de-Lance in spirit only.** The Fer-de-Lance's shape is Frontier's design. This ship takes its spirit: sleek, fast, well-off, dangerous. It must be an original shape that evokes the idea and copies nothing ([AGENTS.md](../../AGENTS.md)).
- **Deep space and long haul.** Range and endurance come before cargo: a big fuel tank, a fuel scoop as standard, and room for the long-range kit.
- **Bounty hunter.** It's built to catch and hold a ship, not haul goods. The prey are wanted commanders and pirates, out where the police don't go.
- **A bit of luxury.** A cabin worth living in for weeks. It shows on the outside: a long, clean hull and a generous canopy, not a gun with an engine.

## The promise: a genuine 6502 blueprint

*On hold until Mark Moxon answers: Mark has asked him whether he'd like the ship strictly within the 1984 limits below, so it could fly in the original code, or "more Neo", with more lines and detail, in Witchspace only. No geometry until he says.*

The thank-you email promised a real ship blueprint, laid out as in his [ship blueprints deep dive](https://elite.bbcelite.com/deep_dives/ship_blueprints.html). In principle it could then fly in the 1984 code too. That sets hard limits on the shape, which are part of the charm:

- **Byte-sized vertices:** each coordinate is a magnitude from 0 to 255 with a sign bit, so the whole ship lives on a coarse grid.
- **At most 16 faces**, because face numbers are 4-bit nibbles. Each vertex lists up to four faces, for hidden-line removal.
- **At most about 42 vertices**, from the byte offsets in the header.
- **A laser vertex:** the point the beam comes from.
- **The header in full:** cargo canisters on destruction, targetable area, the edge and face offsets, the explosion count, the vertex, edge and face counts, the bounty, the visibility distance (0 to 31, beyond which it's drawn as a dot), energy, top speed, the face normals' scale (2^n), and missiles and laser power packed into one byte.
- **Written with the VERTEX, EDGE and FACE macros**, as in his source, so he can read it the way he reads Bell and Braben's.

**In Witchspace:** the blueprint is the source of truth. A small tool turns it into the ship file (`content/ships/<id>.json`), so the two can never drift apart, and CI checks the blueprint against these limits. The 16 faces fit the game's own look anyway: faces filled dark, hidden lines, neo glow.

**It still has to pass our checks** ([ships, classes and makers](ships-and-classes.md#shape-and-size-mark-27-october-2026)): it fits the docking slot (90 m wide, 26 m tall, wings level), its hold suits its hull, and it balances against the fleet (`balance_check`).

## Class and maker

- **Class:** a **long-range hunter**, between Interceptor (catching things, guns) and Explorer (range, endurance). It's faster than an Explorer and goes further than an Interceptor, with a small hold. It's a new class, so it needs adding to the classes table.
- **Maker:** open. Zorgon Petterson (fast and flashy) builds the yacht-class halo, so this could be theirs, or a small independent yard built around it. Mark Moxon may have a view.
- **An idea, for Mark to decide:** there's no Fer-de-Lance in the game yet; it's planned as Zorgon Petterson's yacht. This ship could be that yacht's long-haul, armed cousin. It would arrive first, and the Fer-de-Lance tribute would follow as the civilian version. That gives it a place in the makers' line-up without copying Frontier's hull. (Suggested by the Marketing session; not yet approved.)

## In the game

- **The bounty side.** Warrants ([law and travel](law-and-travel.md)) give it prey: wanted commanders who run to the anarchies and the empty systems. Later, players taking loan sharks' contracts as bounty hunters.
- **Long-range kit:** the large fuel tank, the fuel scoop, and whatever comes with [exploration](exploration.md) for finding a ship that's running dark.
- **Earned or bought?** A hunter's ship could be earned through bounty work, like a Lancer for a Marshal ([earned, not bought](ships-and-classes.md#4-earned-not-bought)), or sold dear.
- **No timeline has been promised.**

## Next

1. **Sketches:** three silhouettes within the limits, each drawn as the game would draw it beside a Cobra, for Mark Moxon to steer (through Mark).
2. **The blueprint** of the chosen one, in 6502 source with the macros, plus the tool that makes the ship file.
3. **Its page** on the site as a concept, credited to Mark Moxon's brief.

## Open questions

- Strictly 6502 (it could fly in the 1984 code) or more Neo (more lines and detail, Witchspace only)? Mark has asked Mark Moxon.
- Zorgon Petterson's armed cousin of the Fer-de-Lance yacht, arriving first?
- Its name (Mark Moxon may suggest one).
- Its maker.
- Its laser and missiles in the header: a hunter's loadout, but balanced against the Viper and the Lancer.
- Does it carry a way to hold its prey (the Shrike's clamp, [the Shrike](ship-the-shrike.md)), or does it bring them in dead?
