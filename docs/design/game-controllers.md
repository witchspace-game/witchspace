---
title: Game controllers
status: proposed
pillar: fight
summary: Fly with a PlayStation or Xbox controller, on a computer or clipped to a phone - every flight action on the pad, buttons named in the controller's own language, and the touch controls out of the way while it's connected.
card: viper
stages:
  - The basics - sticks, triggers, fire, launch and dock | built
  - The full flight layout, labels for PlayStation and Xbox, and the controls card | proposed
  - On a phone - the touch controls step aside while a controller is connected | proposed
help:
  - Fly with a controller and tell us what you'd change | playtest
---

# Design: game controllers

*Parked for the roadmap, 1 November 2026 (Mark: "I also have a question about using a Playstation or a Xbox Game controller?"). Change by pull request.*

## As built

Early basic support, never finished or announced (`game/input.ts`, `main.ts` `padToKey`), for any controller the browser reads with the standard layout:

| Control | Does |
|---|---|
| Left stick | Pitch and roll |
| Right stick, left and right | Yaw |
| R2 / RT, L2 / LT | Faster, slower (pressure-sensitive) |
| R1 / RB | Fire |
| Cross / A | Launch when docked; docking computer when flying; Enter on the title screens |
| Triangle / Y | Neo-vector or 1984 look |
| Circle / B | Back, on the new-commander screen only |

## What's missing

- **Most actions:** target, missile, ECM, hyperspace, the J jump, the views, the galaxy map, hailing, photos and the energy bomb still need the keyboard or the screen.
- **Nothing says it's there:** no "controller connected", and the controls card doesn't list the buttons.
- **On a phone,** the touch controls stay on screen with a controller connected.
- **Rumble when you're hit,** where the browser allows it.

## The plan

1. **The full flight layout:** shoulders and triggers for speed and fire; the D-pad for target, missile, ECM and views; face buttons for the J jump, hyperspace and docking; Options or Menu for the galaxy map. Every flight action on the pad.
2. **Labels in the controller's own language:** Cross, Circle, Triangle and Square on a PlayStation pad, A, B, X and Y on an Xbox one (the browser says which is connected). The controls card shows the controller with each button labelled, as the [pop-out keyboard](../../src/ui/keyboard.ts) does for keys.
3. **On a phone:** iOS pairs PlayStation and Xbox controllers over Bluetooth and Safari passes them to web games, Home Screen apps included. While one is connected, the touch controls step aside, and come back if it disconnects. A controller, or a grip that clips the phone between two halves, could be the best way to fly on a phone. To be tested on a real iPhone first.
4. **Docked screens:** shoulder buttons switch tabs and Cross / A launches; trading itself stays on touch or the mouse.
