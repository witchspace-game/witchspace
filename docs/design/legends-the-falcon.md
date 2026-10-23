# Design: the Falcons, a Legend

*Proposed, October 2026. Change by pull request.*

The Falcon went into the game as a rare pirate: a dice roll on ordinary pirate encounters, deadly and nameless. Played, she turned out to be a hazard rather than a Legend. She was met too often in lawless space (two or three times an hour in an anarchy), she ended your run in one pass, and she was gone with nothing to remember her by.

A Legend should be **rare, named, and personal**: someone you hear about before you meet, who remembers you afterwards, and whose story is tied to the galaxy's. This design makes the Falcons that.

It builds on [exploration](exploration.md#stage-4-legends) (Legends, the Ninefold trail), [the companies](../companies.md) (Wexley-Yorozu, clause 214, the Carriers' Mutual), [law and travel](law-and-travel.md) (the beacon, rescue), [the radio](radio-and-comms.md) and [the combat rating](combat-rating.md). The homage rules in [CONTRIBUTING](../../CONTRIBUTING.md#legends-and-homages) apply throughout.

## Principles

- **The mark:** a small gold feather near her tail, on the hull, in its own glow. A nod you only notice on the hull read, close up; no letters, no monogram.
- **Rare and findable, not random.** One Falcon at a time in a galaxy, on her own circuit. You hear where she is before you meet her, and you can go looking, or stay away.
- **She takes; she doesn't kill.** A Falcon leaves you disabled and drifting, lighter by a cargo, never dead. Losing to her is a story, not a reload.
- **She remembers you.** Every meeting is kept. She knows your ship, what she took, whether you hurt her, and which side you took on the Ninefold.
- **People, not stats** (the story rule): each captain has a name, a reason, and a feeling: glad, sad, mad or bad.
- **Deterministic from seed and clock.** Where each Falcon is comes from the galaxy's seed and the time, the same for every commander, with no server cost. What she thinks of *you* lives in your commander.
- **Modern rules only.** Classic never meets her.
- **The homage stays ours.** The nod is in the name *Solo*, the shipyard, and a rogue with a code who'd rather out-fly you than kill you. Names, story and ship are original. Nothing from the films: no quoted lines, no smuggling-run in so many parsecs, nothing that copies an on-screen design.

## The story

**Solo & Sons** was a shipyard of five: Iver Solo and his four sons, building fast hulls on contract in the lawless systems. Iver flew with the **Carriers' Mutual** when it was young. He's the reason for the Mutual's empty chair at every meeting: he answered a call nobody else would, and didn't come back. The Mutual still sets his place.

When the *Ninefold* colony failed, Wexley-Yorozu chose recovery under clause 214 over relief: 40,000 Cr against 310,000. Sam Dray's tug *Hold Fast* answered the call he was told not to, and took 41 people off before the recovery crews arrived. **He took them to the Solo yard.** The Science Division's report says Dray should be found. It doesn't know where he went.

The sons have hidden the forty-one ever since, and fed them, and kept Wexley-Yorozu from finding the yard. They do it with the ships they built for themselves: the Falcons. (A Falcon is *she*, as ships are; her captain is a Solo son.)

| Captain | Galaxies | Feeling | What he's like |
|---|---|---|---|
| **Bram Solo**, the eldest | 1 and 2 | **Mad** | He flew escort for the *Hold Fast* the day it left the Ninefold. He takes Wexley-Yorozu cargo first, Hexon's second, and makes sure you know why. Cold to anyone who sold the Ninefold report to the Science Division. |
| **Kit Solo** | 3 and 4 | **Glad** | Flies because he loves it. Races you before he robs you, laughs on the radio, and lets you keep half if you nearly beat him. |
| **Jory Solo** | 5 and 6 | **Sad** | Feeds the forty-one. Takes food, medicine and water before anything else, apologises, and leaves the rest. Kept his father's old Mutual membership card. |
| **Tobin Solo**, the youngest | 7 and 8 | **Bad** | Sells what he takes to Vorg Industries and doesn't ask what it's for. His brothers don't like it. He still leaves you alive, but he takes more, and his messages are not kind. |

A commander who flies the Falcons' galaxies in order meets the whole family, and pieces together the yard's story from each.

**The Mutual's code.** The sons let Carriers' Mutual haulers go. A commander carrying only Mutual cargo is hailed, recognised and waved off ("Give the treasurer our love"). Rob a Mutual hauler yourself and that courtesy ends.

## Meeting a Falcon

- **One Falcon a galaxy at a time,** working a **circuit** of four to six anarchies and feudal worlds from the seed. She moves on every six hours (real time, from the clock), so every commander hears the same news.
- **Word of her:** at stations within 15 light years, bar talk ("a Falcon's been seen working Riedquat"); with a comms array, the radio picks up haulers warning each other. On the chart, her current system is marked once you've heard of her.
- **Meeting her** happens only in her current system: a chance on each arrival (about one in three), higher if you carry Wexley-Yorozu or Hexon cargo, and never more than once a visit. In practice that's **a few meetings a week for someone who goes looking**, and very rarely for someone who doesn't.
- **Her approach:** she runs dark, a cold white unknown on the scanner, until the hull read inside 2 km ("Hull read · FALCON"). Then she hails, in her own voice, before she fires. Pay her price (the cargo she wants) and she takes it and goes. Refuse, run, or shoot, and it's a fight.
- The random Falcon roll on pirate encounters (`FALCON_CHANCE`) goes. Pirates are pirates; the Falcons are the Falcons.

## The fight, and losing it

- **She fights to disable.** Her lasers go for your drives, her missiles (three, never two at you at once, as for every ship) to break your shields. She doesn't fire on a ship that's beaten.
- **Beaten:** when your hull is down to about a third, she stops. Your **hyperdrive is knocked out** and your speed limited: you're **drifting**, with life support on.
- **She takes her price:** company cargo she wants first, then the most valuable goods, up to her hold (10 t). A company contract taken by a Falcon fails without the usual standing loss: the companies know who she is. Your ship, equipment, credits and survey data are left alone.
- **Her calling card** arrives in your Messages: a line from her, and what she took.
- **Then she leaves** through witchspace, and you're alone.
- **Getting home:** fire the emergency beacon. In lawful space the police tow you in; elsewhere a Carriers' Mutual tug comes, for a fee you can always afford (never below the 100 Cr stake). Or, after a couple of minutes, your engineer jury-rigs the drive for slow flight to the nearest station. Never stranded, never destroyed.

## Beating her

- **A Falcon can't be destroyed.** At about a fifth of her hull she breaks off: she jettisons a can (gems, a fee for your trouble), hails you with something you'll remember, and jumps out with her ECM covering her.
- **Driving her off** is worth it:
  - her bounty (2,000 Cr, **rising by 500 each time she gets away** from anyone in that galaxy, from the clock and seed), paid when you dock;
  - combat rating as a kill of a ship her worth, and a Legend's weight (see [combat rating](combat-rating.md));
  - standing with Wexley-Yorozu and Hexon (+2), and a word from his brothers about you on the radio.
- **She comes back.** A Falcon you drove off stays away from you for a few weeks, then returns wary, or wanting revenge, depending on who she is.

## She remembers you

Your commander keeps a small record per captain: meetings, what she took, how often you drove her off, the last time you met. With the Ninefold choice already stored (`explore.ninefold`), that's enough for her to know you:

- **First meeting:** a warning and a price.
- **Again:** she knows your ship by its transponder, and says so.
- **You've beaten her before:** she's careful, or she comes for you specifically.
- **You published the Ninefold report:** Bram lets you keep half. **You sold it to the Science Division:** she takes everything, and tells you why.
- **You delivered for the Mutual, answered distress calls, never robbed a hauler:** they're warmer.

## Where it leads (later)

- **The yard.** A trail across the Falcons' galaxies leads to the Solo yard and the forty-one, Sam Dray among them. Bring them something (Mira's yellow flowers, seed stock that works) and the Falcons spare you for good. Sell the yard's position to Wexley-Yorozu instead, and the Science Division comes in force, and every Falcon in the eight galaxies knows your name.
- **Hunting her for the companies:** Wexley-Yorozu and Hexon post special assignments to find her.
- **In the shared galaxy:** the chart records who drove her off last, a season at a time.
- **Flying with them:** a pirate career that starts with an introduction to a Solo son.

## Building it in stages

| Stage | What |
|---|---|
| **1** | One Falcon a galaxy on a seeded circuit, moving with the clock; bar talk and radio word; meetings only in her system; the hail and the price; the random roll removed. Bram first (galaxies 1 and 2), then his brothers. |
| **2** | Fighting to disable: drifting, the beacon tow or the jury-rigged drive, her price taken, the calling card. She breaks off and escapes when beaten; the bounty that grows. |
| **3** | Her memory of you: lines by meeting, by the Ninefold choice, by your record with the Mutual. |
| **4** | The yard trail and its choice; company hunts; the shared galaxy. |

## Numbers (to balance)

| | |
|---|---|
| Falcons at a time | One per galaxy |
| Circuit | 4–6 anarchies and feudal worlds, within 7 LY hops |
| She moves | Every 6 hours |
| Meeting her, in her system | About 1 in 3 per arrival; more with W-Y or Hexon cargo; Mutual-only cargo waved off |
| Disabled at | About a third of your hull |
| She takes | Up to 10 t; your ship, kit, credits and data never |
| She breaks off at | About a fifth of her hull |
| Bounty | 2,000 Cr, +500 each escape |

## Open questions

- Should a Falcon ever be destroyable, perhaps only at the end of the yard trail, by choice?
- Four captains for eight galaxies, or one each, with four more sons' stories to write (a community contribution)?
- What does a Falcon do to a commander who is themselves a pirate?
- In shared space, can two commanders fight one Falcon together?
