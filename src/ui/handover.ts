// The handover (the edition delivery pack, Mark): when a numbered edition given
// to a contributor is collected, the maker hands over the keys with her build
// certificate full screen, her name now written in. Every fact is from her
// papers (game/papers.ts). One button closes it to the berth; her papers are a
// quiet line below it (Mark: three equal buttons read as a choice of one), using
// her certificate's private link, the owner's to give.

import type { Papers } from '../game/papers';
import { escapeHtml } from './escape';
import { copyText } from './shareLinks';

export interface Handover {
  papers: Papers;
  maker: string;
  name: string;
  callsign: string;
  /** When she was collected. */
  at: number;
  /** Her certificate's private link, once the yard's office has answered. */
  link: Promise<string | null>;
}

const longDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function showHandover(el: HTMLElement, h: Handover, closed: () => void) {
  const p = h.papers;
  const row = (k: string, v: string) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  el.style.setProperty('--ed', p.colour);
  el.style.setProperty('--ed-trim', p.trim ?? p.colour);
  el.innerHTML = `<div class="ho-card">
    <p class="ho-lead"><b>${escapeHtml(h.maker)} hands over the keys.</b><br>${escapeHtml(p.edition)} ${p.no}${h.name ? `, “${escapeHtml(h.name)}”` : ''}. She’s yours, Commander.</p>
    <div class="ho-cert">
      <p class="ho-maker">${escapeHtml(h.maker)}</p>
      <p class="ho-kind">Certificate of build</p>
      <h2>${escapeHtml(p.edition)}</h2>
      <p class="ho-no">No. ${p.no} <small>of ${p.limit}</small></p>
      <table>
        ${row('Hull', escapeHtml(p.ship))}
        ${row('Name', h.name ? escapeHtml(h.name) : 'To be named')}
        ${row('Finish', escapeHtml(p.finish))}
        ${row('Glow', escapeHtml(p.glow))}
        ${row('Fitted', escapeHtml(p.fitted.join(' · ')))}
        ${p.aboard.length ? row('Aboard', escapeHtml(p.aboard.map((a) => a.name).join(' · '))) : ''}
        ${row('Built at', `${escapeHtml(p.yard)}, ${escapeHtml(p.system)}`)}
        ${row('Signed over to', `Commander ${escapeHtml(h.callsign)}`)}
        ${row('Collected', longDate(h.at))}
        ${row('Status', 'In service')}
      </table>
      <p class="ho-note">One of ${p.limit}. The number is painted beside her name, and no other ship will carry it.</p>
      <p class="ho-sign">Signed for the yard: <b>${escapeHtml(h.maker)}, ${escapeHtml(p.yard)}</b></p>
    </div>
    <button type="button" class="primary ho-fly">To the berth: she’s ready to fly</button>
    <p class="ho-actions"><span>Her papers are private: only those you give the link to can see them.</span>
      <a class="ho-papers" target="_blank" rel="noopener" aria-disabled="true">Open them</a>
      <button type="button" class="ho-share" disabled>Send the link</button></p>
    <p class="ho-msg" aria-live="polite"></p>
  </div>`;
  el.hidden = false;
  const fly = el.querySelector<HTMLButtonElement>('.ho-fly')!;
  fly.focus();
  fly.onclick = () => {
    el.hidden = true;
    closed();
  };
  const msg = el.querySelector<HTMLElement>('.ho-msg')!;
  void h.link.then((link) => {
    const share = el.querySelector<HTMLButtonElement>('.ho-share')!;
    const papers = el.querySelector<HTMLAnchorElement>('.ho-papers')!;
    if (!link) {
      msg.textContent = 'Her papers are in the maker’s letter, and on the Station tab once you’re signed in.';
      return;
    }
    papers.href = link;
    papers.removeAttribute('aria-disabled');
    share.disabled = false;
    share.onclick = async () => {
      const title = `${p.edition} ${p.no}${h.name ? `, “${h.name}”` : ''}`;
      if (navigator.share) {
        await navigator.share({ title, text: `${title}: her certificate of build, from ${h.maker}.`, url: link }).catch(() => undefined);
        return;
      }
      await copyText(link);
      msg.textContent = 'Her papers’ link is copied. It’s private: only those you give it to can see them.';
    };
  });
}
