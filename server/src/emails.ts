// The emails Witchspace sends: the sign-in email, and messages from the
// trading companies when an assignment is waiting (opt-in). Built for email
// clients: tables, inline styles, no scripts, and a banner from the game's
// own screenshots (public/email/, served from the site). Every company
// writes in its own voice (docs/companies.md).

import type { CompanyId } from './contact';
import type { Papers } from '../../src/game/papers';

const SITE = 'https://witchspace.org.uk';
const FONT = "Arial,Helvetica,sans-serif";

interface Look {
  /** Accent colour: headings, rules, the button. */
  accent: string;
  /** The button's text colour (readable on the accent). */
  ink: string;
  /** The banner: public/email/<hero>.jpg, or a full address. */
  hero: string;
  /** Above the headline, small and spaced: who it's from. */
  eyebrow: string;
  /** The company's mark, as text. */
  mark: string;
  /** Small print at the foot, in the company's voice. */
  sign: string;
  button: string;
  /** One line in the company's voice, after the news that work is waiting. */
  pitch: string;
}

const LOOKS: Record<CompanyId | 'signin', Look> = {
  signin: {
    accent: '#3dffb0',
    ink: '#03140e',
    hero: 'signin',
    eyebrow: 'WITCHSPACE · DOCKING CLEARANCE',
    mark: 'W',
    sign: 'A free, open-source tribute to Elite (1984).',
    button: 'Sign in to Witchspace',
    pitch: '',
  },
  hexon: {
    accent: '#bfefff',
    ink: '#06141a',
    hero: 'hexon',
    eyebrow: 'HEXON HOLDINGS · CONTINUITY OF CARE',
    mark: 'HH',
    sign: 'This message is confidential. If it reached you in error, it did not reach you.',
    button: 'Report for assignment',
    pitch: 'The pay is generous. The questions are few. Please be discreet.',
  },
  vorg: {
    accent: '#ff8a3d',
    ink: '#1a0a00',
    hero: 'vorg',
    eyebrow: 'VORG INDUSTRIES · WE BUILD. YOU SURVIVE.',
    mark: 'V',
    sign: 'Mr Vorg’s speeches are available on request. Please do not request them.',
    button: 'Take the job',
    pitch: 'The cargo may tick. Do not worry about the ticking.',
  },
  mutual: {
    accent: '#7fb2ff',
    ink: '#06101f',
    hero: 'mutual',
    eyebrow: 'THE CARRIERS’ MUTUAL · NO HAULER FLIES ALONE',
    mark: '28',
    sign: 'One member, one ship, one vote. The treasurer sends her regards.',
    button: 'Answer the call',
    pitch: 'A member needs a hand, and the Mutual remembers who comes.',
  },
  wy: {
    accent: '#ffd23d',
    ink: '#1a1400',
    hero: 'wy',
    eyebrow: 'WEXLEY-YOROZU · SCIENCE DIVISION',
    mark: 'WY',
    sign: 'Better worlds, built to order. Ref: your agreement, clause 214.',
    button: 'Acknowledge the order',
    pitch: 'Crew safety is a secondary consideration.',
  },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The frame every email shares: banner, mark, headline, body, button, small print. */
function frame(look: Look, opts: { preheader: string; title: string; body: string; link: string; extra?: string; foot: string }): string {
  return `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#05070d;font-family:${FONT};color:#eaf0f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070d"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0b111c;border:1px solid #1f2a3a;border-top:4px solid ${look.accent};border-radius:14px;overflow:hidden">
<tr><td><img src="${look.hero.startsWith('https://') ? look.hero : `${SITE}/email/${look.hero}.jpg`}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0"></td></tr>
<tr><td style="padding:26px 30px 8px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:42px;height:42px;border:2px solid ${look.accent};border-radius:8px;text-align:center;vertical-align:middle;font:bold 16px ${FONT};color:${look.accent};letter-spacing:1px">${esc(look.mark)}</td>
    <td style="padding-left:12px;font:bold 11px ${FONT};letter-spacing:3px;color:${look.accent}">${esc(look.eyebrow)}</td>
  </tr></table>
</td></tr>
<tr><td style="padding:10px 30px 0">
  <h1 style="margin:0 0 14px;font:bold 26px/1.25 ${FONT};color:#ffffff">${esc(opts.title)}</h1>
  <p style="margin:0 0 22px;font:16px/1.6 ${FONT};color:#c2cddb">${opts.body}</p>
  <p style="margin:0 0 24px"><a href="${opts.link}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${look.accent};color:${look.ink};font:bold 15px ${FONT};text-decoration:none">${esc(look.button)}</a></p>
  ${opts.extra ?? ''}
</td></tr>
<tr><td style="padding:6px 30px 26px;border-top:1px solid #1f2a3a">
  <p style="margin:14px 0 0;font:italic 12px/1.5 ${FONT};color:#7d8ba0">${esc(look.sign)}</p>
  <p style="margin:8px 0 0;font:12px/1.5 ${FONT};color:#5d6b80">${opts.foot}</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font:12px ${FONT};color:#4b586c"><a href="${SITE}" style="color:#4b586c">witchspace.org.uk</a> · a free, open-source tribute to Elite (1984)</p>
</td></tr></table></body></html>`;
}

/** The sign-in email: the link, and the code for a Home Screen app. */
export function signInEmail(link: string, code: string, minutes: number): { subject: string; html: string; text: string } {
  const look = LOOKS.signin;
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `Your Witchspace clearance: ${spaced}`,
    html: frame(look, {
      preheader: `Your sign-in code is ${spaced}. Your Cobra is fuelled and waiting.`,
      title: 'Right on, Commander.',
      body: `Your Cobra is fuelled and waiting in its berth. This link signs you in: it works once, for ${minutes} minutes.`,
      link,
      extra: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid #1f3a32;border-radius:10px;background:#07120f"><tr><td style="padding:16px 18px">
  <p style="margin:0 0 6px;font:bold 11px ${FONT};letter-spacing:3px;color:#3dffb0">CLEARANCE CODE</p>
  <p style="margin:0 0 6px;font:bold 34px 'Courier New',monospace;letter-spacing:8px;color:#ffffff">${spaced}</p>
  <p style="margin:0;font:13px/1.5 ${FONT};color:#95a3b8">Playing from your Home Screen? The link opens in your browser, so type this code into the game instead.</p>
</td></tr></table>`,
      foot: 'Didn’t ask for this? Ignore it: nobody can sign in without the link or the code.',
    }),
    text: `Right on, Commander.\n\nYour Cobra is fuelled and waiting. Sign in to Witchspace with this link (it works once, for ${minutes} minutes):\n\n${link}\n\nOr type this clearance code into the game: ${spaced}\n\nDidn't ask for this? Ignore it: nobody can sign in without the link or the code.\n\nWitchspace · ${SITE}`,
  };
}

/** A company getting in touch: an assignment is waiting. */
export function companyEmail(company: CompanyId, name: string, subject: string, body: string, stop: string): { subject: string; html: string; text: string } {
  const look = LOOKS[company];
  return {
    subject: `${name}: ${subject}`,
    html: frame(look, {
      preheader: body,
      title: subject,
      body: `${esc(body)}<br><br><span style="color:${look.accent}">${esc(look.pitch)}</span>`,
      link: `${SITE}/play/`,
      foot: `You asked the companies in Witchspace to contact you. <a href="${stop}" style="color:#7d8ba0">Stop these messages</a>.`,
    }),
    text: `${name.toUpperCase()}\n\n${subject}.\n\n${body}\n\n${look.pitch}\n\n${SITE}/play/\n\n${look.sign}\n\nYou asked the companies in Witchspace to contact you. To stop: ${stop}`,
  };
}

/**
 * The maker's letter when a numbered edition is signed over (the edition delivery
 * pack, Mark): sent once, in the edition's own colours, with her papers' private
 * link. Every fact is from her papers (src/game/papers.ts), never typed in.
 */
export function editionEmail(p: Papers, maker: string, callsign: string | null, link: string): { subject: string; html: string; text: string } {
  const who = callsign ? `Commander ${callsign}` : 'Commander';
  const glow = p.glow.replace(/ glow$/i, '').toLowerCase();
  const look: Look = {
    accent: p.colour,
    ink: '#05070d',
    hero: `${SITE}/share/ships-${p.shipId}-${p.editionId}.jpg`,
    eyebrow: `${maker} · ${p.system}`.toUpperCase(),
    mark: maker.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    sign: 'Fast ships for people in a hurry.',
    button: 'See her papers',
    pitch: '',
  };
  const trim = p.trim ?? p.colour;
  const paras = [
    `${who},`,
    `She’s finished. ${p.edition} ${p.no} of ${p.limit}, built by hand at our own yard and signed over to you, paid for in full.`,
    `${p.finish}. The glow is ${glow}. She carries ${p.fittedLine}${p.aboard.length ? `, and aboard there’s ${p.aboardLine}` : ''}.`,
    `She’s waiting at ${p.yard}, ${p.system}. Bring whatever you’re flying: we’ll take it in part, give her a name, and hand you the keys.`,
    'Her papers are at the link below.',
  ];
  const foot = 'Witchspace is a free, open-source tribute to Elite (1984), not affiliated with Frontier. ' + `${maker} is a shipbuilder in the game. You’re getting this once, because a ship was signed over to this address. No further emails unless you turn them on.`;
  const block = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid ${trim};border-radius:10px;background:#07090f"><tr><td style="padding:16px 18px">
  <p style="margin:0 0 6px;font:bold 17px ${FONT};color:#ffffff">${esc(p.edition)} · No. ${esc(p.no)} of ${p.limit}</p>
  <p style="margin:0 0 6px;font:14px/1.5 ${FONT};color:${trim}">${esc(p.ship)} · ${esc(p.finish)}</p>
  <p style="margin:0;font:13px/1.5 ${FONT};color:#95a3b8">Held for ${esc(who)} at ${esc(p.yard)}, ${esc(p.system)}</p>
</td></tr></table>
<p style="margin:0 0 6px;font:15px/1.5 ${FONT};color:#c2cddb">${esc(maker)}, ${esc(p.yard)}</p>
<p style="margin:0 0 20px;font:13px ${FONT}"><a href="${SITE}/play/" style="color:${trim}">Play Witchspace</a></p>`;
  return {
    subject: `${p.edition} ${p.no} is ready for you, Commander`,
    html: frame(look, {
      preheader: `${p.edition} ${p.no} of ${p.limit}, signed over to you and waiting at ${p.yard}, ${p.system}.`,
      title: `${p.edition} ${p.no}`,
      body: `<span style="display:block;margin:-6px 0 18px;font:15px ${FONT};color:${trim}">Built for ${esc(who)}</span>${paras.map(esc).join('<br><br>')}`,
      link,
      extra: block,
      foot,
    }),
    text: `${maker.toUpperCase()} · ${p.system.toUpperCase()}\n\n${p.edition} ${p.no}\nBuilt for ${who}\n\n${paras.join('\n\n')}\n\nHer papers: ${link}\n\n${p.edition} · No. ${p.no} of ${p.limit}\n${p.ship} · ${p.finish}\nHeld for ${who} at ${p.yard}, ${p.system}\n\n${maker}, ${p.yard}\nFast ships for people in a hurry.\n\nPlay Witchspace: ${SITE}/play/\n\n${foot}`,
  };
}
