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

### How she sounds *(Mark, 29 October 2026)*

A ship's engines have a voice of their own, set in her file (`style.engine`), so she sounds like what she is, to you and to everyone she passes (other ships and commanders in shared space hear it too):

- **drone** (the default): a working ship's gritty hum, the Cobra's.
- **grand**: Zorgon Petterson's Fer-de-lance and her editions. Mark: "It's a very expensive ship so I wanted it to feel expensive." No buzz: a deep, smooth purr from two pure tones beating slowly, and a clean turbine whine that rises with the throttle, near silent at rest. She's composed in a turn (barely a change of breath, her thrusters hardly hiss), and leaving the station her turbine winds up like a good car starting. At a steady throttle she settles to cruise after a few seconds, so a long run isn't a whine. Her weapons match: heavy lasers, a fat sweep down through a closing filter over a deep thump, with a short echo after for a feeling of space (Mark's pick of three; pure ringing tones sounded like tapping a milk bottle). A pulse laser is short, a beam a little longer and higher, a military laser lower and harder. Her missile leaves on a damped rail *thock* and a smooth rising whoosh. Other ships keep the old zap and clunk for now.

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
- **A ship is a statement** *(Mark, 28 October 2026)*. "Nobody wants to buy a semi truck." What pilots save for is a ship that looks the part: beautiful, fast, unmistakably theirs. Hold space isn't the measure of a good ship, because not every commander trades: some build the world around them, and a station owner no longer needs to haul at all. So the hulls you aspire to are the yachts, the hunters and the fast tourers (the flashy yard's line, the Fer-de-lance, an Asp, [Mark Moxon's hunter](ship-moxons-hunter.md)), each the best at something and gorgeous doing it. Big haulers exist for the jobs that need them, but they're work vehicles, not trophies.
- **No step down.** Everyone starts in a Cobra Mk III, and every ship you can buy should feel like a choice of life, not a demotion. Today the Cobra (100,000 Cr) is dearer than the only other hulls flying (Sidewinder 30,000, Mamba 55,000, both built as pirates to fight). A suggestion: make the Cobra the cheap, common starter (about 40,000 Cr), and give the shipyard statement ships above it, from the [shipbuilders](shipbuilders.md)' first new hulls.
- **Trade in** your ship against the next; its value follows its condition ([ship condition](ship-condition.md)) and what's fitted.
- **Second-hand ships with a history:** cheaper, a little worn, and sometimes with a past (a former owner's record, a hidden compartment, a Falcon's old paint under the new).
- **Insurance** follows the ship's value ([law and travel](law-and-travel.md#7-losing-your-ship-insurance-loans-and-loan-sharks)).
- **A hangar:** later, keep more than one ship, berthed where you left it. **Storage at any shipyard, for a fee** *(Mark, 28 October 2026)*: "He could leave her in storage at any shipyard for a fee." Leave a ship you own at a yard, paying a berth fee by the day, and fly another; come back to swap. A stored ship can't be lost in a fight, but the fee runs while she sits, and a yard can sell her off for unpaid fees after a long while. It means a gift or an edition never has to cost you the ship you came in.
- **Collecting a gift: what happens to the ship you came in** *(Mark, 29 October 2026)*. Mark: "Would I get back all the money I spent on extras on my Cobra or do I get to put it in storage?" Until now (`collectOrder` in shipyard.ts) the yard kept her for nothing and her kit (fuel scoops, E.C.M., extra energy, survey scanner) was lost. Mark settled it simply: "it makes sense to sell all the extras in the dock before I go and pick up my new ship unless I want to keep the ship for later on." So the collection screen says plainly what happens to her, before *Take her now*, and you choose one of two:
  - **Keep her in your hangar**, kit and paint as she is, for later. Free. The hangar holds your **fleet** (Mark: "a hangar where you can 'store' your fleet"), every ship you own; the one you fly is the active one.
  - **Let the yard take her.** The yard pays for her kit automatically, at what the dock pays for each item (half its price, as on the Station tab today), so nobody loses kit for not thinking to sell it first. For her hull, the usual trade-in if you bought her; nothing for a free or gifted hull ("not too much, too early").
  - **No listings, offers or dealers** (Mark: "I don't think anyone would buy a second hand ship unless you get a lot of ship for the money"). Signed-over editions are never for sale.
  - **Where the fleet is** (Mark: "You have to go back to your hangar or you pay to get it delivered and it takes game time to arrive"). A ship waits in the hangar where you left her; to swap, fly back there. Or pay to have her delivered to the station you're at: the cost and the time scale with the jumps, as news and orders travel, she arrives with her kit, and the ship's log tells your phone when she's there ("Your Cobra has arrived at Diso"). The Carriers' Mutual, being haulers, are the natural carriers.
  - **Storage is free, for any number of ships** (Mark: "no limit, store as many as you like").
  - **Delivery is priced from the economy** (Mark: "appropriate"): the Carriers' Mutual's haulage rate (contracts.ts), 3 Cr a tonne plus 0.6 Cr a tonne per light year, for her carriage weight (2 t a metre of hull), and 10 minutes plus 12 a light year, the speed news travels. A Cobra over 15 LY: 1,200 Cr and about 3 hours; a Fer-de-lance costs over twice that. Only within the galaxy you're in. An earlier proposal was about 300 Cr and 3 hours a jump.
  - **Built** (shipyard.ts `stowShip`, `swapShip`, `deliverShip`, `deliveriesArrived`; the shipyard's *Your fleet* card; server/src/yard.ts `arrivedMessages` for the phone). Keep is chosen unless you choose otherwise. Your fleet shows each ship, where she is, and *Fly her* (here) or *Have her delivered here* (elsewhere). Her papers (licence, transponder, prizes) stay with you, not the ship; cargo must fit the ship you board.
- **What next, the moment she's yours** *(Mark, 29 October 2026; idea, to mock up first)*. Mark, having collected his Dark Edition 001: "immediately after picking her up there needs to be a mission or something because its deflating to not know what next?" For any new ship, and a gifted edition most of all:
  - **A maiden voyage from the maker.** At the handover the yard (Zorgon Petterson for the Fer-de-lance) offers a first job there and then, suited to her: a shakedown run to a named system and back, a fast high-value delivery, or showing her off at Lave. It pays, and it gets you flying.
  - **Her first moment kept:** the launch from the yard is recorded as a moment, *Her maiden voyage*, ready to share.
  - **Never a blank screen:** the handover ends with one clear next step, flying her with the maker's offer, not just the berth.
- **A wow moment when she's handed over** *(Mark, 29 October 2026; idea, to mock up first)*. Mark: "You should also make sure theres a 'wow' moment". For every new ship, the editions most of all:
  - **The reveal before the paperwork.** The berth lights go down and she lights up section by section in her own glow (the Witch-fire's magenta and cyan, the Dark Edition's black-light lines). Never dimmed: this is where the Neo glow shines brightest.
  - **A slow orbit around her**, as in the trailer's cold open, with the music swelling (the Blue Danube, already in the game). Her name, and an edition's number, appear on the hull.
  - **Then the certificate, then flying her** with the maiden voyage offer.
  - **Kept as a moment, *Her reveal***, ready to share, so every handover can become a post.
  - **Short and smooth on a phone:** about 6 to 8 seconds, with a tap to skip.
- **It makes the news** *(Mark, 29 October 2026; idea, to mock up first)*. Mark: "does it make the news...?" A numbered edition leaving the maker's yard is station news, travelling at the speed of news like everything else: *Zorgon Petterson hands over Witch-fire Edition 004 at Goddard Ring*. Onrira hears first, the neighbours over the following days. Ordinary ships aren't news; editions are.
  - **The owner chooses whether to be named**, as with discoveries. By default the line gives the edition, its number and the yard, never the callsign. At the reveal, one tap, *Let the galaxy know she's yours*, adds "…signed over to Commander X".
  - **Moxon's Witch-fire 001 is never named** unless he agrees to publicity (Mark's rule). Mark's Dark 001 is his choice at the tap, like anyone's.
  - The same event feeds the home page's live feed through /feed, under the same naming rule (Website's side).
  - **Nothing is backfilled, with one exception:** Mark's Dark Edition 001, collected on 29 October before the news existed, is announced once when this is built (Mark: "Announce"). The live test before Moxon's Witch-fire 001. Unnamed unless Mark chooses otherwise.
  - *On file, in case commanders ever trade ships in the shared galaxy:* the yard's price is the floor; an offer says why it's worth more (ready now, kitted out, in the right place, a story), with guard rails: kit never counts for more than it cost, no offer beats building the same ship new at that yard, a place premium of at most about 15% and not for a ship bought in the last week, story value capped (kills count little and on a log scale; firsts, Legends survived, names and an edition's number can't be farmed), and a gifted hull's hull is worth nothing.

## 6. Concepts

Makers show ships before they fly, and the site shows them as **concepts**, with their page, their story and the model turning, before they're in the game ([the Dragonfly](ship-the-dragonfly.md): Halloran Sisters showing off a new hull; Solo & Sons' come as *leaked plans*, since their yard is in hiding). A concept says its class and maker from the start. Community designs submitted through the ship editor ([the community platform](community-platform.md)) appear the same way while people vote on them.

**Something to drool over** *(Mark, 28 October 2026)*. "Just like the real world we should drool over a new design even if it's a 'concept' ship coming soon." A concept is a reveal, like a car at a motor show: it turns in the game's showroom marked *Concept · coming soon* with its expected price, it has its page and share card on the site, and you can open it in the ship editor. Nothing in the game spawns or sells it until it flies. Built: the `concept` flag in the ship file (game dev), with the site's badge, Concepts row and editor label (website). The first is the [Fer-de-lance](#the-fer-de-lance-a-concept).

**Spec it, and put down a deposit** *(Mark, 28 October 2026)*. "I don't think anyone would use our editor. However what they would do is spec out their perfect ship, just like you do when you pre-order or place a deposit on a Tesla." Most pilots won't design a hull, but every pilot wants to spec one. At a shipyard, a concept (or any hull on sale) opens a **configurator**:

- **Its glow:** the hull's colour, from the maker's palette (never the law's liveries).
- **Its name**, painted on: *Halcyon*, *Brass Neck*, whatever you like. Other commanders see it, and so do your clips.
- **Its fit-out:** lasers, shields, cargo bay or a bigger fuel tank, priced as you go, with the total in the corner.
- **Turning in the berth** as you change it, so you see what you're buying.

**A photo booth** *(Mark, 28 October 2026; idea)*: "maybe we should be able to configure the ship in the configurator but have the ship available to scroll around it and choose whatever angles we want and then take a picture. So the configurator but without the hangar in the background." A Photo button in the configurator, and for any ship you own: the panels and the berth go, your ship as specced sits on black or in space, and you turn and zoom freely, low and from behind, with a longer lens than the berth's. Take the picture and it lands in your flight log like a P photo, ready to share. The press studio (dev only) proves the rendering; this is it made friendly, with touch controls on a phone. Every shared picture of "my Dark Edition" carries the game with it.

**The next hull off the line** *(Mark, 28 October 2026)*. "72 hours for a ship of this quality sounds very unrealistic. These ships would take months if not years." So the yard is always building: a maker lays down hulls months ahead, and your deposit buys the next one off the line. The wait is the yard finishing her to your spec (your fit-out, your colours, your name, the glow tested): three days for an ordinary order, about five for the Witch-fire Edition and a week for the Dark Edition, each finished by hand.

**A repaint at any yard** *(Mark, 28 October 2026)*. The ship you fly can be repainted at any shipyard, while you wait: a new colour, glow and trim, seen in the berth before you pay. It costs the yard's labour (a tenth of the hull, at least 2,000 Cr, and half as much again at Blazing: about 18,000 Cr on a Fer-de-lance; Mark: "a paint job on a Fer-de-lance at that kind of money would be more than 5,400") and whatever of the finish changes, priced as in the configurator; what she already has is free. Her name, her edition number and what's aboard stay. An edition's own colours stay with that edition: its owner can repaint out of them and back, nobody else can have them.

Then you **place a deposit** on a concept: a tenth of the price, refundable until it ships. It holds your build slot, and when the concept flies the deposit-holders get theirs first, built to their spec, at the price they were quoted. Pre-orders show on its page ("214 commanders are waiting"), which is the hype, and the order of your deposit is a bragging right. Hulls already flying are configured and bought outright, when shipyards sell.

**Built** *(28 October 2026)*: the configurator, deposits, production in stages, collection with a trade-in, and ships you own (your hull and its paint, insured as yours). Colours are named for our galaxy (Lave Dusk, Riedquat Ice, Xeer Ultraviolet, Tibedied Coral and the rest), five included and five that cost. An edition's own colours are its alone *(Mark)*: Witch-fire and Orerve Nebula can't be ordered on any other ship; a Witch-fire owner who wants another colour asks the maker, or orders a ship of their own in the configurator.

**Special editions** *(Mark: "the specials should be just that, and numbered")*: a set spec nobody configures but for the name, numbered and limited, at a premium. The first is the *Witch-fire Edition* of the Fer-de-lance: Orerve Nebula with the glass deck lit in Witch-fire, Blazing, a hundred to be built. The server hands out the numbers in order, one per account (an edition voucher holds its number the moment it's made); a cancelled order gives its number back.

**By invitation** *(Mark, 28 October 2026: "If you have to ask... you can't afford the special editions. For now they are invite only to contributors.")*. Nobody reserves a special edition at the counter. The yard shows each one (her look in the berth, how many of the run have been signed over, "By invitation" where the price was), and the configurator lets anyone spec and share one, but numbers go out only by our hand: a contributor's edition is **given**, signed over to their email at the maker's yard (or by voucher), with the edition's look, beam lasers front and rear and a combat computer, as Mark Moxon's 001 (Mark chose given over invited to buy). The server refuses a number to anyone who doesn't already hold one, and a number goes back only through the yard's office (`tools/editions.ts revoke`).

**Gift vouchers** *(Mark)*: a one-off code (`tools/voucher.ts`), redeemed at any shipyard by a signed-in pilot. A gift is the hull as it leaves the yard: an included colour and a name, nothing that costs, because a fully loaded statement ship early on would spoil the game, and it would sell for a fortune. So a gift can't be cancelled, and in part exchange the yard pays for its kit only, never the hull. The first is for Mark Moxon *(Mark)*: the Witch-fire Edition **001**, named *Moxon*, held for his voucher (`--edition witch-fire`), in the edition's colours, with beam lasers front and rear and a combat computer *(Mark)*, ready the moment he redeems it; the rest of the kit he earns. Numbers are painted quietly, as 001 (Mark), not "No. 1".

**Signed over, not a code** *(Mark, 28 October 2026: "I dont want a redeeming code as that is a bit rubbish. This is already paid for and the shipyard just needs to sign it over")*. A ship can be held for a commander's email address instead: `tools/voucher.ts gift <ship> <email> --at <system> [--edition <id> --number <n>]`. It attaches to their account the moment they sign in (at once, with a notification, if they already have one), and the maker writes to them in the game. She waits at **one yard, the maker's own**, so they fly their Cobra there to take her (Mark: "That way he has to at least fly the cobra a couple of times"). `--number` takes over the unused voucher holding that edition number, so Mark Moxon's Witch-fire 001 has one route: signed over at Onrira, Zorgon Petterson's home yard, three jumps from Lave.

**A docking computer as standard** on a hull of real calibre (150,000 Cr and up: every Fer-de-lance), fitted at no charge, as the beam laser is (Mark: "Make sure all Fer de Lance ships have the docking computer as standard"). The Witch-fire's premium took up the 2,700 so she stays at 468,380.

**The edition delivery pack** *(Mark, 28 October 2026: "yes do it")*. A contributor given a numbered edition gets a proper handover, every fact read from the game's data (`src/game/papers.ts`) so nothing can disagree. What a given edition carries is the gift's fit-out: her edition's whole look and luxuries, beam lasers front and rear, a docking computer and a combat computer, not the edition's catalogue kit.
- **Her papers, private by link** *(Mark: "only with its link")*. Each number has a random token, and her build certificate lives at `witchspace.org.uk/ships/<ship>/<edition>/<no>/#t=<token>` (the site's page: [edition certificate](edition-certificate.md)), from `GET /shipyard/papers/<edition>/<no>?t=`. Without the token you only learn whether a number is signed over, so nobody can list who holds what. Her owner gets the link back from `/me/editions`; the yard's office can issue a new one.
- **The maker's letter**: an email from the maker, in the edition's colours, sent once when she's signed over, with the link. `tools/voucher.ts papers <edition> <no> --send` sends it (again), `--callsign` sets the name it's addressed to before they have an account, `--reissue` makes a new link.
- **The handover**: taking her shows the certificate full screen, her name written in, with Fly her, Share her and Keep her papers. Her name and "in service" reach the certificate from her owner's cloud save.
- **The manual, made hers**: her own cover ("prepared for Commander …") and a Your edition page, with the link to her papers.

**A Dark Edition** *(Mark, 28 October 2026; idea)*. "I wonder if we could build a dark edition. I imagine that would be a challenge given we are in a Neo universe." It is, because the glow is the signature and a hull is never dimmed. So it's dark by palette, never by dimming: deep ultraviolet lines at full glow strength, faces near-black, a single white canopy; or a hull that glows low at rest and flares when it boosts or fires. It would sit beside running dark (the transponder off) as the ship for pilots who'd rather not be seen. (Shaped with the Marketing session's thoughts.) **Built** *(Mark: fifty of them)*: the second numbered edition. Black-light lines (its own colour, edition-only) at Deep glow over the dark faces every hull has, a white-hot canopy, beam lasers front and rear, a combat computer, docking computer, E.C.M., distress jammer and escape pod, the owner's suite, a ship's voice, and two luxuries only she has (Black-light running lights; an instrument-lit cabin): 950,000 Cr (Mark: "make it 950K with two new Dark-only luxuries", and both the rear beam and the combat computer, as on Moxon's 001), fifty built, dearer than the Witch-fire because rarer. The "glows low at rest, flares on boost" version is a later step.

**Her running lights, and the full ghost** *(Mark, 28 October 2026: "oooh! full ghost sounds really cool"; built)*. The Black-light running lights are real, and a statement, not an edge: small violet lights at her wingtips and tail, pulsing slowly, seen only within about a kilometre. Running dark, she's an unidentified ship like any other, and her lights stay dark until you're close enough to read her hull (2 km); then they fade in, and you realise what she is. Other commanders see them too in shared space. The owner can switch them off on the Station tab ("Go full ghost"): just the hull. Nothing dims; the lights are added on top of her lines. They're drawn wherever she's drawn in her paint: in flight, the berth, the photo booth, the kill cam and the site (`Look.lights`, from `buildPainted`). 1984 mode shows the hull alone.

This is where Build meets most pilots. The few who design hulls do it in their own tools or with an AI assistant ([ideas](../ideas.md)), and their ships end up in this configurator for everyone else.

### The Fer-de-lance, a concept

*(Mark, 28 October 2026: "Build it in the Neo for Witchspace.")* A statement ship: a private hotel with a fighter's bones. A lance-head hull twice a Cobra's length (118 m), a glass deck along its spine, two barbs swept back past the tail, 30 t of hold, about 180,000 Cr. Original geometry; its size, hold and character come from Samuel Penn's Traveller sheet. Its maker is Zorgon Petterson, the fast and flashy yard, keeping its 1984 name as homage ([the shipbuilders](shipbuilders.md)). It beats a Cobra at almost everything, as a statement ship should; what it costs is the price, and being the biggest, most tempting target in the sky.

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
