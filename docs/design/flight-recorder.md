---
title: The flight recorder
status: proposed
pillar: core
summary: Every ship's black box keeps the last 30 seconds. Watch how you died, keep the great moments in a flight log, use footage as evidence or sell it to the news, prove the sightings nobody would believe, and post the best to the station board.
card: cobra-mk3
stages:
  - Photos one tap away on touch screens (P) | built
  - The recorder, the death replay and the flight log | proposed
  - Footage as evidence, and sold to the news | proposed
  - Verified proof of rare sightings, and the Sightings wall | proposed
  - The station board: post clips and photos for other commanders | proposed
help:
  - Write the newsroom's voice: what it says when it buys your footage of the Falcon | writing
  - Playtest the death replay and tell us if it made you want to share it, or just stung | playtest
  - Design the station board as it appears in the game, docked | design
  - Invent a rare sight worth photographing: what it is, where, and who'd pay for proof | writing
---

# Design: the flight recorder

*Design, 24 October 2026. Proposed. Modern rules; Classic keeps 1984's single life and no replays.*

## Why

P takes a photo of the view, without the HUD, and has since October. But a photo just downloads, or goes to the phone's share sheet, and the game forgets it: there's no reason for it inside the game, and nowhere for it to live. And the moments people most want to keep (the kill that made Dangerous, the Falcon crossing close, the Bastion coming through, how they died) happen too fast to think "record".

The answer is a thing every ship already ought to have: a **flight recorder**. A black box, a dashcam: always running, never needing to be remembered. What it keeps is yours to watch, keep, share and, in the game, to use.

Mark: "it's like social media never died." Commanders trading clips of their best fights and worst deaths, in the game and out of it, is how a space game gets talked about.

## Principles

- **Never ask the player to press record.** The recorder keeps the last 30 seconds, always; you decide afterwards what was worth keeping.
- **Footage is worth something in the game,** not just outside it: evidence for the law, news for the newsroom, proof for explorers.
- **Yours until you say otherwise.** Everything stays on your device. Nothing is uploaded unless you post it, deliberately, signed in.
- **Light on the phone.** 720p, only while flying, a setting to switch it off, and a log of limited size.
- **The picture is the game's own.** Only the 3D view is recorded: no HUD, no other apps, nothing personal.

## 1. Photos *(built)*

P, or the camera button on touch screens (beside the drawer tab, always to hand), takes a photo of the view without the HUD, with a small WITCHSPACE mark in the corner. On phones it opens the share sheet; elsewhere it's saved. From stage 2 it also goes into the flight log.

## 2. The recorder, the death replay and the flight log

**The recorder.** While flying, the view is encoded at 720p, 30 fps, into a rolling buffer of the last 30 seconds in memory (a keyframe every second, so any second can start a clip). Nothing is written until something is kept. The encoder is WebCodecs, already used to make the trailer (`tools/trailer.ts`), with MP4 output; it needs Chrome, Edge or Safari 16.4 and later. Where it isn't available, the recorder quietly isn't there and photos still work.

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

*(Mark: "capture things that no one would believe!" Like Bigfoot sightings, but in space, except here the blurry photo can be proven real.)*

The galaxy has things almost nobody sees: the Falcon, other Legends, a wreck from before the stations, one-in-a-thousand sights we'll design to be photographed. Say you saw one and nobody believes you. A photo or clip from the recorder is **proof**.

- **Verified.** Every photo and kept moment carries what the game knows about it: the system, the time, and what was in view (the Falcon, the Bastion, a named wreck). Because the galaxy is worked out from its seed and clock, the same for everyone, the server can check that the sighting really happened there and then. A verified photo gets a mark (*"Flight recorder: verified"*), so edited pictures can't pass.
- **Sightings.** The station board (below) has a Sightings wall: the rarest verified moments, the first commander to capture each, and a count of how many ever have. "Only 3 commanders have photographed the Falcon close up."
- **Worth hunting.** Some proofs are wanted: the newsroom, a collector in the saloon, an explorer's guild pays for a verified sighting of something specific. It sends commanders out looking.
- **Designed to be photographed.** As new rarities are added (Legends, phenomena, wrecks with stories), each says what makes it worth a picture, and the recorder knows to keep it.

## 4. The station board

The social part. Signed in, **Post to the station board** puts a kept clip or photo in a public gallery, in the game (docked, a Board tab) and on the site, with your callsign, the system and when. Commanders can watch, react and share; the best of the week can lead the site's home page.

Because it's other people's posts, it needs a report button, moderation and limits before it opens, and it follows the online-safety decisions in `launch/safety` (still to be made). That's why it comes last. Clips are only the game's own picture, which keeps the risk low, but captions and callsigns are still people's words.

## Classic rules

Classic stays as 1984 had it: one life, no recorder, no replays. Photos (P) work in both, as now.

## Open questions

- 30 seconds, or longer for big moments like the Marshals arriving (about a minute from rift to Lancers)?
- Should the newsroom pay only the first commander to bring a sighting, as surveys do, or anyone?
- Is the recorder on by default on phones, or offered the first time something worth keeping happens?
