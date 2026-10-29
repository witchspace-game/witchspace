---
title: A numbered ship's papers
status: building
pillar: build
summary: When the maker signs a numbered edition over to a contributor, she comes with papers, a certificate of build on the site in her own colours. Private to her owner's link, so nobody can list who holds which number.
card: fer-de-lance
stages:
  - The certificate page - /ships/<ship>/<edition>/<no>/, filled from the yard's office, with Save as image and Share | built
  - The yard's office - GET /shipyard/papers/<edition>/<no>?t=<token>, the facts only with the owner's token | building
---

# Design: a numbered ship's papers

*Design, 28 October 2026 (Mark: "If you have to ask... you can't afford the special editions. For now they are invite only to contributors."; the edition delivery pack, Marketing, on Mark's yes). The special editions in [ships and classes](ships-and-classes.md) are signed over by the maker, never sold; this is what the person who's given one gets to keep and show.*

## What it is

A page for every numbered ship, at `/ships/<ship>/<edition>/<no>/` with the number in three digits (`/ships/fer-de-lance/witch-fire/001/`). It's the maker's certificate of build: her line drawing glowing across the top in her own paint, the maker's name, "Certificate of build", the edition, the number large, and then her facts:

- Hull, name (or *To be named at collection*), finish, glow, fitted, aboard
- Built at (the maker's yard), signed over to (Commander and the callsign), the date, and her status (*Waiting at the yard*, then *In service*)

Underneath: *One of N. The number is painted beside her name, and no other ship will carry it.* and the maker's signature. **Save as image** makes a portrait picture of it on the phone or computer (on a phone, the share sheet, where Save Image is); **Share** shares her owner's link.

## What next, after the handover *(Mark, 29 October 2026; idea)*

"Immediately after picking her up there needs to be a mission or something because its deflating to not know what next?" The handover should end with the maker's offer of a maiden voyage, and her first launch kept as a moment. Designed in ships-and-classes.md, §5 ("What next, the moment she's yours").

## Private to her owner

The facts come from the yard's office, and only with the token in her owner's link:

```
GET https://space.witchspace.org.uk/shipyard/papers/<edition>/<no>?t=<token>
→ with the right token: { editionId, edition, shipId, ship, number, limit, callsign, name, status,
                          signedAt, finish, glow, fitted[], aboard[{name, blurb}], yard, system, colour, trim, link }
→ otherwise:           { editionId, number, limit, signed }
```

- **The token** is 128 bits, made when the number is signed over. Her owner's link is `https://witchspace.org.uk/ships/<ship>/<edition>/<no>/#t=<token>`. It sits after the `#`, so it never reaches the site's server, its logs or its analytics. The maker's email, the handover in the game and the cover of her manual all use it; `GET /me/editions` gives it back to a signed-in owner.
- **Without it**, the page says only whether the number is signed over. Anybody can see that a number has gone; nobody can walk 001 to 100 and list who holds them. A contributor's ship is a public moment only when they choose to share it.
- **Callsign only**, never an email address. The page is `noindex` and not in the sitemap, and its share card shows the edition and "Certificate of build", nothing personal.

## Facts from the game, never typed in

Every string comes ready-made from the game's own data, so the certificate, the maker's email and the manual can't disagree: the fit-out from `editionGiftSpec` (a signed-over edition is fitted for the work, not as the edition is sold), the yard and system from the game's stations, her name and status from her owner's save once she's collected.

## How it's built

- `tools/ships.ts` `papersPage`: one page per edition, at `/ships/<ship>/<edition>/papers/`. `vercel.json` serves it at every number (the Vite dev server does the same); `src/site/papers.ts` reads the number from the path and the token from the hash.
- `src/site/viewer.ts` `snapshot()`: her picture for Save as image, drawn afresh at full size.
- The server's half (the token, the endpoint, `/me/editions`) is the game's: [ships and classes](ships-and-classes.md).
