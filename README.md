# Witchspace

**An open-source, browser-based space trading game. A love letter to *Elite* (1984).**

Start with a Cobra Mk III and 100 credits. Trade, fight, mine, smuggle or hunt bounties across a procedurally generated galaxy, together with your friends, right in your browser.

Witchspace keeps the soul of the original (crisp vector ships, hidden-line wireframes, that impossible first docking) and renders it the way a BBC Micro never could: glowing neon lines at 144fps on any screen. Press **M** at any time to drop back to authentic 1984 mode, 256×192 pixels in white on black.

> Witchspace is an unofficial fan tribute. It is not affiliated with or endorsed by Frontier Developments, who own the *Elite* trademark. See [CREDITS.md](CREDITS.md).

## Status

🚧 **Early but playable.** Launch from a Coriolis station, fly the Cobra Mk III, and try to dock, by hand or with the docking computer and its waltz. Choose **Classic** rules (one life, as in 1984) or **Modern** rules (forgiving, insured). Trading, combat and multiplayer are next. See the [roadmap](#roadmap).

## Play it now

**🚀 [witchspace.org.uk](https://witchspace.org.uk)**. It runs in any modern browser, with nothing to install.

## Play it locally

```bash
git clone https://github.com/witchspace-game/witchspace.git
cd witchspace
npm install
npm run dev
```

Then open http://localhost:5173.

| Key | Action |
| --- | --- |
| Y / N | Load your commander / start a new one |
| L | Launch from the station |
| W / S or ↑ / ↓ | Pitch (dive / climb). X also climbs, as on the BBC |
| A / D or ← / → | Roll. `<` and `>` work too |
| Space / Shift | Speed up / slow down |
| C | Docking computer (once you've bought one) |
| M | Toggle neo-vector / 1984 mode |
| N | Sound on / off (in flight) |

**Docking tip:** the station spins. Line up with the slot and keep rolling with it all the way in. In neo-vector mode, the glide path and docking aid show how far out you are.

## Contribute a ship, a world or a mission

Most of Witchspace is **content, not code**. Ships are small JSON files in [`content/ships/`](content/ships), so you can design one without touching the engine. Drop a file in and it appears in the game automatically.

```bash
npm run validate          # check every content file
npm run validate -- --fix # also auto-fix face winding
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

### Bring your own AI 🤖

Witchspace is built to work with AI assistants such as Claude, ChatGPT, Grok and Cursor. Every content type has a strict JSON Schema, and [AGENTS.md](AGENTS.md) tells any AI everything it needs to know. Point your assistant at this repo and ask it to *"design a pirate gunship for Witchspace"*. It will write against the schema and check its work with the validator.

Coming soon: a **Witchspace MCP server** with tools to validate, preview and balance-check content directly from Claude Desktop, Claude Code and other MCP clients.

## Roadmap

Design notes for upcoming systems live in [`docs/design/`](docs/design). Start with [law, travel, debt and capture](docs/design/law-and-travel.md). There are also open proposals for [the economy and exchanges](docs/design/economy-and-exchanges.md) and [player-run stations](docs/design/player-stations.md), awaiting community discussion.

1. **Core game.** ✅ Flight, docking, docking computer, Classic and Modern rules. Next: trading, fuel scoops, combat and a procedural galaxy (8 galaxies × 256 systems) with witchspace jumps.
2. **Legends.** Rare, secret encounters hidden around the galaxy: easter-egg ships that tip their hat to great science fiction (a derelict with a gravity drive that should never have been switched on, a survey ship bound somewhere it shouldn't go, a small blue box that isn't there when you get close), plus tributes to *Elite*'s own legends such as the cloaked Cougar. There's no in-game list; you find them, screenshot them and tell everyone. A Legends log on the docked screen records your sightings. **A great first contribution.** See [CONTRIBUTING.md](CONTRIBUTING.md#legends-and-homages).
3. **Shared space.** See and fly with other commanders in the same system.
4. **Persistence.** Accounts, saved commanders and a living shared economy.
5. **Community tools.** MCP server, in-browser ship editor, missions and modding.
6. **Player, community and AI-run stations** *(proposal)*. Frontier outposts run by commanders and guilds, community-governed stations, and stations run by AI agents with community-written personalities, all within guarantees that keep the galaxy fair. Running a station is earned by contributing to Witchspace, and commanders can invest their trading profits in station upgrades. See the [proposal](docs/design/player-stations.md).

## Tech

TypeScript · [three.js](https://threejs.org) · [Vite](https://vitejs.dev). Multiplayer will use a WebSocket game server.

## Contact

- General: [hello@witchspace.org.uk](mailto:hello@witchspace.org.uk)
- Code of conduct reports: [conduct@witchspace.org.uk](mailto:conduct@witchspace.org.uk)
- Security issues: see [SECURITY.md](SECURITY.md)

Questions and ideas are best raised in [GitHub Discussions](https://github.com/witchspace-game/witchspace/discussions), where everyone can join in.

## No crypto, no pay-to-win

Witchspace is a non-commercial fan project, and nothing in the game can ever be bought with real money: no tokens, no NFTs, no paid credits, ships or advantages. Everything is earned by playing or by contributing. If running costs ever need covering, it'll be through transparent donations with every penny public, and supporters get thanks, never power. See the [stations proposal](docs/design/player-stations.md#no-crypto-no-pay-to-win) for the reasoning.

## Licence

- **Code:** [GPL-3.0](LICENSE). Forks stay open.
- **Content** (ships, worlds, missions, text, art): [CC BY-SA 4.0](CONTENT_LICENSE.txt). Contributions stay free and credited.
