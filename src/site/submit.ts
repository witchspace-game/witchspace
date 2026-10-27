import { ZONES } from '../content/modules';
import { API, currentAccount, refresh, sessionToken } from '../net/account';
import { escapeHtml } from '../ui/escape';
import { FIELDS, fromModule, kindOf, limitsLine, open, pinProblems, previewOf, readFile, STATUS, type Check, type Field, type Kind, type Limits, type Submission } from './submission';
import { signInBox } from './signin';
import { viewer, type Viewer } from './viewer';

// Hand in a design (docs/design/submissions.md): sign in with the game's email
// code, paste, upload or start from a core module, see it turn, have it checked
// by the server's own checks as you go, and hand it in. Below, everything
// you've handed in, with the reviewer's notes, to revise or withdraw.

const CHECK_DELAY = 800;
const CORE = import.meta.glob<Record<string, unknown>>('../../content/modules/*.json', { eager: true, import: 'default' });

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const form = $<HTMLFormElement>('#step-file');
const fileBox = $<HTMLTextAreaElement>('#file');
const checkBox = $('#check');
const sendButton = $<HTMLButtonElement>('#send');
const sendResult = $('#send-result');
const input = (f: Field) => form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${f}"]`)!;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: { problems?: string[] },
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
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; problems?: string[] };
  if (!res.ok) throw new ApiError(data.error ?? (res.status === 413 ? 'That file is too big: the most is 64 KB.' : 'Something went wrong. Try again in a moment.'), res.status, data);
  return data;
}

const ago = (t: number) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// --- 1. Signing in ---------------------------------------------------------------------

const account = signInBox(
  $('#account'),
  { why: 'Your design is credited to your callsign.', callsignWhy: "it's the name your design is credited to, here and in the game." },
  accountChanged,
);

function accountChanged() {
  $('#step-account').classList.toggle('done', Boolean(currentAccount()?.callsign));
  void loadMine();
}

// --- 2. The design: fields and file kept in step, a preview, checked as you go --------

let kind: Kind = new URLSearchParams(location.search).get('kind') === 'ship' ? 'ship' : 'module';
let revising: Submission | null = null;
let view: Viewer | null | undefined;
let checkTimer = 0;
let checked: { text: string; result: Check } | null = null;

const zone = input('zone') as HTMLSelectElement;
zone.insertAdjacentHTML('beforeend', ZONES.map((z) => `<option value="${z}">${z[0].toUpperCase()}${z.slice(1)}</option>`).join(''));
const core = $<HTMLSelectElement>('#core');
const cores = Object.values(CORE).sort((a, b) => String(a.name).localeCompare(String(b.name)));
core.insertAdjacentHTML('beforeend', cores.map((m) => `<option value="${escapeHtml(String(m.id))}">${escapeHtml(String(m.name))}</option>`).join(''));

function setKind(k: Kind) {
  kind = k;
  form.querySelector<HTMLInputElement>(`input[name="kind"][value="${k}"]`)!.checked = true;
  form.classList.toggle('is-ship', k === 'ship');
  $('#standard-link').textContent = k === 'module' ? 'The module standard' : 'How ship files work';
  $<HTMLAnchorElement>('#standard-link').href = k === 'module' ? '/design/ship-the-titanoboa/' : '/get-involved/';
  $('#editor-link').hidden = k !== 'ship';
}

/** Fill the fields from the file, and draw it. */
function fromText() {
  const r = readFile(fileBox.value);
  if ('file' in r) {
    for (const f of FIELDS) {
      const v = r.file[f];
      if (document.activeElement !== input(f)) input(f).value = typeof v === 'string' ? v : '';
    }
    const k = kindOf(r.file);
    if (k && k !== kind) setKind(k);
    draw(r.file);
  }
  scheduleCheck();
}

/** Write a field into the file. */
function fromField(f: Field) {
  const r = fileBox.value.trim() ? readFile(fileBox.value) : { file: {} as Record<string, unknown> };
  if (!('file' in r)) {
    showCheck({ local: r.error });
    return;
  }
  const v = input(f).value;
  if (v) r.file[f] = v;
  else delete r.file[f];
  fileBox.value = JSON.stringify(r.file, null, 2);
  scheduleCheck();
}

function draw(file: Record<string, unknown>) {
  const def = previewOf(kind, file);
  if (!def) return;
  if (view === undefined) {
    try {
      view = viewer($<HTMLCanvasElement>('#preview-canvas'));
    } catch {
      view = null; // no WebGL: no preview, and the rest works as before
      $('#preview-note').textContent = 'This browser can’t draw it, but you can still check it and hand it in.';
    }
  }
  if (!view) return;
  try {
    view.show(def);
    $('#preview').classList.add('live');
  } catch {
    // A shape the renderer can't draw yet: the checks will say why.
  }
}

function scheduleCheck() {
  clearTimeout(checkTimer);
  checkTimer = window.setTimeout(() => void runCheck(), CHECK_DELAY);
}

/** The server's own checks, without handing it in. Remembered for the text it checked. */
async function runCheck(): Promise<Check | null> {
  const text = fileBox.value;
  if (checked?.text === text) return checked.result;
  const r = readFile(text);
  if (!('file' in r)) {
    showCheck({ local: text.trim() ? r.error : '' });
    return null;
  }
  checkBox.innerHTML = '<p class="muted small">Checking…</p>';
  try {
    const result = await api<Check>('/submissions/check', { method: 'POST', body: JSON.stringify({ kind, file: r.file }) });
    if (fileBox.value !== text) return null; // changed while we asked: the next check will say
    checked = { text, result };
    showCheck({ result });
    return result;
  } catch (err) {
    const e = err as ApiError;
    showCheck({ local: e.status === 429 ? 'Lots of checks in a row: give it a minute, then change anything to check again.' : `Couldn't check it just now: ${e.message}` });
    return null;
  }
}

function showCheck(s: { result?: Check; local?: string }) {
  for (const f of FIELDS) form.querySelector(`[data-field="${f}"] .field-problem`)!.textContent = '';
  form.querySelectorAll('.has-problem').forEach((el) => el.classList.remove('has-problem'));
  if (s.local !== undefined) {
    checkBox.innerHTML = s.local ? `<p class="check-bad">${escapeHtml(s.local)}</p>` : '';
    return;
  }
  const c = s.result!;
  const { byField, rest } = pinProblems(c.problems);
  for (const [f, list] of Object.entries(byField)) {
    const label = form.querySelector(`[data-field="${f}"]`)!;
    label.classList.add('has-problem');
    label.querySelector('.field-problem')!.textContent = list.join(' ');
  }
  const warnings = c.warnings.length ? `<div class="check-notes"><p class="small">Worth a look (these don't stop it; the reviewer sees them too):</p><ul>${c.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>` : '';
  if (c.problems.length) {
    const n = c.problems.length;
    checkBox.innerHTML = `<p class="check-bad">${n === 1 ? 'One thing to fix' : `${n} things to fix`} before it can be handed in${rest.length < n ? ' (marked above)' : ''}:</p>${rest.length ? `<ul class="problems">${rest.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}${warnings}`;
  } else {
    const what = c.revises ? `an improvement to <b>${escapeHtml(c.itemId ?? '')}</b>, already in the game` : `a new ${kind}`;
    checkBox.innerHTML = `<p class="check-good">Passes the checks: <b>${escapeHtml(c.title ?? '')}</b>, ${what}.</p>${warnings}`;
  }
}

form.addEventListener('submit', (e) => e.preventDefault());
for (const r of form.querySelectorAll<HTMLInputElement>('input[name="kind"]'))
  r.addEventListener('change', () => {
    setKind(r.value as Kind);
    checked = null;
    scheduleCheck();
  });
fileBox.addEventListener('input', fromText);
for (const f of FIELDS) input(f).addEventListener('input', () => fromField(f));
core.addEventListener('change', () => document.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((b) => (b.disabled = !core.value)));
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-start]'))
  b.addEventListener('click', () => {
    const m = cores.find((c) => c.id === core.value);
    if (!m) return;
    setKind('module');
    fileBox.value = JSON.stringify(fromModule(m, b.dataset.start as 'new' | 'improve'), null, 2);
    fromText();
    input(b.dataset.start === 'new' ? 'name' : 'description').focus();
  });
$<HTMLInputElement>('#upload').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 64 * 1024) return showCheck({ local: `That file is ${Math.round(file.size / 1024)} KB: the most is 64 KB.` });
  fileBox.value = await file.text();
  fromText();
});

// --- 3. Handing it in -----------------------------------------------------------------

function setRevising(s: Submission | null) {
  revising = s;
  const banner = $('#revising');
  banner.hidden = !s;
  if (s) {
    banner.innerHTML = `Revising <b>${escapeHtml(s.title)}</b> (version ${s.version}). Handing it in makes version ${s.version + 1}. <button type="button" class="link" id="stop-revising">Start something new instead</button>`;
    $('#stop-revising').addEventListener('click', () => clearForm());
  }
  sendButton.textContent = s ? 'Hand in the new version' : 'Hand it in';
}

function clearForm() {
  setRevising(null);
  fileBox.value = '';
  for (const f of FIELDS) input(f).value = '';
  $<HTMLTextAreaElement>('#note').value = '';
  document.querySelectorAll<HTMLInputElement>('input[name="ai"]').forEach((r) => (r.checked = false));
  checked = null;
  showCheck({ local: '' });
}

sendButton.addEventListener('click', async () => {
  sendResult.textContent = '';
  sendResult.className = 'send-result';
  const fail = (text: string) => {
    sendResult.textContent = text;
    sendResult.classList.add('bad');
  };
  const a = currentAccount();
  if (!a) return fail('Sign in first (step 1): your design is credited to your callsign.');
  if (!a.callsign) return fail('Choose a callsign first (step 1).');
  const ai = document.querySelector<HTMLInputElement>('input[name="ai"]:checked');
  if (!ai) return fail('Say whether an AI assistant helped. Either answer is fine.');
  const r = readFile(fileBox.value);
  if (!('file' in r)) return fail(r.error);
  sendButton.disabled = true;
  try {
    clearTimeout(checkTimer);
    const c = await runCheck();
    if (c?.problems.length) return fail('Fix the things listed under your design first.');
    const body = JSON.stringify({ kind, file: r.file, note: $<HTMLTextAreaElement>('#note').value.trim(), ai: ai.value === 'yes', via: 'site' });
    const { submission } = revising ? await api<{ submission: Submission }>(`/submissions/${revising.id}`, { method: 'PUT', body }) : await api<{ submission: Submission }>('/submissions', { method: 'POST', body });
    clearForm();
    sendResult.textContent = `Handed in: ${submission.title}${submission.version > 1 ? `, version ${submission.version}` : ''}. It's in My submissions below, and you'll hear when it's reviewed.`;
    sendResult.classList.add('good');
    void loadMine();
  } catch (err) {
    const e = err as ApiError;
    if (e.data?.problems?.length) showCheck({ result: { problems: e.data.problems, warnings: [], title: null, itemId: null, revises: null } });
    fail(e.message);
  } finally {
    sendButton.disabled = false;
  }
});

// --- My submissions -----------------------------------------------------------------------

const list = $('#submissions');

async function loadMine() {
  if (!currentAccount()?.callsign) return renderMine(null);
  try {
    const r = await api<{ submissions: Submission[]; limits: Limits }>('/submissions/mine');
    renderMine(r.submissions, r.limits);
  } catch (err) {
    list.innerHTML = `<p class="muted">Couldn't load your submissions: ${escapeHtml((err as Error).message)}</p>`;
  }
}

function renderMine(subs: Submission[] | null, limits?: Limits) {
  $('#limits').textContent = limits ? limitsLine(limits) : '';
  if (!subs) {
    list.innerHTML = `<p class="muted">${currentAccount() ? 'Choose a callsign to hand things in.' : 'Sign in to see what you’ve handed in.'}</p>`;
    return;
  }
  if (!subs.length) {
    list.innerHTML = '<p class="muted">Nothing yet. What you hand in shows here, with how its review is going.</p>';
    return;
  }
  list.innerHTML = `<ol class="subs">${subs.map(item).join('')}</ol>`;
  for (const b of list.querySelectorAll<HTMLButtonElement>('[data-revise]')) b.addEventListener('click', () => void revise(b.dataset.revise!));
  for (const b of list.querySelectorAll<HTMLButtonElement>('[data-withdraw]'))
    b.addEventListener('click', async () => {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Press again to withdraw';
        setTimeout(() => {
          b.classList.remove('armed');
          b.textContent = 'Withdraw';
        }, 4000);
        return;
      }
      b.disabled = true;
      try {
        await api(`/submissions/${b.dataset.withdraw}`, { method: 'DELETE' });
        if (revising?.id === b.dataset.withdraw) clearForm();
      } catch (err) {
        alertIn(b, (err as Error).message);
      }
      void loadMine();
    });
}

function alertIn(el: HTMLElement, text: string) {
  const p = document.createElement('p');
  p.className = 'form-error small';
  p.textContent = text;
  el.closest('li')?.append(p);
}

function item(s: Submission): string {
  const what = `${s.kind === 'module' ? 'Titanoboa module' : 'Ship'} · ${s.revises ? `an improvement to ${escapeHtml(s.itemId)}` : escapeHtml(s.itemId)} · version ${s.version} · ${s.version > 1 ? 'revised' : 'handed in'} ${ago(s.updated)}${s.ai ? ' · AI-assisted' : ''}`;
  const review =
    s.status === 'changes'
      ? `<div class="review"><p class="small">The reviewer's notes:</p><p>${escapeHtml(s.review ?? '')}</p></div>`
      : s.status === 'accepted'
        ? `<div class="review good">${s.review ? `<p>${escapeHtml(s.review)}</p>` : ''}<p class="small">${s.pr ? `<a href="${escapeHtml(s.pr)}" rel="noopener">Its pull request</a>: it's in the game once that's merged.` : 'Its pull request is being opened.'}</p></div>`
        : '';
  const warnings = s.warnings.length && open(s) ? `<details class="small"><summary>The checks noted ${s.warnings.length === 1 ? 'one thing' : `${s.warnings.length} things`} for the reviewer</summary><ul>${s.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></details>` : '';
  const actions = open(s) ? `<p class="sub-actions"><button type="button" class="button small" data-revise="${escapeHtml(s.id)}">Revise</button> <button type="button" class="button small ghost" data-withdraw="${escapeHtml(s.id)}">Withdraw</button></p>` : '';
  return `<li class="sub s-${s.status}"><div class="sub-head"><b>${escapeHtml(s.title)}</b><span class="sub-status">${STATUS[s.status]}</span></div><p class="small muted">${what}</p>${s.note ? `<p class="small sub-note">Your note: ${escapeHtml(s.note)}</p>` : ''}${review}${warnings}${actions}</li>`;
}

async function revise(id: string) {
  try {
    const { submission } = await api<{ submission: Submission }>(`/submissions/${id}`);
    setRevising(submission);
    setKind(submission.kind);
    fileBox.value = JSON.stringify(submission.file ?? {}, null, 2);
    $<HTMLTextAreaElement>('#note').value = submission.note;
    document.querySelector<HTMLInputElement>(`input[name="ai"][value="${submission.ai ? 'yes' : 'no'}"]`)!.checked = true;
    fromText();
    $('#step-file').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    sendResult.textContent = (err as Error).message;
  }
}

// --- Start ----------------------------------------------------------------------------------

setKind(kind);
// A ship from the ship editor, handed over for sending.
if (new URLSearchParams(location.search).get('from') === 'editor') {
  try {
    const handed = sessionStorage.getItem('ws-submit-file');
    if (handed) {
      fileBox.value = handed;
      fromText();
    }
  } catch {
    /* nothing handed over */
  }
}
const startWith = new URLSearchParams(location.search).get('module');
if (startWith && cores.some((c) => c.id === startWith)) {
  core.value = startWith;
  core.dispatchEvent(new Event('change'));
}
account.render();
void refresh().then(() => {
  account.render();
  accountChanged();
});
