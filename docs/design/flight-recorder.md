---
title: The flight recorder
status: building
pillar: fight
summary: Every ship's black box keeps the last minute, and sharing what you saw is part of the game. Watch how you died, keep the great moments, share them to your socials with a link back, use footage as evidence or sell it to the news, and post the best to the station board.
card: cobra-mk3
stages:
  - Photos one tap away on touch screens (P) | built
  - The recorder, the death replay and the flight log, with sharing to socials | built
  - The claim - submit your recorder to the insurers; featured clips paid, and on the news when they take off | proposed
  - Footage as evidence, and sold to the news | proposed
  - Verified proof of rare sightings, and the Sightings wall | proposed
  - The station board: post clips and photos for other commanders | proposed
  - The kill cam - watch how you died from outside, rebuilt from the fight's data (design/kill-cam.md) | built
  - One share sheet, hearts on clips, and an upright cut for Shorts, Reels and TikTok | built
  - This trip at the dock, to keep, share or delete there and then; the library trip by trip (Mark) | built
  - Clip pages: share a moment as its flight track, and the link replays it for anyone | built
  - The Witchspace channel: commanders' clips on YouTube (posted by hand for now; an approval queue next) | building
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
- **Light on the phone, sharp where it can be.** Every device starts in HD (720p, 30 fps) and steps down to 480p at 24 fps by itself if the game's frame rate sags while recording, remembering it; the flight log says which, and offers to try HD again (adaptive: Mark, 26 October 2026, after phones had been fixed at 480p because they were getting warm), only while flying and only with something about, a setting to switch it off, a log with a space limit, and nothing left lying around: what you don't keep clears after a week.
- **Told, not hidden.** The first time it keeps something, the game says so, and the flight log asks once whether to keep it on.
- **Never in the way.** Nothing pops up mid-flight: photos and clips go to the log quietly, to share once you're docked.
- **The picture is the game's own.** Only the 3D view is recorded: no HUD, no other apps, nothing personal.

## 1. Photos *(built)*

P, or the camera button on touch screens (beside the drawer tab, always to hand), takes a photo of the view without the HUD, with a small WITCHSPACE mark in the corner. It goes into the flight log (a JPEG of a few hundred KB; PNG in 1984 mode), with a shutter flash and nothing else, so a photo mid-fight costs nothing; you share it from the log once docked. Where the log can't be used (storage blocked), it's shared or saved straight away as before.

## Sharing it

Sharing works everywhere a commander can see a photo or a kept moment: the camera button, the death replay, the flight log, the station board.

*(Built, 26 October 2026: **one share sheet** (`src/ui/shareSheet.ts`) for the flight log, the death replay and the kill cam. The card first, with the clip playing and its title; then **Share video…** on a phone, which hands the file itself to the phone's share sheet, Save Video included, or **Save video** on a desktop; then X, Bluesky, Facebook, WhatsApp, Reddit and copy link, which share the game with the clip's title until clips have pages of their own. The file is made before the sheet opens, so the tap opens the phone's sheet at once, and dismissing it never falls back to downloading: that fallback was what opened the Files menu on iPhones (Mark's report). On a phone held sideways the card and the buttons sit side by side.)*

- **One tap to your socials.** On phones, the share sheet (WhatsApp, Instagram, TikTok, Messages...) with the picture or clip itself; on desktop, the site's share buttons (Facebook, X, WhatsApp) and a link to copy.
- **Branded, always.** Photos carry the WITCHSPACE mark; clips end on a short card: the wordmark, *Trade. Fight. Explore. Build.*, witchspace.org.uk.
- **A link that sells the game.** Shared from an account, a moment gets its own page on the site (as press kit items do): the clip playing, your callsign, the system, what happened ("Jameson vs a pirate pack at Riedquat"), a Play free button, and a branded preview card so it unfurls properly on every platform.
- **Vertical too.** Clips are offered upright for stories and reels as well as wide, cropped to the action. *(Built, 26 October 2026: on a wide clip, the share sheet's **Make an upright version** cuts it to 720×1280 in the browser, the cockpit view enlarged and trimmed at the sides under FLIGHT RECORDER and its title, witchspace.org.uk below, fading into the end card; the cut joins the flight log beside the original (`src/ui/upright.ts`). The kill cam's reconstructions are filmed upright directly, at 1080×1920. Every video the game makes ends on the same end card (`endCard` in `src/ui/videoCards.ts`), faded up over the last of the scene ([the kill cam](kill-cam.md#the-cut-camera-work-labels-and-the-ending)).)*

## 2. The recorder, the death replay and the flight log *(built)*

*Built, 24 October 2026: `src/game/recorder.ts` (WebCodecs H.264, 720p, 30 fps, a rolling 30 s in memory, cut at keyframes), `src/game/moments.ts` (titles, descriptions and tags written from the game's own events), `src/game/flightLog.ts` (IndexedDB, 20 moments) and `src/ui/flightLog.ts`. Moments kept by themselves: a kill, the Falcon's hull read, the Marshals coming through, a survey, your death. By hand: Shift+P, or hold the camera button. A switch in the flight log turns it off. Photos don't go into the log yet.*

*Revised, 25 October 2026, after Mark's worry about phones filling up and about P in a dogfight: the buffer is a minute, and **a fight is one clip** (each kill within 25 seconds of the last re-cuts it from the fight's start, up to a minute, replacing the earlier cut; a death in the fight folds it in: "Took 2 pirates with me"). The bitrate is halved (1.2 Mbps: glowing lines on black lose nothing, checked frame by frame), so a 26 s clip is about 3 MB. The log has a **150 MB budget** and 60 moments; the oldest unkept moment makes room, unkept moments clear after a week, and the log shows the space used with a Clear unkept button. **Photos go to the log.** The first kept moment is announced in flight, the death replay says what the recorder is, and the log asks once: Keep it on, or Turn it off. Classic rules have no recorder, as this design always said.*

*And it rests (Mark, 25 October 2026): in open space with nothing about, it stops recording, saving battery, and wakes the moment anything is near: a ship or missile within scanner range, the station, a planet, a rift, or a Legend anywhere in the system (the Falcon runs dark, so "near" is what the game knows is there, not what the scanner shows). It carries on 8 seconds after the last thing goes, so clips finish, and the minute in memory is the last minute worth having. `src/game/recorderWatch.ts`.*

**The recorder.** While flying, the view is encoded at 720p, 30 fps (480p, 24 fps on a device that can't keep up), into a rolling buffer of the last minute in memory (a keyframe every second, so any second can start a clip). Nothing is written until something is kept. The encoder is WebCodecs, already used to make the trailer (`tools/trailer.ts`), with MP4 output; it needs Chrome, Edge or Safari 16.4 and later. Where it isn't available, the recorder quietly isn't there and photos still work.

**Moments.** The recorder keeps the buffer, by itself, when something worth keeping happens:

- a kill (and a new combat rank);
- the Falcon, or any Legend, identified;
- the Marshals arriving;
- a first discovery, or a survey completed;
- your own death.

And you can keep it yourself: a long press on the camera button (or Shift+P) keeps the last 30 seconds.

**The death replay.** Under Modern rules, when you're destroyed, the insurers' screen opens on *"Flight recorder recovered"*, playing your last moments, with **Share** and **Keep**. The worst moment of a session becomes the one most worth sharing ("how I died"), and it shows what got you, which teaches.

**The flight log.** Docked, the **Flight log** button beside the galaxy map (**F**) opens it full screen, a gallery of what's been kept: watch, keep, share or delete. It's the first thing you see in a new ship (a new commander, or the insurers' replacement), and docking with new moments badges the button *Flight log · 2 new* (since 28 October, those moments come up as This trip, below, rather than the whole log opening). *(Mark, 25 October 2026: it had been at the bottom of the station tab, under the equipment, where few would find it. Then a tab of its own; on 26 October Mark moved it out of the tabs, which had run to two rows: the log belongs to the ship, not the station.)* Kept moments and photos are stored on the device (IndexedDB), up to about 20; the oldest unkept go first. With an account, kept moments sync with your commander only when stage 4 arrives, and only what you post.

## This trip, then the library *(Mark, 28 October 2026; built)*

Mark: *"For a start when you dock you should only see clips from the last trip. The library should be somewhere else. Then you can triage and do some file husbandry straight away."*

Before, the whole log opened by itself whenever you docked with something new, so this trip's two clips sat among last week's twenty. Now:

- **On docking: "This trip".** A small sheet from the bottom of the screen (phone first) showing only what the ship kept since you launched: clips, photos, the death replay. It appears only if the trip kept something, and it replaces today's full log opening by itself. **A quiet trip shows nothing**: the recorder keeps only kills, deaths, the Marshals, Legends, discoveries and surveys, a held camera button, and photos (Mark: "If it was uneventful you don't have anything to triage, right?"). There's never an empty "This trip" screen.
- **Triage in a tap or two.** Each moment has Keep, Share and Delete. At the foot of the sheet are **Keep all** and **Done**. Done leaves anything you didn't touch as it is today (unkept, gone in a week), so skipping costs nothing and it never becomes a chore at every dock. Swipe it away, or press Esc, to do the same.
- **The library is the Flight log button** beside the map (F): everything, grouped by trip ("Lave → Leesti, 28 Oct"), with the space used and Clear unkept, and your shared clips. It no longer opens by itself. The button is badged only for moments you haven't seen yet.
- **What a trip is:** launch to dock. Each moment remembers its trip, and the trip's start is kept on the device, so the Home Screen app reopening neither loses this trip's sheet nor shows it twice. After a death, it runs from the last launch to the insurers' replacement, so the death replay leads the sheet.



**Evidence.** Out in the lanes a crime needs a witness ([law and travel](law-and-travel.md#2-the-law-and-your-record)), and your recorder is one:

- Footage of a ship opening fire on you first clears you of the kill, at the next station, if a record was raised against you.
- Footage of a wanted pirate destroyed where no police ship saw it lets you claim its bounty when you dock.

The game knows what happened, so the recorder's metadata (who fired first, who died) is what counts, not anyone judging the pictures.

**News.** The newsroom buys footage as the survey office buys data ([exploration](exploration.md)): the rarer, the better it pays. A Falcon sighting, the Bastion coming through, a station's frame rising, a famine market. The news item it makes credits your callsign, and travels at the speed of ships like any other.

**Explorers.** The photo taken on a first survey goes on the chart with the world, under your name.

## The claim: submit your recorder *(Mark, 25 October 2026)*

When you're destroyed, the insurers pay out when you **submit your flight recorder**: the clip and its data go to Witchspace. It's the act that settles the claim in the game, and in the world it's how commanders' best and worst moments reach everyone else. Deaths are the most shareable moments there are, and this makes handing one over part of getting your ship back.

**Submitting pays the claim; everything else is optional.** A clip carries your callsign, and permission given because your ship depends on it isn't freely given (UK data protection asks for consent that is). Plenty of players can't or won't post: younger players, people without social accounts, people who'd rather stay out of sight. So nobody loses a ship over sharing, and nobody is paid to post.

- **Submit to claim.** The insurers' screen reads *"Submit your flight recorder to the assessors"*. Submitting uploads the clip and its data to Witchspace (the [library](#the-library-one-place-for-every-commanders-moments-mark-24-october-2026)) and pays the claim, less the excess. The data decides the claim, never anyone judging the pictures: caught firing first on a clean ship, smuggling or fighting the police, and the claim is void, as set out in [law and travel](law-and-travel.md#7-losing-your-ship-insurance-loans-and-loan-sharks). This is how the insurers know.
- **Or don't.** Decline, and you get the bare Cobra the Co-operative gives Fugitives. What's on the recorder is what happened.
- **"Witchspace may feature this clip, credited to your callsign."** An unticked box on the same screen, changing nothing about the payout. Tick it and the clip joins the queue Witchspace picks from for its channels.
- **Featured, and paid.** If Witchspace posts your clip (on @witchspace_game, the channel, the site), the newsroom buys it: about 500 Cr in the game, and your callsign in the post. That rewards good clips, not clicks, and matches footage sold to the news (above).
- **Share it yourself**, one tap, with the link back, as now. Never required, never rewarded directly: social platforms frown on rewards for posting, and their rules are checked before anything here changes.
- **The founder approves every post.** Submitted clips with the box ticked go into a queue; nothing reaches Witchspace's accounts without a person choosing it.
- **Not recovered.** Some deaths leave nothing to submit: going up inside a sun, crushed by a carrier, an energy bomb at close range, or bad luck (about one death in ten). The insurers pay half and the claim stays open. The recorder drifts where you died, a beacon on the chart for a few days: scoop it and the rest is paid when you submit it. Another commander who scoops it can hand it to your insurers for a finder's fee.
- **The kill cam is the assessors' reconstruction** ([the kill cam](kill-cam.md)), rebuilt from the submitted data, and offered beside the video.
- **Classic rules** have no insurance, as in 1984: the recorder is just a recorder.

### When a clip takes off

A clip that people watch becomes part of the galaxy's story.

- **Counted where we can.** Views on Witchspace's own site and library, and on what Witchspace posts to its own channel and Instagram (whose figures the account owner can read). Views of a commander's own posts aren't ours to see, and aren't counted.
- **On the news.** A clip past a threshold (to balance: 10,000 views) becomes a news item, credited to the callsign, travelling at the speed of ships like any other: *"The recording from CMDR Kestrel's last seconds at Riedquat has been seen by 40,000 people. The Falcon has not commented."* A huge one reaches every station in the galaxy.
- **Paid again.** The newsroom pays a bonus as a clip passes each threshold.
- **Famous in the lanes.** A widely seen clip earns a mention in the saloons and on the radio: haulers who recognise your ship, a pirate who's seen how you fly. For the Falcon, it's one more thing she knows about you.
- **The clip of the week** goes on the station board ([section 4](#4-the-station-board)) and the site's front page.

## Clip pages: shared as tracks *(Mark, 26 October 2026)*

*Status: **built** (26 October 2026: `server/src/clips.ts`, `server/src/clipCheck.ts`, `src/net/clips.ts`). Next: the founder's approval queue for the channel.* A moment can have its own page, **witchspace.org.uk/clip/…**, so a link to it on X, Bluesky, Facebook or WhatsApp plays it, not just the game.

**Shared as a track, never as video.** The page replays the moment from its flight track (the numbers the kill cam already keeps: ship types, positions, shots, explosions) in the game's own renderer: behind the target, behind you, or orbiting, with hearts and the game one tap away. No video or picture a player made ever reaches our servers, so the online-safety position stays what it is: players can't upload images or files. (Mark chose this over uploading the cockpit video, which would have needed the risk assessments redone and every clip moderated: an upload address accepts whatever bytes it's sent, game footage or not.) The cockpit footage itself is still shared as a file, through the phone's share sheet.

**How it works:**

- **Put up by choice.** In the share sheet, *Share a link that replays it*: the game asks once, *"Put this replay on witchspace.org.uk? Anyone with the link can watch it."* Only then is the track sent.
- **The server checks every number.** The track must unpack, its ships must be real ship types, its numbers finite and its colours colours. The server writes the page's words itself (the system, what happened, the ships), so nothing a player typed appears, and the credit is the **signed-in account's callsign** (moderated like any callsign), or *a commander* for anyone not signed in. About 85 KB a minute, kept in the game server's own database: no storage bucket.
- **The page is the game.** /clip/… opens the play page straight into the kill cam on that track; closing it leaves you at the title screen, a key from playing.
- **Links unfurl.** Link previewers (X, Bluesky, Facebook, WhatsApp, Discord...) are given a small page of their own with the title and the card of the ship involved, from the site's ship cards.
- **Hearts** as below; **reports** from enough different browsers hide a clip until someone looks; the founder can take any clip down.
- **Your clips, and taking them down** *(Mark, 27 October 2026: "I don't know how to take down my own clips. I don't even know where my clips are?")*. The flight log opens with **Your clips on witchspace.org.uk**: every clip you put up, from this browser or signed in as you on any device, with its hearts, and a **Take it down** button (press twice). Taken down, it's gone from its page and the live feed, and **Put it back** undoes it; a clip hidden by reports or the founder stays hidden. Each moment that's up is marked *Public · ♥ n*. The server keeps who put a clip up: the account if signed in, and the browser that shared it (`GET /clips/mine`, `POST /clips/<id>/takedown` and `/putback`).
- **Limits:** a few clips an hour per browser and network, and a size cap.

### Hearts *(Mark, 26 October 2026)*

Commanders can **like a clip with a little heart**: on its clip page (`witchspace.org.uk/clip/…`), and in the game wherever clips are shown (the station board, the library).

- **One heart per person, no dislikes, no comments** to begin with: hearts are kind, and they need no moderation. A tap gives one, a second tap takes it back, and the count sits under the clip.
- **Hard to stuff.** The same protection as the ideas board's votes: one heart per device, a cap per network, and the server keeps the count. A heart from a signed-in commander counts the same, but shows who: *liked by CMDR Kestrel and 214 others*.
- **Hearts are how the galaxy notices.** They feed the clip of the week and the newsroom's thresholds alongside views ([when a clip takes off](#when-a-clip-takes-off)), and the queue of clips the founder approves for YouTube is sorted by them, so the best rise to the top.
- **The maker hears about it.** *Your clip from Riedquat has 50 hearts* arrives as a message at the next station, and a clip that keeps collecting them earns its newsroom bonus.
- **Your own clips show their hearts** in the flight log.

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
- **A Kill Cam playlist** *(Mark, 26 October 2026)*: the reconstructions, filmed from outside by the kill cam and labelled RECONSTRUCTION, in their own series beside the cockpit clips ("Flight Recorder", already on the channel). The kill cam saves wide (16:9) as well as upright, so a wide reconstruction is a normal video for the channel's videos and this playlist, not a Short; the upright cut of the same moment can go out as a Short as well. Deaths from behind the ship that got you, and the best fights from behind the target.

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
