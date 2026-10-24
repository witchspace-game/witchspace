---
title: Ship condition and servicing
status: proposed
pillar: core
summary: Ships wear with use: condition, readable symptoms and breakdowns, servicing at stations, second-hand ships with a history, and engineering. Modern rules only.
card: sidewinder
help:
  - Describe a breakdown the way a pilot would notice it | writing
---

# Design: ship condition and servicing

*Status: **proposal**, Modern rules only. Condition, symptoms and station servicing (sections 1–4) fit into the single-player game. Second-hand ships and engineering work (sections 5–6) come with shipyards and multiplayer. Please discuss in GitHub Discussions before building.*

## The idea

Ships wear out with use. Skipping a service saves money and costs you reliability. That should be a **choice with consequences, never a chore**. Nothing decays while you're away from the game, and a worn ship gets less dependable rather than suddenly dangerous.

Related designs: [law and travel](law-and-travel.md) (damage, field repairs, rescue, power and protection), [stations and worlds](stations-and-worlds.md) (what can be repaired where), [economy and exchanges](economy-and-exchanges.md).

---

## 1. Condition

Every ship has a **condition** from 100% (fresh from the yard) down to 0%. It falls **with use, never with real-world time**:

| Wear source | Rough cost |
|---|---|
| Hyperspace jump | Small, per light year |
| Running the engines flat out | Slow and continuous |
| Overheating the lasers | A noticeable step each time |
| Scrapes and hull hits | In proportion to the damage |

A careful trader flying steady routes should need a service every few dozen jumps. A combat pilot will need one far more often.

This is separate from **combat damage** (built), where a hull hit can knock out a specific piece of equipment, which is then repaired at a station. Condition is general wear; damage is a specific failure. A worn ship is a little more likely to lose equipment when hit.

## 2. Symptoms: gradual and readable

The ship always tells you how it's doing: a condition gauge, and a "Service due" note at docking. Symptoms get worse in steps:

| Condition | Symptoms |
|---|---|
| **75–100%** | None |
| **50–75%** | Shields recharge more slowly; lasers heat up faster |
| **25–50%** | Occasional glitches: the scanner flickers, the throttle sticks briefly, or a **drive misfire** aborts the hyperspace countdown so you have to try again |
| **Below 25%** | Frequent glitches, reduced top speed, and the risk of a system dropping offline until you run a [field repair](law-and-travel.md#5-damage-disabling-and-capture) |

- **A breakdown never kills you outright.** The worst case is limping or being stranded, which is where the [distress beacon and rescue tugs](law-and-travel.md#6-fuel-rescue-and-never-being-stranded) come in.
- **Glitches never come out of nowhere.** Each is preceded by a warning, such as a "Drive unstable" message. That keeps it feeling fair, and it gives the ship character.

## 3. Servicing at stations

- When you dock, the station offers a service and shows your condition and the price.
- **Cost** scales with the ship's value and how worn it is. A small, frequent service is cheaper than a big, overdue one.
- **Tech level matters:**
  - A low-tech station can only bring you **part of the way back**, to about 70%.
  - Only a well-equipped yard restores you to 100%.
  - Advanced equipment can only be serviced where it's sold (see [power and protection](law-and-travel.md#9-power-and-protection)).
- **Partial service:** pay for what you can afford, and recover condition in proportion.

## 4. The trade-offs

This is where servicing earns its place in the game:

- **Thin margins:** a trader skipping a service to make a run pay, then nursing a twitchy drive home.
- **Distance:** explorers and smugglers working far from high-tech space wear down slowly with nowhere good to fix it, so a long expedition needs planning.
- **Combat costs something:** fighting wears your ship as well as your shields, so bounty hunting has running costs, as it should.
- **Ship size:** big ships cost more to keep running, which balances their cargo space (see [ship size classes](stations-and-worlds.md#3-ship-size-classes)).

## 5. Second-hand ships (with shipyards)

- Used ships come with a **condition and a service history**. A cheap Cobra might be a bargain or a wreck.
- **An inspection** at a good yard reveals the truth for a fee. In corrupt systems the paperwork may lie.
- A ship sold by a player carries its real history. You can't wipe the record by selling it.

## 6. Engineering (multiplayer)

- **Repair specialists:** [player stations](player-stations.md) can specialise in servicing, with better prices or higher standards than the default yards.
- **Commanders as engineers:** hire another commander with the right equipment to come and patch you up in the field, or to rescue you when you're stranded. This fits with [hiring commanders](economy-and-exchanges.md#5-contracts-and-futures-multiplayer).
- **Multicrew:** on large ships, the [engineer's station](../ideas.md) is where wear and power routing are managed.

## Classic rules

The 1984 game had no wear or servicing, so **Classic rules leave it out entirely**. Combat damage and repairs still apply as built.

## Prior art

Later games in the series introduced regular servicing, with breakdowns if you neglected it. To be confirmed before we cite specifics. As always, we take the idea, not the implementation.

## Open questions

- How fast should condition fall? This needs playtesting. It should be just noticeable on a trading route and significant in combat.
- Should the condition gauge be on the main HUD or only on the station screen?
- Should insurance (see [law and travel](law-and-travel.md#7-losing-your-ship-insurance-loans-and-loan-sharks)) cost more, or pay out less, for a badly neglected ship?
