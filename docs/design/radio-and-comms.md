# Design: radio, the comms array and the emergency beacon

*Proposed, October 2026. Change by pull request.*

Commanders can't talk to each other yet. Shared space carries positions, shots, missiles and hits, and nothing else. This design adds a way to talk that belongs in the world: a **radio** every ship has, a **comms array** that reaches further and can be shot off, and an **emergency beacon** that nobody can silence.

It builds on [servers and hosting](servers-and-hosting.md) (shared space, accounts, fair play), [law and travel](law-and-travel.md) (transponders, hails, crimes), [ship condition](ship-condition.md) (damaged kit) and [companies and contracts](companies-and-contracts.md) (the companies' messages). The idea started in [ideas](../ideas.md#multiplayer-and-communication).

## Principles

- **Safe from day one.** Mute, block and report ship with the first player message, not after it. Nobody can be made to read a stranger's words: player radio is opt-in, and the emergency beacon carries no chat at all.
- **Moderation is people's job, not the game's.** Shooting off someone's comms array is an in-world consequence for being a nuisance. It is never how abuse is handled. Abuse is handled by mute, block, report and a person reading the report.
- **Every ship has a radio.** The police hail you, stations clear you to dock and companies write to you, so a radio is part of every ship. The upgrade adds reach, not the basics.
- **In the world.** Range, static, a hardpoint on the hull you can lose. The radio has the same physics as everything else: close ships hear you clearly, far ones not at all.
- **Worth having alone.** Before any player speaks, the radio and the array already pay their way in single-player: distress calls, news at range, and every hail and clearance in one log.
- **Cheap to run.** Messages are a few hundred bytes through the system servers we already run. Nothing is stored except what a report needs.
- **Modern rules only.** Classic stays as it was in 1984, where the radio was the text at the bottom of the screen.

## The three pieces

| | **Radio** (every ship) | **Comms array** (upgrade) | **Emergency beacon** (every ship) |
|---|---|---|---|
| Range | Scanner range, about 12 km | The whole system; news and distress calls from a jump or two away | The whole system, and the station |
| Talks to | Your target, ships in range, the station, police | Everyone in the system: open broadcast, later guild channels | Station traffic control, police, anyone in the system who can help |
| Type | Text | Text, voice later | A short, fixed set of calls: Mayday, out of fuel, under attack, docking request |
| Can be damaged? | No | Yes: fragile, mounted outside the hull, shot off in combat | No: armoured |
| Cost | Fitted as standard | Expensive, high tech | Fitted as standard |

### The radio

Everything you hear goes into one **radio log**, a small panel that fades when it's quiet, so the flashes on screen today become things that were said by someone:

- **Station traffic:** "Meridian Station · Docking clearance granted".
- **Police:** hails, warnings, "Switch on your transponder".
- **Ships nearby:** traders thanking you for a rescue, pirates making demands, and (once players can talk) other commanders.
- **Hail your target** (a key or button): speak to whichever ship is in your sights. Police and stations answer; traders answer if they're not too frightened; pirates answer with threats or, sometimes, an offer.

Range is real. Messages from ships beyond scanner range don't arrive; near the edge they arrive with gaps and static.

### The comms array

An expensive, fragile, visible upgrade: a dish or mast on the hull that other ships can see and shoot.

- **Single-player, it's worth fitting for:**
  - **Distress calls.** Traders under attack anywhere in the system call for help. Arrive in time and you get a reward and standing with their company, and the Carriers' Mutual remembers who came.
  - **News at range.** The market events already in the game (famines, booms, strikes) reach you a jump or two early, so the commander with the array fills a hold with Food before anyone else hears.
  - **Listening.** Police chatter about where they're patrolling, and pirates arranging an ambush. Sometimes it's useful; sometimes it's bait.
- **In shared space, it also gives you:** an open broadcast to everyone in the system, and later guild channels and voice.
- **It can be lost.** A hit to the hull can damage it like other kit; pirates and the Falcon aim for it. Damaged, it works as a plain radio until repaired at a station. Shooting another commander's array is an attack, and a crime wherever there's law.
- **Rough numbers (to balance):** 4,000 Cr, tech level 9, repair 30% as for other kit.

### The emergency beacon

Armoured, built in and not chat. It sends only fixed calls, and always gets through:

- **Mayday** (under attack), **Out of fuel**, **Hull failing**, **Requesting escort to the station**.
- Police respond in lawful systems; nearby commanders see the call on the scanner and in the log, wherever they are in the system.
- It works when the array is shot off, and when the player who sent it has been muted or blocked by everyone. A newcomer's call for help can never be silenced.
- **Abuse:** false Maydays are rate-limited and, in lawful systems, an offence ("wasting police time": Offender). Responders aren't punished if the call was a trap, but pirates who use the beacon as bait get a reputation the police hear about.

## Talking to other commanders

### Who can transmit

- **Signed-in commanders only.** A message comes from an account and a callsign, so it can be traced, reported and stopped. Guests can listen (if they've switched player radio on) and send the fixed beacon calls, but not free text.
- **New accounts are limited:** a short wait (an hour or so of flying) before broadcasting to the whole system, so throwaway accounts are pointless for spam.
- **Quick phrases for everyone signed in:** "o7", "Thanks", "Need fuel", "Following you in", "Don't shoot". They're quick on a phone and need no moderation.

### Channels

| Channel | Who hears | Needs | Stage |
|---|---|---|---|
| **Hail** | The ship you're targeting | Radio | 2 |
| **Local** | Ships within scanner range | Radio | 2 |
| **System** | Everyone in the system | Comms array | 3 |
| **Station mail** | One commander, delivered when they next dock anywhere | Account | 4 |
| **Guild** | Your guild, across the galaxy | Comms array and a guild | 5 |
| **Voice** | Ships in range, fading with distance and positioned left and right | Comms array, opt-in, push-to-talk | 6 |

**Station mail** is how commanders who aren't online together message each other. It's written at a station and waits at the recipient's next dock. In time it could travel at the speed of ships: a letter carried a few jumps arrives later than one sent next door.

### Safety

- **Player radio is off by default.** You switch it on (with a clear note about what it is), and you can switch it off again at any time. Station traffic, police and the beacon are always on.
- **Mute** a commander: their messages stop for you, this session. **Block**: they stop for good, on every device, they can't hail or mail you, and they're never told.
- **Report**: one tap on any message. The report carries the last few minutes of what that commander said in that system, which the server keeps briefly (below), so a report can't be invented and the context is there to read.
- **A filter, on by default:** the worst words are masked and links are removed. The filter is a courtesy, not moderation.
- **No links, no images, no personal details prompted.** Text only, and short.
- **Rate limits** on every channel, stricter on System and for new accounts.
- **People handle reports.** Reports reach the admin (an admin page, built on the existing `ADMIN_KEY`), with the reported messages and who reported them. The actions available are a warning, a chat suspension (still free to fly), or a ban. The rules are written down on the site before chat opens, and anyone can appeal.

### The law (UK)

A service where users can send messages to each other is a **user-to-user service** under the UK Online Safety Act, whatever its size. Before player messaging opens we need to:

- write and keep an **illegal content risk assessment** (and update it when channels are added);
- assess whether **children** are likely to use it, and if so take the extra steps the Act requires: player radio off by default helps, and a minimum age for transmitting may be needed;
- have a working **report and complaints** route, terms that say what's allowed, and records of what we did about reports.

Ofcom publishes guidance and tools for small services. This is a list of what to do, not legal advice: it should be checked before stage 2 ships.

### What's stored

- **Nothing, normally.** Messages pass through the system's server to the ships that should hear them and aren't saved.
- **For reports:** each system server keeps the last 10 minutes of player messages in memory, and a report copies the reported commander's part of that into the report. Reports are kept for 90 days, or longer while a case is open. Station mail is kept until it's read, then for 30 days.
- **Blocks** are kept with the account and deleted with it.
- The [privacy page](https://witchspace.org.uk/privacy/) is updated before stage 2.

## How it works

- **The system server does the routing.** It already knows where every ship is, so it decides who is in range for Local and who is in the system for System. Clients never choose who hears them.
- **Protocol:** the client sends `{ type: 'say', ch: 'hail' | 'local' | 'system', text, to? }` (or `{ type: 'beacon', call }`); the server checks the account, the array (for System), rate limits and blocks, then sends `{ type: 'said', from, callsign, ch, text }` to each ship that should hear it.
- **Blocks are checked on the server**, so a blocked commander's messages are never sent to you at all.
- **The array is server-checked** like lasers and missiles are now: the server only lets a commander use System if the array is fitted and working, and decides when a hit damages it.
- **Station mail and reports** live in the `Accounts` Durable Object, beside callsigns and firsts.
- **NPC radio** (stage 0 and 1) is all in the client, from the seed and the game's own events, with no server at all.
- **Controls:** **'** (apostrophe) opens the radio to type; Enter sends. Not **/**, which slows the ship down, as on the BBC. On a phone, a **Radio** button opens the log with the quick phrases on top and the keyboard behind them.

## Building it in stages

| Stage | What | Server |
|---|---|---|
| **0. The radio log** | Hails, clearances, police warnings and pirate threats move into a radio log; hail your target and get answers | None |
| **1. Array and beacon (single-player)** | The comms array as kit you can buy and lose: distress calls to answer, news at range, listening in. The beacon with its fixed calls | None |
| **2. Player radio** | Hail and Local between signed-in commanders, quick phrases, mute, block, report, the filter, admin review. The Online Safety Act steps done first | The system server routes; reports in Accounts |
| **3. System broadcast** | The array's open channel for players; the array can be shot off by players too | Server-checked array |
| **4. Station mail** | Messages to commanders who aren't online, waiting at their next dock | Accounts |
| **5. Guild channels** | With guilds (roadmap 4) | Galaxy-wide fan-out |
| **6. Voice** | Opt-in proximity voice, push-to-talk, off by default | Peer-to-peer audio through a relay; needs its own safety review |

Stages 0 and 1 make the game better on their own, and they don't depend on how many people are playing. Stage 2 is worth building once a few commanders are flying in shared space together.

## Open questions

- Should guests be able to hear player radio at all, or only signed-in commanders?
- A minimum age for transmitting: what is it, and how do we ask without collecting anything we don't need?
- Should messages in anarchies be harder to trace (no law, no police logs), or is the report route the same everywhere? (Moderation must be the same everywhere; the in-world flavour can differ.)
- How far should news travel with the array: one jump, two, or by the companies' own networks?
- Do AI-agent commanders talk on the radio, and how are they marked so nobody mistakes one for a person?
