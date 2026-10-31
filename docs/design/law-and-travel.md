---
title: Law, travel, debt and capture
status: building
pillar: fight
summary: Transponders, the law, surrender, getting caught, disabling and capture, fuel and rescue, insurance, loans and loan sharks, the Co-operative Marshals, and travel pacing.
card: viper
stages:
  - Transponders, records and running dark | built
  - Surrender, insurance and the Marshals | built
  - A Marshals career for Dangerous commanders, and a Lancer of your own (see marshals-career.md) | proposed
  - Warrants at the speed of news, and fines that fit the crime | proposed
  - Disabling, capture and boarding | proposed
  - Loans and loan sharks | proposed
  - Ship registry and flags | proposed
help:
  - Write a loan shark: their terms, and what happens if you miss a payment | writing
  - Playtest getting caught and tell us if it felt fair | playtest
---

# Design: law, travel, debt and capture

*Status: agreed design, not yet built. It belongs to the **trading and galaxy** milestone. Items marked **(proposed)** haven't been confirmed yet; please discuss them in GitHub Discussions before building.*

This document describes how crime, punishment, travel, ship loss and debt fit together in Witchspace. It applies to **Modern rules** unless stated otherwise. **Classic rules** stay true to the 1984 original and are covered at the end.

## The guiding principle

> **Every hard situation needs at least one way out, even if it's expensive or humiliating.**

Being refused docking, running out of fuel, losing your ship or falling into debt should create *hard choices*, never a dead end where the only option is to stop playing.

---

## 1. Identity: transponders and police markings

- **Every ship broadcasts a transponder:** ship type, role (trader, miner, police, pirate…), registration, commander name and legal status. The target readout shows it, e.g. `COBRA MK III · TRADER · CMDR JAMESON · CLEAN`.
- **Police markings can't be faked.** Police beacons, the hull band and police transponders are issued by the Galactic Co-operative and keyed to the police role. They can't be bought, copied or painted on, in any system, however corrupt. *(Built: livery is applied by the game to the `police` role and can't be declared in ship files.)*
- **A second-hand Viper is just a Viper.** No beacons, no police transponder.
- **Running dark.** You can switch your transponder off. Smugglers will want to, but an unidentified ship is suspicious in itself: police treat it as hostile and lawful stations won't let it dock.
- **Multiplayer:** the server decides who is police. Players can never choose to appear as police.
- **Callsigns and rank insignia** *(built, shared space)*: other commanders are known by a tag: rank insignia, callsign and range, e.g. `◆◆ CMDR Moxon · 0.8 km`. You choose your callsign and can change it at a station.

### Ship registry and flags

Like real ships, every ship is **registered** in a system: its **flag**. The registry is part of the transponder and shows as that system's **crest** beside the callsign.

- **Crests from the seed.** Each system's crest (shape, colours, a symbol for its economy or government) is generated from its seed like everything else, so every system in all eight galaxies has its own badge.
- **Locals and foreigners.** In the system you're registered in you're a local. Anywhere else you're a foreign ship: scanned more often, charged docking fees and import tariffs (in the local currency; see [system currencies](system-currencies.md)), and last in line for some local contracts. Unregistered ships are foreigners everywhere, and draw the most attention.
- **Registering.** At any station, for a fee that depends on the government; a new commander is registered where they start. Changing your flag takes time and paperwork, so it's a decision rather than a trick.
- **Flags of convenience.** As at sea: register in a corporate state for low tariffs and a respectable flag, or in an anarchy where nobody asks questions, and live with what that flag says about you. Some governments refuse to register ships with records; others will register anyone.
- **Team insignia.** Guilds and wings get an insignia of their own beside the crest, issued by the server so nobody can wear another team's badge. Needs accounts.
- **Classic rules:** no registry, as in 1984.


## 2. The law and your record

| Status | Meaning | Docking at lawful stations |
|---|---|---|
| **Clean** | Nothing on record | Allowed |
| **Offender** | Minor crime | Allowed; a fine is deducted automatically on arrival |
| **Fugitive** | Serious crime (attacking police or stations, murder) | **Refused** (see "Ways out" below) |

- **Ordinary crimes are local:** your record belongs to the system where the crime happened. You're wanted in Lave, not across the galaxy.
- **Serious crimes become galaxy-wide, at the speed of news:** attacking stations, killing clean ships, or crimes beyond the local police's reach produce a **Co-operative Marshals warrant**. Today it follows you into every Co-operative system at once; Mark has decided it should spread system by system as news does, with the Marshals following your trail (see [warrants travel at the speed of news](#warrants-travel-at-the-speed-of-news-mark-31-october-2026) below).
- **Records cool down as you travel.** *(Built: each hyperspace jump away counts. An Offender record clears after 2 jumps; a Fugitive record cools to Offender after 6. Tune these in `src/game/law.ts`.)*
- **The type of government shapes everything:**
  - *Lawful* (democracies, corporate states): fair fines, strict docking checks.
  - *Corrupt* (dictatorships, feudal worlds): bribes possible; the authorities may "lose" some of your cargo.
  - *Anarchies:* nobody checks transponders or records, and nobody protects you either.

### Warrants travel at the speed of news *(Mark, 31 October 2026)*

Mark: *"It doesnt feel fair to have a warrant issued that is immediately galaxy wide thats not how information travels."* Proposed, not built; it replaces today's instant galaxy-wide warrant.

- **Where the crime was, at once:** the local police and the station saw it. The protected starter systems stay protected.
- **Everywhere else, as news:** the warrant spreads at the game's news delay (`newsDelay` in `src/economy/events.ts`: 10 minutes, then 12 more for every light year), reaching each system's police, its news board and opted-in bounty hunters ([become a Marshal](marshals-career.md#warrant-alerts-on-your-phone-mark)). Once heard, it stays on record there.
- **The Marshals follow your witchspace trail** rather than knowing everywhere: they arrive a set lag behind each jump (about 3 minutes, to tune). Dock or stop, and the rift opens. Running dark, or reaching an anarchy, cold-trails them; the news still spreads.
- **A chase, not a teleport:** a Fugitive can outrun the news for a while, but not the Marshals on their trail, and every system the news reaches is closed to them.
- **Calculated, not simulated:** the crime's time and place give each system's arrival time, and the last jump plus the lag gives the Marshals'. One row per warrant.

### Friendly fire *(Mark, 30 October 2026; built)*

Mark: "when you are in combat and a police viper flies in front of you and it catches a laser shot you immediately become a fugutive!" Under Modern rules, in a fight (pirates about, or anyone after you), the first stray hit on a police or company security ship is forgiven: it radios "Check your fire, Commander!", and a burst that clips it counts once. Hit it again within 30 seconds, hit one with no fight on, or hit a ship you've locked a missile on, and it's a crime as before. Destroying one always counts. Classic keeps 1984's rule.

## 3. Ways out when you're wanted

| Option | How | Cost |
|---|---|---|
| **Surrender** | Available **anywhere in a lawful system** from a comms key. Cut your throttle, take your weapons offline and wait. A police Viper flies out, scans you and escorts you in. | Fine; contraband confiscated; record cleared in that system |
| **Pay remotely** | Settle the fine over comms from outside the station | The fine plus a premium |
| **Bribe** | Corrupt systems only | Cheaper; risky; may fail |
| **Run** | Jump to another system, ideally an anarchy | Fuel, time and danger |

- **Surrender is the guaranteed way out. It always works in a lawful system, and it always hurts.**
- *(Built, first pass: U surrenders anywhere with a government. The ship brakes to a stop by itself, then the escort arrives 5 seconds later; firing or throttling up just withdraws the surrender (forgiving by design: an accidental touch of the throttle mustn't earn a warrant). You pay the fine, the contraband is confiscated and your record here is cleared. You can also settle the same way at the desk of any station that lets you dock. Fines are cut to your means: never more than half your credits above a new commander's 100 Cr stake, so a commander who has just lost everything isn't buried in debt. Being caught, a later stage, will cost the full fine, and impound your equipment if you can't pay. Docking as an Offender settles the fine automatically, and lawful stations inspect your hold. Fugitives are refused docking wherever transponders are checked, which means everywhere but anarchies and feudal worlds. Police in those systems scan nearby ships for contraband.)*
- **Surrender is not a free escape from a losing fight:** you're exposed until the police arrive.
- **Firing after surrendering** pushes your record to its most serious level, and that system won't accept another surrender from you for a while.

### Scanned on the way out *(idea, Mark, 29 October 2026)*

Mark: "the station scans you on the way out and on the way in. So if you buy some dodgy stuff from the backroom and launch you immediately get flagged by the police don't you?" Not yet, and that's a loophole: the police's proximity scan happens once per visit to a system (`scanned` in main.ts, reset only when the system's scene is built), lawful stations inspect the hold on docking, and nothing checks on launch. So a commander can arrive clean, be scanned clean, buy contraband in the back room and fly out unseen.

- **A departure scan** where cargo is scanned (governments of 2 and up), as you launch, by the same rules as the inspection on docking.
- **Counterplay**, so the back room stays worth the risk: the hidden compartment (built); a trusted contact who gets you out quietly or tips you off ([faces in the back room](markets-and-trade.md#faces-in-the-back-room-idea-mark-29-october-2026)); running dark, with its own risk; a bribe in corrupt systems.

## 4. Getting caught: what you lose

**Handing yourself in is treated more leniently than being caught.**

| How it ended | Fine | Contraband | Weapon upgrades | Civilian equipment |
|---|---|---|---|---|
| **You surrendered** | Yes | Confiscated | Kept | Kept |
| **Police disabled you** | Larger | Confiscated | **Confiscated** (used in the crime) | Kept |
| **You can't pay the fine** | (unpaid) | as above | as above | **Impounded** until paid |

- **Confiscated** = gone for good.
- **Impounded** = held at the station. Pay the fine within a time limit to get it back; after that it's sold.
- **Civilian gear** (docking computer, fuel scoops, escape pod) is never confiscated. It didn't commit the crime. It's only impounded if you can't pay.
- If impounding everything still doesn't cover the fine, the remainder becomes **debt** (see section 7).

### Fines that fit the crime *(Mark, 31 October 2026; proposed)*

Today a murder costs at most 1,500 Cr (a Fugitive's 500 and a warrant's 1,000, in `src/game/law.ts`), and never more than half your spare credits: too cheap to stop a killer in lawful space.
- **Murder costs a share of your wealth, your ship included** (10–20%, with a floor). The new commander's 100 Cr stake stays protected.
- **Repeat offences double.**
- **Part of the fine goes to the victim.**
- **A murder warrant is settled only with the Marshals,** at a Co-operative station or the Bastion, and not where the news hasn't arrived.
- **Surrendering holds your ship** for real minutes as well as the fine; being caught stays ×1.5.

## 5. Damage, disabling and capture

*(Built so far: fitted upgrades can be knocked offline (Modern) or destroyed (Classic) by hull hits once the hull is below half, 1 in 12 per hit and at most one every 10 seconds, and are repaired at a station for 30% of their price.)*

- **Core systems can be hit, not just upgrades:** main engines, manoeuvring thrusters, shield generator, lasers and witchspace drive. Below about **25% hull**, hits are much more likely to reach them.
- **Damage comes in stages:** a hit engine limps at half speed; damaged thrusters turn sluggishly; a hit witchspace drive can't jump.
- **Disabled:** lose both the engines and the thrusters and the ship drifts, unable to flee.
- **Field repairs:** a damage-control routine can get a system limping again, but it takes about 20 seconds, and you're a sitting duck while it runs.
- **What happens next depends on who disabled you:**
  - **Police** prefer to **disable and arrest** rather than destroy, unless you keep fighting back. Arrest counts as being caught (section 4).
  - **Pirates** demand your cargo: "Dump it and we'll let you live."
  - **Bounty hunters working for loan sharks** want you **alive**, because the sharks pay more for a debtor they can make an example of. You're towed to the sharks' station to pay or work it off.
  - **Nobody around:** fire the distress beacon (section 6).
- **It works both ways.** Disable a pirate and you can take its cargo, or hand it to the police for a better bounty than a wreck would earn. Skilled pilots aim for engines.
- **Modern rules only.** Classic has no disabling (see the end).

## 6. Fuel, rescue and never being stranded

**The station fills your tank as you dock** *(Mark, 27 October 2026: "it's a bit tiresome having to always go to the station tab and refuel. If you forget you have to dock again!")*. Under Modern rules docking refuels you as far as your credits go, and says so (*Refuelled · +3.5 LY · 7 Cr*). Fuel is 2 Cr a light year, a full Cobra tank 14 Cr at most, so the chore was the only real cost. *(Built.)* Classic keeps 1984's pump on the Station tab.

- **Fuel:** a tank good for about **7 light years**, as in the original (one or two jumps). Docking refuels you.
- **Fuel scoops (an upgrade):** skim close to the star to refuel. Go too deep and you overheat. With scoops fitted, there's fuel in every system.
- **Distress beacon** **(proposed)**: stranded with no fuel and nowhere to dock? Call for help. A tug arrives after a while and tows you to the nearest station that will take you, for a fee, with your record still attached. **In multiplayer, other players can answer**, and being rescued by a stranger could become one of the best social moments in the game.
- **The last resort:** self-destruct. Note that insurance treats this as fraud (section 7).

## 7. Losing your ship: insurance, loans and loan sharks

### Insurance is a product you buy

*(Built so far: everyone is insured, with no premiums yet. A claim costs an excess of a tenth of the kit's value (at least 250 Cr), but never takes you below a new commander's 100 Cr stake: whatever you can't pay is written off. The new ship comes with a full tank. Everything on the new ship works, even kit that was damaged before (a broken transponder must not follow you into the next fight), and your record stands. Stations that check transponders (everywhere but anarchies and feudal worlds) won't clear a ship to launch without a working one: a broken transponder is repaired before launch for the usual repair price, or free if you can't pay, and a switched-off one is switched on. Where nobody checks, you may launch with a broken one, and the station logs your hull so the police there don't hail you. Fugitives aren't covered and get a bare Cobra (pulse laser, no upgrades), unless an escape pod saves their kit; the Co-operative tops them up to the 100 Cr stake. Losing the hold is the real cost, and it's enough. Since shipyards build to order, you get your own hull back in its paint; a hull dearer than a Cobra adds a twentieth of the difference to the excess, and a Fugitive without a pod loses it ([ships, classes and makers](ships-and-classes.md#5-buying-selling-and-owning)).)*

- **Insured:** you pay a premium each time you launch; losing your ship costs only an excess.
- **Premiums rise** with a poor record. **Fugitives can't get cover.**
- **Exclusions:** insurance is **void** if you're destroyed
  - while Wanted or a Fugitive, or while fighting the police;
  - while committing a crime (attacking clean ships, smuggling);
  - by your own hand (self-destruct is fraud).
- **How the insurers know: your flight recorder.** A claim is paid when you submit the recorder, and the assessors decide on what it recorded. If it isn't recovered, they pay half until it is, and you can go back for it ([the flight recorder: the claim](flight-recorder.md#the-claim-submit-your-recorder-mark-25-october-2026)).

### When insurance doesn't pay

| | **The bank** | **The loan sharks** |
|---|---|---|
| Where | Stations in lawful systems | Back rooms in corrupt and anarchy systems |
| Needs | A clean record, good credit history | No questions asked |
| Interest | Modest | Brutal |
| Missed payments | Credit rating falls; eventually the ship is repossessed | Warnings, then penalties, then **bounty hunters** |

- Fight the police and lose, and the insurer won't pay and the bank won't lend to a criminal. **That leaves the sharks.**
- **Bounty hunters** start appearing in systems you visit after a few missed payments, more and nastier as the debt grows. They fly unmarked, often second-hand ships, so you can't tell who's hunting you until they open fire.
- **Ways out of debt:** pay up, hide in anarchies where the sharks' reach is weaker, or fight the hunters off, which means fighting your own debt.
- **Multiplayer:** players can take the sharks' contracts as bounty hunters.
- **Lender names** must be original (no names from the Elite novels). Placeholders: *Merrow & Daughters* (bank), *the Vane Syndicate* (sharks). Better names welcome.

### The safety net

- **A basic ship is always available.** The Galactic Co-operative will always provide a bare Cobra with no upgrades. Loans are for anything *better*, never for getting back into space at all. Your record still follows you.
- **Debt has a ceiling**, and hunter pressure rises gradually, so a struggling player has time to earn their way out.
- **Bankruptcy** is the final reset: you lose your ship, equipment and credits but keep your name and combat rank, and your debts are cleared.

## 8. Travel pacing

The aim: **under a minute per jump, start to finish, and something worth your attention on arrival** **(proposed pacing)**.

1. **Charge the jump drive: about 10 seconds.** Nearby ships block it (mass lock), so you can't jump out of a fight at point-blank range.
2. **The witchspace tunnel: a few seconds.**
3. **Arrive a short way out**, then use the **J in-system jump** (as in the original) to cover most of the distance to the station in seconds, unless you're mass locked.
4. **Arrival encounters** keep it interesting: pirate ambushes, drifting cargo, distress calls, police scanning your transponder, ships fleeing someone. These are ideal community contributions.

A run to an outlaw system several jumps away should be **a few tense minutes**, not half an hour of cruising.

## 9. Power and protection

What happens when a heavily armed veteran arrives somewhere poor and low-tech? **Against the locals (NPCs), let it be fun:** pirates flee, traders ask for escorts, governments offer work. **Against weaker players, the world pushes back**, through logistics, law and response rather than invisible rules.

### Two tiers of law enforcement

| | **System Police** | **Co-operative Marshals** |
|---|---|---|
| Who | Each world's own force | The Galactic Co-operative's own law enforcement, everywhere in Co-operative space |
| Ships | Vipers: cheap, fast, numerous | Heavier advanced interceptors and patrol cruisers (original designs; a good community contribution) |
| Jurisdiction | One system | Every Co-operative system; their warrants follow you across the galaxy |
| Strength | Varies with government and tech level | Always strong |
| They handle | Day-to-day crime | High-threat ships, serious crimes, organised crime and pirate gangs, Thargoids |

- **Unforgeable markings:** Marshals have their own livery and transponders (working idea: a gold band and white beacons), issued under the same rule as police markings (section 1). A system's police can be corrupt; the Marshals are meant to be incorruptible.
- **Anarchies:** Marshals don't patrol there, though they may go in after their most-wanted.
- **Joining them:** the galaxy's best pilots can become Marshals, with a Lancer of their own and warrant alerts on their phone: see [become a Marshal](marshals-career.md) (Mark).

### The response scales with the threat

- When a crime is beyond the local police, they **call in the Marshals**, who arrive after a delay: **sooner and stronger the bigger the threat**.
- **How they arrive (built, Modern rules):** a commander with a warrant is hunted by a **Bastion** carrier (805 m) with a wing of eight **Lancer** interceptors (46 m). It comes through a **witchspace rift** about 3 km across that opens some 9 km away. First a far-off flicker, then a dark hole with a thin, cool rim, space visibly bending around it, and a building drone for about half a minute. Then the carrier slides slowly out side-on while the rift closes around it, shutting as the stern clears. There are no bangs (this is space): just a groan as it comes through and a soft inhale as the rift shuts.
- **Rifts affect ships:** an open rift fills scanners with static for kilometres around, makes contacts jitter and blocks missile locks. Within about 6 km it pulls you towards it (at most half a Cobra's top speed, so you can always escape) and shakes the ship. Inside the mouth it tears at your shields and hull. The rift is marked on the HUD and never mass-locks you, so a commander who reads the signs can jump out first.
- **The carrier:** it circles at a 3 km stand-off and launches Lancers in pairs, at most four out at once, keeping the rest as replacements. It leaves through a rift of its own when the warrant is cleared, when its wing is gone, or when it's badly hurt. A destroyed Bastion takes any Lancers still aboard with it and spills its alloys (stolen goods, if you did it), and each one destroyed brings the next carrier sooner. If they destroy you, they stand down; still wanted when you relaunch, and another comes. Flying into it is fatal: a collision with anything five times your ship's weight destroys you.
- **Bounties grow with the gap in power.** Killing a much weaker commander earns a far bigger bounty than killing an equal, which makes a bully a target for every bounty hunter, including other veterans.
- Insurance won't pay out for criminals (section 7), so a bully who's eventually caught loses a very expensive ship.

### Logistics: advanced gear needs advanced support

- **Repairs and spares need tech.** A low-tech station can patch your hull but can't service a military beam laser or advanced shields. Damaged high-tech gear stays damaged until you return to civilised space (see [stations and worlds](stations-and-worlds.md)).
- **Power and fuel:** high-end weapons draw heavily on energy and fuel, and low-tech systems sell lower-grade fuel (shorter jumps, slower recharge).
- A heavily armed ship *can* visit, but its advantages wear down the longer it stays away from support.

### Weapons licences and no-fire zones

- **Military-grade weapons must be licensed** in lawful systems. Your transponder declares what you carry; unlicensed heavy weapons are an offence on arrival. Low-tech lawful worlds may ban some weapon classes outright; corrupt ones take bribes.
- **No-fire zones around stations:** firing near a station brings its own defences into play, which hurt even top-end ships.
  *(Built so far: hitting a station brings one warning and an Offender record, then Fugitive if you keep firing. Under Modern rules a line-of-fire safety holds your lasers when the station is in the way, unless you hold the trigger for 1.5 seconds; under both rules lasers are locked while the docking computer flies.)*

### The station defends its approach *(Mark, 27 October 2026)*

After Mark was shot down by pirates at Raoror while his docking computer flew him in, unable to fire back:

- **Under fire, the docking computer hands you the stick:** "Under fire · docking computer off · you have control", so you can fight, run or fly yourself in. Everywhere, anarchies included. *(Built, Modern rules.)*
- **In a lawful system, a pirate that fires within the station's 5 km safe zone brings its police out at once** (two Vipers from the slot, up to the usual four), and **inside 2 km the station's own guns fire on it** until it stops shooting. A station kill earns you nothing. *(Built, Modern rules.)*
- **Anarchies stay lawless:** nobody comes, and the docking computer there is a risk worth knowing about. Raoror, where it happened, is an anarchy.

### Protected starter systems

- A few **core systems around the starting stations** have much heavier patrols, a permanent Marshal presence and harsher penalties, so newcomers can learn without being farmed. Veterans can visit and trade; they just can't hunt there without serious consequences.

### The upside

A powerful commander in a poor system can be a **force for good**: escorting convoys, clearing out pirates, bringing in high-tech goods that sell at a premium. Their power becomes a story, not just a threat.

## 10. Classic rules

Classic stays true to 1984:

- No insurance, no loans, no disabling and no impounding.
- Upgrades hit in combat are **destroyed**, not damaged.
- Touch the station and you die. Lose your ship without an escape pod and it's **GAME OVER**.
- Laws, records, police and fuel still apply. They were in the original.
- Only local Vipers enforce the law: no Marshals, licences or threat-scaled response.

---

## When it's built: keep it organised *(Mark: "keep organised and file size controlled")*

The law will grow (warrants that travel, fines that fit, notoriety for [the pirate's career](pirate-career.md)). It grows in its own folder, not in big files: `src/game/law.ts` becomes `src/game/law/` (`fines.ts`, `warrants.ts`, `notoriety.ts`); on the server, warrants and their alerts are their own module (`server/src/warrants.ts`, beside `push.ts`), not more of `accounts.ts`; and `main.ts` stays wiring only.

## Open questions

- ~~**Record scope:**~~ settled: ordinary crimes are local; serious crimes become a Marshals warrant, which spreads at the speed of news (Mark, 31 October 2026).
- **Marshals:** how arrival time and strength should scale with the threat (today: one carrier per warrant, sooner for each Bastion destroyed); a response to "traders attacked" headlines.
- **Distress beacon and tug:** confirm, including player rescues in multiplayer.
- **Travel pacing:** is under a minute per jump right, or should it be slower and more atmospheric?
- **Debt ceiling and hunter escalation:** exact numbers to be tuned in play.
- **Lender names:** open to the community.
