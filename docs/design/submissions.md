---
title: Submissions
status: building
pillar: build
summary: One way to hand in a ship or a Titanoboa module, with no GitHub. Sign in with the game's email code, send the file from the site or from your AI assistant, and follow it through review. A maintainer accepts it, and the pull request is opened for you, credited to your callsign.
card: titanoboa
stages:
  - The submission system - submit, follow, revise, withdraw; the review queue; accepting opens the pull request | building
  - Submit from the site - a form and My submissions, then the ship editor | building
  - Submit from your AI assistant - the Build connector's submit tools | proposed
  - More kinds - characters, news events, trails, company files, as each gets a schema | proposed
---

# Design: submissions

*Design, 27 October 2026. Stage 1 of [the Build connector plan](mcp-server.md) (Mark): hand it in first. This page is the contract between the server and everything that submits: the site's form, the ship editor and the AI connector all use the same API.*

## Why

Every road into Build used to end on GitHub. The jobs board now offers real in-game commissions for Titanoboa modules, and most people who'd design one have never opened a pull request. So handing something in should take a sign-in and a button, from wherever you made it.

## The rules

- **Signed in, with a callsign.** The same account as the game: the email code, then a callsign. Your work is credited to that callsign, and a module's commission is paid to it ([paid on commission](ship-the-titanoboa.md)).
- **Checked on the way in.** The same checks as CI: the schema, the geometry rules, and for a module the coupling standard. A file that fails isn't stored; the answer lists every problem so it can be fixed and sent again.
- **Private until accepted.** You see your own submissions; maintainers see them all; nobody else sees any. Nothing is public until a maintainer accepts it, and even then it's public as a pull request, the same as any other change.
- **Yours to change.** Until it's reviewed you can revise it (the old version is kept) or withdraw it. Sent back with notes, you can revise it and it goes back in the queue.
- **Honest about AI.** Every submission says whether an AI assistant helped. The file's `credits.aiAssisted` is set to match.
- **Limits:** a file of at most 64 KB; five submissions a day and ten waiting at once, per account.

## What the server fills in

So the credit and the commission can't go astray, the server sets these, whatever the file says:

- `credits.authors` starts with your callsign; `credits.license` is `CC-BY-SA-4.0`; `credits.aiAssisted` is what you said.
- **A new module:** `designer` is your callsign. `inService` and `revisions` are removed: putting a module into service is the maintainer's step, when it's accepted. So is `insignia`: the company mark is on the habitat alone.
- **An improvement to an existing ship or module** (same `id`): it's marked as a revision. For a module, `designer`, `inService`, `revisions` and `insignia` stay as they are in the game; the maintainer adds your revision, which pays the revision fee.

## The API

On `https://space.witchspace.org.uk`. JSON in and out. Our pages only (CORS for witchspace.org.uk and localhost), signed in with the game's session: `Authorization: Bearer <session>`, as the game's own `/me` calls. Errors are `{error}` with a status: 400 (a bad request, or a file that fails: `{error, problems: [...]}`), 401 (not signed in), 403 (no callsign, or not yours), 404, 409 (can't do that in its state), 413 (too big), 429 (limits).

### A submission

```ts
interface Submission {
  id: string;                  // 10 letters and digits
  kind: 'ship' | 'module';
  itemId: string;              // the file's id: content/ships/<itemId>.json or content/modules/<itemId>.json
  title: string;               // the file's name
  revises: boolean;            // an improvement to something already in the game
  status: 'submitted' | 'changes' | 'accepted' | 'withdrawn';
  note: string;                // the author's note to the reviewer
  ai: boolean;                 // an AI assistant helped
  via: 'site' | 'connector';
  review: string | null;       // the maintainer's notes, when sent back (or accepted)
  pr: string | null;           // the pull request, once accepted
  version: number;             // 1, then up by one each revision
  created: number;             // ms
  updated: number;             // ms
  warnings: string[];          // things the checks noticed that don't stop it (ask the author to look)
  file?: object;               // the file as stored, on GET /submissions/<id> only
  callsign?: string;           // the author, in the maintainers' queue only
}
```

### For everyone signed in

| Call | Body | Answer |
|---|---|---|
| `POST /submissions` | `{kind, file, note?, ai, via}` | `201 {submission}`, or `400 {error, problems}` |
| `GET /submissions/mine` | | `{submissions: Submission[], limits: {today, perDay, waiting, maxWaiting}}`, newest first, without `file` |
| `GET /submissions/<id>` | | `{submission}` with `file` (yours, or any for maintainers) |
| `PUT /submissions/<id>` | `{file, note?, ai?}` | `{submission}`: a new version, back to `submitted`. Only while `submitted` or `changes`. |
| `DELETE /submissions/<id>` | | `{submission}`, now `withdrawn`. Only while `submitted` or `changes`. |

`file` is the JSON object, or its text. `kind` must match what it is. `ai` is required (true or false), so the question is always asked.

### Checking without sending

`POST /submissions/check {kind, file}` runs the same checks and stores nothing: `{problems, warnings, title, itemId, revises}` (the last three `null` when it fails). It works signed out, so people can check before they make an account, and it doesn't count towards the daily limit; it has its own, 30 a minute per network. The site's form and the ship editor use it as you type.

### Problems and warnings

A ship that flies must fit the docking slot (90 m wide, 26 m tall, wings level), or say `"docks": false`: otherwise it's a `dock: …` problem ([ships and classes](ships-and-classes.md), "Shape and size").

For a ship that can fly, the warnings include the MCP server's balance check against the fleet, as `balance: …` lines ("Top speed is among the highest in the fleet", "give it a real weakness"); they never stop a submission.

Every problem and warning reads **`<where>: <what>`**. `where` is a field path as the file writes it (`length`, `geometry.vertices[3]`, `credits.authors`) when the check names one, or else an area (`file`, `id`, `kind`, `geometry`, `size`, `maker`, `description`, `homage`). The site pins the ones with a field path to that field and lists the rest.

### For maintainers

With the admin key (`X-Admin-Key`), from our pages or `npx tsx tools/submissions.ts`:

| Call | Body | Answer |
|---|---|---|
| `GET /submissions?status=submitted` | | `{submissions}` with `callsign`, oldest first (any status; default `submitted`) |
| `POST /submissions/<id>/review` | `{decision: 'accept' \| 'changes', notes?}` | `{submission}` |

- **Send back** (`changes`) needs notes; the author sees them, revises, and it's back in the queue.
- **Accept** opens a pull request from the Witchspace GitHub App: a branch `submission/<id>`, the file at its place, credited to the callsign and marked AI-assisted if it was, with the note and the reviewer's notes in the description. Merging it is still a maintainer's call, with CI's checks; for a module, add `inService` before merging to start its commission. Until the GitHub App is set up, accepting records the decision and the pull request is opened by hand.
- Either way, the author gets a notification on every device they allowed, and the new status in My submissions.

## Privacy

A submission keeps the account it came from, the file, the notes and the dates. Deleting your account deletes your submissions, except what's already in a pull request, which is public in the repository under CC BY-SA, credited to your callsign.

## As built *(27 October 2026)*

- The `submissions` table lives in the `Accounts` Durable Object (`server/src/accounts.ts`) beside the saves; the checks and the rules above are in `server/src/submissions.ts`, the GitHub App in `server/src/github.ts`.
- The ship check is the MCP server's `validate_ship`; the module check is the schema (compiled by `tools/mcp-data.ts`, as the ship schema is) plus `checkModule` and `checkService` from `src/content/modules.ts`.
- Maintainers work the queue with `npx tsx tools/submissions.ts` (`list`, `show`, `save` to fly it locally, `accept`, `changes`).
- The GitHub App (Witchspace Submissions, App ID 5493130) is installed on this repository only, with its secrets set (27 October 2026). Tested live with a throwaway submission: it opened the pull request from the App, credited and in place, and was closed unmerged. That test found `modules.test.ts` pinned the module list to the core eight, which would have failed CI on every community module; it now pins only the modules designed by Witchspace.
- Tested end to end against `wrangler dev`: checks on the way in, send back, revise (version 2), accept, no withdrawing after, and the daily limit.
- The GitHub App needs two Worker secrets, `GITHUB_APP_ID` and `GITHUB_APP_KEY` (the private key as GitHub gives it). It needs access to this repository only, with contents and pull requests: read and write.
- **On the site** (*27 October 2026*): [/submit/](/submit/) has the form and My submissions (`src/site/submit.ts`, with the logic in `src/site/submission.ts`, tested). You can paste a file, upload one, or start from a core module, either as a new module or as an improvement to it. The design turns in the ship viewer as you edit, `/submissions/check` runs as you type, and problems with a field path show under that field. The ship editor is next.
