---
title: Your commander's card
status: building
pillar: build
summary: Claim a callsign and build the card that carries it - Trade, Fight, Explore or Build, a scene from the game behind her, and the ship you own, turned to the angle you like - on a plate of metal that shows what you've earned. One link per commander, whose preview is their card.
card: cobra-mk3
stages:
  - The page - /callsign/, the name checked as you type, signing in with the code typed on the page | built
  - The card - a career, its scenes, your own ships in their own paint, her angle dragged round, the metal and the number | building
  - Cards to earn - every other card on show, locked, with how to earn it - the yards' ships, the Marshals' Lancer, Legend at Elite, the editions for their owners | building
  - The card kept - saved on the account, one link per commander whose preview is their card (needs the server) | designed
---

# Design: your commander's card

*Design, 30 October 2026. Mark wanted the career on the card (Pirate, Trader and the rest) to inspire its design, like choosing a special bank card: players build the card they want, claim their callsign and membership with their email, and share it. Follows the callsign page in [the live feed](live-feed.md)'s spirit: real things only, nothing invented.*

## Why

A callsign on its own is a word in a box. A card you've built is yours: every choice (what you do, where you're seen, the ship, her angle) is a small commitment, and by the time the card is finished, keeping it (an email and a code) is the obvious last step. Then it's worth sharing, and it's a reason to come back: the card changes as you play.

## The card

A plate of metal, 1200×630 when shared, its face a window onto the game:

- **Your career**, one of the game's own four: **Trade, Fight, Explore, Build** (the home page's ladders). It sets the card's colour, the line ("Every trader needs a callsign") and which scenes come first. None outranks another.
- **A scene** behind her, from the press library, cropped clear of the dashboard: the career's own first, then the rest.
  - Trade: a Coriolis station, the station from below, a station over its world
  - Fight: crossfire, the police join in, a pack closing, a Mamba breaking up
  - Explore: low over Diso, a beacon and its world, debris across a ringed world, a witchspace rift
  - Build: a station rising, the Titanoboa, the yard by its moon
- **Your ship**, and only one you own (Mark: "they should probably only have access to the ship they own"). A new commander owns the Cobra Mk III. Signed in, the page reads your save: the ship you fly and every ship in your hangar, each **in her own paint** from the yard, so the card's colours are the ones you chose there.
- **Her angle**: she turns slowly until you take hold of her; drag her round and she stays where you left her, and the picture keeps it.
- **Your callsign**, under COMMANDER, and your **member number**, raised: `0000 0001`, `MEMBER SINCE 10/26`. Eight digits in two groups, never sixteen: it mustn't read as a bank card's number.
- **The metal**: the plate's finish is what you've earned, as with a metal bank card, never bought:

  | Finish | Who |
  | --- | --- |
  | Titanium | Founding members: callsigns claimed before launch (3 November 2026) |
  | Alloy | Everyone after |
  | Gold | The Co-operative Marshals (when the Marshal career is built) |
  | Black | Legend: a commander rated Elite |
  | Witch-fire, Dark | The numbered editions' owners, for their edition's card |

## Cards to earn

Below your card, every card you can't have yet, on show and locked (Mark: "I want them to be able to see the other ships and even the Marshal card with the Lancer"). Choose one and it fills the card, turning, so you can drag her round and look, marked **Locked** with how to earn it:

- **Any ship in the yards**: "Buy her at a shipyard and she can fly on your card."
- **The Marshals' card**: the Lancer in the Marshals' gold band and lights. "Join the Co-operative Marshals" (planned).
- **Legend**: the black card and the Legend mark, on whatever you fly. "Reach Elite."
- **The editions**: the Witch-fire and the Dark Edition, in their own paint, with their number. "By invitation, for the people who build Witchspace." Only an edition's owner can carry it ([editions by invitation](ships-and-classes.md)); nobody can pick its paint otherwise.

Locked cards can't be kept or shared as yours.

## Keeping it: make it yours

As on the callsign page: your email, then the six-digit code typed on the page, so it works the same in Safari, the Home Screen app and on a computer. The account then holds the callsign, the member number and the card.

## The card kept (the server's half, for Game dev)

Built like a clip's card (server/src/clips.ts): the browser draws the picture, the server keeps it and serves it to link previews.

- **The member number**: given when an account first takes a callsign, in order. 001 is Mark's; **002 to 100 are kept for the game's own characters** (Mark, 30 Oct 2026), so players start at 101. The maintainer gives a character its number with `POST /admin/members {callsign, member}`; `GET /admin/members` lists who holds which (no emails). `GET /me` and `POST /me/callsign` return `member: number` and `memberSince: ms`.
- **Founding**: a callsign first claimed before 3 November 2026, 14:00 UK. Returned as `founding: true`.
- **`PUT /me/card`** `{ career, scene, ship, angle: {x, y} }` plus the picture: a 1200×630 JPEG, at most ~200 KB, as a clip's card is checked. The ship must be one the save holds (the flown ship or the fleet), or an edition the account owns; anything else is refused. Answers `{ id, v }`.
- **`GET /me/card`**: the choices, so the page can build it again to change it.
- **`/card/<id>`**: one link per commander, the id random (never the callsign, so nobody can list who has which name). For link previews (the same user-agent rewrite as `/clip/<id>` in vercel.json), the Worker answers a page whose `og:image` is `/card-image/<id>.jpg?v=<v>`; the version changes with every new card, so a new post shows the new one. People get `/callsign/` with the card shown.
- **Withdrawing it**: `DELETE /me/card`; the link then shows the plain callsign card.

## Honest limits

- Before the server's half, the card is shared as a picture (the share sheet on a phone) and the link is the career's page; nothing about the card is kept.
- At launch nearly every card is a Cobra: the variety is in the career, the scene and the angle, and grows as people play. That's the point.
- The member number is real, so early ones are small. That's a founding member's boast, not something to hide.
