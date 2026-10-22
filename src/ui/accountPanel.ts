// The account panel on the title screen (A): sign in with an email link, claim
// your callsign, and see your cloud save. When this device and your account
// disagree about your commander, it asks which to keep. The account itself is
// net/account.ts.

import { loadCommander, saveCommander, type Commander } from '../game/commander';
import * as acct from '../net/account';
import { disablePush, enablePush, getContact, needsHomeScreen, pushSupported, setEmailContact } from '../net/notify';
import { escapeHtml } from './escape';

/** Turnstile's public site key (the same widget as the ideas board). */
const TURNSTILE_SITE_KEY = import.meta.env.DEV ? '' : '0x4AAAAAAFfP1CB8aXita2o_';

export interface AccountHooks {
  flash: (text: string, seconds?: number) => void;
  /** The commander changed under us (loaded from the cloud): refresh the title. */
  commanderReplaced: () => void;
}

const panel = document.querySelector<HTMLElement>('#account-panel')!;
let hooks: AccountHooks;
let view: 'main' | 'sent' | 'choose' = 'main';
let sentTo = '';
let devLink = '';
let devCode = '';
let choice: { local: Commander; cloud: Commander; updated: number } | null = null;
let deleteArmed = false;
/** Whether the companies may contact you (loaded when the panel opens). */
let contact: { push: boolean; email: boolean } | null = null;
let turnstileToken = '';
let turnstileWidget: string | undefined;

declare const turnstile: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void } | undefined;

export const isAccountPanelOpen = () => !panel.hidden;

export function toggleAccountPanel(show = panel.hidden) {
  panel.hidden = !show;
  if (show) {
    view = choice ? 'choose' : view === 'sent' ? 'sent' : 'main';
    render();
  }
}

/** Set up on start: finish a sign-in from the link, or check an existing session, then sync. */
export async function initAccount(h: AccountHooks) {
  hooks = h;
  try {
    const fresh = await acct.completeSignInFromUrl();
    if (fresh) {
      await afterSignIn();
      toggleAccountPanel(true);
      return;
    }
    const me = await acct.refresh();
    if (me) await syncOnStart(me.saveUpdated);
  } catch (e) {
    hooks.flash((e as Error).message, 4);
  }
  updateButton();
}

/** Called after every local save. */
export function commanderSaved(c: Commander) {
  acct.queueSave(c, () => void resolveConflict());
}

/** Rename, keeping the account's callsign in step. Returns the name to use. */
export async function claimCallsign(name: string): Promise<string> {
  if (!acct.signedIn()) return name;
  return acct.setCallsign(name);
}

function updateButton() {
  const b = document.querySelector<HTMLElement>('#account-button');
  if (!b) return;
  const a = acct.currentAccount();
  b.innerHTML = `<span class="key">A · </span>${a ? `${a.callsign ? `CMDR ${escapeHtml(a.callsign)}` : 'Account'} ✓` : 'Sign in'}`;
}

// --- Keeping this device and the account in step -------------------------------------

const describe = (c: Commander) => `CMDR ${escapeHtml(c.name ?? '?')} · ${(c.credits ?? 0).toLocaleString()} Cr · ${c.kills ?? 0} kills`;

async function afterSignIn() {
  const a = acct.currentAccount()!;
  const local = loadCommander();
  const { data: cloud, updated } = await acct.fetchSave();
  if (cloud && local && JSON.stringify(cloud) !== JSON.stringify(local)) {
    choice = { local, cloud, updated: updated! };
    view = 'choose';
  } else if (cloud) {
    acct.markSynced(updated);
    saveCommander(cloud);
    hooks.commanderReplaced();
  } else if (local) {
    await acct.pushSave(local);
  }
  // Your callsign: claim the commander's name if the account hasn't one yet.
  const mine = loadCommander();
  if (!a.callsign && mine) {
    try {
      await acct.setCallsign(mine.name);
    } catch {
      // Taken: the panel asks for another.
    }
  } else if (a.callsign && mine && mine.name !== a.callsign) {
    mine.name = a.callsign;
    saveCommander(mine);
  }
  hooks.flash(`Signed in as ${a.email}`, 3);
  updateButton();
}

async function syncOnStart(serverUpdated: number | null) {
  if (!serverUpdated || serverUpdated === acct.syncedAt()) return;
  // Another device has saved since this one last synced.
  await resolveConflict();
}

async function resolveConflict() {
  const local = loadCommander();
  const { data: cloud, updated } = await acct.fetchSave();
  if (!cloud) return;
  if (!local || JSON.stringify(cloud) === JSON.stringify(local)) {
    acct.markSynced(updated);
    saveCommander(cloud);
    hooks.commanderReplaced();
    return;
  }
  choice = { local, cloud, updated: updated! };
  toggleAccountPanel(true);
}

async function choose(keep: 'local' | 'cloud') {
  if (!choice) return;
  if (keep === 'cloud') {
    acct.markSynced(choice.updated);
    saveCommander(choice.cloud);
    hooks.commanderReplaced();
  } else {
    acct.markSynced(choice.updated); // we've seen the server's version; ours replaces it
    await acct.pushSave(choice.local);
  }
  choice = null;
  view = 'main';
  hooks.flash(keep === 'cloud' ? 'Loaded your commander from your account' : 'Saved this device’s commander to your account', 3);
  render();
}

// --- The panel ----------------------------------------------------------------------

function render() {
  const a = acct.currentAccount();
  let html = '<h2>Account</h2>';
  if (view === 'choose' && choice) {
    html += `<p class="meta">This device and your account have different commanders. Which do you want to keep? The other will be replaced.</p>
      <div class="account-choice">
        <button type="button" data-choose="cloud"><b>Your account</b><span>${describe(choice.cloud)}</span></button>
        <button type="button" data-choose="local"><b>This device</b><span>${describe(choice.local)}</span></button>
      </div>`;
  } else if (!a) {
    if (view === 'sent') {
      html += `<p class="meta">Check your email: we've sent a sign-in link to <b>${escapeHtml(sentTo)}</b>. It works once, for 20 minutes.</p>
        <p class="meta">Playing from your Home Screen? The link opens in your browser instead, so type the code from the email here:</p>
        <form class="code-form"><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" aria-label="Sign-in code" /> <button type="submit" class="primary">Sign in</button></form>`;
      if (devLink) html += `<p class="meta">Development: <a href="${escapeHtml(devLink)}">open the sign-in link</a> or use code ${escapeHtml(devCode)}</p>`;
      html += `<p><button type="button" data-again>Use a different email</button></p>`;
    } else {
      html += `<p class="meta">Sign in to keep your callsign, and carry on from any device. No password: we email you a link.</p>
        <form class="account-form"><input type="email" required placeholder="you@example.com" autocomplete="email" aria-label="Email" value="${escapeHtml(lastEmail())}" />
        <div class="turnstile"></div><button type="submit" class="primary">Email me a link</button></form>`;
    }
    html += `<p class="small"><a href="/privacy/" target="_blank" rel="noopener">How we use your email</a></p>`;
  } else {
    html += `<dl><dt>Signed in</dt><dd>${escapeHtml(a.email)}</dd><dt>Callsign</dt><dd>${a.callsign ? `CMDR ${escapeHtml(a.callsign)}` : '<i>not claimed yet</i>'}</dd><dt>Cloud save</dt><dd>${acct.syncedAt() ? 'On: your commander saves to your account' : 'Waiting for your first save'}</dd></dl>`;
    if (!a.callsign) html += `<form class="callsign-form"><input maxlength="24" placeholder="Your callsign" aria-label="Callsign" /> <button type="submit">Claim</button></form>`;
    html += contactSection();
    html += `<p class="account-actions"><button type="button" data-signout>Sign out</button> <button type="button" data-delete class="${deleteArmed ? 'danger' : ''}">${deleteArmed ? 'Press again to delete everything' : 'Delete account'}</button></p>`;
  }
  html += `<p class="account-close"><button type="button" data-close>Close</button><span class="small muted">or press Esc or A</span></p>`;
  panel.innerHTML = html;
  wire();
}

function wire() {
  panel.querySelector('.account-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = panel.querySelector<HTMLInputElement>('.account-form input')!.value.trim();
    const button = panel.querySelector<HTMLButtonElement>('.account-form button')!;
    button.disabled = true;
    try {
      const r = await acct.requestLink(email, turnstileToken);
      sentTo = email;
      rememberEmail(email);
      devLink = r.devLink ?? '';
      devCode = r.devCode ?? '';
      view = 'sent';
      render();
    } catch (err) {
      hooks.flash((err as Error).message, 3);
      button.disabled = false;
    }
  });
  panel.querySelector('.code-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = panel.querySelector<HTMLInputElement>('.code-form input')!.value.replace(/\D/g, '');
    try {
      await acct.signInWithCode(sentTo, code);
      view = 'main';
      await afterSignIn();
      render();
    } catch (err) {
      hooks.flash((err as Error).message, 3);
    }
  });
  panel.querySelector('[data-close]')?.addEventListener('click', () => toggleAccountPanel(false));
  panel.querySelector('[data-again]')?.addEventListener('click', () => {
    view = 'main';
    render();
  });
  for (const b of panel.querySelectorAll<HTMLButtonElement>('[data-choose]')) b.addEventListener('click', () => void choose(b.dataset.choose as 'local' | 'cloud'));
  panel.querySelector('.callsign-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = await acct.setCallsign(panel.querySelector<HTMLInputElement>('.callsign-form input')!.value);
      const c = loadCommander();
      if (c) {
        c.name = name;
        saveCommander(c);
        hooks.commanderReplaced();
      }
      updateButton();
      render();
    } catch (err) {
      hooks.flash((err as Error).message, 3);
    }
  });
  panel.querySelector<HTMLInputElement>('[data-contact="push"]')?.addEventListener('change', async (e) => {
    const box = e.target as HTMLInputElement;
    box.disabled = true;
    try {
      if (box.checked) await enablePush();
      else await disablePush();
      contact = { email: contact?.email ?? false, push: box.checked };
      hooks.flash(box.checked ? 'The companies can reach you on this device' : 'No more notifications', 3);
    } catch (err) {
      hooks.flash((err as Error).message, 4);
    }
    render();
  });
  panel.querySelector<HTMLInputElement>('[data-contact="email"]')?.addEventListener('change', async (e) => {
    const box = e.target as HTMLInputElement;
    try {
      contact = await setEmailContact(box.checked);
    } catch (err) {
      hooks.flash((err as Error).message, 4);
    }
    render();
  });
  panel.querySelector('[data-signout]')?.addEventListener('click', async () => {
    await acct.signOut();
    contact = null;
    hooks.flash('Signed out. Your commander stays on this device.', 3);
    updateButton();
    render();
  });
  panel.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!deleteArmed) {
      deleteArmed = true;
      render();
      return;
    }
    deleteArmed = false;
    try {
      await acct.deleteAccount();
      hooks.flash('Account deleted. Your commander stays on this device.', 4);
    } catch (err) {
      hooks.flash((err as Error).message, 3);
    }
    updateButton();
    render();
  });
  mountTurnstile();
}

/**
 * Let the trading companies get in touch when a special assignment is
 * waiting (Modern rules): a notification on this device, or an email.
 */
function contactSection(): string {
  if (!contact) {
    void getContact()
      .then((c) => {
        contact = c;
        if (!panel.hidden) render();
      })
      .catch(() => {});
    return '';
  }
  const pushNote = needsHomeScreen()
    ? 'On iPhone: add Witchspace to your Home Screen (Share, then Add to Home Screen), open it from there, and switch this on.'
    : pushSupported()
      ? 'A notification on this device.'
      : 'This browser can’t show notifications.';
  return `<h3>Let the companies contact me</h3>
    <p class="meta">When Hexon Holdings or the others have a special assignment for you, they'll get in touch. At most a couple of times a week, and always in character.</p>
    <label class="contact-option"><input type="checkbox" data-contact="push" ${contact.push ? 'checked' : ''} ${pushSupported() || contact.push ? '' : 'disabled'} /> Notifications <small>${pushNote}</small></label>
    <label class="contact-option"><input type="checkbox" data-contact="email" ${contact.email ? 'checked' : ''} /> Email <small>To your sign-in address, with a one-click stop.</small></label>`;
}

// The last email you signed in with on this device, so you needn't type it again.
const LAST_EMAIL = 'witchspace.lastEmail';
function lastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL) ?? '';
  } catch {
    return '';
  }
}
function rememberEmail(email: string) {
  try {
    localStorage.setItem(LAST_EMAIL, email);
  } catch {
    // Storage blocked: type it next time.
  }
}

/** The human check on the email form, when it's showing. */
function mountTurnstile() {
  const el = panel.querySelector<HTMLElement>('.account-form .turnstile');
  if (!el || !TURNSTILE_SITE_KEY) return;
  const draw = () => {
    if (turnstileWidget !== undefined) turnstile?.remove(turnstileWidget);
    turnstileToken = '';
    turnstileWidget = turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, theme: 'dark', size: 'flexible', callback: (t: string) => (turnstileToken = t) });
  };
  if (typeof turnstile !== 'undefined') return draw();
  (window as unknown as Record<string, unknown>).onAccountTurnstile = draw;
  if (!document.querySelector('script[data-turnstile]')) {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onAccountTurnstile&render=explicit';
    s.async = true;
    s.dataset.turnstile = '';
    document.head.append(s);
  }
}
