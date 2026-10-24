# Trading: knowing something others don't

*Design, 24 October 2026. Proposed, Modern rules; Classic keeps 1984's market. It reworks how trading is presented and played, on top of the markets already built ([markets and trade](markets-and-trade.md), [economy and exchanges](economy-and-exchanges.md)). Numbers marked **(to tune)** are starting points.*

## Why

A review of trading as built (October 2026) found the money is there, but the game isn't:

| Credits | Median best run | Best runs |
|---|---|---|
| 100 Cr (new, 20 t) | about 70 Cr | up to 170 |
| 1,000 Cr (large cargo bay) | about 530 Cr | up to 1,400 |
| 5,000 Cr | about 930 Cr | up to 3,400 |

(Best runs offered by the trade computer from 29 systems in galaxy 1.) A run takes four or five minutes, so mid-game trading out-earns hunting pirates. The trouble is elsewhere:

1. **It isn't intuitive.** The market is a full exchange: 21 goods as four-letter tickers, a candle chart, an order book, fair value. A new commander wants to know what to buy here and where to sell it, and the screen doesn't say.
2. **It isn't a game of discovery.** The trade computer shows live prices at every market in range and the best run with its profit. Follow it and you're done: nothing to find out, nothing to outwit, no reason to read the news.
3. **The clever parts are hidden.** Limit orders already fill while you're away, even on a famine that starts after you leave. The news already travels at the speed of ships. Live prices everywhere make both pointless.

What *Elite* traders loved was knowing something others didn't and getting there first. This design puts that back, and adds what Mark asked for: markets you can learn to work, limit orders that matter, news cycles to ride, tips, true and false, from the people traders drink with, and insiders who'll sell what isn't theirs.

## Principles

- **Simple to start, deep to master.** A new commander can make money in their first minute without reading a chart. The exchange is still there for those who want it.
- **Information is the edge.** You know what you've seen and what's reached you. Everything else is out of date, a rumour, or a guess.
- **Every tip has a person behind it**, with a reason to tell you and a feeling about it: glad, sad, mad or bad.
- **Deterministic.** Events, news, tips and prices come from the seed and the clock, so the same galaxy for everyone; in the shared galaxy, the server holds the same state.
- **In-game only.** Credits and goods never touch real money ([principles](economy-and-exchanges.md#principles)).

---

## 1. The trader's screen

The Market tab opens on a plain screen with three short lists, not the exchange.

**Cheap here** (made here, or in a glut): the four or five best buys, each with what you last knew it fetches elsewhere.

> **Furs** 38 Cr · stock 120 t · last seen 61 Cr at Zaonce, 40 min ago **Buy**

**Sells well here** (wanted here, or short): what this station pays over the odds for, and whether you have any.

> **Computers** 112 Cr · wanted · you have 6 t **Sell 6 t**

**Your hold:** each good you carry, what it fetches here, what you paid, and the profit or loss.

- One tap buys as much as you can afford and carry (or a chosen amount); one tap sells the lot. The price impact is shown before you confirm.
- Full names, not tickers. Plain words: *wanted*, *in a glut*, *short*, *illegal here*.
- A line under each list says why: *Food is cheap: Lave grows it. Computers sell well: Lave doesn't make them.*
- **Advanced** (a switch, remembered) opens today's exchange: chart, order book, limit orders, trades feed.
- The **back room** (the black market) stays a separate door, as now.

## 2. Prices you know

The trade computer stops being an oracle. It knows:

- **Prices you've seen yourself,** at stations you've docked at, with their age.
- **Price reports,** which reach a station at the speed of news (10 minutes plus 12 per light year, as world news does now), so far markets are older.
- **What you've been told** (section 3), marked as such until you've seen it with your own eyes.

Every price elsewhere shows its age and source: *61 Cr · 40 min old*, *~70 Cr · a tip*. The best-runs list works from this knowledge and says how sure it is. Ages fade the confidence; a famine or boom you've heard of is taken into account. You can still be first, and you can still be wrong.

**A newcomer isn't left blind.** A commander starts with the Lave region's reports (a trade almanac, of the kind *Elite* came with), and the first time the trader's screen opens it says, in one line, that prices elsewhere are only as fresh as the news.

## 3. The saloon

Every station has somewhere traders rest: **the saloon** (a bar on a Coriolis; a tea room, a shebeen or a club elsewhere, by the station's culture). It's a tab beside News.

**Who's there.** Two to four people each visit, from the seed and the clock, so they come and go. Each has a name, a trade and a mood:

- **Glad:** a hauler who's just made a killing on medicine and can't stop talking. Free, true, and probably already too late.
- **Sad:** a miner laid off by a strike, selling what he knows for the price of a drink. True, and early.
- **Mad:** a captain cheated by a broker, telling you where the broker is buying cheap so you can undercut him. True, with a grudge.
- **Bad:** a smooth talker with a tip that sends you the wrong way while her friends buy up what you'd have carried. False.

**Tips.** Buy someone a drink (a few credits) and they talk; for a bigger tip, they want paying properly **(to tune: 20–300 Cr)**. A tip is one of:

- **Stale:** news you'd get anyway, a little sooner.
- **Early:** a world event before its news breaks. Events come from the seed and the clock, so the game knows a famine is coming before anyone's heard: *"My cousin ships out of Riedquat. The harvest's failed, and nobody knows yet."* The most valuable kind.
- **Planted:** false, put about by someone who profits if you believe it.

**Telling them apart** is the skill: who's telling you, why, and how they feel about it; whether it fits what you know; a trader's reputation in the saloon builds as their tips come true or don't. Nothing is labelled true.

**Tips are legal.** Overhearing a laid-off miner is gossip, not a crime, however true it turns out: the only risk is believing the wrong person.

**Insiders are another matter.** Some people in the saloon have information that isn't theirs to sell: a station clerk who sees the price reports before they're posted, a company contact who knows a shipping schedule, a port official who knows a crackdown is coming. Paying one of them is **insider trading**: more reliable than bar talk, dearer **(to tune: 200–1,000 Cr)**, and illegal in lawful systems (corporate state, democracy, confederacy). Big trades on what they told you, made before it was public, can be noticed afterwards: the Co-operative's market inspectors may fine you and give you a record (an Offender, as for smuggling) **(to tune: chance by size and government)**, and the insider loses their job, which they'll remember. Anarchies and feudal worlds don't care. The risk is the price of the edge.

## 4. The news cycle

Every event plays out in a cycle you can learn to ride:

1. **Whispers:** before it starts, early tips in nearby saloons (section 3).
2. **The news breaks:** as it reaches each station, NPC traders react, and the market **overreacts** at first: prices overshoot what the shortage alone would justify **(to tune: +30% at the peak)**.
3. **It settles:** as traders arrive and the event runs, prices drift back towards the real shortage.
4. **The aftermath:** when it ends, stockpiles left behind make a glut, briefly cheap.

So "buy the rumour, sell the news" works, and so does buying the aftermath glut. The trades feed and the chart show each stage; the trader's screen says it in words: *Food prices here are overshooting on the famine news.*

## 5. Limit orders that matter

Limit orders already exist (they fill while you're away, from the price history). They become a tool you're shown how to use:

- **From the trader's screen:** *Sell my furs here if they reach 70* or *Buy medicine here if it falls to 40*, one line with a price.
- **On your behalf, out of sight:** they fill while you're elsewhere, when the cycle swings past your price. You're told by message when you're next in range of news from that station, and the goods or credits wait at the station.
- **A standing order is a bet on the news:** place a sell order at Zaonce before the famine news arrives, and it fills on the overshoot whether you're there or not.

## 6. Working the market

Ways to move a market, each with a cost and a risk:

- **Cornering:** buy up a good across nearby markets before the news lands, then sell into the shortage. Limited by your credits, hold and storage, and by depth: stations restock and NPC traders arrive **(to tune)**.
- **Starving a station:** ambush the traders bound for it (as now, their cargo never arrives) and it posts higher buy orders. Piracy, with everything that brings.
- **A planted rumour of your own:** pay a saloon regular to spread a false tip. NPC traders believe it for a while and go the wrong way, leaving a market to you. Caught (a chance, higher in lawful systems), it's a record for market manipulation.
- **Dumping:** sell a large load into a thin market to crash it for a rival's arrival (shared galaxy).

**Limits.** Market depth, restocking and NPC arbitrage pull prices back, so no one commander can hold a market for long. In the shared galaxy, position limits and public trade histories ([fair play](economy-and-exchanges.md#8-fair-play-and-manipulation)) keep it a game.

## 7. Stages

1. **The trader's screen and prices you know** (sections 1 and 2): plain lists, one-tap trades, the exchange behind Advanced, the trade computer working from your knowledge, the starting almanac. The biggest change to how trading feels, and nothing new to simulate.
2. **The saloon** (section 3): the people, tips stale, early and planted, and their reputations. Then insiders, and the inspectors.
3. **The news cycle** (section 4): the overshoot and the aftermath glut, and saying it in words.
4. **Limit orders on the trader's screen** (section 5), and messages when they fill.
5. **Working the market** (section 6): planted rumours and manipulation records; cornering falls out of stages 1–4.

## Open questions

- How fresh should a new commander's almanac be, and how far should it reach?
- Should tips be per commander (each hears their own) or shared (the same people tell everyone the same thing)? Shared is fairer in the shared galaxy; per commander makes a single-player saloon feel alive.
- How often should buying from an insider be caught, so the risk is real but the edge worth it?
- Should the saloon be where contracts and crew are found too, in time?
