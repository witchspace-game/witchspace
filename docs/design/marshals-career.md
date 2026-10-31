---
title: Become a Marshal
status: proposed
pillar: fight
summary: Earn the gold band. The galaxy's best pilots are found by a recruiter, pass a trial, and fly a Lancer of their own for the Co-operative Marshals, hunting the galaxy's worst, real commanders included, with warrant alerts on your phone.
card: lancer
stages:
  - The recruiter and the trial, against computer-flown warrants, solo and shared | proposed
  - The Lancer issued, in livery only the server can grant, the gold card and the tag | proposed
  - Calls in shared space, players first and the Bastion as backstop, and warrant alerts on your phone that travel at the speed of news | proposed
  - Rank, wingmen and the Marshals' own stories | proposed
help:
  - Write the recruiter's first approach in a Co-operative Saloon, and the three trial briefings | writing
  - Design the Marshal livery for the Lancer: the gold band and the white beacons | art
---

# Design: become a Marshal *(Mark, 31 October 2026)*

**Earn the gold band.** The galaxy's best pilots can join the Co-operative Marshals, fly a Lancer of their own, and hunt the galaxy's worst, real commanders included. Mark: *"Bounty hunting makes sense, especially if you get a notification that a warrant has been issued for a real CMDR and you get the notification on your phone. That would be fun."*

Nothing here is built yet; it comes after launch. It brings together pieces already in [law, travel, debt and capture](law-and-travel.md) (section 9), [ships and classes](ships-and-classes.md), [the combat rating](combat-rating.md), [shared space](shared-space.md) and [the callsign card](callsign-card.md).

## What it builds on

- **The Marshals are already in the game** (Modern rules): when a warrant comes due, the Bastion *Semper Fidelis* comes through a witchspace rift and launches Lancers in pairs.
- **The Lancer** (Co-operative Naval Yards) is the fastest ship in the galaxy: 380 m/s, shields 160, hull 140, two missiles, no hold. She's never for sale.
- **Warrants for crimes against commanders** are decided by the server in shared space: kill a commander in lawful space and you're a Fugitive, with a Marshals warrant wherever there's law.
- **The anti-farming rules** are already designed: the Marshals pay the bounty for a Wanted commander, never to a wingmate, the same account, or friends farming each other ([shared space](shared-space.md)).
- **Markings only the server can grant** already work: an edition's number and lights show only for the account that holds it (`server/src/paint.ts`). Marshal livery uses the same check.
- **The callsign card keeps gold for the Marshals.**
- **The lore:** each system's police can be corrupt; the Marshals are meant to be incorruptible. They don't hire Fugitives, and they don't patrol anarchies, though they'll go in after their most-wanted. The Co-operative's credit is worth what its law can reach, and the Marshals are that law.

**One tier, galaxy-wide.** Each system's police (Vipers, one system) and the Co-operative Marshals (every Co-operative system, warrants that follow you) are the two tiers the lore already has; the career is the Marshals. A career in a system's own police can come later. Never "Federal": the Co-operative is ours.

## The career

### 1. They find you
**Nobody applies.** At **Dangerous**, with a clean record, a recruiter finds you in a Co-operative Saloon: *"We've been watching your record, Commander."* It's the companies' pattern, who start getting in touch at Contractor.

Who qualifies:
- a combat rating of **Dangerous** or higher (512 points);
- **clean:** no Fugitive status in the last 90 days, and no Offender in the last 30. One mistake in shared space shouldn't close a career for good;
- **signed in,** since the career lives on your account.

### 2. The trial
Three missions in your own ship, each a deliberately hard fight ([combat rating](combat-rating.md): missions are the main road to Elite):
1. **Escort** a relief convoy through a pirate route (the convoys are already on the timetable).
2. **Clear a nest** that an explorer's survey found.
3. **Serve a warrant:** bring in a Wanted pilot. Destroying them counts; disabling and capture is better, once it's built.

Fail one and you can try again after a while. Commit a crime during the trial and it's over.

### 3. Sworn in
- **A Lancer is issued** in Marshal livery: a gold band, white beacons, and a transponder that says *Marshal*. The server issues the livery, so nobody can paint themselves as the law.
- **Your own ship waits** in the hangar where you were sworn in. The Lancer has no hold: on duty, you don't trade.
- **On and off duty.** Fly the Lancer and you're on duty. Take your own ship out and you're an ordinary commander, still bound by the code.
- **Your callsign card turns gold,** and your tag carries the mark: `◆◆◆ MARSHAL Nova · 1.2 km`.

### 4. The work
- **Warrants against computer-flown criminals:** the pirates, gangs and worse the Marshals hunt now. You're paid for each warrant served, as well as the bounty.
- **Blockades and escorts:** keep a lane open, guard a Wexley-Yorozu supply line, protect a relief convoy to a famine.
- **The call.** When a warrant comes due in shared space, **on-duty player Marshals within range get it first**, with the system and the target. If nobody answers in time, the Bastion comes as it does now. Players first and the computer as backstop means the law works when only a few Marshals are online.
- **Real Fugitives.** A commander who murders another in lawful space can be hunted by a real Marshal with a callsign of their own. In Witchspace, the law is other players.

**Bounty hunting is open to everyone signed in,** not only Marshals: shared space already pays whoever brings a Wanted commander in. Marshals get the call first, warrant pay on top of the bounty, and the Bastion as backup.

### 5. The code
Marshals answer to the same law they enforce, more strictly.
- **Any crime on duty:** the Lancer is recalled at once, the livery revoked, and you're struck off.
- **Killing a clean commander** makes you a Fugitive like anyone else, and bars you from the Marshals for good. It's the only lifetime bar.
- **Lose your standing** (too many missed calls, failed warrants) and they want their Lancer back.
- **No Marshals in anarchies,** except on a most-wanted warrant.
- **Resigning:** hand the Lancer back at any Co-operative station. You can come back after 30 days with a single trial mission. Struck off means no return.

### 6. Rank
Earned by warrants served and missions flown: **Probationer → Marshal → Senior Marshal → Chief Marshal** (not "Marshal Commander", which clashes with CMDR). Higher rank brings longer-range calls, the right to call in a Bastion yourself, a second Lancer for a wingman you vouch for, and in time a hand in the Marshals' own stories.

## Warrant alerts on your phone *(Mark)*

When a warrant is issued for a real commander, bounty hunters who've opted in get a notification:

> **Warrant issued:** CMDR Vex, wanted for murder at Diso. 4,000 Cr.

Tap it and the game opens with Diso as your destination.

- **Already possible:** the server sends Web Push for the ship's log (`server/src/push.ts`). On an iPhone it works from the Home Screen app (iOS 16.4 and later).
- **Who gets it:** on-duty Marshals first; a few minutes later, commanders who switched on *Warrant alerts*, nearest first (within a few jumps, then wider).
- **Fair limits:**
  - **Fugitives only** (a commander killed in lawful space), never small crimes.
  - **A capped number of recipients** for each warrant, so nobody is swarmed by a whole galaxy.
  - **It expires:** served, or after a set time, and the alerts stop.
  - **Never into anarchies.**
  - **Not to anyone who's flown with them recently** (the anti-farming rule).
  - **Opt-in,** easy to turn off, with **quiet hours**. It names only the public callsign and the system, as the scanner tag already does.
- **Why:** it brings players back ("someone's wanted at Diso, and I'm three jumps away"), it makes the law in shared space other players, and it's the kind of thing people screenshot.

### The warrant travels at the speed of news *(Mark)*

Mark: *"The warrant would be issued in the system and if theres no Marshal's in that system then the warrant would be passed to the next system according to the speed of information that is consistent with the game."*

- **Issued where the crime was.** On-duty Marshals in that system are alerted at once.
- **Then it spreads outward** at the game's own news delay, the same as headlines and price reports (`newsDelay` in `src/economy/events.ts`: 10 minutes, then 12 more for every light year). Each system hears it at the time of the crime plus that delay, and opted-in hunters docked there, or last flying there, are alerted when it arrives.
- **Calculated, not simulated:** the server works out arrival times from the crime's time and place. One small query a minute finds who has just heard, with nothing stored or sent per system.
- **The alert says how old the news is:**

  > **Warrant heard at Lave:** CMDR Vex, wanted for murder at Diso, 3.6 LY away, 53 minutes ago. 4,000 Cr.

- **It makes a chase.** The nearest hunters hear first and have the best chance; a Fugitive can try to outrun their own warrant, or run for an anarchy, where it never arrives.

## Stories it opens

- **The Falcon's Debt** ([the Falcons](legends-the-falcon.md)): one day the Marshals catch her, and the Mayday comes on an old Mutual channel. If you're a Marshal, you may be the one sent. **Saving her is allowed:** it's dereliction, not murder. You're struck off, not made a Fugitive, and she hails you by name for good. A choice that costs something is the point.
- **The Bureau of Continuity** may know what the Marshals really protect. A Senior Marshal could find out.
- **The credit and the law:** a region the Marshals lose is a region where the credit weakens, so player Marshals hold the money up.

## Fair play

- **It can't be farmed:** no bounty from a wingmate, the same account, or someone you've flown with recently.
- **No abuse of power:** a Marshal who fires on a clean commander commits a crime like anyone else, with harsher consequences. The server judges, never the Marshal.
- **New players are protected:** the starter systems around Lave keep their permanent computer-flown Marshal presence, whatever the players do.
- **Never bought:** no edition, voucher or money of any kind buys a Lancer or the gold band.

## Building it in stages

1. **The recruiter and the trial,** against computer-flown warrants. Works solo from day one; player calls grow as players arrive.
2. **The Lancer issued,** with livery checked by the server (as editions are), the gold card and the tag.
3. **Calls in shared space:** on-duty Marshals get warrants first, the Bastion if nobody answers; and warrant alerts by Web Push.
4. **Rank,** wingmen and the Marshals' stories.

**Depends on:** combat missions ([combat rating](combat-rating.md)); disabling and capture ([law and travel](law-and-travel.md), planned) for the trial's best version; [shared space](shared-space.md) steps 4 and 5 for stage 3; and a hangar for your own ship.

## Open questions

- **Should the police and the Bastion also wait for the news?** Consistent, and it gives the chase teeth, but it changes how warrants work today: a Marshals warrant follows you into every Co-operative system at once ([law and travel](law-and-travel.md), section 2), and in shared space the server sends the Marshals when the warrant comes due. There's also a balance problem: a hyperspace jump of up to 7 light years takes a minute or two, while news needs about an hour and a half to cover the same distance, so a Fugitive who keeps jumping would always stay ahead of a warrant that only travels as news, and never meet the law. **Proposed:** the hunters' alerts travel as news, as above; the Co-operative's own law keeps its instant warrant (the Marshals' network is faster than gossip), so running buys time from the bounty hunters, not from the Bastion. Decide when stage 3 is built.

## How we talk about it

**"Earn the gold band,"** or **"In Witchspace, the law is other players."** The home page's Fight ladder already says *join the Marshals and fly a Lancer of your own*, marked planned; it stays honest until stage 2 is built. No real police forces, ranks or badges are copied.
