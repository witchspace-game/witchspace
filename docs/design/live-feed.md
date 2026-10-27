---
title: The live feed
status: building
pillar: build
summary: The home page's "right now in the galaxy" mixes the galaxy's own events, worked out from the clock, with what real commanders have done in the last two days - first discoveries, shared clips and their hearts, and how many are flying. One small public endpoint on the server supplies the commanders' half.
card: coriolis
stages:
  - GET /feed - firsts, clips and how many are flying, public and cached | building
  - The home page feed and ticker, mixing it with the galaxy's events | proposed
  - Milestones - "a clip passed 10 hearts" (needs hearts with timestamps) | idea
---

# Design: the live feed

*Design, 27 October 2026, step 2 of Mark's site notes. This document is the contract between the game dev session (which builds and owns the endpoint) and the website session (which builds the feed on the home page).*

## Why

"Right now in the galaxy" on the home page is worked out entirely from the clock when the page loads, so it feels static, and every news line has to say "may be over by now". Real commanders do things worth showing: they bring a world's data home first, share clips, heart each other's clips. The feed puts those beside the galaxy's own events, so the page feels lived in.

**Honestly, for now** nearly every real event will be Mark's (CMDR Jameson). The page shouldn't dress that up: no invented commanders, no padding. When there's nothing real in the last 48 hours the commanders' half is simply empty and the galaxy's events carry the feed.

## Who does what

- **The galaxy's events** (news, yard stages, the Bitcoin price, jobs posted) come from the clock and the existing endpoints, on the client. The website session builds them.
- **Commanders' events** come from `GET /feed` below. The game dev session builds it; Mark deploys it.
- The website mixes the two by time.

## GET /feed

```
GET https://space.witchspace.org.uk/feed        public, no sign-in, cached 60 s

{
  "events": [
    { "kind": "clip",  "t": 1761550200000, "id": "a1b2c3d4e5", "title": "JAMESON: fighting Krait at Lave", "system": "Lave", "hearts": 3 },
    { "kind": "first", "t": 1761550000000, "callsign": "JAMESON", "galaxy": 0, "system": 7, "body": "moon0" }
  ],
  "flying": { "now": 1, "today": 2 }
}
```

`events` is newest first, firsts and clips together, at most 40 (up to 20 of each).

### Firsts

From the `firsts` table in `server/src/accounts.ts`: the first commander to bring a body's data home.

- Only commanders with a callsign, as `GET /firsts/<galaxy>` already does. The callsign shown is the account's callsign now, so a rename follows and a deleted account drops out.
- The last 48 hours, newest first, up to 20.
- `t` is when the claim was accepted (ms since 1970). `galaxy` is 0-7 and `system` 0-255: the client has the galaxy generator, so it turns these into names.
- `body` is the claim's body id, exactly as in `/firsts/<galaxy>`: `planet`, `star`, `moon0`…, `poi0`…, `courier`, or `trail:<…>`.
- One trip home usually claims several bodies at once, and they share the same `t` and callsign. The website should group them ("JAMESON charted Lave: the planet, its moon and a signal") rather than list each.

### Clips

From the clips database in `server/src/clips.ts`.

- Never hidden ones (reported by enough browsers, or hidden by the admin key).
- Shared in the last 48 hours, newest first, up to 20.
- `t` is when it was shared. `title` and `system` are the server-written words, the same as the clip's own page. `hearts` is its heart count now. The clip's page is `https://witchspace.org.uk/clip/<id>`.
- Hearts carry no timestamp, so "a clip passed 10 hearts" isn't possible yet. That would need a time on each heart (or the moment a clip crosses a milestone); it's a later option, not built.

### Flying

Counts only, never names.

- **`now`**: signed-in commanders whose cloud save changed in the last 15 minutes. The game sends a save to the cloud a few seconds after any local save (docking, trading, jumping and so on), so this is a fair "playing right now" for signed-in commanders. It misses anyone playing without an account, and anyone who has flown for more than 15 minutes without anything being saved.
- **`today`**: devices that opened the game today (UTC), signed in or not: the `devices` total from the anonymous daily pings, which count each device (and each network) at most once a day. It resets at midnight UTC, so it's small early in the day.

### Privacy

Nothing that isn't already public elsewhere: callsigns and firsts are on the galaxy chart, clips and their hearts are on their pages, and the counts are totals. No emails, no account ids, no network data, no clip's owner beyond what its title already says.

### Caching and CORS

- The Worker caches the whole response at the edge for 60 seconds (`Cache-Control: public, max-age=60`), so however often the home page asks, the Durable Objects are asked at most about once a minute per Cloudflare location.
- Anyone may read it (it's public, and `curl` works), but the browser CORS header is only sent to witchspace.org.uk and localhost, so other sites can't build on it from a browser.
- Only `GET` (and the `OPTIONS` preflight).

## Later

- **Milestones**: a clip passing 10 hearts, a commander's 100th first. Needs hearts with times (above).
- **Other real events** as they're built: a station finished, a commander's new rank, a legend sighted. Each would be a new `kind`; the website should ignore kinds it doesn't know, so they can be added without breaking it.
