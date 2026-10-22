# Ideas backlog

A parking spot for good ideas that aren't designed yet. When one is picked up, it gets a proper document in [`docs/design/`](design) and a link from here.

**The community decides what comes next.** Suggest ideas and vote them up or down on the [ideas board](https://witchspace.org.uk/ideas/), no account needed. Ideas with the most support are designed and built first, and the board shows them move to Planned and Built. For longer discussion there's the **Ideas** category of GitHub Discussions, and ideas can be added here through a pull request.

## Ships and combat

- **Multicrew ships.** Large ships crewed by several players at once: a pilot, gunners on turrets, an engineer routing power between shields, engines and weapons, a navigator plotting jumps and reading the scanner. Friends could crew a freighter or a warship together, and turrets would make rear and side weapons genuinely useful (see below). Needs multiplayer; it would also suit large ships that can only dock at big stations (see [stations and worlds](design/stations-and-worlds.md#3-ship-size-classes)).
- **Turrets and a look-around key.** Rear and side lasers that track whatever you're aiming at, with a key to swing your view while the ship keeps flying. This fixes the original's "fly blind to shoot backwards" problem.
- **Cargo weight.** A full hold makes a ship slower to turn and accelerate (Modern rules), so dumping cargo becomes an escape tactic.
- **Visible upgrades (hardpoints).** Ship files define mount points; each upgrade adds its own small wireframe part there. A gimballed mount shows as a turret that swivels towards your aim; damaged gear flickers or goes dark. Other pilots see your loadout when they target you, so a heavily armed ship *looks* dangerous, and police can spot unlicensed weapons (see [power and protection](design/law-and-travel.md#9-power-and-protection)). Upgrade parts become community content.
- **Station-killer weapons for missions.** Coriolis stations shrug off lasers, as in the original, where shooting one was mostly a way to farm the Vipers it launched. A rare, heavy weapon (a siege torpedo or similar) that can actually disable or destroy a station would be issued for [combat missions](design/combat-rating.md#5-combat-missions) against stations that have gone rogue: pirate-held, Thargoid-infested, or a [Meridian Compact](design/system-currencies.md#6-the-single-currency-a-union-with-an-agenda) fortress. Mission-only, never for sale, and using it anywhere else is the most serious crime there is. Needs a station-damage model (shields, hull, docking bay, defences) and a dramatic end for a station.
- **Join the Co-operative Marshals.** A career for commanders with a clean record, a high combat rating and a run of Marshal missions: they're issued a Lancer interceptor in Marshal livery and can answer warrants and blockades. The server issues the livery (nobody can paint themselves as the law), it's withdrawn the moment a Marshal commits a crime, and Marshals answer to the same law they enforce. Needs multiplayer, the combat rating and missions.
- **Combat computer upgrades.** The first combat computer (built, Modern rules, press O with a turret fitted) flies a textbook chase while you man the guns, and kills made with it count half. Later grades could fly better: a **military-grade** computer that jinks to spoil enemy aim, keeps the target in your turret's arc, and has Aggressive, Evasive and Escape modes, at military prices and tech levels. It still loses to a good pilot, and still tells you to strap in.
- **Buying other ships.** Trade up from the Cobra to faster, tougher or bigger ships, as in *Elite Plus* and *Frontier*.

## Travel

- **J in-system jump drive.** Jump most of the way to the planet or station in seconds, blocked by mass lock when ships are near, as in the original. (Part of the [travel pacing](design/law-and-travel.md#8-travel-pacing) design.)

## Exploration

**Built (first slice, src/game/explore.ts):** rings and moons from each system's seed; surveys (hold low over a planet, close to a moon, or hot by the star) whose data sells at any station, half price where gathered and up to five times far away; derelicts, beacons and wreck fields with written logs and salvage, revealed by surveying the planet or by flying near; a chart that rings visited systems and shows what you surveyed and found; explorer points and rank. Modern only, except the rings, moons and visited record. Still to do from the list below: misjumps, Legends, explorer's kit, first discoveries named in the shared galaxy, log clues that lead to the next system, a photo gallery, community content.

**Priority: Explore should be as good as Trade and Fight.** Trading now has a living exchange and fighting has the law, the Marshals and the combat computer. Commanders who'd rather wander the galaxy need the same depth: reasons to go somewhere new, things worth finding, and something to show for it.

- **Worlds worth visiting.** Every system already has its 1984 facts (economy, government, species) and a description written fresh for Witchspace. Bring that to life when you arrive: the planet's look from its seed (colour, bands, rings, moons), a short arrival card, and the occasional binary star, gas giant or ringed world. Rare systems become destinations.
- **Scan and survey.** Fly close to a planet, star or station and scan it; deep surveys take time and nerve (close orbits, sun skimming). Survey data sells at stations, more the further it is from where it was gathered, so explorers earn a living without trading or fighting.
- **Points of interest.** Derelicts, wreck fields, abandoned stations, signal sources, nebulae and dead stars, placed from each system's seed so everyone finds the same things. Many are small stories: a log to read, a cargo to salvage, a clue that points to the next system.
- **Legends,** already on the roadmap: the rare secret encounters. Exploration is how you find them.
- **Witchspace itself.** Misjumps that strand you between systems, Thargoid space, and rifts like the Marshals' that occasionally open on their own and lead somewhere unmarked.
- **The chart as a record.** The galactic chart remembers where you've been, what you've scanned and what you found, and fills in as you explore. Milestones for visiting every system in a galaxy, or reaching the far edge.
- **An explorer's rank.** Its own road, separate from combat and trading, earned by distance, discoveries and surveys. In the shared galaxy: first discoveries carry the finder's name, as the system's chart entry shows.
- **Explorer's kit.** Long-range fuel tanks, better scanners, a survey probe, and fuel scoops that matter more the further out you go.
- **Photos.** The P key already takes clean shots; a gallery of the best ones, by system, shows other commanders what's out there.
- **Community content.** Points of interest, logs and Legends as data files with a validator, like ships, so anyone can add a place worth finding.

## Multiplayer and communication

- **Radio.** Text channels for local radio (ships in range in the same system), station traffic control, direct hails to your target, and guild channels. **Opt-in proximity voice** that fades and crackles with distance and is positioned left and right like other ship sounds. Hail anything: stations, police and AI-agent commanders answer too. Distress calls go out over the radio so nearby players hear them. **Safety from day one:** mute, block and report; voice off by default; push-to-talk; optional filtering.
  - **Comms you can shoot out.** A basic short-range text radio comes standard. The **comms array** (longer range, voice, guild channels, wide broadcasts) is an **expensive, fragile, exposed upgrade**, visible on the hull as a hardpoint. Make a nuisance of yourself on the open channel and someone may simply shoot your transmitter off, which is a real loss.
  - **Safeguards:** every ship also has an armoured **emergency beacon** that can't be silenced (distress signals and station traffic control only, no chat), so griefers can't cut off a newcomer's call for help. Destroying someone's comms is still an attack and a crime in lawful systems. And this is an in-world consequence for being annoying, **not a substitute for real moderation**: abuse is handled by mute, block and report, never by having to win a dogfight.

## Community and content

- **Legends.** Rare, secret encounters and easter-egg ships that nod to great science fiction, plus tributes to *Elite*'s own legends. On the [roadmap](../README.md#roadmap); see the homage rules in [CONTRIBUTING](../CONTRIBUTING.md#legends-and-homages).
- **Witchspace MCP server.** Tools for AI assistants to validate, preview and balance-check content.
- **In-browser ship editor.** Design a ship visually and export a valid ship file.

## Play anywhere

- **Streamer and multitasking mode.** A compact pop-out window, a frame-rate cap, and an overlay-friendly layout for streaming software.
