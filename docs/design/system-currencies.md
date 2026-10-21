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
| **Confederacy** | **Fixed supply**: new issuance halves on a schedule until it stops | Bitcoin | Volatile but scarce; holders gain as the economy grows |
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

### Guardrails

- The Compact is an **NPC faction** run by the game, possibly with an AI-agent leadership as in [player-run stations](player-stations.md). Players can work for it but not take it over.
- The **Co-operative credit** and the Bankers' Guild stay neutral; the Compact can't absorb them.
- How far the Compact spreads depends on what players do, and it should never be able to take the whole galaxy.

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
