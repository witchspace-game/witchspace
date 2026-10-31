// The owner's manual's pictures, taken from the game itself on a phone (Mark, 31 October 2026: "the
// owners manuals have no images! Thats a loss when you dont show people the Viewing tools and the menu
// on the phone and how the scanner works"). It flies a new commander sideways on an iPhone, sets up
// each scene through the dev server's debug handle, and saves a JPEG to public/manual/ for each.
// Where a picture has numbered callouts, it measures where each control is on the screen and writes
// that to src/content/manualShots.json, so the numbers sit on the controls however the layout moves.
// The numbers follow the manual's own lists (PHONE and DASHBOARD in src/game/controls.ts).
//
//   npm run dev -- --port 5311 &
//   node tools/manual-shots.mjs [http://localhost:5311]
//
// Rerun it whenever the flight screen changes. Needs Playwright with Chrome, like tools/smoke.mjs.

import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5311';
const OUT = 'public/manual';
const { chromium, devices } = await import('playwright');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const shots = {};

/** A new commander on a phone, docked at Lave. */
async function commander(device) {
  const page = await (await browser.newContext({ ...devices[device], deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${BASE}/play/?touch`);
  await page.waitForFunction(() => window.witchspace, null, { timeout: 30_000 });
  await wait(1200);
  const key = (code) => page.evaluate((c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); }, code);
  await key('KeyN'); // sound off
  await wait(400);
  for (let i = 0; i < 12 && (await page.evaluate(() => window.witchspace.state)) !== 'docked'; i++) {
    await key('Enter');
    await wait(500);
  }
  await page.evaluate(() => { window.witchspace.commander.difficulty = 'modern'; window.witchspace.renderDocked(); });
  return { page, key, w: (fn, arg) => page.evaluate(fn, arg) };
}

async function launch(s) {
  await s.key('KeyL');
  for (let i = 0; i < 24 && (await s.w(() => window.witchspace.state)) !== 'flying'; i++) await wait(500);
  await wait(1500);
}

/**
 * Save a picture, of the whole screen or of one element (with `pad` CSS pixels round it), and where
 * each callout's element is on it, as percentages: `[label, selector, anchor]`, anchor 'tl' (its top
 * left corner, so the number doesn't hide the control's own label), 'c' (centre), 'l' (left middle)
 * or 't' (top middle).
 */
async function shoot(page, name, { of, pad = 0, callouts = [] } = {}) {
  const view = page.viewportSize();
  let clip = { x: 0, y: 0, width: view.width, height: view.height };
  if (of) {
    const r = await page.locator(of).first().boundingBox();
    const x = Math.max(0, r.x - pad);
    const y = Math.max(0, r.y - pad);
    clip = { x, y, width: Math.min(view.width - x, r.width + pad * 2), height: Math.min(view.height - y, r.height + pad * 2) };
  }
  const marks = [];
  for (const [label, sel, anchor = 'tl'] of callouts) {
    const r = await page.locator(sel).first().boundingBox();
    if (!r) throw new Error(`${name}: nothing at ${sel}`);
    const px = anchor === 'l' || anchor === 'tl' ? r.x : r.x + r.width / 2;
    const py = anchor === 't' || anchor === 'tl' ? r.y : r.y + r.height / 2;
    marks.push({ label, x: +(((px - clip.x) / clip.width) * 100).toFixed(1), y: +(((py - clip.y) / clip.height) * 100).toFixed(1) });
  }
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 78, clip });
  shots[name] = { w: Math.round(clip.width * 2), h: Math.round(clip.height * 2), ...(marks.length ? { callouts: marks } : {}) };
  console.log(`${name}: ${shots[name].w}×${shots[name].h}${marks.length ? `, ${marks.length} callouts` : ''}`);
}

// --- Sideways, in flight -----------------------------------------------------------------
{
  const s = await commander('iPhone 13 landscape');
  await launch(s);
  // Out of the docking aid's range, with a little traffic about: a trader above and ahead, a pirate
  // below who has fired on you, a police Viper behind, and a canister drifting.
  await s.w(() => {
    const w = window.witchspace;
    const p = w.player.obj;
    const axis = (x, y, z) => p.position.clone().set(x, y, z).applyQuaternion(p.quaternion);
    // Out to the side of the station, still facing the way she launched: out of the docking aid's
    // range and clear of the planet (no survey).
    p.position.add(axis(1, 0, 0).multiplyScalar(16000));
    w.player.speed = 0;
    const at = (r, u, f) => p.position.clone().add(axis(1, 0, 0).multiplyScalar(r)).add(axis(0, 1, 0).multiplyScalar(u)).addScaledVector(w.player.forward(), f);
    w.spawnTrader(false, 3000);
    for (let k = 0; k < 20 && !w.npcs.some((n) => n.role === 'pirate'); k++) w.spawnPirates(p.position);
    const trader = w.npcs.find((n) => n.role === 'trader');
    const pirate = w.npcs.find((n) => n.role === 'pirate');
    const police = w.npcs.find((n) => n.role === 'police');
    // Everyone else out of the picture (their markers would line the screen's edge).
    for (const n of [...w.npcs]) if (![trader, pirate, police].includes(n)) { n.obj.position.addScalar(400000); w.npcs.splice(w.npcs.indexOf(n), 1); }
    if (trader) { trader.obj.position.copy(at(-60, 40, 1300)); trader.obj.lookAt(p.position); }
    if (pirate) { pirate.obj.position.copy(at(1600, -1500, 2200)); pirate.firedOnPlayer = true; pirate.hostile = true; }
    if (police) police.obj.position.copy(at(-1200, 1400, -2400));
    w.spillCargo(at(500, 150, 900), p.position.clone().set(0, 0, 0), 1);
  });
  await wait(700);
  // Freeze the traffic where it is for the pictures.
  await s.w(() => { for (const n of window.witchspace.npcs) { n.__hold = n.obj.position.clone(); } });
  const hold = () => s.w(() => { for (const n of window.witchspace.npcs) if (n.__hold) n.obj.position.copy(n.__hold); });
  await hold();
  // The radio's cards (the pirate's demand) would cover the view: the Radio pill stays.
  await s.w(() => { const c = document.querySelector('#radio-cards'); if (c) c.style.visibility = 'hidden'; });
  await wait(300);

  await shoot(s.page, 'flight', {
    callouts: [
      ['Left side', '#touch .aim-pad span', 'l'],
      ['Speed', '#touch .speed'],
      ['Fire', '#touch .fire'],
      ['Missile', '#touch .missile'],
      ['ECM', '#touch .ecm'],
      ['The big button', '#touch .context-button'],
      ['The arrow', '#view-button'],
      ['The camera', '#photo-button'],
      ['The scanner', '#scanner', 't'],
      ['The radio', '#radio'],
    ],
  });
  await hold();
  await shoot(s.page, 'dashboard', {
    of: '.dash',
    pad: 4,
    callouts: [
      ['The scanner', '#scanner', 't'],
      ['SH · HL', '#g-shields', 'l'],
      ['SP · FU', '#g-speed', 'l'],
      ['LT', '#g-laser', 'l'],
      ['CT', '#g-temp', 'l'],
      ['RL · DC', '#g-roll', 'l'],
      ['The compass', '#compass', 'tl'],
      ['AUTO · DARK', '#dc-light'],
      ['The pips', '#missile-pips'],
    ],
  });
  await hold();
  await shoot(s.page, 'scanner', { of: '#scanner', pad: 2 });

  // The compass: the station behind you (out here), then ahead.
  await shoot(s.page, 'compass-behind', { of: '#compass', pad: 3 });
  await s.w(() => { const w = window.witchspace; w.player.obj.lookAt(w.station.root.position); });
  await wait(300);
  const ahead = await s.w(() => { const w = window.witchspace; return w.player.forward().dot(w.station.root.position.clone().sub(w.player.obj.position).normalize()); });
  if (ahead < 0.5) await s.w(() => { const w = window.witchspace; const p = w.player.obj; p.lookAt(p.position.clone().multiplyScalar(2).sub(w.station.root.position)); });
  await wait(300);
  await shoot(s.page, 'compass-ahead', { of: '#compass', pad: 3 });

  // The arrow: tapped, with the picker open; then held and slid left, a glance.
  await s.w(() => { const w = window.witchspace; const p = w.player.obj; p.lookAt(p.position.clone().multiplyScalar(2).sub(w.station.root.position)); });
  await s.page.locator('#view-button').click();
  await wait(400);
  await shoot(s.page, 'views-picker');
  await s.page.locator('#view-picker [data-view="front"]').click();
  await wait(300);
  const b = await s.page.locator('#view-button').boundingBox();
  const l = await s.page.locator('#view-picker [data-view="left"]').boundingBox().catch(() => null);
  await s.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await s.page.mouse.down();
  await wait(450);
  if (l) await s.page.mouse.move(l.x + l.width / 2, l.y + l.height / 2, { steps: 6 });
  else await s.page.mouse.move(b.x - 60, b.y + b.height / 2, { steps: 6 });
  await wait(500);
  await shoot(s.page, 'views-glance');
  await s.page.mouse.up();
  await wait(300);

  // The drawer, open.
  await s.page.locator('#touch .drawer-tab').click();
  await wait(500);
  await shoot(s.page, 'drawer');
  await s.page.locator('#touch .drawer-tab').click();
  await wait(300);

  // Docking: speed asked for high, then the docking computer brings her in; the picture is taken on
  // the approach with everything green, and the speed slider's fill below its tick.
  await s.w(() => { const w = window.witchspace; const p = w.player.obj; p.position.copy(w.station.root.position).add(p.position.clone().sub(w.station.root.position).normalize().multiplyScalar(6000)); });
  const sp = await s.page.locator('#touch .speed').boundingBox();
  await s.page.mouse.move(sp.x + sp.width / 2, sp.y + sp.height - 4);
  await s.page.mouse.down();
  await s.page.mouse.move(sp.x + sp.width / 2, sp.y + sp.height * 0.15, { steps: 8 });
  await s.page.mouse.up();
  await s.w(() => window.witchspace.setAutopilot(true));
  let green = false;
  let apart = false;
  for (let i = 0; i < 240 && !(green && apart); i++) {
    await wait(250);
    const st = await s.w(() => ({
      shown: !document.querySelector('#dock-aid').hidden,
      dist: parseInt(document.querySelector('#aid-dist').textContent ?? '0', 10),
      ok: document.querySelector('#aid-heading').classList.contains('ok') && document.querySelector('#aid-roll').classList.contains('ok'),
      apart: document.querySelector('#touch .speed').classList.contains('apart'),
      state: window.witchspace.state,
    }));
    if (st.state !== 'flying') break;
    if (st.apart && !apart) {
      apart = true;
      await shoot(s.page, 'speed', { of: '#touch .speed', pad: 3 });
    }
    if (st.shown && st.ok && st.dist > 250 && st.dist < 1600 && !green) {
      green = true;
      await shoot(s.page, 'approach');
    }
  }
  if (!green) console.error('approach: never all green');
  if (!apart) console.error('speed: the fill never left the tick');
  await s.page.context().close();
}

// --- Upright, docked: Your moments --------------------------------------------------------
{
  const s = await commander('iPhone 13');
  await launch(s);
  // A fight to keep: a pirate in the sights, shot down; and a photo of the view.
  await s.w(() => {
    const w = window.witchspace;
    for (let k = 0; k < 20 && !w.npcs.some((n) => n.role === 'pirate'); k++) w.spawnPirates(w.player.obj.position);
    for (const n of w.npcs.filter((n) => n.role === 'pirate')) { n.obj.position.copy(w.player.obj.position).addScaledVector(w.player.forward(), 900); n.hostile = true; }
  });
  await wait(2500);
  await s.w(() => { const w = window.witchspace; for (const n of w.npcs.filter((n) => n.role === 'pirate')) for (let i = 0; i < 40; i++) w.playerHitNpc(n, 1); });
  await wait(4000);
  await s.key('KeyP');
  await wait(2500);
  await s.w(() => { const w = window.witchspace; w.player.speed = 0; w.setAutopilot(true); });
  for (let i = 0; i < 150 && (await s.w(() => window.witchspace.state)) !== 'docked'; i++) await wait(1000);
  for (let i = 0; i < 20 && (await s.w(() => document.querySelector('#trip-sheet')?.hidden !== false)); i++) await wait(500);
  await wait(1500);
  if (await s.w(() => document.querySelector('#trip-sheet')?.hidden === false)) await shoot(s.page, 'moments');
  else console.error('moments: the sheet never opened');
  await s.page.context().close();
}

await browser.close();
// One line a picture, to keep the diff readable when a control moves.
writeFileSync('src/content/manualShots.json', `{\n${Object.entries(shots).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`);
console.log('Wrote src/content/manualShots.json');
