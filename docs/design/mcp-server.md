---
title: The Witchspace MCP server
status: building
pillar: build
summary: Bring your own AI. One web address lets Claude, ChatGPT or Cursor validate, preview and balance-check a ship, read every design and help-wanted task, and look up any system in the galaxy. Later, the live galaxy for players, public news only.
card: coriolis
stages:
  - Contributors - validate, preview and balance-check ships; the designs and help wanted; galaxy lookups | built
  - Submissions - send a checked design to the queue from the conversation | proposed
  - Players - the live galaxy, public news only | proposed
  - New content types as they arrive - characters, events, missions | proposed
help:
  - Try it with your own assistant and tell us what it got wrong | playtest
  - Write the prompts that make a good first ship with it, as a guide for newcomers | writing
  - Suggest a tool you'd want your assistant to have | design
---

# Design: the Witchspace MCP server

*Design, 24 October 2026. Stage 1 built and live at https://space.witchspace.org.uk/mcp; the rest proposed.*

## Why

Witchspace is built to work with AI assistants: every content type has a strict schema, and `AGENTS.md` tells any assistant how to contribute well. The Get involved page has promised "a Witchspace MCP server so assistants can validate, preview and balance-check content directly". This is that.

MCP (the Model Context Protocol) lets an assistant use tools a service provides. With a Witchspace server added, someone can say *"design a pirate gunship for Witchspace"* and their assistant can check its own work against the real rules, draw it, compare it with the class it belongs to, and know which tasks are wanted, without the person needing GitHub, code or our repo on their machine. That's "no wall" from [the community platform](community-platform.md).

## Principles

- **One address, nothing to install.** A remote MCP server on the Worker we already run: add `https://space.witchspace.org.uk/mcp` to Claude, ChatGPT or Cursor and it works. A local version runs from the repo for people who code.
- **The same truth as the site.** Every answer comes from the code and files the game and site use: the schemas, `validate.ts`'s rules, the design headers, the galaxy generator. Nothing is copied by hand.
- **Read-only until a person says so.** Tools look and check; nothing is changed or submitted without the person asking, in the conversation.
- **Never a shortcut through the game.** Players get public information (what the news says, where yards are building, what a system is), never the answers the game asks them to earn: no best trade routes, no price predictions, no where-the-Falcon-is. Learning the exchange should pay ([trading](trading.md)).
- **Honest about authorship.** The person is the author; contributions made with it are marked AI-assisted, as `AGENTS.md` asks.

## 1. Contributors *(built)*

Tools:

| Tool | What it does |
|---|---|
| `validate_ship` | Checks a ship file against `schemas/ship.schema.json` and the geometry rules in `validate.ts` (closed, convex parts, face winding, size), and the written rules: a class, a maker, a reason to exist ([ships, classes and makers](ships-and-classes.md)), and the homage rule (evoke, never copy an on-screen design). Returns every problem, with how to fix it. |
| `preview_ship` | Draws the ship as wireframe pictures (three-quarter, front, side, top) with a Cobra Mk III beside it for scale, returned as an image. |
| `balance_check` | Compares the ship's stats with its class in the class table: "fast for a bulk trader, and its hold is a third of a Python's". |
| `list_ships`, `get_ship` | The fleet, and any ship's file, so an assistant can learn from real ones. |
| `designs`, `get_design` | The roadmap and every design document: status, stages, summary, and the text. |
| `help_wanted` | Every open task, by skill (ships, writing, art, playtest, design, code), with the design it belongs to. |
| `galaxy_system` | Any system by name or number: government, economy, tech level, population, position, neighbours within 7 light years, and its description, so stories and missions land somewhere real. |
| `worldbuilding` | The tone guide, the companies and the people, for writing that sounds like Witchspace. |

Resources: the ship schema, `AGENTS.md`, `CONTRIBUTING.md`, the worldbuilding guide and the lore, so an assistant can read them before it starts.

**How it's built.** A route on the existing Worker (`server/src`) speaking MCP's streamable HTTP transport. The JSON Schema check is compiled at build time (Ajv's standalone output), since Workers can't compile code at run time; the geometry checks, the galaxy generator and the doc headers are plain TypeScript the Worker can import. Previews are drawn as SVG on the server (the same projection the game uses, without WebGL), so no browser is needed. A small stdio wrapper (`npx tsx tools/mcp.ts`) serves the same tools locally.

**Limits.** Rate-limited per address; inputs capped in size; no accounts needed for stage 1, since nothing is written.

## 2. Submissions

`submit_ship` sends a design that has passed `validate_ship` to the submission queue planned in the community platform (stage 3, the ship editor), with the person's name or callsign and a note, and returns a link to watch it. A maintainer turns good ones into pull requests, credited. This needs the queue to exist first, and an account (a sign-in link, as the game already uses) so submissions have an author and can be limited.

## 3. Players

The live galaxy, from the same seed and clock every commander shares, public information only:

| Tool | What it does |
|---|---|
| `news_at` | The news as it reaches a system now, as its station's News tab shows it. |
| `yards` | Where Wexley-Yorozu's Titanoboa is building, and what stage it's at. |
| `firsts` | Who first surveyed a world: the names on the chart. |
| `rules` | How something in the game works, from the design documents ("how does insurance work?"). |

Not included, on purpose: prices, routes, the best trade, where a pirate or a Legend is. A commander's own save stays private; if commanders later want their assistant to see their own commander (cargo, contracts, standing), that's an opt-in with a sign-in, and still no answers the game should make them earn.

## 4. New content types

As characters, events, trails and missions become data files with schemas, each gets its `validate_*` tool and examples, and the worldbuilding checks (every story has people, with their glad, sad, mad and bad moments; no real company names).

## Open questions

- Should the player tools be in the same server as the contributor tools, or a separate address, so a player adds only what they need?
- How generous should the rate limits be before submissions exist?
- Do we list it in the public MCP directories at launch, or wait until stage 2?
