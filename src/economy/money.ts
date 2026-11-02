// Your wallet of system currencies, and changing money at a station
// (docs/design/system-currencies.md). Balances take no hold space and survive
// the ship, like Bitcoin. Swaps go through the station's pool for its own money;
// any other system's money can be changed for credits too, at its fair rate less
// a fee. Every swap goes in the ledger, so the server can check it too.

import type { Commander } from '../game/commander';
import { record } from '../game/ledger';
import type { StarSystem } from '../galaxy/generate';
import { BTC_REF, companyKey, companyValue, currencyOf, fairRate, isCompanyKey, OFFICIAL_LIMIT, poolNow, positionNow, quoteBuy, quoteSell, STATIONS_WIDE_FEE, awayValue, walletHome, walletKey, type Pool, type Position } from './currencies';

export interface FxState {
  pools: Record<string, Pool>;
  /** Liquidity you've provided, by station's money. */
  lp?: Record<string, Position>;
  /** How much was changed at an official-rate station this visit. */
  visit?: { key: string; at: number; changed: number };
}

export type FxResult = { ok: true; message: string } | { ok: false; message: string };

const tenth = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 });

export const walletOf = (c: Commander) => (c.wallet ??= {});
const fxOf = (c: Commander): FxState => (c.fx ??= { pools: {} });

/** The station's pool for its own money, as it stands now. */
export function poolHere(c: Commander, s: StarSystem, now: number, btc = BTC_REF): Pool {
  return poolNow(s, fxOf(c).pools[walletKey(s)], now, btc);
}

/** What's left of an official-rate station's limit this visit, in credits. */
export function officialLeft(c: Commander, s: StarSystem, dockedAt: number): number {
  if (currencyOf(s)?.policy !== 'official') return Infinity;
  const v = fxOf(c).visit;
  return v && v.key === walletKey(s) && v.at === dockedAt ? Math.max(0, OFFICIAL_LIMIT - v.changed) : OFFICIAL_LIMIT;
}

function noteOfficial(c: Commander, s: StarSystem, dockedAt: number, credits: number) {
  if (currencyOf(s)?.policy !== 'official') return;
  const fx = fxOf(c);
  const v = fx.visit && fx.visit.key === walletKey(s) && fx.visit.at === dockedAt ? fx.visit : { key: walletKey(s), at: dockedAt, changed: 0 };
  fx.visit = { ...v, changed: v.changed + credits };
}

/** Spend credits on the local money. */
export function buyLocal(c: Commander, s: StarSystem, credits: number, now: number, dockedAt: number, btc = BTC_REF): FxResult {
  const cur = currencyOf(s);
  if (!cur) return { ok: false, message: 'No money is issued here: everything is in credits' };
  credits = tenth(Math.min(credits, c.credits));
  if (!(credits > 0)) return { ok: false, message: 'Set how many credits to change' };
  if (credits > officialLeft(c, s, dockedAt)) return { ok: false, message: `The state lets you change ${fmt(officialLeft(c, s, dockedAt))} Cr more this visit` };
  const pool = poolHere(c, s, now, btc);
  const units = quoteBuy(pool, credits);
  fxOf(c).pools[walletKey(s)] = { local: pool.local - units, credits: pool.credits + credits, updated: now };
  c.credits = tenth(c.credits - credits);
  const w = walletOf(c);
  w[walletKey(s)] = (w[walletKey(s)] ?? 0) + units;
  noteOfficial(c, s, dockedAt, credits);
  record(c, { t: now, k: 'fx', d: -credits, g: walletKey(s), q: units, s: [s.galaxy, s.index] });
  return { ok: true, message: `Changed ${fmt(credits)} Cr for ${fmt(units)} ${cur.ticker}` };
}

/** Sell local money back for credits, at its own system's station. */
export function sellLocal(c: Commander, s: StarSystem, units: number, now: number, dockedAt: number, btc = BTC_REF): FxResult {
  const cur = currencyOf(s);
  const w = walletOf(c);
  const key = walletKey(s);
  if (!cur) return { ok: false, message: 'No money is issued here' };
  units = Math.min(units, w[key] ?? 0);
  if (!(units > 0)) return { ok: false, message: `You have no ${cur.ticker}` };
  const pool = poolHere(c, s, now, btc);
  const credits = tenth(quoteSell(pool, units));
  if (credits > officialLeft(c, s, dockedAt)) return { ok: false, message: `The state lets you change ${fmt(officialLeft(c, s, dockedAt))} Cr more this visit` };
  fxOf(c).pools[key] = { local: pool.local + units, credits: pool.credits - credits, updated: now };
  w[key] -= units;
  if (w[key] < 1e-6) delete w[key];
  c.credits = tenth(c.credits + credits);
  noteOfficial(c, s, dockedAt, credits);
  record(c, { t: now, k: 'fx', d: credits, g: key, q: -units, s: [s.galaxy, s.index] });
  return { ok: true, message: `Changed ${fmt(units)} ${cur.ticker} for ${fmt(credits)} Cr` };
}

/** Change another system's money for credits here, at its fair rate less the fee for changing it away from home. */
export function changeAway(c: Commander, here: StarSystem, key: string, units: number, now: number, btc = BTC_REF): FxResult {
  const home = walletHome(key);
  const cur = currencyOf(home);
  const w = walletOf(c);
  if (!cur || isCompanyKey(key)) return { ok: false, message: 'Not a money that can be changed here' };
  units = Math.min(units, w[key] ?? 0);
  if (!(units > 0)) return { ok: false, message: `You have no ${cur.ticker}` };
  const credits = tenth(awayValue(home, units, now, btc));
  w[key] -= units;
  if (w[key] < 1e-6) delete w[key];
  c.credits = tenth(c.credits + credits);
  record(c, { t: now, k: 'fx', d: credits, g: key, q: -units, s: [here.galaxy, here.index] });
  return { ok: true, message: `Changed ${fmt(units)} ${cur.ticker} for ${fmt(credits)} Cr` };
}

/** What a balance is worth in credits, at the rate you'd get for it here (or its fair rate, away from home). */
export function valueOf(key: string, units: number, now: number, btc = BTC_REF): number {
  if (isCompanyKey(key)) return units * companyValue(btc);
  return units / fairRate(walletHome(key), now, btc);
}

/**
 * Company stablecoins and providing liquidity are hidden for now (Mark, 31 October
 * 2026): anything a commander still holds in them is paid back in credits, at what
 * it's worth today. Returns what was paid, or 0.
 */
export function settleHidden(c: Commander, here: StarSystem, now: number, btc = BTC_REF): number {
  let paid = 0;
  const w = walletOf(c);
  for (const key of Object.keys(w).filter(isCompanyKey)) {
    const credits = tenth(w[key] * companyValue(btc));
    record(c, { t: now, k: 'fx', d: credits, g: key, q: -w[key], s: [here.galaxy, here.index] });
    delete w[key];
    paid += credits;
  }
  const lp = c.fx?.lp;
  for (const [key, p] of Object.entries(lp ?? {})) {
    // As withdrawing and then changing the money half for credits, so the ledger reads the same as if you had.
    const home = walletHome(key);
    const pos = positionNow(home, p, now, btc);
    const credits = tenth(pos.credits + pos.fees);
    const local = tenth(pos.local / fairRate(home, now, btc));
    record(c, { t: now, k: 'lp', d: credits, g: key, q: pos.local, s: [here.galaxy, here.index] });
    record(c, { t: now, k: 'fx', d: local, g: key, q: -pos.local, s: [here.galaxy, here.index] });
    delete lp![key];
    paid += credits + local;
  }
  if (paid) c.credits = tenth(c.credits + paid);
  return paid;
}

// --- Company stablecoins (hidden for now) --------------------------------------------------------------

/** Mint a company's coins: a credit each, and the network's fee. */
export function mintCompany(c: Commander, company: string, credits: number, now: number, here: StarSystem): FxResult {
  credits = tenth(Math.min(credits, c.credits));
  if (!(credits > 0)) return { ok: false, message: 'Set how many credits to change' };
  const coins = credits * (1 - STATIONS_WIDE_FEE);
  const w = walletOf(c);
  w[companyKey(company)] = (w[companyKey(company)] ?? 0) + coins;
  c.credits = tenth(c.credits - credits);
  record(c, { t: now, k: 'fx', d: -credits, g: companyKey(company), q: coins, s: [here.galaxy, here.index] });
  return { ok: true, message: `Minted ${fmt(coins)} coins for ${fmt(credits)} Cr` };
}

/** Redeem company coins for credits, at a credit each while the Bitcoin behind them covers it. */
export function redeemCompany(c: Commander, company: string, coins: number, now: number, here: StarSystem, btc = BTC_REF): FxResult {
  const w = walletOf(c);
  const key = companyKey(company);
  coins = Math.min(coins, w[key] ?? 0);
  if (!(coins > 0)) return { ok: false, message: 'You have none of their coins' };
  const credits = tenth(coins * companyValue(btc) * (1 - STATIONS_WIDE_FEE));
  w[key] -= coins;
  if (w[key] < 1e-6) delete w[key];
  c.credits = tenth(c.credits + credits);
  record(c, { t: now, k: 'fx', d: credits, g: key, q: -coins, s: [here.galaxy, here.index] });
  return { ok: true, message: `Redeemed ${fmt(coins)} coins for ${fmt(credits)} Cr` };
}

// --- Providing liquidity (hidden for now) --------------------------------------------------------------

/** Put credits and the matching local money into this station's pool. One position per station. */
export function addLiquidity(c: Commander, s: StarSystem, credits: number, now: number, btc = BTC_REF): FxResult {
  const cur = currencyOf(s);
  if (!cur) return { ok: false, message: 'No pool here: no money is issued' };
  const key = walletKey(s);
  const fx = fxOf(c);
  if (fx.lp?.[key]) return { ok: false, message: 'You already provide liquidity here: withdraw first to change it' };
  const price = 1 / fairRate(s, now, btc);
  const local = credits / price;
  const w = walletOf(c);
  credits = tenth(credits);
  if (!(credits > 0)) return { ok: false, message: 'Set how many credits to put in' };
  if (credits > c.credits) return { ok: false, message: 'Not enough credits' };
  if ((w[key] ?? 0) < local) return { ok: false, message: `That needs ${fmt(local)} ${cur.ticker} as well: you have ${fmt(w[key] ?? 0)}` };
  c.credits = tenth(c.credits - credits);
  w[key] -= local;
  if (w[key] < 1e-6) delete w[key];
  fx.lp = { ...(fx.lp ?? {}), [key]: { k: local * credits, price, credits, added: now } };
  record(c, { t: now, k: 'lp', d: -credits, g: key, q: -local, s: [s.galaxy, s.index] });
  return { ok: true, message: `Added ${fmt(credits)} Cr and ${fmt(local)} ${cur.ticker} to the pool` };
}

/** Take your share back out, with the fees it earned. */
export function withdrawLiquidity(c: Commander, s: StarSystem, now: number, btc = BTC_REF): FxResult {
  const key = walletKey(s);
  const fx = fxOf(c);
  const p = fx.lp?.[key];
  const cur = currencyOf(s);
  if (!p || !cur) return { ok: false, message: 'You provide no liquidity here' };
  const out = positionNow(s, p, now, btc);
  const credits = tenth(out.credits + out.fees);
  delete fx.lp![key];
  const w = walletOf(c);
  w[key] = (w[key] ?? 0) + out.local;
  c.credits = tenth(c.credits + credits);
  record(c, { t: now, k: 'lp', d: credits, g: key, q: out.local, s: [s.galaxy, s.index] });
  return { ok: true, message: `Withdrew ${fmt(credits)} Cr (fees ${fmt(out.fees)} Cr included) and ${fmt(out.local)} ${cur.ticker}` };
}
