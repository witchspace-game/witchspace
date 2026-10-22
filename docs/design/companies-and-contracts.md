# Design: trading companies, contracts, and the law beyond the station

*Status: proposed, for discussion. Modern rules only; Classic stays as 1984. Builds on [markets and trade](markets-and-trade.md) (section 5, Merchants) and [law and travel](law-and-travel.md) (section 1, transponders).*

## The idea

A new commander shouldn't land on a trading exchange with candles and an order book. In the real world, someone starting out takes work from an outfit that's already established. So in Witchspace:

- **A few rival trading companies own most of the trade.** Their haulers run between stations and systems all the time, and they post **contracts** at every station they serve: carry this cargo there, by then, for this pay. Take one or leave it.
- **Independents** still trade on their own account on the exchange, with the trade computer, where the big money and the big losses are.
- **The space between stations is where it gets interesting.** Company haulers can be intercepted, by pirates and by players. Close to a station the law sees everything; out in the lanes it needs a witness. Ships can run dark, and police challenge before they shoot.

All of it runs the way Elite's galaxy did: **worked out from each system's seed and the clock, in every browser, the same for everyone.** No server and no database for the single-player slice, and only small events on the existing shared-space server later.

---

## 1. The companies

Three to start, each with a character, a home ground and a rival. Names follow the [worldbuilding](../worldbuilding.md) style: slightly old-fashioned, often two surnames. **(Names proposed.)**

| Company | Character | Home ground | Pays | Wants |
|---|---|---|---|---|
| **Halden & Vey** | An old corporate house. Punctual, polite, unforgiving of lateness. Never carries contraband. | Corporate States, Democracies, Confederacies | Steady, on time; small danger bonuses | Reliability. The best first employer. |
| **Brackwater Freight** | A frontier outfit that runs where others won't. Asks no questions about your past. | Anarchies, Feudal and Multi-Government worlds | High, with big danger bonuses | Nerve. Later, some of its cargo is "irregular". |
| **The Carriers' Mutual** | A Co-operative-chartered mutual of independent haulers. Fair, a little bureaucratic. | Everywhere with a government | Fair; members get benefits | Members. Standing here is membership. |

- **Presence by system.** Each system has a mix of the three, from its government and its seed: Halden & Vey dominate the safe core, Brackwater the frontier, the Mutual a little of everywhere. The mix sets who posts contracts there and whose ships you see.
- **Rivals.** Halden & Vey and Brackwater compete for the worlds between. Helping one doesn't hurt you with the other, but attacking one's ships does (section 3).
- **They're the market makers.** A company's contracts come from the same market model as the exchange. A famine at Esbiza means a food contract to Esbiza, paying a crisis premium; a glut means cheap cargo to move out. The companies are how the market reaches a new commander.

## 2. Contracts

### What a contract is

`Carry 12 t Medicine · Leesti → Riedquat (6.8 LY, Feudal) · within 3 jumps · 340 Cr + 120 danger bonus · Brackwater Freight`

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
| **Partner** | Company perks: Halden & Vey's docking priority, Brackwater's friendly fences, the Mutual's lower insurance excess |

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

## 5. How it feels

- **A new commander** docks, opens **Contracts**, takes a small Halden & Vey run with no bond, and is earning in their first five minutes. No exchange needed.
- **A steady hauler** builds standing, takes bigger runs, and joins the Mutual for its insurance perk.
- **A risk-taker** works for Brackwater through the frontier, for danger bonuses, with pirates waiting in the lanes.
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
| **1. Companies and contracts** | The three companies and their presence by system; a **Contracts** tab at the station (the first trading screen a new commander sees); haulage, rush and supply contracts with consigned cargo, deadlines in jumps, pay and bonds; standing with each company; NPC traders in company livery |
| **2. The law beyond the station** | Station space and witnesses; the distress call and police response time; running dark; the police challenge; the transponder as damageable equipment; the distress jammer |
| **3. Fleets and conflict** | Escort and recovery contracts; company security ships; rivalry events (a company war as a world event, with blockades and premiums) |
| **4. Shared galaxy** | Claiming contracts on the server; player witnesses; player-run companies posting contracts |

## Open questions

1. **Company names and characters.** Proposed above; happy to change.
2. **Deadlines in jumps** rather than real time: agreed?
3. **The exchange for new commanders:** always available (proposed), or unlocked once you've done a few contracts?
4. **The trade computer:** kept as the independent's tool (proposed).
5. **Witness range:** scanner range (4 km close, 12 km far), or one fixed distance?
