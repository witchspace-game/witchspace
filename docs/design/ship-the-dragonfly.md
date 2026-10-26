---
title: The Dragonfly
status: designed
pillar: build
summary: An information runner with wings that fold: the tightest turn in the game spread, fast folded, charging in sunlight, and one day the first ship to dip into a planet's air.
card: cobra-mk3
stages:
  - Design and shape (A, wings that fold by themselves) | built
  - The ship file and folding wings | proposed
  - Its arrival: word, launch day, first runs | proposed
help:
  - Write Nell and Ide Halloran's yard: the place, the people | writing
---

# Design: the Dragonfly

*Design, 24 October 2026. Agreed: shape A, wings that fold by themselves. Not built yet. Modern only; Classic keeps 1984's fleet.*

Mark asked for a ship like a dragonfly, and named it after one. The film ornithopters are someone else's design, so this one starts from the insect itself ([homage rules](../../CONTRIBUTING.md#legends-and-homages)): no flapping, no film names, nothing traced. Insect-winged craft are an old idea (da Vinci drew them); the shape and the story here are ours.

## The ship

- **Name:** the **Dragonfly** (an ordinary word, like Cobra and Mamba before it). There's a nice echo in NASA's *Dragonfly*, a rotorcraft bound for the air of Saturn's moon Titan.
- **Shape:** a long, segmented tail ending in the engine; a deep middle where four narrow wings root; a short head with two big canopy domes like a dragonfly's eyes. About 63 m long, 69 m across with its wings spread (a Cobra is 50 by 68).
- **The wings aren't for air.** There's none to fly on (the Falcon's notes say the same). Each wing is a radiator vane with a manoeuvring thruster at its tip: **spread**, the tip thrusters give it the tightest turn in the game; **folded** back along the tail, it's slimmer and faster, but turns like anything else. It spreads them by itself below a third of its top speed, and folds them above.
- **Sunlight on the wings** *(Mark, October 2026)*. Spread in sunlight, the wings charge the fuel cells (solar-powered fuel-making, a little at a time):
  - **By distance:** strong near a star, weak at a planet's distance, nothing in deep space or in a planet's shadow (sunlight falls off with the square of distance) **(to tune: about 1 LY of fuel a minute close to the star)**.
  - **Only when slow:** the wings spread below a third of top speed, so charging means drifting in the light, not flying.
  - **Gentler than scooping:** slower than skimming a star with fuel scoops, but no heat and no risk. The patient pilot's way to refuel, and why explorers and smugglers like it: it can top up wherever there's a sun, station or not.
  - **And the rest:** shields and laser charge also recover faster with the wings spread in sunlight.
  - **Balance:** slow enough that fuel prices and scoops still matter.
- **In neo-vector:** each wing is a few glowing lines with fine veins across it and a small dark cell near the tip, so it reads as a dragonfly from any angle. Iridescent blue-green.

## The sketches

Three shapes, rendered in the game's own style, each from three-quarter, from above beside a Cobra, and from the side (regenerate with the scripts in the review):

- **A, long-tailed:** the classic dragonfly. Slim, unmistakable, and the most like the insect.
- **B, compact:** a short, sturdy body and broad wings: more fighter than insect, and closer to an aircraft.
- **C:** A with its wings folded back for cruise, like a damselfly at rest. Not a separate ship: what A (or B) looks like at speed.

**Chosen (Mark): A**, with C as its folded state. It's the one that reads as a dragonfly at a glance, and the fold between A and C is the ship's character. The wings fold and spread by themselves with speed.

## What it's for

- **Role: an information runner** *(Mark: data, not goods)*. A 6 t hold is too small to make goods pay, but data takes no hold at all, and everything about the ship favours it:
  - **Speed is what data is worth.** Prices and news travel at the speed of ships ([trading](trading.md#2-prices-you-know)), so a fast ship with fresh reports arrives ahead of the news wave: market reports, news and saloon tips carried to traders who'll pay for them, and to companies who want to know first.
  - **Survey data** fetches most far from where it was gathered ([exploration](exploration.md)); a fast ship that can charge in sunlight reaches the far, stationless systems and brings it home.
  - **It doesn't look worth robbing.** Pirates scan holds and go for valuable cargo; a Dragonfly scans as nearly empty. Unless someone's told them what it's carrying: then it's a target (a story hook).
  - **Sensitive data wants discretion, not capacity:** sealed reports, shipping schedules, the Ninefold report. One-person, can't-be-late runs, delivered by settlement pad if nobody at the station should know.
  - **Express contracts** pay for time, not tonnes.
  Scouting second; planet-pad smuggling (below) the risky sideline. Light hull and shields, one missile.
- **In a fight:** it doesn't out-gun anything; it out-turns everything. Spread, it can stay inside a Viper's turn. Folded, it can run.
- **Who sells it:** the Halloran yard and stations near it. Mid-price **(to tune: about 90,000 Cr)**, less than a Cobra: it's a specialist, not a workhorse.

## Who makes it

**Halloran Sisters**, a family yard on an agricultural world's moon, two sisters running what their father started. They name every hull after an insect: the Dragonfly first, and later perhaps the Lacewing and the Skimmer (they'd say *"the insects were here first"*).

- **Nell Halloran** (glad) builds them, and still can't believe people buy them: she signs every wing spar.
- **Ide Halloran** (sad) does the books, and knows the yard is one bad year from being bought out by Wexley-Yorozu. Every Dragonfly sold is another year.

A story hook: Wexley-Yorozu's offer for the yard, and a commander who flies a Dragonfly deciding whether to help the sisters keep it.

## Its arrival *(Mark: introduced properly, not at random)*

The Dragonfly doesn't just turn up in traffic one day. Its arrival is an event, with its people:

1. **Word first:** news from the Halloran yard's region (*"Halloran Sisters fly a new hull: something with wings"*), and talk in the saloon: a courier who's seen it on trials, and doesn't believe what it can turn inside.
2. **The launch:** the first Dragonfly leaves the yard on a set day, from the clock, for everyone at once; the news carries it across the region at the speed of news.
3. **The first runs:** Nell Halloran wants it proved, so the first express data contracts in the region are flown by Dragonflies, and commanders see them working: arriving ahead of the news, slipping past pirate packs.
4. **Then it's part of the galaxy:** Dragonflies in traffic near the yard, and (once ships can be bought) for sale there, with Ide Halloran's thanks for every one sold.

## Building it

1. **The ship file** (`content/ships/dragonfly.json`): the chosen shape, with the wings as separate parts so they can fold.
2. **Folding:** the wings swing between spread and folded with speed (a few tenths of a second), and the turn rate follows them. NPC Dragonflies do the same.
3. **In the game:** introduced as above (news, launch, first runs), then flown by couriers near the yard and, once ships can be bought, sold there.
4. **The sisters:** a small story line, later.

## Later: down to a planet *(Mark, October 2026)*

In air, the wings would really be wings, so the Dragonfly is the natural ship to take commanders down to a planet. There's nothing below the orbit yet (planets are wireframe globes, and flying into one is fatal), so this is a staged idea, in [exploration](exploration.md#planetfall-proposed-later):

1. **Skimming the upper atmosphere:** only a Dragonfly can dip into a planet's outer air on its wings. A glowing horizon, the surface far below as a wireframe grid, survey data worth more, and a place to lose pursuers who can't follow.
2. **Landing pads:** settlements with a pad to glide down to, like docking: the Arkwrights, miners' settlements, frontier outposts that only a Dragonfly can reach, with contracts to match.
3. **Real surfaces,** to fly over, land on and explore: a project the size of the exploration road, much later.

**Smuggling** *(Mark)*: a settlement pad on the surface never sees the station, so there's no docking inspection (at a lawful station that's a 50–80% chance, [the black market](markets-and-trade.md#3-the-black-market)).
- **Settlement buyers:** a frontier back room that pays well for what the station won't let in.
- **The risk moves to the sky:** customs cutters patrol the upper atmosphere in lawful systems. A hot, fast dive leaves a trail they can follow; the skill is a slow, quiet descent, best on the night side in the planet's shadow.
- **A Dragonfly's job, at first:** the only ship that can make the run, which gives smugglers a reason to want one despite its small hold.

It glides and banks on long, still wings, never flaps.

## Open questions

- Buying ships isn't in the game yet (every commander flies a Cobra): the Dragonfly arrives in the galaxy first, and goes on sale when buying ships does.
