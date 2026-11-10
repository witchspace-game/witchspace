---
title: CMDR Bond's ship
status: proposed
pillar: world
summary: On Loan, an Anaconda the Bureau of Continuity had rebuilt as a cruiser for people, not cargo, with a saloon raised on her crest, the finished Will-o'-the-Wisp and an experimental shield. Silver, fast, never returned, never for sale.
stages:
  - The hull, drawn and approved from pictures | proposed
  - In the game - our Anaconda and his conversion, checked against the fleet | proposed
  - The experimental shield, the Wisp, and his outings | proposed
---

# Design: CMDR Bond's ship

*Proposed, 10 November 2026. Mark: "Lets build the ship and only CMDR BOND" (un-parked; the brief is [the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired) and [ideas](../ideas.md)). Mark, through the day: racing green, then silver after seeing both in the game; "It needs to be a cruiser and have quarters for entertainment"; "instead of guessing, look for inspiration first"; "I think he should have an anaconda 2 inspired ship" (our own Anaconda, his a one-off); "compared to the Fdl it's quite ugly" (redrawn); "much better"; "For the lore etc she should have an experimental shielding". Change by pull request.*

## The rules for this one

Bond is an easter egg, and he leans on a famous character, so the lines are held tighter than usual:

- **His name is CMDR Bond, and only that.** Never his first name, anywhere: game text, ship names, files, commits, the changelog. Member **007** stays held as it is.
- **The hull is ours.** It's our Anaconda, in the *spirit* of a 1960s British grand tourer and gentleman's motor yacht. No real car's or yacht's lines are traced, and no real maker is named anywhere, in the game or out of it.
- **Nothing from the films.** No film names, no quotes, no music cues, and no gadgets at all (Mark).
- **The Neo look holds.** She glows like every hull, never dimmed. Her colour is a line colour, and look numbers stay in `src/render/look.ts`. Mark's yes on pictures comes before any ship file merges.

## Where the shape came from

Looked for first, not guessed (Mark):

- **The Fer-de-lance's elegance:** a needle nose, a hexagonal hull with a crest along her spine, a swell to the shoulders and a taper to the tail, and air in the silhouette. The first Anaconda drawn without these was a slab ("quite ugly"); the second used them.
- **1960s British grand tourers:** a long bonnet and a roof that falls away to the tail.
- **1960s gentlemen's motor yachts:** a deck saloon set behind a long foredeck.
- **Streamliner observation cars:** the lounge as the end of the vehicle, looking back.
- **Concept "space yachts":** hide the windows and let one sculptural shape carry it, which is our rule anyway (no windows, ports or panels).

## Two ships, one family

### Our Anaconda (Cowell & MgRath)

The Cobra's maker's halo ship, an open brief until now ([the shipbuilders](shipbuilders.md), [ships and classes](ships-and-classes.md)).

- **Shape:** one hexagon scaled along her length so every panel is flat. A needle nose, a crest along her spine, widest at the shoulders two-thirds back, narrowing to the tail, with a drive sponson down each flank for the Cobra family's broad arrowhead. About 171 m long, 80 m across the sponsons and 18 m high, so she docks.
- **Stats (first draft):** speed 200, pitch 0.45, roll 0.9, hull 600, shields 400, 6 missiles, 650,000 Cr.
- **Her hold is 60 t, not 350.** The slim, elegant hull is about 38,000 m³, and `balance_check` puts a hull that size at about 65 t at the density the fleet carries. She can't grow bigger and still dock. That suits the Heavy class (best at armour and firepower, not hold; Mark: nobody wants a semi truck), and the proportions table in [ships and classes](ships-and-classes.md) should come down to match.

### His: an Anaconda the Bureau had converted

- **Why she exists:** the Bureau of Continuity ([lore](../lore.md)) had six Anacondas rebuilt in the years after the Grey Fever by **Hollis & Thorne**, coachbuilders who never built more than a dozen hulls a year, all to order. They became couriers for people, not cargo: envoys, witnesses, a scientist who couldn't be seen to travel. Most of the hold gave way to quarters.
- **Her name: *On Loan*** *(Mark)*. For an afternoon she was the *Will o' the Wisp*, until we found the name already belonged to the explorers' prototype; she carries that device instead (below). Five were scrapped when the courier service closed. When the Bureau let him retire, nobody asked for the sixth back.
- **Shape:** the Anaconda's hull with a **saloon raised on her crest** two-thirds back: a steep front like a windscreen, a flat roof over the lounge and the bar, falling away to the tail like a grand tourer's roof. No windows: the raised shape alone says people live and entertain aboard. 25.6 m high, inside the 26 m slot.
- **Colour: silver, #808d97** *(Mark)*. Racing green was tried first: true racing green glows too dim for the Neo look, and a brighter green read as ordinary green. Pale silvers bloomed into white blobs; this cool, mid silver glows as bright as any hull and keeps every line crisp. Clear of the yard's Coriolis White, which is far paler.
- **She's fast** *(Mark)*: top speed 350, 125% of a Cobra's, quicker than a Falcon, behind only the Mamba and the Marshals' Lancer. She turns like the big ship she is (pitch 0.55, roll 1.0): a grand tourer, quick in a straight line. Hull 420, shields 480 (and the experimental shield), hold 40 t (the quarters took the rest), 3 missiles. Never for sale.

## The experimental shield *(Mark, 10 November 2026)*

**Where it came from:** the Co-operative Naval Yards' prototype programme, the one that built the **Constrictor**, the stolen prototype that is Bond's unclosed case ([the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired); [exploration](exploration.md#stage-4-legends)). The Bureau borrowed the programme's shield for its couriers, on trial. The trial was never written up, and his set was never taken back. So his ship carries a piece of the same secret as the ship he's still hunting, and he knows it.

**What it does (to decide):** a shield that learns. Whatever keeps hitting her does less and less, down to about half, while it keeps hitting; let up, or hit her with something else, and it starts again. So the way to hurt her is to fire in bursts and change lasers, never to hold the trigger (missiles can't lock on her at all). It's readable on screen: each hit's flash on her shield grows brighter as it hardens (the glow only ever gets brighter, never dimmer).

**What it isn't:** for sale, or fittable, or anyone else's. If a player ever sees it on another hull, it's because the Constrictor story has moved.

## No gadgets: the Will-o'-the-Wisp *(Mark, 10 November 2026)*

Mark: *"she has none of the 'Bond' rubbish like a smoke screen or a tail plate. Will-o'-the-wisp maybe."* So she carries no gadgets at all: no smoke, no mines, no armour plates, no trackers. Her one strangeness is how she's seen.

**One story, not two** *(Mark: "She carries the Wisp")*. The game already has a **Will-o'-the-Wisp**: the prototype in the rack of the lost Science Division courier, the *Quiet Hand*, that explorers find ([exploration](exploration.md#the-lost-courier-and-the-will-o-the-wisp), [lore](../lore.md)). While your lasers are cold, enemy lasers miss half the time and half the missiles are fooled. *On Loan* carries the **finished** device, the one the prototype was meant to become, fitted when the Bureau's couriers were the only ships that needed it. It's why the *Quiet Hand*'s last order said "under no circumstances let this fall into private hands", and why Wexley-Yorozu want theirs back: a retired agent has had one all along.

**How she's seen:** like the old lights over marshes that travellers followed and never reached.

- She shows on your scanner as a faint light at the edge of range, there and then not. Turn towards her and she's further off than she should be. She's never close unless she means to be.
- Follow her and she leads somewhere: a wreck, a beacon, a system on the Constrictor trail. Then she's gone.
- It's the finished Wisp, not a trick: what the explorers' prototype does by halves (missing lasers, fooled missiles), hers does all the way, and it bends how she shows on a scanner too.
- **Nothing can lock on her** *(Mark)*. A missile's seeker needs the scanner to hold her, and it can't, at any range. To hurt her you need lasers, in bursts, and the learning shield punishes anyone who holds the trigger. She rarely fights, and almost nobody beats her when she does.
- **The glow never dims.** Up close she's as bright as any hull. It's the *scanner* that can't hold her, not her lines that fade.

The few who see her talk about it in the saloon, and nobody believes them. That's the rare sighting [the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired) asks for.

## Where she appears

As [the world, 6.1](the-world.md#61-worked-example-cmdr-bond-007-retired) says: most days, nowhere. Now and then he takes her out, when something on the Constrictor trail interests him. That's the rare sighting commanders talk about.

## Stages

1. **The hull.** *Done as pictures, 10 November 2026:* our Anaconda (redrawn after "quite ugly"; "much better") and his conversion with the saloon on her crest. Next: pictures of both flying in the game in the Neo look, at lane distance and on a phone, for Mark's yes.
2. **In the game.** Drafted and checked (`validate_ship`, `balance_check`), and filmed flying in silver (`tools/on-loan-flyby.mjs`). The Anaconda's file waits in [`drafts/`](drafts/): every ship file gets a public page on the site, and her release (site page, shipyards) is Mark's call. *On Loan is in the game* (`content/ships/on-loan.json`, 10 November 2026), marked `unlisted`: the game, gifts and shared space know her, but she's kept off the site, the showroom's browsing and the public ship lists, and with no price she's never in a shipyard. Off the site isn't secret: the repo is public. Mark, as the game's owner, holds one in his own fleet (Mark: "As the owner of Witchspace, I have ownership of every ship in my fleet").
3. **The experimental shield, the Wisp, and his outings.** The shield and the finished Wisp as NPC behaviour (`src/flight/wisp.ts` has the prototype's), tuned in the duel simulation; how she shows on a scanner; and the rare sighting that leads somewhere on the trail.
