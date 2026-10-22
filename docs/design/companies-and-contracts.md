# Design: trading companies, contracts, and the law beyond the station

*Status: agreed. **Stage 1 built (October 2026):** the four companies and their presence by system (`src/game/companies.ts`); a Contracts tab at the station with haulage and rush contracts, cargo supplied, deadlines in jumps, pay on delivery (half if late, reclaimed after three more jumps), standing with each company (`src/game/contracts.ts`); traders in company colours, named in the target readout. Still to come from stage 1: supply runs, bonds and perks.*

*Originally: Modern rules only; Classic stays as 1984. Builds on [markets and trade](markets-and-trade.md) (section 5, Merchants) and [law and travel](law-and-travel.md) (section 1, transponders).*

## The idea

A new commander shouldn't land on a trading exchange with candles and an order book. In the real world, someone starting out takes work from an outfit that's already established. So in Witchspace:

- **A few rival trading companies own most of the trade.** Their haulers run between stations and systems all the time, and they post **contracts** at every station they serve: carry this cargo there, by then, for this pay. Take one or leave it.
- **Independents** still trade on their own account on the exchange, with the trade computer, where the big money and the big losses are.
- **The space between stations is where it gets interesting.** Company haulers can be intercepted, by pirates and by players. Close to a station the law sees everything; out in the lanes it needs a witness. Ships can run dark, and police challenge before they shoot.

All of it runs the way Elite's galaxy did: **worked out from each system's seed and the clock, in every browser, the same for everyone.** No server and no database for the single-player slice, and only small events on the existing shared-space server later.

---

## Growing with use

**Start small, make sense, grow as players arrive.** Every piece here works with one commander and no server, and gets richer as more people play, without anything having to be rebuilt.

- **The baseline is free.** Companies, their fleets, contracts and yards all come from the seed and the clock. One commander or a thousand, the galaxy costs the same to run: nothing.
- **Players add to it, and that's what costs a little.** Contracts claimed, crimes witnessed, deliveries to a yard: each is a few bytes on the server, so the bill grows only with the number of players.
- **The galaxy responds to where players go.** Later, companies expand where players carry their freight, yards open where deliveries flow, and quiet routes stay quiet. A busy region visibly develops; that's the reward for a growing community, and it can't happen faster than the community grows.
- **Each stage is complete on its own.** Stage 1 is a game you'd want to play even if stage 2 never came: take contracts, build standing, see company ships. Nothing is half-built waiting for later.

## 1. The companies

Four to start, each with a character, a home ground and a rival. Their backstories, insignia, liveries, logo prompts and signature ships (the Coral, the Gaboon, the Garter and the Bullsnake) are in **[the trading companies](../companies.md)**. Inspired by real-world types with poetic licence; no real company is portrayed.

| Company | Character | Home ground | Pays | Wants |
|---|---|---|---|---|
| **Hexon Holdings** | The corporate giant, and a nod to the films' sinister corporations. Punctual, polite, unforgiving of lateness. Its medicine contracts pay suspiciously well, and nobody asks what's in the sealed containers. | Corporate States, Democracies, Confederacies | Steady, on time; small danger bonuses | Reliability. The best-paying first employer, if you don't ask questions. |
| **Vorg Industries** | A frontier conglomerate that makes everything and sells it to everyone; a nod to Zorg Industries. Asks no questions about your past. | Anarchies, Feudal and Multi-Government worlds | High, with big danger bonuses | Nerve. Later, some of its cargo is "irregular". |
| **The Carriers' Mutual** | A Co-operative-chartered mutual of independent haulers. Fair, a little bureaucratic. | Everywhere with a government | Fair; members get benefits | Members. Standing here is membership. |
| **Wexley-Yorozu** | Terraformers and shipwrights; a nod to the terraforming company of *Aliens*. Builds atmosphere processors, stations and the ships that carry them; its Science Division buys survey data and has standing special orders. | Frontier colonies and half-finished worlds, wherever it's terraforming | Heavy haulage; the best price for survey data | Explorers and heavy haulers. Ties trade to [exploration](../ideas.md#exploration) |

- **Insignia.** Each company's ships carry its mark on the hull, drawn in lines like everything else. **Hexon Holdings: a double H**, two H's back to back sharing one upright, on black-banded hulls. Vorg: a heavy bladed V crossed like a gunsight. The Mutual: a carrick bend knot in a ring of 28 dots.
- **Presence by system.** Each system has a mix of the three, from its government and its seed: Hexon Holdings dominates the safe core, Vorg the frontier, the Mutual a little of everywhere. The mix sets who posts contracts there and whose ships you see.
- **Rivals.** Hexon and Vorg compete for the worlds between. Helping one doesn't hurt you with the other, but attacking one's ships does (section 3).
- **They're the market makers.** A company's contracts come from the same market model as the exchange. A famine at Esbiza means a food contract to Esbiza, paying a crisis premium; a glut means cheap cargo to move out. The companies are how the market reaches a new commander.

## 2. Contracts

### What a contract is

`Carry 12 t Medicine · Leesti → Riedquat (6.8 LY, Feudal) · within 3 jumps · 340 Cr + 120 danger bonus · Vorg Industries`

- **The company supplies the cargo.** You need a ship and a hold, not money, so a new commander, or one who has just lost everything, can start earning at once.
- **The cargo is consigned, not yours.** It shows in your hold marked with the company's name. You can't sell it on the open market; a fence will take it, as stolen goods (section 3).
- **Deadlines are counted in jumps, not hours.** Short sessions and closing the browser never make you late. *(Proposed: real-time deadlines would punish players who log off.)*
- **Pay comes on delivery.** It's set from the cargo's value, the distance, the danger along the way (the [danger premium](markets-and-trade.md)) and any crisis at the destination. Rough guide: about two thirds of what an independent with the capital would make on the same run, since you risk none of your own money.
- **A small bond** for valuable cargo: a share of the cargo's value, held until delivery. First contracts have none, so a commander with 100 Cr can take them.

### Kinds of contract

1. **Haulage** (first): carry consigned cargo from here to there.
2. **Rush** (first): the same, sooner, for more.
3. **Supply runs** (first): the company's buy order. Bring 10 t of food to Esbiza by any means: your own cargo, bought anywhere. A bridge from contracts to trading on your own account.
4. **Escort** (later): fly alongside a company convoy through dangerous space. Paid per hauler that arrives.
5. **Recovery** (later): a hauler was lost; find the wreck and bring back what you can scoop.

### Standing

Each company keeps your **standing**, earned by contracts delivered and lost by contracts failed or its ships attacked.

| Standing | Unlocks |
|---|---|
| **Casual** | Small haulage contracts, no bond |
| **Contractor** | Bigger cargoes, rush contracts |
| **Trusted** | Valuable cargo, dangerous routes, supply runs |
| **Preferred** | The best-paid runs, escorts (later), first call in a crisis |
| **Partner** | Company perks: Hexon's docking priority, Vorg's friendly fences, the Mutual's lower insurance excess |

Standing is its own record, beside the combat rating and the explorer's rank, and is the first half of the Merchant's **trading rank** in [markets and trade](markets-and-trade.md#a-merchants-rank).

### Failing a contract

- **Late:** paid less, standing dips.
- **Lost** (ship destroyed, cargo taken or jettisoned): no pay, the bond is forfeit, standing drops. Your savings and your ship's insurance are untouched; the company insured its own cargo.
- **Stolen by you** (sold to a fence): the company knows. Standing with it falls to the floor, and the cargo is reported stolen everywhere it trades.

## 3. Company ships, and intercepting them

### The fleets

The NPC traders already in the game become the companies' ships. They fly the company's livery and show its name on the scanner and in the target readout: `COBRA MK III · BRACKWATER FREIGHT · CLEAN`.

- **A schedule, not a simulation.** Each company's runs between systems are worked out from the seed and the clock, as today's NPC trades are. Only the system you're in is flown for real. That's why it costs nothing to run, and why every player in a system sees the same convoy arrive at the same moment.
- **Their cargo is real.** An inbound hauler carries the station's actual upcoming deliveries (as now). Destroy it and the station goes short, the news reports it, and the company may post a rush contract to cover the gap.
- **Your contract is a slot in the schedule.** Take one and you're one of the company's ships on that run.

### Where you can intercept them

Haulers arrive from witchspace **14 to 22 km out** and fly in; outbound ones fly out to about 22 km and jump. So the **lanes, 10 to 22 km from the station**, are the hunting ground. Pirates already hunt there.

## 4. The law beyond the station

Today any crime in a system with law is known at once, wherever it happens. That's neither realistic nor much fun. Instead: **close to the station the law sees everything; further out, it needs a witness.**

### Station space

Within about **10 km** of the station, its sensors see everything. A crime there is recorded at once, and police launch straight away (as now).

### The lanes: a crime needs a witness

Beyond station space a crime counts only if someone reports it:

- **a police ship** that sees it, within scanner range;
- **any other ship** that sees it and gets away (a trader, a miner, another commander);
- **the victim**, if it survives or escapes.

A clean kill far out, with no witness, leaves **no record**. But:

- **The cargo is evidence.** Company cargo carries a manifest, so it's stolen goods: the open market won't take it, the fence will at about 60% and might be police, and a police scan finds it (stolen goods are already built).
- **The company knows its hauler vanished.** If you were seen in the lanes near it, your standing with that company takes the hit, record or not.

### The distress call

A hauler under attack calls for help. Police launch from the station, and how long they take depends on the distance: about **20 seconds at 12 km**, **over a minute at 20 km**. So a raid in the lanes is a race. A **distress jammer** (new equipment, illegal in lawful systems) stops the call going out.

### Running dark

You can switch your transponder off (designed in [law and travel](law-and-travel.md#1-identity-transponders-and-police-markings), now built out):

- **To a witness you're "unidentified Cobra Mk III".** The crime isn't pinned on you.
- **Close up, the hull gives you away.** Within about **2 km** (the range at which police already scan cargo) a police scan reads your hull registration, dark or not.
- **Your ship is evidence.** A common Cobra blends in; something rare is recognised from the description alone.
- **Lawful stations won't let a dark ship dock.** You'll need to switch back on, and doing it where police or a station can see you, soon after a raid nearby, makes you the suspect. The smart move is to jump first, or switch on somewhere quiet.
- **In anarchies none of it matters.** There's no law to hide from.

### The police challenge: warn first

Lawful police don't shoot an unidentified ship on sight. A transponder can be damaged or simply broken.

1. **The hail.** `Unidentified Cobra Mk III, this is Lave police. Switch on your transponder.` About **15 seconds**, with a countdown on screen.
2. **You comply.** They read your transponder and carry on as with any check: clean ships go on their way; wanted ones are treated as wanted.
3. **You can't comply.** The transponder becomes one of the fitted systems that combat damage can knock out (as equipment already can be). Cut your speed and let a Viper close to 2 km to read your hull. Then it either lets you go (`Get that seen to at the next station`), or escorts you in if you're wanted. A broken transponder costs time, never your ship.
4. **You refuse or run.** Speeding away, staying dark past the countdown, or opening fire makes you hostile, and every Viper in range comes after you.

The same courtesy runs through the whole law: **warn first, escalate on defiance**, as the station already does when you fire near it.

## 4b. Building worlds

Wexley-Yorozu builds stations where they're needed, from what's there (the full chain is in [the trading companies](../companies.md#the-fleet-the-titanoboa-and-the-yards)). Nobody tows a finished station between stars.

- **Where:** a system with a **moon** (or, later, an asteroid field) and no station, or too few berths. Moons are already in the game ([exploration](../ideas.md#exploration)), and they're the quarry.
- **The yard:** the **Titanoboa** constructor in orbit by the moon, ore haulers running between them, and the station in its current stage: bare spine, frame, half-plated, spinning up. A corporate fleet works around it.
- **Stages, for everyone:** each stage takes days, from the seed and the clock, so every commander sees the same yard at the same stage.
- **A partly built station** docks a few ships once its first sections are sealed. It **buys** what can't be made from the moon (electronics, computers, machinery, medicine, food for the workers) at good prices, and **sells** what the refinery makes (alloys).
- **Construction contracts:** haul the things on that list. In the shared galaxy every commander's deliveries move the build along, so a station opens sooner when players pitch in: a community goal that costs one counter on the server.
- **Opening day:** spin-up, traffic control, a market, and news across the region, with premiums for the first traders in. The Titanoboa leaves through a rift.
- **Later:** mining contracts (ore from the moon, once mining is built), and player-built stations (see [player-run stations](player-stations.md)) built the same way, by Wexley-Yorozu under contract.
- **Moving a station** is a rare event: de-spun, with the constructor docked rigidly through the slot on its axis, pushing, in short slow jumps.

## 5. How it feels

- **A new commander** docks, opens **Contracts**, takes a small Hexon Holdings run with no bond, and is earning in their first five minutes. No exchange needed.
- **A steady hauler** builds standing, takes bigger runs, and joins the Mutual for its insurance perk.
- **A risk-taker** works for Vorg through the frontier, for danger bonuses, with pirates waiting in the lanes.
- **An independent** ignores the companies, uses the trade computer, buys low, sells high, and keeps every credit (and every loss).
- **A pirate** goes dark in the lanes, picks off haulers before the police arrive, sells to fences, and stays out of station space. Every Viper hail is a choice: bluff, or run.
- **An escort**, later, is paid to stop that pirate.

## 6. In the shared galaxy

- **Everyone sees the same companies.** Their fleets and contracts come from the seed and the clock, so the world is shared without a server deciding it.
- **Contracts are claimed.** A player who takes a contract claims its slot on the server (one small event), so two players can't both fly it.
- **Players report crimes.** A commander who witnesses a raid is a witness, and the server referees what they saw.
- **Players' own companies** (guilds) later post contracts of their own, on the Merchants' terms (escrow, bonds; see [markets and trade](markets-and-trade.md#haulage-contracts)), and compete with the three.
- **Running cost:** nothing for single-player; a few bytes per contract claimed and per crime reported in shared space, on the Cloudflare server we already run, which charges per request.

## 7. Building it in stages

| Stage | What |
|---|---|
| **1. Companies and contracts** | The four companies and their presence by system; a **Contracts** tab at the station (the first trading screen a new commander sees); haulage and rush contracts with consigned cargo, deadlines in jumps and pay; standing with each company; NPC traders in company colours with their marks. *Smallest slice that makes sense; supply runs, bonds and perks follow once it plays well* |
| **2. The law beyond the station** | Station space and witnesses; the distress call and police response time; running dark; the police challenge; the transponder as damageable equipment; the distress jammer |
| **3. Fleets and conflict** | Escort and recovery contracts; company security ships; rivalry events (a company war as a world event, with blockades and premiums) |
| **3b. Building worlds** | Wexley-Yorozu yards by moons: the Titanoboa constructor, ore haulers, and a station rising through its stages (spine, frame, plating, spin-up) over days for everyone; partly built stations buying what the moon can't supply; construction contracts; opening day. In the shared galaxy, every commander's deliveries speed the build: a community goal that costs a counter on the server |
| **4. Shared galaxy** | Claiming contracts on the server; player witnesses; player-run companies posting contracts |

## Open questions

1. **Company names and characters.** Hexon Holdings and Wexley-Yorozu agreed; Vorg Industries and the Carriers' Mutual proposed. Backstories in [the trading companies](../companies.md).
2. **Deadlines in jumps** rather than real time: agreed?
3. **The exchange for new commanders:** always available (proposed), or unlocked once you've done a few contracts?
4. **The trade computer:** kept as the independent's tool (proposed).
5. **Witness range:** scanner range (4 km close, 12 km far), or one fixed distance?
