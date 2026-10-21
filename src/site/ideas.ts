// The ideas board page: list, post and vote, against the board on our server
// (server/src/ideas.ts). This browser keeps a random id so each idea gets one
// vote from it; Cloudflare Turnstile checks posters are human.

import { escapeHtml } from '../ui/escape';

const API = import.meta.env.DEV ? 'http://127.0.0.1:8787/ideas' : 'https://space.witchspace.org.uk/ideas';
/** Turnstile's public site key; empty skips the check (local development). */
const TURNSTILE_SITE_KEY = '0x4AAAAAAFfP1CB8aXita2o_';

type Status = 'open' | 'planned' | 'building' | 'built' | 'declined';
interface Idea {
  id: string;
  title: string;
  body: string;
  status: Status;
  up: number;
  down: number;
  created: number;
  mine: number;
}

const STATUS_LABEL: Record<Status, string> = { open: '', planned: 'Planned', building: 'Being built', built: 'Built', declined: 'Not for now' };

/** This browser's voter id: random, kept locally, never linked to anything else. */
function voterId(): string {
  try {
    let id = localStorage.getItem('witchspace.voter');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('witchspace.voter', id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // storage blocked: a fresh id each visit
  }
}

const voter = voterId();
const list = document.querySelector<HTMLOListElement>('#ideas')!;
const form = document.querySelector<HTMLFormElement>('#idea-form')!;
const note = document.querySelector<HTMLElement>('#idea-note')!;
let sort = 'top';
let statusFilter: Status | null = null;
let ideas: Idea[] = [];

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', 'X-Voter': voter, ...(init.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong');
  return data;
}

async function load() {
  try {
    ideas = ((await api(`?sort=${sort}`)) as { ideas: Idea[] }).ideas;
    render();
  } catch {
    list.innerHTML = '<li class="muted">The ideas board isn’t answering just now. Try again in a moment.</li>';
  }
}

function render() {
  const shown = statusFilter ? ideas.filter((i) => i.status === statusFilter) : ideas;
  if (!shown.length) {
    list.innerHTML = `<li class="muted">${statusFilter ? 'Nothing here yet.' : 'No ideas yet. Be the first.'}</li>`;
    return;
  }
  list.innerHTML = shown
    .map((i) => {
      const net = i.up - i.down;
      const label = STATUS_LABEL[i.status];
      return `<li class="idea" data-id="${i.id}">
        <div class="votes" role="group" aria-label="Vote">
          <button type="button" class="vote up${i.mine > 0 ? ' on' : ''}" data-vote="1" aria-label="Vote up" aria-pressed="${i.mine > 0}">▲</button>
          <span class="score" title="${i.up} up, ${i.down} down">${net}</span>
          <button type="button" class="vote down${i.mine < 0 ? ' on' : ''}" data-vote="-1" aria-label="Vote down" aria-pressed="${i.mine < 0}">▼</button>
        </div>
        <div class="idea-text">
          <h3>${escapeHtml(i.title)}${label ? ` <span class="status ${i.status}">${label}</span>` : ''}</h3>
          ${i.body ? `<p>${escapeHtml(i.body).replace(/\n/g, '<br />')}</p>` : ''}
          <button type="button" class="report" data-report>Report</button>
        </div>
      </li>`;
    })
    .join('');
}

list.addEventListener('click', async (e) => {
  const el = e.target as HTMLElement;
  const item = el.closest<HTMLElement>('.idea');
  if (!item) return;
  const idea = ideas.find((i) => i.id === item.dataset.id);
  if (!idea) return;
  if (el.dataset.vote) {
    // Clicking your current vote again takes it back.
    const value = idea.mine === Number(el.dataset.vote) ? 0 : Number(el.dataset.vote);
    try {
      const r = (await api(`/${idea.id}/vote`, { method: 'POST', body: JSON.stringify({ value }) })) as { up: number; down: number; mine: number };
      Object.assign(idea, r);
      render();
    } catch (err) {
      flashNote((err as Error).message);
    }
  } else if (el.hasAttribute('data-report')) {
    try {
      await api(`/${idea.id}/report`, { method: 'POST', body: '{}' });
      el.textContent = 'Reported, thank you';
      el.setAttribute('disabled', '');
    } catch (err) {
      flashNote((err as Error).message);
    }
  }
});

for (const chip of document.querySelectorAll<HTMLButtonElement>('.chip')) {
  chip.addEventListener('click', () => {
    if (chip.dataset.sort) {
      sort = chip.dataset.sort;
      statusFilter = null;
    } else {
      statusFilter = statusFilter === chip.dataset.status ? null : (chip.dataset.status as Status);
    }
    for (const c of document.querySelectorAll<HTMLButtonElement>('.chip')) {
      c.setAttribute('aria-pressed', String(c.dataset.sort ? !statusFilter && c.dataset.sort === sort : c.dataset.status === statusFilter));
    }
    void load();
  });
}

// --- Posting ---------------------------------------------------------------------

let turnstileToken = '';
declare const turnstile: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void } | undefined;
let widget: string | undefined;

if (TURNSTILE_SITE_KEY) {
  (window as unknown as Record<string, unknown>).onTurnstileLoad = () => {
    widget = turnstile?.render(document.querySelector('#turnstile')!, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'dark',
      callback: (t: string) => (turnstileToken = t),
      'expired-callback': () => (turnstileToken = ''),
    });
  };
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
  s.async = true;
  document.head.append(s);
}

function flashNote(text: string, good = false) {
  note.textContent = text;
  note.classList.toggle('warn', !good);
  note.classList.toggle('good', good);
  setTimeout(() => {
    note.textContent = 'Plain text only. Ideas go live straight away; anything inappropriate can be reported.';
    note.classList.remove('warn', 'good');
  }, 5000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  button.disabled = true;
  try {
    await api('', { method: 'POST', body: JSON.stringify({ title: data.get('title'), body: data.get('body'), turnstile: turnstileToken }) });
    form.reset();
    sort = 'new';
    statusFilter = null;
    for (const c of document.querySelectorAll<HTMLButtonElement>('.chip')) c.setAttribute('aria-pressed', String(c.dataset.sort === 'new'));
    await load();
    flashNote('Posted: thank you! It’s at the top of New.', true);
  } catch (err) {
    flashNote((err as Error).message);
  } finally {
    button.disabled = false;
    turnstileToken = '';
    if (widget !== undefined) turnstile?.reset(widget);
  }
});

void load();
