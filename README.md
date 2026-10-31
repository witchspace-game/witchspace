# Witchspace

**An open-source, browser-based space trading game. A love letter to *Elite* (1984).**

Start with a Cobra Mk III and 100 credits. Trade, fight, mine, smuggle or hunt bounties across a procedurally generated galaxy, together with your friends, right in your browser.

Witchspace keeps the soul of the original (crisp vector ships, hidden-line wireframes, that impossible first docking) and renders it the way a BBC Micro never could: glowing neon lines, as smooth as your screen can show them. Press **M** at any time to drop back to 1984 mode: white on black, hard pixels and the pixel font, sharpened for modern screens. Add `?pixels` to the address for the original 256×192.

> Witchspace is an unofficial fan tribute. It is not affiliated with or endorsed by Frontier Developments, who own the *Elite* trademark. See [CREDITS.md](CREDITS.md).

## Status

🚧 **Early but playable.** Launch from a Coriolis station, fly the Cobra Mk III, and try to dock, by hand or with the docking computer and its waltz. **Modern** rules are Witchspace: forgiving, insured, crime doesn't pay, with trading companies, contracts and the shared galaxy. **Classic** rules (single-player, one life, as in 1984) are kept as they were but frozen: bug fixes only, no new features. The choice belongs to your commander and can't be switched later. Trading, combat, exploring, company contracts and the radio are in; flying with other commanders is in beta. See the [roadmap](#roadmap).

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
| Right click | Centre the aim and level the wings |
| Hold right + mouse | Roll with the nose held steady; the ship keeps that bank |
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
| L | Launch from the station. In flight: hail the ship in your sights (Modern) |
| T | In flight: arm a missile. Hold a ship in your sights and the seeker box closes on it over a second; when the tone goes solid it's locked (Classic locks at once). Docked: the market: buy and sell goods (when docked). Under Modern rules it's a full exchange: pairs, a live candlestick chart, the order book and market orders. Market or limit orders: a limit order holds your credits or goods and fills when the price reaches yours, even while you're away; bought goods wait in the station's storage. Stations post their own orders when they're short or overstocked. Cargo scooped from a clean ship you destroyed is **stolen**: stations with a law won't buy it and police will seize it, but a fence in the back room will take it for less. Contraband goes through the **back room**, where the stricter the law, the better it pays and the likelier the buyer is police; lawful worlds have abolitionists who buy slaves to free them. The **News** tab shows events nearby: famines, strikes, wars and more, as they reach the station at the speed of ships |
| X | Launch the locked missile |
| Z | ECM: destroy every missile nearby (needs an ECM) |
| C | Docking computer (once you've bought one) |
| O | Combat computer: it flies, you man the turrets (needs one fitted) |
| 9 | Survey autopilot: flies to whatever is left to survey here (explorers, Modern) |
| U | Surrender to the police: the ship stops itself, and 5 seconds later you're escorted in (a fine, and a clean record here) |
| 0 | Transponder off / on: run dark, unidentified (Modern) |
| ' | Radio log (Modern): station traffic, police, pirates, traders and the companies, in one place |
| Enter | In flight: accept the latest offer on the radio |
| \` | Emergency beacon (Modern): Mayday, out of fuel, hull failing, request escort (then 1–4) |
| 1 2 3 4 / V | Look front, rear, left or right; fire uses that mount's laser |
| B | Energy bomb (single use) |
| P | Photo of the view, without the HUD |
| K | Switch control scheme |
| H | Hyperspace to your chosen destination (10 second countdown; H again cancels) |
| J | In-system jump: leap about 10 km ahead, unless ships, the station or the planet are too close |
| R | Scanner range: 4 km for dogfights, 12 km for traffic. Ships are bars, cargo boxes, missiles darts; the ship in your sights is bracketed, and contacts beyond range show as arrows on the rim |
| G | Galaxy map. Tab switches galactic and local charts; arrows or click select; Enter sets your destination |
| I | Invert pitch (remembered) |
| M | Toggle neo-vector / 1984 mode |
| N | Sound: full / effects only (no engine hum) / off (remembered) |
| F1 | Controls card |

**On a phone or tablet:** drag on the left to aim, slide the speed bar, and Fire, the missile button and ECM sit under your right thumb. Everything else is in a drawer behind the ‹ tab at the top right, and the obvious next step (Dock, Survey, Hyper or Jump) comes out of the drawer by itself. Add the game to your Home Screen for full screen.

**Contracts in flight:** a strip at the top left (a small pill on a phone) says what you're carrying, where, how many jumps are left, and the next step, with a button to set the course. When a fight ends the computer tells you what's next, and approaching a station, traffic control mentions any job on its board that goes your way.

**Gamepad:** left stick pitches and rolls, right stick yaws, triggers set speed, A launches and runs the docking computer, Y toggles 1984 mode.

**Combat:** shoot a police Viper and you become a Fugitive. Every Viper turns on you, and the station launches reinforcements. Firing on the station gets one warning (you become an Offender); keep firing and you're a Fugitive. Lawful stations won't let you launch without a working transponder: a broken one is repaired first (free if you can't pay). Under **Modern** rules your lasers won't fire with the station in the line of fire unless you hold the trigger to override, and under both rules they're locked while the docking computer flies. Within 2 km your scanner reads another ship's hold, and pirates' scanners read yours: valuable cargo draws attention. Inbound traders carry the station's real deliveries, so destroying one leaves the station short. Watch the laser temperature (LT) gauge: hold fire too long and it overheats. Under **Classic** rules losing your ship clears your record. Under **Modern** rules your insurers replace the ship and kit, all of it in working order, less an excess (a tenth of the kit's value, at least 250 Cr), with a full tank, and never leave you with less than the 100 Cr you started with. The record stands, and they won't pay for a Fugitive: you get a bare Cobra instead, unless you fitted an escape pod. Surrendering (U) is usually cheaper.

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

The **Witchspace MCP server** is live at `https://space.witchspace.org.uk/mcp`: tools to read the ships, validate, preview and balance-check a design, look up any system, see what help is wanted and hand your work in for review, from Claude, ChatGPT, Cursor and other MCP clients. Setup is at [witchspace.org.uk/get-involved](https://witchspace.org.uk/get-involved/).

## Roadmap

**The roadmap lives at [witchspace.org.uk/roadmap](https://witchspace.org.uk/roadmap/)**: every feature, what's built, what's being built and what's next, and where you could help. It's made from the short header at the top of each design document in [`docs/design/`](docs/design) (status, stages and help wanted), so it's never out of date. See [the community platform](docs/design/community-platform.md) for how that works.

In short: the core game is built (flight, docking, trading, combat, the law and eight galaxies, on desktop and phone). Trade, Fight and Explore are deep and getting deeper (company contracts, a living exchange, the Marshals, surveys, trails and shipyards). Shared space is in beta, and accounts are in. Still to come: talking to other commanders, a shared economy, Legends, a ship editor in the browser, and stations run by players.

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
