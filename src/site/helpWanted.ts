import { escapeHtml } from '../ui/escape';

// Help wanted on /get-involved/: the Code group lists GitHub's open issues
// labelled "good first issue", live, under any code tasks from the designs
// (tools/docs.ts helpWantedHtml). The Code card opens the group.

const ISSUES = 'https://api.github.com/repos/witchspace-game/witchspace/issues?labels=good%20first%20issue&state=open&per_page=12';

const group = document.querySelector<HTMLDetailsElement>('#help-code');
const list = document.querySelector<HTMLUListElement>('#help-code-list');
const count = document.querySelector<HTMLElement>('#help-code-count');

function openCode() {
  if (location.hash !== '#help-code' || !group) return;
  group.open = true;
  group.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.addEventListener('hashchange', openCode);
openCode();

if (group && list && count)
  void (async () => {
    try {
      const res = await fetch(ISSUES, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      // The issues API lists pull requests too: only issues here.
      const issues = ((await res.json()) as { number: number; title: string; html_url: string; pull_request?: unknown }[]).filter((i) => !i.pull_request);
      list.insertAdjacentHTML('beforeend', issues.map((i) => `<li><span>${escapeHtml(i.title)}</span><a href="${escapeHtml(i.html_url)}">Issue #${i.number} ↗</a></li>`).join(''));
      const n = list.children.length;
      count.textContent = n ? `${n} ${n === 1 ? 'task' : 'tasks'}` : 'good first issues';
    } catch {
      // GitHub isn't answering: the link to the issues is still there.
    }
  })();
