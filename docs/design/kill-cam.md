---
title: The kill cam
status: building
pillar: fight
summary: Watch how you died from outside. Alongside the video, the ship logs where everything was and every shot fired, a few hundred KB, and the game rebuilds the fight so you can watch it from behind the pirate who got you, orbit it or slow it down. Tiny enough to keep millions in the library, and labelled as a reconstruction.
card: mamba
stages:
  - The track - the last minute of every ship's position and every shot, logged as you fly | built
  - The replay - watch your death from outside, from the insurers' screen | built
  - Keep and share - tracks kept with their moments in the flight log (built), and a chosen camera saved as a video | started
  - The library - send a track, and anyone can open the fight in their browser from a link | idea
  - Shared space - other commanders' ships in the replay, from what your scanner saw | idea
help:
  - Playtest the replay - did it show you what killed you, and did you learn anything from it? | playtest
  - Design the replay cameras - which angles make a fight read clearly in a few seconds? | design
  - Write the insurers' voice for a reconstruction ("Our assessors have reconstructed the incident") | writing
---

# Design: the kill cam

*Design, 25 October 2026, after Mark asked whether the flight recorder rebuilds how you died or just captures the screen. Proposed; it follows the flight recorder ([flight-recorder.md](flight-recorder.md)).*

## Why

The flight recorder keeps what was on your screen. That's the honest record, but it often can't answer the question you have when you die: **what got me?** Pirates come from behind, and the last thing the cockpit saw was empty space and a flash.

A kill cam answers it. The ship logs where every ship was and every shot fired, and when you die the game rebuilds those seconds with its own renderer, so you can watch from outside: behind the pirate who got you, orbiting the fight, or slowed down at the moment your shields went. You learn from a death instead of just being stung by it, and it makes better Shorts than a cockpit view.

## Principles

- **It's the assessors' reconstruction.** Insurers rebuild the incident from the recorder's data to assess your claim, so the kill cam needs the recorder recovered; a lost one has to be found first ([the claim](flight-recorder.md#the-claim-submit-your-recorder-mark-25-october-2026)).
- **Labelled as a reconstruction.** The video is what you saw; the kill cam is the game's account of what happened. It's always marked RECONSTRUCTION, and it never stands in for the video as evidence or proof ([the flight recorder](flight-recorder.md): footage as evidence, and proof of sightings).
- **Only what your ship knew.** The track holds what your scanner saw, nothing more. A ship running dark stays dark: a Legend that never showed on your scanner doesn't appear in the replay ([Legends](legends-the-falcon.md)). In shared space, other commanders appear only as your scanner saw them.
- **The game's own renderer.** The same ship models, beams, missiles and explosions, in the same neo glow. No second engine to keep in step.
- **Light.** A few hundred KB per minute, recorded with no measurable frame cost, kept on your device unless you share it, like everything the recorder keeps.
- **Modern rules.** Classic stays as 1984 had it: no recorder, no replays.

## 1. The track

*Built, 25 October 2026: `src/game/track.ts` (the ring buffer, the packing and its tests) and the recording in `main.ts` (`recordTrack`, `trackBeam`, `trackBoom`). Every ship within 12 km (the scanner's long range), missiles and the station, 20 times a second; a ship running dark is kept as unidentified until its hull was read. Shots (yours and theirs), explosions, and your death, with who hit you last. Packed at 22 bytes a ship a sample and gzipped, kept with the death's moment in the flight log. Classic records nothing.*

While you fly, a ring buffer holds the last minute of the fight as numbers, sampled 20 times a second:

- **Every ship your scanner sees:** an id, its type (the ship file), position and orientation. Positions are kept relative to you as 32-bit floats; orientation as a quaternion in four 16-bit numbers. About 21 bytes a ship a sample.
- **Events, as they happen:** a laser fired (from, to, hit or miss), a missile launched and where it went, a hit on shields or hull, ECM, an explosion, a ship arriving or leaving.
- **The scene, once:** the system (from its seed, the planet, sun and station come free), the time, your ship and its fittings.

**Sizes.** A typical fight, six ships: 21 bytes × 6 ships × 20 a second × 60 seconds ≈ 150 KB raw, about 60 KB once compressed (the browser's own `CompressionStream`). The busiest scene in the game, the Marshals arriving with 30 ships about, is around 750 KB raw and 300 KB compressed. The video of the same minute is 7 MB.

**Cost while flying.** Writing a hundred-odd numbers into a ready-made buffer 20 times a second: well under a tenth of a millisecond a frame, and no garbage for the browser to collect. Memory: under 1 MB.

**A version number** goes in every track, so tracks from older versions of the game still open (or say plainly that they can't).

## 2. The replay

*Built, 25 October 2026: `src/ui/killCam.ts`. **Watch it from outside** on the insurers' screen, and **From outside** on a death in the flight log. It opens on the last 14 seconds before your death, behind the ship that fired the killing shot (labelled in red), with Behind you and Orbit (drag to turn, scroll to zoom), play and pause (Space), a quarter speed, a scrubber, and RECONSTRUCTION with the assessors' line at the top. Escape closes it. The camera follows its ship and eases only around it, so a fighter can't outrun it.*

When you die, the insurers' screen offers **Watch it from outside** beside the video. The replay builds the scene from the track in a second camera (the game isn't running underneath), and plays it with:

- **Cameras:** behind your killer (the default: it answers the question), behind you, orbiting the fight, and free.
- **Time:** play, pause, scrub, and slow motion (a quarter speed) over the last seconds.
- **Who's who:** a label on each ship (Mamba · pirate · bounty 80 Cr), and the killing shot marked.
- **RECONSTRUCTION** in the corner, always.

Ships between samples are smoothed (positions interpolated, orientations slerped), so 20 a second plays smoothly at 60.

## 3. Keep and share

*The track is kept with the death's moment (built). Saving a camera as video is next.*

The track is kept with the death's moment in the flight log (it adds a few per cent to the clip's size). From the replay you can save the camera you're watching as a video, through the same WebCodecs path the recorder uses, upright for Shorts or wide, ending on the house card. Where the browser can't encode video, the replay still plays: it's just numbers.

## 4. The library *(idea)*

Because a track is tiny, sharing one is nearly free. Sent to [the library](flight-recorder.md), a fight gets a link that opens the replay in anyone's browser, from any angle, at any size. The channel agent could cut Shorts from tracks rather than video: the best camera, upright, at full resolution.

## 5. Shared space *(idea)*

Other commanders' ships already arrive as positions over the network ([shared space](servers-and-hosting.md)), so they go into the track like any ship, but only as your scanner saw them, never their private state.

## What it costs

**To run: almost nothing.**

| | Kill cam track | Video clip |
|---|---|---|
| A one-minute fight | about 60 KB (300 KB at the busiest) | about 7 MB |
| On the phone, a full log | a few MB more | the 150 MB budget |
| Recording cost per frame | under 0.1 ms | already measured: none visible |
| 100,000 kept in the library (Cloudflare R2, $0.015 per GB a month, no download charges; tracks at 100 KB, clips at a typical 3 MB) | about 10 GB: free (R2's first 10 GB are) | about 300 GB, about £3.50 a month |
| A million | about 100 GB, about £1.20 a month | about 3 TB, about £35 a month |

Requests are covered by the Worker plan we already run (10 million a month on the $5 plan). Cutting Shorts from tracks happens in a browser, on our machine or the commander's, so there's no server rendering bill.

**To build: a few days, and a standing tax.**

- Stage 1, the track and its tests: about a day.
- Stage 2, the replay (scene from a track, cameras, time controls, labels): about two days.
- Stage 3, keeping it and saving a camera as video: about a day.
- **The tax:** everything that appears in a fight has to be recorded. Each new weapon, effect or kind of ship needs its event written down, or the replay quietly leaves it out. A round-trip test (record a scripted fight, replay it, compare where everything ends up) keeps that honest, and the version number keeps old tracks working.

## Classic rules

None. Classic has no recorder and no replays, as 1984 had it.

## Open questions

- Should the kill cam replace the video on the insurers' screen, or sit beside it? (Proposed: beside it; the video stays the honest record.)
- How far back: the last minute, or only the fight (from the first shot)?
- Should a commander who killed you be able to see the replay of their kill? It's their moment too, but only from data your ship gathered.
