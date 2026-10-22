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

**Below zero** (letting a company down): **Unreliable** (−1 to −5), **Distrusted** (−6 to −9), **Blacklisted** (−10 and below). Starter work stays open until you're Blacklisted. Two ways back, since every hard situation needs one: **make amends** at any station the company works (150 Cr for each point below Unreliable, which takes you back to Unreliable), or **wait**: companies forget, a point a day. *(Built.)*

Standing is its own record, beside the combat rating and the explorer's rank, and is the first half of the Merchant's **trading rank** in [markets and trade](markets-and-trade.md#a-merchants-rank).

### Failing a contract

- **Late:** paid less, standing dips.
- **Lost** (ship destroyed, cargo taken or jettisoned): no pay, the bond is forfeit, standing drops. Your savings and your ship's insurance are untouched; the company insured its own cargo.
- **Stolen by you** (sold to a fence): the company knows. Standing with it falls to the floor, and the cargo is reported stolen everywhere it trades.

## 2b. Files, messages and special assignments

**Built (October 2026, `src/game/assignments.ts`).**

- **The companies keep files.** Once you have any standing with a company, the Contracts tab offers *your file*: your contracts delivered, late and failed, your combat rating, your legal standing, where you were last seen, and a line or two **redacted**: things the company noticed that you didn't (a crisis you passed through, the Bureau of Continuity's interest). Each company's file is in its own voice: Hexon's dossier, Vorg's one-line assessment, the Mutual's membership card, Wexley-Yorozu's page 214.
- **Special assignments.** With **Contractor** standing or better, a company may get in touch: a chance every three days, the offer open for 48 hours. It arrives as a **message** in its own voice ("A matter requiring discretion, Commander") and appears on the board at any station where the company does business: a small, unusual cargo (Hexon's sealed class-4 biologicals, Vorg's crates that tick, the Mutual's relief supplies, Wexley-Yorozu's sample case), two to four jumps out, paying several times a normal contract and +3 standing. Once taken, it counts in jumps like any contract.
- **The same everywhere.** Whether an assignment is waiting depends only on your callsign, your standing and the clock (`assignmentWaiting`), so the notification server can tell when to get in touch without knowing anything else.
- **Notifications** *(built, October 2026)*: see below.

### Contracts by notification

A special assignment can reach you away from the game, so a company's offer is a reason to come back.

- **Opt in, in the game.** Under **A · Account** (signed in), *Let the companies contact me* has two switches: *Notifications* on this device, and *Email* to your sign-in address. Both are off until you turn them on, and either can be turned off there again; every email also has a one-click *Stop these messages* link.
- **Which devices.** Notifications use the browser's own Web Push (no third-party service): any modern browser on a computer or Android, and on an **iPhone only when the game has been added to the Home Screen** (iOS 16.4 or later). That's one reason the title screen asks iPhone players to add it (*Play full screen*). Email works anywhere.
- **What starts one.** Every hour the server (`Accounts` alarm in `server/src/accounts.ts`) looks at each opted-in commander's cloud save. If a company has an assignment waiting (`assignmentWaiting` in `server/src/contact.ts`, the same function the game uses, so the offer is really on the board) and you haven't seen it in the game, taken it, or been told already, the company gets in touch: a notification if this device has them on, otherwise an email.
- **Who qualifies.** Modern rules, a signed-in commander with a cloud save, and **Contractor** standing (5 points) or better with that company. Each company has a chance (40 %) of an assignment every three days, open for 48 hours.
- **How often.** At most **two a week** in all, whatever your standing with the four companies.
- **In character.** The notification is from the company, in its own voice ("Hexon Holdings: A matter requiring discretion, Commander"); the email uses the company's colours and banner (`server/src/emails.ts`). Opening it takes you to the game, where the offer is waiting in **Messages** and on the board at any station the company works.
- **What's kept.** Only what's needed to reach you: the push subscription, whether email is on, and which assignments you've been told about (see the privacy page).

Later: the same channel for things that happen while you're away (a contract running late, an adrift case found, a Marshals invitation), each its own switch.

## 2c. When things go wrong

What happens to a special cargo when the ship carrying it is lost, and how a company can use that against you.

### 1. The package survives *(built)*

- **Company special cargo is built to survive.** When your ship is destroyed, the case spills as its own canister, in the company's colours, with a **beacon**: it shows on the scanner and the screen to anyone in the system, e.g. `W-Y property · sealed`.
- **Lost at the station mouth** (within 3 km), the station crew picks the case up, and what happens next is a gamble:
  - **An honest crew** (about a quarter of the time): dock there (or wake up there) to collect it, for a salvage fee of a tenth of the contract's pay, never more than half your spare credits.
  - **The station police want a word:** at their station, *let them open it* (cleared, but the company's secret is out and your standing falls; Vorg's crates make you an Offender), *refuse* (they keep it and mark you an Offender for obstruction, but the company appreciates your silence), or *call the company* (its lawyers get it released, and you owe it a **favour**, which goes in your file: leverage for later).
  - **A friend at the station** kept it: *pay* (half as much again as the contract), *refuse* (they tell the company it was opened), or *find out who* in the back room (usually works; if not, they leak it).
- **In the lanes, the beacon draws pirates.** A minute or so after you arrive in the system, a pair comes for the case. Get there first and it's yours. If they take it, they run for deep space: shoot one down and the case spills again. If they get away (or you leave the system), they want a **ransom**: pay and it's left at the station, or refuse and it's gone to a fence. Left alone for 6 hours while you're elsewhere, pirates may find it first.
- **It holds station** for 24 hours (real time, so logging off overnight doesn't cost you it), then begins to fall towards the planet.
- **The contract isn't lost yet.** It's marked *adrift*, still counting jumps. Fly back, slow down within about 60 m, and the case answers your transponder and comes aboard, no fuel scoops needed. The contract carries on.
- **Rival buyers.** Any special cargo can be sold to a rival instead of delivered: Wexley-Yorozu's to Hexon, Hexon's to Vorg, Vorg's to Hexon. About half as much again as the delivery pays, a big standing boost with the buyer and a bigger fall with the owner. The Mutual's relief supplies have no buyer: some things aren't for sale.
- **In the shared galaxy** (later), a lost case is a small event on the system's server: everyone sees the beacon, a recovery contract goes up for anyone, and whoever scoops it holds stolen company property.

### 2. What was inside *(built)*

Every special cargo has **hidden contents**, fixed when it's offered and revealed only if it's opened or falls: Hexon's are usually harmless, sometimes a pathogen, rarely a specimen; Wexley-Yorozu's are often a specimen, sometimes a pathogen; Vorg's are munitions; the Mutual's are what they say.

- **Opened on a station** (the police open it): a **pathogen** starts an outbreak in that system (a plague, 36 hours) and locks the station down (6 hours, docking refused); a **specimen** gets loose aboard (lockdown, 8 hours). Hexon's medicine is already on the way, and Wexley-Yorozu's Science Division asks you to *remain where you are*.
- **Fallen to the planet**: a **pathogen** means an outbreak (48 hours); a **specimen** takes root as a **strange bloom** (72 hours: farms overrun, food and water short).
- They're real world events: headlines in the news, crisis prices, the station closed. They're kept in your save (yours, and your galaxy's now), one at a time per world, and your file remembers: redacted by everyone but the Mutual.

### The fall *(the original plan)*

If nobody recovers it, the case falls planetward, and unlike an ordinary canister it **survives re-entry**. What follows depends on what was inside:

- **An outbreak:** a plague on that world, a real world event with headlines, medicine prices through the roof, a crisis premium for relief. Hexon's medicine is already on the way. It always is.
- **Something takes root:** a terraforming organism. A strange bloom over the southern continent; within weeks a Wexley-Yorozu yard, a "cleanup" fleet and a new claim on the world.
- **Quarantine:** the Co-operative seals the system; police turn traffic back, the station refuses docking, and blockade runners find work.

**You caused it, and your file says so:** *"Subject's vessel was lost above Leesti 2 days before the outbreak."* Put it right (haul relief, run the blockade, help the Mutual) and the file gets a kinder line. Rare and fair: only Hexon's and Wexley-Yorozu's special cargo, only if it's really left to fall. In single-player the event belongs to your galaxy (kept in your save); in the shared galaxy it's one event on the server, limited to one per region at a time, lasting days not weeks.

### 3. Page 214 *(later)*

Sometimes it isn't an accident. For commanders with **Trusted** standing who've taken special assignments, at most once in a long while:

- **The setup.** The "pirates" who jump you are too well equipped, run dark, and their hulls are off-white with yellow markings. Your file gains a redacted line.
- **The message.** *"Wexley-Yorozu regrets the loss of company property valued at 40,000 Cr. Under clause 214 of your agreement, the liability is yours. There is, of course, another way to settle the matter."*
- **The squeeze** is leverage, not money (losing a ship never ruins anyone): no Wexley-Yorozu work, and your file passed to Hexon, until you settle with a chain of darker jobs: sealed samples into a quarantined colony, a passenger who mustn't be scanned, a Mutual hauler that mustn't reach port.
- **Ways out**, as the law always gives: **comply** (paid, clean slate, and a file that now says *suitable for special orders*); **blow the whistle** to the Mutual or the Co-operative Marshals (Wexley-Yorozu hostile, the Mutual and the Marshals take you in: perhaps the start of a Marshals career); or **sell them out** to Hexon.

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

*(Built, part 1, October 2026, Modern rules: station space 10 km; witnesses are police within 8 km or other ships within 6 km; a victim that docks, jumps or is still alive when you leave reports you; distress calls bring two Vipers to the scene after 10 s + 1 s per 200 m beyond station space. Part 2, also built: the transponder switch (0, or **Dark** on touch), unidentified crimes and the suspect rule (switching on within 3 minutes where police or the station can see), lawful stations refusing a dark ship, the 15 s police hail (a broken transponder: hold still and a Viper reads your hull at 2 km), the transponder as damageable equipment (repair 90 Cr), and the distress jammer (800 Cr, sold only in anarchies and feudal worlds, confiscated where police scan). Every ship flown is a Cobra Mk III for now, so the "rare hull is recognised" rule waits for more ships.)*

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

### Scans and company cargo

How the police look at you today (Modern rules): a Viper scans a ship that stays within about 1.2 km of it for 3 seconds, once per visit, anywhere above Feudal. Docking, a ship carrying nothing illegal is never inspected; one that is faces a chance by government (Communist 60 %, Confederacy 50 %, Democracy 65 %, Corporate State 80 %). Salvage (from a pirate, or someone else's kill) is legal; cargo from a trader you destroyed is stolen and a scan finds it.

**The gap:** a company's consignment is kept apart from your own hold, so scans never see it, and Vorg's ticking crates pass straight through a Corporate State. They shouldn't.

### Shielded compartments *(next, after running dark)*

*Mark's idea.* For a special assignment whose cargo wouldn't pass a scan, the company fits your ship with a **shielded compartment** before you leave, and **you keep it**.

- **Company cargo becomes visible.** Special consignments count as contraband where their contents are illegal (Vorg's crates that tick, Wexley-Yorozu's sample cases, Hexon's class-4 biologicals in the stricter systems). Ordinary contracts stay manifested and legal.
- **The fitting.** Taking such an assignment fits a compartment of about **4 t** (part of the hold, not extra). The company's cargo rides in it, unseen by the flight scan and the docking inspection.
- **The bonus.** After the job the compartment stays fitted. Up to 4 t of anything in it, narcotics or slaves included, fools the flight scan. It's quietly the best smuggling kit in the game, and you can't buy it: you earn it.
- **How it fools a scan** *(Mark's question: wouldn't a 35 t ship carrying 31 t look odd, or weigh wrong?)*. A part-empty hold isn't suspicious; the papers and the mass are what could give it away, so the company covers both. **On paper**, it re-registers your hold: the Cobra's registration now reads 31 t of hold plus "structural reinforcement", so a scan sees a normal 31 t hold. **By mass**, the compartment is built as shielded bulkhead, and what's in it reads as ballast. A flight scan reads the hold, not the ship's weight, so it can't tell. The station shows your hold as *31 t + 4 t shielded*.
- **Not foolproof: the weighbridge.** The strict stations (Corporate States and Democracies) weigh ships at inspection. If the weight doesn't match the papers, they open the bulkhead: about 1 in 5 inspections there. Everything in it is confiscated, the compartment too, and you're an Offender. Players know where the risk is: a weighbridge, not luck.
- **The company knows.** It goes in your file (*"Fitted: one compartment, our pattern"*). Fall out with that company and it's leverage, which fits the blackmail thread (2c).
- **It pairs with running dark:** the transponder hides **who** you are; the compartment hides **what** you carry.

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
| **2. The law beyond the station** *(built, October 2026)* | Station space and witnesses; the distress call and police response time; running dark; the police challenge; the transponder as damageable equipment; the distress jammer |
| **2b. Shielded compartments** *(next)* | Company cargo visible to scans where its contents are illegal; compartments fitted for special assignments and kept afterwards; re-registered holds; the weighbridge at strict stations |
| **3. Fleets and conflict** | Escort and recovery contracts; company security ships; rivalry events (a company war as a world event, with blockades and premiums) |
| **3b. Building worlds** | Wexley-Yorozu yards by moons: the Titanoboa constructor, ore haulers, and a station rising through its stages (spine, frame, plating, spin-up) over days for everyone; partly built stations buying what the moon can't supply; construction contracts; opening day. In the shared galaxy, every commander's deliveries speed the build: a community goal that costs a counter on the server |
| **4. Shared galaxy** | Claiming contracts on the server; player witnesses; player-run companies posting contracts |

## Open questions

1. **Company names and characters.** Hexon Holdings and Wexley-Yorozu agreed; Vorg Industries and the Carriers' Mutual proposed. Backstories in [the trading companies](../companies.md).
2. **Deadlines in jumps** rather than real time: agreed?
3. **The exchange for new commanders:** always available (proposed), or unlocked once you've done a few contracts?
4. **The trade computer:** kept as the independent's tool (proposed).
5. **Witness range:** scanner range (4 km close, 12 km far), or one fixed distance?
