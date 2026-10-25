---
title: The Titanoboa, a modular factory
status: designed
pillar: world
summary: Wexley-Yorozu's constructor rebuilt as a factory of modules on a common coupling - maw, furnaces, reactor, fabricator, science, habitat, drive - each a single clear shape in glowing line. It's as big as the job needs, new modules are sent where they're needed and can stay on the finished station, sections are swapped when they fail, and a reactor towed between stars is work for commanders.
card: titanoboa
stages:
  - The modules and the coupling, and the standard line-up on the ship page | proposed
  - Yards assemble the line-up the job needs (a station, a refinery, an atmosphere processor) | proposed
  - Modules sent where they're needed - a science module for exotic organisms couples on, and stays with the station | proposed
  - Sections swapped in the yard - a failed reactor towed away, a new one fitted | proposed
  - Module work for commanders - haul, escort and salvage a section | proposed
help:
  - Design a module - one clear shape that says what it does at scanner range | ships
  - Write the yard's radio when a reactor section is being changed out | writing
  - Name the module types as Wexley-Yorozu's catalogue would (dry, corporate, a little sinister) | writing
---

# Design: the Titanoboa, a modular factory

*Design, 25 October 2026, from Mark's idea: the Titan is a factory in space, built from sections that can be removed and replaced, so it can be as large as it needs to be. Proposed; it replaces the current hull. Modern only, as yards are.*

## Why

The Titanoboa is Wexley-Yorozu's constructor: it arrives at a moon, eats it a little at a time, and leaves a station behind ([the trading companies](../companies.md#the-fleet-the-titanoboa-and-the-yards)). The current hull is a box spine covered in blocks, chimneys and windows, 264 lines that glow into one yellow smear at any distance. That breaks the rule we hold every ship to: **elegance over detail** ([ships and classes](ships-and-classes.md), [CONTRIBUTING](../../CONTRIBUTING.md)).

Mark's idea answers both problems. A factory in space wouldn't be one hull; it would be **sections on a common coupling**: a reactor, furnaces where the exotic materials are made, a fabricator, quarters for the workers, the drive. A section that fails is uncoupled and replaced. A bigger job gets more sections. So the ship is as large as it needs to be, and each section can be drawn as one clear shape, which is the elegance we want: you read it along its length, *maw, furnace, furnace, reactor, fabricator, habitat, drive*, at a glance.

## Principles

- **One shape per module.** Each section has a single silhouette that says what it does, in a handful of lines. No windows, pipes or panels.
- **One coupling.** Every module meets the next through the same short square coupling, so any module fits anywhere and the joins read as joins: you can see where it comes apart.
- **As big as the job.** A small refinery job is four modules; a station is seven; a great works is ten or more. The line-up comes from the job, not from a single ship file.
- **Failure is visible and fixable.** A reactor in trouble is uncoupled, towed clear and replaced, and that's a scene, and work, not a stat.
- **Neo glow, full strength,** in Wexley-Yorozu's construction yellow, with the company insignia on the habitat.

## 1. The modules

Sketched in the game's renderer (25 October 2026) and checked against the hull rules; proportions to refine.

| Module | Shape | What it does |
|---|---|---|
| **Maw** (the prow) | A six-sided funnel with an open, recessed mouth | The intake. Ore from the moon goes in here; the ship eats the moon a little at a time. |
| **Furnace** | A crucible: six-sided, swelling to twice its width and narrowing again | Smelting and refining, and where the exotic materials are made. The hottest thing on her. |
| **Reactor** | A broad eight-sided drum, the widest module | Power for the whole ship. The one you don't want to go wrong. |
| **Fabricator** | An open cradle: a thin spine with two long arms above and below, joined at the ends | Where station sections are made: the spine, the truss, the plate. You can see through it. |
| **Science** | A sealed containment pod held out on a mast, at arm's length from the rest of the ship | Research on whatever explorers found living in the system: exotic organisms, kept well away from the workers. |
| **Habitat** | A flat, wide six-sided slab | Quarters for a few thousand workers. Carries the company insignia. |
| **Drive** | A block with three nozzles | She never hurries. |
| **Coupling** | A short square neck, 70 m | Between every pair of modules. |

**Line-ups.** Front to back, the maw first and the drive last:

- **Small** (a refinery job): maw, furnace, reactor, drive. About 1.4 km, 130 vertices.
- **Standard** (a station): maw, furnace, furnace, reactor, fabricator, habitat, drive. About 2.4 km, 224 vertices.
- **Large** (a great works): three furnaces, two fabricators, two reactors. About 3.4 km, 320 vertices.

## 2. How it's built in the game

**Modules are parts, not one ship.** A ship file holds at most 256 vertices, and a Large Titanoboa needs more, so each module becomes its own small content file with its length and its coupling points, checked by the same hull rules as any ship (`npm run validate`). The game assembles a line-up from them at runtime, the same way the yard already assembles the station in its current stage ([the yards](companies-and-contracts.md#4b-building-worlds)).

- **The ship file** `content/ships/titanoboa.json` stays, generated from the Standard line-up by a tool, so the ship page, the share card and anything else that expects one ship still works.
- **The yard** (`src/render/yard.ts`) builds the line-up the job needs instead of the one hull, and takes its ore intake from the maw and its outfall from the fabricator rather than from fixed points.
- **Contributors can design a module.** One shape, one coupling, a sentence on what it does: a small, satisfying first contribution, and the MCP server can check it.

## 3. Modules sent where they're needed

*(Mark, 25 October 2026.)* Because every module couples the same way, Wexley-Yorozu doesn't need a new ship for a new job; it sends a module. When explorers find something living in a system ([exploration](exploration.md)), the Science Division wants it studied where it was found, so a **science module** is built at another yard and sent out. Modules have no engines of their own (Mark): **Bullsnakes**, Wexley-Yorozu's slow construction tugs, bring it. A Bullsnake is 70 m and a module is hundreds of metres, so they work as a team: three or four clamp on with their tractor booms (the arms where a fighter's guns would be), bring it in slowly, line it up on the Titanoboa working there, hold it while it couples, then let go and scatter. Only the Titanoboa has a drive, because only the whole factory travels. From then on the yard you visit has a pod on a mast that wasn't there last week, and the news says why.

**And it can stay.** The station the Titanoboa builds takes the same coupling. When the Titanoboa leaves, a module can be left behind on the station: the science pod stays with the colony it was sent to study, a furnace stays where the ore is good, a habitat stays where the workers do. So stations grow by modules too, and a station's shape tells its story: what was found here, and what the company decided to keep.

Each module is sketched with the same hull rules; a Standard line-up with a science module is 288 vertices (another reason line-ups are assembled at runtime, not stored as one ship).

## 4. Sections swapped in the yard

Now and then a section fails, most dramatically a reactor. The yard reacts on the radio, the failed section is uncoupled and towed clear by Bullsnakes, sits dark at a safe distance, and a replacement arrives and is fitted. While it's out, the yard works slower (a station's stages take longer), and the gap in the line-up is there for anyone to see.

## 5. Module work for commanders

- **Haul a section.** A replacement reactor, or a science module for a new find, has to come from another yard, slowly, on a contract that pays well and draws pirates.
- **Escort it.** The Bullsnake towing it can't fight; Wexley-Yorozu's security wing doesn't stretch that far.
- **Salvage.** A failed reactor towed out and abandoned is worth something to someone, and it's Wexley-Yorozu property. Clause 214 has views.

These are proposals for the contracts design ([companies and contracts](companies-and-contracts.md)) once the modules exist.

## Classic rules

None: Classic has no yards and no Titanoboa, as 1984 had none.

## Open questions

- Should the line-up change during a build (a furnace leaves once the refining is done, a fabricator arrives for the frame), so a yard you visit twice looks different?
- How often does a section fail: rare enough to be an event worth flying to, often enough that commanders see it?
- Is there ever a second company's Titanoboa, or is modular construction Wexley-Yorozu's alone?
- Which modules can a station keep, and does a kept module change what the station's market buys and sells (a science pod wants medical supplies and pays for specimens)?
- Should a science module carry the Science Division's own colour as a stripe or insignia, or stay construction yellow like the rest?
