# Witchspace price relay

The live Bitcoin price for the game's exchange ([design](../docs/design/system-currencies.md#6b-bitcoin-against-the-witchspace-universe-mark-26-october-2026)).

Binance refuses requests from Cloudflare's servers, where the game's server runs, so the game can't ask it directly. This tiny server runs on [fly.io](https://fly.io) in Tokyo, where Binance answers, and passes the price on.

| Path | Returns |
|---|---|
| `GET /btc` | `{"symbol":"BTCUSDT","price":80251.27,"time":…,"source":"api.binance.com"}` |
| `GET /btc/candles?interval=1h&limit=200` | `[{"t":…,"o":…,"h":…,"l":…,"c":…,"v":…}, …]`, for the exchange's chart. Intervals 1m, 5m, 15m, 1h, 4h, 1d, 1w; up to 500 candles. With `&start=<ms>`, the candles from that moment on (for judging a limit order from when it was placed) |
| `GET /health` | 200 when it has a price under two minutes old |
| anything else | 404 |

It only serves the price and its history; it isn't a general forwarder. The price is kept for 15 seconds and candles for a minute, so Binance is asked only a few times a minute however busy the game is. If Binance doesn't answer, `/btc` returns the last price it had, with its time.

## Run it locally

```bash
node server.js
curl localhost:3000/btc
```

## Deploy (the project owner)

Once, to set it up:

```bash
brew install flyctl
fly auth login
cd relay
fly launch --no-deploy --copy-config --name witchspace-relay
fly deploy --ha=false
curl https://witchspace-relay.fly.dev/btc
```

`--ha=false` keeps it to one machine. It sleeps when nobody asks and wakes in about a second, so it costs well under a dollar a month.

After a change: `cd relay && fly deploy --ha=false`.
