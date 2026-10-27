---
title: The Witchspace MCP server
status: building
pillar: build
summary: Bring your own AI, and build Witchspace with it. One web address lets Claude, ChatGPT or Cursor design, check and preview ships, modules and stories, try them in the game, and hand them in for review, credited to your callsign, with no GitHub. The connector that powers the Build side.
card: coriolis
stages:
  - Contributors - validate, preview and balance-check ships; the designs and help wanted; galaxy lookups | built
  - Hand it in - sign in, submit, follow it, revise it; the review queue and a pull request made for you | building
  - Guided workshops - prompts for a first ship, a module, a saloon regular | proposed
  - Every content type - Titanoboa modules, characters, news events, trails, company files | proposed
  - Try it - the live viewer in the chat, and a link that flies your draft in the game, in a test system | building
  - The community - claim a task, post and vote on ideas, see your credits and commissions | proposed
  - Players - the live galaxy, public news only | proposed
help:
  - Try it with your own assistant and tell us what it got wrong | playtest
  - Write the prompts that make a good first ship with it, as a guide for newcomers | writing
  - Suggest a tool you'd want your assistant to have | design
---

# Design: the Witchspace MCP server

*Design, 24 October 2026. Stage 1 built and live at https://space.witchspace.org.uk/mcp; the rest proposed.*

## Why

Witchspace is built to work with AI assistants: every content type has a strict schema, and `AGENTS.md` tells any assistant how to contribute well. The Get involved page has promised "a Witchspace MCP server so assistants can validate, preview and balance-check content directly". This is that.

MCP (the Model Context Protocol) lets an assistant use tools a service provides. With a Witchspace server added, someone can say *"design a pirate gunship for Witchspace"* and their assistant can check its own work against the real rules, draw it, compare it with the class it belongs to, and know which tasks are wanted, without the person needing GitHub, code or our repo on their machine. That's "no wall" from [the community platform](community-platform.md).

## Principles

- **One address, nothing to install.** A remote MCP server on the Worker we already run: add `https://space.witchspace.org.uk/mcp` to Claude, ChatGPT or Cursor and it works. A local version runs from the repo for people who code.
- **The same truth as the site.** Every answer comes from the code and files the game and site use: the schemas, `validate.ts`'s rules, the design headers, the galaxy generator. Nothing is copied by hand.
- **Read-only until a person says so.** Tools look and check; nothing is changed or submitted without the person asking, in the conversation.
- **Never a shortcut through the game.** Players get public information (what the news says, where yards are building, what a system is), never the answers the game asks them to earn: no best trade routes, no price predictions, no where-the-Falcon-is. Learning the exchange should pay ([trading](trading.md)).
- **Honest about authorship.** The person is the author; contributions made with it are marked AI-assisted, as `AGENTS.md` asks.

## The Build connector *(Mark, 27 October 2026)*

Mark's point: the Build side of Witchspace feels out of reach if you don't code, because every road ends on GitHub, and we haven't fully embraced AI tools. Most people who'd design a ship or write a saloon regular already have an AI assistant. So the connector should be **the whole workshop**, not just a checker: you talk to your assistant, it does the files, the rules and the checks, and you do the imagining, the judging and the play-testing.

The loop, all in one conversation:

1. **Pick something.** *"What does Witchspace need that I could do?"* The assistant reads help wanted, suggests tasks that fit, and **claims** one for you, so two people don't build the same prison module.
2. **Make it.** A guided workshop (an MCP *prompt*: they show up as ready-made starters in Claude and others) walks you through it: the brief, the rules, two or three real examples, then drafts with you.
3. **See it.** A preview after every change: the ship beside a Cobra, the module coupled into a Titanoboa line-up, the regular in a saloon scene. Where the client can show interactive views inside the chat (MCP Apps), it's the game's own wireframe renderer, turning, so you can drag it round.
4. **Try it.** A link that opens the game with your draft in it, in a quiet test system: fly your ship, dock at a yard fitted with your module. Drafts are private, expire after a week, and never reach shared space.
5. **Hand it in.** Sign in once (the same email code as the game), and submit. It's credited to your callsign, marked AI-assisted, and you can follow it, answer review notes and revise, all from the conversation.
6. **Get it in.** A maintainer reviews the queue. Accepting it opens the pull request for you, credited, and you get a notification. When it's in the game you get the in-game reward (the Contributor rung; a Wexley-Yorozu commission for a module), and your name is on it.

Nobody needs GitHub, the repo or a terminal. People who code still can, and the same checks run in CI.

### What's new, beyond stage 1

| Area | Tools and prompts |
|---|---|
| **Workshops** (prompts) | `first_ship`, `design_module`, `write_regular`, `write_news_event`, `critique` (an honest second opinion against the design principles) |
| **Content types** | `validate_*` and `preview_*` for each format as it gets a schema: modules first (`schemas/module.schema.json` exists), then characters, news events, trails, company files |
| **Context** | `preview_lineup` (a module in a Titanoboa), `compare_fleet` (beside every ship in its class), `lore_check` (names, tone, no real companies, every story has people) |
| **Try it** | `playtest_link`: stores a checked draft for a week and returns a /play/ link that loads it in a test system |
| **Hand it in** | `sign_in` (OAuth, the client's own sign-in screen), `submit`, `my_submissions`, `revise`, `withdraw` |
| **Community** | `claim_task` / `release_task`, `ideas` (search), `post_idea` and `vote` (signed in), `my_credits` (accepted work, commissions, rank) |
| **Maintainers** (admin only) | `review_queue`, `review` (accept, or send back with notes), which opens the pull request from a GitHub App |

### Rules that keep it safe and fair

- **Reading needs nothing; writing needs a sign-in.** Every write (claim, submit, idea, vote) is tied to an account, rate-limited, and size-capped.
- **Nothing is public until a person accepts it.** Submissions are private to their author and the maintainers, so the queue isn't a place to post things, which also keeps the online-safety duties small. The ideas board stays the public, moderated place.
- **The checks are the game's checks.** The same validator, renderer and generator as the game and CI: one truth, no hand-copied rules.
- **The person is the author.** The connector never submits on its own; the person asks, in the conversation, every time.
- **Still no shortcuts through the game** for players (see Principles).

### How it's built

On the Worker that already serves it. Sign-in is OAuth 2.1 (what MCP clients expect for remote servers), with our email code as the login step, so the account is the game's account. Submissions, claims and drafts are tables in the `Accounts` Durable Object beside the saves. Previews are SVG today; the in-chat viewer is a small HTML resource running the game's renderer, served where the client supports it. The pull request is opened by a GitHub App with access to this repo only.

The web form and the ship workshop page on the site use the **same** submission API, so a person without an AI assistant gets the same path ([the community platform](community-platform.md), stage 3).

### The plan *(27 October 2026, agreed with Mark)*

**Hand it in comes first.** The Build adverts on /jobs/ now offer real in-game fees, and today the only way to hand anything in is a GitHub pull request. An assistant can already make and check a ship with stage 1; what's missing is somewhere to send it. Building the submission system first also gives the site's form and ship editor their back end, so people without an AI assistant aren't left out.

**What the clients can do** (checked 27 October 2026):

- **MCP Apps** (interactive views inside the chat) is an official MCP extension since 26 January 2026, supported by Claude (web and desktop) and ChatGPT among others. A tool names a `ui://` resource (`text/html;profile=mcp-app`) in `_meta.ui.resourceUri`; the view runs in a sandboxed frame, may call our tools, and reaches no other site unless the resource declares it (`_meta.ui.csp`). So the game's own renderer can turn a draft inside the chat.
- **Claude:** custom connectors with OAuth sign-in on paid plans, tools that write included.
- **ChatGPT:** full MCP, with tools that write, is in beta for Business, Enterprise and Edu; Plus and Pro may only get the read-only tools. So a ChatGPT Plus user may be able to design and check in the chat but not submit from it. **The site is the path everyone has; the connector is the convenient one.**

**The stages, in order:**

| # | Stage | Where | What |
|---|---|---|---|
| 1 | **Submissions** | Server | The submission system on the Worker, one API for every way in. The maintainers' review queue. Accepting opens the pull request. |
| 2a | **Submit from the connector** | Server | OAuth sign-in through the client's own screen; `submit`, `my_submissions`, `revise`, `withdraw`; `review_queue` and `review` for maintainers. |
| 2b | **Submit from the site** | Site | A submit form (paste or upload a file, or fill in the fields) and *My submissions*; then [the ship editor](community-platform.md), stage 3. Both use stage 1's API. |
| 3 | **Workshops** | Server | The prompts (`first_ship`, `design_module`, `write_regular`, `write_news_event`, `critique`) and `validate_module`, `preview_module`, `preview_lineup`. |
| 4 | **Try it** | Server | The in-chat viewer (MCP Apps), then `playtest_link`. |
| 5 | **The rest** | Server | Other content types as they get schemas; claims, ideas and credits. |

**Stage 1, the submission system:**

- **What's stored:** a `submissions` table in `Accounts`, beside the saves. Each row has the author's account, its kind (ship or module to start with), the file, a note, *made with AI* (yes by default from the connector), where it came from (connector or site), its status (`submitted`, `changes wanted`, `accepted`, `withdrawn`), the review notes, the pull request link, and its versions (a revision keeps the old one).
- **The API**, signed in with the game's existing session: `POST /submissions`, `GET /submissions/mine`, `GET /submissions/<id>`, `PUT /submissions/<id>` (revise), `DELETE /submissions/<id>` (withdraw). Maintainers: `GET /submissions?status=…` and `POST /submissions/<id>/review` (accept, or send back with notes). CORS for our own sites only.
- **Checked on the way in** by the same validator as CI (the ship rules stage 1 already runs; the module rules, compiled the same way). A file that fails isn't stored: the answer lists every problem, so the assistant or the form can fix it.
- **Limits:** signed in with a callsign; 64 KB a file; five submissions a day and ten open at once per account. The full contract is [submissions](submissions.md).
- **Private:** an author sees their own, maintainers see all, nobody else sees any. Nothing is public until a maintainer accepts it.
- **Accepting** opens a pull request from a **GitHub App** that can reach this repo only: a branch `submission/<id>`, the file in its place (`content/ships/` or `content/modules/`), credited to the callsign and marked AI-assisted, with the submission linked. The merge is still a maintainer's, with CI's checks. For a module, the maintainer adds `inService` before merging, which starts [its commission](ship-the-titanoboa.md).
- **Hearing back:** a push notification when it's accepted or sent back (for anyone who allowed them), and the status in *My submissions* on the site and in the chat.

**What Mark does** (the exact steps will be written out when we get there):

- Create the GitHub App in the witchspace-game organisation (contents and pull requests: read and write; this repo only), install it, and put its id and private key into the Worker with `wrangler secret put`.
- Deploy the Worker after each stage.
- Add the connector to his own Claude account, so every tool is tested in the real client before it's announced.

**Still to decide while building:** whether sign-in uses Cloudflare's OAuth provider library (which keeps its grants in a KV namespace: one new, free binding Mark would create) or our own tables in `Accounts`. Either way the login step is the game's email code, so the account is the game's account.

## Signing in from an assistant *(stage 2a, building)*

Handing work in needs an account, so the connector gets a second address that signs you in. Reading and checking stay open to everyone at the first.

| Address | Sign-in | Tools |
|---|---|---|
| `https://space.witchspace.org.uk/mcp` | none | the stage 1 tools: read, check, draw |
| `https://space.witchspace.org.uk/mcp/build` | your Witchspace account | the same, plus `submit`, `my_submissions`, `submission`, `revise`, `withdraw` |

**How signing in works.** MCP clients sign in to remote servers with OAuth 2.1, so the Worker is a small OAuth server whose login step is the game's own sign-in:

1. Adding `/mcp/build`, the client is told to sign in (a `401` pointing at `/.well-known/oauth-protected-resource/mcp/build`) and finds our authorisation server (`/.well-known/oauth-authorization-server`).
2. It registers itself (dynamic client registration, `POST /oauth/register`, or a client metadata document, where the client's id is a URL) and opens `/oauth/authorize` with PKCE.
3. The Worker checks the request and sends the browser to **`https://witchspace.org.uk/connect/?request=<id>`**, a page on the site. That page uses the game's sign-in (the email code), so someone already signed in to the game in that browser just clicks **Allow**. A callsign is needed first, since work is credited to it.
4. Allowing sends the browser back to the client with a code, which the client trades at `POST /oauth/token` for an access token (an hour) and a refresh token (30 days, replaced at each use).
5. The connector's tools act as that account. Submissions from it are marked `via: connector` and AI-assisted.

Only the hashes of codes and tokens are kept. Signing out of the game doesn't revoke a connector; deleting your account does, and so does **Disconnect** in your list of connected assistants (`GET /me/connections` → `{connections: [{client, name, uri, until}]}`, and `DELETE /me/connections?client=<id>`, which signs that assistant out at once).

### As built *(27 October 2026)*

- `server/src/oauth.ts` (the metadata, PKCE, return addresses), the clients, sign-ins, codes and tokens in `Accounts` (`server/src/accounts.ts`), and the signed-in tools in `server/src/mcpBuild.ts`, which call the same submission routes as the site.
- Clients can register (`POST /oauth/register`) or identify themselves with a metadata document's address; both are kept in `oauth_clients`.
- The issuer is always `https://space.witchspace.org.uk`. To try it locally: `npx wrangler dev --var OAUTH_ISSUER:http://127.0.0.1:8787`, with the site on `npm run dev` for the connect page.
- Tested end to end against `wrangler dev` with a script playing the client: told to sign in, register, authorise, the connect page's two calls, a wrong PKCE verifier (refused, and the code spent), tokens, the signed-in tools handing a module in, refresh (and the old refresh token refused), a bad token, and saying no.
- The connect page is `site/pages/connect.html` and `src/site/connect.ts` (the site's).
- **Tried in the real client (Claude Code, 27 October 2026):** Mark connected `/mcp/build`, and every tool worked as CMDR Jameson: `my_submissions`, `submit` (credited, designer set to the callsign), `submission`, `revise` (version 2), `withdraw`, and a broken file's problems coming back as a list with nothing kept. Two fixes came out of it: Claude Code registers its local return addresses without a port (RFC 8252 lets the port vary, #234), and `submission` now returns the file compactly.
- **Tried in claude.ai too (27 October 2026):** adding the connector, Claude found the sign-in settings itself and chose its published identity (a client metadata document); the connect page showed it as Claude, Allow brought it back connected, and in a chat it used `my_submissions` (after Claude's usual "allow once") and answered correctly. claude.ai also offers "sign in when needed", which could later let one address serve signed-out reading and signed-in handing in. `review_queue` and `review` for maintainers come later; `npx tsx tools/submissions.ts` does that meanwhile.

### The live viewer *(built, 27 October 2026; Mark: "the wow moment")*

`view_ship` (on both addresses: it only reads) shows a ship turning in 3D inside the chat, where the client shows MCP Apps (claude.ai, Claude Desktop, ChatGPT). Pass a ship file or a fleet ship's id.

- The tool names its view in `_meta.ui.resourceUri` (`ui://witchspace/viewer.html`), served as `text/html;profile=mcp-app` from `src/mcp/viewer.ts`. The answer's `structuredContent` carries the geometry and colour for the view; its text tells the model what's shown, and clients without views (Claude Code in a terminal) get that text alone.
- The page is self-contained (no network, plain ASCII) and speaks the MCP Apps protocol by hand: `ui/initialize`, `ui/notifications/initialized`, then the tool result; it reports its size and offers full screen where the host has it.
- It draws in neo glow on a canvas, with the game's hidden-line look (faces filled dark and drawn far to near, so near faces hide far lines) and a Cobra Mk III beside it in grey for scale; it turns slowly until touched, and you drag (mouse or finger) to turn it and pinch or scroll to zoom. A light drawing of the same geometry and colours, not the game's three.js renderer, so it's small and quick on a phone.
- Next: modules and a Titanoboa line-up in the same view, with `validate_module` and `preview_module`.

### The connect page: the contract with the site

The page lives on the site, so it shares the game's sign-in. It calls two endpoints (CORS for our sites, like `/me`):

- `GET /oauth/request/<id>` → `{client: {name, uri}, scope: 'submit', expires}` (404 if it's gone or expired: ask them to start again from their assistant). Send the session if there is one, and the answer also has `callsign`.
- `POST /oauth/request/<id>` with `Authorization: Bearer <session>` and `{allow: true | false}` → `{redirect}`. Then set `location.href` to it. Allowing needs a callsign (`403 "Choose a callsign first"`); refusing sends the client an `access_denied`.

What the page says: who is asking (`client.name`, which the client chose, so say "says it is"), what it may do ("hand in ships and modules as CMDR X, and see and change the ones it handed in"), and that nothing goes public until a maintainer accepts it.

## 1. Contributors *(built)*

Tools:

| Tool | What it does |
|---|---|
| `validate_ship` | Checks a ship file against `schemas/ship.schema.json` and the geometry rules in `validate.ts` (closed, convex parts, face winding, size), and the written rules: a class, a maker, a reason to exist ([ships, classes and makers](ships-and-classes.md)), and the homage rule (evoke, never copy an on-screen design). Returns every problem, with how to fix it. |
| `preview_ship` | Draws the ship as wireframe pictures (three-quarter, front, side, top) with a Cobra Mk III beside it for scale, returned as an image. |
| `balance_check` | Compares the ship's stats with its class in the class table: "fast for a bulk trader, and its hold is a third of a Python's". |
| `list_ships`, `get_ship` | The fleet, and any ship's file, so an assistant can learn from real ones. |
| `designs`, `get_design` | The roadmap and every design document: status, stages, summary, and the text. |
| `help_wanted` | Every open task, by skill (ships, writing, art, playtest, design, code), with the design it belongs to. |
| `galaxy_system` | Any system by name or number: government, economy, tech level, population, position, neighbours within 7 light years, and its description, so stories and missions land somewhere real. |
| `worldbuilding` | The tone guide, the companies and the people, for writing that sounds like Witchspace. |

Resources: the ship schema, `AGENTS.md`, `CONTRIBUTING.md`, the worldbuilding guide and the lore, so an assistant can read them before it starts.

**How it's built.** A route on the existing Worker (`server/src`) speaking MCP's streamable HTTP transport. The JSON Schema check is compiled at build time (Ajv's standalone output), since Workers can't compile code at run time; the geometry checks, the galaxy generator and the doc headers are plain TypeScript the Worker can import. Previews are drawn as SVG on the server (the same projection the game uses, without WebGL), so no browser is needed. A small stdio wrapper (`npx tsx tools/mcp.ts`) serves the same tools locally.

**Limits.** Rate-limited per address; inputs capped in size; no accounts needed for stage 1, since nothing is written.

## 2. Submissions

*Superseded by The Build connector above, kept for the history.* `submit_ship` sends a design that has passed `validate_ship` to the submission queue planned in the community platform (stage 3, the ship editor), with the person's name or callsign and a note, and returns a link to watch it. A maintainer turns good ones into pull requests, credited. This needs the queue to exist first, and an account (a sign-in link, as the game already uses) so submissions have an author and can be limited.

## 3. Players

The live galaxy, from the same seed and clock every commander shares, public information only:

| Tool | What it does |
|---|---|
| `news_at` | The news as it reaches a system now, as its station's News tab shows it. |
| `yards` | Where Wexley-Yorozu's Titanoboa is building, and what stage it's at. |
| `firsts` | Who first surveyed a world: the names on the chart. |
| `rules` | How something in the game works, from the design documents ("how does insurance work?"). |

Not included, on purpose: prices, routes, the best trade, where a pirate or a Legend is. A commander's own save stays private; if commanders later want their assistant to see their own commander (cargo, contracts, standing), that's an opt-in with a sign-in, and still no answers the game should make them earn.

## 4. New content types

As characters, events, trails and missions become data files with schemas, each gets its `validate_*` tool and examples, and the worldbuilding checks (every story has people, with their glad, sad, mad and bad moments; no real company names).

## Open questions

- Which content type comes after modules: saloon regulars (lots of writers, little risk) or news events (they change the economy, so they need balance checks)?
- Should claims expire (two weeks without a draft?) so abandoned tasks free up?
- Should the in-chat viewer be the first thing built, since seeing your ship turn is the moment people fall for it?

- Should the player tools be in the same server as the contributor tools, or a separate address, so a player adds only what they need?
- How generous should the rate limits be before submissions exist?
- Do we list it in the public MCP directories at launch, or wait until stage 2?
