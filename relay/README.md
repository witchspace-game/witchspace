# Witchspace price relay

The live Bitcoin price for the game's exchange ([design](../docs/design/system-currencies.md#6b-bitcoin-against-the-witchspace-universe-mark-26-october-2026)).

Binance refuses requests from Cloudflare's servers, where the game's server runs, so the game can't ask it directly. This tiny server runs on [fly.io](https://fly.io) in Tokyo, where Binance answers, and passes the price on.

| Path | Returns |
|---|---|
| `GET /btc` | `{"symbol":"BTCUSDT","price":80251.27,"time":…,"source":"api.binance.com"}` |
| `GET /health` | 200 when it has a price under two minutes old |
| anything else | 404 |

It only serves the price; it isn't a general forwarder. The price is kept for 15 seconds, so Binance is asked at most four times a minute however busy the game is. If Binance doesn't answer, `/btc` returns the last price it had, with its time.

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
