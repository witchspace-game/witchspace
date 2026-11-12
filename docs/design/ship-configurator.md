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
- **A spec for the hull you fly is a repaint** (Mark, 12 November 2026: most new players spec the Cobra they start in, and it went nowhere). The yard says *"Your Cobra spec from the website is here: repaint her … for X Cr?"*, quoted with `repaintQuote` against the paint she has now (so it can come in under the site's factory-Cobra figure). One tap if you can afford it; if not, *"You need N Cr more. Your spec waits here."* `repaint` takes the spec's colour, glow, trim and name; then the spec is cleared, as an order clears it. Edition colours stay protected (`paintable`).
- **Its kit isn't a repaint.** The lasers and upgrades in the spec go on a list at the top of the station's **Equip ship** screen (*"From your website spec: Beam laser, front · 1,000 Cr"*), ticked off as you buy them there as usual, laser ratings and all (`specKitLines`; kept on the commander as `specKit` until it's all fitted). Luxuries come with a new hull, not at a station.
- Any other hull already flying can't be ordered yet ("bought outright, when shipyards sell"). Its spec waits in the configurator, filled in, for when it can.
- **The handover** (agreed with Website, 12 November 2026): the same `Spec`, in localStorage `witchspace.spec.v1` as `{spec, at}` and on the account by `PUT /me/spec`. No new field: a spec whose `ship` is the hull you fly is a repaint.

## The yard's order book *(Mark, 12 November 2026; proposed)*

Mark: *"They could order her and the order could be sat in a queue on the website where people can see the ships people are ordering and their spec."*

- A public page of the ships commanders are building, each turning in her own paint (her paint on her only; the page stays green, white and grey).
- Each entry: her name, hull, colour and glow, home port, and where she's got to: *Specced, saving up* → *On order at <yard>* → *Ready at the yard* → *Delivered*.
- Only registered ships whose owners ticked *"Let the galaxy talk about her"* ([shared-space.md, her name](shared-space.md#step-4a-registering-your-ship-mark-9-november-2026)): that keeps out spam and covers permission.
- Newest first, filters by hull and colour; *"Spec one like her"* opens the configurator with her spec.
- **The list is the server's** (Game dev), from the yard records it already keeps (`server/src/yard.ts`) and the account's spec: `GET /yard/orders`, public, cached, nothing in it but the above. **The page is the site's** (Website).
- Later, perhaps: a save-up bar for signed-in players with a cloud save.
- **The configurator's last step, now** (Website): not *"Fly her now"*, which suggests you'll fly the ship you specced, but *"Start flying free: earn her paint in the game"*.

## Rules

- **The game decides.** The site checks a spec with `validSpec` and prices it with the game's code, but only the game takes a deposit.
- **Nothing is spent on the site, and nothing is real money.** It sells the dream of a ship, for in-game credits.
- **Laser ratings** (a military laser needs Competent, in Modern) apply when the deposit is paid in the game. The site marks those lasers "needs a rating" and lets you spec them anyway.
