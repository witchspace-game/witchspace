# AGENTS.md

Guidance for AI assistants (Claude, ChatGPT, Grok, Cursor, Copilot and others) working on Witchspace. Human contributors may find it useful too.

## What this project is

Witchspace is an open-source, browser-based space trading game and a tribute to *Elite* (1984). It is written in TypeScript with three.js and Vite. Its signature look is **neo-vector**: glowing wireframe ships with hidden-line removal, plus a switchable authentic **1984 mode** (white on black with hard pixels, drawn at about three times the original 256×192 for comfort; `?pixels` gives the original resolution).

**Rules:** Modern rules are the game and get all new work. Classic rules (the 1984 rules, single-player) are **frozen**: fix bugs, but don't add Classic features or Classic variants of new features. The 1984 *look* (M) is separate and stays supported under both rules.

Most contributions are **content files** (JSON validated by JSON Schema), not code.

## Repository map

| Path | What |
| --- | --- |
| `content/ships/*.json` | One ship or station per file. Bundled automatically. |
| `content/modules/*.json` | Titanoboa sections, each to the coupling standard (docs/design/ship-the-titanoboa.md). |
| `schemas/*.schema.json` | The source of truth for every content format. Read it before writing content. |
| `src/content/types.ts` | TypeScript mirror of the schemas. Keep them in sync. |
| `src/content/geometry.ts` | Geometry rules shared by the game and the validator. |
| `src/render/` | three.js rendering. |
| `src/game/`, `src/economy/`, `src/ui/`, `src/net/` | Flight, combat and the law; markets, events and companies; screens and HUD; accounts and shared space. `src/main.ts` ties them together. |
| `site/`, `src/site/` | The website (witchspace.org.uk): pages in `site/pages/`, built by `tools/build-site.ts` along with the design, ship and roadmap pages. |
| `server/` | The Cloudflare Worker at space.witchspace.org.uk: shared space, accounts, the ideas board, clips, notifications and the MCP server. Has its own `package.json`. |
| `relay/` | A small price relay for the Bitcoin exchange. |
| `tools/validate.ts` | Content validator CLI. |
| `docs/worldbuilding.md` | Tone, setting and naming. Read it before writing flavour text. |
| `docs/lore.md`, `docs/companies.md` | The canon: the galaxy as its people know it, and the four trading companies. |
| `docs/ideas.md` | The ideas backlog, not yet designed. |
| `docs/design/` | Agreed designs, written before building. Built ones end with an "As built" section. Read the relevant one before implementing or changing a feature, and update it when you do. |

## The Witchspace MCP server

If your client supports MCP, connect to `https://space.witchspace.org.uk/mcp` (streamable HTTP, read-only, no sign-in), or run it locally from the repo with `claude mcp add witchspace -- npx tsx tools/mcp.ts`. It gives you `validate_ship`, `preview_ship` (a PNG of four views beside a Cobra), `balance_check`, `list_ships`, `get_ship`, `designs`, `get_design`, `help_wanted` and `galaxy_system`, and the design documents and the lore as resources. Use them: check and preview every ship you draft before showing it to the person. See docs/design/mcp-server.md.

## Workflow for creating content

1. Read the relevant schema in `schemas/` and one or two existing examples.
2. Read `docs/worldbuilding.md` for tone.
3. Write the file. Its `id` must match its file name.
4. Run `npm run validate -- --fix path/to/file.json` and fix every error. Treat warnings seriously.
5. If you can, run `npm run dev` and look at the result. Visual sanity matters: check that it's symmetric where it should be, that it isn't inside out, and that detail lines aren't buried in the hull.
6. Set `credits.aiAssisted` to `true`. Put the human contributor in `credits.authors`; never list yourself as the author.

## Ship design tips

- +Z is forward (the nose), +Y is up and +X is port (left), as in glTF. Units are metres. Typical fighters are 30–60m long, traders 40–90m and stations around 160m.
- Design the silhouette first. Most iconic ships have 5–20 vertices.
- Faces must be flat and convex. Split anything else into triangles.
- Make hulls closed (every edge shared by exactly two faces). Use `--fix` for winding instead of reasoning about it by hand.
- Mirror ships across X: if `[x, y, z]` exists, `[-x, y, z]` usually should too.
- Detail lines (`geometry.details`) sit 0.2–0.5m outside the hull surface, or the depth test hides them. So does an `insignia` (a small mark in its own colour; keep it subtle).
- Never imitate police markings (beacons, hull bands) on non-police ships. The game adds them to the `police` role only.

## Design principles

- **The neo glow is the signature.** Never dim a hull's glow to make a point; menace comes from shape and behaviour.
- **Elegance over detail.** One clear shape that says what a thing is, in a handful of lines. No windows, pipes or panels.
- **It plays on a phone.** Every screen and control works by touch and at phone width, as well as with mouse and keyboard.
- **Look at it.** Check visual changes in a browser, at desktop and phone width, before calling them done.
- **Design before building.** New features get a design document first; credit an idea to whoever had it, as "(Name)".
- **Be honest on the page.** No claims the game doesn't back up; say what's built, and label what isn't.

## Hard rules

- **Never reproduce copyrighted material from *Elite*, *Elite Dangerous*, *Oolite* or other games.** That includes source code, ship vertex/face data, manual or in-game text, and art, even if you remember it. Original *Elite* ship **names**, and the original's shipbuilder names (Cowell & MgRath, Faulcon deLacy, Zorgon Petterson), are allowed as a deliberate tribute (see `CREDITS.md`), but geometry, stats tables and descriptions must be newly created.
- **Homages to films, TV and books** (e.g. legend ships) may use evocative names and hinting flavour text, but never reproduce an actual on-screen design, logo, insignia or quoted dialogue. Design from the idea, not from memory of the reference. See "Legends and homages" in `CONTRIBUTING.md`.
- Don't add runtime dependencies without discussing it in an issue.
- Don't weaken the schemas or the validator to make content pass.
- Code is GPL-3.0 and content is CC BY-SA 4.0. Don't add files under other licences.

## Commands

```bash
npm run dev         # dev server on http://localhost:5173
npm run validate    # validate all content (add -- --fix to fix winding)
npm run typecheck   # TypeScript
npm run build       # typecheck + production build
npm test            # unit tests (vitest)
npm run preview:headers   # production build served with the real security headers
cd server && npx tsc --noEmit   # the server typechecks separately
```

Before opening a pull request, run the typecheck, tests, validate, build and the server typecheck.

## Code style

- TypeScript strict mode, ES modules, no framework on the client.
- Keep `src/content/geometry.ts` free of three.js so it runs in Node.
- Comment the *why*, not the *what*. Small focused modules.
