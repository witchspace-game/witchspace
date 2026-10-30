---
title: Shared space
status: proposed
pillar: build
summary: The plan for flying with other commanders, from what works today to wings, radio, bounties and trading, with how Mark tests it alone, what it costs and the order to build it in.
card: lancer
stages:
  - Stage 1: fly, fight and collide together, one system at a time | built
  - Signed-in commanders only, and a front door to claim a callsign | designed
  - Test pilots, room tests and a second account for testing alone | proposed
  - Every ship flown as itself on the server | proposed
  - Rank, the law and your ship kept by the server | proposed
  - The law between commanders: self-defence, fair kills, protected starters | proposed
  - Talking to each other (player radio stage 2) | proposed
  - Wings | proposed
  - Bounties on commanders | proposed
  - Giving and trading between commanders | proposed
  - Commanders in the news and the feed | proposed
---

# Design: shared space

*Proposed, 30 October 2026, at Mark's request. Plan only: nothing here is built until Mark says yes. Change by pull request.*

Mark: "shared space is important for many reasons. I do want to be able to test it and I want to know whats already working." And: "This needs planning and doing properly."

This document gathers what's built, what other designs already planned, and the order to do the rest. It builds on [servers and hosting](servers-and-hosting.md) (the server's job and stage 1 as built), [radio and comms](radio-and-comms.md) (talking to other commanders), [combat rating](combat-rating.md#4-points-for-player-kills-multiplayer) (player kills), [law and travel](law-and-travel.md) (safe zones, protected starter systems) and [the live feed](live-feed.md).

## Principles

- **The server decides what matters** ([servers and hosting](servers-and-hosting.md#9-fair-play)): hits, deaths, rank, the law, money. The browser draws and flies.
- **Signed-in commanders only** (Mark, 30 October 2026). Every ship in shared space belongs to an account and a callsign, so it can be traced, reported and stopped.
- **Single-player stays as it is.** Everything here is opt-in, Modern rules only.
- **Testable by one person.** Mark must be able to test every step alone, on his iPhone, without borrowing a second phone or a friend.
- **One small step per PR,** each worth having on its own.

---

## 1. Where we are

Checked against the code on 30 October 2026 (main plus PR #318).

### Built and working

| What | Where |
|---|---|
| One Durable Object per star system, hibernating WebSockets, so an empty system costs nothing | `server/src/index.ts` (SystemRoom), `server/wrangler.toml` |
| Up to **32 flying commanders** a system; the 33rd is told "full · flying solo" and retries every 30 s. A ship silent for 15 s gives up its place | `index.ts:50`, `SILENT_MS` |
| Positions about **10 times a second**, drawn 0.15 s in the past and interpolated | `src/net/space.ts:11–12` |
| **Hyperspace is the handover** between system servers; docked commanders aren't in shared space | `space.ts`, `main.ts:167` |
| **Callsign tags** with rank insignia, scanner marks, **red once they've fired on you**, "has arrived" | `main.ts` shared space section |
| **Moves refereed:** speed with 30% slack, teleports, the J jump with a cooldown, positions outside the system; refused moves put you back | `server/src/rules.ts` `checkMove` |
| **Lasers refereed:** fitted laser, rate of fire, target rewound 0.2 s, each laser's scatter, shots off the nose 80% | `index.ts` `fire`, `protocol.ts` |
| **Shields and hull kept by the server,** recharging as in the game; the browser can report damage from NPCs but only downwards | `rules.ts` `reportHealth` |
| **Missiles flown by the server:** 5 km lock, the game's own flight model, 140 damage; **ECM** clears missiles within 4 km | `index.ts` `launch`, `flyMissiles`, `ecm` |
| **Collisions:** the whole path checked, both ships damaged by closing speed and pushed apart, once per contact, never a crime | `index.ts` `collide` |
| **Death is real:** destroyed by a commander, you die as you would to a pirate | `main.ts` `onSpaceEvent` 'destroyed' |
| **Running dark** (unidentified until 2 km), **paint**, including the Dark Edition's black-light lights | `protocol.ts` `Paint`, `cleanPaint` |
| **One ship per account** (signed-in games of protocol v2): join elsewhere and the old ship leaves | `index.ts:411` |
| **30 messages a second** per connection, the rest dropped | `index.ts:51` |
| **Room tests:** what the server accepts, lasers, collisions, missiles | `server/src/rules.test.ts` |
| A **load test** (28 October, local) measured about 12,000 forwarded updates a second: about 35 commanders flying smoothly | [servers and hosting](servers-and-hosting.md#how-many-commanders-a-system-holds-mark-28-october-2026) |

### Not right yet

1. **Every ship is a Cobra on the server.** `protocol.ts` `SHIPS` lists only `cobra-mk3`, and `hello` forces anything else to it (`index.ts:384`). Others see a Cobra, and the server holds her to Cobra numbers: Mark's Fer-de-lance has 240 shields and 200 hull in the game, but the server caps her at 100 and 150. Her first hit in shared space takes her shields down to the Cobra's. Her three missiles are fine; a ship with more than four would be cut to four.
2. **The law between commanders is one-sided.**
   - **Killing any commander makes you a Fugitive,** not only a clean one: the server doesn't know who's clean, so the game treats every commander kill as murder (`main.ts:7634`). Shooting back at someone who attacked you first makes you an Offender (`main.ts:7576`), and killing them makes you a Fugitive.
   - It's decided in the browser. Anarchies have no law (`hasLaw`), and running dark leaves the crime unpinned, as for NPCs.
   - No kill of a commander earns rating, as [combat rating](combat-rating.md) section 4 waits for this.
3. **Rank is claimed by the browser** (`protocol.ts`, `RANKS`), and so are the lasers, missiles and ECM sent in `hello`. Nothing about the commander is saved on the server; the cloud save is a copy, not the books.
4. **Guests can still join** on main, and they borrow any name not on the reserved list (`index.ts` `hello`). Mark decided on 30 October: signed-in commanders only. Built in PR #319, waiting for its merge and a Worker deploy.
5. **No talking between commanders.** Hail and the beacon only reach NPCs. Player radio is designed ([radio and comms](radio-and-comms.md#talking-to-other-commanders), stage 2), not built.
6. **No wings, bounties on commanders, trading or giving.**
7. **NPCs aren't shared.** Each player's game makes its own pirates, police, traders and Marshals. Two commanders side by side see different pirates, and police only react to crimes the player's own game saw.
8. **Other commanders' lasers are drawn straight off the nose,** so a gimballed or turret shot looks wrong to everyone else, and they're silent except a Fer-de-lance's (`main.ts`, `updateSharedSpace`).
9. **Stale comments:** `main.ts:7502–7504` says lasers "don't hit anyone yet", and `main.ts:7675` "they don't hit anything yet". Both are out of date.
10. **Testing alone is awkward.** Two commanders need two accounts on two devices. Without guests that means two email addresses.

---

## 2. The order, and why

Each step is one PR and stands on its own. The first three are small and make everything after them testable and fair.

### Step 1. Signed-in commanders only *(built in PR #319)*

- **Server:** `hello` refuses a join without an account callsign, with a reason the game shows. The guest-name path goes, and so does "(guest)" on tags.
- **Game:** switching on Shared space while signed out shows *Shared space is for commanders with a callsign. Claim yours: it takes a minute*. It signs in with the 6-digit code in the game, then *Choose a callsign* if there isn't one, then joins. Single-player is unchanged.
- **With it, the callsign front door** (Website's "Claim your callsign" page; Mark said yes): a check endpoint that shares the claim's rules, with "taken" matched loosely so near-copies can't be claimed. Also in PR #319.
- **Why first:** everything after it (radio, bounties, the law, saved rank) needs a real account behind every ship.

### Step 2. Testing kit *(before any more features)*

Mark has to be able to test alone. See [section 4](#4-testing). In short: **test pilots** (server-run commanders that join your system and fly), a **second account** for Mark on the same email, and **room tests** that run a whole SystemRoom in the test suite.

**Why second:** every later step changes how commanders treat each other, and none of it can be checked by one person today.

### Step 3. Every ship flown as itself

- `SHIPS` is built from `content/ships` (speed, shields, hull, radius, missiles), not typed by hand, with a test that they match. A commander's `hello` names their ship; the server accepts any ship in the fleet.
- **Editions are seen by others** already through paint, including the Dark Edition's lights. With this step they're also the right hull, the right size for collisions and the right numbers for the fight.
- Remote lasers drawn the way they fired (the server already has the direction), with each ship's own laser sound.
- **Why now:** it's small, and Mark's own ship is wrong in shared space today.
- **Until step 4,** the ship is still claimed by the browser. A commander could say "Fer-de-lance" without owning one. That's acceptable for a beta, and step 4 closes it.

### Step 4. Your commander kept by the server

What the room needs to know, kept by the server, not claimed:
- **Rank:** kills are recorded on the server as they happen in shared space, and single-player kills come over with the cloud save, flagged as unverified. A rank earned in shared space shows as a full insignia, one carried over as hollow, until the commander has enough verified kills.
- **Legal status:** Offender, Fugitive and warrants for crimes against commanders are decided by the server and stored on the account. Each player's game still keeps its own NPC crimes until markets and the ledger move over.
- **Ship and kit:** the yard already records orders, the fleet and editions on the server (`server/src/yard.ts`). The room trusts those for the hull, and the lasers, missiles and ECM sent at join are capped by what the ship can carry.
- **Why:** bounties, self-defence and kill points all depend on the server knowing who's clean and how good they are.
- **Not yet:** credits, cargo and markets stay in the browser. Moving them to a server ledger is roadmap phase 4 ([economy and exchanges](economy-and-exchanges.md)), a much bigger job.

### Step 5. The law between commanders

[Combat rating](combat-rating.md#4-points-for-player-kills-multiplayer) section 4, made real by the server:
- **Self-defence:** the server records who fired first. Shooting back at an attacker is no crime, and killing someone who attacked you, or who is Wanted, is lawful.
- **Fair kill points:** a legitimate kill earns the victim's ship value × 3 × the rank factor. It earns nothing two or more ranks below you, half each time for the same commander within 24 hours, and nothing against a ship freshly launched, docking or disconnected.
- **Safe zones:** inside a lawful station's 5 km, firing on a commander brings the station's guns on you. The server applies their damage itself, so it's the same for everyone.
- **Protected starter systems** ([law and travel](law-and-travel.md)): in the core systems around the starting stations, killing a commander is always a Fugitive crime with a warrant at once, whatever your rank.
- **Anarchies stay lawless.**

### Step 6. Talking to each other

[Radio and comms stage 2](radio-and-comms.md#building-it-in-stages), already designed:
- Hail and Local between signed-in commanders, and quick phrases ("o7", "Thanks", "Don't shoot").
- Player radio off by default; mute, block and report; the filter.
- **The beacon heard by real commanders,** so a stranded commander can be rescued by a stranger. [Law and travel](law-and-travel.md) calls that one of the best social moments in the game.
- **First:** the UK Online Safety Act steps: a risk assessment, terms, the report route, and the privacy page.
- **Why sixth:** it's the most social step and the one with legal homework; steps 1 to 5 make it safe (real accounts, a law that works).

### Step 7. Wings

- Invite by hail, accept on a card. Up to four commanders.
- Wingmates show in their own colour on the scanner and tags. Your wing's destination shows on the chart.
- **Firing on a wingmate is no crime:** accidents in a fight happen. A kill is still a kill.
- Kill points are shared by damage dealt, as combat rating already says. Bounties are shared too.
- Team insignia come later, with guilds ([law and travel](law-and-travel.md)).

### Step 8. Bounties on commanders

- **Marshals' warrants become everyone's business:** a Wanted commander's tag says so, and whoever brings them in collects the bounty, paid by the Marshals, so nobody can farm it with a friend (no payout to wingmates or the same account).
- **Player-posted bounties** come later, with credits held in escrow, which needs the server ledger.

### Step 9. Giving and trading

- **First, cargo:** jettison canisters that other commanders can scoop. The server keeps track of each canister, so it exists once for everyone.
- **Then credits and goods by agreement**, once credits live on the server (roadmap phase 4). Haulage contracts between commanders ([economy and exchanges, section 5](economy-and-exchanges.md#5-contracts-and-futures-multiplayer)) come after that.

### Step 10. Commanders in the news and the feed

- Station news and [/feed](live-feed.md) carry player events, under the same naming rules as discoveries and editions: a Wanted commander brought in, a rescue answered, an edition seen in a system, a big fight at Lave.
- **Callsigns only with the commander's yes,** as with discoveries.
- Mostly the server already knows these things by step 5, so this step is mostly words and the feed.

### What shared space does to NPCs, police, the economy and contracts

**Recommendation: keep NPCs, markets and contracts in each player's own game for now, and share only what a fight between commanders needs.**
- **Shared now (by step 5):** the law between commanders, the station's guns in its safe zone, and Marshals sent after a commander's warrant (the server says when they come; each game draws them).
- **Later, the NPCs that matter to everyone in a place:** the Falcon, a Legend's sighting, a Titanoboa yard. Seeded from the system and the clock, so every game draws the same one without a server simulating it.
- **Pirates and traders stay per player.** Simulating every NPC on the server would multiply the server's work many times over for little gain while commanders are few.
- **Markets and contracts** stay per player until the server ledger (roadmap phase 4). Two commanders at Lave see the same starting prices, because both come from the seed and the clock, but their own trades only move their own market.

---

## 3. Fair play and griefing

| Problem | Answer | Step |
|---|---|---|
| **Spawn camping** at a station | The 5 km safe zone with the station's guns run by the server; a commander killed near a station relaunches with a short protection window (no damage, can't fire) | 5 |
| **Ganking newcomers** | Protected starter systems; no points two ranks down; repeat kills count less; a warrant and the Marshals for killing a clean commander in lawful space | 5 |
| **Alts** (second accounts to feed kills or bounties) | Verified email per account; no payout for killing a commander who shares your sign-in network often (a soft signal to the admin, not an automatic ban); repeat-kill halving; new accounts can't post bounties or broadcast | 4–8 |
| **Cheating clients** | The server already referees moves, lasers, missiles and collisions. Step 4 takes rank, legal status and the ship off the browser. Turn rates are the next movement check | 3–4 |
| **Spam and abuse on the radio** | Off by default, mute, block, report, the filter, rate limits, people review reports | 6 |
| **A full system** | 32 flying; the next flies solo and retries. Batch updates into one message per commander per tick when it matters | built / later |
| **Leaving mid-fight** to deny a kill | A ship that disconnects in a fight stays in space for 15 s (it already does, until it goes silent) and can be destroyed; the kill counts | 5 |

**What Modern rules should allow:** fighting anyone, anywhere, as in 1984, with the law as the answer, not a switch that turns player fights off. Anarchies are where commanders hunt commanders. Lawful space is safe enough to learn in, because the police, the station guns and the Marshals make murder expensive. No separate "PvP off" mode, so the galaxy stays one place; if newcomers suffer anyway, the protected starter systems get stronger, not a mode.

---

## 4. Testing

### Mark testing alone

1. **Test pilots** (recommended). Mark's admin key unlocks *Call a test pilot* in the game. The server adds a commander to the room Mark is in, flown by the server: it joins, flies a circuit, hails, fires when fired on, and leaves when told. Up to 31 of them fill a system for a load test. They run on the room's own alarm, so they cost duration only while Mark is there, and nobody else can call them. Their tags say *TEST PILOT*, and they never show in the feed or news.
2. **A second account on the same email.** Plus-addressing (`mark+test@…`) reaches the same inbox, so a second account needs no new email. Mark signs it in on the Mac and flies it beside his iPhone. That's for testing what bots can't: two real people, radio, wings.
3. **Local:** `cd server && npm run dev` with the game pointed at it, as now.

### Automated

- **Room tests:** run a whole `SystemRoom` in the test suite with fake WebSockets: join, refuse a guest, two ships fight, a missile hits, a collision, one ship per account, the full room. Today `rules.test.ts` tests the rules but not the room that uses them.
- **A protocol test** that `SHIPS`, `LASERS`, `MISSILE` and `RANKS` match the game (partly there already).
- **Every later step** adds its own room tests: self-defence, kill points, safe zone, radio routing and blocks.

### Load

- **On the server:** re-run the 28 October load test with test pilots on the deployed Worker, not a local copy, to confirm 32.
- **On an iPhone:** Mark flies into a system with 31 test pilots on his own phone. A small `?fps` readout shows frames a second and the slowest frame. The goal is a steady 60 on an iPhone 13 with 31 ships in sight. If not, distant commanders are drawn more simply and updated less often.

---

## 5. Cost and hosting

The server runs on **Cloudflare Workers with SQLite-backed Durable Objects**, on the free plan (`server/wrangler.toml`). Prices below are Cloudflare's published Durable Objects pricing as last checked by this project, and should be confirmed on Cloudflare's pricing page before launch.

**How a flying commander is billed:**
- **Incoming WebSocket messages** count as requests, at 20 messages to one request. One commander sends 10 a second: **about 1,800 requests an hour**. Outgoing messages (relaying to others) aren't billed.
- **Duration:** a system's object stays awake while anyone in it is sending. At 128 MB, **an awake system costs 0.125 GB-s a second, about 450 GB-s an hour,** however many commanders are in it.

**What that means:**

| | Free plan, per day | Workers Paid ($5 a month), included per month |
|---|---|---|
| Requests | 100,000 a day: **about 55 commander-hours of flying a day** | 1 million, then about $0.15 a million |
| Duration | 13,000 GB-s a day: **about 29 system-hours awake a day** | 400,000 GB-s, then about $12.50 a million GB-s |

**Launch traffic (assumptions: Show HN brings an average of 15 commanders flying at once through the day, in about 8 busy systems, for a month):**
- 15 × 24 × 1,800 = **650,000 requests a day**, about 19 million a month: about **$3**.
- 8 systems × 24 h × 450 GB-s = **86,000 GB-s a day**, about 2.6 million a month: about **$27**.
- **About $35 a month** with the $5 plan. A quiet month with a few commanders costs nothing beyond the $5.

**Recommendation: move to Workers Paid ($5 a month) before Show HN** (Mark's spend, Mark's call). On the free plan, the daily limits would be passed with about 3 commanders flying all day, and then requests fail until the next day, so shared space would stop working at the worst moment.

**Keeping it cheap:**
- Duration is the big cost, and it's per awake system, not per commander. An empty system already costs nothing.
- Sending 5 updates a second instead of 10 when nobody else is within 20 km halves requests for lone flyers.
- Batching all positions into one message per tick saves outgoing messages (free) and CPU, which matters for the 32 cap, not the bill.

---

## 6. Steps, sizes and what each needs

| Step | Size | Worker deploy | Site words | Launch copy |
|---|---|---|---|---|
| 1. Signed-in only, sign-in from Shared space (built, PR #319) | 1 day | Yes | Website's "no guests" words (ready, held) | "Shared space is for commanders with a callsign" |
| 1b. Callsign check and loose "taken" (built, PR #319) | half a day | Yes | The /callsign/ page (Website) | The callsign campaign (Marketing) |
| 2. Test pilots, room tests, `?fps` | 2 days | Yes | None | None |
| 3. Every ship as itself; remote lasers drawn right | 1 day | Yes | Shared space page: "fly your own ship" | "Bring your Fer-de-lance" |
| 4. Rank, legal status and ship kept by the server | 2–3 days | Yes | Privacy page: what's stored | None |
| 5. The law between commanders | 2–3 days | Yes | How the law works in shared space | "Fight anyone. The law is watching." |
| 6. Player radio (after the Online Safety Act steps) | 3–4 days plus the paperwork | Yes | Rules, report route, privacy | "Talk to other commanders" |
| 7. Wings | 2 days | Yes | A line on the shared space page | "Fly as a wing" |
| 8. Bounties on commanders | 1–2 days | Yes | A line | Possibly |
| 9a. Cargo canisters between commanders | 1–2 days | Yes | None | None |
| 10. Commanders in the news and the feed | 1 day | Yes | The feed (Website) | None |

Each step is a Worker deploy that Mark runs himself. Website and Marketing words go live after the deploy, not before.

---

## 7. Open questions for Mark

1. **Workers Paid ($5 a month) before Show HN?** Recommended (section 5).
2. **Test pilots:** yes to server-run commanders that only Mark can call, for testing and load?
3. **Rank carried over from single-player:** shown hollow until earned in shared space (recommended), shown as is, or reset to Harmless in shared space?
4. **Player fights:** one galaxy with the law as the answer and no PvP-off switch (recommended), or an opt-out?
5. **Wingmates:** firing on a wingmate no crime (recommended), or the same as anyone?
6. **Radio before or after wings?** Recommended: radio first, as wings are formed by hail.
7. **A minimum age for player radio,** for the Online Safety Act: what is it?
