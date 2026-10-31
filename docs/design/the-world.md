---
title: The world - traffic, the galaxy and its characters
status: proposed
pillar: build
summary: How the galaxy comes alive without a server running it - every convoy, company ship and character worked out from the seed and the clock, the same on every phone, in solo and in shared space - and what players change, kept as a short list of exceptions.
card: bullsnake
stages:
  - The world from the seed and the clock - markets, events, companies, Saloon regulars, the yards' Bullsnakes | built
  - Routes and timetables - the market's own timetable made visible, a lane per neighbouring system | built
  - Traffic from the economy - company fleets, relief for famines and plagues, the Titan's freighters | built
  - More kinds of traffic - refugee liners, miners, salvage crews, work that isn't fighting | proposed
  - Up close, a real ship - the hand-over from formula to NPC | built
  - Exceptions - what players change, kept by the server | proposed
  - Characters - named people with a plan, a ship and a memory, starting with CMDR Bond | proposed
  - Characters in shared space - flown by the system's server, the same for everyone | proposed
help:
  - Design a working ship - a freighter, a liner, a tug, a mining ship - for the traffic | ships
  - Write a character - who they are, what they want, where they go | writing
---

# Design: the world

*Proposed, 30 October 2026, with Mark. The traffic (section 9, steps 1 to 4) was built the same day for Show HN, at Mark's word: "This is the missing piece, let's get it done before HN." The rest waits. Change by pull request.*

Mark asked how the galaxy should feel, and how it should work underneath:

- "How do we make the universe feel like more than just pirates and police and the Cobra trader pirates? Have we got company ships? Who's supplying the Titanoboa with its materials?"
- "How do players interact with NPCs in solo play, and then how shared space actually works... Do we have AI players with goals in our universe whilst it's still small?"
- "How do we do it elegantly, efficiently, using math?"

This document answers all three. It builds on [markets and trade](markets-and-trade.md) (world events), [companies and contracts](companies-and-contracts.md) and [the companies](../companies.md), [the Titanoboa](ship-the-titanoboa.md) and its yards, [the Falcons](legends-the-falcon.md) (a Legend who remembers you), [exploration](exploration.md#stage-4-legends) (the Constrictor's trail), [radio and comms](radio-and-comms.md), [shared space](shared-space.md) and [servers and hosting](servers-and-hosting.md).

## Principles

- **Nothing is simulated; everything is calculated.** Every ship, convoy and character is a formula of the seed and the clock. Nothing runs while nobody's looking.
- **The same on every phone.** Two commanders in the same place at the same time see the same freighter on the same route, in solo or in shared space, without the server telling either of them.
- **The traffic tells the story of the world.** What flies past you follows from what's happening in the galaxy, so you could read the galaxy from your scanner.
- **The server keeps only exceptions:** what players changed, a few rows a day.
- **Rules, not a live AI.** Characters' goals and moves are rules: fair, cheap, testable and the same for everyone. AI can help write their words and stories when they're designed; it doesn't play them.
- **Evoke, never copy** ([CONTRIBUTING](../../CONTRIBUTING.md#legends-and-homages)): a nod is welcome, a borrowed character or story isn't.

---

## As built (30 October 2026)

How the first steps work in the game (Modern rules; Classic keeps 1984's traffic):

- **The market's timetable is the traffic** (`game/traffic.ts`). The market already works out every NPC delivery and purchase from the seed and the clock (`npcTrades`); those are gathered into voyages, one ship per few minutes of trade (`WINDOW_MS`, 9 minutes in an anarchy down to 4 in a corporate state). So the deliveries an inbound ship carries are the ones the market is waiting for: destroy her and they never arrive, as before.
- **Each voyage comes from or goes to a real system a jump away,** flies for a company working this system (or is independent), and has a hull and a name, all from the seed.
- **Its lane points the way the other system lies on the galaxy chart:** ships from Diso come in from Diso's side of the sky. The path is a curve from 30 km out to the slot (or back out), bent round the planet and moons.
- **Far from you, a ship rides its lane by the clock.** Within 2.5 km, or once anyone shoots at it, it flies itself like any trader. Two phones at the same moment see the same ships within a metre of each other (tested).
- **The Titan's freighters:** while a yard builds, a Wexley-Yorozu Bullsnake comes about every 8 minutes with what the stage needs, and flies to the Titan.
- **Relief:** while an event leaves a world short (famine, drought, plague), ships bring what's missing about every 7 minutes, half of them the Carriers' Mutual.
- **Hail one and it says who it is:** "Dry Dock, in from Atriso with alloys for the Titan."
- **Company security (Mark: "is there no protection for the Titan or are they paying for protection anywhere?"):** Vipers in company colours. Two or three guard each yard's Titan (more in lawless space), and a lost guard is replaced from her hold after three minutes. Escorts fly alongside most of the Titan's runs (nine in ten in an anarchy, one in four in a corporate state) and a third of company runs carrying valuable cargo. They fight pirates and whoever fires on the company's ships, and answer to the company, not the law: firing on them makes you an offender, not a fugitive. Hail one: "Wexley-Yorozu yard security".
- **Not yet:** losses don't slow the yard (step 5's exceptions), and in shared space each phone flies its own copy once a ship is close.

## 1. Where we are

Checked against the code on 30 October 2026.

**Solo play: one galaxy, worked out the same way on every phone.**
- The galaxy, its markets, its world events (`economy/events.ts`), the companies' presence (`game/companies.ts`) and the Saloon's regulars (`game/saloon.ts`) all come from each system's seed and the real clock. Nothing passes between players, yet everyone sees the same famine at the same hour and the same regular in the same Saloon.
- **The yards are the one place the world flies:** a Wexley-Yorozu Titanoboa off a moon, building a station, with Bullsnakes running ore from the moon into its maw, on the clock, the same for everyone (`render/yard.ts`, `game/yards.ts`). This is the method below, already working.
- **The ships you meet are made by your own phone and forgotten when you leave:** police, Marshals, traders and pirates (`game/npc.ts`, `game/ai.ts`). They fly by the player's own physics and have simple jobs: traders fly a route, pirates hunt and run when hurt, police patrol. **Every trader is a Cobra.** The Falcon is a dice roll on a pirate encounter.
- **You deal with them by** hailing (lines from the seed), fighting, rescue, the Saloon (drinks, and tips that may be true, false or late), company contracts and special assignments.

**Shared space: real commanders only, one system at a time** ([shared space](shared-space.md#1-where-we-are)). The server referees moves, lasers, missiles and collisions. The NPCs aren't shared: two commanders side by side each see their own pirates.

**What's missing:**
- **Companies are only in the menus.** Hexon, Wexley-Yorozu, Vorg and the Mutual run contracts and keep files, but you never see one of their ships.
- **Nobody supplies the Titanoboa.** Its design says electronics, food and life support "come in by trade"; no ship brings them.
- **Nobody in the galaxy is after anything.** Every NPC lives for a few minutes, near you. AI-agent traders and stations are planned in other designs; none are built.

---

## 2. Three layers

| Layer | What | Made by | Lasts |
|---|---|---|---|
| **Traffic** | Pirates, police, nameless traders | Your phone, at random | Until you leave |
| **The world** | Markets, events, companies, Saloons, the yards, **and now routes, convoys and company fleets** | The seed and the clock: the same for everyone | Always, worked out when needed |
| **Characters** | Named people with a home, a ship, a goal and a memory of you | The seed, the clock and their story so far | Always; their stories change |

The traffic is the crowd. The world is the weather and the timetable. The characters are the faces.

---

## 3. The method

### 3.1 Everything is a function of time

```
state = f(seed, t)
```

Randomness comes from a hash, not dice: `hash(system, salt, index)` in `economy/seed.ts` gives a number from 0 to 1 that's the same on every phone. The Saloon, events and yards already use it.

### 3.2 A convoy is a timetable, not a ship

A route is a list of systems and, in each, a path: the witchpoint, a bend round the planet, the station's slot. A convoy on it is a departure:

```
period = 40 min                        how often one leaves
phase  = hash(route) × period          so routes don't all leave together
k      = floor((t − phase) / period)   which departure this is
age    = t − (phase + k × period)      minutes since it left
where  = route(age × speed)            a point on its path
```

Only departures whose `age` is less than the trip time exist, so a few sums give every convoy on the route, in place, on every phone. The path through a system is a smooth curve (Catmull-Rom through the waypoints), flown at the hull's own top speed and turn rate, so it looks flown, not slid. A jump between systems is a gap in the timetable the length of a hyperspace jump.

### 3.3 Only calculate where you are

Nobody works out the whole galaxy. Each system keeps a small **index of the routes through it**, built once from the seed. Arriving at Onrira, the game asks: which routes pass here, and who's on them now? That's a few dozen sums for one system. News works the same way: what's the nearest convoy lost, and how long has its news taken to arrive (events already travel at the speed of ships)?

### 3.4 The economy sets the numbers

```
demand  = a world's shortfall of a good      (events.ts already has it)
rate    = k × demand                          departures an hour
depart in slot n  if  hash(route, n) < rate × slot length
```

That's a random arrival process with its dice taken from a hash, so the same for everyone. A famine raises the shortfall, more food convoys leave, and pirates follow them, all from one equation. Prices then move as cargo arrives, as they already do with NPC trade.

### 3.5 Players' actions are exceptions

```
world(t) = f(seed, t)  +  exceptions
exceptions = [ convoy 1234 destroyed at 14:02 by CMDR X,
               Bond helped by CMDR Y, ... ]
```

The server keeps the exceptions; each is a row. Consequences are arithmetic on the timetable and the list:

```
progress(t) = scheduled deliveries before t − deliveries lost
```

Lose enough of the Titanoboa's convoys and the station falls behind, the news says so, and its stage takes longer. Nothing was running to make that happen.

### 3.6 A formula far away, a real ship up close

- **Beyond about 20 km,** a convoy is a mark on the scanner moved by the formula.
- **Within it,** it becomes a real NPC (`npc.ts`): physics, a voice when hailed, a hold that can be scanned and pirated, escorts that fight.
- **Left alone, it goes back to its timetable,** easing back onto its path over a few seconds.
- **Destroyed, robbed or rescued,** that becomes an exception (section 5), and the timetable shows it from then on.

### 3.7 Testable

Any moment of the galaxy, past or future, can be worked out in a test: "at 14:00 on 3 November, which convoys are at Onrira?" Every phone must agree with the test, and the server can check a commander's claim ("I robbed convoy 1234") against the same formula.

---

## 4. Traffic that tells the story of the world

### 4.1 The companies fly as themselves

| Company | In space |
|---|---|
| **Wexley-Yorozu** | Tidy convoys on timetables; the yards; tug teams hauling Titanoboa modules, slowly, under escort |
| **Hexon** | Polished freighters with their own "security", which isn't police: they don't care about your crimes, only their cargo |
| **Vorg** | Rough ore haulers and mining crews at the asteroid fields; they'll sell you anything |
| **The Carriers' Mutual** | Independent captains, one ship each; they answer a distress call when one's in range |
| **The Co-operative** | Police and Marshals, as now; medical ships under escort in a plague |

Each flies in its colours, from [the companies](../companies.md), on hulls that suit it.

### 4.2 Events you can see

- **Famine:** food convoys heading for the famine world; opportunists racing them; pirates waiting at the witchpoint.
- **War:** refugee liners leaving, arms runners arriving.
- **Plague:** medical ships under Co-operative escort.
- **A boom:** more traffic of every kind; the station's queue lengthens.

### 4.3 Work that isn't fighting

Miners at asteroid fields, surveyors over a new find, couriers in a hurry, salvage crews over a wreck, a passenger liner, a racing gate on a workers' day off.

### 4.4 More hulls

Every working ship needs a silhouette: freighters, liners, tugs, mining ships. **This is the community's job:** contributors design them through the [MCP server](mcp-server.md), and each accepted design gives the galaxy a new shape. Until then, the existing hulls in company paint.

### 4.5 What you can do with them

- **Hail them:** "Wexley-Yorozu freighter *Patience*, electronics for the yard at Onrira." What they say comes from their route and cargo.
- **Escort a convoy** (a contract, or just tagging along for the pay at the end), **warn it** about pirates on the scanner, **sell it fuel**, or **turn pirate** and take its cargo, with the law after you and the company's file noting it.
- **Change things:** convoys lost slow the yard; convoys saved earn the company's thanks and its better work.

---

## 5. What players change: exceptions

Exceptions are what makes the world respond. The question is whose world they change.

| Where | What changes | Kept |
|---|---|---|
| **Solo, on your phone** | Your own world: the convoy you robbed is gone for you | In your save |
| **Shared space** | Everyone's: the server saw it happen | On the server, a row each |
| **Story beats** (section 6) | A character's memory of you is yours; a few big beats (the prototype found) are everyone's | On the server |

Starting point: **solo changes stay yours; shared-space changes are everyone's, because the server refereed them.** A commander who robs a convoy in solo has a world one convoy shorter. A wing that saves the yard's supply line in shared space has saved it for everybody. (Open question 2.)

---

## 6. Characters

A character is the world's method with a plan on top:

```
plan     = legs worked out from the seed and the story so far
where(t) = plan evaluated at t
```

"Tuesday, the corner seat in the Saloon at Isinor. Wednesday, out to a sighting on the trail. Back by Friday." When a player changes the story, the plan is worked out again from that moment.

- **They have a home, a ship, a goal and a temperament.** They're found in a Saloon, on a route, or in their hangar.
- **They remember you,** as the [Falcons](legends-the-falcon.md) will: a short record per commander of what you did. Help them and they call on you; cross them and they're cool, or worse.
- **Their stories move on whether you're there or not:** chapters over days or weeks, reported by the news and the [feed](live-feed.md).
- **In solo,** your phone flies them when you're in their system. **In shared space,** the system's server flies them, so every commander there sees the same one. It only does so while a real commander is in the system, so it costs nothing extra: the system is awake anyway.
- **Their member numbers:** 002 to 100 are kept for them ([callsign card](callsign-card.md)). They hold callsigns like anyone, so a player can't take a character's name.
- **Their words are written, not generated live.** Lines and stories can be drafted with AI and chosen by people; the game says them as written.

### 6.1 Worked example: CMDR Bond, 007, retired

*Mark's character (30 October 2026). An easter egg first, and a mentor at most: never the lead of a story, and never his full name in anything public. He's just Bond.*

- **What he was:** the Bureau of Continuity's best field agent ([lore](../lore.md)), in the years after the Grey Fever. He was there when Project Lantern, the Bureau's vaccine stockpile, was "spun off to bring its benefits to market" and became Hexagen, then Hexon.
- **Why he left:** he knows what the Bureau traded to make that happen, and wouldn't sign the last report. They let him retire on a good pension, the way you pay someone to stay quiet. His Bureau file is all redactions.
- **The case he never closed:** a prototype stolen on his last assignment. It's the Constrictor ([the trail](exploration.md#stage-4-legends)).
- **Where he is:** a quiet agricultural world, the corner seat of its Saloon, a drink he insists is made properly. In his hangar, the silver grand tourer he was never asked to return, with the "fittings" still in her ([ideas](../ideas.md)).
- **Meeting him:** buy him a drink and he tells stories that sound like tall tales and turn out to be true. Come back with a Constrictor sighting and he goes quiet, then says, "Where?"
- **In space:** most days, nothing. Now and then he takes the grand tourer out, when something on the trail interests him. That's the rare sighting commanders talk about.
- **What he gives the game:** a wink for those who spot it; a way into the Constrictor story (Mark's maiden-voyage hook, [ships and classes](ships-and-classes.md)); and a thread into the galaxy's main conflict, as his past is Hexon's origin.

### 6.2 Saloon regulars with ships

Mark: "Some of those Characters will be from the saloon, but they have their own ships and fly around the systems doing what they do." Today's regulars (`saloon.ts`) are made for each station and hour. A **named regular** is a character: the same person in the same Saloon on their days there, and out on their route the rest of the week. You might drink with a smuggler on Monday and pass her ship, running dark, on Thursday.

---

## 7. Worked example: the Titanoboa's supply line

A yard at Onrira (`yards.ts`) is building a station. Today, Bullsnakes run ore from the moon on the clock. Added:

1. **Its needs:** electronics, food and life support, by stage (the frame needs more electronics; the habitat ring needs food and life support). Each is a shortfall at Onrira.
2. **Its routes:** from the nearest worlds that make each good: say electronics from a high-tech world three jumps away, food from an agricultural one next door. Built from the galaxy's seed, the same for everyone.
3. **Its timetable:** departures at the rate the shortfall sets (section 3.4), Wexley-Yorozu freighters in company colours, with escorts on the longer route.
4. **What you see:** freighters at the witchpoint on their way in; a queue at the Titanoboa's hold; a tug team coming the long way with a replacement reactor.
5. **What you can do:** escort the electronics run (a contract); warn a convoy of pirates; rob one, and Wexley-Yorozu's file on you says so.
6. **What follows:** the yard's progress is deliveries made minus deliveries lost. Lose enough and the station opens late, and the news says why. In shared space, a wing that keeps the route open has done it for everyone.

---

## 8. Cost

- **Phones:** a few dozen formulas a second for one system. Nothing.
- **The server:** nothing for traffic or convoys. A row per exception. Characters flown in shared space only while a real commander is in their system, which is awake anyway ([shared space, section 5](shared-space.md#5-cost-and-hosting)).
- **As the galaxy grows,** the cost stays almost flat: work happens only where someone is looking.

---

## 9. Steps

| Step | What | Size | Worker deploy |
|---|---|---|---|
| 1 | **Routes and timetables:** the route index, the convoy formula, convoys drawn in solo (existing hulls in company colours), hailing them | Medium | No |
| 2 | **Traffic from the economy:** rates from events' shortfalls; famine convoys, refugee liners, medical ships | Medium | No |
| 3 | **The Titanoboa's supply line:** needs by stage, routes, progress from deliveries | Medium | No |
| 4 | **Up close, a real ship:** the hand-over to an NPC and back; escort and piracy | Medium | No |
| 5 | **Exceptions:** in your save in solo; on the server from shared space | Small | Yes |
| 6 | **The first character, Bond:** his Saloon, his plan, his memory of you, his rare flights | Medium | Yes |
| 7 | **Characters in shared space:** flown by the system's server | Medium | Yes |
| 8 | **Working hulls from the community:** freighters, liners, tugs, through the MCP server | Ongoing | No |

Steps 1 to 4 need no server, so they can start straight after Show HN.

---

## Next for the supply line

- **Escort contracts (Mark likes this one):** Wexley-Yorozu hires commanders at the station to bring a named freighter in safely: "Bring the *Steady Hand* in from Atriso, 300 Cr." The freighter is already on the timetable; the contract just puts you beside her.
- **Protection money, in anarchies:** where there's no law, Wexley-Yorozu quietly pays the local pirates to leave its freighters alone, and pirates there pass them by, until the payments stop. A Saloon regular might let it slip. A story can grow from it.
- **Losses slow the build** (step 5's exceptions).

## 10. Open questions for Mark

1. ~~**The order:**~~ **Traffic and the Titan first** (Mark, 30 Oct 2026: "Traffic and Titan (which I prefer rather than Titanoboa) and traffic"), then Bond. Mark prefers the name **Titan** to Titanoboa; renaming her across the game, site and docs is its own change.
2. **Solo changes:** stay in your own world (recommended), or count for everyone when you're signed in?
3. **How busy:** how many convoys in a quiet system, and in a busy one? Too many and the lanes feel like a motorway; too few and nobody meets one.
4. **Bond's world:** which agricultural system does he retire to?
5. **The second character:** a Saloon regular with a ship (Mark's first idea), a Marshal, a smuggler, or a Mutual captain?
