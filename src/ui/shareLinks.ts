// The pieces of sharing that the site's share sheet (src/site/share.ts) and
// the game's (src/ui/shareSheet.ts) have in common: the icons, the places a
// link can go, and copying to the clipboard. No side effects, so either can
// import it.

const icon = (path: string, filled = true) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${path}</svg>`;

export const ICONS = {
  whatsapp: icon('<path d="M12.04 2a9.9 9.9 0 0 0-8.51 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm0 18.06a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.06.8.82-2.98-.2-.31a8.14 8.14 0 1 1 6.87 3.8Zm4.46-6.1c-.24-.12-1.44-.71-1.66-.8-.22-.08-.39-.12-.55.13-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.96-1.21a7.34 7.34 0 0 1-1.36-1.68c-.14-.24-.02-.38.11-.5.11-.11.24-.28.37-.42.12-.14.16-.24.24-.4.08-.17.04-.31-.02-.43-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z"/>'),
  x: icon('<path d="M18.25 2.5h3.29l-7.19 8.22L22.8 21.9h-6.63l-5.19-6.79-5.94 6.79H1.75l7.69-8.79L1.33 2.5h6.8l4.7 6.2 5.42-6.2Zm-1.16 17.52h1.83L7.14 4.37H5.18l11.91 15.65Z"/>'),
  bluesky: icon('<path d="M5.2 3.6C7.6 5.4 10.2 9 11.2 11c1-2 3.6-5.6 6-7.4 1.7-1.3 4.6-2.3 4.6.9 0 .6-.4 5.4-.6 6.2-.8 2.7-3.6 3.4-6.1 3 4.3.7 5.4 3.2 3 5.6-4.5 4.6-6.5-1.2-7-2.7-.1-.3-.1-.4-.1-.3 0-.1 0 0-.1.3-.5 1.5-2.5 7.3-7 2.7-2.4-2.4-1.3-4.9 3-5.6-2.5.4-5.3-.3-6.1-3C.8 9.9.4 5.1.4 4.5c0-3.2 2.8-2.2 4.6-.9Z"/>'),
  reddit: icon('<path d="M22 12.1a2.2 2.2 0 0 0-3.7-1.6 10.7 10.7 0 0 0-5.8-1.8l1-4.6 3.2.7a1.6 1.6 0 1 0 .2-.9l-3.6-.8a.5.5 0 0 0-.6.4l-1.1 5.2a10.8 10.8 0 0 0-5.9 1.8A2.2 2.2 0 1 0 3.3 14a4.2 4.2 0 0 0 0 .7c0 3.4 3.9 6.1 8.7 6.1s8.7-2.7 8.7-6.1a4.2 4.2 0 0 0 0-.7 2.2 2.2 0 0 0 1.3-1.9ZM7 13.6a1.6 1.6 0 1 1 1.6 1.6A1.6 1.6 0 0 1 7 13.6Zm9 4.2a5.8 5.8 0 0 1-4 1.2 5.8 5.8 0 0 1-4-1.2.4.4 0 0 1 .6-.6 4.9 4.9 0 0 0 3.4 1 4.9 4.9 0 0 0 3.4-1 .4.4 0 0 1 .6.6Zm-.3-2.6a1.6 1.6 0 1 1 1.6-1.6 1.6 1.6 0 0 1-1.6 1.6Z"/>'),
  facebook: icon('<path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.09 0 2.23.2 2.23.2v2.46H15.2c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z"/>'),
  email: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', false),
  link: icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', false),
  share: icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4"/>', false),
  close: icon('<path d="M6 6l12 12M18 6 6 18"/>', false),
};

/** Our account on X: every post shared to X ends "via @witchspace_game", so we see it and can thank them (Mark). */
export const X_HANDLE = 'witchspace_game';
/**
 * What X counts: the text, a space, the link (always 23, as t.co) and " via @witchspace_game". The text
 * is cut to fit 280, with an ellipsis, so the post can always be sent as it opens.
 */
export const X_TEXT_MAX = 280 - 1 - 23 - ` via @${X_HANDLE}`.length;
export const forX = (text: string) => ([...text].length <= X_TEXT_MAX ? text : `${[...text].slice(0, X_TEXT_MAX - 1).join('').trimEnd()}…`);

/** Where a link can be shared: each a web address that opens a ready-made post. */
export function destinations(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`],
    ['x', 'X', `https://twitter.com/intent/tweet?text=${encodeURIComponent(forX(text))}&url=${u}&via=${X_HANDLE}`],
    ['bluesky', 'Bluesky', `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`],
    ['reddit', 'Reddit', `https://www.reddit.com/submit?url=${u}&title=${t}`],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['email', 'Email', `mailto:?subject=${t}&body=${encodeURIComponent(`${text}\n${url}`)}`],
  ] as const;
}

/** Copy text, with a fallback for browsers without the async clipboard. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      ta.remove();
    }
  }
}
