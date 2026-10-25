// Videos on the Witchspace YouTube channel, played from there: YouTube streams
// them free at any scale. Until a visitor presses play, the page shows our own
// poster and makes no contact with YouTube at all (no cookies, nothing sent);
// then the privacy-enhanced player replaces it.

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-embed]')) {
  button.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = button.dataset.embed!;
    frame.title = button.getAttribute('aria-label')?.replace(/^Play /, '') ?? 'Video';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.className = button.className;
    button.replaceWith(frame);
  });
}
