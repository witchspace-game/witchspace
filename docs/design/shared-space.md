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
  - Every ship flown as itself on the server | built
  - Rank, the law and your ship kept by the server | proposed
  - Registering your ship, the passport and the door into shared space | proposed
  - The law between commanders: self-defence, fair kills, protected starters | proposed
  - Talking to each other (player radio stage 2) | proposed
  - Wings | proposed
  - Bounties on commanders | proposed
  - Giving and trading between commanders | proposed
  - Commanders in the news and the feed | proposed
---

# Design: shared space

*Proposed, 30 October 2026, at Mark's request. Plan only: nothing here is built until Mark says yes. Change by pull request.*

Mark: "shared space is important for many reasons. I do want to be able to test it and I want to know what's already working." And: "This needs planning and doing properly."

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
| **Moves refereed:** speed with 30% slack, teleports, the J jump with a cooldown and never within 3 km of another commander (no jumping out of a fight, Mark, 31 October 2026), positions outside the system; refused moves put you back | `server/src/rules.ts` `checkMove` |
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

1. ~~**Every ship is a Cobra on the server.**~~ *Fixed: each hull flies as herself (step 3, below).* `protocol.ts` `SHIPS` lists only `cobra-mk3`, and `hello` forces anything else to it (`index.ts:384`). Others see a Cobra, and the server holds her to Cobra numbers: Mark's Fer-de-lance has 240 shields and 200 hull in the game, but the server caps her at 100 and 150. Her first hit in shared space takes her shields down to the Cobra's. Her three missiles are fine; a ship with more than four would be cut to four.
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

### Step 3. Every ship flown as itself *(built, 31 October 2026)*

Mark: *"What needs to happen before I can show off my FdL in shared space? I feel like this could be a big thing."*

As built:
- **The ships come from their files:** `src/content/flyable.ts` reads speed, shields, hull, missiles and a hit radius (71% of the hull's furthest point: the Cobra's 28 m, the Fer-de-lance's 46 m). The server's `SHIPS` is that list, and a test checks every hull a commander can own, and every edition's, is in it.
- **An edition is shown only by its owner.** The game sends the edition's number with its paint, and the server keeps it only if the account holds that number (`server/src/paint.ts`). The Dark Edition's black-light lights come only with a Dark Edition. Anyone else claiming one flies plain.
- **Tags say what she is:** *◆◆ CMDR Darkstar · Dark Edition 001 · 0.9 km*, or the hull's name for anything but a Cobra.
- **Seen live, 31 October 2026:** Mark flew Dark Edition 001 out of the Lamarr Terminal at Ensoreus on his iPhone, and a second account (CMDR spotter, on the Mac) saw her as herself: *"That worked I got to see her!"* How to test it again: a second account (a maintainer's own address with `+test`), and the Mac's production copy (`npm run build`, `npx vite preview --port 5312`) opened at `http://localhost:5312/play/?at=<system>`, which starts a new commander in that system and talks to the live server; the live server accepts `localhost` but not the Mac's network address.
- **Still to do here:** remote lasers drawn the way they fired, and each ship's own laser sound. Until step 4 the hull (not the edition) is still the browser's word.

Planned:

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

### Step 4a. Registering your ship *(Mark, 9 November 2026)*

Mark: *"When they first play the game, in order for them to be able to rank, get a better ship, more equipment and all the rest of it, they get told they have to register their ship. As soon as they register the ship, we know when it was registered: the date, the time, etc. We know that it's a basic ship. If a week later they try and go into shared space with lasers and everything else, then we know it's not true."*

**Why.** Single-player saves live in the browser, so anyone can edit one. Carrying a commander into shared space invites cheats: edit your way to a Fer-de-lance with military lasers and pick on newcomers (Mark: *"The latter would invite cheats!"*). But making shared space start from scratch would throw away everything earned in single player (Mark: he doesn't want a player to *"go through all the pain"* of a docking computer, better lasers and a bigger hold, *"and then realise that when they go into the shared space, they can't take that equipment with them"*). Registering at the start fixes both. It gives the server the one thing it can't otherwise have: a known, honest starting point for each commander. From there, single player becomes the training ground, and everything earned in it counts in shared space, because it's all on the record.

**How it works**

1. **Play first.** A new commander starts as now: a Cobra Mk III at Lave, 100 Cr, Harmless. They can fly, dock, trade and fight with no sign-up. Asking for an email at the very first screen loses players.
2. **Register to progress.** The first time they go to buy equipment or a ship, or reach Mostly Harmless, the game says: *"Register your ship to trade up."* By then they know they like it.
3. **Registering is signing in** with an email (as shared space already needs). The server checks the ship is still basic and stamps it, kept for good:
   - a registration number, the callsign and account (so the email);
   - the date and time, and the home port (where they registered);
   - the ship as registered: *Cobra Mk III, standard fit, 100 Cr, Harmless*;
   - the start of the commander's ledger, so the chain begins at a point the server saw.
   One tick box with it: *"I'll fly fair. Witchspace keeps a record of this ship, and of when and where it flies in shared space, to keep things fair."* That's the consent the privacy page points to.
4. **Papers.** A registration certificate (built on the [edition certificate](edition-certificate.md)): number, date, home port and the ship in its paint. It shows on the callsign card, and can be shared. *"Registered 9 November 2026, Lave"* gives every ship a history.
5. **Everything after is on the record.** The ledger already chains every trade by hash and is checked against the galaxy's seeded prices on each cloud save (`src/game/ledger.ts`, `server/src/ledger.ts`, since #275). Registration adds:
   - **equipment:** a new ledger entry for each piece of kit bought: what, where, for how much. It must be a station whose tech level sells it, at its price;
   - **rank:** kills and rating points as they're earned, held to a believable pace;
   - **ships:** from the yard records the server already keeps (`server/src/yard.ts`).
6. **One commander for both.** Single player and shared space use the same registered commander. Nothing is lost going in or coming out.
7. **The door into shared space** (the passport). Each time a registered commander joins, the server replays their record from registration and compares what they bring (hull, lasers, missiles, ECM, rank, edition paint) with what the record shows they earned. The first entry into shared space is stamped (date, time, system, as they were), and so is every one after, so each return is checked against the last.
   - **It adds up:** in they go.
   - **It doesn't** (a beam laser with no purchase, Dangerous with no kills on record, an altered ledger, a tampered save): they don't fly in shared space until a maintainer has looked. Mark gets an email (as the ideas board does, #409): *"CMDR X: a beam laser with no purchase on record (registered 9 November 18:42)"*. The rest of the game goes on as normal.
8. **Single player unregistered** carries on as it is, and nothing there is checked. If someone plays unregistered for a while, buys things, then wants to register, the server can't trust that time. They choose: register a fresh basic ship (their unregistered save carries on as a separate single-player game), or keep playing unregistered.

**Every ship has a transponder number** (Mark, 10 November 2026, as *"an elegant way to prevent cheating and to encourage users to register their ships"*: *"Can we keep a record of every ship's transponder code? … so the transponder code stays with the ship. … Why don't we just issue every ship a transponder number?"*). The game already has a transponder: on or off for running dark (Modern), damaged in a fight, and the police read your hull when they can't hail you. Now it carries a number, on every ship in the game.

- **Every ship has one from the moment it exists,** registered or not, the player's or an NPC's: *WS-7F3K-29*. It's part of the world, not a sign-up step. A new commander's first Cobra shows its number on the first launch.
- **The number belongs to the ship, not the commander.** Renaming or repainting the ship doesn't change it. Kit fitted is logged against it (what, where, when, for how much), so each hull has its own history.
- **Who issues it is what counts.** A number made in the browser is a label: anyone who edits a save can give themselves any number. A number in the server's registry is proof.
  - **Unregistered:** the number is made in the game and works everywhere except shared space.
  - **Registering** writes that same number into the registry. You keep your number; registering makes it official.
  - **Every ship bought after registering** gets its number from the server, straight into the registry.
- **The ship registry** keeps every registered number: the hull type, who holds it, and each change, with date and system:
  - *registered*;
  - *kit fitted*;
  - *traded in*: the hull goes back to the yard with its number;
  - *destroyed*: the number is retired with the wreck, and its entry says where, when and who did it (*"WS-7F3K-29, destroyed at Riedquat by Ambrose Hale, 10 November"*). **New ship, new number** (Mark, 10 November 2026): the insurers' replacement gets its own number, linked to the old one (*"replaces WS-7F3K-29"*), so the chain stays unbroken. An escape pod doesn't save the number, only the kit. A Fugitive's bare Co-operative Cobra is a new ship with a new number, linked the same way.
  If commanders can ever sell ships to each other, the number and its history go to the new owner.
- **At the door:** the ship sends its number when it enters shared space. The server turns it away, the *"it's not true"* moment caught without guesswork, if:
  - the number isn't in the registry;
  - another commander holds it;
  - its recorded kit doesn't match what the ship carries.
- **Seen by others:** targeting a commander shows *"Cobra Mk III Small Mercy · WS-7F3K-29"*. Shared-space police log it, and a Wanted notice names it. Running dark hides it, which gives running dark a real point.
- **NPC ships carry numbers too,** seeded from the system, the clock and the ship, so every commander sees the same number on the same ship. That makes the world feel registered and gives the law something to name:
  - **The scanner and the police:** *"Python · CX-4471 · Offender"*. A police hail can read your number back to you, and a bounty can name the pirate's: *"Wanted: Python CX-4471, piracy, 120 Cr"*.
  - **Renowned pirates** fly famous numbers, the same for everyone: *"Ambrose Hale's Cobra, RQ-0046, the rose Cobra"*. The news and the saloon use them: *"RQ-0046 seen near Riedquat"*.
  - **The Falcon, Legends and characters** get theirs written by hand, like the famous three pirates.
  - **The format** shows who flies it: two letters for a region or maker, then digits for NPCs, and *WS-* plus a mixed code for commanders, so a commander's ship is never mistaken for an NPC's.
  - NPC numbers are made in the game from the seed, never registered, so they cost the server nothing.
- **Privacy:** a number names a ship, not a person, but the registry ties a registered number to a callsign. It follows the account: hidden at once and archived 90 days when the account is deleted, then erased. A destroyed or traded-in hull's entry outlives its commander only as the hull type and number, with no callsign.
- **Size:**
  - numbers on every ship, the player's and NPCs', in the scanner, the target readout, police hails and bounties, with no server: about 1 day, and it could ship before registration;
  - the registry: about half a day on top of step 1 below.

**Her name, and the galaxy talking about her** *(Mark, 12 November 2026; proposed)*. Mark: *"The name of the ship becomes important and should be part of the game. Example the ship can be named by pirates in saloons etc. This way the ship rather than the comdr flying her can be shared in the news etc without asking for permission."*

- **One name per ship, unique across the galaxy** among registered ships, whatever the hull: one *Brass Neck*.
  - Names match as callsigns do (`callsign_key` in `server/src/accounts.ts`, `names.ts`): case, spacing and look-alike letters count as the same name.
  - The same filters as callsigns: no swearing, no real brands, nothing official-sounding (*Galactic Police*, *Co-operative*).
  - **Reserved for the characters,** never claimable: *Second Wind* (Odile Venn), each renowned pirate's ship (*Small Mercy* and the rest), *On Loan*, and any name held for a character still to come (members 002–100). A server-side list, so nothing in a save can claim one.
- **On her papers, beside her number:** *Brass Neck · WS-7F3K-29 · registered at Lave, 12 November*. The number stays with the hull for life; the name can change, and a rename is an entry in the registry like any other. Names still aren't drawn on hulls (Mark, 2 November 2026): her name is on her papers, her manual, her clips, and now in the galaxy's talk.
- **Released** when her ship is destroyed and not replaced, when she's renamed, or after 90 days with her commander inactive; then held 90 days before anyone else can claim it.
- **Claimed free, at registration.** A newcomer has a Cobra and 100 Cr, so naming can't wait for an order or a payment. Registering claims the callsign *and* her name together, for the Cobra they already fly. The configurator leads into it (Website): *"Last Orders is free. Register to claim her name and fly her now. Her paint waits at the yard."* Unregistered, a ship can be called anything in its own game: not checked, not unique, and never public.
- **"Let the galaxy talk about her"** (the consent). One tick box when naming her: *"Let the galaxy talk about her: in saloons, the news and Witchspace's own posts."* This is what makes Mark's *"without asking for permission"* honest: the player gives it once, up front, and can change it at any time from her papers.
  - **Ticked:** her name and story can appear in saloon gossip, the in-game news and the live feed, the yard's order book, and Witchspace's own posts (Instagram, Reddit, press).
  - **Unticked:** she's *"a Cobra"* in the game's own talk, and never in marketing.
  - The privacy page explains it (Website), live before it ships.
- **Ships in the story of the galaxy** (ticked ships only). Built on what the game already records: the flight recorder's moments, firsts, crimes and Your record, the renowned pirates' memory, the yard's records.
  - **Saloon gossip** ([trading.md, the saloon](trading.md#3-the-saloon)): *"Saw the Brass Neck take on three Mambas at Riedquat and limp home."*
  - **A renowned pirate's grudge:** *"Old Iron's asking after a Cobra called Brass Neck."*
  - **Wanted notices** ([law-and-travel.md](law-and-travel.md#ship-registry-and-flags)): *"Wanted at Leesti: the Cobra Last Orders."*
  - **The news and the live feed** ([live-feed.md](live-feed.md#named-ships-mark-12-november-2026-proposed)): *"The Brass Neck made the first survey of Xeesle."*, *"The Last Orders left the yard at Lave in Zaonce Neon."*
- **The yard's order book** on the site ([ship-configurator.md](ship-configurator.md#the-yards-order-book-mark-12-november-2026-proposed)).
- **The API** (agreed with Website, 12 November 2026; Website builds its pages against stubs of these while the Worker side is built, and both go out together after Mark's deploy):
  - `GET /names/check?name=` → `{ ok: true }` or `{ ok: false, why: 'taken' | 'reserved' | 'rude' | 'held', suggestion?: string }`. Public, rate-limited per network hash (it's for live checking as someone types), and it says nothing about who holds a name.
  - **Claiming at sign-up:** the sign-in call that sets the callsign (email code → callsign) takes optional `shipName` and `talk: boolean`. Errors come back per field, `{ errors: { callsign?: why, shipName?: why } }`, so each shows beside its own box; the callsign can succeed while the name is refused.
  - `PATCH /me/ship` with `{ name?, talk? }`: rename her or change the tick. A rename is logged in the registry (old name, new name, when), and the old name goes into its 90-day hold.
  - `GET /me` adds `ship: { name: string | null, number: string, talk: boolean }`.
  - `GET /yard/book?hull=&colour=&before=&limit=` → `[{ name, hull, colour, glow, trim, port, status: 'specced' | 'ordered' | 'ready' | 'delivered', yard?, at, spec }]`, newest first (`before` is an `at` for paging, `limit` at most 50). Public, cached about 60 s. Only registered ships with `talk: true`. `spec` is the `Spec` that *"Spec one like her"* opens.
  - **Where an entry comes from:** *specced* is the account's website spec (`PUT /me/spec`), so a spec saved on the site joins the book only for a registered account that ticked *talk*; *ordered* and *ready* are the yard's order records (`server/src/yard.ts`); *delivered* is the handover, kept for 30 days on the book.
- **Size** (on top of registration, step 1 below, which is still proposed):
  - the name registry, reservations, release and hold, the consent flag, and claiming at registration: about 1½ days, Worker deploy;
  - the order book's list on the server (`GET /yard/book`): about 1 day, Worker deploy (Website builds the page: about 3 days with the naming step and the callsign page, alongside);
  - named ships in the saloon, pirates' grudges, wanted notices, the news and the feed: about 2 days. The saloon and the news are worked out in the browser from the seed and the clock, so this needs a small server list of ticked ships and what they've done lately, read like the feed.
  About 4½ days in all.

**The security record** (Mark: *"I was thinking about a security side as well"*). Alongside the passport, every visit to shared space is kept for 30 days:
- account and callsign, system, time in and out, and how they left;
- the network hash (never an IP address) and device type;
- how many of their moves, shots and claims the server refused.

It flags one account from many networks at once, many accounts from one network, and visits with many refusals, emailed to Mark. A complaint (*"CMDR X killed me at Lave around 18:40"*) is one lookup. Bans from shared space are by account, network hash or both, set from the admin side with no deploy; a banned commander still plays solo. Only Mark can see the record, with the admin key. Deleting an account archives its visits with the rest of the account for 90 days (#411), then erases them. A ban keeps only the hashes.

**Commanders who already have progress.** There are few. Each is registered as they are on the day this ships, with any existing ledger flags shown, and Mark takes a one-off look at the list rather than making anyone start again.

**What it doesn't close.** A commander who plays honestly but very fast (a bot) still has to be caught by pace limits. The moment-to-moment game still runs in the browser until the server keeps the books itself (roadmap phase 4). This makes cheating hard, not impossible: a big step from today, where nothing is checked at the door.

**Decisions for Mark** (suggested answers marked):
1. **When to ask:** at the first equipment or ship purchase, or at Mostly Harmless, whichever comes first *(suggested)*; or straight after the first dock; or only at the door to shared space.
2. **What an unregistered commander can't do:** buy equipment and ships, and rank past Mostly Harmless *(suggested)*; or nothing, so registering only matters for shared space.
3. **A fee:** none *(suggested: registering should feel like a welcome, not a toll)*; or 100 Cr for the ritual.
4. **Re-registering:** once per commander *(suggested)*; a new commander can register a new ship.
5. **A flagged commander at the door:** kept out of shared space until Mark looks *(suggested)*; or let in with a hollow insignia.
6. **Ideas board:** this is a design decision Mark has made, so it's written here; it could also go on the board, framed as "Register your ship", for players to see it coming.

**Size.** About 5½–6½ days, in this order, each its own pull request:
0. Transponder numbers on every ship, NPCs' included, in the game only (1 day, no server; can ship any time).
1. Registration: the prompt, the stamp, the certificate, the ledger's start, and the ship registry (2½ days, Worker deploy).
2. Kit and rank in the ledger, checked on each cloud save (1 day, Worker deploy).
3. The door: the passport check, the 30-day visit record, flags emailed to Mark, bans (1–2 days, Worker deploy).
4. Existing commanders registered, and Mark's look at the list (half a day).
5. Her name: the registry, the consent and the order book's list; then named ships in the galaxy's talk (about 4½ days, two Worker deploys; Mark, 12 November 2026, proposed).

Website: a privacy line (what's kept at registration and in shared space, for how long) live no later than each deploy, and a page explaining registration. Marketing: *"Register your ship"* is a moment worth a post.

### Step 5. The law between commanders

[Combat rating](combat-rating.md#4-points-for-player-kills-multiplayer) section 4, made real by the server:
- **Self-defence:** the server records who fired first. Shooting back at an attacker is no crime, and killing someone who attacked you, or who is Wanted, is lawful.
- **Fair kill points:** a legitimate kill earns the victim's ship value × 3 × the rank factor. It earns nothing two or more ranks below you, half each time for the same commander within 24 hours, and nothing against a ship freshly launched, docking or disconnected.
- **Safe zones:** inside a lawful station's 5 km, firing on a commander brings the station's guns on you. The server applies their damage itself, so it's the same for everyone.
- **Protected starter systems** ([law and travel](law-and-travel.md)): in the core systems around the starting stations, killing a commander is always a Fugitive crime with a warrant at once, whatever your rank.
- **Anarchies stay lawless,** and say so on arrival in shared space: *"Anarchy. No law here, and commanders may attack you."*
- **No hit-and-run** *(Mark, 31 October 2026)*: you can't switch shared space off during a fight, or for a few minutes after firing on a commander (the 15-second linger stays). A warrant earned in shared space freezes in solo: it doesn't cool, can't be settled and doesn't age there. Legal status lives on the server (step 4).
- **Warrants travel at the speed of news,** and murder costs a share of your wealth, part of it to the victim ([law and travel](law-and-travel.md#warrants-travel-at-the-speed-of-news-mark-31-october-2026)). Robbery that's paid stays robbery ([the pirate's career](pirate-career.md#2-robbery-beats-murder)).

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

- **Marshals' warrants become everyone's business:** a Wanted commander's tag says so, and whoever brings them in collects the bounty, paid by the Marshals, so nobody can farm it with a friend (no payout to wingmates, the same account, or an account that has shared the killer's network lately: section 3).
- **Player-posted bounties** come later, with credits held in escrow, which needs the server ledger.

### Step 9. Giving and trading

- **First, cargo:** jettison canisters that other commanders can scoop. The server keeps track of each canister, so it exists once for everyone.
- **Then credits and goods by agreement**, once credits live on the server (roadmap phase 4), never between accounts that share a network while either is new (section 3). Haulage contracts between commanders ([economy and exchanges, section 5](economy-and-exchanges.md#5-contracts-and-futures-multiplayer)) come after that.

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

### Ideas, not builds: getting commanders to meet (Mark, 10 November 2026)

Mark: a few hundred commanders spread over 2,048 systems almost never meet. With about 10 online, the chance two share a system is about 2%, or about 16% if they all stay in Galaxy 1. He wants honest nudges, never fake players. **Decided: ideas for now.** They go on the ideas board for votes after Show HN. Scoped 10 November.

Everything here counts **commanders in shared space** only. The server never sees single-player flying.

| Idea | Cost | Notes |
|---|---|---|
| 1. The chart shows "N commanders this hour" | about 1 day, Worker deploy | Shared-space joins are already logged in `space_joins` (account, room, time; kept 1 hour). Add a public `GET /space/busy/<galaxy>` with counts only, no names, cached a minute, and a chart marker like the Pirates row. "Here now" also needs rooms to report leaves: about half a day more. |
| 6. Traces: "a commander passed through an hour ago" | about half a day, alongside 1 | Keep `space_joins` 24 hours, not 1. The same endpoint gives the last time anyone was seen. |
| 2. One headline event a day per galaxy | about 1 day, in the game only | Seeded from the clock (economy/events.ts), led in the News, and spreading outward by `newsArrives`. Stronger effects are what draw people, but they move the economy, so check them with the simulation first. |
| 3. Real activity in the news, as counts | half a day for "4 commanders flew at Leesti this hour" (reuses 1) | Trade counts would need a report-your-trades endpoint, which is easy to fake: about 2 days, and better skipped. The renowned-pirate results are already shared (#409). |
| 4. A weekly set-time convoy (Friday 20:00 UK out of Lave) | 1–2 weeks properly | Shared space has no ships that every commander sees, other than the commanders themselves. A cheap version: every game spawns the same seeded convoy at that time, about 1–2 days. But that's a meeting time, not a shared fight. |
| 5. A shared bounty when two commanders damage one pirate | after 4 | Pirates are per player, so two commanders never hit the same one. |
| 7. Commanders lead the news *(Mark, 11 November 2026)* | about 2 days, after step 10 | A station's News puts what real commanders did nearby above the seeded events, so the news shows where commanders have been. Below. |

**7. Commanders lead the news** *(idea, Mark, 11 November 2026)*. Mark: use the news to put first the systems where commanders have surveyed or changed something, so players can see through the news where other commanders are.
- **Only what the server saw.** Shared-space exceptions ([the world, 5](the-world.md#5-what-players-change-exceptions)) are already server rows: a convoy saved or robbed, a bounty claimed, a renowned pirate brought down. Surveys happen on the phone, so the server never sees one; a **published first discovery** does reach it ([live feed](live-feed.md)), and ordinary surveys can only show as counts (*"3 worlds surveyed near Leesti today"*) from the counts in idea 3.
- **Ranked, not added.** Commanders' news goes above the seeded events (famine, boom and the rest), nearest and freshest first; quiet systems' boards stay as they are.
- **Where they were, never where they are.** It spreads at the speed of news (`newsDelay`: 10 minutes, then 12 more for every light year), so it's a trail to follow, not a tracker to hunt with.
- **One source, two voices.** The same events feed the station's News, in its formal headline (*"Mutual convoy saved at the Riedquat witchpoint"*), and the saloon's gossip, in a character's words ([the world, 6.6](the-world.md#66-other-commanders-remembered-mark)). Both arrive by the same delay, so the board and the bar never disagree about what's known where.
- **The gossip rules hold:** name the doers, never player victims; kind on balance; a commander flying dark is "a ship with no transponder"; callsigns only with the commander's yes (step 10).

**Suggested order:** 1 with 6 (about 1.5 days, one Worker deploy), then 2, then the activity half of 3. 4 and 5 are a bigger, separate job: ships the server runs, which every commander in shared space sees.

### Ideas, not builds: contested cargo (Mark, 10 November 2026)

Mark: commander A takes a valuable "hot cargo" contract. A rival company offers commander B a contract to stop it before it's delivered, so both end up in the same system. **Rule (Mark): real missions like this only open once a commander reaches Competent.** It's an idea for the ideas board, not a build.

- **What exists:** fights between commanders are already run by the server. It rules on hits and announces who destroyed whom, so a kill can't be faked. The server knows nothing about cargo or contracts: those are generated in each game (game/assignments.ts, `rivalPrice`). The shared-space protocol carries no cargo, so nothing drops when A is destroyed.
- **The opt-in shape:** hot cargo pays more and says up front that a rival may send someone. A's position reaches B late, through the news delay, so it's a chase rather than a beacon. The law still applies, so a route through an anarchy is the danger zone. Whether attacking a commander in shared space feeds the law (Offender, Fugitive) still needs checking.
- **The full version, about 1.5–2 weeks:**
  - a server registry of hot cargo runs: posted by A, listed at nearby stations, taken by B, result recorded (about 2 days)
  - the contract screens for both sides (about 2 days)
  - canisters the server owns, dropped when A is hit and scooped by whoever the server says got there first (about 3 days; a small slice of convoy idea 4)
  - testing on two devices
- **The minimum honest version, about a week:**
  - B's job is to stop the courier by destroying A's ship before delivery. No scooping.
  - B is paid only on the server's own "destroyed" message.
  - A's delivery payout is trusted to A's game, as all contracts are now.
  - If no commander takes the intercept in time, a seeded NPC hunter comes instead, labelled as an NPC (built from the renowned pirate's spawning and fight style).
- **Build first:** at about 10 online, there's almost never a B, so nearly every run ends with the NPC hunter. Build hot cargo plus the labelled NPC hunter first (about 1–2 days, in the game only, no server) to prove the fun. Then add the registry so a real commander can take the hunter's place.

---

## 3. Fair play and griefing

| Problem | Answer | Step |
|---|---|---|
| **Spawn camping** at a station | The station's own flight (police, or the militia in an anarchy), its doorstep bounty that other commanders can answer, and docking refused to anyone who fires on it ([the station's own flight](law-and-travel.md#the-stations-own-flight-mark-2-november-2026), Mark, 2 November 2026) | 5 |
| **Ganking newcomers** | Protected starter systems; no points two ranks down; repeat kills count less; a warrant and the Marshals for killing a clean commander in lawful space | 5 |
| **Alts** (second accounts to feed kills, bounties or gifts) | One inbox, one account: name+tag@ and Gmail's dots sign in to the account that inbox already has (#326; maintainers excepted). The sign-in network as a reason to refuse anything that pays, never to block an account (below). Repeat-kill halving; new accounts can't post bounties or broadcast | built / 4–9 |
| **Cheating clients** | The server already referees moves, lasers, missiles and collisions. Step 4 takes rank, legal status and the ship off the browser. Turn rates are the next movement check | 3–4 |
| **Spam and abuse on the radio** | Off by default, mute, block, report, the filter, rate limits, people review reports | 6 |
| **A full system** | 32 flying; the next flies solo and retries. Batch updates into one message per commander per tick when it matters | built / later |
| **Leaving mid-fight** to deny a kill | A ship that disconnects in a fight stays in space for 15 s (it already does, until it goes silent) and can be destroyed; the kill counts | 5 |

**Second accounts and the network (Mark, 30 Oct 2026).** Mark: "If a user was determined they would use the same IP, wouldn't they?" Often, but an address can't lock anyone out: mobile networks put thousands of phones behind one address, a household shares one, and a VPN changes it in seconds. So it's a signal, kept as the scrambled network fingerprint the rate limits already use, never the address itself:
- **No bounty payout** when the killer and the victim have shared a sign-in network lately (step 8).
- **No gifts or trades** between accounts that share a network while either is new (step 9).
- **A flag for the maintainer** when several accounts come from one network and only ever deal with each other. People decide; nothing is banned automatically.
- **Not two-factor or phone numbers:** two-factor protects an account from theft but doesn't stop a second account, and a text-message check costs money per text, asks for something personal and is beaten by throwaway numbers. The email code already proves the inbox.

A cheat on one network gets nothing; a family on one Wi-Fi still flies together, they just can't farm each other.

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

**Done (Mark, 30 Oct 2026): Workers Paid ($5 a month), signed up before Show HN.** On the free plan, the daily limits would be passed with about 3 commanders flying all day, and then requests fail until the next day, so shared space would stop working at the worst moment. Mark signed up in the Cloudflare dashboard on 30 October; no change to the Worker was needed.

**Keeping the lights on, long term (Mark):** "I don't mind paying the 5 a month; however, long term I need to work out how to keep the lights on." Still to work out. The directions so far:
- **Donations, shown openly:** a supporters' page (GitHub Sponsors, Open Collective or Ko-fi) and a line on the site with this month's server bill and how much of it supporters covered.
- **A thank-you, never an advantage:** a supporter's name in the credits or a small mark beside their callsign, but nothing that helps in the game, and never the special editions (by invitation only).
- **Mind the tribute:** Witchspace is a free tribute to Elite, so anything that looks like selling the game needs care. Donations towards running costs are the safe kind.
- **Keep the bill small first:** the savings below, and the cap on busy systems.

**The budget guard (Mark, 30 Oct 2026: "Can I protect it so it doesn't get abused or I get a stupid bill I can't pay?"; built).** Cloudflare has no hard spending cap, so the server keeps its own (`server/src/spaceBudget.ts`):
- Each system room reports its busy time and messages every minute; the day's cost (UTC) is worked out from Cloudflare's prices.
- **$3 a day** (Mark). At 90% no new ship joins ("Shared space is busy today · flying solo for now"); at 100% everyone flies solo until midnight UTC. Single-player is never limited. Mark gets a notification at each mark.
- **The worst month is about the budget times 31, plus the $5:** under $100.
- **An off switch and the budget, with no deploy** (Mark: "You never know it may go viral!"): `npx tsx tools/space.ts` shows today; `budget 10` raises it; `off` and `on`. The budget stays where it's set until changed back.
- **Per ship:** 24 messages a second at most (the game sends 10 positions and the fastest lasers 10 shots), and one account may join 60 systems an hour, one network 150.

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
| 4a. Registering your ship, the passport and the security record | 4–5 days | Yes (three) | Privacy line; a page on registering | "Register your ship" |
| 4b. Her name: unique names, the consent, the order book, named ships in the talk (proposed) | 4½ days | Yes (two) | The naming step and consent (configurator, callsign page); privacy wording; the order book page | Real ships with real stories, ticked ships only |
| 5. The law between commanders | 2–3 days | Yes | How the law works in shared space | "Fight anyone. The law is watching." |
| 6. Player radio (after the Online Safety Act steps) | 3–4 days plus the paperwork | Yes | Rules, report route, privacy | "Talk to other commanders" |
| 7. Wings | 2 days | Yes | A line on the shared space page | "Fly as a wing" |
| 8. Bounties on commanders | 1–2 days | Yes | A line | Possibly |
| 9a. Cargo canisters between commanders | 1–2 days | Yes | None | None |
| 10. Commanders in the news and the feed | 1 day | Yes | The feed (Website) | None |

Each step is a Worker deploy that Mark runs himself. Website and Marketing words go live after the deploy, not before.

---

## 7. Open questions for Mark

1. ~~**Workers Paid ($5 a month) before Show HN?**~~ Yes (Mark, 30 Oct). How to pay for it long term is still open (section 5).
2. **Test pilots:** yes to server-run commanders that only Mark can call, for testing and load?
3. ~~**Rank carried over from single-player:**~~ Answered by registration (step 4a, Mark, 9 November 2026): rank earned since registration counts in shared space, because it's on the record; anything that doesn't add up keeps the commander out until Mark looks.
4. **Player fights:** one galaxy with the law as the answer and no PvP-off switch (recommended), or an opt-out?
5. **Wingmates:** firing on a wingmate no crime (recommended), or the same as anyone?
6. **Radio before or after wings?** Recommended: radio first, as wings are formed by hail.
7. **A minimum age for player radio,** for the Online Safety Act: what is it?
