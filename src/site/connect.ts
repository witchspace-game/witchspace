import { API, currentAccount, refresh, sessionToken } from '../net/account';
import { escapeHtml } from '../ui/escape';
import { signInBox } from './signin';

// The Build connector's sign-in step (docs/design/mcp-server.md, "The connect
// page"): the server's /oauth/authorize sends the browser here with
// ?request=<id>. Say who's asking and what it may do, sign in if need be, and
// send the answer; the server says where to send the browser back to.

interface SignInRequest {
  client: { name: string; uri: string | null };
  scope: string;
  expires: number;
  callsign?: string | null;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const ask = $('#ask');
const stepAccount = $('#step-account');
const stepAnswer = $('#step-answer');
const allow = $<HTMLButtonElement>('#allow');
const deny = $<HTMLButtonElement>('#deny');
const result = $('#answer-result');
const id = new URLSearchParams(location.search).get('request') ?? '';
const START_AGAIN = 'Start again from your assistant: add or reconnect the Witchspace connector there, and it will bring you back here.';

let request: SignInRequest | null = null;
let answered = false;

const headers = () => {
  const s = sessionToken();
  return { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s}` } : {}) };
};

/** Nothing to answer: no request, or it's gone. */
function gone(why: string) {
  request = null;
  ask.innerHTML = `<h3>${escapeHtml(why)}</h3><p>${START_AGAIN}</p>`;
  stepAccount.hidden = stepAnswer.hidden = true;
}

/** The website the client gave, as a bare host, if it's an ordinary web address. */
function hostOf(uri: string | null): string | null {
  try {
    const u = new URL(uri ?? '');
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.host : null;
  } catch {
    return null;
  }
}

function render() {
  if (!request || answered) return;
  const a = currentAccount();
  const who = a?.callsign ? `CMDR ${escapeHtml(a.callsign)}` : 'you';
  const host = hostOf(request.client.uri);
  ask.innerHTML = `<p class="connect-who"><b>${escapeHtml(request.client.name)}</b> says it is an AI assistant${host ? ` <span class="muted">(its website, it says, is ${escapeHtml(host)})</span>` : ''}, and asks to work for you in Witchspace.</p>
    <p>If you allow it, it may:</p>
    <ul class="connect-may">
      <li>hand in ships and Titanoboa modules as ${who}</li>
      <li>see and change the ones it handed in</li>
    </ul>
    <p class="muted">Nothing it hands in goes public until a maintainer accepts it, and you'll see it all on <a href="/submit/#mine">Hand in a design</a>. It can't see your save or anything else in your account.</p>`;
  stepAccount.hidden = false;
  stepAccount.classList.toggle('done', Boolean(a?.callsign));
  stepAnswer.hidden = false;
  allow.disabled = !a?.callsign;
  deny.disabled = !a;
  $('#answer-note').textContent = !a ? 'Sign in first, so we know who is answering.' : !a.callsign ? 'Choose a callsign first: what it hands in is credited to it.' : `Allow ${request.client.name} to hand in work as CMDR ${a.callsign}?`;
}

const account = signInBox($('#account'), { why: 'Your assistant works as you, under your callsign.', callsignWhy: "what your assistant hands in is credited to it, here and in the game." }, render);

async function load() {
  if (!id) return gone('There is nothing to connect here.');
  try {
    const res = await fetch(`${API}/oauth/request/${encodeURIComponent(id)}`, { headers: headers(), cache: 'no-store' });
    if (res.status === 404) return gone('That request has expired, or was already answered.');
    if (!res.ok) throw new Error();
    request = (await res.json()) as SignInRequest;
    render();
  } catch {
    ask.innerHTML = `<p class="form-error">We couldn't reach Witchspace to look up the request. Check your connection, then <button type="button" class="link" id="retry">try again</button>.</p>`;
    $('#retry').addEventListener('click', () => void load());
  }
}

async function answer(yes: boolean) {
  allow.disabled = deny.disabled = true;
  result.textContent = yes ? 'Allowing…' : 'Saying no…';
  try {
    const res = await fetch(`${API}/oauth/request/${encodeURIComponent(id)}`, { method: 'POST', headers: headers(), body: JSON.stringify({ allow: yes }) });
    const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
    if (res.status === 404) return gone('That request has expired, or was already answered.');
    if (!res.ok || !data.redirect) {
      result.textContent = data.error ?? 'Something went wrong. Try again in a moment.';
      // A 401 or 403 means the account changed under us: refresh and show where things stand.
      if (res.status === 401 || res.status === 403) await refresh().catch(() => {});
      account.render();
      render();
      return;
    }
    answered = true;
    const name = escapeHtml(request!.client.name);
    ask.innerHTML = yes
      ? `<h3>Connected</h3><p>Taking you back to ${name}. If nothing happens, go back to it yourself: it can now hand in work as CMDR ${escapeHtml(currentAccount()?.callsign ?? '')}.</p>`
      : `<h3>Not connected</h3><p>Taking you back to ${name}, which will be told you said no.</p>`;
    stepAccount.hidden = stepAnswer.hidden = true;
    location.href = data.redirect;
  } catch {
    result.textContent = "We couldn't reach Witchspace. Check your connection and try again.";
    render();
  }
}

allow.addEventListener('click', () => void answer(true));
deny.addEventListener('click', () => void answer(false));

account.render();
void refresh()
  .catch(() => null)
  .then(() => {
    account.render();
    return load();
  });
