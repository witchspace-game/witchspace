import { currentAccount, requestLink, setCallsign, signInWithCode, signOut } from '../net/account';
import { escapeHtml } from '../ui/escape';

// Signing in on a site page with the game's account: email a code, type it in,
// choose a callsign if there isn't one. /submit/ and /connect/ both use it.

const TURNSTILE_SITE_KEY = import.meta.env.DEV ? '' : '0x4AAAAAAFfP1CB8aXita2o_';
declare const turnstile: { render: (el: HTMLElement, opts: Record<string, unknown>) => string } | undefined;

export interface SignIn {
  /** Draw the box for how things stand now (after a refresh, say). */
  render(): void;
}

export function signInBox(
  box: HTMLElement,
  words: {
    /** Under the email form: what signing in is for here. */
    why: string;
    /** After "Choose your callsign:", what it's used for here. */
    callsignWhy: string;
  },
  /** Called whenever the account changes: signed in, callsign chosen, signed out. */
  changed: () => void,
): SignIn {
  let sentTo = '';
  let turnstileToken = '';

  function render() {
    const a = currentAccount();
    if (!a) {
      box.innerHTML = sentTo
        ? `<p>We've emailed a code to <b>${escapeHtml(sentTo)}</b>. Type it here (or open the link in the email, then come back to this page).</p>
          <form class="inline-form" id="code-form"><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" aria-label="Sign-in code" required /><button type="submit" class="button primary small">Sign in</button></form>
          <p class="small"><button type="button" class="link" id="again">Use a different email</button></p>`
        : `<p class="muted">The same account as the game: no password, we email you a code. ${words.why}</p>
          <form class="inline-form" id="email-form"><input type="email" required placeholder="you@example.com" autocomplete="email" aria-label="Email" /><button type="submit" class="button primary small">Email me a code</button></form>
          <div class="turnstile" id="signin-check"></div>
          <p class="small"><a href="/privacy/">How we use your email</a></p>`;
    } else if (!a.callsign) {
      box.innerHTML = `<p>Signed in as ${escapeHtml(a.email)}. Choose your callsign: ${words.callsignWhy}</p>
        <form class="inline-form" id="callsign-form"><input maxlength="24" required placeholder="Your callsign" aria-label="Callsign" /><button type="submit" class="button primary small">Claim it</button></form>`;
    } else {
      box.innerHTML = `<p class="signed-in">Signed in as <b>CMDR ${escapeHtml(a.callsign)}</b> <span class="muted">(${escapeHtml(a.email)})</span> · <button type="button" class="link" id="sign-out">Sign out</button></p>`;
    }
    wire();
  }

  function say(text: string) {
    const p = document.createElement('p');
    p.className = 'form-error';
    p.textContent = text;
    box.querySelector('.form-error')?.remove();
    box.append(p);
  }

  function wire() {
    box.querySelector('#email-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      const email = f.querySelector('input')!.value.trim();
      f.querySelector('button')!.disabled = true;
      try {
        const r = await requestLink(email, turnstileToken);
        sentTo = email;
        render();
        if (r.devCode) say(`Development: the code is ${r.devCode}`);
      } catch (err) {
        say((err as Error).message);
        f.querySelector('button')!.disabled = false;
      }
    });
    box.querySelector('#code-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = (e.target as HTMLFormElement).querySelector('input')!.value.replace(/\D/g, '');
      try {
        await signInWithCode(sentTo, code);
        sentTo = '';
        render();
        changed();
      } catch (err) {
        say((err as Error).message);
      }
    });
    box.querySelector('#again')?.addEventListener('click', () => {
      sentTo = '';
      render();
    });
    box.querySelector('#callsign-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await setCallsign((e.target as HTMLFormElement).querySelector('input')!.value);
        render();
        changed();
      } catch (err) {
        say((err as Error).message);
      }
    });
    box.querySelector('#sign-out')?.addEventListener('click', async () => {
      await signOut().catch(() => {});
      render();
      changed();
    });
    mountTurnstile();
  }

  /** The human check on the email form. Not id="turnstile": an element's id is also a global, and would hide Turnstile's own. */
  function mountTurnstile() {
    const el = box.querySelector<HTMLElement>('#signin-check');
    if (!el || !TURNSTILE_SITE_KEY) return;
    const draw = () => {
      turnstileToken = '';
      turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, theme: 'dark', size: 'flexible', callback: (t: string) => (turnstileToken = t) });
    };
    if (typeof turnstile !== 'undefined' && typeof turnstile.render === 'function') return draw();
    (window as unknown as Record<string, unknown>).onSignInTurnstile = draw;
    if (!document.querySelector('script[data-turnstile]')) {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onSignInTurnstile&render=explicit';
      s.async = true;
      s.dataset.turnstile = '';
      document.head.append(s);
    }
  }

  return { render };
}
