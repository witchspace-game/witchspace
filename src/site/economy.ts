import { BTC_REF, companyValue, fairRate } from '../economy/currencies';
import { systemAt } from '../galaxy/generate';
import { API } from '../net/account';

// The money page (/economy/): the live Bitcoin price, what a company coin is
// worth at that price, and today's rates for the example currencies, which the
// build wrote at its own time (tools/economy.ts).

const fmt = (rate: number) => (rate < 10 ? rate.toFixed(3) : Math.round(rate).toLocaleString('en-GB'));

function show(btc: number) {
  const now = Date.now();
  for (const row of document.querySelectorAll<HTMLElement>('tr[data-system]')) {
    const s = systemAt(Number(row.dataset.galaxy), Number(row.dataset.system));
    row.querySelector('[data-rate]')!.textContent = fmt(fairRate(s, now, btc));
  }
  document.querySelector('#co-value')!.textContent = `${companyValue(btc).toFixed(3)} Cr`;
}

show(BTC_REF);
void (async () => {
  try {
    const res = await fetch(`${API}/btc`, { cache: 'no-cache' });
    const { price } = (await res.json()) as { price?: number };
    if (!price) return;
    document.querySelector('#btc-price')!.textContent = `${Math.round(price).toLocaleString('en-GB')} Cr`;
    show(price);
  } catch {
    // The relay isn't answering: the page keeps the reference price.
  }
})();
