import type { ShipDef } from '../content/types';
import { API } from '../net/account';
import type { Look } from '../render/shipModel';
import { viewer, type Viewer } from './viewer';

// A numbered ship's papers (tools/ships.ts papersPage): the maker's certificate of build. Every fact comes
// from the yard's office (GET /shipyard/papers/<edition>/<no>), and only with the token in her owner's link
// (#t=…): without it the office says no more than whether the number is signed over, so nobody can walk the
// numbers and list who holds them (docs/design/edition-certificate.md).

interface Papers {
  editionId: string;
  edition: string;
  ship: string;
  number: number;
  limit: number;
  callsign: string | null;
  name: string | null;
  status: 'waiting' | 'in-service';
  signedAt: number;
  finish: string;
  glow: string;
  fitted: string[];
  aboard: { name: string; blurb: string }[];
  yard: string;
  system: string;
  colour: string;
  trim: string | null;
}
type Answer = Papers | { editionId: string; number: number; limit: number; signed: boolean };

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const page = JSON.parse($('#papers-def').textContent!) as { ship: string; edition: string; name: string; limit: number; maker: string };
const def = JSON.parse($('#ship-def').textContent!) as ShipDef;
const pad = (n: number) => String(n).padStart(3, '0');

let view: Viewer | null = null;
const stage = $('.papers-view');
try {
  view = viewer(stage.querySelector<HTMLCanvasElement>('.ship-canvas')!);
  view.show(def, JSON.parse(stage.dataset.look!) as Look);
  stage.classList.add('live');
} catch {
  // No WebGL: the drawing stays.
}

const no = Number(/\/(\d{3})\/?$/.exec(location.pathname)?.[1] ?? 0);
const token = new URLSearchParams(location.hash.slice(1)).get('t') ?? '';
const say = (html: string) => ($('#papers-state').innerHTML = html);

const date = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The certificate's lines, in the order the maker writes them. */
function rows(p: Papers): [string, string][] {
  return [
    ['Hull', p.ship],
    ['Name', p.name ?? 'To be named at collection'],
    ['Finish', p.finish],
    ['Glow', p.glow],
    ['Fitted', p.fitted.join(' · ')],
    ['Aboard', p.aboard.map((a) => a.name).join(' · ')],
    ['Built at', `${p.yard}, ${p.system}`],
    ['Signed over to', p.callsign ? `Commander ${p.callsign}` : 'Her owner'],
    ['Date', date(p.signedAt)],
    ['Status', p.status === 'in-service' ? 'In service' : 'Waiting at the yard'],
  ];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function show(p: Papers) {
  $('#papers-no').textContent = `No. ${pad(p.number)}`;
  $('#papers-state').hidden = true;
  const list = $('#papers-rows');
  list.innerHTML = rows(p)
    .map(([k, v]) => `<div${k === 'Name' && !p.name ? ' class="unnamed"' : ''}><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join('');
  list.hidden = false;
  $('#papers-yard').textContent = `, ${p.yard}`;
  $('#papers-foot').hidden = false;
  $('#papers-actions').hidden = false;
  const share = $('#papers-share');
  share.dataset.shareUrl = location.pathname + location.hash;
  share.dataset.shareTitle = `${p.edition} No. ${pad(p.number)}${p.name ? `, “${p.name}”` : ''}: her certificate of build`;
  document.title = `${p.edition} No. ${pad(p.number)} · Certificate of build · Witchspace`;
  $('#papers-save').addEventListener('click', () => void save(p));
}

async function load() {
  if (!no || no > page.limit) {
    $('#papers-no').textContent = `No. 001 to ${pad(page.limit)}`;
    say(`Each of the ${page.limit} has her own papers, sent by ${esc(page.maker)} to her owner. <a href="/ships/${page.ship}/${page.edition}/">See the ${esc(page.name)}</a>.`);
    return;
  }
  $('#papers-no').textContent = `No. ${pad(no)}`;
  try {
    const res = await fetch(`${API}/shipyard/papers/${page.edition}/${no}${token ? `?t=${encodeURIComponent(token)}` : ''}`, { cache: 'no-cache' });
    const a = (await res.json()) as Answer;
    if ('callsign' in a) return show(a);
    say(
      'signed' in a && a.signed
        ? `Signed over by the maker. Her papers are her owner’s: only the link the yard sent them shows them.`
        : `Not yet signed over. ${esc(page.name)}s are by invitation: the maker signs them over to the people who build Witchspace. <a href="/get-involved/">Get involved</a>.`,
    );
  } catch {
    say('The yard’s office isn’t answering. Try again in a little while.');
  }
}
void load();
// Her owner's link opened over the bare page changes only the hash: read her papers afresh.
window.addEventListener('hashchange', () => location.reload());

// --- Save as image: the certificate drawn on a picture of its own, phone-shaped -------------------------

const W = 1080;
/** Where the rows start, and the room the footer takes below them. */
const ROWS_AT = 946;
const FOOT = 250;
const ROW_LEFT = 110;
const ROW_VALUE = 390;
const LINE = 36;

/** Lines of `text` no wider than `max`. */
function wrap(c: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > max && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

async function save(p: Papers) {
  await document.fonts.ready;
  const css = getComputedStyle(document.body);
  const body = css.fontFamily;
  const head = getComputedStyle($('#papers-edition')).fontFamily;
  const fg = css.getPropertyValue('--fg').trim() || '#e9eef7';
  const muted = css.getPropertyValue('--muted').trim() || '#8c97ab';
  const trim = p.trim ?? p.colour;
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d')!;
  // The picture is as tall as her rows need: wrap them first, then size it.
  const max = W - ROW_VALUE - ROW_LEFT;
  c.font = `400 27px ${body}`;
  const lines = rows(p).map(([k, v]) => [k, wrap(c, v, max)] as const);
  const H = ROWS_AT + lines.reduce((h, [, l]) => h + 64 + LINE * (l.length - 1), 0) + FOOT;
  cv.width = W;
  cv.height = H;
  c.fillStyle = '#04060b';
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W / 2, 330, 40, W / 2, 330, 640);
  glow.addColorStop(0, `${p.colour}2e`);
  glow.addColorStop(1, '#04060b00');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);

  // Her, as she's turned on the page.
  const box = { x: 60, y: 60, w: W - 120, h: 560 };
  const layer = view?.snapshot(box.w, box.h);
  if (layer) {
    // Faded out towards the edges, an ellipse to her frame, so it doesn't show as a box.
    const l = layer.getContext('2d')!;
    l.globalCompositeOperation = 'destination-in';
    l.setTransform(box.w / box.h, 0, 0, 1, 0, 0);
    const fade = l.createRadialGradient(box.h / 2, box.h / 2, box.h * 0.22, box.h / 2, box.h / 2, box.h / 2);
    fade.addColorStop(0, '#000');
    fade.addColorStop(1, '#0000');
    l.fillStyle = fade;
    l.fillRect(0, 0, box.h, box.h);
    c.save();
    c.globalCompositeOperation = 'lighten';
    c.drawImage(layer, box.x, box.y);
    c.restore();
  }

  // A fine double rule round it all, in her colours.
  c.strokeStyle = `${p.colour}99`;
  c.lineWidth = 2;
  c.strokeRect(30, 30, W - 60, H - 60);
  c.strokeStyle = `${trim}55`;
  c.lineWidth = 1;
  c.strokeRect(42, 42, W - 84, H - 84);

  c.textAlign = 'center';
  let y = 680;
  c.fillStyle = trim;
  c.font = `600 28px ${body}`;
  c.letterSpacing = '8px';
  c.fillText(page.maker.toUpperCase(), W / 2, y);
  c.letterSpacing = '0px';
  y += 46;
  c.fillStyle = muted;
  c.font = `400 30px ${body}`;
  c.fillText('Certificate of build', W / 2, y);
  y += 92;
  c.save();
  c.fillStyle = p.colour;
  c.shadowColor = p.colour;
  c.shadowBlur = 28;
  c.font = `700 84px ${head}`;
  c.fillText(p.edition, W / 2, y);
  c.restore();
  y += 84;
  c.fillStyle = fg;
  const num = `No. ${pad(p.number)}`;
  c.font = `700 64px ${head}`;
  const nw = c.measureText(num).width;
  c.font = `400 34px ${body}`;
  const ow = c.measureText(` of ${p.limit}`).width;
  c.textAlign = 'left';
  c.font = `700 64px ${head}`;
  c.fillText(num, (W - nw - ow) / 2, y);
  c.fillStyle = muted;
  c.font = `400 34px ${body}`;
  c.fillText(` of ${p.limit}`, (W - nw - ow) / 2 + nw, y);
  y += 44;

  // The rows: a label, and the fact beside it.
  y = ROWS_AT;
  for (const [k, ls] of lines) {
    c.strokeStyle = '#ffffff1f';
    c.beginPath();
    c.moveTo(ROW_LEFT, y);
    c.lineTo(W - ROW_LEFT, y);
    c.stroke();
    y += 42;
    c.fillStyle = muted;
    c.font = `600 21px ${body}`;
    c.letterSpacing = '3px';
    c.fillText(k.toUpperCase(), ROW_LEFT, y);
    c.letterSpacing = '0px';
    c.fillStyle = k === 'Name' && !p.name ? muted : fg;
    c.font = `${k === 'Name' && p.name ? '700' : '400'} 27px ${body}`;
    ls.forEach((l, i) => c.fillText(l, ROW_VALUE, y + i * LINE));
    y += LINE * (ls.length - 1) + 22;
  }

  c.textAlign = 'center';
  y = H - 150;
  c.fillStyle = muted;
  c.font = `italic 400 24px ${body}`;
  c.fillText(`One of ${p.limit}. The number is painted beside her name, and no other ship will carry it.`, W / 2, y, W - 160);
  y += 50;
  c.fillStyle = fg;
  c.font = `400 26px ${body}`;
  c.fillText(`Signed for the yard: ${page.maker}, ${p.yard}`, W / 2, y, W - 160);
  y += 40;
  c.fillStyle = `${muted}aa`;
  c.font = `400 18px ${body}`;
  c.fillText('witchspace.org.uk · a free, open-source tribute to Elite (1984)', W / 2, y);

  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `${p.editionId}-${pad(p.number)}-certificate.png`, { type: 'image/png' });
  // On a phone, the share sheet is where Save Image lives; elsewhere, a download.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${p.edition} No. ${pad(p.number)}` });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
