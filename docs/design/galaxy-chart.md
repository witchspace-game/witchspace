---
title: The galaxy chart
status: building
pillar: core
summary: Where every career starts a decision: the route drawn, danger at a glance, a proper key, links in from everywhere, zoom, and trade on the chart.
card: coriolis
stages:
  - Links from the news; the safe route | built
  - The route drawn, with danger rings | proposed
  - A key and bigger symbols | proposed
  - Links from contracts, trails and the exchange | proposed
  - Danger switch; zoom | proposed
help:
  - Mock up the chart's key: every symbol, at phone size | art
---

# The galaxy chart

*Design, 24 October 2026. Proposed; the first two pieces (links from the news, the safe route) are built.*

The chart is where every career starts a decision: where to trade, where to hunt, where to explore, how to get there. It has the basics (galactic and local views, find, a system's details, contract rings, visited rings, firsts), but it hasn't kept up with the game. It doesn't show the route the computer plans, nor where the danger is, its symbols are small and were unexplained, it can't zoom, and nothing else in the game links to it.

## Principles

- **Answer the commander's question at a glance:** where can I go, what's there, is it safe, how do I get there.
- **One symbol, one meaning,** every one in the key.
- **Nothing that needs a mouse.** Every action works by tap, by key, and by click.
- **Classic keeps its chart.** 1984 mode stays as it was, square dots and all; the additions are Modern and neo-vector.

## 1. The route, drawn *(proposed)*

The computer plans the safe way (built: `safeRoute` in game/contracts.ts): each stop in an anarchy counts as three extra jumps, a feudal stop as one and a half, so it goes round them when that isn't much longer. When there's no safe way, the course message names the dangerous stops.

On the chart:
- The planned route as a line, hop by hop, each hop a fine segment, the next jump brighter.
- A dangerous stop gets a small red ring on the line.
- The info panel for the destination: **Route:** 5 jumps · the safe way round (or · through Aronar, feudal).
- Fuel: hops beyond what's in the tank now are dashed (refuel on the way).

## 2. Danger at a glance *(proposed)*

A **Danger** switch on the chart (key **D**) tints systems by government: anarchy red, feudal amber, the rest as now. Off by default, so the chart stays calm; the route's red rings show regardless.

Later, the same switch could fold in what the game knows: recent pirate attacks (the news already counts them), Marshals' warrants, a yard under guard.

## 3. A key, and bigger symbols *(proposed)*

A small **Key** button opens a panel listing every mark: your system, the jump range circle, destination, route, visited ring, contract ring (in the company's colour), news diamond, danger tint, firsts. Symbols grow on the local chart (the news diamond was easy to mistake for a moon), and on a phone everything meets the 44 px touch target.

## 4. Links in *(the news built; the rest proposed)*

Any system named elsewhere opens the chart on it:
- **News** *(built):* each headline's system name is a link.
- **Contracts:** the destination of each contract and offer.
- **Trails and the explorer's log:** the next system a clue points to.
- **The exchange:** the best market for a cargo.

Opening the chart from a link puts the cursor on the system with its details showing; choose it again (tap or Enter) to set the course, which plans the safe way and warns if there isn't one.

## 5. Zoom *(proposed)*

The local chart zooms: the wheel (with Ctrl, or a trackpad pinch) on a desktop, two fingers on a phone, + and − keys. Plain scrolling keeps panning, as now. Three or four steps, from a few systems to the 60-unit view it has now and out to about twice that. The galactic chart stays whole.

## 6. Trade on the chart *(proposed, later)*

A **Trade** switch: pick a commodity you hold (or want), and systems are marked by what it fetches there, from the prices you've seen and the news. The exchange already knows this; the chart is where a trader thinks.

## Order

1. Route drawn, with the danger rings and the info-panel line (it makes the safe route visible).
2. The key and bigger symbols.
3. Links from contracts, trails and the exchange.
4. Danger switch.
5. Zoom.
6. Trade, later.
