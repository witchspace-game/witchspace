---
title: The pirate's career
status: proposed
pillar: fight
summary: The other side of Fight. Your bounty is your rank, robbery beats murder, the Solos judge how you pirate and not how much, and the road runs from a Cobra running dark to a Falcon of your own, or, for those who prove themselves, back to a clean record.
card: mamba
stages:
  - Notoriety as the bounty on your head, and the pirate's ranks | proposed
  - Robbery between commanders, the pirate's hail in shared space | proposed
  - The Solos' trust, judged son by son, and a Falcon of your own | proposed
  - Going straight, recruited or captured, under a cover name | proposed
help:
  - Write how each Solo son reacts to what you've done, in a line or two of radio | writing
  - Playtest robbing and being robbed, and tell us whether paying up felt like the smart choice | playtest
---

# Design: the pirate's career *(Mark, 31 October 2026)*

**Marshal or pirate: the two sides of the same skill.** Mark: *"Pirate should probably be a branch of fight. The bounty should reflect the rank. Higher rank equals higher bounty."*

Nothing here is built yet; it comes after launch. Its other half is [become a Marshal](marshals-career.md); the law both live under is [law, travel, debt and capture](law-and-travel.md); the Solos and their Falcon are [the Falcons, a Legend](legends-the-falcon.md).

## Where piracy stands

**Built:** running dark (an unidentified ship until your hull is read); preying on traders and company haulers and scooping what spills; the back room, where a fence takes stolen goods at about 60% (anarchies don't ask); the shielded compartment; and shared space, where a kill in lawful space makes you a Fugitive and in an anarchy nothing.

**Missing:** a ladder, a rank, a ship of your own, a home, and anything to aim for. Robbery and murder are the same act (shoot, scoop), so the cruellest pirate earns the same as the cleverest. Combat rating gives no points for crimes, by design. Every other career has a ladder; piracy doesn't.

## 1. Your bounty is your rank

Pirates don't earn combat points: they earn **notoriety**, and notoriety *is* the bounty on your head. It's the pirate's scoreboard, readable on any scanner tag: `CMDR Vex · Wanted · 12,000 Cr`. It's also exactly what bounty hunters are paid, so the bigger the pirate, the more hunters come.

| Bounty | Rank |
|---|---|
| up to 1,000 Cr | **Chancer** |
| 10,000 Cr | **Raider** |
| 50,000 Cr | **Corsair** |
| 200,000 Cr | **Free Captain** |
| beyond | **Known to the Solos** |

**It rises with daring:** robbing a well-escorted convoy, running a Marshals blockade, taking Wexley-Yorozu or Hexon cargo, escaping the Bastion. **It barely rises for easy prey:** robbing newcomers, or killing someone who'd already paid.

## 2. Robbery beats murder

- **The pirate's hail works between commanders:** *"Cut your engines and drop your cargo"*, the hail the computer's pirates already use. Drop some cargo and the pirate scoops it.
- **Paying makes it robbery** (Offender), not murder. The pirate earns notoriety, and the target lives to tell the story.
- **Kill only if they refuse.** Killing someone who paid counts against you, and the Solos hear of it.
- **With disabling and capture** ([law and travel](law-and-travel.md), section 5) or the Shrike's clamp: stop a ship, take what you want, leave it drifting.

## 3. The Solos' code

The way to a Falcon is **how** you pirate, not how much: never kill someone who paid; leave the Carriers' Mutual alone; don't prey on newcomers.

**Each son judges by his own lights:** Bram likes it when you hit Wexley-Yorozu; Jory when you leave food alone, or bring it to the forty-one; Kit when you fly well; Tobin doesn't care, and that's a trap.

**Griefing newcomers closes it for good.** Murdering new commanders in shared space ends any chance with the Solos. That's the line that makes piracy a career rather than griefing.

## 4. Ships, guns and home

1. **A Cobra, running dark.**
2. **A Sidewinder or a Mamba,** from a lawless yard, once yards sell hulls outright.
3. **A Falcon,** with the Solos' trust: earned, never sold, as the Marshals' Lancer is ([ships, classes and makers](ships-and-classes.md#4-earned-not-bought)).
4. **Home:** the anarchies and feudal worlds and their back rooms, and later the frontier stations run by guilds. Whether pirates ever hold a station of their own is open (Mark).

**Arming up fast** *(Mark: "They would rank up their ship quickly with bigger lasers")*. It should feel good; the cost is where the guns come from.
- A Fugitive can't refit at lawful stations, so the guns come from black markets: dearer, less choice, no warranty. Quick money from the fence, expensive guns: pirates live fast and can lose everything.
- Military weapons need a licence in lawful systems, and visible hardpoints make a heavily armed ship look dangerous ([law and travel](law-and-travel.md), section 9).
- High-tech kit needs high-tech repairs: damaged military lasers stay damaged on the frontier.
- Bounties grow with the power gap, so a heavily armed pirate preying on Cobras becomes the most valuable target in the galaxy; no kill points two ranks down; the starter systems stay protected.
- Insurers don't pay Fugitives, so a big-gunned pirate who's caught loses the lot.

## 5. Going straight *(Mark)*

Mark: *"Yes a pirate can go straight but would have to prove themsleves, maybe they get recruited for special missions, maybe they get captured and have no choice to do something for the Marshal's. This gives them a new identity and a chance to go straight kind of thing."*

- **Recruited:** at Corsair or above, the Marshals make contact, for missions only a pirate could do: inside a pirate nest, working the back room, finding a gang's base, flying where a Lancer would be spotted.
- **Captured:** taken alive (needs disabling and capture) and offered a deal with no real choice: serve the Marshals, or lose the ship and everything in it.
- **A cover identity while serving:** a Marshals-issued transponder alias over your real callsign. Never a second account: a callsign is the account's, and member numbers are permanent.
- **The bounty is frozen** and paid down by missions. **Finish,** and the record is clean, with the choice of a new name (an ordinary callsign change, checked by `server/src/names.ts`). **Betray the deal,** and the bounty comes back doubled.
- **The cost:** the Solos and every pirate you flew with see a turncoat. The Falcon closes for good, and old contacts may hunt you.
- **Where it leads:** in time, a clean ex-pirate can join the Marshals properly. The best Marshals were pirates once.

## Three careers that feed each other

Pirates make work for bounty hunters and Marshals, who give pirates a reason to be good. Traders hire escorts because pirates exist; the relief convoys and the Titan's supply line are already targets on the timetable. The balance: fun enough that people choose it, costly enough in lawful space that it's never the easy road, and kept away from newcomers.

## What it needs from the law

The law changes that make piracy fair, in [law and travel](law-and-travel.md) and [shared space](shared-space.md): warrants that travel at the speed of news, fines that fit the crime, no switching shared space off mid-fight, legal status kept by the server, and *"Anarchy: no law here, and commanders may attack you"* on arrival.

## When it's built: keep it organised *(Mark: "keep organised and file size controlled")*

- **The law grows in its own folder, not in big files.** `src/game/law.ts` (192 lines today) becomes `src/game/law/`: `fines.ts`, `warrants.ts`, `notoriety.ts`.
- **On the server,** warrants, their spread and their alerts are their own module (`server/src/warrants.ts`, beside `push.ts`), never more of `accounts.ts`, which is split before shared space step 4.
- **`main.ts` stays wiring only.**

## How it could sound (only once built)

"Your bounty is your rank." "Rob them, don't kill them: the Solos are watching." The Falcon as the pirate's goal and the Lancer as the Marshal's: **choose your side of the law.**
