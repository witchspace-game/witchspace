# Design: the Darner, a dragonfly ship

*Design, 24 October 2026. Proposed; shape to be chosen from the sketches. Modern only; Classic keeps 1984's fleet.*

Mark asked for a ship like a dragonfly. The film ornithopters are someone else's design, so this one starts from the insect itself ([homage rules](../../CONTRIBUTING.md#legends-and-homages)): no flapping, no film names, nothing traced. Insect-winged craft are an old idea (da Vinci drew them); the shape and the story here are ours.

## The ship

- **Name:** the **Darner**, after the dragonflies of that name (an ordinary word, like Cobra and Mamba before it).
- **Shape:** a long, segmented tail ending in the engine; a deep middle where four narrow wings root; a short head with two big canopy domes like a dragonfly's eyes. About 63 m long, 69 m across with its wings spread (a Cobra is 50 by 68).
- **The wings aren't for air.** There's none to fly on (the Falcon's notes say the same). Each wing is a radiator vane with a manoeuvring thruster at its tip: **spread**, the tip thrusters give it the tightest turn in the game; **folded** back along the tail, it's slimmer and faster, but turns like anything else. It spreads them by itself below a third of its top speed, and folds them above.
- **In neo-vector:** each wing is a few glowing lines with fine veins across it and a small dark cell near the tip, so it reads as a dragonfly from any angle. Iridescent blue-green.

## The sketches

Three shapes, rendered in the game's own style, each from three-quarter, from above beside a Cobra, and from the side (regenerate with the scripts in the review):

- **A, long-tailed:** the classic dragonfly. Slim, unmistakable, and the most like the insect.
- **B, compact:** a short, sturdy body and broad wings: more fighter than insect, and closer to an aircraft.
- **C:** A with its wings folded back for cruise, like a damselfly at rest. Not a separate ship: what A (or B) looks like at speed.

**Recommendation:** A, with C as its folded state. It's the one that reads as a dragonfly at a glance, and the fold between A and C is the ship's character.

## What it's for

- **Role:** a fast courier and scout. Small hold (6 t), light hull and shields, one missile. It's the ship for **express contracts** (the run that has to be there in time), survey work, and slipping through pirate space rather than fighting through it.
- **In a fight:** it doesn't out-gun anything; it out-turns everything. Spread, it can stay inside a Viper's turn. Folded, it can run.
- **Who sells it:** the Halloran yard and stations near it. Mid-price **(to tune: about 90,000 Cr)**, less than a Cobra: it's a specialist, not a workhorse.

## Who makes it

**Halloran Sisters**, a family yard on an agricultural world's moon, two sisters running what their father started. They name every hull after an insect: the Darner, and later perhaps the Skimmer and the Chaser (they'd say *"the dragonflies were here first"*).

- **Nell Halloran** (glad) builds them, and still can't believe people buy them: she signs every wing spar.
- **Ide Halloran** (sad) does the books, and knows the yard is one bad year from being bought out by Wexley-Yorozu. Every Darner sold is another year.

A story hook: Wexley-Yorozu's offer for the yard, and a commander who flies a Darner deciding whether to help the sisters keep it.

## Building it

1. **The ship file** (`content/ships/darner.json`): the chosen shape, with the wings as separate parts so they can fold.
2. **Folding:** the wings swing between spread and folded with speed (a few tenths of a second), and the turn rate follows them. NPC Darners do the same.
3. **In the game:** sold at the Halloran yard's region; flown by couriers in traffic now and then; express contracts that suit it.
4. **The sisters:** a small story line, later.

## Open questions

- A or B (or something else)?
- Should the fold be automatic, or a key (and a touch button) so a pilot chooses when to spread?
- Can a commander buy one, or is it an NPC ship first? (Buying ships isn't in the game yet: every commander flies a Cobra.)
