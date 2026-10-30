// A smoke test of the whole game in a phone-sized browser, for refactoring main.ts safely
// (Mark, 30 October 2026: "We have 3 days to split it carefully"). It plays a new commander
// through every docked screen, launches, finds the traffic and hails it, goes to a yard and
// checks the Titan's guards and freighters, checks the friendly-fire rule, docks with the
// computer, and does the same basics under Classic rules. Any page error fails it.
//
//   npm run dev -- --port 5311 &        (a dev server: the test uses its debug handle)
//   node tools/smoke.mjs [http://localhost:5311]
//
// Needs Playwright with Chrome (npx playwright install chrome). Exits 1 on any failure.

const BASE = process.argv[2] ?? 'http://localhost:5311';
let chromium, devices;
try {
  ({ chromium, devices } = await import('playwright'));
} catch {
  console.error('Playwright is not installed here: npm i -D playwright (or run with NODE_PATH-free npx), then npx playwright install chrome');
  process.exit(2);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` · ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });

/** A fresh phone with a new commander, docked at Lave (or wherever ?at= says, on the dev server). */
async function newCommander(rules, at = '') {
  const page = await (await browser.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/play/?touch${at ? `&at=${at}` : ''}`);
  await page.waitForFunction(() => window.witchspace, null, { timeout: 30_000 });
  await wait(1200);
  const key = (code) => page.evaluate((c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); }, code);
  await key('KeyN');
  await wait(400);
  for (let i = 0; i < 12 && (await page.evaluate(() => window.witchspace.state)) !== 'docked'; i++) {
    await key('Enter');
    await wait(500);
  }
  await page.evaluate((r) => { window.witchspace.commander.difficulty = r; window.witchspace.renderDocked(); }, rules);
  return { page, errors, key, w: (fn, arg) => page.evaluate(fn, arg) };
}

async function launch(s) {
  await s.key('KeyL');
  for (let i = 0; i < 24 && (await s.w(() => window.witchspace.state)) !== 'flying'; i++) await wait(500);
  await wait(1000);
  return (await s.w(() => window.witchspace.state)) === 'flying';
}

/** Run the game's clock faster, for the timetable's ships. */
const warp = (s, x) => s.w((x) => { const real = window.__realNow ?? (window.__realNow = Date.now.bind(Date)); const t0 = real(); const from = Date.now(); Date.now = () => from + (real() - t0) * x; }, x);

// --- Modern: docked screens -----------------------------------------------------------
{
  const s = await newCommander('modern');
  check('Modern: a new commander docks', (await s.w(() => window.witchspace.state)) === 'docked');
  for (const tab of ['station', 'contracts', 'market', 'news', 'saloon', 'shipyard', 'money']) {
    const text = await s.w(async (t) => {
      const b = document.querySelector(`.tabs [data-tab="${t}"]`);
      if (!b) return null;
      b.click();
      await new Promise((r) => setTimeout(r, 600));
      const panel = [...document.querySelectorAll('.tab-panel, [data-panel], .dock-panel, .panel')].find((p) => p.offsetParent && p.textContent.trim().length > 40);
      return panel ? panel.textContent.trim().length : document.body.innerText.length;
    }, tab);
    check(`Modern: the ${tab} screen opens`, text !== null && text > 40, text === null ? 'no tab' : `${text} characters`);
  }
  const goods = await s.w(() => { document.querySelector('.tabs [data-tab="market"]')?.click(); return document.querySelectorAll('.ex-pair').length; });
  check('Modern: the market lists goods', goods > 5, `${goods}`);
  const wallet = await s.w(async () => { document.querySelector('.wallet-button')?.click(); await new Promise((r) => setTimeout(r, 400)); const open = !document.querySelector('#wallet-sheet')?.hidden; document.querySelector('.wallet-button')?.click(); return open; });
  check('Modern: the wallet opens', wallet);
  const manual = await s.w(async () => {
    document.querySelector('.tabs [data-tab="station"]')?.click();
    await new Promise((r) => setTimeout(r, 300));
    [...document.querySelectorAll('button')].find((b) => /Owner.s manual/i.test(b.textContent ?? ''))?.click();
    await new Promise((r) => setTimeout(r, 400));
    const m = document.querySelector('#manual');
    const shown = m && !m.hidden ? m.textContent.length : 0;
    document.querySelector('#manual .manual-close')?.click();
    return shown;
  });
  check('Modern: the owner\'s manual opens', manual > 200, `${manual} characters`);
  const took = await s.w(async () => {
    const w = window.witchspace;
    document.querySelector('.tabs [data-tab="contracts"]')?.click();
    await new Promise((r) => setTimeout(r, 400));
    const before = w.commander.contracts?.length ?? 0;
    const b = [...document.querySelectorAll('#contracts [data-take]')].find((x) => !x.disabled);
    if (!b) return 'no contract to take';
    b.click();
    await new Promise((r) => setTimeout(r, 400));
    return `${before} → ${w.commander.contracts?.length ?? 0}`;
  });
  check('Modern: a contract can be taken', /^(\d+) → (\d+)$/.test(took) && Number(took.split(' → ')[1]) > Number(took.split(' → ')[0]), took);
  check('Modern: docked screens raise no errors', !s.errors.length, s.errors.slice(0, 2).join(' | '));

  // --- Modern: flight, traffic and hailing -----------------------------------------------
  check('Modern: launches', await launch(s));
  await warp(s, 10);
  let traffic = [];
  for (let i = 0; i < 20 && !traffic.length; i++) {
    await wait(1000);
    traffic = await s.w(() => window.witchspace.traffic());
  }
  check('Modern: the timetable puts ships in space', traffic.length > 0, traffic.map((t) => t.name).join(', '));
  const said = await s.w(async () => {
    const w = window.witchspace;
    const t = w.npcs.find((n) => n.role === 'trader');
    if (!t) return '';
    const V = w.player.obj.position.constructor;
    w.player.obj.position.copy(t.obj.position).add(new V(0, 0, 1500).applyQuaternion(t.obj.quaternion));
    w.player.obj.lookAt(t.obj.position);
    w.aim.reset(w.player);
    await new Promise((r) => setTimeout(r, 200));
    w.hailTarget();
    await new Promise((r) => setTimeout(r, 300));
    return [...document.querySelectorAll('#radio li, .radio-line, #radio-log li')].map((e) => e.textContent).slice(-1)[0] ?? '';
  });
  check('Modern: a trader answers a hail', said.length > 10, said);

  // --- Modern: the friendly-fire rule ----------------------------------------------------
  await s.w(() => { const w = window.witchspace; for (let k = 0; k < 20 && !w.npcs.some((n) => n.role === 'pirate'); k++) w.spawnPirates(w.player.obj.position); for (const n of w.npcs.filter((n) => n.role === 'pirate')) { n.obj.position.copy(w.player.obj.position).addScaledVector(w.player.forward(), 1500); n.hostile = true; } });
  await wait(300);
  const stray = await s.w(async () => {
    const w = window.witchspace;
    const v = w.npcs.find((n) => n.role === 'police');
    if (!v) return 'no police';
    w.playerHitNpc(v, 1);
    const first = w.legalStatus(w.commander);
    await new Promise((r) => setTimeout(r, 2500));
    w.playerHitNpc(v, 1);
    return `${first} then ${w.legalStatus(w.commander)}`;
  });
  check('Modern: a first stray hit on police in a fight is forgiven, a second is not', stray === 'clean then fugitive', stray);
  check('Modern: flight raises no errors', !s.errors.length, s.errors.slice(0, 2).join(' | '));
  await s.page.context().close();
}

// --- Modern: a yard, its guards and the Titan's freighters --------------------------------
{
  const s = await newCommander('modern');
  const yard = await s.w(() => window.witchspace.yards()[0]);
  await launch(s);
  await s.w((i) => window.witchspace.jumpTo(i), yard.system);
  for (let i = 0; i < 60 && !(await s.w(() => window.witchspace.state === 'flying' && Boolean(window.witchspace.yard))); i++) await wait(500);
  check('Modern: jumps to a yard system', await s.w(() => Boolean(window.witchspace.yard)));
  await warp(s, 8);
  let guards = [];
  let runs = [];
  for (let i = 0; i < 25 && (guards.filter((g) => !g.with).length < 2 || !runs.length); i++) {
    await wait(1000);
    guards = await s.w(() => window.witchspace.security());
    runs = await s.w(() => window.witchspace.traffic().filter((t) => t.leg === 'titan'));
  }
  check('Modern: the Titan has guards', guards.filter((g) => !g.with).length >= 2, `${guards.length} security ships`);
  check('Modern: a freighter is bound for the Titan', runs.length > 0, runs.map((r) => r.name).join(', '));
  check('Modern: the yard raises no errors', !s.errors.length, s.errors.slice(0, 2).join(' | '));
  await s.page.context().close();
}

// --- Modern: docking with the computer ----------------------------------------------------
{
  const s = await newCommander('modern');
  await launch(s);
  await s.w(() => { const w = window.witchspace; w.player.speed = 0; w.setAutopilot(true); });
  let docked = false;
  for (let i = 0; i < 120 && !docked; i++) {
    await wait(1000);
    docked = (await s.w(() => window.witchspace.state)) === 'docked';
  }
  check('Modern: the docking computer docks', docked);
  check('Modern: docking raises no errors', !s.errors.length, s.errors.slice(0, 2).join(' | '));
  await s.page.context().close();
}

// --- Classic ---------------------------------------------------------------------------------
{
  const s = await newCommander('classic');
  check('Classic: a new commander docks', (await s.w(() => window.witchspace.state)) === 'docked');
  check('Classic: launches', await launch(s));
  await wait(3000);
  const traffic = await s.w(() => window.witchspace.traffic().length);
  check('Classic: no timetable traffic (1984 rules)', traffic === 0, `${traffic}`);
  check('Classic raises no errors', !s.errors.length, s.errors.slice(0, 2).join(' | '));
  await s.page.context().close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
