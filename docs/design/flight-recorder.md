---
title: The flight recorder
status: building
pillar: core
summary: Every ship's black box keeps the last minute, and sharing what you saw is part of the game. Watch how you died, keep the great moments, share them to your socials with a link back, use footage as evidence or sell it to the news, and post the best to the station board.
card: cobra-mk3
stages:
  - Photos one tap away on touch screens (P) | built
  - The recorder, the death replay and the flight log, with sharing to socials | built
  - Footage as evidence, and sold to the news | proposed
  - Verified proof of rare sightings, and the Sightings wall | proposed
  - The station board: post clips and photos for other commanders | proposed
  - The kill cam - watch how you died from outside, rebuilt from the fight's data (design/kill-cam.md) | proposed
  - The library: one central store for commanders' moments and their data | idea
  - The Witchspace channel: commanders' Shorts on YouTube, edited by an AI agent | idea
help:
  - Write the newsroom's voice: what it says when it buys your footage of the Falcon | writing
  - Playtest the death replay and tell us if it made you want to share it, or just stung | playtest
  - Design the station board as it appears in the game, docked | design
  - Invent a rare sight worth photographing: what it is, where, and who'd pay for proof | writing
---

# Design: the flight recorder

*Design, 24 October 2026. The recorder, the death replay and the flight log are built; the rest proposed. Modern rules; Classic keeps 1984's single life and no replays.*

## Why

P takes a photo of the view, without the HUD, and has since October. But a photo just downloads, or goes to the phone's share sheet, and the game forgets it: there's no reason for it inside the game, and nowhere for it to live. And the moments people most want to keep (the kill that made Dangerous, the Falcon crossing close, the Bastion coming through, how they died) happen too fast to think "record".

The answer is a thing every ship already ought to have: a **flight recorder**. A black box, a dashcam: always running, never needing to be remembered. What it keeps is yours to watch, keep, share and, in the game, to use.

A picture paints a thousand words. Seeing something amazing in space, catching it, and showing your friends should be part of playing, not something you do outside the game with a screen recorder. Mark: "it's like social media never died." Commanders trading clips of their best fights and worst deaths, on their own socials and in the game, is how a space game gets talked about, and every share is an invitation to play.

## Principles

- **Sharing is part of the game.** Every photo and kept moment is one tap from WhatsApp, Instagram, TikTok, X or Facebook, branded, with a link back that unfurls into a proper preview and puts the viewer one tap from playing.
- **Never ask the player to press record.** The recorder keeps the last minute, always; you decide afterwards what was worth keeping.
- **Footage is worth something in the game,** not just outside it: evidence for the law, news for the newsroom, proof for explorers.
- **Yours until you say otherwise.** Everything stays on your device. Nothing is uploaded unless you post it, deliberately, signed in.
- **Light on the phone.** 720p, only while flying, a setting to switch it off, a log with a space limit, and nothing left lying around: what you don't keep clears after a week.
- **Told, not hidden.** The first time it keeps something, the game says so, and the flight log asks once whether to keep it on.
- **Never in the way.** Nothing pops up mid-flight: photos and clips go to the log quietly, to share once you're docked.
- **The picture is the game's own.** Only the 3D view is recorded: no HUD, no other apps, nothing personal.

## 1. Photos *(built)*

P, or the camera button on touch screens (beside the drawer tab, always to hand), takes a photo of the view without the HUD, with a small WITCHSPACE mark in the corner. It goes into the flight log (a JPEG of a few hundred KB; PNG in 1984 mode), with a shutter flash and nothing else, so a photo mid-fight costs nothing; you share it from the log once docked. Where the log can't be used (storage blocked), it's shared or saved straight away as before.

## Sharing it

Sharing works everywhere a commander can see a photo or a kept moment: the camera button, the death replay, the flight log, the station board.

- **One tap to your socials.** On phones, the share sheet (WhatsApp, Instagram, TikTok, Messages...) with the picture or clip itself; on desktop, the site's share buttons (Facebook, X, WhatsApp) and a link to copy.
- **Branded, always.** Photos carry the WITCHSPACE mark; clips end on a short card: the wordmark, *Trade. Fight. Explore. Build.*, witchspace.org.uk.
- **A link that sells the game.** Shared from an account, a moment gets its own page on the site (as press kit items do): the clip playing, your callsign, the system, what happened ("Jameson vs a pirate pack at Riedquat"), a Play free button, and a branded preview card so it unfurls properly on every platform.
- **Vertical too.** Clips are offered upright for stories and reels as well as wide, cropped to the action.

## 2. The recorder, the death replay and the flight log *(built)*

*Built, 24 October 2026: `src/game/recorder.ts` (WebCodecs H.264, 720p, 30 fps, a rolling 30 s in memory, cut at keyframes), `src/game/moments.ts` (titles, descriptions and tags written from the game's own events), `src/game/flightLog.ts` (IndexedDB, 20 moments) and `src/ui/flightLog.ts`. Moments kept by themselves: a kill, the Falcon's hull read, the Marshals coming through, a survey, your death. By hand: Shift+P, or hold the camera button. A switch in the station tab turns it off. Photos don't go into the log yet.*

*Revised, 25 October 2026, after Mark's worry about phones filling up and about P in a dogfight: the buffer is a minute, and **a fight is one clip** (each kill within 25 seconds of the last re-cuts it from the fight's start, up to a minute, replacing the earlier cut; a death in the fight folds it in: "Took 2 pirates with me"). The bitrate is halved (1.2 Mbps: glowing lines on black lose nothing, checked frame by frame), so a 26 s clip is about 3 MB. The log has a **150 MB budget** and 60 moments; the oldest unkept moment makes room, unkept moments clear after a week, and the log shows the space used with a Clear unkept button. **Photos go to the log.** The first kept moment is announced in flight, the death replay says what the recorder is, and the log asks once: Keep it on, or Turn it off. Classic rules have no recorder, as this design always said.*

*And it rests (Mark, 25 October 2026): in open space with nothing about, it stops recording, saving battery, and wakes the moment anything is near: a ship or missile within scanner range, the station, a planet, a rift, or a Legend anywhere in the system (the Falcon runs dark, so "near" is what the game knows is there, not what the scanner shows). It carries on 8 seconds after the last thing goes, so clips finish, and the minute in memory is the last minute worth having. `src/game/recorderWatch.ts`.*

**The recorder.** While flying, the view is encoded at 720p, 30 fps, into a rolling buffer of the last minute in memory (a keyframe every second, so any second can start a clip). Nothing is written until something is kept. The encoder is WebCodecs, already used to make the trailer (`tools/trailer.ts`), with MP4 output; it needs Chrome, Edge or Safari 16.4 and later. Where it isn't available, the recorder quietly isn't there and photos still work.

**Moments.** The recorder keeps the buffer, by itself, when something worth keeping happens:

- a kill (and a new combat rank);
- the Falcon, or any Legend, identified;
- the Marshals arriving;
- a first discovery, or a survey completed;
- your own death.

And you can keep it yourself: a long press on the camera button (or Shift+P) keeps the last 30 seconds.

**The death replay.** Under Modern rules, when you're destroyed, the insurers' screen opens on *"Flight recorder recovered"*, playing your last moments, with **Share** and **Keep**. The worst moment of a session becomes the one most worth sharing ("how I died"), and it shows what got you, which teaches.

**The flight log.** Docked, a new **Log** section in the station tab shows what's been kept since you launched: watch, keep, share or delete. Kept moments and photos are stored on the device (IndexedDB), up to about 20; the oldest unkept go first. With an account, kept moments sync with your commander only when stage 4 arrives, and only what you post.

## 3. Footage that's worth something

**Evidence.** Out in the lanes a crime needs a witness ([law and travel](law-and-travel.md#2-the-law-and-your-record)), and your recorder is one:

- Footage of a ship opening fire on you first clears you of the kill, at the next station, if a record was raised against you.
- Footage of a wanted pirate destroyed where no police ship saw it lets you claim its bounty when you dock.

The game knows what happened, so the recorder's metadata (who fired first, who died) is what counts, not anyone judging the pictures.

**News.** The newsroom buys footage as the survey office buys data ([exploration](exploration.md)): the rarer, the better it pays. A Falcon sighting, the Bastion coming through, a station's frame rising, a famine market. The news item it makes credits your callsign, and travels at the speed of ships like any other.

**Explorers.** The photo taken on a first survey goes on the chart with the world, under your name.

## Proof: things nobody would believe

*(Mark: "capture things that no one would believe!" The playful version of a picture painting a thousand words: the shot your friends won't believe, which the game can prove is real.)*

The galaxy has things almost nobody sees: the Falcon, other Legends, a wreck from before the stations, one-in-a-thousand sights we'll design to be photographed. Say you saw one and nobody believes you. A photo or clip from the recorder is **proof**.

- **Verified.** Every photo and kept moment carries what the game knows about it: the system, the time, and what was in view (the Falcon, the Bastion, a named wreck). Because the galaxy is worked out from its seed and clock, the same for everyone, the server can check that the sighting really happened there and then. A verified photo gets a mark (*"Flight recorder: verified"*), so edited pictures can't pass.
- **Sightings.** The station board (below) has a Sightings wall: the rarest verified moments, the first commander to capture each, and a count of how many ever have. "Only 3 commanders have photographed the Falcon close up."
- **Worth hunting.** Some proofs are wanted: the newsroom, a collector in the saloon, an explorer's guild pays for a verified sighting of something specific. It sends commanders out looking.
- **Designed to be photographed.** As new rarities are added (Legends, phenomena, wrecks with stories), each says what makes it worth a picture, and the recorder knows to keep it.

## 4. The station board

The social part. Signed in, **Post to the station board** puts a kept clip or photo in a public gallery, in the game (docked, a Board tab) and on the site, with your callsign, the system and when. Commanders can watch, react and share; the best of the week can lead the site's home page.

Because it's other people's posts, it needs a report button, moderation and limits before it opens, and it follows the online-safety decisions in `launch/safety` (still to be made). That's why it comes last. Clips are only the game's own picture, which keeps the risk low, but captions and callsigns are still people's words.

## The library: one place for every commander's moments *(Mark, 24 October 2026)*

The station board, verified proof, the newsroom, the press kit and the channel all need the same thing underneath: **a central library** where commanders' kept moments go when they choose to send them.

- **What's sent:** the clip or photo, and the recorder's data: system, time, ship, what was in view, who fired first, who died. The data is what makes a moment searchable ("every Falcon sighting this week"), verifiable (checked against the galaxy's seed and clock) and useful as evidence.
- **Where:** files in Cloudflare R2 beside the Worker we already run; the data in the accounts store. Signed in only, with a size cap and a daily limit per commander.
- **Who sees what:** sending makes a moment *available*, not public. It shows on the station board, the channel or the press kit only once approved for each, and the commander can withdraw it at any time.
- **What it feeds:** the station board (section 4), the Sightings wall and verified proof, the newsroom's footage market, the channel's agent (section 5), the press kit's "from the commanders" gallery, and (later) the MCP server, so an assistant can find "the best Bastion arrivals this month".

## The channel agent

What happens to a moment a commander sends, once the library exists:

1. **Words, from the game, not from the pictures.** `src/game/moments.ts` already writes each moment's title, description and tags from the recorder's events (*"CMDR Jameson: Took 2 pirates with me at Riedquat"*; who, where, the government, the rank, what was destroyed and for how much), so they're true by construction and never claim what the game can't know (a survey is "complete", never "first" unless the server says so).
2. **The cut and the card.** The agent makes the upright Short from the clip (the trailer tooling's vertical cut, cropped to the action), adds the end card, and draws a thumbnail from the frame of the lead event, in the house style: one subject, three or four big words, the mark.
3. **The queue.** Each draft (video, thumbnail, title, description, tags, playlist) waits for a person: approve, edit, or turn down, with a reason the commander sees. Turned down never means deleted: it stays in the commander's own log.
4. **Publishing.** Approved Shorts go up through the YouTube Data API (`tools/youtube.ts`), a few a day within the quota, into the right playlist (Flight Recorder, Sightings, How I died), crediting the callsign and linking the moment's page on the site.
5. **Limits.** Per commander per day; none from commanders under a ban; nothing with a caption until the station board's moderation is in place (callsigns and the game's own words only, until then).
6. **Later: trust.** Commanders in good standing with verified moments may skip the queue, and the agent can pick a weekly round-up.

## 5. The Witchspace channel *(idea, Mark, 24 October 2026)*

A Witchspace YouTube channel of **Shorts from commanders' flight recorders**: any commander can put a kept moment forward, and an AI agent turns the good ones into Shorts on the channel. One place where the galaxy's best fights, worst deaths and strangest sightings pile up, each one an invitation to play.

How it could work:

- **Put forward, never taken.** From the flight log or the station board, *"Send to the Witchspace channel"*, signed in. Nothing goes up without the commander choosing it, and the commander can ask for it to come down.
- **The agent does the editing.** It picks the moment, cuts the vertical version (the trailer tooling already makes vertical cuts), adds the end card and a caption from what the game knows ("CMDR Jameson vs a pirate pack at Riedquat"), writes the title, description and tags, credits the commander's callsign with a link to their moment's page, and queues it.
- **A person in the loop, at first.** The agent drafts; a maintainer (or a trusted moderator) approves the day's Shorts before they publish. Later, verified moments from commanders in good standing could go up by themselves.
- **Series, not a firehose.** "How I died", "Sightings", "Firsts", "The week in Witchspace": the agent fills playlists, and a weekly round-up Short shows the best.

Things to settle before it opens:

- **Consent and credit:** the commander agrees, per clip, to it appearing on the channel under their callsign, licensed CC BY-SA like the game's other content. Callsigns only, never real names.
- **Safety:** clips are only the game's picture, but captions are people's words: same moderation as the station board, and the online-safety decisions in `launch/safety`. The channel is not "made for kids" unless that's decided deliberately.
- **Music:** only what we can publish everywhere: the U.S. Marine Band's public-domain Blue Danube, the game's own sounds, or nothing.
- **YouTube's limits:** uploads through the API are rationed per day, so the agent publishes a few a day, not everything; enough for a channel that's alive, not spam.
- **Who runs the channel,** and whose account it's under.

## Classic rules

Classic stays as 1984 had it: one life, no recorder, no replays. Photos (P) work in both, as now.

## Open questions

- 30 seconds, or longer for big moments like the Marshals arriving (about a minute from rift to Lancers)? *Partly answered: fights run up to a minute.*
- Should the newsroom pay only the first commander to bring a sighting, as surveys do, or anyone?
- Is the recorder on by default on phones, or offered the first time something worth keeping happens? *Answered: on, because nothing is saved until a moment happens, and introduced the first time one is: the flight log asks once whether to keep it on.*
