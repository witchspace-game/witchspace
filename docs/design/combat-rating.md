# Design: combat rating and combat missions

*Status: **agreed direction**, Modern rules unless stated otherwise. Weighted kill points (sections 1–3) and the status display (section 6) fit into the single-player game now. Player kills (section 4) wait for multiplayer, and missions (section 5) for a mission system. Numbers marked **(to tune)** are starting points for playtesting.*

## The idea

The rating from Harmless to Elite stays what it was in 1984: a measure of **how good you are in a fight**. Witchspace keeps the original names and thresholds, but changes what earns points:

1. **Danger earns points, not body count.** Beating a pirate in a well-armed ship is worth far more than shooting a trader.
2. **Combat missions are the main road to Elite.** Kills along the way help, but the big steps come from taking on hard, deliberate fights.
3. **Other players are worth the most**, if they're a real match for you. Picking on weaker commanders earns nothing.
4. **Crime earns nothing.** Killing innocent traders or the police never raises your rating.

Trading, exploration and delivery missions pay credits and reputation, never rating points. "Elite" means a combat pilot, as it always has.

Related designs: [law and travel](law-and-travel.md) (crime, bounties, Marshals, power and protection), [player-run stations](player-stations.md) (stations that issue missions).

---

## 1. Ranks and thresholds

The ranks and thresholds are the original's, now counted in **rating points** rather than kills:

| Rank | Points |
|---|---|
| Harmless | 0 |
| Mostly Harmless | 8 |
| Poor | 16 |
| Average | 32 |
| Above Average | 64 |
| Competent | 128 |
| Dangerous | 512 |
| Deadly | 2,560 |
| **Elite** | **6,400** |

The rating never goes down. Points are kept to fractions internally, as the later 8-bit versions did, and shown rounded.

## 2. What history tells us

The 1984 BBC Micro version gave **one point per kill**, whatever you killed. Players soon found the cheapest road to Elite: wait outside a station and shoot police Vipers.

The Commodore 64 version, and then the BBC Master, Apple II and NES versions, gave each ship type its own value. That made pirates and Thargoids the way up. Some of those values:

| Ship | Original points |
|---|---|
| Constrictor / Cougar | 5.33 |
| Thargoid | 2.66 |
| Fer-de-Lance | 1.25 |
| Cobra Mk III (pirate) | 1.16 |
| Asp Mk II | 1.08 |
| Anaconda | 1.0 |
| Cobra Mk III (trader) | 0.91 |
| Mamba | 0.5 |
| Sidewinder | 0.33 |
| Viper (police) | 0.10 |
| Escape pod, shuttle | 0.06 |
| Cargo canister | 0.04 |

Source: [bbcelite.com, combat rank](https://elite.bbcelite.com/deep_dives/combat_rank.html) and [ship specifications](https://elite.bbcelite.com/deep_dives/comparing_ship_specifications.html).

The lesson is that a fixed value per ship type is a big improvement, but players still hunt whatever pays best for the least risk. Witchspace adds the context of each fight.

## 3. Points for NPC kills

**Points = ship value × role × threat × experience**

### Ship value

Each ship's JSON file gets a `ratingValue`, starting from the original's table above. New ships take a value in line with ships of similar strength. Community-designed ships need one too, checked by `npm run validate`.

### Role

| Target | Multiplier |
|---|---|
| Pirate, or a ship with a bounty | **× 1.3** (the original's pirate Cobra was worth about 1.3 times a trader's) |
| Thargoid | × 1 (already valued highly) |
| Trader, police or any clean ship | **0** under Modern rules: it's a crime, and crime earns nothing |
| Ship that attacked you first, even if clean | × 1: defending yourself is legitimate |

### Threat

How well armed and supported the target was **(to tune)**:

- **Lasers:** beam × 1.2, military × 1.5.
- **Extra kit:** ECM, missiles and better shields add a little each, up to × 2 in total.
- **Wingmen:** a pirate flying with others is worth more. If you're outnumbered, each kill scores × (1 + 0.25 per extra enemy in the fight), up to × 2.

### Experience

Easy targets wear thin as you improve. Every NPC has a **threat rank** worked out from its ship, role and kit, for example:

- a lone Sidewinder pirate: Poor;
- a pirate Cobra with beam lasers: Competent;
- a Thargoid: Dangerous.

| Your rank compared with the target's | Multiplier |
|---|---|
| At or below the target's rank | × 1 |
| One rank above | × 0.5 |
| Two ranks above | × 0.25 |
| Three or more above | **0** |

A Deadly pilot gets nothing for Sidewinders, but every fight with a real threat still counts.

## 4. Points for player kills (multiplayer)

Other players are the most valuable targets **when they're a real match**.

**Points = their ship's value × 3 × rank factor** **(to tune)**

| Their rank compared with yours | Rank factor |
|---|---|
| Two or more ranks **below** you | **0**, and the law takes a dim view (see [power and protection](law-and-travel.md#9-power-and-protection)) |
| One rank below | × 0.5 |
| Same rank | × 1 |
| One rank above | × 2 |
| Two or more ranks above | × 4, up to × 8 |

A Competent pilot who brings down a Deadly one in a better ship has earned a lot.

**Rules against abuse:**

- **Legitimate fights only.** Killing a clean player in lawful space is a crime: no points, and you become a Fugitive. Points come from fights where the other player was a pirate, Wanted, in an anarchy, or fired first, or from agreed duels.
- **Repeat kills count less.** Killing the same commander again within 24 hours earns half as much each time, so friends can't trade kills up to Elite.
- **A real fight is needed.** The victim must have been in control and able to fight back, not freshly launched, docking or disconnected.
- **Shared kills** are split by damage dealt.
- **The server decides.** Rating changes are worked out server-side from the fight's record, never trusted from the client.

## 5. Combat missions

Missions are the main road to Elite. Only **combat** missions award rating points. Trading, courier and exploration missions pay credits and reputation only.

### Kinds of mission

| Kind | Examples | Rating points |
|---|---|---|
| **Contracts** (repeatable, from station boards) | Bounty on a named pirate; escort a trader convoy; defend a station from a raid; clear a pirate nest in an anarchy | Moderate. Scales with the danger, uses the experience rule from section 3 |
| **Campaigns** (one-off, multi-stage stories) | Hunt down a stolen prototype warship; stop a Thargoid incursion before it reaches a system | Large: **256 points** for the hardest, the size of the original's "Right On Commander!" step |
| **Player contracts** (multiplayer) | Bounties posted by players, the Marshals or loan sharks (see [law and travel](law-and-travel.md)) | As for player kills (section 4) |

### Rank opens doors

- Contracts and campaigns have a **minimum rank**. Harder work becomes available as you prove yourself, which gives the rating a use beyond the title.
- **Contracts below your rank** still pay credits, but rating points follow the experience rule. You can't farm easy contracts.
- **Failing** a mission earns no points and costs reputation with whoever issued it. It never lowers your rating.
- **Some campaigns are only open to Clean commanders.** The Marshals don't hire Fugitives.

### Content

Missions are a natural community contribution, like ships. A mission would be a data file: issuer, minimum rank, stages, enemies and rewards. It would be checked by `npm run validate` and kept original, with no missions or characters copied from the original games or novels.

## 6. Pacing

A rough target for the road to Elite **(to tune)**:

| Rank | Total play time | Mostly from |
|---|---|---|
| Competent | ~10 hours | Pirates met on the way, first contracts |
| Dangerous | ~40 hours | Contracts |
| Deadly | ~150 hours | Contracts, first campaigns |
| Elite | ~300+ hours | Campaigns, hard contracts and other players |

Missions should provide **well over half** of the points above Competent. Elite should stay a long-term goal that few commanders reach.

## 7. Showing it

- **Status screen:** rank and progress, for example "Competent · 41 points to Dangerous".
- **After a kill:** a short note with the points, for example "+1.4 rating". A kill that earns nothing says why: "No rating · crime" or "No rating · too easy for you".
- **Rank-up:** a banner when you reach a new rank.
- **"Right On Commander!"** every 256 points, as in the original, even beyond Elite.

## 8. Classic rules

Classic stays as it was: **one point per kill, for everything you kill**, including police and traders. There's no experience rule and no player-kill rules. Combat missions may appear under Classic later, as one-off campaigns in the spirit of the 1984 disc version's missions.

## 9. Moving existing commanders over

Existing commanders keep their kills, converted one-for-one into rating points, so nobody loses rank when weighted points arrive.

---

## Open questions

- **Classic:** confirm the 1984 rule of one point per kill, rather than the later versions' per-ship values.
- **Ship values for new ships:** who sets them, and how are they reviewed when community ships arrive?
- **Agreed duels:** how two players agree a fight (a hail and accept?), and whether duels count fully or at a reduced rate.
- **Exact multipliers and pacing:** to be tuned in play.
- **Mission issuers:** stations, the Marshals, governments, player stations and AI-run stations. Who offers what?
