# Witchspace

**An open-source, browser-based space trading game. A love letter to *Elite* (1984).**

Start with a Cobra Mk III and 100 credits. Trade, fight, mine, smuggle or hunt bounties across a procedurally generated galaxy, together with your friends, right in your browser.

Witchspace keeps the soul of the original (crisp vector ships, hidden-line wireframes, that impossible first docking) and renders it the way a BBC Micro never could: glowing neon lines at 144fps on any screen. Press **M** at any time to drop back to 1984 mode: white on black, hard pixels and the pixel font, sharpened for modern screens. Add `?pixels` to the address for the original 256×192.

> Witchspace is an unofficial fan tribute. It is not affiliated with or endorsed by Frontier Developments, who own the *Elite* trademark. See [CREDITS.md](CREDITS.md).

## Status

🚧 **Early but playable.** Launch from a Coriolis station, fly the Cobra Mk III, and try to dock, by hand or with the docking computer and its waltz. **Modern** rules are Witchspace: forgiving, insured, crime doesn't pay, with trading companies, contracts and the shared galaxy. **Classic** rules (single-player, one life, as in 1984) are kept as they were but frozen: bug fixes only, no new features. The choice belongs to your commander and can't be switched later. Trading, combat and multiplayer are next. See the [roadmap](#roadmap).

## Play it now

**🚀 [witchspace.org.uk/play](https://witchspace.org.uk/play/)**. It runs in any modern browser, with nothing to install. The website at [witchspace.org.uk](https://witchspace.org.uk) has the design documents and how to get involved.

## Play it locally

```bash
git clone https://github.com/witchspace-game/witchspace.git
cd witchspace
npm install
npm run dev
```

Then open http://localhost:5173/play/ for the game, or http://localhost:5173 for the website.

Witchspace has two control schemes. Press **K** in flight to switch, and **F1** (fn + F1 on a Mac) to see the controls card.

**Mouse + keyboard (default).** Click the game to capture the mouse, then move it to aim: the ship turns to put its nose on the ring.

| Control | Action |
| --- | --- |
| Mouse | Aim (Esc releases the mouse) |
| Left click / F | Fire. Lasers fire straight ahead at the centre cross, which turns red on target. Fit a **Gimballed Laser Mount** (Modern rules) and they hit whatever is under the ring instead, at 80% damage |
| Right click | Centre the aim and stop turning |
| W / S | Throttle up / down |
| A / D | Roll |
| Q / E | Yaw (fine sideways adjustment) |
| Scroll / swipe | Throttle. Sideways swipe on a Magic Mouse or trackpad rolls |

**Keyboard only (classic).** Close to the BBC original.

| Key | Action |
| --- | --- |
| W / S | Dive / climb |
| A / D | Roll (`<` and `>` work too) |
| Space / Shift | Throttle up / down |
| F | Fire (fixed lasers, straight ahead, as in 1984) |

**Both schemes**

| Key | Action |
| --- | --- |
| Y / N | Load your commander / start a new one (press N twice: it replaces your current commander) |
| L | Launch from the station |
| T | Market: buy and sell goods (when docked). Under Modern rules it's a full exchange: pairs, a live candlestick chart, the order book and market orders. Market or limit orders: a limit order holds your credits or goods and fills when the price reaches yours, even while you're away; bought goods wait in the station's storage. Stations post their own orders when they're short or overstocked. Cargo scooped from a clean ship you destroyed is **stolen**: stations with a law won't buy it and police will seize it, but a fence in the back room will take it for less. Contraband goes through the **back room**, where the stricter the law, the better it pays and the likelier the buyer is police; lawful worlds have abolitionists who buy slaves to free them. The **News** tab shows events nearby: famines, strikes, wars and more, as they reach the station at the speed of ships |
| C | Docking computer (once you've bought one) |
| H | Hyperspace to your chosen destination (10 second countdown; H again cancels) |
| J | In-system jump: leap about 10 km ahead, unless ships, the station or the planet are too close |
| R | Scanner range: 4 km for dogfights, 12 km for traffic. Ships are bars, cargo boxes, missiles darts; the ship in your sights is bracketed, and contacts beyond range show as arrows on the rim |
| G | Galaxy map. Tab switches galactic and local charts; arrows or click select; Enter sets your destination |
| I | Invert pitch (remembered) |
| M | Toggle neo-vector / 1984 mode |
| N | Sound: full / effects only (no engine hum) / off (remembered) |
| F1 | Controls card |

**Gamepad:** left stick pitches and rolls, right stick yaws, triggers set speed, A launches and runs the docking computer, Y toggles 1984 mode.

**Combat:** shoot a police Viper and you become a Fugitive. Every Viper turns on you, and the station launches reinforcements. Firing on the station gets one warning (you become an Offender); keep firing and you're a Fugitive. Under **Modern** rules your lasers won't fire with the station in the line of fire unless you hold the trigger to override, and under both rules they're locked while the docking computer flies. Within 2 km your scanner reads another ship's hold, and pirates' scanners read yours: valuable cargo draws attention. Inbound traders carry the station's real deliveries, so destroying one leaves the station short. Watch the laser temperature (LT) gauge: hold fire too long and it overheats. Under **Classic** rules losing your ship clears your record. Under **Modern** rules your insurers replace the ship and kit, less an excess (a tenth of the kit's value, at least 250 Cr), with a full tank, and never leave you with less than the 100 Cr you started with. The record stands, and they won't pay for a Fugitive: you get a bare Cobra instead, unless you fitted an escape pod. Surrendering (U) is usually cheaper.

**Scooping cargo:** fit **Fuel Scoops**, then fly slowly (under 40% speed) straight into a cargo canister, the yellow dots on the scanner. It goes into the hold automatically.

**Docking tip:** the station spins. Under **Modern** rules your ship matches the spin for you once you're close and pointing at the slot ("Roll match" lights up); just steer in and don't touch roll. Under **Classic** rules you keep rolling with it yourself, all the way in, as in 1984. In neo-vector mode, the glide path and docking aid show how far out you are.

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

Design notes for upcoming systems live in [`docs/design/`](docs/design). Start with [law, travel, debt and capture](docs/design/law-and-travel.md). Ideas that aren't designed yet are collected in the [ideas backlog](docs/ideas.md). There are also open proposals for [the economy and exchanges](docs/design/economy-and-exchanges.md), [stations and worlds](docs/design/stations-and-worlds.md), [ship condition and servicing](docs/design/ship-condition.md), [the combat rating and combat missions](docs/design/combat-rating.md), [markets and trade](docs/design/markets-and-trade.md), [system currencies](docs/design/system-currencies.md), [servers and hosting](docs/design/servers-and-hosting.md) and [player-run stations](docs/design/player-stations.md), awaiting community discussion.

1. **Core game.** ✅ Flight, docking and the docking computer, trading, combat, the law, fuel scoops, and a procedural galaxy (8 galaxies × 256 systems) with witchspace jumps. Modern rules are the game; Classic (the 1984 rules) is kept as it was, frozen. Plays on a phone too: add it to your Home Screen for full screen, with touch controls and a chart made for thumbs.
2. **Trade, Fight and Explore, deeper.** 🚧
   - **Trade** ✅ Company contracts (cargo supplied, paid on delivery, routes plotted) from Hexon Holdings, Vorg Industries, the Carriers' Mutual and Wexley-Yorozu, with [their own careers page](https://witchspace.org.uk/careers/); standing with each, files they keep on you, and special assignments that can reach your phone or inbox, and go wrong (police, blackmail, pirates, outbreaks); a living exchange with charts, an order book and limit orders; a trade computer with live prices at every market in range; risk pays, in lawless systems and crises; supply chains, world events and news that travels; a black market, stolen goods and the fence. Next: [Merchants](docs/design/markets-and-trade.md#5-merchants-trading-without-flying), players who trade without flying.
   - **Fight** ✅ Pirates, police and the Co-operative Marshals, whose carrier comes through a witchspace rift; missiles and ECM; a combat computer for turret gunners. **Next, now in progress:** [the law beyond the station](docs/design/companies-and-contracts.md#4-the-law-beyond-the-station): crimes in the lanes need a witness, distress calls bring the police, ships can run dark, and police hail before they shoot. Then escorts and company security, a Marshals career for Dangerous commanders, and [combat missions and the new rating](docs/design/combat-rating.md).
   - **Explore** 🚧 Ringed worlds and moons; surveys of planets, moons and stars whose data sells for more the further you carry it; derelicts, beacons and wreck fields with their logs and salvage; a chart that remembers where you've been; and an explorer's rank. Next: [witchspace misjumps, Legends, explorer's kit and first discoveries in the shared galaxy](docs/ideas.md#exploration).
3. **Shared space.** 🚧 Live in beta: fly with other commanders in the same system (press S on the title screen, Modern rules). Callsigns and rank insignia; lasers, missiles, ECM and collisions refereed by the server. Next: [ship registry and flags](docs/design/law-and-travel.md#ship-registry-and-flags).
4. **Persistence.** 🚧 Accounts are in: email sign-in (link or code), your own callsign, a cloud save across devices, and opt-in messages from the companies. Next: commanders kept on the server, a shared economy and the [fair play](docs/design/servers-and-hosting.md#9-fair-play) rules; guilds and team insignia.
5. **Legends.** Rare, secret encounters hidden around the galaxy: easter-egg ships that tip their hat to great science fiction (a derelict with a gravity drive that should never have been switched on, a survey ship bound somewhere it shouldn't go, a small blue box that isn't there when you get close), plus tributes to *Elite*'s own legends such as the cloaked Cougar. There's no in-game list; you find them, screenshot them (press P) and tell everyone. A Legends log on the docked screen records your sightings. **A great first contribution.** See [CONTRIBUTING.md](CONTRIBUTING.md#legends-and-homages).
6. **Community tools.** MCP server, in-browser ship editor, missions and modding.
7. **Player, community and AI-run stations** *(proposal)*. Frontier outposts run by commanders and guilds, community-governed stations, and stations run by AI agents with community-written personalities, all within guarantees that keep the galaxy fair. Running a station is earned by contributing to Witchspace, and commanders can invest their trading profits in station upgrades. See the [proposal](docs/design/player-stations.md).

## Tech

TypeScript · [three.js](https://threejs.org) · [Vite](https://vitejs.dev). Multiplayer will use a WebSocket game server; see [servers and hosting](docs/design/servers-and-hosting.md).

## Contact

- General: [hello@witchspace.org.uk](mailto:hello@witchspace.org.uk)
- Code of conduct reports: [conduct@witchspace.org.uk](mailto:conduct@witchspace.org.uk)
- Security issues: see [SECURITY.md](SECURITY.md)

Questions and ideas are best raised in [GitHub Discussions](https://github.com/witchspace-game/witchspace/discussions), where everyone can join in.

## No pay-to-win

Witchspace is a non-commercial fan project, and nothing in the game can ever be bought with real money: no paid credits, currencies, ships or advantages. The in-game currencies are virtual and can't be cashed out. Everything is earned by playing or by contributing. If running costs ever need covering, it'll be through transparent donations with every penny public, and supporters get thanks, never power. See the [stations proposal](docs/design/player-stations.md#no-pay-to-win) for the reasoning.

## Licence

- **Code:** [GPL-3.0](LICENSE). Forks stay open.
- **Content** (ships, worlds, missions, text, art): [CC BY-SA 4.0](CONTENT_LICENSE.txt). Contributions stay free and credited.
