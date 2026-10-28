// System currencies, stage one (docs/design/system-currencies.md): every system
// but an anarchy has its own money, generated from its seed, and runs it the way
// its government would. Each station keeps a liquidity pool between its money
// and the credit (local × credits = k, as Uniswap does), so a big swap moves the
// rate, and the pool drifts back to the fair rate as other traders arbitrage.
// Stablecoins (Corporate States' fully backed coins, Feudal worlds' algorithmic
// ones) are taken at any station at their rate: the way out when a system's
// money fails, until an algorithmic peg breaks. Virtual only, Modern only.

import { distanceLy, systemAt, systemsWithin, type StarSystem } from '../galaxy/generate';
import { hash } from './seed';

export type Policy = 'none' | 'feudal' | 'basket' | 'printing' | 'official' | 'scarce' | 'inflation' | 'reserve';

/** By government, as the design sets out (0 = Anarchy … 7 = Corporate State). */
const POLICY: Policy[] = ['none', 'feudal', 'basket', 'printing', 'official', 'scarce', 'inflation', 'reserve'];

export const POLICY_TEXT: Record<Policy, { name: string; line: string }> = {
  none: { name: 'No currency', line: 'Nobody issues money here: prices are in credits, or whatever you bring.' },
  reserve: { name: 'Stablecoin, backed by reserves', line: 'Pegged 1:1 to the credit, backed by reserves the system publishes, partly in Bitcoin. Safe while the reserves cover every coin; taken at any station.' },
  feudal: { name: 'Algorithmic stablecoin', line: 'Pegged to the credit by an algorithm that mints or burns to hold the peg, with no reserves behind it. Taken at any station, while it holds. When it breaks, it spirals, and re-pegs lower: the loss stays.' },
  inflation: { name: 'Managed inflation', line: 'A central bank lets it lose about two per cent a month, steadily. Fine to spend, poor to save.' },
  printing: { name: 'Printed to order', line: 'The government prints what it spends, faster in a crisis. Spend it, don’t save it.' },
  official: { name: 'Official rate', line: 'The state fixes the rate, and limits how much each visitor may change.' },
  scarce: { name: 'Runs on Bitcoin', line: 'Fixed supply, and reckoned in Bitcoin: it rises and falls with the real Bitcoin price, and gains as the economy grows.' },
  basket: { name: 'Basket of neighbours', line: 'Tied to a basket of its neighbours’ money: smooth, but it drags when they do.' },
};

/** Real currency codes a generated one must never take. */
const REAL = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'NZD', 'INR', 'RUB', 'BRL', 'ZAR', 'MXN', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY', 'KRW', 'SGD', 'HKD', 'ARS', 'LBP', 'BTC', 'ETH', 'XRP', 'SOL', 'DOT', 'ADA', 'DAI', 'CR']);
const ENDINGS = ['ar', 'el', 'on', 'ix', 'a', 'eth', 'um', 'ene'];

export interface Currency {
  ticker: string;
  name: string;
  policy: Policy;
  /** Taken at any station at its rate: the stablecoins. */
  stable: boolean;
  /** Units a credit buys at the start: 1 for the pegged ones. */
  base: number;
}

export const STATIONS_WIDE_FEE = 0.003;
export const POOL_FEE = 0.003;
/** How much a Communist station lets one visitor change in a visit, in credits. */
export const OFFICIAL_LIMIT = 2_000;

const galaxies = new Map<number, (Currency | null)[]>();

function generate(s: StarSystem, taken: Set<string>): Currency | null {
  const policy = POLICY[s.government];
  if (policy === 'none') return null;
  const stem = s.name.replace(/[aeiou]+$/i, '');
  const name = stem.charAt(0).toUpperCase() + stem.slice(1).toLowerCase() + ENDINGS[Math.floor(hash(s, 61, 0) * ENDINGS.length)];
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  const consonants = letters[0] + letters.slice(1).replace(/[AEIOU]/g, '');
  let ticker = (consonants + letters).slice(0, 3);
  // Never a real currency's code, and never another system's in the same galaxy.
  for (let i = 1; (REAL.has(ticker) || taken.has(ticker)) && i < 26 * 26; i++)
    ticker = ticker[0] + String.fromCharCode(65 + Math.floor(i / 26) % 26) + String.fromCharCode(65 + (i % 26));
  taken.add(ticker);
  const pegged = policy === 'reserve' || policy === 'feudal';
  const scale = [1, 4, 25, 180, 1200][Math.floor(hash(s, 62, 0) * 5)];
  const base = pegged ? 1 : Math.round(scale * (0.6 + hash(s, 63, 0) * 0.8) * 100) / 100;
  return { ticker, name, policy, stable: pegged, base };
}

/** A system's money, or null for an anarchy (credits only). */
export function currencyOf(s: StarSystem): Currency | null {
  let all = galaxies.get(s.galaxy);
  if (!all) {
    const taken = new Set<string>();
    all = Array.from({ length: 256 }, (_, i) => generate(systemAt(s.galaxy, i), taken));
    galaxies.set(s.galaxy, all);
  }
  return all[s.index];
}

/** Where a balance in the wallet is kept: by the system that issues it. */
export const walletKey = (s: StarSystem) => `${s.galaxy}:${s.index}`;
export const walletHome = (key: string) => {
  const [g, i] = key.split(':').map(Number);
  return systemAt(g, i);
};

// --- The fair rate --------------------------------------------------------------------

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** Smooth noise in [-1, 1] at a period, from the seed: the same for everyone. */
function smooth(s: StarSystem, salt: number, t: number, period: number): number {
  const x = t / period;
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(s, salt, i) * 2 - 1;
  const b = hash(s, salt, i + 1) * 2 - 1;
  const e = f * f * (3 - 2 * f);
  return a + (b - a) * e;
}

/**
 * A crisis, if one is on: 0 calm, up to 1 at its worst. Each system's month has a
 * chance of one, starting on a seeded day, rising over two days, holding a day,
 * and easing over three as a new policy or a relief convoy restores confidence.
 */
export function crisis(s: StarSystem, t: number, chance: number): number {
  const month = Math.floor(t / (30 * DAY));
  if (hash(s, 64, month) >= chance) return 0;
  const start = month * 30 * DAY + hash(s, 65, month) * 24 * DAY;
  const d = (t - start) / DAY;
  if (d < 0 || d > 6) return 0;
  if (d < 2) return (d / 2) ** 2;
  if (d < 3) return 1;
  return 1 - (d - 3) / 3;
}

const EPOCH = Date.UTC(2026, 9, 1); // 1 October 2026: rates are reckoned from here

/**
 * How far crises have pushed a money down, as a multiplier on units per credit:
 * every crisis that's over left most of its damage behind (a collapse doesn't
 * hand the money back, or buying the bottom would be a sure thing), and one
 * that's on now spikes to `peak` before easing back to that new, lower level.
 */
function scarred(s: StarSystem, t: number, chance: number, peak: number, keep: number): number {
  const lasting = Math.pow(peak, keep);
  let level = 1;
  const month = Math.floor(t / (30 * DAY));
  for (let m = Math.floor(EPOCH / (30 * DAY)); m < month; m++) if (hash(s, 64, m) < chance) level *= lasting;
  const k = crisis(s, t, chance);
  if (!k) {
    // This month's crisis may already be over.
    const start = month * 30 * DAY + hash(s, 65, month) * 24 * DAY;
    if (hash(s, 64, month) < chance && t > start + 6 * DAY) level *= lasting;
    return level;
  }
  const start = month * 30 * DAY + hash(s, 65, month) * 24 * DAY;
  const easing = (t - start) / DAY > 3;
  // Rising (or at the worst), towards the peak; easing, from the peak down to where it will settle.
  return easing ? level * Math.exp(Math.log(lasting) + (Math.log(peak) - Math.log(lasting)) * k) : level * (1 + (peak - 1) * k);
}

/**
 * The Bitcoin price reserves are reckoned against: roughly the real price when
 * this stage was built (28 October 2026). Above it, a reserve holding Bitcoin is
 * over-backed; below it, short.
 */
export const BTC_REF = 80_000;

/** A Corporate State's reserves: the share held in Bitcoin, from the seed (a tenth to nearly half). */
export const reserveShare = (s: StarSystem) => 0.1 + hash(s, 66, 0) * 0.35;

/** How well a Corporate State's coins are backed at this Bitcoin price: 1 is fully. */
export const backing = (s: StarSystem, btc = BTC_REF) => 1 - reserveShare(s) + reserveShare(s) * (btc / BTC_REF);

/**
 * Units a credit buys, fairly, at time t: what the pools drift back to. `btc` is
 * the real Bitcoin price, where it matters (Corporate reserves, Confederacies);
 * without it, the reference price.
 */
export function fairRate(s: StarSystem, t: number, btc = BTC_REF): number {
  const c = currencyOf(s);
  if (!c) return 1;
  const weeks = (t - EPOCH) / WEEK;
  switch (c.policy) {
    case 'reserve': {
      // Holds 1:1 while the reserves cover every coin; short, and holders run for the door.
      const b = backing(s, btc);
      return (b >= 1 ? 1 : Math.pow(1 / b, 1.4)) + smooth(s, 70, t, DAY) * 0.002;
    }
    case 'feudal':
      // While it holds, steady; when it breaks, the coin falls to an eighth of its value, and re-pegs lower.
      return scarred(s, t, 0.15, 8.3, 0.85) * (1 + smooth(s, 71, t, DAY) * 0.004);
    case 'inflation':
      return c.base * Math.pow(1.02, weeks / 4.35) * (1 + smooth(s, 72, t, DAY) * 0.01);
    case 'printing':
      return c.base * Math.pow(1.03, weeks) * scarred(s, t, 0.12, 5, 0.85) * (1 + smooth(s, 73, t, 6 * 3600_000) * 0.03);
    case 'official':
      return c.base;
    case 'scarce':
      // Confederacies run on Bitcoin: their money moves with the real price, and gains as the economy grows.
      return c.base * Math.exp(-0.01 * weeks) * (BTC_REF / btc) * (1 + smooth(s, 74, t, 2 * DAY) * 0.04);
    case 'basket': {
      const ns = neighbours(s);
      if (!ns.length) return c.base;
      const drift = ns.reduce((p, n) => p * (fairRate(n, t, btc) / currencyOf(n)!.base), 1) ** (1 / ns.length);
      return c.base * drift;
    }
    default:
      return 1;
  }
}

/** The three nearest systems with a money of their own that isn't itself a basket. */
function neighbours(s: StarSystem): StarSystem[] {
  const out: StarSystem[] = [];
  const all = Array.from({ length: 256 }, (_, i) => systemAt(s.galaxy, i))
    .filter((n) => n !== s && currencyOf(n) && currencyOf(n)!.policy !== 'basket')
    .sort((a, b) => distanceLy(s, a) - distanceLy(s, b));
  for (const n of all.slice(0, 3)) out.push(n);
  return out;
}

// --- The station's pool ----------------------------------------------------------------

export interface Pool {
  /** Local units and credits in the pool. */
  local: number;
  credits: number;
  updated: number;
}

/** How deep a station's pool is, in credits: bigger worlds trade more. */
export const poolDepth = (s: StarSystem) => Math.round(40_000 * Math.sqrt(Math.max(0.1, s.population)) * (currencyOf(s)?.stable ? 6 : 1));
// (A stablecoin's pool is deep: anyone can redeem it at its peg, so traders keep the pool close to it.)
const POOL_RECOVERY_MINUTES = 60;

/** The pool as it stands now: drifted back towards the fair rate since it was last touched. */
export function poolNow(s: StarSystem, saved: Pool | undefined, t: number, btc = BTC_REF): Pool {
  const depth = poolDepth(s);
  const fair = fairRate(s, t, btc);
  if (!saved) return { local: depth * fair, credits: depth, updated: t };
  const k = 1 - Math.exp(-Math.max(0, t - saved.updated) / 60_000 / POOL_RECOVERY_MINUTES);
  const credits = saved.credits + (depth - saved.credits) * k;
  const local = saved.local + (credits * fair - saved.local) * k;
  return { local, credits, updated: t };
}

/** Units a credit buys in this pool, now. */
export const poolRate = (p: Pool) => p.local / p.credits;

/** Credits in, local out: how many units, after the fee and the slippage. */
export function quoteBuy(p: Pool, credits: number): number {
  const k = p.local * p.credits;
  return p.local - k / (p.credits + credits * (1 - POOL_FEE));
}

/** Local in, credits out. */
export function quoteSell(p: Pool, units: number): number {
  const k = p.local * p.credits;
  return p.credits - k / (p.local + units * (1 - POOL_FEE));
}

/** A stablecoin taken away from home: its rate, less the network's fee, no slippage. */
export const stableValue = (home: StarSystem, units: number, t: number, btc = BTC_REF) => (units / fairRate(home, t, btc)) * (1 - STATIONS_WIDE_FEE);

// --- News -----------------------------------------------------------------------------

export interface MoneyNews {
  where: StarSystem;
  distance: number;
  text: string;
}

/**
 * Pegs breaking and presses running in the region, as the news has reached here:
 * what was true there when the last ship left (`delay` says how long ago that was).
 */
export function moneyNews(here: StarSystem, now: number, delay: (where: StarSystem) => number, btc = BTC_REF): MoneyNews[] {
  const out: MoneyNews[] = [];
  // The companies' coins are everywhere: a slip is news everywhere.
  if (companyValue(btc) < 1) out.push({ where: here, distance: 0, text: `Company stablecoins slip to ${companyValue(btc).toFixed(2)} Cr as Bitcoin's fall outruns their backing` });
  for (const s of [here, ...systemsWithin(here, 15)]) {
    const c = currencyOf(s);
    if (!c) continue;
    const then = now - delay(s);
    if (c.policy === 'feudal' && crisis(s, then, 0.15) > 0.3)
      out.push({ where: s, distance: distanceLy(here, s), text: `${c.name} (${c.ticker}) breaks its peg: one now buys ${(1 / fairRate(s, then)).toFixed(2)} Cr` });
    else if (c.policy === 'reserve' && backing(s, btc) < 1)
      out.push({ where: s, distance: distanceLy(here, s), text: `Run on the ${c.name}: ${s.name}'s reserves cover ${Math.round(backing(s, btc) * 100)}% of its coins` });
    else if (c.policy === 'printing' && crisis(s, then, 0.12) > 0.3) out.push({ where: s, distance: distanceLy(here, s), text: `Presses running at ${s.name}: the ${c.name} is losing value by the hour` });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

// --- Company stablecoins ---------------------------------------------------------------
// The big companies issue coins of their own, backed by Bitcoin locked up at half
// as much again as the coins are worth (as DAI is): no bank needed, taken at any
// station. Minted at a credit each; redeemed at a credit while the Bitcoin covers
// them. A fast enough real crash outruns the backing, and the coin slips.

export const COLLATERAL = 1.5;

/** A company coin's backing at this Bitcoin price: 1.5 at the reference, 1 a third lower. */
export const companyBacking = (btc = BTC_REF) => COLLATERAL * (btc / BTC_REF);

/** What a company coin redeems for, in credits: 1 while covered. */
export const companyValue = (btc = BTC_REF) => Math.min(1, companyBacking(btc));

/** Wallet keys for the company coins. */
export const companyKey = (company: string) => `co:${company}`;
export const isCompanyKey = (key: string) => key.startsWith('co:');

// --- Providing liquidity -----------------------------------------------------------------
// Add both currencies to a station's pool, in step with its rate, and share in its
// fees. The real risk comes with it: if the rate moves, you come out holding more of
// whichever side fell (impermanent loss), worked out by the constant-product rule.

export interface Position {
  /** The constant product of what you put in. */
  k: number;
  /** Credits per unit when you put it in. */
  price: number;
  /** Credits you put in (half the value). */
  credits: number;
  added: number;
}

/** What the pool's traders pay its providers in fees, a year, as a share of what's in: busier worlds, a thinner share. */
export const feeYield = (s: StarSystem) => 0.08 + 0.3 / Math.sqrt(Math.max(0.5, s.population));

/** Your share now: local and credits by the constant-product rule at today's price, and the fees you've earned. */
export function positionNow(s: StarSystem, p: Position, t: number, btc = BTC_REF): { local: number; credits: number; fees: number; value: number; held: number } {
  const price = 1 / fairRate(s, t, btc);
  const local = Math.sqrt(p.k / price);
  const credits = Math.sqrt(p.k * price);
  const fees = 2 * p.credits * feeYield(s) * (Math.max(0, t - p.added) / (365 * DAY));
  const value = credits + local * price + fees;
  // What you'd have if you'd simply held what you put in.
  const held = p.credits + (p.credits / p.price) * price;
  return { local, credits, fees, value, held };
}
