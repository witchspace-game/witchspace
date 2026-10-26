---
title: The radio and comms
status: building
pillar: core
summary: A radio log for everything that talks to you, hails, a comms array that lets the companies reach you anywhere, an emergency beacon, and (next) talking to other commanders safely.
card: lancer
stages:
  - Stage 0: the radio log and hails | built
  - Stage 1: the comms array and the beacon | built
  - Talking to other commanders, with mute, block and report | proposed
help:
  - Redesign the radio panel so a glance says whether anything needs you (see "The wall of text") | design
  - Sketch or mock up the radio panel's cards, colours and motion | art
  - Prototype a better radio panel in HTML and CSS | code
  - Write radio chatter for a busy system | writing
---

# Design: radio, the comms array and the emergency beacon

*Proposed, October 2026; stages 0 and 1 built (see "As built" at the end). Change by pull request.*

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

#### The wall of text: needs a better design *(Mark, 26 October 2026)*

*Status: **problem noted, to design**.* As built, every line anyone says goes into one list, and in a busy system it becomes **a wall of text**: station traffic, police, pirates, traders, company notes and news, all the same size, one after another. It's hard to read, the line that matters is buried among the ones that don't, and in flight there's no time to read a wall. It needs a more intuitive, elegant answer, not more lines. Directions to explore:

- **What needs you comes first, as a card, not a line.** An offer to accept, a pirate's price, a police hail with a countdown, a Mayday: each its own card at the top, with its button (Accept, Pay, Switch on) and its timer, gone once answered. Everything else is background.
- **Conversations, not a list.** Group by who's talking, like a messaging app: one row per voice (Meridian traffic, the Viper on your tail, Hexon Freight, the pirate band), showing its latest line and how many you haven't read. Tap a row for that conversation. Five rows instead of forty lines.
- **Fewer words.** Every line written to be read at a glance: who, then a few words (*Traffic · cleared, bay 4*). The detail is a tap away, not on screen.
- **Chatter folds away.** Lines that need nothing from you (thanks, greetings, routine traffic) fold into one quiet line, *3 more from traffic*, and drop out after a few minutes.
- **Calmer in a fight.** In combat only the urgent cards show; the rest waits until it's over, then sums up: *While you were fighting: 2 messages from Hexon, a news report.*
- **Icons and colour, not labels.** A small mark for each kind of voice (station, police, pirate, company, news) instead of writing its name every time; the colours already exist.
- **Colour says who, motion says how** *(Mark)*. Each voice keeps its colour, as a thin glowing edge on its card or row rather than coloured text, so who's speaking is obvious at a glance without the panel turning into a rainbow. A small, quiet animation hints at the message's character before you read a word:
  - **station traffic** settles in calmly, a soft fade;
  - **police** carry a slow steady pulse on the edge, like a patrol light;
  - **a pirate's line** arrives with a brief flicker of interference, a twitch, then still;
  - **a Mayday** beats like a heartbeat until it's answered or lost;
  - **a company note** slides in smoothly, businesslike;
  - **news** sweeps once across, like a ticker;
  - **the Falcon** comes through with a shimmer of static, cold and white.

  Each plays once as the message arrives (the Mayday excepted) and then stays still, so the panel is calm to read. Settings and the system's "reduce motion" keep the colours and drop the motion.
- **A voice, later.** A few key lines spoken (a hail, a Mayday) would mean you don't have to read them at all.

The test of a good answer: in the middle of a busy system, a glance tells you whether anything needs you, and what.

**Over to the community** *(Mark)*. These are starting points, not the answer. If you have a better idea for the radio and the comms array, or improvements to any of this, we'd love it: a sketch, a mock-up, a prototype or a paragraph. Post it in [Discussions](https://github.com/witchspace-game/witchspace/discussions/categories/ideas) or on the [ideas board](https://witchspace.org.uk/ideas/?about=The%20radio%20and%20comms), and the best answer gets built, credited to you.

## The comms array

An expensive, fragile, visible upgrade: a dish or mast on the hull that other ships can see and shoot.

- **Single-player, it's worth fitting for:**
  - **Distress calls.** Traders under attack anywhere in the system call for help. Arrive in time and you get a reward and standing with their company, and the Carriers' Mutual remembers who came.
  - **News at range.** The market events already in the game (famines, booms, strikes) reach you a jump or two early, so the commander with the array fills a hold with Food before anyone else hears.
  - **Listening.** Police chatter about where they're patrolling, and pirates arranging an ambush. Sometimes it's useful; sometimes it's bait.
- **In shared space, it also gives you:** an open broadcast to everyone in the system, and later guild channels and voice.
- **It can be lost.** A hit to the hull can damage it like other kit; pirates and the Falcon aim for it. Damaged, it works as a plain radio until repaired at a station. Shooting another commander's array is an attack, and a crime wherever there's law.
- **Rough numbers (to balance):** 4,000 Cr, tech level 9, repair 30% as for other kit.

### The radio is where the companies talk to you

The radio isn't only for ships. **It's the one place everything that talks to you in flight is heard**: station traffic, the police, pirates, traders, and the companies and their contracts. "One jump left", "Running late", "Cargo reclaimed", "Delivered, with thanks", "Work on your route" and "Back on course" all arrive on the radio, from the company that sent them, in its colour. Messages that last (the ones on the Contracts tab) stay where they are; the radio log is where you hear them first, and where you look after a fight to see what you missed.

The **comms array** is how the companies reach you **anywhere**. Without one, a company can only talk to you through a station's traffic control, so you hear about work on your route as you come in to dock. With one:

- **Offers reach you in flight**, anywhere in the system and from the station at your next jump: the same "work on your route" the station would mention, only sooner.
- **You can accept over the array, without docking.** The offer in the radio log has an **Accept** button (Enter on a keyboard). Accepting **reserves** the contract: it's yours, it counts towards the three you can hold, and it needs the standing it always needed. The company holds the cargo at its station; you **collect it when you next dock there**, and the delivery clock starts when it's loaded.
- **Hold space is checked when you collect**, not when you accept: the company loads it if there's room, and says how much room it needs if there isn't (sell something and load it from the Contracts tab).
- **Collect it within two jumps of accepting**, or the company gives the work to someone else and counts it as abandoned, as if you'd given it up at the station. It warns you on the radio a jump before.
- A reserved contract isn't cargo yet, so it isn't lost with your ship.

The four companies use the array differently in flavour, not in rules; the Carriers' Mutual in particular listens for its own ships' distress calls and remembers who answered.

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

## While you're away: the array listens

*Proposed, October 2026.* Notifications shouldn't feel like an app nagging. In Witchspace they're **your ship's radio reaching you**: when you dock and close the game, your Cobra sits in its berth with the comms array still listening, and what it hears finds you.

- **Who sends what:**
  - **Without an array:** the companies write to you, as they do now (special assignments, see [contracts by notification](companies-and-contracts.md#contracts-by-notification)).
  - **With an array**, your ship also hears:
    - **the exchange:** "Your limit order filled: 12 t Gold sold at Lave for 4,180 Cr" (orders already fill while you're away, from the price history);
    - **the lanes:** "Haulers report a Falcon working Riedquat", and the Mayday that opens [A Debt](legends-the-falcon.md#a-debt-the-night-the-falcon-needs-you);
    - **the galaxy:** "Opening day at the Wexley-Yorozu yard by Leesti I: first traders get premium prices", and, at most weekly, "Your name is still on Lave I".
- **One ship's log a day, not a stream.** What the array picks up is gathered into a single quiet message, in the ship's voice: *Ship's log · 3 messages · your Gold order filled · a Falcon near Riedquat*. Story moments (an assignment, the Mayday) can come on their own. All of it stays inside the existing cap (two a week from the companies, plus at most one log a day), and nothing arrives in quiet hours (10 pm to 8 am by default, your device's time).
- **Tap it and you're there:** the game opens docked, with the radio log showing what the array heard while you were away. The notification is the first line of the session.
- **Your choice, kind by kind:** under *A · Account*, separate switches for *the companies*, *the exchange*, *Legends* and *news*, all off until you turn them on. Email gets the same log, at most daily, with the one-click stop.
- **It costs nothing to run.** The server only sends what it can work out from your cloud save, the galaxy's seed and the clock (the hourly `Accounts` alarm), as it already does for assignments: the Falcon's circuit, the yards and order fills all are. No simulation runs while you're away.
- **What it never sends:** messages from other players (for safety, see [the law](#the-law-uk)), and contract deadlines (they count in jumps, not hours).
- **What it can't do:** web notifications on an iPhone carry no buttons, so there's no "Accept" in the notification itself. You open the game to act: the ship heard it, you decide.
- **It makes the array worth fitting for traders**, not only explorers and fighters: the upgrade that keeps the galaxy alive for you between sessions.

**As built (first part, October 2026):** the ship's log runs by push notification for two kinds, each with its own switch under *A · Account* ("Your ship's log"), both off until you turn them on:

- **Bitcoin orders:** a limit order that filled while you were away ("Your Bitcoin buy filled at 80,327"). The server judges each order on the price history since it was placed (one-minute candles from the relay, then coarser), the same rule the game uses when you dock. These don't need an array: an exchange order is yours, wherever your ship is.
- **Hearts on your clips:** when a shared clip passes 5, 10, 25, 50, 100, 250, 500 or 1,000 hearts.

At most one log in about a day (20 hours, so it doesn't drift later each day), never between 10 pm and 8 am your device's time, and nothing is told twice. Not yet: the lanes, the galaxy's news, email, and the radio log on arrival.

## Building it in stages

| Stage | What | Server |
|---|---|---|
| **0. The radio log** | Hails, clearances, police warnings and pirate threats move into a radio log; hail your target and get answers | None |
| **1. Array and beacon (single-player)** | The comms array as kit you can buy and lose: company offers anywhere and accepting them remotely, distress calls to answer, news at range, listening in. The beacon with its fixed calls | None |
| **2. Player radio** | Hail and Local between signed-in commanders, quick phrases, mute, block, report, the filter, admin review. The Online Safety Act steps done first | The system server routes; reports in Accounts |
| **3. System broadcast** | The array's open channel for players; the array can be shot off by players too | Server-checked array |
| **4. Station mail** | Messages to commanders who aren't online, waiting at their next dock | Accounts |
| **5. Guild channels** | With guilds (roadmap 4) | Galaxy-wide fan-out |
| **6. Voice** | Opt-in proximity voice, push-to-talk, off by default | Peer-to-peer audio through a relay; needs its own safety review |
| **Away** | The array listens while you're away: the daily ship's log, order fills, Legends and news by notification, switches per kind, quiet hours | The hourly Accounts alarm, from save, seed and clock |

Stages 0 and 1 make the game better on their own, and they don't depend on how many people are playing. Stage 2 is worth building once a few commanders are flying in shared space together.

## Open questions

- Should guests be able to hear player radio at all, or only signed-in commanders?
- A minimum age for transmitting: what is it, and how do we ask without collecting anything we don't need?
- Should messages in anarchies be harder to trace (no law, no police logs), or is the report route the same everywhere? (Moderation must be the same everywhere; the in-world flavour can differ.)
- How far should news travel with the array: one jump, two, or by the companies' own networks?
- Do AI-agent commanders talk on the radio, and how are they marked so nobody mistakes one for a person?

## As built (stages 0 and 1, October 2026)

Single-player and Modern rules only; Classic flashes its messages as before. No server changes.

- **The radio log** (`src/ui/radio.ts`, wired in `main.ts`): station traffic, police hails and scans, pirates, traders, distress calls, market news and every company note kept in Messages (one jump left, running late, reclaimed, delivered, loaded, work on your route, back on course, special assignment messages) go into one log with who said it, in their colour, and the time. On a desktop it sits bottom left, shows the last four lines and fades when it's quiet; **'** opens the whole log (the last 40 lines). On a phone it's a pill under the job strip with an unread count and, outside fights, the latest line for a few seconds; tap it for the log. A fight folds it away. Lines that matter this second (police hails, maydays, docking refused, a pirate's price, a rescue) still flash as well. The log lasts for the session; it isn't saved.
- **Hail** (**L**, or Hail in the touch drawer): the ship in your sights or your missile's target, within 12 km; with nothing there, traffic control within 5 km (anywhere, with a comms array). Answers come from the system's seed, the ship and how many times you've asked (`src/game/radio.ts`). Police and stations know your record and whether you're dark; traders are frightened if shot at and angry if it was you. Pirates threaten (unprompted too, when they first come for you), and about one hail in seven, if you've something worth taking, name a price: 15% of your hold's value, at least 50 Cr. **Pay** (or Enter) and the band leaves; shoot one afterwards and the deal's off.
- **Comms array** (4,000 Cr, tech level 9, Modern only, repaired at 30% like other kit). It's fragile: any hull hit can knock it out (1 in 14, twice that from pirates), not only when the hull is badly hurt, and pirates' hits on a badly hurt hull pick it half the time. Damaged, it's a plain radio. With it working:
  - **Work on your route** from the station here and the one at your next jump arrives in flight (checked every 20 seconds and soon after arriving), with an **Accept** button (Enter). Accepting reserves the contract as described above: standing, the three-contract limit and Modern rules are checked then; hold space when you collect. It's loaded automatically when you dock there if it fits, or with **Load** on the Contracts tab once you've made room. You have **two jumps** to collect it, with a warning on the last; after that it counts as abandoned (−3 standing, as giving it up does). The delivery clock (the contract's own jumps) starts when it's loaded. Surveys and special assignments can't be reserved. Reserved cargo isn't lost with your ship.
  - **Distress calls**: a trader hit by pirates calls Mayday. You hear it within 12 km, or anywhere in the system with the array, and its marker reads MAYDAY wherever it is. With the array, every two to four minutes there's a chance (by government) of an attack starting 13 to 20 km away. A trader calling for help takes 40% damage, so it lasts about a minute and a half against one pirate. Be within 5 km while the pirates are still at it, and see them off: 60 Cr + 40 per pirate, and +1 standing with its company; the Carriers' Mutual pays half as much again, gives +2 and writes to say it remembers.
  - **News at range**: events under way within two jumps whose news hasn't reached here yet come over the array, with what's wanted.
- **Emergency beacon** (**`**, then 1–4, or Beacon in the drawer), every ship, can't be damaged, one call per 15 seconds:
  - **Mayday** with hostiles near, in a lawful system: two Vipers come (the same response as a trader's call) and any Viper already out turns towards you. Without hostiles it's a false alarm: the first is a warning; a second within ten minutes is an offence (Offender: wasting police time). Lawless systems don't answer and don't mind.
  - **Hull failing** below 60% hull: a Viper escorts you in; above it with nothing hostile, a false alarm; with hostiles, a Mayday.
  - **Request escort**: in lawful systems a Viper flies with you for two and a half minutes.
  - **Out of fuel**: traffic control tells you if you can make the nearest system, or to dock and fill up. Only if you can't jump *and* can't dock (refused or in lockdown), a Carriers' Mutual tender brings enough to reach the nearest system at three times the pump price (all you have, if less), once per system. This is the beacon half of the rescue proposed in [law and travel](law-and-travel.md#6-fuel-rescue-and-never-being-stranded); there's no tug yet.
- **Not built yet**: listening in on police and pirate chatter, static near the edge of range, the array visible on the hull, and everything from stage 2 on.
