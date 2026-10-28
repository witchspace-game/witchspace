---
title: Ships, classes and makers
status: proposed
pillar: build
summary: Why you'd choose one ship over another. Classes for every kind of life, makers with a character every hull carries, ships earned by careers (a Lancer for a Marshal, a Falcon for a pirate the Solos trust), upgrades, and buying and selling.
card: cobra-mk3
stages:
  - Classes in the ship files; class and maker on the ship pages; concepts | proposed
  - Shipyards: buy, sell and trade in, with a first few hulls | proposed
  - Ships earned by careers: Lancer, Falcon, company hulls, Constrictor | proposed
  - Upgrades by class | proposed
  - Second-hand ships and a hangar of your own | proposed
  - Makers' line-ups filled out, the Dragonfly first | proposed
help:
  - Pick a class with no ship and pitch one for it, with its maker and its people | ships
  - Write a maker's character in a paragraph, the way a pilot would describe them | writing
  - Argue the balance in the class table: what should each class be best and worst at? | design
---

# Design: ships, classes and makers

*Design, 24 October 2026. Proposed. Modern rules; Classic keeps 1984's Cobra.*

## Why

Every commander flies a Cobra, and new ships have been invented one at a time, a shape first and a reason later. The Shrike sketches showed the problem: a hull with no clear job, from a maker with no clear line-up.

Mark put it this way: think like Porsche. A 911, a Cayenne, a Boxster and a Carrera GT each have a job, each is still unmistakably a Porsche, and within each you choose a trim and then upgrade. A ship should be chosen the same way:

1. **A class**, for the life you want: haul cargo, hunt pirates, run data, explore.
2. **A maker**, for the character you like: fast and dark, rugged and forgiving, industrial and huge.
3. **Upgrades**, for how you fly it.

And some ships can't be bought at all: they're **earned**, by the career you choose (section 4).

## Principles

- **Class first, then shape.** No new ship without a class, a maker and a reason someone would pick it over the obvious alternative.
- **Every maker has a character,** and every hull it builds carries it: their freighter still feels like theirs.
- **Trade-offs, not tiers.** A better ship in one way is worse in another (hold against speed, turn against armour, range against guns), so there's no single best ship, only the best one for you.
- **The classic names are our tribute; the geometry is ours.** Names from 1984 (Adder, Python, Anaconda...) are welcome, as the Cobra and Viper are; every hull is original neo-vector geometry, designed from its class, never traced from the originals or anyone's drawings.
- **Elegant, not detailed.** A hull is a few glowing lines with a silhouette you'd know at scanner range, never a rendered model with every panel and interior. Fully rendered ship reveals elsewhere are gorgeous, but the elegance of the neo world is what we love about ours (Mark, 25 October 2026). Character comes from shape, proportion and colour; when in doubt, take a line away.
- **Earned, never bought.** Ships cost credits made in play ([no pay-to-win](player-stations.md)).

## 1. Classes

A short list, so every ship's job is obvious. It draws on **Samuel Penn's Ships of Elite for Traveller** ([notasnark.net](https://www.notasnark.net/traveller/elite/index), CC BY-SA 4.0, credited with thanks), which already turns the 1984 fleet into a balanced line-up of classes; his holds and sizes set our proportions.

| Class | Best at | Worst at | The life it's for | In the game | Later |
|---|---|---|---|---|---|
| **Light fighter** | Cheap, quick turns | Fragile, no hold | Your first bounty, or your first raid | Sidewinder | Krait, Gecko |
| **Interceptor** | Catching things, guns | Hold, range | Police, Marshals, hunting | Viper, Lancer | |
| **Multirole** | A bit of everything | Nothing in particular | The start of every career | Cobra Mk III | |
| **Courier** | Speed and turning | Hold (data, not goods) | Express runs, data, scouting | | Dragonfly |
| **Raider** | Speed, running dark | Armour, hold | Piracy with a code | Falcon, Mamba | |
| **Light trader** | Cheap hold | Slow, unarmed | The trader's first step up | | Adder |
| **Bulk trader** | A big hold | Slow, needs an escort | Hauling for a living | Bullsnake (scenery) | Python, Boa |
| **Armed freighter** | Hold and teeth | Turning | Running cargo through bad space | | Gaboon, a Solo blockade-runner |
| **Explorer** | Range, scanners, endurance | Guns | Surveys, trails, firsts | | Asp II |
| **Yacht** | Speed and comfort | Price | Passengers, and showing off | | Fer-de-lance |
| **Heavy** | Armour, firepower | Speed, price | Wings, carriers, the end game | Bastion | Anaconda, Constrictor |
| **Service craft** | Short hops | No jump drive | Scenery and story: tugs, shuttles, drones | Titanoboa's worker craft (planned) | |

**Proportions** (from Penn's Traveller holds, scaled so the Cobra keeps its 20 t): Adder about 9 t, Python about 105 t, Boa about 140 t, Anaconda about 350 t; Asp II and Fer-de-lance under 10 t. Big holds come with slow turns, and need big stations ([stations and worlds](stations-and-worlds.md)).

### Shape and size *(Mark, 27 October 2026)*

A ship's shape is checked against the game, not only drawn:

- **It must fit the docking slot,** 90 m wide and 26 m tall, with its wings level: every ship a commander might fly has to get into a station. A ship that never docks (a Marshals carrier, a yard hauler like the Bullsnake, the Titanoboa) says `"docks": false` in its file instead, and the checks remind the reviewer that no commander can fly it from a station. The rule is `src/content/slot.ts`, used by the game, `validate_ship`, the submission checks and CI.
- **Its hold has to suit its hull:** the fleet carries about 1 to 1.5 t of cargo per 1,000 m³ of hull, and `balance_check` (and the ship editor's balance notes) points out a hold half as big again as the roomiest ship for its size would carry.
- **Its size sets how easy it is to hit:** lasers and missiles aim at a sphere as far out as its furthest point, so a long nose or wide wings make a bigger target.

## 2. Makers and their line-ups

Each maker has a character, and a line-up in the Porsche way: a way in, the icon, the practical one, and a halo. Assignments below are proposals.

| Maker | Character | Way in | The icon | The practical one | The halo |
|---|---|---|---|---|---|
| **Cowell & MgRath** | Rugged, forgiving, built to last | Adder | Cobra Mk III | Python | Anaconda |
| **Faulcon deLacy** | Quick, precise, built for the law | Sidewinder | Viper | an armed escort | Krait (a racing fighter) |
| **Zorgon Petterson** | Fast and flashy | Mamba | Asp II | | Fer-de-lance |
| **Solo & Sons** | Fast, dark, lawless, with a code | a light raider | Falcon | a blockade-runner for the forty-one | Iver Solo's own ship (a Legend, one of a kind) |
| **Halloran Sisters** | Light, agile, insect-built | | Dragonfly | | |
| **Wexley-Yorozu** | Huge, industrial, corporate | | Bullsnake | Gaboon | Titanoboa (not for sale) |
| **Co-operative Naval Yards** | Military, the Marshals' own | | Lancer | | Bastion (not for sale) |

The **halo** is the ship you work towards, or only ever see: some aren't for sale at all.

## 3. Upgrades

- **Upgrades are how you make a ship yours:** the equipment that exists now (fuel scoops, the large cargo bay, ECM, gimbals, the comms array, survey kit...), each limited by class: no large cargo bay on a light fighter, no military lasers on a yacht. No separate trims of the same hull: that would complicate it for little gain *(Mark)*.
- **Engineering** later ([ship condition](ship-condition.md)): tuning a ship past what it came with, with the wear that brings.
- **Looks** (paint, liveries) could come much later, purely cosmetic.

## 4. Earned, not bought

In 1984 you only ever flew the Cobra Mk III. Here, some of the most wanted ships can't be bought at any price: they're **earned by the life you choose**, and flying one says so.

| Ship | Earned by | How |
|---|---|---|
| **Lancer** | A Marshal | A Marshals career for **Dangerous** commanders and up: missions for the Co-operative, and a Lancer of your own when they take you on ([law and travel](law-and-travel.md#9-power-and-protection)). |
| **Falcon** | A pirate the Solos trust | The pirate career that starts with an introduction to a Solo son ([the Falcons](legends-the-falcon.md)): earn their trust (the Debt, the forty-one) and they build you one. Fly it and every Solo son knows you; so does Wexley-Yorozu. |
| **Company hulls** | Standing | Each company's own ship (Hexon's Coral, Vorg's Gaboon, the Mutual's Garter, Wexley-Yorozu's ships), offered to its trusted contractors ([the trading companies](../companies.md)). |
| **Constrictor** | The military mission line | The end of a long mission line: the original game's first mission (the stolen prototype) is already a Legend's trail ([exploration](exploration.md#stage-4-legends)); the reward at the end is a military hull nobody else can buy: rare, recognisable, and a target ([ideas](../ideas.md)). |

Earned ships still need upkeep, insurance and the career's goodwill: lose your standing, and the Marshals want their Lancer back.

## 5. Buying, selling and owning

- **Shipyards** at stations, stocking the makers present in that system and its tech level: Solo & Sons hulls only where nobody asks questions; Wexley-Yorozu's at their worlds.
- **Something to save for, and to earn** *(Mark, 28 October 2026)*. A shipyard gives credits a purpose, and the better hulls also ask for a better pilot: a yard won't sell its best to a commander below the rating it sets ("above Competent", say). Money buys the hull; your record lets you fly it out. A suggestion for how: each class asks for the record that suits it. Fighting ships ask for a combat rating, the big haulers for trading standing with the companies, and long-range ships for an explorer's rank. A trader never has to become a killer for an Anaconda. The yard's message says what you're short of, so it reads as a goal, not a wall.
- **Upward, not sideways.** Everyone starts in a Cobra Mk III (100,000 Cr), and the hulls flying today below it are cheaper (Sidewinder 30,000, Mamba 55,000). A shipyard needs ships above the Cobra to aim for (the Python, Boa and Anaconda), so it depends on the [shipbuilders](shipbuilders.md)' first new hulls.
- **Trade in** your ship against the next; its value follows its condition ([ship condition](ship-condition.md)) and what's fitted.
- **Second-hand ships with a history:** cheaper, a little worn, and sometimes with a past (a former owner's record, a hidden compartment, a Falcon's old paint under the new).
- **Insurance** follows the ship's value ([law and travel](law-and-travel.md#7-losing-your-ship-insurance-loans-and-loan-sharks)).
- **A hangar:** later, keep more than one ship, berthed where you left it.

## 6. Concepts

Makers show ships before they fly, and the site shows them as **concepts**, with their page, their story and the model turning, before they're in the game ([the Dragonfly](ship-the-dragonfly.md): Halloran Sisters showing off a new hull; Solo & Sons' come as *leaked plans*, since their yard is in hiding). A concept says its class and maker from the start. Community designs submitted through the ship editor ([the community platform](community-platform.md)) appear the same way while people vote on them.

## 7. Stages

1. **Classes in the ship files** (a `class` field beside `role`), class and maker on every ship page, and **concepts** (a ship file can be marked as one: on the site, not yet in the game).
2. **Shipyards:** buy, sell and trade in, with a first few hulls you can fly (Adder, Sidewinder, Python).
3. **Ships earned by careers:** the Marshals' Lancer first, then the Falcon and the company hulls, the Constrictor last.
4. **Upgrades by class.**
5. **Second-hand ships and a hangar.**
6. **Line-ups filled out,** the Dragonfly first, and every new ship from here on starting from its class.

## Credits

The class list and proportions draw on Samuel Penn's *Ships of Elite* for Mongoose Traveller (CC BY-SA 4.0), with his kind permission. Witchspace's ships are original geometry.

## Open questions

- How many ships can one commander own at once?
- Which hulls come first when shipyards open?
