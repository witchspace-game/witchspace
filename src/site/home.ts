// The home page's small touches: the neo-vector / 1984 comparison slider,
// and sections that fade in as you scroll to them.

const compare = document.querySelector<HTMLElement>('#compare');
const range = compare?.querySelector<HTMLInputElement>('input[type=range]');
if (compare && range) {
  const set = () => compare.style.setProperty('--pos', `${range.value}%`);
  range.addEventListener('input', set);
  set();
}

// Only animate if the reader hasn't asked for less motion; without this
// script everything is simply visible.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const items = document.querySelectorAll<HTMLElement>('.section-head, .now-card, .ladder, .card, .mini a, .compare, .fly .trailer');
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        seen.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of items) {
    el.classList.add('reveal');
    seen.observe(el);
  }
}
