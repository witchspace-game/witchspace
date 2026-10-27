import { API, currentAccount, refresh, sessionToken } from '../net/account';
import { escapeHtml } from '../ui/escape';
import { signInBox } from './signin';
import { previewOf, STATUS, type Status, type Submission } from './submission';
import { viewer, type Viewer } from './viewer';

// The maintainers' review page (docs/design/submissions.md, "For
// maintainers"): the queue by status, one submission drawn turning with its
// note and the checks' warnings, and Accept or Send back. Signed in with the
// game's session; the server says whether this account is a maintainer.

type Reviewed = Submission & { callsign: string | null };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const queue = $('#queue');
const list = $('#list');
const one = $('#one');
const notes = $<HTMLTextAreaElement>('#notes');
const accept = $<HTMLButtonElement>('#accept');
const sendBack = $<HTMLButtonElement>('#send-back');
const decided = $('#decided');

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = sessionToken();
  const res = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong. Try again in a moment.', res.status);
  return data;
}

const ago = (t: number) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const who = (s: Reviewed) => (s.callsign ? `CMDR ${escapeHtml(s.callsign)}` : 'an author with no callsign');
const what = (s: Reviewed) => `${s.kind === 'ship' ? 'Ship' : 'Module'}${s.revises ? ', revising one in the game' : ''}`;
/** The facts about one, each kept whole when the line wraps. */
const facts = (s: Reviewed, extra: string[] = []) =>
  `<span class="review-facts">${[what(s), who(s), `version ${s.version}`, ...(s.ai ? ['AI-assisted'] : []), ...extra, ago(s.updated)].map((f) => `<span>${f}</span>`).join('')}</span>`;

// --- Who's here ---------------------------------------------------------------------------

const account = signInBox($('#account'), { why: 'For maintainers: sign in with the email on the maintainers list.', callsignWhy: 'it signs your reviews.' }, accountChanged);

async function accountChanged() {
  const signed = Boolean(currentAccount());
  $('#step-account').hidden = signed;
  let maintainer = false;
  if (signed) {
    try {
      maintainer = (await api<{ maintainer?: boolean }>('/me')).maintainer === true;
    } catch {
      maintainer = false;
    }
  }
  $('#not-maintainer').hidden = !signed || maintainer;
  queue.hidden = !maintainer;
  if (!maintainer) one.hidden = true;
  else void load();
}

// --- The queue ------------------------------------------------------------------------------

let status: Status = 'submitted';
let shown: Reviewed[] = [];

for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-status]'))
  tab.addEventListener('click', () => {
    status = tab.dataset.status as Status;
    for (const t of document.querySelectorAll('[data-status]')) t.setAttribute('aria-selected', String(t === tab));
    void load();
  });

async function load() {
  list.innerHTML = '<p class="muted">Loading…</p>';
  try {
    shown = (await api<{ submissions: Reviewed[] }>(`/submissions?status=${status}`)).submissions;
  } catch (e) {
    list.innerHTML = `<p class="send-result bad">${escapeHtml((e as Error).message)}</p>`;
    return;
  }
  const empty: Record<Status, string> = { submitted: 'Nothing waiting for review.', changes: 'Nothing sent back.', accepted: 'Nothing accepted yet.', withdrawn: 'Nothing withdrawn.' };
  list.innerHTML = shown.length
    ? shown
        .map(
          (s, i) => `<button type="button" class="review-row" data-i="${i}">
      <strong>${escapeHtml(s.title)}</strong>
      ${facts(s)}
      ${s.warnings.some((w) => w.startsWith('balance:')) ? '<span class="small review-flag">Balance notes</span>' : ''}
    </button>`,
        )
        .join('')
    : `<p class="muted">${empty[status]}</p>`;
}

list.addEventListener('click', (e) => {
  const row = (e.target as Element).closest<HTMLElement>('[data-i]');
  if (row) void openOne(shown[Number(row.dataset.i)].id);
});

// --- One submission ---------------------------------------------------------------------------

let current: Reviewed | null = null;
let view: Viewer | null | undefined;
let armed = false;

$('#back').addEventListener('click', () => {
  one.hidden = true;
  queue.hidden = false;
  void load();
});

async function openOne(id: string) {
  queue.hidden = true;
  one.hidden = false;
  $('#one-head').innerHTML = '<p class="muted">Loading…</p>';
  $('#one-body').innerHTML = '';
  decided.textContent = '';
  window.scrollTo({ top: one.getBoundingClientRect().top + scrollY - 90, behavior: 'instant' });
  try {
    current = (await api<{ submission: Reviewed }>(`/submissions/${encodeURIComponent(id)}`)).submission;
  } catch (e) {
    $('#one-head').innerHTML = `<p class="send-result bad">${escapeHtml((e as Error).message)}</p>`;
    return;
  }
  showOne(current);
}

function showOne(s: Reviewed) {
  $('#one-head').innerHTML = `<h3>${escapeHtml(s.title)}</h3>
    ${facts(s, [STATUS[s.status], ...(s.via === 'connector' ? ['through the Build connector'] : [])])}`;

  const balance = s.warnings.filter((w) => w.startsWith('balance:')).map((w) => w.replace(/^balance:\s*/, ''));
  // The homage rule is said to everyone; the rest are about this file.
  const others = s.warnings.filter((w) => !/^(balance|homage):/.test(w));
  const ul = (items: string[]) => `<ul class="warnings">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
  $('#one-body').innerHTML =
    `<h4>The author's note</h4>${s.note.trim() ? `<blockquote class="review-note">${escapeHtml(s.note)}</blockquote>` : '<p class="muted">No note.</p>'}` +
    (others.length ? `<h4>Worth a look</h4>${ul(others)}` : '') +
    (balance.length ? `<h4>Balance, against the fleet</h4>${ul(balance)}` : '') +
    (s.review ? `<h4>Your notes${s.status === 'changes' ? ', sent back' : ''}</h4><blockquote class="review-note">${escapeHtml(s.review)}</blockquote>` : '') +
    (s.pr ? `<p><a class="button small" href="${escapeHtml(s.pr)}" target="_blank" rel="noopener">Its pull request</a></p>` : '');

  $('#file').textContent = s.file ? JSON.stringify(s.file, null, 2) : '';
  draw(s);

  $('#decide').hidden = s.status !== 'submitted';
  notes.value = '';
  disarm();
  sendBack.disabled = true;
}

function draw(s: Reviewed) {
  const def = s.file ? previewOf(s.kind, s.file) : null;
  const note = $('#preview-note');
  $('#preview').classList.toggle('live', false);
  note.hidden = true;
  if (!def) return;
  if (view === undefined) {
    try {
      view = viewer($<HTMLCanvasElement>('#preview-canvas'));
    } catch {
      view = null;
    }
  }
  if (!view) {
    note.hidden = false;
    note.textContent = 'This browser can’t draw it: the file is below.';
    return;
  }
  $('#preview').classList.add('live');
  try {
    view.show(def);
  } catch {
    $('#preview').classList.remove('live');
  }
}

// --- Deciding ---------------------------------------------------------------------------------

notes.addEventListener('input', () => (sendBack.disabled = !notes.value.trim()));

function disarm() {
  armed = false;
  accept.textContent = 'Accept';
  $('#decide-hint').textContent = 'Accepting opens a public pull request in the repository. Sending back needs notes.';
}

accept.addEventListener('click', () => {
  if (!armed) {
    armed = true;
    accept.textContent = 'Accept: open its pull request';
    $('#decide-hint').textContent = 'Tap again to accept. Its pull request is public, with your notes in it.';
    return;
  }
  void decide('accept');
});
sendBack.addEventListener('click', () => void decide('changes'));

async function decide(decision: 'accept' | 'changes') {
  if (!current) return;
  accept.disabled = sendBack.disabled = true;
  decided.className = 'send-result';
  decided.textContent = decision === 'accept' ? 'Accepting…' : 'Sending it back…';
  try {
    const note = notes.value.trim();
    const { submission } = await api<{ submission: Reviewed }>(`/submissions/${encodeURIComponent(current.id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, ...(note ? { notes: note } : {}) }),
    });
    current = { ...current, ...submission, file: submission.file ?? current.file, callsign: submission.callsign ?? current.callsign };
    showOne(current);
    decided.className = 'send-result good';
    decided.textContent =
      decision === 'changes'
        ? 'Sent back. The author has your notes.'
        : current.pr
          ? 'Accepted, and its pull request is open.'
          : 'Accepted. The pull request wasn’t opened automatically, so open it by hand.';
  } catch (e) {
    const err = e as ApiError;
    decided.className = 'send-result bad';
    decided.textContent =
      err.status === 409
        ? 'It’s already been decided, or withdrawn. Go back to the list to see where it stands.'
        : err.status === 502
          ? `GitHub refused the pull request: ${err.message}`
          : err.message;
  } finally {
    accept.disabled = false;
    sendBack.disabled = !notes.value.trim();
    disarm();
  }
}

account.render();
void refresh().then(() => {
  account.render();
  void accountChanged();
});
