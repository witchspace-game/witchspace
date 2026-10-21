# Design: economy and exchanges

*Status: **proposal**. Section 1 (living markets) and a simple form of section 2 (news that travels) are intended for the **trading and galaxy** milestone. Everything else needs multiplayer and comes later. Please discuss in GitHub Discussions before building.*

## The goal

Witchspace's economy should feel like a **real market**: prices that rise and fall with what people actually do, news that's sometimes out of date, speculation, bubbles, crashes and currency crises. All of it happens **inside the game**.

## Principles

1. **In-game only.** Credits, system currencies, scrip, contracts and shares are virtual and exist only in Witchspace. They can be modelled on real cryptocurrencies, but nothing can be bought, sold or withdrawn for real money. (See [no pay-to-win](player-stations.md#no-pay-to-win) for why.)
2. **Server-authoritative.** The game server runs every exchange and ledger. That's simpler, faster and far harder to cheat than a distributed ledger, and a central server is needed for fair combat and trade anyway.
3. **Earned by playing.** Every credit in the economy came from trading, mining, bounties, missions or contribution.
4. **Drama comes from information.** In the original Elite, the thrill of trading was knowing something others didn't. We keep that: prices are local, and knowledge of them travels.

---

## 1. Living markets (trading milestone)

Each station has a market for the classic commodity list: food, textiles, radioactives, slaves, liquor and wines, luxuries, narcotics, computers, machinery, alloys, firearms, furs, minerals, gold, platinum, gem-stones and alien items. Illegal goods are marked as such.

- **Production and consumption** depend on the system's **economy** (industrial ↔ agricultural), **tech level** and **government**. Agricultural worlds produce food and want machinery; industrial worlds the reverse.
- **Prices respond to supply and demand.** Sell twenty tonnes of computers and the price drops for the next seller; the market then recovers over time as the station consumes or produces.
- **Stock is finite.** A station can run out, and a rival who arrived first may have bought the lot.
- **Market size follows the world.** A populous world's stations trade far more than a frontier outpost's (see [stations and worlds](stations-and-worlds.md)).
- **Classic rules** use simpler 1984-style markets: prices set by the system's economy plus a little random variation each visit, with no lasting effects from your trades.

## 2. Information that travels

Prices are known **locally and immediately**, but everywhere else they're **news**, and news takes time to arrive.

- **Price reports age.** The galaxy map shows the last known prices for other systems, with **how old the information is**. Prices may have moved by the time you get there.
- **News travels with ships.** Reports spread as ships, both NPC and player, jump between systems, so busy trade routes are well informed and remote systems are a gamble.
- **News feeds** (an upgrade, or a service at stations) give fresher information for a fee.
- **Rumours** can be wrong, out of date or deliberately false, from pirates trying to lure traders or traders trying to scare off rivals.
- **Fresh information is valuable.** Players can sell or share it; guilds can run their own news networks.

*For the trading milestone:* aged price reports and news spreading with NPC traffic. The rest comes with multiplayer.

## 3. Station exchanges (multiplayer)

Busy stations run an **exchange with an order book** instead of a single posted price.

- **Bids and asks.** Place an order to buy or sell at your price; it fills when someone matches it. Traders can sell to each other through the exchange, not just to the station.
- **Market makers.** The station itself and **AI-agent traders** provide basic liquidity so markets work even when few players are around.
- **Fees** are set by the station within legal bounds, and are a station's main income (which investors share; see [player stations](player-stations.md#9-investing-in-stations-with-trading-profits)).

## 4. Currencies and station scrip (multiplayer)

*Expanded into a currency for every system, modelled on real cryptocurrencies: see [system currencies](system-currencies.md).*

- **The Co-operative credit** is the galaxy's common currency, accepted everywhere.
- **Station scrip:** player and community stations may issue their **own local currency**, used for fees, local goods and services, sometimes at a discount to attract business.
- **Exchange rates** between scrip and credits float on the exchanges.
  - A well-run station's scrip can become a **safe haven**.
  - A badly run one that issues too much **inflates**, and holders lose out.
  - Players can **speculate** on currencies, and **currency crises** happen naturally.
- **Guardrails:** scrip issuance is visible to everyone and limited by the station's real reserves and revenue, so a station can mismanage its currency but not conjure unlimited wealth.

## 5. Contracts and futures (multiplayer)

- **Delivery contracts:** agree today to deliver 50 tonnes of computers to Lave within a week at a fixed price. Buyers lock in supply; haulers lock in income.
- **Collateral** is held by the exchange. **Fail to deliver** and you lose the collateral and the counterparty is compensated. Unpaid shortfalls become **debt** (see [law and travel](law-and-travel.md#7-losing-your-ship-insurance-loans-and-loan-sharks)), with everything that follows.
- **Hiring commanders:** a trader who wants more volume than one ship can carry doesn't need a bot. They post haulage jobs, such as "carry 20 tonnes of furs from Zaonce to Lave, 400 Cr on delivery", and other commanders take them on. The cargo and the fee are held in escrow until delivery (section 9). This turns a big trader into an employer and gives newer commanders paid work from their first flight. Haulers build a public delivery record, so reliable ones can charge more, while anyone who runs off with a cargo loses the escrowed value and gets a record of their own. Escort jobs follow naturally: hire another commander to fly alongside a valuable run.
- **Futures** on commodity prices let speculators bet on where prices are heading.
- **Piracy meets finance.** A contract hauler's cargo is a target, and someone who has bet against the delivery has a reason to hire pirates. Cargo insurance becomes a product of its own.

## 6. Station shares (multiplayer)

- Investments in station development funds become **tradeable shares**.
- **Share prices reflect a station's fortunes:** traffic, fees, security, management.
- **Dividends** are paid from fee income, in credits.
- **Shares don't buy control.** Policy influence stays capped, as in the [stations proposal](player-stations.md#9-investing-in-stations-with-trading-profits). Shares carry economic rights, not votes on fees, docking or bounties.

## 7. Market events

Booms, crashes, famines, plagues, embargoes, strikes, mining strikes and Thargoid incursions:

- **Some are caused by players**: a pirate blockade starves a system of food; a guild corners the gold market.
- **Some are scripted events**, which are ideal community content: a schema-validated event file describing triggers, effects and news headlines.
- **Some come from AI-agent stations** pursuing their own agendas.

## 8. Fair play and manipulation

Real markets have rules against manipulation, and ours need them too:

- **Position and order limits** so no single commander or guild can corner a market instantly.
- **Wash-trading detection:** trading with yourself, or with your own other accounts, to fake volume or prices.
- **Bot and multi-account rules**, with detection on the server. **Proposed:** in single-player, automate whatever you like; it's your game. In the shared galaxy, unattended automation (a script or browser agent trading while nobody is at the keyboard) isn't allowed, because it would flood shared markets and drown out people who are playing. Assistive tools with a human present (price lookups, route planners, the community's own trading tools) are welcome. Unattended automation could have a sanctioned home later, such as NPC trading companies a commander owns and pays to run, so it costs in-game resources instead of just running free. Meanwhile the social version already scales: pay other commanders to do the runs (section 5).
- **Real-money trading is banned and enforced.** Selling credits, scrip or items for real money breaks the rules and leads to account action. The economy only works if everything in it was earned in play.
- **Public data:** exchange history and station finances are visible, so manipulation leaves a trail.

## 9. Banking and the Bankers' Guild

### Who looks after your money

**The Bankers' Guild** is a neutral, galaxy-wide institution, like the [Co-operative Marshals](law-and-travel.md#9-power-and-protection) but for money. Your credits sit in a Guild account, **safe whatever happens to your ship**: as in the original, losing a ship never costs you your bank balance (cargo and equipment are another matter).

The Guild:

- **holds accounts** for every commander;
- **lends** (the lawful lender in [law and travel](law-and-travel.md#7-losing-your-ship-insurance-loans-and-loan-sharks); the working name *Merrow & Daughters* could become a Guild bank, or the Guild itself), keeps **credit ratings** and underwrites **insurance**;
- **holds escrow** for delivery contracts and settles them, so traders can deal safely with strangers (section 5);
- **transfers credits between players**, for a small fee, with limits that make laundering and real-money trading hard;
- **clears station scrip** against the Co-operative credit (section 4).

**Its reach has limits.** The Guild has no branches in anarchies, which is exactly where the loan sharks thrive. Commanders who live outside the law may prefer to keep their wealth where the Guild can't freeze it, and accept the risks that come with that.

### Player banking

Players lending to players is fun but a classic route to scams and pyramid schemes. If allowed, it goes **through Guild-backed contracts**: escrowed collateral, public records and fixed terms. A player banker can go bust, but can't simply disappear with everyone's money.

### The ledger (multiplayer)

In single-player, your commander, credits included, is saved in your own browser. In multiplayer, **the server holds the ledger** and never trusts a player's browser with money. It is built like a real bank's books:

- **Double-entry:** every transfer is recorded as matching debit and credit entries, so money moves but is never created or destroyed by accident.
- **An append-only transaction history** for every account, which can't be edited after the fact.
- **Invariant checks:** the total credits in the economy change only through defined sources (trading income, bounties, missions) and sinks (fees, fines, repairs, purchases), and are reconciled regularly.
- **Atomic transactions:** a trade or transfer completes entirely or not at all, so duplication bugs and crashes can't mint money.
- **Audit and anomaly detection** for unusual flows (possible exploits, bots or real-money trading).

## 10. Phasing

| Phase | What |
|---|---|
| **Trading and galaxy milestone** | Living markets with supply and demand, finite stock, aged price reports, news spreading with NPC traffic; Classic-style markets for Classic rules |
| **Multiplayer** | Order-book exchanges, market makers, player-to-player trading, delivery contracts |
| **Later** | Station scrip and currency exchange, futures, station shares, player-driven market events, the Bankers' Guild's full services and player banking |

## Open questions

- How fast should markets recover after big trades? Fast feels forgiving; slow makes trade routes contested.
- How fresh should paid news feeds be, and who provides them: stations, guilds, AI agents?
- Should station scrip exist at all, or is one galaxy-wide credit enough?
- How should contract disputes be handled, and by whom?
- What limits stop a large guild dominating an exchange without stifling ambitious traders?
- Should the Bankers' Guild be one institution, or several competing banks under Guild rules?
