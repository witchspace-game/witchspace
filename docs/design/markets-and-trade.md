---
title: Markets and trade
status: building
pillar: trade
summary: Real supply and demand: worlds that produce and consume, stations posting orders, NPC traders hauling to where goods are wanted, world events, and the black market.
card: bullsnake
stages:
  - Supply and demand, new goods, station orders, real cargo on real ships | built
  - World events and news that travels | built
  - The black market, stolen goods and the fence | built
  - Merchants: trading without flying | proposed
help:
  - Write a world event: what happens, who it hurts, the headline | writing
  - Balance-check prices on a run you fly often | playtest
---

# Design: markets and trade

*Status: **agreed direction**, Modern rules. It builds on the living markets and the exchange already built (see [economy and exchanges](economy-and-exchanges.md)), and everything here works in single-player first. In the shared galaxy, players' orders join the same books. Classic keeps 1984-style markets. Numbers marked **(to tune)** are starting points for playtesting.*

## The idea

Witchspace's markets already move: your trades and NPC trades shift prices, stock runs out, and every market has a real history. What they don't yet have is **reasons**. Nothing wants the goods, NPC traders trade at random, and the station is the only counterparty.

This design gives markets real causes:

1. **Supply and demand:** worlds produce and consume, stations post real orders for what they need, and NPC traders haul goods to where they're wanted.
2. **World events:** famines, booms, strikes, wars and incursions, some generated and some caused by players, that change what worlds need.
3. **The black market:** weapons, narcotics and slaves trade by their own rules, with the best prices where they're most dangerous to sell.
4. **Merchants:** players who trade without flying, by renting warehouses and hiring pilots to carry their goods, which still have to make the trip.

The drama comes from what it always did in *Elite*: knowing something others don't, and getting there first.

Related designs: [economy and exchanges](economy-and-exchanges.md), [law and travel](law-and-travel.md) (scans, fines, licences, the Marshals), [system currencies](system-currencies.md), [stations and worlds](stations-and-worlds.md).

---

## 1. Supply and demand

### Worlds produce and consume

Every world has, for each good:

- a **production rate** (tonnes per hour) from its economy, population and tech level: agricultural worlds grow Food, industrial worlds make Machinery and Computers, rich worlds want Luxuries;
- a **consumption rate** from the same values;
- a **stock** at its stations, which production fills and consumption drains.

Stock no longer simply returns to a fixed "usual" level. It goes where production and consumption push it, and **trade is what balances it**. A world that consumes more Food than it grows will run short unless someone brings Food in.

### Stations post real orders

When a station is running short, it **posts a buy order** on its exchange, a real resting order with a price and a size:

> Cambridge Orbital buys **40 t Food** at up to **5.2 Cr**

- **Size** follows the shortfall: how far stock is below what the world needs for a day or so **(to tune)**.
- **Price** rises the longer the shortage lasts and the worse it gets.
- **Deliveries fill orders first.** Arrive with 20 t of Food and you sell at the order's price, until the order is filled. Anything beyond that goes into the normal market at the normal price.
- Stations with a glut post **sell orders** in the same way, below the market price, to clear it.

These orders sit in the order book alongside the station's normal prices, marked by who posted them. Before you jump, you can see what a station wanted, as far as your news is fresh ([information that travels](economy-and-exchanges.md#2-information-that-travels)).

### NPC traders with a purpose

NPC traders stop trading at random. Each one runs a route:

1. **Buy** where a good is cheap, usually where it's produced.
2. **Fly** the jump to where it's wanted, taking real time.
3. **Sell**, filling that station's buy orders first.

So **prices even out between systems through arbitrage**, as they do in real markets, and you're competing with the NPCs for the best runs. Busy routes are well served and thin; remote systems pay more because fewer traders bother.

### New goods

Four goods join the original seventeen, to give supply chains more links. They're Witchspace's own additions; **Classic keeps the original list**.

| Good | Made on | Wanted by | Notes |
|---|---|---|---|
| **Water** | Ice and ocean worlds, agricultural worlds | Industrial and desert worlds, everywhere in a drought | Cheap and bulky: a high-volume, thin-margin staple |
| **Hydrogen fuel cells** | Industrial and high-tech worlds, gas-rich systems | Busy systems (demand rises with traffic), industry | Also what stations refuel ships with, so traffic consumes it |
| **Electronics** | Mid-tech industrial worlds, from Minerals | High-tech worlds that build Computers and Machinery | A link in the chain Minerals → Electronics → Computers |
| **Medicine** | High-tech worlds | Everywhere in a plague or war; poorer worlds always | Prices spike hard in a crisis; running Medicine into a plague zone is a mission in itself |

With these, production uses inputs: a world making Computers consumes Electronics, and one making Electronics consumes Minerals. Disrupt a link and the shortage spreads down the chain.

### Real cargo on real ships

NPC traders' cargo is real. The traders you meet in flight are carrying it, and their arrival is what fills the orders. **If a trader never arrives, its delivery never happens:**

- **Pirates** who destroy traders near a system cause real shortages there.
- **Escorting** traders keeps a system supplied, and becomes paid work.
- **Your own convoy runs**, under hauling contracts ([contracts](economy-and-exchanges.md#5-contracts-and-futures-multiplayer)), feed the same orders.

Traders far from the player don't need to be simulated in flight. A deterministic schedule of departures, arrivals and losses, from the seed and the clock, is enough, as with today's NPC trade stream. When you're in a system, the traders you meet are the ones on that schedule.

**Built (October 2026): deeper markets, the trade computer, and risk that pays.**

- **Depth.** Living markets are six times deeper than 1984's (`MARKET_DEPTH`), and importers keep at least 35% of an average world's stock. One Cobra load moves a price a little; only a stream of traders moves it a lot. A new commander makes about 45 Cr a run, one with 1,000 Cr about 250 to 650.
- **Trade computer** (Modern, on the exchange): live prices at every market within a tank of fuel, the best runs from here with the profit on a full load (your own price impact included), better markets for your hold, and Set course. Lawless destinations are tagged.
- **Danger premium** (`DANGER_PREMIUM`): fewer traders brave lawless space, so imports cost more and exports less there: up to 45% in an anarchy, 32% feudal, 16% multi-government, 7% dictatorship. Runs into anarchies and feudal worlds pay about 1.6 times a safe run.
- **Crisis premium** (`CRISIS`): a world in trouble pays over the odds for what it lacks, on top of the shortage itself: a famine about 2.4 times the usual price of food, a plague over 3 times for medicine.
- Classic keeps 1984's prices and stock throughout.

## 2. World events

*(Built so far: generated events (famine, drought, plague, boom, mining strike, civil war, pirate blockade, Thargoid incursion, police crackdown) from each system's seed and the clock, about one world in ten affected at any time, lasting two to eight hours. They shift the stock of the goods they touch, so prices move, stations post orders and shortages spread down supply chains. News travels at 10 minutes plus 12 minutes per light year, up to 25 light years: a News tab at stations, diamonds and a News line on the galaxy map, a banner on the exchange, markers on the chart, and a headline when you arrive somewhere in crisis. Once news of a shortage reaches a world, its traders start buying what's wanted, so a fast ship that gets there first buys cheaper. Player-made blockades and community-written event files are still to come.)*

Events change production and consumption, so markets react on their own:

| Event | Effect |
|---|---|
| **Famine** | Food production collapses; big Food buy orders at high prices |
| **Plague** | Medicine wanted urgently; consumption of Luxuries and Liquor falls |
| **Boom** | Consumption of everything rises; Luxuries especially |
| **Drought** | Water and Food wanted; Water-hungry industry slows |
| **Mining strike** | Minerals, Gold and Platinum production stops |
| **Civil war** | Firearms and Medicine demand soars; Food and Machinery wanted; trade traffic dangerous |
| **Pirate blockade** | NPC traders stop arriving; imports dry up across the board |
| **Thargoid incursion** | Trade traffic collapses; Alloys and Firearms wanted; Alien Items appear |
| **Police crackdown** | Black-market supply dries up; contraband prices soar (section 3) |
| **Discovery** | A new deposit or crop: a lasting change to what a world produces |

- **Generated events** come from the seed and the clock, so they're the same for everyone, with a start, a duration and an end. A world is never in crisis for long without a reason.
- **Player-made events:** a blockade happens when pirates, including players, actually destroy enough of a system's traffic. Clearing them ends it.
- **Headlines.** Each event has a short news headline, written in the game's voice. News spreads at the speed of ships, so the first commander to hear of a famine three jumps away can fill a hold with Food and get there first.
- **On the chart.** Events appear as markers on the exchange chart, so you can see what caused a spike.
- **Community content.** Events are data files (trigger, effects, headlines), checked by `npm run validate`, so the community can write them.

## 3. The black market

*(Built so far, Modern rules: legality by government as in the table below; a Weapons Licence (300 Cr) for firearms where they're licensed; contraband judged by the local law in scans and inspections, and inspections at lawful stations are likely rather than certain (50–80%). A back room on the exchange in every system with a law to break: thin stock, an 8% spread each side, prices from 1.5× (feudal) to 3.2× (corporate state) the open price, smugglers coming and going, crackdowns drying it up, and a sting chance per deal from 2% to 22%, higher for big deals. A sting seizes the goods or the credits and makes you an Offender. Abolitionists at lawful worlds buy slaves to free them, legally, at about half the back-room price, and count the people you've freed. Stolen goods are tracked: cargo scooped from a clean ship you destroyed is marked stolen; where there's a law the police treat it as contraband (only the stolen part is confiscated) and stations won't buy it openly, but a fence in the back room takes it for about 60% of the open price, stings and all. Salvage from pirates and other people's kills stays clean, and anarchies don't ask. Repeated lost deliveries near a system make the news. The liberation mission line is still to come.)*

Weapons, narcotics and slaves trade under their own rules.

### Legality by government

| Government | Firearms | Narcotics | Slaves |
|---|---|---|---|
| Anarchy | Legal | Legal | Legal |
| Feudal | Legal | Illegal | Legal |
| Multi-government | Licensed | Illegal | Illegal |
| Dictatorship | Licensed | Illegal | Illegal |
| Communist | Illegal | Illegal | Illegal |
| Confederacy | Licensed | Illegal | Illegal |
| Democracy | Licensed | Illegal | Illegal |
| Corporate State | Illegal | Illegal | Illegal |

- **Licensed** means you can trade with a weapons licence (see [weapons licences](law-and-travel.md#weapons-licences-and-no-fire-zones)), and it's an offence without one.
- Where a good is **legal**, it trades on the normal exchange like anything else.
- Where it's **illegal**, the station won't trade it, but the black market might.

### The back room

In systems where the law is weak or for sale (anarchies, feudal worlds, dictatorships and other corrupt governments), stations have a **black-market exchange**: a second tab, reached through the right contacts.

- **Thin and wide:** small order books, wide spreads, and prices that jump with every trade.
- **Smugglers:** NPC smugglers run contraband from where it's legal to where it isn't, and you compete with them.
- **The best prices are the most dangerous.** Contraband fetches most where it's banned and the police are strongest. A lawful world's black market pays several times the anarchy price **(to tune)**, if you can get it there.

### Faces in the back room *(idea, Mark, 29 October 2026)*

Mark: "we should have characters that are representing shady deals etc. You build standing with these characters and they build trust where they offer you better paid or even politically motivated jobs!!!" This answers the open question below: the back room is reached through contacts, and contacts are earned.

- **A few faces per back room, each with a trade:** the fence (already in the lore), a smuggler, a fixer with the jobs nobody posts, and, in the right systems, someone whose politics you can't read (the Bureau of Continuity; Mutual radicals against Hexon).
- **Trust is earned, never bought:** deliver on time, keep quiet, don't get caught. Each step brings better pay, then jobs with names attached.
- **Trust breaks.** Get caught, or co-operate with the police, and doors close across the region: they talk to one another. And now and then a contact is police (the lore already says some buyers are).
- **They remember you,** like the saloon regulars ([trading.md](trading.md)), and later with voices of their own.
- *Later:* political jobs are where Mark's parked factions idea recruits players.
- **Ties to the scan on the way out** ([law-and-travel.md](law-and-travel.md#scanned-on-the-way-out-idea-mark-29-october-2026)): a trusted contact can get you out quietly, or tip you off before the station's scan.

### The risks

- **Police scans** on approach find contraband, as they do now: fines, confiscation and an Offender record.
- **Undercover buyers.** In mid-law systems, some black-market buyers are police. The chance rises with the system's law and how much you trade there.
- **Traceable goods.** Some contraband is marked. Sell it, and the record may follow you to the next system that checks.
- **Crackdowns** (section 2) shut a black market for a while. Supply dries up, prices soar, and the smugglers who still run it get rich or caught.

### Goods with character

- **Narcotics:** demand barely changes with price. A crackdown makes prices spike rather than demand fall, which makes narcotics the most profitable and most volatile thing to run.
- **Firearms:** demand follows conflict. Civil wars, incursions and Compact embargoes ([the Meridian Compact](system-currencies.md#6-the-single-currency-a-union-with-an-agenda)) send it soaring.
- **Slaves:** kept from the original game's list as a tribute, and illegal almost everywhere with a working government. Trading them is always a crime in lawful space.
  - **Liberation:** abolitionist groups in lawful systems buy slaves to free them. They pay less than the black market, but freeing them earns reputation with lawful governments and the Marshals, and opens a **liberation mission line**: intercepting slaver convoys, raiding pens in anarchies, and escorting freed people to safe worlds. The trade stays possible; the game makes clear which side is heroic.

## 4. In the shared galaxy

- **Players post orders.** Limit orders from players sit in the same books as stations' and NPC traders'. They fill against each other, and a player can buy a station's whole glut and sell it on.
- **Market makers.** AI-agent traders and the stations themselves keep markets liquid when few players are about. Agents have personalities: cautious ones with wide spreads, aggressive arbitrageurs, guild trading desks.
- **One set of books.** Every trade, a player's, an NPC's or an agent's, is an event on the server's books (see [servers and hosting](servers-and-hosting.md)). Nobody's browser decides a fill.

## 5. Merchants: trading without flying

Some commanders love the markets more than the flying. A **Merchant** plays Witchspace from the exchange: buying where goods are cheap, hiring pilots to carry them, selling where they're wanted, and trading the markets that need no hauling at all. It works on a phone in a spare five minutes, and it suits players who already know their way around a trading screen.

**The rule that keeps it honest: goods still have to move.** A Merchant never teleports cargo. Every tonne sits in a real place (a ship's hold or a station warehouse) and only gets anywhere by being flown there, at the risk of pirates. That's what makes the economy mean something, and it's what gives pilots paid work.

### Warehouses and the trading terminal

- **Warehouses.** A Merchant rents storage at stations, for a small daily fee **(to tune)**. Goods bought at a station go into its warehouse (as orders already do, see limit orders); a pilot's own commander counts as present wherever they're docked.
- **The terminal.** A web and phone view of the exchanges where you have a warehouse: charts, the order book, limit orders, your stock and your contracts. You can only trade where you have a presence, so a warehouse is a decision, not a formality.
- **News travels the same way for everyone.** Each warehouse hears the news when its station does, at the speed of ships. A Merchant at a desk gets no advantage over a pilot who flies there first, which keeps "fast ships beat the news" true.

### Haulage contracts

- **Posting.** A Merchant posts a contract: these goods, from my warehouse at A to station B, by this time, for this pay. The pay is held in escrow when it's posted.
- **Flying it.** A pilot accepts, the goods load into their hold at A, and delivery at B pays out. Pilots put up a bond (a share of the cargo's value) that covers the goods if they don't arrive; insurance doesn't, since the goods aren't theirs.
- **Risk is real.** Contract cargo can be scanned and stolen like any other. A Merchant shipping Firearms through an anarchy pays more to get a pilot to take it. Pirates know a contract run when they see one.
- **NPC haulers as a fallback.** Contracts nobody takes go to NPC haulers after a while: slower, a little dearer and riskier on dangerous routes. They're scheduled like today's NPC traders, so the cargo really is in flight and can be lost. This is how it works in single-player, and in a quiet shared galaxy.

### Markets with no hauling

- **System currencies:** trading each system's token in its liquidity pool (see [system currencies](system-currencies.md)).
- **Forward contracts:** agreeing today to buy or sell a good at a station on a future date, at a price fixed now. That lets a Merchant back a hunch about a famine or a strike without moving a crate, while the goods themselves still have to turn up on the day.
- **Station shares,** later (see [player-run stations](player-stations.md)).

### A Merchant's rank

A trading rank of its own, earned by profit made (not money held), beside the combat rank and an explorer's rank. A commander can rise on all three roads, or just one.

### Fair play

- Nothing is bought with real money, and credits can't be cashed out (see [economy and exchanges](economy-and-exchanges.md)).
- Merchants trade on the same books, under the same rules, as everyone else. Automated trading is allowed only as a declared market maker (section 4), never as a hidden bot.
- Paying someone to attack shipping is a crime, as it is when you do it yourself (see [the black market](#3-the-black-market)), and contracts for it can't be posted.

### Single-player first

The terminal for your own commander's docked station, warehouses, and contracts flown by NPC haulers all work without a server, from the same deterministic simulation as today's markets. In the shared galaxy, players' contracts and warehouses join the server's books (section 4).

## 6. Building it in stages

*(Built so far, stage 1: the four new goods; each world produces or imports each good, so NPC traders mostly buy at producers and deliver to importers, and without them importers would run short; when a station is short or overstocked it posts its own buy or sell order on the book, which deliveries fill down. Supply chains: where a world makes alloys, electronics, computers, machinery, firearms, hydrogen or medicine, a shortage of the input cuts the output's stock. Inbound NPC traders in flight carry the market's real upcoming deliveries; destroy one and those goods never arrive (the trades feed shows them as lost), and its cargo spills for scooping. Ships' holds can be scanned within 2 km, and pirates do the same, preferring valuable cargo, yours included. Departures from other systems are still abstract.)*

| Stage | What |
|---|---|
| **1. Supply and demand** | The four new goods; production and consumption, with inputs; station buy and sell orders in the book; deliveries fill orders first; NPC traders running routes on a deterministic schedule |
| **2. Events** | Generated events with headlines and chart markers; blockades from destroyed traffic; news spreading with ships |
| **3. Black market** | Legality by government; the back-room exchange; smugglers; undercover buyers; crackdowns |
| **4. Shared galaxy** | Player limit orders, AI-agent market makers, server-side books |
| **5. Merchants** | Warehouses and the trading terminal (web and phone), haulage contracts with escrow and bonds, NPC haulers, forward contracts, a trading rank. Single-player first, then shared |

---

## Open questions

- **Rates:** production, consumption and order sizes, tuned so trade routes are worth flying without any one route being a money machine.
- ~~**New goods:**~~ settled: Water, Hydrogen fuel cells, Electronics and Medicine join the list (Modern rules only).
- **Event frequency:** how often a world should be in crisis for the galaxy to feel alive without feeling chaotic.
- **Black-market access:** is the back room open to everyone in corrupt systems, or reached through contacts and reputation? *(Mark's answer, 29 October 2026: through faces you earn trust with, above.)*
- **Merchants:** does a pure Merchant need a commander and a ship at all, or can an account just rent warehouses? Warehouse fees, bond sizes, and how long a contract waits before NPC haulers take it.
- ~~**Slaves:**~~ settled: kept as in the original, with abolitionist buyers and a liberation mission line.
