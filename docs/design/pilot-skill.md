---
title: Pilot skill
status: proposed
pillar: fight
summary: Pirates who fly better as you do: the system sets how good its pirates are, the same for everyone, and your fame brings named hunters after you. The Falcon never less than an ace.
card: sidewinder
stages:
  - Skill in the pirate AI, set by the system; hunters drawn by your fame; the Falcon an ace | building
  - Missile craft, wingmen, and each Falcon brother's style | proposed
  - Aces who read your combat computer's routines | proposed
---

# Design: pilot skill

*Proposed, October 2026, from Mark: "give the pilots better AI as the players get better." Change by pull request.*

Every pirate flew the same way: straight at you, firing when lined up, peeling off at 300 m and coming round again. A joust. With a good laser you won it on the first pass, so making a ship tougher only made it a sponge, and the Falcon, a Legend, went down in about four seconds to military lasers ([her test duels](legends-the-falcon.md#the-fight-and-losing-it)). The fix is better pilots, not bigger numbers.

## Principles

- **Skill changes how a ship flies, never its stats.** Same hull, same lasers; a better pilot makes more of them.
- **The world reacts to your reputation, it doesn't level with you.** Most pirates stay ordinary, so you feel how much better you've become. What changes is who comes for you: word gets round, and the gangs send better pilots after a Dangerous commander. A Deadly commander should still cut through an anarchy's rabble, and be properly tested by the pilot they sent.
- **Traders, police and Marshals don't change.** Only the ships that hunt you.
- **Classic is untouched.** 1984's pirates fly as they did.
- **Readable.** A good pilot looks good: you see them jink, see them refuse to joust, see them come round onto your tail. Nothing hidden.

## The dial

Each pirate has a skill from 0 (a rookie, exactly today's AI) to 1 (an ace).

| | Rookie (0) | Ace (1) |
|---|---|---|
| **Aim** | Sprays around you (0.7° of spread) | Tight (0.3°) |
| **Pursuit** | Flies at where you are | Leads you, flying at where you'll be, so it gets onto a turning target |
| **Your sights** | Flies straight through them | Jinks out the moment your nose is on it: a hard break for half a second to a second, and again sooner the better it is (from skill 0.3) |
| **The joust** | Comes at you head-on | Won't fly down your guns: if you're facing it, it swings wide and comes round onto your flank or tail (from skill 0.5) |
| **Breaking off** | Peels away in a random direction | Breaks out of your line of fire, across it |
| **Shields** | Fights on with them gone | Pulls out to let them recharge, then comes back (from skill 0.6) |

## Who gets a good pilot

- **Rookies:** most pirates, skill 0 to 0.4.
- **One good pilot in a pack, sometimes, set by the place:** a pack's leader is an ace (0.5 to 1) with a chance set by **how lawless the system is**, the same for every commander: about 1 in 10 in a safe system, about 1 in 3 in an anarchy. Your rating doesn't change the background: a Deadly commander cuts through an anarchy's rabble, as they should.
- **Hunters, drawn by your fame** *(Mark, 27 October 2026: danger set by the place, not by your rating)*: from Dangerous upwards, word gets round, and now and then a named ace comes looking for you, more often the higher your rating. They hunt by your transponder: they find you when it's on, or in systems where your record is known, so running dark ([law and travel](law-and-travel.md)) is a real answer, at its own price. The radio says who they are before they arrive.
- **The Falcon is never a rookie.** Her skill is 0.7 at Harmless, rising with your rating to 1 at Elite, and in the redesign, she [learns how you beat her](legends-the-falcon.md#she-remembers-you) on top.

## What the first pass taught us

*25 October 2026.* A first pass is built (on its own branch, not yet in the game) and was tested in duels: a bot flying a Cobra at a Cobra's turn rate, with a human's quarter-second reaction, against the Falcon flown as a rookie and as an ace.

- **Dodging didn't make her stronger.** The first ace version jinked out of the bot's sights and won none of twelve fights; she hardly fired. A ship can't sidestep: to dodge it turns, and turning takes its guns off you. At 2 km a hard turn barely moves it in your sights. Jinks now happen only inside 1.2 km, where a turn sweeps across your view fast, and the ace came out about level with the rookie.
- **Gimballed guns win the joust**, so a pilot with them takes it; fixed guns lose it, so a pilot with them swings wide for the flank.
- **Position beats dodging.** What wins free seconds of fire is getting behind: a Cobra takes about four seconds to turn round. So skill should mostly scale *where* a pilot fights from (the tail, the rear quarter, out of the dark), how well it reads your turn, and when it breaks off, more than how it dodges. The Falcon's own plan is built on this ([how she fights](legends-the-falcon.md#how-she-fights-the-ambusher)).
- **The test bot needs a human's aim as well as reactions**, or no dodge ever counts.

## Your combat computer

The ships that hunt you read how you fly, including when a computer is flying for you: rookies fall for any routine, aces learn each one's pattern, and the Falcon reads your kit as she comes in dark. See [combat computer routines](combat-computer-routines.md).

## Tuning

Test duels in the browser, a bot flying a Cobra at a Cobra's turn rate, scoring only when she's in its sights, with each laser, before and after. Targets:

- a rookie pirate goes down in seconds;
- an ace pirate is a real fight, even with military lasers;
- the Falcon at Elite rating is a fight you'll remember, won by flying, not by your laser.

## Building it in stages

| Stage | What |
|---|---|
| **1** | The skill dial in the pirate AI (aim, pursuit, jinking, no joust, breaking across, shields); skill set by the system's government; hunters drawn by your fame (rating, transponder), one ace a pack; the Falcon an ace, rising with your rating. |
| **2** | Missile craft (waiting for your shields to drop, baiting your ECM); wingmen who split to take you from two sides; each Falcon brother's style: Bram precise, Kit showing off with close passes, Jory careful at range, Tobin dirty, with more missiles. |
| **3** | Aces who read your combat computer: they learn each routine's pattern and answer it ([combat computer routines](combat-computer-routines.md)). |

## Open questions

- Should you be able to tell an ace before the fight? A name on the radio ("that's Kade's ship"), or only by how it flies?
- Should a bounty be worth more for an ace?
