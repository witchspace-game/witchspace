---
title: The community platform
status: building
pillar: build
summary: How people find their way in and help build Witchspace. One source of truth for what's built and what's next, help wanted on everything, ways to contribute without GitHub, and credit where it's due.
card: coriolis
stages:
  - One source of truth: headers on every design, the roadmap, the design library and help wanted made from them | built
  - Item pages linked to the ideas board, both ways | proposed
  - A ship editor in the browser, with a submission queue | proposed
  - The writers' room, contributor profiles and credits in the game | proposed
help:
  - Tell us what put you off contributing, or what would have helped you start | design
  - Write a help-wanted task for a design you know well | writing
---

# Design: the community platform

*Design, 24 October 2026. Stage 1 built; the rest proposed.*

Witchspace is meant to be built by the people who love it. In October 2026 the site didn't help them do that: the roadmap was a long block of text in the README, written for people who already knew the project, and already out of date; the Design section showed ten hand-picked documents and missed the most interesting ones; every way to contribute ended at "edit a file and open a pull request"; the ideas board, the designs, the roadmap and the backlog each held part of the picture and never met; and contributors were barely visible.

This design fixes that in four stages.

## Principles

- **One source of truth.** Everything about a feature (what it is, how far along, what help it needs) is written once, beside its design, and every page that shows it is made from that.
- **An invitation, not a changelog.** Every page answers "what could I do here?" for someone who's never contributed.
- **No wall.** You shouldn't need GitHub, or code, to design a ship, write a character or report a bug. GitHub stays for those who want it.
- **Credit where it's due,** visibly, on the site and in the game.
- **Close the loop.** Ideas you vote for should be seen to move: designed, building, built.

## 1. One source of truth *(built)*

Every design document starts with a short header:

```yaml
---
title: Exploration
status: building          # idea, proposed, designed, building or built (or guide)
pillar: explore           # trade, fight, explore or build
summary: One or two sentences for the roadmap and the library.
card: cobra-mk3           # the ship on its share card
stages:                   # optional: a design built in stages
  - Stage 1: reasons to go, things to spend on | built
  - Stage 2: worlds you can watch change | proposed
help:                     # what someone could pick up, and the skill it needs
  - Write a trail: clues across several systems, with their people | writing
---
```

From those headers the site makes:

- **The roadmap** (`/roadmap/`): every feature under one of the four things a commander does (Trade, Fight, Explore and Build), with its status, its stages as a row of steps, and how much help it wants. Building first, then designed, proposed, ideas; built last.
- **The design library** (`/design/`): every design document, all of them now, with its status.
- **Help wanted** (on `/get-involved/`): every task from every design, grouped by skill (ships, writing, art, playtesting, design, code), each linked to its design.
- **Each design's page** shows its status, stages and help wanted above the text.

The README keeps a short summary and points to the roadmap page, so there's nothing to keep in step by hand.

## 2. Item pages and the ideas board *(proposed)*

- Each design's page lists the ideas board's suggestions about it (matched by keywords in its header), with their votes, and a button to suggest one with the design's name filled in (as ship pages already do).
- An idea taken into a design is marked so on the board, with a link to the design, and moves with it: planned, building, built.
- Signed-in voters hear when an idea they voted for moves.

## 3. A ship editor in the browser *(proposed)*

The biggest unlock for people who'll never use git. Draw a ship from points and faces (or start from one in the fleet), see it glow in neo-vector, turn it, check it against the rules (size, schema, the homage rules) as you go, give it a name, a maker and a story, and **submit** it. Submissions wait in a queue; a maintainer turns the good ones into pull requests, crediting the designer. Ships already have every field the editor needs.

Its submit button uses the same submission system as the AI connector ([the Build connector plan](mcp-server.md)), so a ship from the editor and a ship from a chat land in one queue. The submission system is built first, on the server; the editor follows on the site.

## 4. The writers' room, profiles and credit *(proposed)*

- **The writers' room:** forms for the content the game needs most (saloon characters, rumours, trail stories, station descriptions, Legends' logs), each with the tone guide beside it and examples, into the same queue.
- **Contributor profiles:** who made what, from the credits in content files and the commit history.
- **Credit in the game:** authors on ship pages and in the game's own credits; a station or a Legend named for the community's most generous contributors; and, at the top of the ladder, running a station ([player stations](player-stations.md)).
- **Playtest reports from inside the game:** a photo (P) and a note, straight to the queue.

## Open questions

- Who looks after the submission queue, and how quickly should a submitter hear back?
- Should submissions be public while they wait (so others can comment), or private until accepted?
