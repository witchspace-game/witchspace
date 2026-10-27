---
title: The jobs board and company pages
status: building
pillar: trade
summary: The station's Contracts tab, on the website. The contracts on offer at Cambridge Orbital, Lave, right now, filterable, with a page for each of the four companies. Every job is a contract in the game, and the pages say so.
card: cobra-mk3
stages:
  - The jobs board - /jobs/, the live board at Cambridge Orbital, Lave, and what each company offers, filterable | built
  - Company pages - /companies/<id>/, one for each company, from the canon in docs/companies.md | built
  - Careers becomes Jobs - /careers/ redirects to /jobs/; the nav says Jobs | built
  - A rolling board - contracts posted one at a time in the game, each with a notice on the site | built
  - Take this job - a link that opens the game on that exact contract | built
  - Build jobs - Wexley-Yorozu's design commissions on the board (Mark) | proposed
---

# The jobs board and company pages

*Step 3 of the site notes plan (27 October 2026). The website's side of [companies and contracts](companies-and-contracts.md). Agreed with Mark, 27 October; the site is built, the rolling board is with the game dev session.*

**What a job is (Mark):** every commander starts in a Cobra Mk III at Lave, and every job is a **contract offered by one of the Big Four**: Hexon, Vorg, the Mutual and Wexley-Yorozu. There are no other jobs.

**So the jobs board is the station's Contracts tab, on the website.** In the game, docked, the Contracts tab lists what's "On offer at Cambridge Orbital" (Lave's station). /jobs/ shows that same board, at the same moment, to someone who hasn't played yet, and explains what each kind of contract is. Each company also gets its own page.

**The rule that comes first:** these are jobs in a game. They must never pass for real job adverts, to a person or to a search engine. See [Keeping it a game](#keeping-it-a-game).

## How the Contracts tab works in the game

What the site has to mirror, from `src/game/contracts.ts`, `src/game/assignments.ts` and `renderContracts()` in `src/main.ts`. It was checked in the game on 27 October as a new Modern commander docked at Lave.

### The board

- **The same for everyone.** Each station's board comes from its seed and the clock. It changes every half hour (`BOARD_SLOT`) and is sorted best-paid first. The commander only matters for what they can take and what they've already taken.
- **Who posts:** four to six company offers, each from a company weighted by its **presence** in the system (`presence()`). On top of those, a Wexley-Yorozu **moon survey** three times in four, where W-Y works.
- **Starter work:** every company keeps one starter (Casual) job on the board, small enough for anyone. Bigger cargoes need Contractor, Trusted or Preferred standing.
- **One card per offer:**
  - the company, in its colour
  - "Rush", if it's a rush job
  - what it is and where it goes: "13 t Food → Orerve 6.8 LY", with a government tag ("Feudal · pirates" in red)
  - "within 3 jumps · **149 Cr** (48 danger bonus)", and "needs Contractor" if it does
  - **Take**, greyed out with the reason when you can't take it

### At Lave, over a week of boards (the real numbers)

| | |
| --- | --- |
| Offers per board | about 6; never an empty board |
| By company | Wexley-Yorozu 53 %, Mutual 20 %, Hexon 18 %, Vorg 10 % (Lave is a dictatorship with moons: W-Y country, Vorg's edge) |
| Surveys | about 3 boards in 4 have one |
| Rush jobs | about 1 offer in 5 |
| Needing more than starter standing | about 1 offer in 30 |
| Pay | 30 to 510 Cr; typically about 140 Cr |

### Taking one

- **The cargo is supplied.** Take loads it at once ("Contract taken: 13 t Food for Orerve, loaded") and plots the course, the safe way round.
- **Limits:**
  - three contracts at once (`MAX_ACTIVE`)
  - they share the hold: a Cobra has 20 t, so after 13 t of food an 8 t job greys out ("Needs 8 t free in the hold")
  - every single cargo contract (3 to 16 t) fits an empty Cobra
- **Deadlines are in jumps, never hours,** so closing the browser never makes you late.
  - The last jump brings a warning.
  - Late pays half.
  - Three jumps past the deadline, the company takes its cargo back.
- **Standing:**
  - **Up** on delivery: +1, +2 for rush or danger, +3 for a special assignment.
  - **Down:** abandoning is −3, losing the cargo with your ship −2.
  - Below zero, companies forgive a point a day, or you can pay to make amends.

### Work that isn't on the public board

These are real, but personal to a commander, so the site describes them rather than listing them:

- **The welcome job.** Arrive through an advert (`/play/?company=hexon`) and that company's starter job sits at the top: "Welcome aboard", plus a 60 Cr signing bonus.
- **Special assignments.** With Contractor standing, a company may get in touch: a message, a phone notification or an email. It offers a small, strange, well-paid cargo (Hexon's sealed biologicals, Vorg's crates that tick, the Mutual's relief supplies, the W-Y sample case). The offer is open 48 hours.
- **Special orders.** Pathfinder explorers get Wexley-Yorozu's terraforming-candidate surveys.
- **Work on your route.** In flight, with a comms array, companies radio offers at your next station. Accept and the contract is held for you; collect it within two jumps.
- **Messages, files and incidents:** your inbox, each company's file on you, and lost special cargo held by police, blackmailers or pirates.

## A live board: contracts posted one at a time (Mark)

*Mark: "It needs to feel live." Contracts should come in one by one, each with a small notification, not all at once every 30 minutes.*

**Why it starts in the game.** The site must show what the game shows. A trickle on the site over a board that, in the game, still changes all at once would be a fiction, so the change is to the game's board, and the site follows it.

**A rolling board** (`board()` in `src/game/contracts.ts`; game dev session):
- **Every few minutes, a station may post a contract.**
  - The clock is cut into 5-minute ticks.
  - At each tick the station's seed decides whether something is posted, and how long it stays up: 25 to 60 minutes.
  - The board is every contract whose time is still running: about six at Lave, as now, but changing a card at a time.
- **Still the same for everyone, still no server.** Each contract has its own posting time from the seed and the clock, and its id comes from that time, not from the half hour.
- **The shape (agreed with the game dev session):** `board(c, here, now)` keeps its signature. Every offer gains `posted` and `until` (ms). `TICK = 5 * 60_000` is exported for the site's re-check timer. Ids look like `<galaxy>:<index>:<postedTick>:<n>`, `survey:…` and `order:…`. `welcome()` stays one per half-hour slot, since it isn't on the public board.
- **Keep what works:**
  - each company's starter job, on its own cycle
    - Every company with a real presence at a station (1 or more) posts a starter about every 50 minutes, at an offset from the seed, and each stays up 60 minutes. At Lave that's Hexon, the Mutual and W-Y; Vorg posts there, but without a guaranteed starter.
    - So there's always one per company, and they arrive at staggered times.
    - The board is still worked out from the clock alone. A rule like "when one lapses, the next post is a starter" would depend on every earlier post.
  - Wexley-Yorozu's surveys, on their own 45-minute cycle, one at a time, up about three quarters of the time (random ticks sometimes put two identical surveys on the board)
  - the welcome job and work-on-your-route
- **New in the game too:**
  - a docked commander sees a new card slide in, marked "Just posted"
  - the Contracts tab button can say "Contracts · 1 new"
  - offers radioed in flight stay open until that contract comes off the board, instead of until the half hour

**On the site:**
- **New contracts:** every few seconds the page works out the board again. A new contract slides in at its place with a "Just posted" glow, and a small notice says so ("New at Lave · Hexon Holdings · 7 t Liquor/Wines → Qutiri · 125 Cr"). Tapping the notice scrolls to the card.
  - The notice sits at the bottom on a phone and the corner on a desktop, and fades after a few seconds.
  - Only one notice at a time; the rest queue.
  - No sound, and no browser notifications.
- **Leaving contracts:** a card whose time is up fades out, marked "Off the board". A countdown on each card says when it goes ("Up for 14 more min").
- **On load:** each card says how long ago it was posted ("Posted 3 min ago"), so even the first look shows a board that moves.
- **The home page:** the "Now" ticker and the step 2 feed carry "Posted at Lave" items from the same source.

**Honest about it:**
- Contracts leave because their time runs out, never because "someone took it".
- "Taken by CMDR …" waits for claimed contracts on the server (shared galaxy, stage 4 of companies and contracts), and then only for real commanders.

**Until the game changes,** the site shows the half-hourly board as it is, with "New board in 12 min". It doesn't fake a trickle.

## The jobs board: /jobs/

### 1. On offer at Cambridge Orbital, Lave

The board a new commander sees on docking, live.

- **Where it comes from:**
  - `board()` run in the browser for a brand-new Modern commander at Lave, as the home page works out its news
  - nothing from the server
- **Cards look like the game's:** the same order, colours, government tags and wording, so the first thing a new pilot sees in the game is familiar. On top of the game's line, the site adds:
  - "Open to new pilots", or "Needs Contractor standing"
  - "13 t of your Cobra's 20"; surveys say "No cargo: fly out to the moons and look"
  - the deadline explained once, above the list: "Deadlines are counted in hyperspace jumps"
- **It changes:** contracts arrive and leave one at a time, with a notice for each new one (see [A live board](#a-live-board-contracts-posted-one-at-a-time-mark)).
- **Apply** opens the game: see [Apply](#apply).

### 2. What each company offers

The adverts now on /careers/ each turn out to be **a kind of contract that's really in the game**. Under the live board, they explain what you'll find:

| Advert on /careers/ | What it is in the game |
| --- | --- |
| Discreet Medical Courier (Hexon), Frontier Freight Pilot (Vorg), Member-Haulier (Mutual), Colony Supply Pilot (W-Y) | Haulage: the company's own goods (Hexon's medicine and luxuries, Vorg's alloys and machinery…), starter work |
| Luxury Goods Haulier (Hexon) | Bigger haulage, needing Contractor standing |
| Survey Contractor (W-Y) | Moon surveys |
| Specimen Transport Associate (Hexon), Irregular Cargo Specialist (Vorg), Relief Runner (Mutual), Science Division Courier (W-Y) | Special assignments, by invitation at Contractor standing |
| Pest Control Operative (Vorg) | Not in the game: marked "Coming soon" |

- **One data file:** the adverts move out of careers.html into `site/jobs.json`, each tagged with its kind. /jobs/ and the company pages both read it, and the marketing session's words go in one place.
- **Linked to the live board:** an advert whose kind is on the board now says "2 on the board now", and tapping it filters to them.
- **The numbers have to be true.** Today's adverts promise "From 300 Cr a run" and "Up to 600 Cr", but at Lave starter work pays about 140 Cr, and at most about 500. The figures will come from the game, or the claims go.

### Filters

A row of chips, kept in the address (`/jobs/?company=vorg&kind=survey`) so a filtered board can be shared.

- **Company:** Hexon, Vorg, the Mutual, Wexley-Yorozu.
- **Kind:** haulage, survey, rush, danger pay, open to new pilots.

**An empty filter is normal.** Vorg is on fewer than half of Lave's boards. Then the board says so plainly: "Nothing from Vorg at Lave this half hour: it works the frontier. Riedquat, an anarchy one jump away, is its ground." It also says when the next board comes.

With no JavaScript, the adverts show and the live board says it needs JavaScript.

### A short "How contracts work"

Under the board, in four lines from the facts above:
- the cargo is supplied
- deadlines are in jumps
- late pays half
- standing opens bigger work and, at Contractor, the special assignments

It ends: "Every commander starts at Lave in a Cobra Mk III with 20 t of hold and 100 Cr."

### Apply

- **Advert buttons** go to `/play/?company=<id>`, as now: the game opens on the Contracts tab with that company's welcome job and its 60 Cr signing bonus. That's right for an advert.
- **A live card** is a specific contract. The welcome job isn't the one you clicked, so the button can't honestly say "Take this job".
- **Agreed with the game dev session:** `/play/?contract=<id>&company=<companyId>` (the id doesn't carry the company, and the fallback needs it).
  - The game opens on the Contracts tab with that offer highlighted at the top, if it's still on the board.
  - Otherwise it falls back to the company's welcome job.
  - A new commander starts docked at Lave, so Lave's cards always resolve. Cards from other stations (a company page's fallback station) fall back to the welcome job.
  - Board ids come from the station and the posting time, so the site and the game agree on them.
  - This is in `src/main.ts`, so it's **a small change for the game dev session**.
  - Until then, live cards say "Fly for <company>".

## Company pages: /companies/<id>/

One for each company: `hexon`, `vorg`, `mutual` and `wy`, the ids the game uses. **docs/companies.md stays the canon**, and each page is built from that company's section.

1. **Header:** the mark, the name, the motto and the colour (`COMPANIES` in `src/game/companies.ts`), plus its pitch.
2. **Who they are:** "Where it came from", "What it does" and "What people say", from the canon.
3. **Its ship:** the Coral, Gaboon, Garter or Bullsnake, as written. The Bullsnake links to its ship page; the others say "Not built yet".
4. **Working for them:**
   - its adverts, from jobs.json
   - its home ground, from `presence()` in words: Hexon the safe core, Vorg anarchies and feudal worlds, the Mutual anywhere with a government, W-Y thinly settled worlds with moons
   - its contracts on the board at Lave now, if any; if none, at the nearest station on its home ground (for Vorg, Riedquat, one jump from Lave)
5. **Standing:** the ladder from Blacklisted to Partner and what each rung opens, including the special assignment in that company's voice ("Mr Vorg would like a favour").
6. **Between them:** its line from "Between them", and links to the other three.

**Off the company pages:** the logo and concept-art prompts, and the story hooks. They're for builders, and stay on the full design page.

## Build jobs: Wexley-Yorozu's design commissions (Mark)

*Mark: "We do also offer Build jobs where users can contribute to the Witchspace universe! I think 5000 credits for an approved design from Wexley-Y!"*

These match the commission already designed in [the Titanoboa](ship-the-titanoboa.md#paid-on-commission-mark-25-october-2026):
- 5,000 Cr, once, when an accepted module is first fitted at a yard
- 2,000 Cr for an accepted revision

On the site:
- **Where they go:**
  - their own section on /jobs/ ("Design commissions", `#build`), after the companies' adverts
  - repeated on the Wexley-Yorozu page
- **Kept apart from the contracts:** kind `build` is never on a station's board, so it has no filter chip and no live count.
- **Apply** goes to the Titanoboa design page (the coupling standard), or to the no-GitHub submit page once there is one.
- **Honest about it:**
  - Every pay line says "when it's first fitted".
  - The section says the payout isn't built yet and no community module has been fitted.
  - Pay is in credits, in the game. Contributors keep their copyright (CC BY-SA 4.0).
  - **The ownership joke stays (Mark):** in character, W-Y owns the design "in perpetuity, across all systems known and unknown.*" The asterisk's footnote, right under the adverts, gives the real terms, and a test keeps the two together on every page.
  - How to submit today: a GitHub pull request, or the ideas board without GitHub.
- **Words** from the marketing session, checked by the game dev session.
- **Waiting on Mark:** whether the adverts go up before the payout is built. Building the payout is about a day's work for the game dev session.

## Careers becomes Jobs

- **The nav:** "Careers" becomes "Jobs". The footer's "Careers (in game)" becomes "Jobs (in game)".
- **The redirect:** `/careers/` (and `/careers/#hexon`) go to `/jobs/` (and `/jobs/#hexon`), with a permanent redirect in vercel.json. Browsers keep the `#` part, and the board keeps the company anchors.
- **In the game:** only code comments in `main.ts` and `contracts.ts` mention `/careers/`. Nothing a player sees needs changing.
- **Breadcrumbs:** "Jobs", and "Companies" for the company pages.

## Keeping it a game

- **On every page:** "These are jobs in Witchspace, a free game you play in your browser. Nobody will ask for your CV." at the top of /jobs/ and of every company page.
- **The money:** pay in credits (Cr), never pounds or "salary". No real places, real dates, "full-time", "remote" or "benefits package".
- **Search engines: no `JobPosting` data.**
  - That type puts listings into Google's jobs search, next to real vacancies.
  - The pages are `WebPage`s, part of the Witchspace `VideoGame`.
  - The live board is an `ItemList` of `CreativeWork`s.
  - Each company is a `CreativeWork` about a fictional organisation ("A fictional company in the game Witchspace"), never an `Organization`.
- **Share cards** say "Jobs in Witchspace" or "A company in Witchspace" on the card itself.

## Share cards

| Page | Ship on the card | Kicker |
| --- | --- | --- |
| /jobs/ | Cobra Mk III *(what every commander flies)* | Jobs in Witchspace |
| /companies/hexon/ | Coriolis *(the Coral isn't built)* | A company in Witchspace |
| /companies/vorg/ | Mamba | A company in Witchspace |
| /companies/mutual/ | Cobra Mk III | A company in Witchspace |
| /companies/wy/ | Titanoboa | A company in Witchspace |

## How it's built

- **Static parts:** `tools/build-site.ts` writes /jobs/ and the four company pages, from:
  - jobs.json, for the adverts
  - docs/companies.md (cut at its `##` headings), for the canon
  - the game's own modules, for the colours and standings
- **The live board:** `src/site/jobs.ts`, on /jobs/ and the company pages.
  - It imports `board()`, `presence()` and the galaxy, as `live.ts` already does for the news.
  - It formats cards the way `renderContracts()` does, but doesn't share its code: that's in main.ts and tied to the game screen.
- **Tests:**
  - Lave's board is never empty through a week of half hours.
  - Every advert's kind exists in the game.
  - The fallback station for each company really is on its home ground.
- **No server.**

## Words needed from the marketing session

Placeholder copy (the current careers text) until these arrive:

1. **Company pages:** a short in-character pitch for each, for its header.
2. **Adverts:**
   - pay lines that match the game (starter work about 50 to 250 Cr at Lave)
   - two more adverts for Wexley-Yorozu, since it posts over half the work at Lave
3. **One line per company for the live cards,** in its voice. Hexon: "Punctuality essential." Vorg: "Danger pay included. Pirates also included."
4. **Empty filters:** a line for when a company has nothing at Lave this half hour. In character, but plainly saying there's nothing.
5. **Meta descriptions and card subtitles** for /jobs/ and each company page (under 160 characters, saying it's a game).

## Questions for Mark

1. **The rolling board:** send it to the game dev session as a change to `board()`? Without it, the site can't honestly trickle.
2. **Take this job:** the game dev session will build `/play/?contract=<id>&company=<id>` in the same PR as the rolling board, once you say go.
3. **The adverts' pay:** bring them into line with the game (about 50 to 500 Cr), or keep them as in-character puffery with a "typical pay at Lave" line from the real board beside them?

## As built (27 October 2026)

- **The pages:**
  - /jobs/ and /companies/hexon|vorg|mutual|wy/ come from `tools/jobs.ts` and `site/jobs.json`. The words are the marketing session's, checked against the game.
  - /careers/ is a permanent redirect to /jobs/ (vercel.json). /companies/ goes to /jobs/ too.
- **The live board:**
  - `src/site/board.ts` holds the logic, with no DOM; `src/site/jobs.ts` runs the page.
  - The board is worked out again every 5 seconds.
  - Today it changes every half hour, and a new board brings one notice ("New board at Lave · 5 contracts").
  - The game's board rolls (game dev, PR #219, 27 October), and the site switched by itself: a notice for each arrival, "Posted 19 min ago" and "Up for 26 min more" on each card, and "Take this job" on Lave's cards, linking to `/play/?contract=<id>&company=<id>`. Checked on the live site the same day. Lave averages about 6 offers.
  - The rolling board itself is designed in [companies and contracts](companies-and-contracts.md), "The board: posted one at a time".
- **Company pages:** a company with nothing at Lave shows its board on its home ground, the nearest world it leads: Hexon at Leesti, Vorg at Riedquat, the Mutual at Reorte (each one jump away). W-Y's home ground is Lave.
- **Pay found by building it:** Hexon never posts Contractor work at Lave, but at Leesti it's common: typically 400 Cr, sometimes over 1,000. The Luxury Goods Haulier advert now says "typically 300 to 1,000 Cr".
- **Tests** (`src/site/board.test.ts`):
  - Lave's board is never empty over a week.
  - Every cargo fits a Cobra.
  - Every advert's kind turns up at Lave or on its company's home ground.
  - Each home ground really is led by its company.
  - The company pages carry no concept-art prompts.
