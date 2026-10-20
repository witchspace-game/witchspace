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

| Keyboard | Action |
| --- | --- |
| Y / N | Load your commander / start a new one |
| L | Launch from the station |
| W / S or ↑ / ↓ | Pitch (dive / climb). X also climbs, as on the BBC. Tap for fine control, hold to turn harder |
| A / D or ← / → | Roll. `<` and `>` work too |
| Space / Shift | Speed up / slow down |
| C | Docking computer (once you've bought one) |
| M | Toggle neo-vector / 1984 mode |
| N | Sound on / off (in flight) |

**Mouse:** click the game while flying to capture the mouse. It then works as a joystick: move it forwards and back to pitch, left and right to roll, and scroll to change speed. Esc releases it.

**Gamepad:** left stick to fly, right/left triggers for speed, A for launch and the docking computer, Y for 1984 mode.

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

1. **Core game.** ✅ Flight, docking, docking computer, Classic and Modern rules. Next: trading, fuel scoops, combat and a procedural galaxy (8 galaxies × 256 systems) with witchspace jumps.
2. **Legends.** Rare, secret encounters hidden around the galaxy: easter-egg ships that tip their hat to great science fiction (a derelict with a gravity drive that should never have been switched on, a survey ship bound somewhere it shouldn't go, a small blue box that isn't there when you get close), plus tributes to *Elite*'s own legends such as the cloaked Cougar. There's no in-game list; you find them, screenshot them and tell everyone. A Legends log on the docked screen records your sightings. **A great first contribution.** See [CONTRIBUTING.md](CONTRIBUTING.md#legends-and-homages).
3. **Shared space.** See and fly with other commanders in the same system.
4. **Persistence.** Accounts, saved commanders and a living shared economy.
5. **Community tools.** MCP server, in-browser ship editor, missions and modding.

## Tech

TypeScript · [three.js](https://threejs.org) · [Vite](https://vitejs.dev). Multiplayer will use a WebSocket game server.

## Contact

- General: [hello@witchspace.org.uk](mailto:hello@witchspace.org.uk)
- Code of conduct reports: [conduct@witchspace.org.uk](mailto:conduct@witchspace.org.uk)
- Security issues: see [SECURITY.md](SECURITY.md)

Questions and ideas are best raised in [GitHub Discussions](https://github.com/witchspace-game/witchspace/discussions), where everyone can join in.

## Licence

- **Code:** [GPL-3.0](LICENSE). Forks stay open.
- **Content** (ships, worlds, missions, text, art): [CC BY-SA 4.0](CONTENT_LICENSE.txt). Contributions stay free and credited.
