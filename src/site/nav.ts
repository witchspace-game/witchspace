// The phone menu: on narrow screens the bar's links don't fit, so a button
// opens them all in a sheet under the header.

const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
const menu = document.querySelector<HTMLElement>('#site-menu');

function setOpen(open: boolean) {
  if (!toggle || !menu) return;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
}

toggle?.addEventListener('click', () => setOpen(Boolean(menu?.hidden)));
menu?.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) setOpen(false);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setOpen(false);
});
