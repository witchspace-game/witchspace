import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPANY_IDS, presence } from '../game/companies';
import { BOARD_SLOT } from '../game/contracts';
import { canonFor, companyPage, jobsPage, loadJobs } from '../../tools/jobs';
import { boardAt, COBRA_HOLD, FILTER_KINDS, homeGround, LAVE, OFF_BOARD, offersFor, type Kind } from './board';

const root = join(import.meta.dirname, '../..');
const jobs = loadJobs(root);
const t0 = Date.UTC(2026, 9, 27);
const week = Array.from({ length: 48 * 7 }, (_, i) => boardAt(LAVE, t0 + i * BOARD_SLOT).offers);

describe('the jobs board at Lave', () => {
  it('is never empty', () => {
    expect(week.every((b) => b.length > 0)).toBe(true);
  });

  it('gives every offer its times', () => {
    for (const o of week.flat()) expect(o.until).toBeGreaterThan(o.posted);
  });

  it('only offers cargo that fits an empty Cobra', () => {
    expect(week.flat().every((o) => o.qty <= COBRA_HOLD)).toBe(true);
  });
});

describe('the adverts', () => {
  const KINDS: Kind[] = ['haulage', 'starter', 'contractor', 'rush', 'survey', 'danger', 'assignment', 'coming-soon', 'build'];

  it('only name kinds the board knows', () => {
    for (const a of jobs.adverts) for (const k of a.kinds) expect(KINDS).toContain(k);
    for (const k of FILTER_KINDS) expect(KINDS).toContain(k.id);
  });

  it('describe contracts that really turn up, at Lave or on the company’s home ground', () => {
    for (const a of jobs.adverts) {
      if (a.kinds.some((k) => OFF_BOARD.includes(k))) continue;
      const home = homeGround(a.company).s;
      const there = Array.from({ length: 48 * 7 }, (_, i) => boardAt(home, t0 + i * BOARD_SLOT).offers);
      expect([...week, ...there].some((b) => offersFor(a, b).length > 0), a.title).toBe(true);
    }
  });

  it('cover all four companies, with their words', () => {
    for (const id of COMPANY_IDS) {
      expect(jobs.adverts.some((a) => a.company === id)).toBe(true);
      expect(jobs.companies[id].pitch).toBeTruthy();
      expect(jobs.companies[id].description.length).toBeLessThanOrEqual(160);
    }
  });
});

describe('the Build adverts', () => {
  it('are design commissions, paid only once a design is built', () => {
    const build = jobs.adverts.filter((a) => a.kinds.includes('build'));
    expect(build.length).toBeGreaterThan(0);
    for (const a of build) {
      expect(a.href).toBeTruthy();
      // The fee is designed, not yet paid: every pay line waits for the first fitting. (Hulls and characters
      // name no fee at all: the world's design doesn't give one.)
      if (/Cr\b/.test(a.meta)) expect(a.meta).toMatch(/when it's first fitted/);
    }
    expect(build.some((a) => /Cr\b/.test(a.meta))).toBe(true);
  });
});

describe('the ownership joke (Mark)', () => {
  // In character, W-Y owns your design forever; out here, contributors keep their copyright.
  // The asterisk and its footnote always travel together, so the joke never reads as a real term.
  it('never appears without its footnote', () => {
    const md = readFileSync(join(root, 'docs/companies.md'), 'utf8');
    const pages = [jobsPage(jobs), ...COMPANY_IDS.map((id) => companyPage(jobs, id, md, (m) => m, new Set()))];
    expect(pages.some((html) => html.includes('in perpetuity'))).toBe(true);
    for (const html of pages) if (html.includes('in perpetuity')) expect(html).toContain('*In the game. Out here, you keep your copyright');
  });
});

describe('a company with nothing at Lave', () => {
  it('falls back to the nearest world it leads', () => {
    for (const id of COMPANY_IDS) {
      const { s } = homeGround(id);
      const p = presence(s);
      expect(p[id]).toBeGreaterThan(0.5);
      for (const other of COMPANY_IDS) expect(p[other]).toBeLessThanOrEqual(p[id]);
    }
  });
});

describe('the company pages', () => {
  const md = readFileSync(join(root, 'docs/companies.md'), 'utf8');

  it('cut each company from the canon, without the builders’ prompts', () => {
    for (const id of COMPANY_IDS) {
      const c = canonFor(md, id);
      expect(c.story).toContain('### Where it came from');
      expect(c.story).not.toMatch(/(Concept|Logo) prompt/);
      expect(c.ship?.md ?? '').not.toMatch(/(Concept|Logo) prompt/);
      expect(c.between.length).toBeGreaterThan(0);
    }
  });
});
