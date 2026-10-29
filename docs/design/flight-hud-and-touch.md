---
title: Flight HUD and touch
status: built
pillar: fight
summary: The job strip that always says what's next, and a touch drawer made for thumbs.
card: cobra-mk3
help:
  - Fly on a phone and tell us what your thumbs hated | playtest
---

# Design: the job strip, work on your route, and the touch drawer

*Agreed October 2026. Built in the same month (see "As built").*

Contracts play like a quick mini-game, but mid-flight it was hard to tell which job you were on and where to go next, especially after a fight. And on a phone, thirteen flight buttons crowded the screen when you most wanted it clear. This covers both.

It builds on [companies and contracts](companies-and-contracts.md) and [radio and comms](radio-and-comms.md) (where these messages will live once the radio log exists).

## Principles

- **Always know the next step.** One line says what you're doing and what to do next, without opening anything.
- **The computer picks up where you left off.** A fight is an interruption, not the end of the job.
- **Tell, don't nag.** Messages come at natural moments (arriving, fights ending, approaching a station), never as a stream.
- **A clean screen for combat.** On a phone, only what you need to fight is always there; everything else is one tap away, and never moves under your thumbs.

## 1. The job strip

A single line on the HUD while you hold a contract:

> ▸ 8 t Medicine → Diso · 2 jumps left · Hexon
> Next: hyperspace to Diso (H)

- **The most urgent contract** is shown: late first, then fewest jumps left. "+1 more" when there are others; tapping it lists them all.
- **The next step** comes from where you are:
  - somewhere else: the next hop on the shortest route ("Hyperspace to Leesti (H) · 3 jumps to Diso"), or "Set course to Leesti" if the course isn't set (tap the strip to set it), or "Refuel first" if the tank won't reach;
  - at the destination: "Dock at Diso Station";
  - a survey: "Survey Leesti's moons · 1 of 2", then "Hand in at any Wexley-Yorozu station";
  - cargo adrift: "Recover your sealed case at Riedquat".
- **Deadlines** read "2 jumps left", "last jump" (amber) and "late · half pay" (red).

## 2. Back on course

When a fight ends (no hostile ship within 8 km for a few seconds, after there was one), the computer says what's next:

> Back on course · 8 t Medicine for Diso · hyperspace to Leesti (H)

Once per fight, and only when you hold a contract.

## 3. Work on your route

Approaching a station (at docking-clearance range), traffic control mentions **one** contract on its board that goes your way:

> Diso Station · Hexon has 6 t Liquor for Zaonce, one jump past your drop

- **It fits your route:** the same destination as a contract you hold, one jump from one, or on the way there (at most one jump longer).
- **You can take it:** standing, free hold and the three-contract limit all allow it. Surveys aren't offered this way.
- **Once per station per board** (boards change every half hour), and only while you hold a contract, so a commander just flying about isn't pestered.
- **You still dock to take it.** It's a reason to stop in, not a pop-up.

## Messages

Things worth keeping go into **Messages** on the Contracts tab, from the company concerned: one jump left, running late, reclaimed (as before), **delivered** (with the pay) and **work on your route**. "Back on course" is for the moment and isn't kept. Under Modern rules these, and the moment-to-moment lines, are also heard in the radio log ([radio and comms](radio-and-comms.md)). Phone notifications stay for when you're away from the game.

## 4. The touch drawer

- **Always on screen:** the aim pad, speed, Fire, the missile button and **ECM**, beside Fire.
- **The view button** *(Mark, 29 October 2026)*: beside the camera, an arrow pointing where you're looking (amber when it isn't ahead). Tap it and Front, Rear, Left and Right open round it: tap one and the view stays. Press and hold, and the four open under your thumb: slide onto one to look that way while you hold, and let go to look ahead again (a glance). It replaced the drawer's View, which stepped through the four one at a time.
- **The missile button** *(Mark, 29 October 2026)*: a master arm and a guarded trigger. A tap arms (or, armed or locked, disarms); once locked it reads *Hold to fire* and launches only after half a second held, the button charging as you hold, so a thumb by FIRE can't send a missile at the wrong ship.
- **The drawer:** everything else (Jump, Hyper, Dock, Pilot, Map, Surrender, Bomb, Survey, Dark, Sound, Tilt) slides in from the right edge. A small tab opens it (tap, or swipe in); it slides away after you press anything in it, or when you tap the tab again.
- **The next button out by itself:** one contextual button sits outside the drawer, the obvious next step: **Dock** within clearance range (docking computer fitted), **Survey** near something to survey (survey autopilot fitted), **Hyper** when a course is set and the tank reaches it, otherwise **Jump**.
- **Nothing moves on its own in a fight.** The drawer only opens and closes when you touch it.
- **The job strip** on a phone is a small pill at the top left, clear of the dashboard ("▸ Diso · 2 jumps · +1"). Tap it for the full line, the next step and a **Set course** button; it folds away by itself when a fight starts.

## As built

- `src/game/jobs.ts`: the next step, deadlines and route fit, pure and tested (`jobs.test.ts`).
- The strip, back on course, route work and the drawer: `src/main.ts`, `play/index.html`, `src/style.css`.

## Fixes from players

- **Roll keys held their bank** *(28 October 2026; reported by myno on Stardot, t=33815)*. In the mouse scheme the flight assist levelled the wings the moment the roll keys were let go, so a keyboard roll fought back ("a bit obstinate"). Any roll you make now holds its bank until you tap to level, as a mouse roll already did.
- **The Cobra carries four missiles** *(28 October 2026; reported by myno on Stardot, t=33815)*. As in 1984: four rails, starting with three.
