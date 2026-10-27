---
title: Pilot skill
status: proposed
pillar: fight
summary: Pirates who fly better as you do: rookies and aces, set by your combat rating and how lawless the system is, and the Falcon never less than an ace.
card: sidewinder
stages:
  - Skill in the pirate AI, set by rating and government; the Falcon an ace | building
  - Missile craft, wingmen, and each Falcon brother's style | proposed
  - Aces who read your combat computer's routines | proposed
---

# Design: pilot skill

*Proposed, October 2026, from Mark: "give the pilots better AI as the players get better." Change by pull request.*

Every pirate flew the same way: straight at you, firing when lined up, peeling off at 300 m and coming round again. A joust. With a good laser you won it on the first pass, so making a ship tougher only made it a sponge, and the Falcon, a Legend, went down in about four seconds to military lasers ([her test duels](legends-the-falcon.md#the-fight-and-losing-it)). The fix is better pilots, not bigger numbers.

## Principles

- **Skill changes how a ship flies, never its stats.** Same hull, same lasers; a better pilot makes more of them.
- **Why the danger follows you** *(Mark, 27 October 2026)*: "Our universe is slightly different. It's designed to stop rapid advancement by squatting and/or killing newbie low value targets." Aces that grow likelier with your rating mean a veteran can't sit in a safe system farming easy kills to climb the ranks: wherever they go, better pilots come for them. Keep it that way: setting pirate skill by the place alone was considered and turned down. The same idea runs through the rest of the game: easy targets earn less and less as you improve ([combat rating, experience](combat-rating.md)); in shared space, killing a commander two or more ranks below you earns nothing and the law takes a dim view, repeat kills of the same commander count for less, and the victim must have been able to fight back ([combat rating, section 4](combat-rating.md)); and the core systems around the starting stations have heavy patrols, a standing Marshal presence and harsher penalties, so newcomers can learn without being farmed ([law and travel, protected starter systems](law-and-travel.md)).
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

## Attack runs, not rams *(Mark, 27 October 2026)*

"I hate the way the pirates come in nose first and literally smash into you." Every pirate, rookie or ace, makes attack runs: it comes at you, breaks off before it reaches you, and comes round again. A ram happens only by mistake, or from a deliberately suicidal type (none yet), never as the way to attack. A replay that mostly shows a ship ramming you teaches nothing ([the kill cam](kill-cam.md)).

Built in today's AI (`src/game/npc.ts`), ahead of the skill dial, after the old pass broke off only at 300 m, under a second from impact head on:

- **It breaks off by time, not distance:** 0.8 to 1.4 seconds from reaching you at the closing speed, picked afresh each pass, so a rookie is late and a bit clumsy but still turns away; never closer than 300 m.
- **Across your line of fire, a little away from you,** on the side it's already sliding towards, never on through you.
- **A collision guard** as a backstop: if its path would come within a ship's width of yours in the next second, it breaks at once.
- **It opens up at least 700 m** before turning for the next run, and closes at about 150 m/s faster than you're moving away, so it catches you if you run and eases off head on.
- Tested by flying it (`src/game/attackRuns.test.ts`): a Sidewinder, a Mamba and the Falcon against a Cobra coming at them, cruising or sitting still, over 180 fights and 746 passes, never touching: the closest pass 124 m, most between 150 and 280 m (a Cobra is 68 m across), and round again every 6 to 8 seconds; a Cobra running flat out gets fewer passes, since a pirate is barely faster.

## Who gets a good pilot

- **Rookies:** most pirates, skill 0 to 0.4.
- **One good pilot in a pack, sometimes:** a pack's leader is an ace (0.5 to 1) with a chance that grows with **your combat rating** and **how lawless the system is**: about 1 in 10 for a Harmless commander in a safe system, about 1 in 3 in an anarchy, and most packs once you're Deadly or Elite. The higher your rating, the closer the ace's skill to 1.
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
| **1** | The skill dial in the pirate AI (aim, pursuit, jinking, no joust, breaking across, shields); skill set by rating and government, one ace a pack; the Falcon an ace, rising with your rating. |
| **2** | Missile craft (waiting for your shields to drop, baiting your ECM); wingmen who split to take you from two sides; each Falcon brother's style: Bram precise, Kit showing off with close passes, Jory careful at range, Tobin dirty, with more missiles. |
| **3** | Aces who read your combat computer: they learn each routine's pattern and answer it ([combat computer routines](combat-computer-routines.md)). |

## Open questions

- Should you be able to tell an ace before the fight? A name on the radio ("that's Kade's ship"), or only by how it flies?
- Should a bounty be worth more for an ace?
