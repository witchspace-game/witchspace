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

## 2. The law and your record

| Status | Meaning | Docking at lawful stations |
|---|---|---|
| **Clean** | Nothing on record | Allowed |
| **Offender** | Minor crime | Allowed; a fine is deducted automatically on arrival |
| **Fugitive** | Serious crime (attacking police or stations, murder) | **Refused** (see "Ways out" below) |

- **Records belong to the system where the crime happened** **(proposed)**. You're wanted in Lave, not across the galaxy.
- **Records cool down over time**, faster if you leave the system. We believe the original Elite reduced your record as you jumped between systems; to be confirmed before building.
- **The type of government shapes everything:**
  - *Lawful* (democracies, corporate states): fair fines, strict docking checks.
  - *Corrupt* (dictatorships, feudal worlds): bribes possible; the authorities may "lose" some of your cargo.
  - *Anarchies:* nobody checks transponders or records, and nobody protects you either.

## 3. Ways out when you're wanted

| Option | How | Cost |
|---|---|---|
| **Surrender** | Available **anywhere in a lawful system** from a comms key. Cut your throttle, take your weapons offline and wait. A police Viper flies out, scans you and escorts you in. | Fine; contraband confiscated; record cleared in that system |
| **Pay remotely** | Settle the fine over comms from outside the station | The fine plus a premium |
| **Bribe** | Corrupt systems only | Cheaper; risky; may fail |
| **Run** | Jump to another system, ideally an anarchy | Fuel, time and danger |

- **Surrender is the guaranteed way out. It always works in a lawful system, and it always hurts.**
- **Surrender is not a free escape from a losing fight:** you're exposed until the police arrive.
- **Firing after surrendering** pushes your record to its most serious level, and that system won't accept another surrender from you for a while.

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

## 5. Damage, disabling and capture

*(Built so far: fitted upgrades can be knocked offline (Modern) or destroyed (Classic) by hull hits, 1 in 12 per hit, and are repaired at a station for 30% of their price.)*

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

- **Fuel:** a tank good for about **7 light years**, as in the original (one or two jumps). Docking refuels you.
- **Fuel scoops (an upgrade):** skim close to the star to refuel. Go too deep and you overheat. With scoops fitted, there's fuel in every system.
- **Distress beacon** **(proposed)**: stranded with no fuel and nowhere to dock? Call for help. A tug arrives after a while and tows you to the nearest station that will take you, for a fee, with your record still attached. **In multiplayer, other players can answer**, and being rescued by a stranger could become one of the best social moments in the game.
- **The last resort:** self-destruct. Note that insurance treats this as fraud (section 7).

## 7. Losing your ship: insurance, loans and loan sharks

### Insurance is a product you buy

- **Insured:** you pay a premium each time you launch; losing your ship costs only an excess.
- **Premiums rise** with a poor record. **Fugitives can't get cover.**
- **Exclusions:** insurance is **void** if you're destroyed
  - while Wanted or a Fugitive, or while fighting the police;
  - while committing a crime (attacking clean ships, smuggling);
  - by your own hand (self-destruct is fraud).

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

## 9. Classic rules

Classic stays true to 1984:

- No insurance, no loans, no disabling and no impounding.
- Upgrades hit in combat are **destroyed**, not damaged.
- Touch the station and you die. Lose your ship without an escape pod and it's **GAME OVER**.
- Laws, records, police and fuel still apply. They were in the original.

---

## Open questions

- **Record scope:** per system (proposed) or galaxy-wide?
- **Distress beacon and tug:** confirm, including player rescues in multiplayer.
- **Travel pacing:** is under a minute per jump right, or should it be slower and more atmospheric?
- **Debt ceiling and hunter escalation:** exact numbers to be tuned in play.
- **Lender names:** open to the community.
