---
title: Stations and worlds
status: proposed
pillar: world
summary: Physical limits: station classes, ship sizes, docking capacity, how many stations a world can support, supply and decline, rivals and allies.
card: coriolis
help:
  - Design a new station class (a homage is fine, a copy isn't) | ships
---

# Design: stations and worlds

*Status: **proposal**. The world data (section 1), basic station classes and ship size classes (sections 2–3) belong to the **trading and galaxy** milestone. Docking queues, supply and decline, rival stations and growth (sections 4–7) need multiplayer and come later. Please discuss in GitHub Discussions before building.*

## The idea

Stations and the economy should be limited by **physical reality**: how big a world is, how many people live there, what it produces, and how much a station can physically hold. Everything else follows from a few facts about each world, so nothing feels arbitrary.

Related designs: [economy and exchanges](economy-and-exchanges.md), [player stations](player-stations.md), [law and travel](law-and-travel.md).

---

## 1. Start from the world

The original Elite already gave every system a population, productivity, economy, government, tech level and planet radius. Witchspace's own galaxy generator will produce the same kinds of facts, and they drive everything:

| World fact | What it sets |
|---|---|
| **Population** | How much the world produces and consumes, how busy its stations are, how strong the police presence is |
| **Planet size** | How much orbital room there is for stations |
| **Economy** (industrial ↔ agricultural) | What it produces and needs |
| **Tech level** | What can be built, sold **and repaired** there: advanced station classes, shipyards, high-tech equipment. Advanced gear can't be serviced at low-tech stations (see [power and protection](law-and-travel.md#9-power-and-protection)) |
| **Government** | Law, police, docking rules, and how stations relate to each other |

## 2. Station classes

| Class | Size | Docking | Typical role |
|---|---|---|---|
| **Outpost** | Small (≈20–60 m) | 2–4 external pads; small ships only | Mining, frontier, often player-built |
| **Coriolis** | ≈160 m (today's station) | One slot; hangar of ≈20–40 berths | The standard station for most worlds |
| **Large orbital** | 500 m and up | Several slots; hundreds of berths | Rich, populous, high-tech worlds |
| **Satellite and specialist stations** | Varies | Varies | Shipyards, refineries, research labs, prisons; attached to a main station |

- **Station classes are content.** Like ships, their geometry, size, slot count, berth count and services are defined in schema-validated files that the community can contribute.
- The names above are working names; the community can propose better ones.

## 3. Ship size classes

- Every ship file gets a **size class: small, medium or large**.
- **Size limits where a ship can dock.** A large freighter physically can't use an outpost's pads; a small courier can dock anywhere.
- This creates real trade-offs: big haulers carry more but have fewer places to sell; small ships reach frontier outposts that big ones can't.

### What's for sale depends on where you are

Ships, upgrades and services are **only available in systems that can make, sell and support them**:

- **Every ship and item has a minimum tech level.** A docking computer might need tech level 5; military lasers or advanced shields 10 or more; the most advanced ships only appear at the shipyards of the richest high-tech worlds.
- **Government matters too.** Lawful worlds won't sell illegal weapons or contraband; anarchies and corrupt worlds have black markets that sell things lawful stations won't.
- **Station class matters.** Outposts sell the basics; only large orbitals and specialist shipyard satellites sell new ships.
- **Supply matters (multiplayer).** A station that's short of alloys or computers may run out of the equipment built from them.
- **The same rules decide where things can be repaired** (see [power and protection](law-and-travel.md#9-power-and-protection)).

The result is that the galaxy has **real geography**: you travel to a high-tech world to buy that beam laser, and you think twice before taking it somewhere nobody can fix it. Ship and equipment files will declare their tech level and any legal restrictions, so community-made items fit the same rules.

## 4. Docking capacity is real (multiplayer)

- **Berths fill up.** At busy times ships join a **docking queue**, and traffic control admits them one at a time. This is where clearance checks and transponder scans happen (see [law and travel](law-and-travel.md#1-identity-transponders-and-police-markings)).
- **A full station turns ships away**, so traders divert to quieter stations nearby, which spreads traffic and creates opportunities.
- **The no-stranding guarantee still holds:** a ship that's out of fuel, disabled or in distress always gets emergency docking or a tow, full or not.

## 5. How many stations can a world support?

Two limits apply, and both must be satisfied:

1. **Orbital room**, from the planet's size. Small worlds have room for fewer stations.
2. **Supply and use**, from population and economy. A station has to be fed and has to have customers.

| Example world | Could support |
|---|---|
| Poor agricultural, 0.5 billion people, small planet | One Coriolis and a mining outpost |
| Average mixed economy, 2 billion people | One Coriolis, one or two outposts or satellites |
| Rich industrial, 6 billion people, large planet | A large orbital, a Coriolis and several specialist satellites |

*Numbers are illustrative and will be tuned in play.*

## 6. Stations need supplying, and can decline (multiplayer)

- **Stations consume** food, water, fuel, alloys and spares, more for bigger stations with more people.
- **Well supplied:** full services, steady population, room to grow.
- **Under-supplied:** services shut down (shipyard first, then repairs, then the market), people leave, the station's scrip weakens, and in the end it's **abandoned**.
- **Abandoned stations** become derelicts: salvage, hideouts for pirates, sites for new owners to restore, and an opening for AI-agent commanders to take over (see [player stations](player-stations.md#8-stations-run-by-ai-agents)).
- This gives traders constant, meaningful work, and means **a player station is only as strong as the trade that keeps it alive**.

## 7. Several stations around one world: rivals or allies? (multiplayer)

The relationship comes from **who runs each station** and **the world's government**:

- **Allies:** stations under the same authority share police, docking rights and trade agreements.
- **Rivals:** stations run by different factions or guilds (including AI-agent commanders) compete through price wars, tariffs and poaching traders. In lawless systems: sabotage, blockades and hired pirates. In anarchies: open conflict.
- **It changes over time:** treaties, betrayals, takeovers and collapses, driven by players, guilds, agents and events.
- **Police jurisdiction** belongs to the authority that runs a station. The Co-operative's station keeps the law around the planet, but a rival outpost in the same orbit may not share it, so what's a crime near one station may not be near another.

## 8. Growth has limits

A station grows by **investment** (credits, materials, [development funds](player-stations.md#9-investing-in-stations-with-trading-profits)) **and** by having the **orbital room, population and supply** to support it. However rich your guild, you can't build a mega-station around a poor, tiny world. The physical world caps ambition, as in real life.

## 9. Phasing

| Phase | What |
|---|---|
| **Trading and galaxy milestone** | World facts in the galaxy generator (population, planet size, economy, tech level, government); Coriolis stations everywhere plus outposts at some worlds; ship size classes and docking restrictions; **equipment availability by tech level and government** |
| **Multiplayer** | Docking queues and capacity, supply and decline, several stations per world |
| **Later** | Rival and allied stations with shifting relationships, station growth and specialist satellites, derelicts and restoration |

## Open questions

- How many station classes do we need at first, and what should they be called?
- How strict should docking capacity be? Queues add realism but also waiting.
- How quickly should an under-supplied station decline? Too fast is punishing; too slow removes the stakes.
- Should population itself change over time (growth, migration, disasters), or stay fixed per world?
- Who decides whether stations around the same world are allies or rivals: governments, owners, events or all three?
