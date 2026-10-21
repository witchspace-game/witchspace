# Design: markets and trade

*Status: **agreed direction**, Modern rules. It builds on the living markets and the exchange already built (see [economy and exchanges](economy-and-exchanges.md)), and everything here works in single-player first. In the shared galaxy, players' orders join the same books. Classic keeps 1984-style markets. Numbers marked **(to tune)** are starting points for playtesting.*

## The idea

Witchspace's markets already move: your trades and NPC trades shift prices, stock runs out, and every market has a real history. What they don't yet have is **reasons**. Nothing wants the goods, NPC traders trade at random, and the station is the only counterparty.

This design gives markets real causes:

1. **Supply and demand:** worlds produce and consume, stations post real orders for what they need, and NPC traders haul goods to where they're wanted.
2. **World events:** famines, booms, strikes, wars and incursions, some generated and some caused by players, that change what worlds need.
3. **The black market:** weapons, narcotics and slaves trade by their own rules, with the best prices where they're most dangerous to sell.

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

## 2. World events

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

## 5. Building it in stages

*(Built so far, part of stage 1: the four new goods; each world produces or imports each good, so NPC traders mostly buy at producers and deliver to importers, and without them importers would run short; when a station is short or overstocked it posts its own buy or sell order on the book, which deliveries fill down. Still to come in stage 1: supply chains with inputs, and NPC traders as ships carrying real cargo on routes.)*

| Stage | What |
|---|---|
| **1. Supply and demand** | The four new goods; production and consumption, with inputs; station buy and sell orders in the book; deliveries fill orders first; NPC traders running routes on a deterministic schedule |
| **2. Events** | Generated events with headlines and chart markers; blockades from destroyed traffic; news spreading with ships |
| **3. Black market** | Legality by government; the back-room exchange; smugglers; undercover buyers; crackdowns |
| **4. Shared galaxy** | Player limit orders, AI-agent market makers, server-side books |

---

## Open questions

- **Rates:** production, consumption and order sizes, tuned so trade routes are worth flying without any one route being a money machine.
- ~~**New goods:**~~ settled: Water, Hydrogen fuel cells, Electronics and Medicine join the list (Modern rules only).
- **Event frequency:** how often a world should be in crisis for the galaxy to feel alive without feeling chaotic.
- **Black-market access:** is the back room open to everyone in corrupt systems, or reached through contacts and reputation?
- ~~**Slaves:**~~ settled: kept as in the original, with abolitionist buyers and a liberation mission line.
