# Design: servers and hosting

*Status: **agreed direction**, for the shared galaxy under Modern rules (roadmap phases 3 and 4). Classic and single-player stay offline in your browser and need no server at all. Costs are **estimates** to be replaced by load-test measurements before launch.*

## The idea

The shared galaxy runs on **one small, cheap, open-source server that the project controls**. It's the single source of truth for everything that matters. Players' own machines do everything that's safe to share. Later, **trusted community volunteers** can run parts of the galaxy on their own servers, while the central server keeps the books.

1. **The server decides what matters:** credits, cargo, ratings, the law and the outcome of fights. A player's machine never decides any of these.
2. **Players' machines do the heavy lifting:** drawing the game, flight physics, and generating the galaxy from its seeds.
3. **Cheap enough to fund by donation.** Hundreds of players should cost tens of pounds a month, not hundreds.
4. **No peer-to-peer connections between players.** Nobody's IP address is shown to strangers.
5. **The server is open source,** like the game, so anyone can check how it works or run their own copy for testing.

Related designs: [economy and exchanges](economy-and-exchanges.md) (the server-held ledger), [combat rating](combat-rating.md) (the server decides fights), [player-run stations](player-stations.md) (contributor records, funding and no pay-to-win).

---

## 1. What runs where

| Runs on | What | Why |
|---|---|---|
| **Your browser** | Drawing the game, sound, flight physics with prediction (so your ship responds instantly), the galaxy and planets generated from seeds, your HUD and the station screens | Fast, free and fine to trust: if you change how it looks, nobody else is affected |
| **System servers** | Live simulation of busy systems: where every ship is, NPC traffic and police, laser hits, missiles, docking clearance | Everyone in a system must see the same fight, and nobody can be trusted to referee their own |
| **The central server** | Accounts, commanders, credits and the ledger, cargo, equipment, ratings, legal records and warrants, shared markets, missions | One set of books that can't be edited or forked |

To begin with, the system servers and the central server are **one program on one machine**. They're kept separate in the code so they can be split later.

## 2. How a session works

- **Logging in:** the browser signs in to the central server, which loads your commander.
- **In a system:** your browser keeps one WebSocket connection to the server simulating that system. It sends your controls and position many times a second. The server checks them, then sends back the other ships in the system, 10 to 20 times a second.
- **Only nearby ships are sent.** You get updates for ships in your own system, and fewer for distant ones. Empty systems cost nothing at all.
- **Hyperspace is the handover.** The witchspace tunnel lasts a few seconds, which is ample time to move you from one system server to another. Nobody sees a loading screen; it's the tunnel.
- **Docking:** trading, the shop and the station screens are ordinary requests to the central server. The live simulation isn't needed.

### What the server checks

- **Movement:** speed, turn rates and positions must fit your ship's real performance. Teleporting or impossible speeds are rejected.
- **Shots:** your browser says "I fired". The server works out whether it hit, allowing for your connection's delay (lag compensation), so a modified browser can't simply claim hits.
- **Results:** kills, bounties, salvage and rating points are worked out on the server from what actually happened, then written to the ledger.

## 3. What it costs

Rough estimates **(to measure)**:

| Scale | Hardware | Rough cost |
|---|---|---|
| Hundreds signed up, dozens online at once | 1 small server (2 CPUs, 4 GB) + a small database | **About £5–15 a month** |
| 300–500 online at once | 1 bigger server (4–8 CPUs) | **About £20–50 a month** |
| Thousands online | Several system servers + the central server | Hundreds a month, which is a long way off |

**Why it's cheap:**

- **The galaxy is maths, not data.** All 2,048 systems, their planets and their markets' starting prices come from seeds, as in 1984, so they're never stored or sent.
- **Space is mostly empty.** With hundreds of players across thousands of systems, most systems have nobody in them.
- **Bandwidth is the main cost.** At 2–10 KB a second per player at the busiest, 500 players online at once use roughly 2–5 TB a month. Budget hosts include 20 TB of traffic with even small servers.
- **The website and game files** are static, and already served free by Vercel.

**Hot spots:** the expensive case isn't how many players there are, it's how many are **in one place**, such as Lave on launch day or a big fight. The server can cope by:

- sending distant ships less often;
- capping how many ships one system server simulates closely;
- if it ever comes to it, running a crowded system as several copies of the same place.

A **load test** with simulated players will measure all this before launch.

## 4. Community-run system servers (later)

Once the shared galaxy is established, **trusted volunteers** can host system servers, for example for a region of the galaxy or for players nearer them.

- **Only official builds:** volunteers run the same open-source server, as published and signed by the project, never their own modified version.
- **The central server still keeps the books.** A community server *reports* what happened in its systems ("ship A destroyed ship B, cargo spilled"). The central server checks each report is plausible before recording it, and replays samples of fights to look for tampering.
- **Earned, not bought:** hosting is open to commanders with a strong contributor record, as for [station charters](player-stations.md). It can be withdrawn at once if anything looks wrong.
- **Nothing important lives only on a volunteer's machine.** If a community server goes offline, its systems move back to the project's servers, and players lose a moment, not their progress.

## 5. Why not run everything on players' computers?

Fully peer-to-peer "nodes" on players' own machines were considered and rejected for the shared galaxy:

1. **Cheating.** If a player's machine decides fights or credits, a modified machine can lie: "I destroyed that Deadly pilot", "I have 10 million credits". Cross-checking between nodes helps, but is complex and still breakable.
2. **Reliability.** Players come and go. If the machine running Lave shuts its laptop mid-fight, everyone there has to move without losing anything.
3. **Browsers can't easily act as servers.** It would mean a separate download, and many home networks block incoming connections.
4. **Privacy and fairness.** Players would connect directly to each other, revealing their IP addresses. Whoever hosts also gets a delay advantage in their own fights.

What players' machines *do* contribute is everything in the first row of the table in section 1. That's most of the work, and it's free.

## 6. Single-player and Classic

Single-player stays exactly as it is: **the whole game runs in your browser** and saves there, with no account and no server. Classic is single-player only, so it never needs a server. Single-player Modern commanders stay local too. Whether one can later move into the shared galaxy is an open question.

## 7. Data and privacy

- **Stored:** a login (email or a GitHub sign-in), your commander and their ledger history. Nothing else about you.
- **Not stored:** real names, locations or anything for advertising. There is no advertising.
- **Players never see each other's IP addresses** (section 5).
- **Your rights:** you can download your commander's data, and delete your account with everything in it, as UK data protection law requires.
- **Security:** reports go through [SECURITY.md](../../SECURITY.md).

## 8. Paying for it

Costs are covered by **transparent donations** (GitHub Sponsors or Open Collective), with all income and spending public, as set out in the [player-stations proposal](player-stations.md#no-pay-to-win). Supporters get thanks, never power. The design aims to keep costs low enough that this is realistic.

## 9. Fair play

**The rule: in the shared galaxy, the browser is never trusted with anything that matters.** The code is open source, so we assume some players run modified clients, and design so that it gets them nothing.

### Single-player: let it be

A single-player commander lives in your own browser, and you can edit it if you want; it's your game and nobody else is affected. Classic stays fully offline. Fighting this would only get in honest players' way.

### The server keeps the books

- **Commanders live on the server** in the shared galaxy: credits, cargo, equipment, ratings, legal records. The browser shows a copy.
- **Every action is a request** ("buy 10 t of Food", "fit a beam laser"). The server decides whether it happens and at what price, and writes it to a ledger that can't be quietly edited (see [system currencies](system-currencies.md) for the hash-chained ledger).
- **Single-player commanders don't carry over.** Everyone starts fresh in the shared galaxy, so an edited save is worth nothing there.

### The server referees flying and fighting

- **Movement:** speed, teleporting and positions outside the system are refused (built). Turn rates next.
- **Lasers:** the browser says "I fired, this way". The server works out whether it hit, rewinding the target to where the shooter saw it (lag compensation), and checks the rate of fire. Damage, kills, bounties and rating points are only ever decided on the server.
- **Aim assistance:** gimbals are a legal aim assist, so an aimbot gains less than in most games, and the server applies each laser's own spread, so perfect aim isn't a perfect hit.

### Markets nobody can see ahead

Markets and world events come from each system's seed and the clock, and the code is public, so anyone could run it forward and know next week's famine or prices. Harmless in single-player; an exploit in a shared economy. So in the shared galaxy the server **mixes a secret seed into future events and NPC trading**. To stay provably fair, it publishes a fingerprint (a hash) of each period's secret in advance and reveals the secret afterwards, so anyone can check that nothing was rigged.

### Bots and multiple accounts

- **Sign-in with a verified email** (Resend), and one commander per account.
- **New accounts start limited:** small trade and contract caps until they've played a while, so farming with throwaway accounts is pointless.
- **Rate limits** on every connection (built), and watching for non-human patterns: perfect timing, trading around the clock.
- **Automated trading only as declared market makers**, never hidden bots (see [Merchants](markets-and-trade.md#5-merchants-trading-without-flying)).
- **No real money in or out**, which removes most of the reason to cheat at all.

### People

A report button, and server logs to check reports against. Moderation by people, with clear rules, not automatic bans.

## 10. Building it in stages

| Stage | Server work |
|---|---|
| **Shared space** (roadmap 3) | One system server: see and fly with other commanders, server-checked movement and shots. No accounts yet, nothing saved |
| **Persistence** (roadmap 4) | The central server: accounts, commanders, the ledger, shared markets, ratings and the law. Load test before opening up |
| **Growth** | Split system servers from the central server; more regions if players are spread worldwide |
| **Community hosting** | Volunteer system servers, as in section 4 |

---

### Stage 1, as built

- **Hosting:** Cloudflare Workers with **one Durable Object per star system** (`server/`), at `space.witchspace.org.uk`. Durable Objects use hibernating WebSockets, so a system with nobody in it costs nothing, and the SQLite-backed kind runs on the free Workers plan.
- **What it does:** the game opens one WebSocket to its system and sends its position about ten times a second. The server refuses impossible moves: speeding, teleporting (the in-system jump is allowed, with a cooldown) and positions far outside the system. Refused moves put you back where you were. Everything else is passed to the other commanders there, whose browsers draw each ship slightly in the past, between updates, so it moves smoothly.
- **In the game:** opt-in from the title screen (**S · Shared space (beta)**), Modern rules only. Other commanders fly Cobras in a white commander colour, with name labels and scanner contacts, and their lasers are drawn. Hyperspace is the handover between system servers.
- **Lasers between commanders (built):** the browser sends "I fired, this way, with this laser". The server checks the laser is fitted and not firing faster than it can, judges the target where the shooter saw it (200 ms back) with the laser's own scatter, and keeps everyone's shields and hull, recharging as in the game. Browsers report their own health so NPC damage counts, but can only lower it. The victim's shields and hull come from the server, and only the server says who was destroyed. Firing on a commander makes you an Offender, and destroying one is a serious crime (a Marshals warrant) wherever there's law; anarchies have none.
- **Not yet:** collisions between commanders (today ships pass through each other; ramming should be refereed by the server too), missiles between commanders, fitted lasers decided by the server (today the browser says what's fitted, until commanders are saved on the server), accounts and anything saved, chat.

## Open questions

- ~~**Hosting provider and region:**~~ settled: Cloudflare Durable Objects (one per system), which run close to wherever the first commander in a system is.
- **Signing in:** email magic links, GitHub, or both?
- **Update rate:** 10 or 20 updates a second? Decide by testing what feels right in a dogfight.
- **Crowded systems:** the closely-simulated ship cap per system, and whether to split crowded systems into copies at all.
- ~~**Single-player commanders:**~~ settled: everyone starts fresh in the shared galaxy (section 9).
