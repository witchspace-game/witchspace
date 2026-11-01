import { shipById } from '../content/ships';
import { systemAt } from '../galaxy/generate';
import { systemNowHtml } from './systemNow';

// A star system's page: "right now" was written in when the site was built; work it out again for this
// moment, and keep it current while the page is open (it's the galaxy's clock, so it never stops).

const box = document.getElementById('sys-now');
const body = document.getElementById('sys-now-body');
if (box && body) {
  const system = systemAt(0, Number(box.dataset.index));
  const hullName = (id: string) => shipById(id)?.name ?? id;
  const show = () => {
    if (!document.hidden) body.innerHTML = systemNowHtml(system, Date.now(), hullName);
  };
  show();
  setInterval(show, 30_000);
  document.addEventListener('visibilitychange', show);
}
