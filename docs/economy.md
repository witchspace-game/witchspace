# How Witchspace's economy works

*A record of the economy as it's built (28 October 2026; output, supply and local prices added the same day), kept up to date as it changes (Mark: "we definitely should keep a record of how this economy works"). The design documents say why and what's next; this says what's there now, with the real numbers. Everything is virtual: no real money goes in or comes out.*

**When you change the economy, change this page in the same pull request.**

## The moneys at a glance

| Money | Where it lives | Can you lose it? | Moves with |
|---|---|---|---|
| **Credits (Cr)** | The commander | Spent, fined or spent on a deposit | Nothing: the yardstick |
| **Cargo** | The hold (or station storage) | Yes, with the ship | Each station's market |
| **Bitcoin** | The commander, no hold space | No: it can't be taken from you | The real Bitcoin market |
| **System currencies** | The wallet, no hold space | No, but they can lose their value | Their government's policy |
| **Company stablecoins** | The wallet | No | Pegged to the credit; Bitcoin backs them |
| **Liquidity positions** | One per station's pool | No, but impermanent loss | The pool's rate, plus fees |

## 1. Credits and the markets

**Classic** markets are 1984's, from the original price tables. **Modern** markets are alive (`src/economy/market.ts`):

- **Each station has its own stock and price** for every good, set by what its world makes and needs. Prices settle back towards that level with a 30-minute time constant after anyone trades.
- **Big trades move the price.** Selling a lot pushes it down as you go: what you get is worked out unit by unit (`proceedsToSell`, `costToBuy`).
- **NPC traders** haul goods between systems, and their deliveries arrive on the station's board. **World events** (crises, booms) move prices for days.
- **Shortage and surplus:** below 0.8× its usual stock a good is short, and above 1.25× it's in surplus. Stations post orders for what they're short of.
- **Danger pays:** a premium of 45% at anarchies, 32% at feudal worlds, 16% at multi-government worlds and 7% at dictatorships.
- **A floor and a ceiling:** whatever trading does, a good's price stays between 0.5× and 2.5× its undisturbed price (`priceBounds`). The server checks sales against this.

**Prices in local money.** On the exchange, every price and total also shows in the station's own money, at its pool's rate (or the fair rate, for another market on screen). You still pay in credits.

### Limit orders

- **At the station** (`src/economy/orders.ts`): name a price. Your credits (for a buy) or goods (for a sell) are held until it fills or you cancel. Orders fill **in parts**, against the market's price history: when the price reaches your limit, the market takes as much as it can without going past it, so a big order can't flatten a market in one go. Filled goods wait in station storage if your hold is full.
- **At another station** (`sendOrder`): the broker takes 2% of the order's value when it's sent, and the order arrives after the news delay (light-years away means hours). The range is 25 light years.

## 2. Bitcoin

`src/economy/bitcoin.ts`.

- **Priced from the real market.** The Worker's `/btc` relays the live price, and a quote more than 5 minutes old counts as stale.
- **Counted in satoshis** (100,000,000 to the coin). Buying or selling costs 0.1%.
- **Limit orders fill against the real price**, even while you're away. The Worker's ship's log fills them from price candles.
- **No hold space, and it can't be taken from you:** not by pirates, police or losing the ship. It's the way to keep what you've earned.

## 3. System currencies

`src/economy/currencies.ts` and `src/economy/money.ts`; the design is [system currencies](design/system-currencies.md).

**Every system but the anarchies has its own money**, generated from its seed: a name taken from the system's name, and a three-letter code that's unique in its galaxy and never a real currency's.

### Policy follows government

| Government | Policy | What happens |
|---|---|---|
| Corporate State | **Reserve** | Pegged 1:1, backed by reserves: 10–45% in Bitcoin (from the seed), the rest in credits. If Bitcoin falls so far that the reserves don't cover the coin, it slips below its peg until Bitcoin recovers. The news reports a run. |
| Feudal | **Algorithmic peg** | A stablecoin until it breaks: some months the peg fails and the coin falls to an eighth. |
| Democracy | **Inflation** | Loses about 2% a month. |
| Dictatorship | **Printing** | Loses about 3% a week, and faster when the presses run in a crisis. |
| Communist | **Official rate** | A fixed rate, and each visitor can change only 2,000 Cr a visit. |
| Confederacy | **Scarce (runs on Bitcoin)** | A fixed supply, priced in Bitcoin: it rises and falls with the real market, and each unit buys more as the economy grows. |
| Multi-government | **Basket** | Follows its three nearest neighbours. |

### Money follows what a world makes

- **Output.** World events move a world's output: a boom raises it by 25%; a famine, strike, plague, war, blockade or Thargoid incursion cuts it, by 5% to 30% (`output` in `src/economy/events.ts`, `outputAt`).
- **Floating money follows.** For inflating, printed and Bitcoin money, the same money chases fewer goods when output is down, so each unit buys less: the rate moves by 1 ÷ √output. A war's 30% cut weakens it by about a fifth, and a boom strengthens it by about a tenth. It recovers when the event ends. Pegged money holds its peg, official rates stay fixed, and basket money follows its neighbours.
- **Supply is published.** The money in circulation is the world's productivity × 1,000 × its output × its rate (`supplyOf`). The issuer mints as output grows and burns as it falls, and a printing press or a broken peg mints far more. The Money tab shows the supply, what was minted or burned in the last day, and any change in output.

**Crises leave scars.** When a peg breaks or the presses run, the money recovers over a few days, but only partly: it re-pegs lower (`scarred()`). Buying the bottom is a bet, not a sure thing.

### The pools

- **Every station has a pool for its own money**: constant product (local × credits = k), with a 0.3% fee. A big swap moves the rate against you, and the rate drifts back to fair over about an hour as other traders arbitrage.
- **Pool depth** grows with the square root of the population (40,000 × √population). A stablecoin's pool is 6× deeper, because anyone can redeem it at the peg.
- **Stablecoins** (Corporate and Feudal money) are taken at any station at their rate, less 0.3%. That's the way out when a system's money fails.

### Company stablecoins

- **Hexon Holdings, Vorg Industries, Carriers' Mutual and Wexley-Yorozu** each issue a coin, held in the wallet as `co:<company>`.
- **Backed by Bitcoin locked up at 150%** of the coins' value, like DAI.
- **Mint** at a credit each, less 0.3%. **Redeem** at any station.
- **Worth one credit** while the collateral covers it. That holds unless Bitcoin falls by a third from 80,000 Cr (to about 53,000); below that, each coin is worth what its collateral is.

### Providing liquidity

- **Put credits and the same value of local money into a station's pool**, one position per station (`addLiquidity`). You need the matching local money in your wallet.
- **You earn a share of the pool's fees.** The yield is higher at smaller stations: 8% + 30% ÷ √population a year. In galaxy one that's 20% to 42%, about 24% at a typical station.
- **Impermanent loss is real.** If the rate moves, you come out holding more of whichever side fell. The Money tab shows what the position is worth now against simply holding.
- **Withdraw any time** (`withdrawLiquidity`).

### The wallet

Balances are kept by issuing system (`"galaxy:index"`) or by company (`"co:hexon"`). They take no hold space and they survive the ship.

## 4. Honest money: the ledger and the server's checks

`src/game/ledger.ts` and `server/src/ledger.ts`.

- **Every change to your credits goes in a ledger**, as one of: `sell`, `buy`, `fill`, `back` (an order cancelled), `scoop`, `btc`, `yard`, `fx` (a currency swap), `lp` (liquidity) or `other`.
- **Each entry is hash-chained to the one before**, so an entry can't be changed or removed without breaking the chain.
- **The save carries a checksum**, so an edited save is spotted.
- **The server replays the ledger** when a save is uploaded. It checks:
  - the chain is unbroken, and the balance adds up;
  - each sale is within the good's price bounds;
  - goods didn't come from nowhere: it keeps its own count of every good bought, filled or scooped, precious goods (gems, gold, platinum) and goods by the tonne alike, and flags a sale of more than was had;
  - currency swaps only spent money you had, at a rate within bounds. Company coins are never worth more than a credit; reserve, Bitcoin and basket money get a 4× bound, because Bitcoin moves;
  - `other` credits, plus liquidity *gains* (not your stake coming back), stay under 400,000 Cr a day.
- **A flagged account** can still play, but it can't reserve a numbered edition.

## 5. Spending: the shipyard

`src/game/shipyard.ts`; the design is [ships and classes](design/ships-and-classes.md).

- **Spec a concept ship and put down a tenth** of the price. It's refundable until she's ready, and the price is held at the quote. Production takes the yard's standard time; numbered editions are finished by hand and take longer (Witch-fire 120 h, Dark Edition 168 h).
- **The price** is the hull, plus the fit-out (scaled to the hull: ×price ÷ 100,000, at least ×1), plus the finish: special colours, glow (Deep 28,000 Cr, Blazing 65,000 Cr), two-tone trim (16,000 Cr plus the colour) and luxuries.
- **On collection** you pay the balance, less a trade-in of 60% of your old hull's price and 50% of its kit's. A gifted ship has no trade-in value.
- **Repainting** at any yard: labour is 10% of the hull's price (at least 2,000 Cr, ×1.5 for Blazing), plus only what changes.
- **A spec from the website's configurator** waits at the next shipyard. The game takes the deposit; the site never touches credits.

## Where to change it

| What | File |
|---|---|
| Markets, prices, bounds | `src/economy/market.ts`, `src/economy/commodities.ts` |
| Limit and remote orders | `src/economy/orders.ts` |
| Bitcoin | `src/economy/bitcoin.ts`, `server/src/btc.ts`, `server/src/shipsLog.ts` |
| System currencies, pools, company coins, liquidity, supply | `src/economy/currencies.ts`, `src/economy/money.ts` |
| World events and output | `src/economy/events.ts` |
| The ledger and its checks | `src/game/ledger.ts`, `server/src/ledger.ts` |
| The shipyard | `src/game/shipyard.ts` |
| The Money tab and exchange screens | `src/main.ts` (`renderMoney`), `src/ui/exchange.ts` |
