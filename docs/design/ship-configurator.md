---
title: The ship configurator on the site
status: built
pillar: build
summary: Spec your perfect ship on the website, Tesla-style, with the ship turning in your paint and the price adding up as you go. Order it, and it's waiting for you at the next shipyard you dock at, where the deposit is one tap.
card: fer-de-lance
stages:
  - The configurator page - /ships/<id>/build/, every hull the yard sells, priced by the game's own code | built
  - Waiting at the yard - the spec saved to this browser or your account, and the game offers it at the next shipyard | built
---

# Design: the ship configurator on the site

*Design, 28 October 2026 (Mark: "I thought we were building a cool configurator that users could build out their perfect ship and then order it by paying a deposit", "similar to the way Tesla configurator"). It brings [Spec it, and put down a deposit](ships-and-classes.md) out of the game and onto the site.*

## Why

The yard's configurator is in the game, at a shipyard, so you only meet it once you've docked. Tesla's sells the car before you've sat in one: the car turning in the paint you just picked, the price adding up, a deposit and a date. The site can do the same for our hulls, and every spec shared as a link carries the game with it.

## The page

`/ships/<id>/build/` for every hull the yard sells (`inYards`). There's a "Build yours" button on each ship page.

- **The ship is the centrepiece.** She turns in your colour, glow and trim, built with the game's own `buildPainted`.
- **One step at a time:** Paint, Glow, Trim, Aboard, Fit-out, then Name and order.
- **A bar along the bottom:** the price, the deposit and when she'd be ready, worked out by the game's own `priceLines`, `quote`, `depositFor` and `productionHours`, so the site and the yard can never disagree.
- **The spec is in the link** (`#spec=…`), so "my Fer-de-lance" can be shared and opened by anyone.
- **The numbered editions** are shown beside the configurator, with how many are left. They're by invitation: for now the maker signs them over, free, to the people who build Witchspace *(Mark, 28 October 2026: "If you have to ask... you can't afford the special editions. For now they are invite only to contributors.")*, so nobody reserves one on the site and no price is shown; the count says how many are signed over. Anyone can open one (`#edition=witch-fire`), give her a name, and share her: the link carries the name (`#edition=witch-fire&name=Nightjar`). Her page's first button goes there, not to reserving or to /play/ *(Mark: "A new user cannot reserve one without paying the deposit which they haven't got. They can however spec out one and share it on social media!")*.

## Ordering: reserve online, pay at the yard

The deposit is paid in credits, and credits live in the save. The site doesn't change saves: the game owns them, its checksum and its ledger. So **Order** puts the spec where the game will find it, and the game takes the deposit:

1. **This browser:** `localStorage['witchspace.spec.v1']` = `{ spec: Spec, at: number }`. The site shares the game's origin, so this works with no account.
2. **Your account, if you're signed in:** `PUT /me/spec`, so it reaches the Home Screen app on a phone, and any other device.

The site then says: *"She's on order. Dock at any shipyard and the yard has your spec ready: the deposit is X Cr."*

## For the game dev session (the contract)

**Shared, pure (src/game/shipyard.ts):** `validSpec(spec: unknown): Spec | null`. It checks the ship is `inYards`, that the colours are `orderable`, and that the glow, the lasers, the upgrades (in `UPGRADES`) and the luxuries are real, and it applies `cleanName`. The site, the server and the game all use it.

**Server (accounts):**
- `PUT /me/spec` with `{ spec }`: keeps one spec per account (the latest wins), with the time. 400 if `validSpec` refuses it.
- `GET /me/spec` returns `{ spec: Spec | null, at: number | null }`.
- `DELETE /me/spec`.

**Game:**
- On docking at a station with a shipyard: if there's a spec (the newer of this browser's and the account's), and no order already in production, a message from the yard says *"Your {ship} spec from the website is here."* Opening it shows the configurator in `'spec'` mode with that spec filled in.
- **Order** works as now: `placeOrder` makes every check (only a concept takes a deposit, the laser ratings, the credits). If it succeeds, the game clears the spec from both places.
- A hull already flying can't be ordered yet ("bought outright, when shipyards sell"). Its spec waits in the configurator, filled in, for when it can.

## Rules

- **The game decides.** The site checks a spec with `validSpec` and prices it with the game's code, but only the game takes a deposit.
- **Nothing is spent on the site, and nothing is real money.** It sells the dream of a ship, for in-game credits.
- **Laser ratings** (a military laser needs Competent, in Modern) apply when the deposit is paid in the game. The site marks those lasers "needs a rating" and lets you spec them anyway.
