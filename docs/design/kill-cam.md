---
title: The kill cam
status: building
pillar: fight
summary: Watch how you died from outside. Alongside the video, the ship logs where everything was and every shot fired, a few hundred KB, and the game rebuilds the fight so you can watch it from behind the pirate who got you, orbit it or slow it down. Tiny enough to keep millions in the library, and labelled as a reconstruction.
card: mamba
stages:
  - The track - the last minute of every ship's position and every shot, logged as you fly | built
  - The replay - watch your death from outside, from the insurers' screen | built
  - Keep and share - tracks kept with their moments in the flight log, and a chosen camera saved as a video | built
  - The library - send a track, and anyone can open the fight in their browser from a link | built
  - The cut - an eased camera framing the killer and you together, two labels, line debris, a fade into the end card, upright at 1080×1920 | built
  - Shared space - other commanders' ships in the replay, from what your scanner saw | idea
help:
  - Playtest the replay - did it show you what killed you, and did you learn anything from it? | playtest
  - Design the replay cameras - the two-shot and the hold on the explosion are built; which other angles make a fight read in a few seconds? | design
  - Write the insurers' voice for a reconstruction - the assessors' note is built; more lines for other endings (a collision, a missile, the station's guns) | writing
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

*Built, 25 October 2026: `src/ui/killCam.ts`. **Watch it from outside** on the insurers' screen, and **From outside** on a death in the flight log. It opens on the last 14 seconds before your death, behind the ship that fired the killing shot (labelled in red), with RECONSTRUCTION and the assessors' line at the top. The controls are two tidy lines (Mark, 27 October 2026): play/pause (Space), the scrubber, the time and a quarter speed; then one camera switch (**Killer** or **Target**, **You**, **Orbit**: drag to turn, scroll to zoom) and **Save** as Wide or Upright. A × or Escape closes it. The camera follows its ship and eases only around it, so a fighter can't outrun it.*

When you die, the insurers' screen offers **Watch it from outside** beside the video. The replay builds the scene from the track in a second camera (the game isn't running underneath), and plays it with:

- **Cameras:** behind your killer (the default: it answers the question), behind you, orbiting the fight, and free.
- **Time:** play, pause, scrub, and slow motion (a quarter speed) over the last seconds.
- **Who's who:** a label on each ship (Mamba · pirate · bounty 80 Cr), and the killing shot marked.
- **RECONSTRUCTION** in the corner, always.

Ships between samples are smoothed (positions interpolated, orientations slerped), so 20 a second plays smoothly at 60.

## 3. Keep and share

*Built, 25 October 2026: `src/ui/encodeVideo.ts` and **Save video · upright** or **· wide** in the kill cam. The reconstruction is rendered offline, frame by frame at 30 fps, at exactly 1080×1920 or 1280×720 (so it's smooth whatever the device manages live; 720×1280 until 27 October), from the camera you're watching. Every frame carries RECONSTRUCTION and the title (*"CMDR Kestrel: shot down by a Mamba at Riedquat"*), the ship labels and witchspace.org.uk; it fades into the end card (the mark, the title, witchspace.org.uk/play). See "The cut" below. It goes into the flight log like any moment, and **Share the video** opens the share sheet or downloads it. On a Mac, 16 seconds saved in about two.*

The track is kept with the death's moment in the flight log (it adds a few per cent to the clip's size). From the replay you can save the camera you're watching as a video, through the same WebCodecs path the recorder uses, upright for Shorts or wide, ending on the end card. Where the browser can't encode video, the replay still plays: it's just numbers.

## The cut: camera work, labels and the ending

*Built, 27 October 2026, after Mark watched his first saved reconstruction on his iPhone: CMDR Jameson shot down by a Sidewinder at Raoror. "The kill cam footage is a bit janky", and "at the end of the video pieces of the ships explosion seem to be hanging in the shot so it doesn't fade into anything like a closing Witchspace logo." (Mark). Going through that clip frame by frame found six things; this is what each became. The camera work is `src/ui/killCamShots.ts` (tested in Node), used by `src/ui/killCam.ts`.*

**The point of the replay** is to show you what killed you, and teach you something. Every rule below serves that.

1. **No snaps.** The old camera eased only its offset and looked with a fixed world up, so a ship missing from a sample or two (the killer blinking out for a frame), or the killer crossing over you, threw it: one-frame jumps at 10.7 s and 12.0 s, and a sudden swing at 16.9 s that brought the planet into frame. Now each ship is placed from its own run of poses, carried across short gaps (`timelines`, `poseAt` in track.ts); the camera is a rig that eases its place, aim and zoom with a critically damped spring, turns no faster than 80° a second, keeps its own up (so it never flips when it looks straight up), and travels with its subject so a fighter can't outrun it. A change of shot is a glide from where the camera is, at the speed it was going: there are no hard cuts.
2. **The two-shot.** For the first 12 seconds the Sidewinder sat large and still in the foreground while you were a green dot far behind it. The default camera now stands behind and above the ship that got you, far enough back and with a long enough lens that both of you are in frame and the shots can be seen landing. The further apart you are, the further back it stands and the more it zooms, so the far ship is still a ship. Upright frames stack the two (killer below, you above); wide frames set them across.
3. **Two labels.** From about 8 s, labels for the killer, a Mamba, the station and you piled into an unreadable stack. Now the ship that got you and you are always labelled (yours moves below your ship if they'd overlap); anyone else only where there's clear room, never more than one, and labels fade in and out rather than pop. The words are shorter: *Sidewinder · fired the killing shot*, *CMDR Jameson (you)*, *Mamba · pirate*.
4. **Line debris and a glow.** The explosion's flash was a solid ball; seen from outside, close, it filled the frame as a white disc, then a hard-edged one. The kill cam's explosions now flash with a soft glow, smaller and brief, and the rest is the game's own line debris and sparks in the neo glow.
5. **Hold on the explosion, then fade.** After the killing shot the camera no longer follows the killer away (that was the swing to the planet). It glides to hold on the explosion, from the side it was already on, keeping clear of the station, turning slowly; the killer stays in frame while it's close. Ships carry on at their last speed for a moment past the end of the track instead of freezing, and the scene runs 4.4 seconds after the death so the explosion plays out while **the end card fades up over it** (1.4 seconds, eased), then holds for 2.5. **One end card** (`endCard` in `videoCards.ts`) signs off everything: the kill cam's wide and upright videos, the upright cut of a cockpit clip (which now fades into it too), and a replay watched live, including a shared clip opened from its link, which fades up the same card when it has played out.
6. **Upright for Shorts.** Saved upright at 1080×1920 (it was 720×1280), at a bitrate to match, with lines drawn as boldly as at 720p. Upright, the stamp sits in a band at the top (RECONSTRUCTION, the title on two lines, witchspace.org.uk), large enough to read on a phone held upright, and clear of the bottom and right edges where Shorts, Reels and TikTok put their buttons; labels stay below that band.

**The assessors' note.** A death's reconstruction now says what the assessors found, from the track and nothing else: *"The Sidewinder hit you nine times in six seconds, seven of them from behind; the last from 640 m."* It sits under the assessors' line in the replay and comes up as a caption over the explosion in a saved video, before the end card. Which quarter the hits came from is worked out in your ship's own frame, so "from behind" means behind you.

### Which camera angles read

Worked out on Mark's clip and test fights, for a death seen in a few seconds on a phone:

- **The two-shot reads; the over-the-shoulder close-up doesn't.** With the killer large in the foreground, the eye stays on it and you can't see who it's shooting. Standing further back on a longer lens keeps both ships ship-sized.
- **Above, not level.** Lifting the camera separates the two ships on screen (upright, one above the other) so the beam between them is a visible line rather than a dot.
- **Hold on the end, don't chase.** Following the killer after the kill swung the camera away from the moment that mattered. The explosion is the full stop.
- **Never a hard cut.** A cut in a 15-second clip of small glowing ships loses the viewer; a glide keeps their eye on the ship.
- **Still open:** a shot from your own ship's view of the killer (what you'd have seen if you'd looked behind), and a slow-motion replay of the killing shot before the explosion.

### The insurers' voice

The reconstruction speaks as the insurers' assessors: dry, exact, unhurried, never sympathetic and never blaming. They report what the recorder shows. Lines so far:

- *"Our assessors have reconstructed the incident at Raoror from your flight recorder. The killing shot: the Sidewinder."*
- *"Assessors' note: the Sidewinder hit you nine times in six seconds, seven of them from behind; the last from 640 m."*

Still to write: lines for other endings (a collision, a missile, the station's guns, an unidentified contact), and for a claim the assessors decline.

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
