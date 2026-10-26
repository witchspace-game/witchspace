---
title: System currencies
status: designed
pillar: trade
summary: A currency for every system, modelled on real crypto: government monetary policies, liquidity pools, pegs and crises, and a ledger anyone can verify. Virtual only.
card: coriolis
help:
  - Model a currency crisis for one government type | design
---

# Design: system currencies

*Status: **agreed direction**, for the shared galaxy under Modern rules. It expands section 4 of [economy and exchanges](economy-and-exchanges.md) from optional station scrip to a currency for every system. Single-player Modern may use a simpler version; Classic keeps plain credits, as in 1984. Numbers are starting points for playtesting.*

## The idea

Every star system has **its own currency**, and those currencies behave like real cryptocurrencies: floating exchange rates, liquidity pools, pegs that hold or break, fixed-supply "hard money", and a ledger anyone can check.

The tokens are **virtual**. They exist only in Witchspace and can never be bought, sold or withdrawn for real money. The theory is real; the money isn't. Commanders who know crypto will recognise the mechanics, and commanders who don't will learn them by trading.

1. **Real mechanics.** Automated market makers, order books, minting and burning, pegs, halvings and hash-chained ledgers, working as they do in the real world.
2. **Rooted in the galaxy.** Each currency's behaviour comes from its system's government, economy and productivity, the same values the original game generated for every system.
3. **Trading becomes macroeconomics.** A pirate blockade, a Thargoid incursion or a guild cornering a market moves a currency, and sharp traders profit from knowing first.
4. **Server-authoritative and verifiable.** The server keeps the books, as set out in [servers and hosting](servers-and-hosting.md), but publishes proofs so anyone can check it isn't cheating.
5. **Virtual only.** Nothing has real-world value; selling currency for real money breaks the rules ([fair play](economy-and-exchanges.md#8-fair-play-and-manipulation)).

Related designs: [economy and exchanges](economy-and-exchanges.md), [stations and worlds](stations-and-worlds.md), [servers and hosting](servers-and-hosting.md), [player-run stations](player-stations.md).

---

## 1. One currency per system

- **Generated from the seed.** Every one of the 2,048 systems gets a currency name, a three-letter ticker and a starting supply from its seed, so Lave's currency is always the same and costs nothing to store. Names are original and generated; none come from the *Elite* novels or later games.
- **Prices are local.** A station's market, shop, fuel, repairs, fees and fines are priced in the local currency.
- **The Co-operative credit (CR)** stays the galaxy-wide reserve currency, accepted everywhere and used as the common pair on every exchange, the way stablecoins and Bitcoin sit at the centre of real crypto trading.
- **Wallets.** A commander holds a balance in each currency they've touched. The Bankers' Guild keeps the books (see [banking](economy-and-exchanges.md#9-banking-and-the-bankers-guild)).
- **Anarchies** have no central issuer. Their "currency" is whatever traders bring; prices are quoted in credits.

## 2. Monetary policy follows government

Each government runs its currency its own way. These are modelled on real systems:

| Government | Policy | Real-world model | What traders see |
|---|---|---|---|
| **Corporate State** | Pegged 1:1 to the credit, backed by reserves the system publishes | Fully-backed stablecoins | Safe to hold; tiny spreads; the peg rarely moves |
| **Democracy** | Rule-based inflation (around 2% a game-year **(to tune)**), adjusted to the system's growth | Central banks | Steady, slowly losing value |
| **Confederacy** | **Fixed supply**: new issuance halves on a schedule until it stops (or real Bitcoin itself: [section 6b](#6b-bitcoin-against-the-witchspace-universe-mark-26-october-2026)) | Bitcoin | Volatile but scarce; holders gain as the economy grows |
| **Communist** | Official fixed rate set by the state, with exchange limits per visit | Capital controls | A cheap official rate you can only use a little, and a black-market rate in nearby anarchies |
| **Dictatorship** | Prints currency to cover spending, more so in a crisis | Inflationary fiat | Spend it, don't save it; hyperinflation is possible |
| **Feudal** | Pegged by an algorithm that mints or burns to defend the peg, without full reserves | Algorithmic stablecoins (such as TerraUSD) | Works until it doesn't; a big enough sell-off breaks the peg and it spirals |
| **Multi-government** | A basket of its neighbours' currencies | Currency baskets | Smooth, but drags with its neighbours |

Policy is public. Every system's rules, supply and reserves can be read at any station or on the galaxy map, so a crash is never a hidden trick, only a risk that someone ignored.

## 3. Supply: minting and burning

The money supply follows what actually happens in the system:

- **Minted** as the system produces: a share of its productivity (from the system's generated data) each game-day, plus policy issuance (section 2).
- **Burned** through station fees, fines, taxes and repairs, and when a station buys back its own currency to defend a peg.
- **Shocks:** blockades, raids and incursions cut production, so less is minted and confidence falls. Booms do the opposite. Market events from [economy and exchanges](economy-and-exchanges.md#7-market-events) feed straight in.

Every mint and burn is recorded in the ledger (section 7), so total supply is always known.

## 4. Exchanges

### Automated market makers

Every station runs a **liquidity pool** between its local currency and credits, priced by the **constant-product rule** used by Uniswap:

> local × credits = k

- **Price** is the ratio of the two balances. Buying local currency pushes its price up; selling pushes it down.
- **Slippage:** a large trade moves the price against you, so moving big money takes several trades, several stations, or patience.
- **Fees:** each swap pays a small fee (around 0.3% **(to tune)**) into the pool.
- **Arbitrage** between stations and systems keeps rates roughly in line, and is a real way to earn.

### Providing liquidity

- Commanders can **add both currencies to a pool** and earn a share of its fees, as liquidity providers do in real DeFi.
- They carry the real risk: if the exchange rate moves, they end up with more of the currency that fell (**impermanent loss**). The station screen shows the projected loss before you commit.
- Pools in big, busy systems earn steady fees; pools in frontier systems pay more but are riskier.

### Order books

Busy stations also run the **order-book exchanges** already designed in [economy and exchanges](economy-and-exchanges.md#3-station-exchanges-multiplayer), for currencies as well as goods. The pool provides baseline liquidity; the order book gives large traders better prices.

## 5. Crises

Crises come from the rules, not from scripts:

- **Bank runs:** if a Corporate State's published reserves fall short, holders rush to redeem and the peg comes under pressure.
- **Death spirals:** a Feudal algorithmic peg that breaks mints more currency to defend itself, which pushes the price down further.
- **Hyperinflation:** a Dictatorship at war prints until its currency is near worthless; prices in its stations soar.
- **Speculative attacks:** a guild can bet against a weak peg. The [manipulation rules](economy-and-exchanges.md#8-fair-play-and-manipulation) (position limits, public data) keep this a contest, not a certainty.
- **Recovery:** systems can recover. A new government policy, a relief convoy or a calm period lets confidence return.

News of a crisis travels like any other news ([information that travels](economy-and-exchanges.md#2-information-that-travels)), so the first commander to arrive with a full hold of a collapsing currency's goods, or a hold of credits, can do very well.

## 6. The single currency: a union with an agenda

A powerful bloc pushes **one currency for many systems**, much like the euro. Its working name is **the Meridian Compact** and its currency **the Meridian (MRD)**; both are placeholders for the community to rename. In Witchspace's story **the Compact are the antagonists**: polished, persuasive and very hard to leave.

### How it works, based on real currency unions

- **Joining has entry criteria.** A system must keep inflation, debt and deficits within the Compact's limits for a while before it's allowed in, much like the euro's convergence criteria.
- **Members give up their own policy.** Their own currency is retired at a fixed conversion rate. They can't print, devalue or set their own rates any more; the Compact decides for everyone.
- **One size fits all, badly.** The Compact sets policy for its richest core worlds. When a member is hit by its own shock (a famine, a blockade, an incursion), it can't devalue its way out the way an independent system could. Real economists call this an **asymmetric shock**, and it's where the trouble starts.
- **Benefits are real.** Members get no exchange fees between them, a stable currency, deep liquidity and preferential docking and trade. That's why systems join, and why it's tempting.
- **Bailouts come with strings.** A member in crisis is rescued, but only if it accepts Compact control of its station fees, tariffs and budgets: austerity, imposed from outside.
- **Leaving is brutal.** A system can leave, but its debts stay in Meridians while its new currency is worth far less (**redenomination risk**). Rumours of an exit trigger capital flight before it happens.
- **The ledger shows the strain.** Imbalances between strong and weak members are published (like the euro area's TARGET2 balances), so sharp traders can see which member is closest to breaking.

### Why they're the bad guys

- **Expansion by pressure.** The Compact grows by making life hard for holdouts: tariffs and docking surcharges on non-members, trade embargoes, and "assistance" offered to systems in crisis.
- **Its own enforcers.** Compact patrols escort Meridian convoys and blockade awkward systems. They're not police; attacking them is a crime only in member systems.
- **Polite, not cartoonish.** The Compact's messages are reasonable and its benefits genuine. That's what makes it effective, and what makes resisting it interesting.

### What commanders can do

- **Back the holdouts:** run supplies through Compact blockades, keep independent currencies liquid, escort convoys to free systems.
- **Bet on breakups:** speculate on which member will leave next, or against a weak member's debts.
- **Smuggle:** buy at the cheap independent rate and sell inside the union, where the Meridian is strong.
- **Work for the Compact:** escort Meridian convoys, enforce embargoes, and take Compact combat missions. Playing the antagonist is a legitimate career, with its own rewards and enemies.

### How stage 1 is built

- **The price:** the relay ([relay/](../../relay/README.md), on fly.io in Tokyo) has it from Binance; the game's server (`server/src/btc.ts`) keeps each answer 15 seconds (candles a minute) and passes it on; the exchange asks only while it's open. When nobody is trading, nothing is asked.
- **The exchange:** Bitcoin is the first row of the list. Picking it puts the real market's candles on the same chart (5 minute, 15 minute and hourly), the broker's two prices where the order book is, and a form to spend credits or sell sats. Your trades are marked on the chart.
- **The wallet:** `sats` on the commander, with the last 50 trades. It takes no hold space and survives the ship.
- **The rules:** `src/economy/bitcoin.ts`, with tests: the spread, fresh prices only, paying debts.
- **Not yet:** the 1984 look's plain price list doesn't show Bitcoin; Classic never will.

### Guardrails

- The Compact is an **NPC faction** run by the game, possibly with an AI-agent leadership as in [player-run stations](player-stations.md). Players can work for it but not take it over.
- The **Co-operative credit** and the Bankers' Guild stay neutral; the Compact can't absorb them.
- How far the Compact spreads depends on what players do, and it should never be able to take the whole galaxy.

## 6b. Bitcoin against the Witchspace universe (Mark, 26 October 2026)

*Status: **stage 1 built** (Bitcoin against credits on the exchange, 26 October 2026); the rest is Mark's idea, to think through before it's built. Reading: Saifedean Ammous, *The Bitcoin Standard*; Andreas Antonopoulos, [Bitcoin explained](https://www.youtube.com/watch?v=UlKZ83REIkA&list=PLPQwGV1aLnTthcG265_FYSaV24hFScvC0).*

Every other money in this design belongs to someone: a system's government prints it, the Compact wants to absorb it, the Co-operative issues the credit. **Bitcoin belongs to nobody.** It's the same at every station, nobody can print it, and it weighs nothing. Set against 2,048 system currencies, the credit and the Compact, it's *The Bitcoin Standard* played out as a galaxy: easy money of every kind, government by government, against the one hard money.

### Why it fits

The book judges money by how well it holds value across **time**, **scale** and **space**. Space is Witchspace's whole problem: gold and platinum are cargo, they weigh a tonne, and pirates take them. Bitcoin takes **no room in the hold**, because it isn't goods, it's a balance.

### Two moneys: credits and Bitcoin

Credits stay the galaxy's everyday money and Bitcoin sits beside them. They're not the same thing.

| | Credits | Bitcoin |
|---|---|---|
| Who makes it | The Co-operative, which can print more | Nobody; 21 million coins, ever |
| Its value | Steady day to day | The live real-world price |
| Used for | Prices: fuel, ships, goods, fines | Saving, and paying in sats where it's allowed |
| Who holds it | Everyone, by default | Commanders who choose to |

**Why not make credits Bitcoin?** Two ways were considered and set aside. If credits moved with the real price, every commander's savings would swing with the market whether they chose it or not. If credits *were* Bitcoin (a fixed number of sats each), prices would be set by the game's own supply and demand and the live price would change nothing. Holding Bitcoin has to be a **choice**, and the contrast between the two moneys is the point.

**The credit could inflate, slowly** (to decide). If the Co-operative prints a little each game-year, prices in credits creep up about 2% a year: credits are safe from day to day but slowly lose value, and Bitcoin swings but can't be printed. That gives a reason to hold Bitcoin from inside the game, not only from the real market. Modern only, and slow enough to be felt over weeks, not in a session.

### Holding Bitcoin instead of credits

A commander can keep their savings in Bitcoin and hold almost no credits, the Bitcoin-standard way of living. Stations still price everything in credits, but where Bitcoin is allowed you can **pay in sats**: the station converts at the live price, less a small fee, so you never have to sell first. The bet is the real market: if the price doubles your savings double, and if it halves so do they.

### On the exchange

- **The real price.** It mirrors the live BTC price: Binance BTCUSDT, fetched by our server through [our relay in Tokyo](../../relay/README.md) (Binance refuses Cloudflare's servers) and passed on to every player. **1 Cr = 1 US dollar**, so the number on screen is the real number. A coin is about 80,000 Cr, more than half the dearest ship in the yard, so owning a whole one is a milestone.
- **A Bitcoin row at the top of every exchange:** *Bitcoin · 80,251 Cr · the same everywhere · live*. The same chart as any good, with real Bitcoin candles and your trades marked on them.
- **No price curve.** Buying furs moves a station's price; buying Bitcoin doesn't, because the station is only a broker for a market far bigger than us. You pay the live price plus a small spread.
- **Traded in sats.** A new commander with 100 Cr buys about 125,000 sats; the screen shows both: *₿ 0.00125 · 100 Cr*.
- **One price everywhere.** It's one network, so you can't profit by carrying it between systems, only by judging when to hold it.

### Elsewhere in the game

- **Zero tonnes.** It never uses hold space, cargo scans can't find it, and pirates and the Falcon can't scoop it.
- **It survives your ship.** After a claim: *Your Bitcoin is safe: the keys were in your head.*
- **Nobody can seize it, but it pays what you owe** (Mark). If you owe a fine or the insurers' excess and your credits fall short, enough of your Bitcoin is sold for you at the market price to pay it, and the game tells you: *Short of credits: sold 62,000 sats of your Bitcoin at the market price (49.3 Cr) to pay your fine.* Sell some yourself first if you'd rather choose the moment. Your Bitcoin counts towards your means, so holding it doesn't shrink a fine.
- **On the commander card:** *Bitcoin ₿ 0.0412 · 3,307 Cr · 0 t*.
- **Real news.** When the real price moves more than about 5% in a day, the news board carries it (*Bitcoin up 7%: celebrations in the anarchies*) and NPCs talk about it on the radio.

### When Bitcoin meets the system currencies

- **Dictatorships print, and their money collapses.** Their people and the traders there run to Bitcoin; the commanders who saw it coming did well.
- **Feudal pegs break.** Whoever held Bitcoin instead of the pegged coin is left standing.
- **Communist states ban it,** because it gets around their exchange controls: you can hold it there but not trade it, and smuggling sats out becomes a career.
- **Confederacies run on it.** The table in section 2 gives them a fixed-supply coin modelled on Bitcoin; with this idea it becomes the real thing, as El Salvador did. The Confederacies are the Bitcoin-standard systems.
- **Anarchies trade it freely,** with the thinnest spreads and no questions; corporate states charge fees.
- **The Compact hates it most.** Bitcoin is the reason no system *needs* the Meridian, so Bitcoin against the Compact becomes the galaxy's central story: Compact members tax it, Compact patrols hunt the smugglers, holdout systems adopt it.
- **Later:** a pirate can't scoop your sats, but can demand them as ransom when you surrender; anarchies pay bounties in sats.

### The same everywhere: a yardstick (Mark)

Jump to a new system and its money is different: a new name, a new rate, a policy you have to read. **Bitcoin stays Bitcoin.** A sat at Lave is a sat at Riedquat, so it's the one measure a commander can carry across the galaxy and know where they are.

- **Prices in sats, as an option.** Any price can be shown in sats beside the local price: *Fuel 14 LVR · 2,100 sats*. A commander who thinks in sats compares systems at a glance, whatever their currencies are doing.
- **Your worth in one number.** The commander card can total everything you hold (credits, local currencies, cargo, ship) in sats as well as credits.
- **Reading a crisis.** When a currency is collapsing, its price in sats shows it plainly: what cost 2,000 sats last week costs 3,500 today.

### Stablecoins: the other way out (Mark, 26 October 2026)

When a real currency collapses (Argentina, Turkey, Lebanon), most people don't run to Bitcoin first. They run to **dollar stablecoins**. The galaxy works the same way: systems and their people want **stablecoins**, coins pegged 1:1 to the credit by an issuer who promises to hold the reserves. Section 2 already has two kinds (Corporate States' fully backed coins, Feudal worlds' algorithmic pegs); here they become the everyday escape from a failing system currency.

**A real choice when a system's money fails:**

| | Stablecoin | Bitcoin |
|---|---|---|
| Value | Steady, 1 Cr | The live real-world price |
| The risk | The issuer: its reserves, or a freeze | Only the price |
| Can someone freeze it? | Yes: the issuer can blacklist a wallet, as real issuers do | No |

**Pegged to the credit.** The credit is the galaxy's dollar (on the exchange 1 Cr = 1 US dollar), so systems peg their stablecoins to it as real issuers peg to the dollar. Not everyone does: Compact members peg to the Meridian, multi-government systems to a basket of their neighbours, and systems that won't peg let their money float or use Bitcoin outright.

**Three ways to hold the peg**, as in the real world:

| Backed by | Real-world model | Who issues it | How it breaks |
|---|---|---|---|
| **Credits in reserve**, one for every coin | USDT, USDC | Corporate States: safe and dull | The issuer quietly holds less than it says, and the published reserves show it |
| **Bitcoin locked up**, about 150% of every coin | DAI | Confederacies and the companies: no bank needed | A real Bitcoin fall forces loans to be sold off to keep the backing; a fast crash can outrun the sales |
| **An algorithm**, nothing else | TerraUSD | Feudal worlds (section 2) | Confidence goes and it spirals to zero |

The Bitcoin-backed kind ties the real price into the galaxy a second way: a real crash sets off forced sales in-game, and commanders who watch them can profit.

**Who issues them:** Corporate States; the big companies (a new line of business for them, see [companies and contracts](companies-and-contracts.md)); player stations, later; and the Compact, whose Meridian starts life as "just a stablecoin", which is how it draws systems in before anyone notices they've joined.

**The real market tests them.** An issuer's reserves can be partly **held in Bitcoin**, as some real issuers' are. Reserves are published on the ledger (section 7), so:

- **A real Bitcoin crash** pushes an issuer's reserves below what it owes. Commanders who read the reserves see it first and sell, or bet on the break.
- **The run.** The coin slips below 1 Cr, the news board carries it, and the system's economy shakes. Nobody scripted it: the real market did.
- **A real rally** does the reverse: over-backed issuers grow bold and lend more, which sets up the next crisis.
- **Freezes.** An issuer can freeze the wallets of commanders it doesn't like (smugglers, Compact enemies). Bitcoin can't be frozen; that's the trade.

### Guardrails

- **In-game only.** It's the real price, not real money: in-game Bitcoin can't be bought, sold or withdrawn for real coins or cash. The screen says so (*Live price from Binance · in-game only · not real money*). Nothing here is financial advice.
- **Fair fills.** Each trade fills at a price fetched at that moment, with a small spread, so watching Binance gains nothing.
- **Stale means stopped.** If the price is more than a few minutes old, trading pauses: *The network is quiet: price 6 minutes old, trading paused.*
- **Modern only.** Classic stays credits only, as in 1984.

### Building it in steps

1. **Bitcoin against credits** (built): the exchange row and chart, buying and selling in sats, the wallet on the commander card, surviving death, debts paid from it when credits fall short.
2. **Paying in sats,** spreads and bans by government, the news headlines.
3. **The system currencies** (section 10), **with stablecoins from day one**: Corporate State coins with published reserves, some held in Bitcoin, so a real crash can test them. Bitcoin and stablecoins become the two ways out of every crisis, prices can be shown in sats, and the Confederacies run on Bitcoin.
4. **The Compact:** the Meridian starting as a stablecoin, frozen wallets, Bitcoin against the Meridian, ransoms and bounties in sats.
5. **Shared galaxy:** paying other commanders in sats (escorts, wingmen's shares, bounties on players, contracts held until the job's done).

### Open questions

- **Credit inflation:** yes or no, and how fast.
- **Custody:** only ever in your own wallet, or can the Bankers' Guild hold it for you, and can a guild fail with your coins in it?
- **Stablecoin reserves:** how much of an issuer's reserves can be Bitcoin, and whether players can see every issuer's reserves or only those of systems they've visited.
- **Real-world swings:** a real bull run makes holders rich without flying; a real crash halves their savings. That's the point, but it ties in-game wealth to the outside world.

## 7. A ledger anyone can check

The server is in charge, but it proves its honesty with the same cryptography blockchains use, without needing a blockchain:

- **Hash-chained ledgers.** Each system's ledger is a chain of blocks of transactions, each block containing the hash of the one before. Changing any past entry breaks every hash after it.
- **Published Merkle roots.** The server publishes each block's Merkle root and each system's total supply. Anyone can confirm that their own transaction is included, and that supply matches the minting and burning rules.
- **Signed transactions.** Each commander has a key pair; transfers are signed, so the server can't forge a transfer from your wallet.
- **Open tools.** A small open-source verifier, part of the repository, checks the published chain.

The ledger keeps the double-entry, append-only and invariant rules already in the [economy design](economy-and-exchanges.md#the-ledger-multiplayer).

## 8. What it looks like in play

- **Docked:** prices show in the local currency, with the credit equivalent alongside. A **Currency** tab shows the exchange rate, pool depth, your balances, and the system's policy, supply and reserves.
- **Galaxy map:** a currency overlay colours systems by strength or volatility, with the last known rates and how old that news is.
- **Fuel and essentials:** you can always pay for fuel, repairs and docking in credits at a fair rate, so no commander is ever stranded by a currency they don't hold.

## 9. Classic and single-player

- **Classic** stays as in 1984: credits only.
- **Single-player Modern** can have system currencies with NPC traders providing the market, as a way to learn the system before the shared galaxy. Its ledger lives in the browser, like the rest of the commander.

## 10. Building it in stages

| Stage | What |
|---|---|
| **Single-player** | Generated currencies, government policies, minting and burning, one constant-product pool per station, the Currency tab |
| **Shared galaxy** | Server ledger with hash chains, published Merkle roots and signed transactions; player liquidity provision; order books |
| **Later** | Currency crises driven by player activity, futures on currencies, guild treasuries, the Meridian Compact |

---

## Open questions

- **Exact numbers:** inflation rates, halving schedules, pool fees and peg rules, to be tuned in play.
- **Naming:** how generated currency names are built, so they sound right and never clash with real currencies or other games.
- **Station scrip:** do player stations still issue their own scrip on top of system currencies, or use their system's?
- **Keys and wallets:** how commanders' keys are created and recovered without making sign-in hard.
- **Exchange limits:** how tight Communist exchange limits should be before they stop being fun.
- **The Compact:** its real name, where in the galaxy it starts, and how its leadership is run.
