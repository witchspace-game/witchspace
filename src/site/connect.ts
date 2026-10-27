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

/** Nothing to answer: no request, or it's gone. Signing in still shows your connected assistants. */
function gone(why: string, then = START_AGAIN) {
  request = null;
  ask.innerHTML = `<h3>${escapeHtml(why)}</h3><p>${then}</p>`;
  stepAnswer.hidden = true;
  stepAccount.hidden = false;
  stepAccount.querySelector('.step-n')?.remove();
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

// --- The assistants already connected, to disconnect ---------------------------------

interface Connection {
  client: string;
  name: string;
  uri: string | null;
  until: number;
}

const connections = $('#connections');
const connectionList = $('#connection-list');

async function loadConnections() {
  if (!currentAccount()) {
    connections.hidden = true;
    return;
  }
  try {
    const res = await fetch(`${API}/me/connections`, { headers: headers(), cache: 'no-store' });
    if (!res.ok) throw new Error();
    showConnections(((await res.json()) as { connections: Connection[] }).connections);
  } catch {
    connections.hidden = false;
    connectionList.innerHTML = `<p class="form-error">We couldn't load your connected assistants. Try again in a moment.</p>`;
  }
}

function showConnections(list: Connection[]) {
  connections.hidden = false;
  if (!list.length) {
    connectionList.innerHTML = `<p class="muted">None yet. ${request ? 'Allow this one and it will be listed here.' : ''}</p>`;
    return;
  }
  const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  connectionList.innerHTML = `<ul class="connection-list">${list
    .map((c) => {
      const host = hostOf(c.uri);
      return `<li><div><b>${escapeHtml(c.name)}</b>${host ? ` <span class="muted">(${escapeHtml(host)})</span>` : ''}<br /><small class="muted">Signed in until ${day(c.until)}, unless you disconnect it</small></div>
        <button type="button" class="button small ghost" data-disconnect="${escapeHtml(c.client)}">Disconnect</button></li>`;
    })
    .join('')}</ul>`;
  for (const b of connectionList.querySelectorAll<HTMLButtonElement>('[data-disconnect]'))
    b.addEventListener('click', async () => {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Press again to disconnect';
        setTimeout(() => {
          b.classList.remove('armed');
          b.textContent = 'Disconnect';
        }, 4000);
        return;
      }
      b.disabled = true;
      const res = await fetch(`${API}/me/connections?client=${encodeURIComponent(b.dataset.disconnect!)}`, { method: 'DELETE', headers: headers() }).catch(() => null);
      if (!res?.ok) {
        b.disabled = false;
        b.textContent = "Couldn't disconnect: try again";
        return;
      }
      void loadConnections();
    });
}

const account = signInBox($('#account'), { why: 'Your assistant works as you, under your callsign.', callsignWhy: 'what your assistant hands in is credited to it, here and in the game.' }, () => {
  render();
  void loadConnections();
});

async function load() {
  if (!id)
    return gone(
      'Connect from your assistant',
      'Add the Witchspace connector in your AI assistant (its address is <code>https://space.witchspace.org.uk/mcp/build</code>), and it brings you here to say yes. Signed in, this page also lists the assistants you have connected, to disconnect any of them.',
    );
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
    void loadConnections();
    return load();
  });
