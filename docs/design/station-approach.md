---
title: The station approach, its lights and its owner
status: proposed
pillar: trade
summary: The approach rings are the station's guidance beam drawn by your ship, with a quiet pulse in the owner's colour that says come in, hold, or a ship is launching; ships take turns in the slot; and a docking computer is worth most where stations broadcast nothing.
card: coriolis
stages:
  - The beam and the pulse - come in, hold, launching, seen only when lined up | proposed
  - Taking turns - every ship, not only you, waits for the slot | proposed
  - Who owns the station - the pulse in the owner's colour | proposed
---

# Design: the station approach, its lights and its owner

*Proposed, 2 November 2026, with Mark. Change by pull request.*

It began with Mark asking whether stations should show who owns them, "rather than all of them being amber colour". Marketing and Website both said keep the amber hull, the one shape everyone knows. The pictures settled it: a band round the hull hides on the far side as the station turns, and Mark: "The band idea doesnt really work. The ILS system is better but maybe should just have 1 colored rectangle that 'moves' to the next rectangle ... Subtle cue's rather than in your face!" Drawn from the game itself and liked (Mark: "I like the pulse by the way"): <https://claude.ai/artifact/Le8HDLMdoR4bjb21qWzaW2>.

## The rings are a signal, not hardware

Mark: "They cannot be physical as they would be damages constantly." So the approach rings are the station's **guidance beam**, and **your ship draws them**: the station broadcasts straight out of its slot, and your cockpit display turns the signal into rings, as a real instrument landing system is a radio beam the instruments show as a path.

That explains the rest:

- **You see them only when you're lined up**, within about 25° of the slot's axis and 5 km of the station, because that's where the beam is. They fade in as you line up, which is itself the cue that you have.
- **The kill cam and photos from outside don't show them**: they were only ever on your screen.
- **High-tech stations broadcast; low-tech stations and anarchies don't.** There, flying by hand, you get no rings: the slot and your own judgement.
- **A docking computer doesn't need the beam.** It measures the slot with its own sensors, so it draws the rings anywhere, at any angle, and at a station with no beam it's the only guidance you'll get. Mark: "So owning a docking computer would be more helpful when visiting low tech stations." It's worth most where docking is hardest, and classic Elite's docking computer worked at every station too.

The rings stay amber, as now. 1984 mode has none, as now.

## The pulse: traffic control, in one moving ring

One ring at a time is lit, stepping along the corridor about four times a second, at the rings' own brightness: a quiet cue, never a flash.

1. **Clear: the pulse runs inwards.** Come in.
2. **Hold: the pulse stops, the rings steady.** A ship is about to launch, or one has just come out. Never straight from in to out (Mark: "It should never suddenly switch from docking to launching without something in between").
3. **Launching: the pulse runs outwards** while a ship comes out of the slot.
4. **Hold again** until she's 4 km out or 15 seconds have passed.
5. **Clear** again.

**A little skill for pilots flying by hand** (Mark asked): read the rings as you come in, carry on with an inward pulse, ease off or swing wide on a hold, keep out of the lane on an outward one. Fly in against it and you can meet a launching ship, with the damage that comes with it. It's fair: once you're committed (lined up within 2.5 km, or the docking computer flying you) the slot is yours, traffic waits, and the pulse stays inwards. The skill is in timing your arrival, not dodging a surprise.

Roll assist stays as it is (Mark, 2 November 2026: "I think we just leave it for now as is"): it matches the station's spin when you aren't rolling, and on a phone Tilt already makes docking the easier of the two.

## Taking turns

Built so far (`flight/traffic.ts`, traffic control): the slot is yours while you're committed and for 15 seconds after you launch; traders don't launch then, and incoming ones wait off to one side. Police launch whenever they must.

Proposed: every ship takes turns, not only you. A timetabled launch waits while anyone is docking, an arrival waits while anyone launches, and the pulse shows which. Nothing is ever in the slot both ways at once.

## Who owns the station

- **Most stations are their world's own:** plain amber pulse (or a brighter amber).
- **A company's station pulses in its colour:** Hexon ice, the Mutual blue, Vorg and Wexley-Yorozu in shades moved clear of amber (Vorg's orange redder, so it isn't the pirates'; Wexley-Yorozu's yellow towards lemon or white-gold) so they read at a glance.
- **The owner by name** goes in text: the target label and the station card. Marks belong in flat screens, not on a hull at range.
- **On the site** (Website): a small chip in the company's colour on the galaxy and system pages. Ship pages and press shots stay amber.

**Open: who owns which.** Suggested: Hexon in Corporate States, Vorg a few lawless systems, the Mutual at Meridian Station, Riedquat (where it was founded), and Wexley-Yorozu the stations its Titans build.

**Not used:** recoloured hulls (they read as threats: orange as pirates, blue as police, cyan as militia), bands round the hull (hidden as the station turns), a coloured slot alone (too loud).

## The look

The rings and the pulse are part of the locked Neo look ([the look is locked](neo-look.md)): their colours and brightness go in `src/render/look.ts`, through the look check, with Mark's yes on the pictures.

## Steps

| Step | What | Size | Worker deploy |
|---|---|---|---|
| 1 | **The beam and the pulse:** in, hold, out; the approach cone and range; low-tech and anarchy stations without; the docking computer's own rings | Medium | No |
| 2 | **Taking turns:** every ship waits for the slot | Small | No |
| 3 | **Owners:** the owner's colour in the pulse, the owner on the label and card, the site's chip | Small | No |
