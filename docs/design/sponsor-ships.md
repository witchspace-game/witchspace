---
title: Sponsor ships
status: proposed
pillar: build
summary: Keeping the lights on and paying contributors, the Witchspace way. A sponsor names a real ship that flies the galaxy for everyone, as fishing boats are named for the people at home. No advantage in play, no token, no real brands; the money keeps shared space running and pays the people who build the game. And the seams built now, so the future isn't a rebuild.
stages:
  - The seams - linked sign-ins, a record of contributions, a payouts ledger, sponsorships as records | proposed
  - Sponsor ships - a named ship on the timetable, her plaque, the sponsor's page | proposed
  - Paying contributors - sats for accepted work, recorded against their account | proposed
  - More to sponsor - a convoy escort, a station's dedication, a beacon at a first discovery | idea
---

# Design: sponsor ships

*Proposed, 11 November 2026. Mark: "paying contributors and keeping the lights on. Maybe we could add 'sponsor ships'. (see what i did there?) Anyway i am thinking that the infrastructure for the future of witchspace should be built in just in case". From a brainstorm about funding, tokens and wallets the same day. Change by pull request.*

## Why

Two jobs, kept apart on purpose:

1. **Money in: keeping the lights on.** Shared space is cheap today: about half a US cent for each hour a system room is busy, so 100 commanders flying 2 hours a day is about $1 a day (the daily budget cap protects it; [shared space](shared-space.md)). Add the Worker plan, Vercel, the relay, market data and email, and it's tens of dollars a month for now, more if Witchspace grows.
2. **Value out: paying the people who build it.** Ships, trails, saloon lines, fixes and art come from the community ([community platform](community-platform.md)). Paying them, a little, in real money, is fair.

A token would mix the two jobs: bought to fund the game, it looks like an investment; earned by playing and sellable, it's play-to-earn, with the farms, bots and collapse that come with it. So no token, and nothing in the game is ever worth real money: Witchspace stays "all virtual, all earned in play", as [system currencies](system-currencies.md) promises for Bitcoin.

## Sponsor ships *(Mark)*

The lore already does it. Ships are named after people, as fishing boats are named for a wife, a daughter, a father: *Ada May*, *Old Tom*, *Margaret Reyes* ([the world, 6.5b](the-world.md#65b-ships-names-mark)). So a sponsor **names a ship**.

- **A real ship in the galaxy.** A Carriers' Mutual freighter on a lane, named by her sponsor, flies her route every day for everyone, solo and shared, worked out from the timetable like every other trader ([the world](the-world.md)). Hail her, escort her, warn her about pirates, read her name on the scanner.
- **Her plaque.** Target her and the readout says so, once, quietly: *"Margaret Reyes · named by CMDR Kestrel, 2026."* A sponsor's page lists the ships they've named and where they fly.
- **Their crew remember you.** She's a trader like any other: help her and she's warm; rob her and she'll say so in the saloon. A sponsor can watch their ship's day on her page: the systems she's passed, the convoys she's joined.
- **No advantage in play.** Sponsoring changes nothing about your own ship, credits or rank. It's a dedication in the world, not a purchase in the game.
- **Lost and back.** Destroyed in shared space, she's out of the timetable for a day (as Odile Venn's *Second Wind* is) and back the next: a sponsor's ship is never gone for good.

### The rules

- **People and community names only.** A sponsor names a ship after a person, a place, a pet, a memory; never a company, product or brand (the world has its own companies, and no real brand is ever introduced). Checked as callsigns are, and by a person before she flies.
- **Names are kept, not sold on.** A named ship can't be resold or transferred; the sponsor can rename her once.
- **Honest about what it is.** The page says plainly what the money pays for (shared space, then contributors) and that a sponsored ship is a dedication, not an investment or an in-game advantage.
- **Never a gate.** Shared space and everything in the game stay free.

### Tiers, from the world *(to price)*

| Sponsor | What flies | Notes |
|---|---|---|
| **A trader** | A freighter on one lane, named by you | The everyday one |
| **A convoy escort** | A Viper on a company's convoy run | Seen in fights; braver than she should be |
| **A station's dedication** | A plaque at a station's dock: *"Lave Station, kept by …"* | One per station, a year at a time |
| **A beacon** | A beacon at a system's first discovery, after its finder | With the finder's yes |

## Paying contributors

- **In sats, from what comes in.** Accepted work (a ship, a trail, a fix, writing) is paid in Bitcoin by Mark, as payment for work: never a token, never earned by playing.
- **Recorded against their account,** with the reason, so it's auditable from day one (the payouts ledger, below).
- **Their record on their callsign card:** what they've built, credited.

## The seams, built now *(Mark: "just in case")*

Seams, not features: cheap now, painful to add later. None of them moves real money on its own.

1. **Linked sign-ins.** An account with several ways in: email now, a browser wallet later (a signed message, no transaction; discussed 11 November 2026). One table of identities per account, so adding a way in never means a new account.
2. **Contributions.** A record per account of what they've built and had accepted, with links. Needed anyway for credits; the basis of any future payout.
3. **Payouts.** Real money going out, recorded: who, how much, in what, for what, when. Written by Mark's admin tools only.
4. **Sponsorships.** Who sponsored what, named what, until when. The game reads them like any other record from the server.
5. **The ledger, already built.** Every commander's money is already a hash-chained ledger the server checks ([system currencies, 7](system-currencies.md)).

**Not built "just in case":** a token, or a wallet that holds money. Those carry the legal and community risk, and they can sit on top of the seams if the day ever comes.

## Open questions

1. Prices for each tier, and whether a sponsorship is yearly or for good.
2. How money comes in: card payments (a payment provider), Lightning, or both. Card payments mean a provider account (Mark's to open) and its fees.
3. Where a sponsor's ship flies: chosen by them, or given the lane that needs her.
4. Whether sponsors' names appear on the site's live feed.
5. Legal: payments for a dedication and paying contributors are ordinary, but check the terms (refunds, tax, what a sponsorship promises) before taking money.
