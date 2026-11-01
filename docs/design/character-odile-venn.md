---
title: Odile Venn, a Mutual captain
status: proposed
pillar: trade
summary: The galaxy's first trading character - a Carriers' Mutual captain on a run round Lave, Leesti and Diso, in the traffic like any ship but someone you get to know, with a detour to Riedquat that nobody pays her for.
card: cobra-mk3
stages:
  - On the timetable - her run, her hail, the arrivals board, her Saloon on port days | proposed
  - Her memory of you - honest prices, a drink, the Riedquat run, and what happens if you cross her | proposed
  - In shared space - flown by the system's server, the same captain for everyone | proposed
help:
  - Write her lines - hails, Saloon talk, the Riedquat chapter | writing
  - Design the Garter, the Mutual's own hauler, for her to retire into | ships
---

# Design: Odile Venn, a Mutual captain

*Proposed, 31 October 2026. Mark asked for characters who trade: "do we have any character NPCs trading as well?" Change by pull request.*

The galaxy's traffic is now honest (every ship carries what the market says, in a hold she can carry it in) but it's anonymous. Odile Venn is the first face in it: a trader on a regular run, flying in the same lanes as everyone else, whom you can meet, get to know, help or cross. She follows [the world](the-world.md#6-characters)'s method: nothing is simulated, her week is a formula of the clock, and the server keeps only what players change.

She's the second character after [Bond](the-world.md#61-worked-example-cmdr-bond-007-retired), and the first one built. Bond is an easter egg you might never find; Odile is someone every new commander meets in their first hour.

## Who she is

- **Captain Odile Venn**, member **002** ([callsign card](callsign-card.md)); callsign VENN, held.
- **The Carriers' Mutual** ([the companies](../companies.md#the-carriers-mutual)): one member, one ship, one vote. She has voted against everything for thirty years and turned up to every vote.
- **Her ship:** a Cobra Mk III called *Second Wind*, older than most of the commanders who pass her, in plain trader green like every other Cobra in the lanes: you find out who she is by looking (the scanner's card, a hail), never at a glance ([the doubt](the-world.md#64-a-handful-in-every-system-the-doubt-mark)). (The Mutual's own hauler, the Garter, isn't designed yet. When the community designs it, she might retire into one.)
- **Her temperament:** glad, in the Saloon's terms ([trading](trading.md)), and dry with it. She counts everything, forgives most things and forgets nothing. She doesn't lie, which makes her the most useful person in the Saloon and the least exciting.
- **What she wants:** to keep the run going. Not to get rich; she could have been, twice.

## Her run

A triangle in the first chart a new commander sees, each leg within one tank of fuel:

| Leg | Distance | What she carries |
|---|---|---|
| **Lave → Leesti** | 3.6 LY | Food and textiles from Lave's farms to Leesti's factories |
| **Leesti → Diso** | 2.4 LY | Machinery and computers from Leesti |
| **Diso → Lave** | 3.6 LY | Whatever Diso has spare; she's never fussy about the last leg |
| **Once a day: Diso → Riedquat → Lave** | 3.2 + 6.8 LY | Food to Riedquat, an anarchy, sold at what it cost her |

Her loads come from the real markets, like every voyage ([the world, as built](the-world.md#as-built-30-october-2026)): what she delivers is a delivery the station is waiting for, and it fits in her 20 tonnes.

**Her week, by the clock.** About an hour at each stop: a few minutes in on her lane, three quarters of an hour in port (when she's in the Saloon), a few minutes out to her jump point. So the triangle takes about three hours, and each of her systems sees her every few hours, at any time of day. The exact times drift a little from day to day (from the seed), so she's a regular, not a train.

## Meeting her

- **In space:** she's in the traffic like any ship, on her lane. Hail her (L) and she answers in her own words, not the timetable's. A first hail: *"Venn, Second Wind, Mutual. Food for Leesti, if you're asking, and you are."*
- **On the arrivals board:** the Station screen, and the site's "Arrivals at Lave" board on the home page, say when she's due: *"Expected: Odile Venn's Second Wind, in from Leesti about 14:20."* A character you can't find is a character nobody meets.
- **In the Saloon,** on her port days, she's one of the regulars ([saloon.ts](../../src/game/saloon.ts)), always at the same table. Buy her a drink and she talks.
- **On the chart,** once you've met her, her ship is marked where she is now (the chart already shows contracts and news).

## What she gives you

- **Honest prices, carried by hand.** Her tips are the prices she saw at her last stops, as of when she left: *"Computers were 72 at Leesti this morning, and they'll be dearer by tonight."* News in the galaxy travels at the speed of news ([markets and trade](markets-and-trade.md)); she is some of that news, and she's never wrong about what she saw. She's no help with a fortune; she's a good start.
- **A call for help.** Pirates hit her like anyone, more in Riedquat. When they do, she sends a Mutual distress call ([radio.ts](../../src/game/radio.ts)). Answer it and she remembers; so does the Mutual (your standing, as now).
- **Company on the road.** Fly a leg alongside her (within a few kilometres from her jump in to her dock) and she notices. It's not a contract; she pays in what she knows.

## Her memory of you

A short record per commander, as the [Falcons](legends-the-falcon.md) will keep: met, drinks bought, legs flown with her, calls answered, shots fired at her, cargo taken.

| You are | She |
|---|---|
| **A stranger** | Answers a hail politely and gives her cargo and route |
| **Known** (a drink or two, a hail or two) | Uses your name; shares the prices she saw |
| **Trusted** (answered her call, or flew a leg with her) | Asks you along on the Riedquat run, and tells you why (below) |
| **Crossed** (fired on her, or took her cargo) | Won't drink with you. Other Mutual captains hear of it: for a while, your distress calls go unanswered by the Mutual |

Crossing her is a choice the game lets you make. It costs you a friend, not a quest. A first shot is forgiven with a warning, *"Mutual ship. You'll want to look before you shoot,"* since a new commander may not yet know to scan first.

## The Riedquat run

The chapter for commanders she trusts.

Every day she goes out of her way to Riedquat, an anarchy, with food she sells at cost to the people at Meridian Station. Pirates own Riedquat's lanes, and they leave her alone: the grain she brings feeds their families. Wexley-Yorozu *pays* pirates to leave its freighters alone ([the world](the-world.md#next-for-the-supply-line)); Odile has earned it.

She asks you to fly it with her because the arrangement is wearing thin: a new crew in Riedquat doesn't know her. It's the one leg she's afraid of, and she won't say so; she says *"the company would be nice."*

Fly it with her and she tells you, in the Saloon at Meridian, why she bothers: **the twenty-eight captains who founded the Mutual met in the bar at Meridian Station**, when Riedquat was a quiet farming world, before Hale & Ostrander pulled out and it fell apart. Her father was one of them. The Mutual left Riedquat to go where the law was; she never did.

Meridian has an empty chair, as every Mutual station does. It's the first one. She sits next to it. Ask her who the twenty-eighth founder was and she changes the subject. That's a later chapter, and maybe not hers to tell.

## If she's lost

She's a Mutual member, so she's insured. Destroy *Second Wind* and Odile survives in her escape pod. A day later she's back on her run in the same ship, repaired, and she remembers exactly who did it. The news reports the loss. She never dies for good: a character the galaxy loses to one commander is lost to all of them.

- **In solo:** her loss is yours, in your own world.
- **In shared space:** the server saw it, so the bars name the culprit ([other commanders, remembered](the-world.md#66-other-commanders-remembered-mark)). But she's back much sooner, or another Mutual captain flies her leg, so one griefer can't take the first-hour character away from everyone.
- **Labelled:** wherever she appears beside real commanders (the live feed, her callsign card), she's marked "Character". She's in Modern rules only.

## How it works

The method is [the world's](the-world.md#3-the-method), with a plan on top:

- **`content/characters/venn.json`**, written by hand: who she is, her ship and paint, her stops and her lines. Characters are content, like ships, so writers can add the next one without touching code.
- **Her plan** is worked out from the clock: which leg she's on at any moment, with a little daily drift from the seed. The same for every phone.
- **In the traffic:** when her plan puts her in your system, `voyages()` includes her as one more voyage, with a fixed id, her name, her hull and her load. Up close, she flies herself like any trader; she just answers the radio differently.
- **On the Station screen and in the Saloon:** the plan says when she's due and when she's in port.
- **Her memory of you** is a few counters in your save (`commander.characters.venn`). In shared space, step 3 moves the parts others see (her loss) to the server.
- **Tested** like the traffic: her plan is the same on two phones at the same moment, she's never in two places, and every leg fits in a tank of fuel.

## Steps

| Step | What | Size | Worker deploy |
|---|---|---|---|
| 1 | **On the timetable:** her run, her hail, the arrivals board, the Saloon on port days | Medium | No |
| 2 | **Her memory:** honest prices, the distress call, flying with her, the Riedquat chapter, crossing her, her loss and return | Medium | No |
| 3 | **In shared space:** flown by the system's server; her loss is everyone's | Small, after [the world's](the-world.md#9-steps) step 7 | Yes |

## Open questions for Mark

1. **Her:** is Odile Venn the right name, and *Second Wind* the right ship?
2. **The lore:** the Mutual founded at Meridian Station, Riedquat (marketing: keep it named; it gives the Mutual a place)?
3. **The twenty-eighth founder:** does Odile know who she was, and is that hers to tell, or Bond's (who knows what Hexon keeps on file)?
4. **Trade with her in space,** a "deck sale" (hail her within a kilometre and buy a few tonnes of her load without docking): marketing suggests a later idea, as it's new to Elite's rules and she doesn't need it to land.
5. **How often:** an hour at each stop, every few hours, is easy to meet. Rarer makes her special; commoner makes her part of the furniture.
