// The look check: Witchspace's signature Neo look, photographed and compared with its reference
// pictures, so the look can't change by accident (Mark, 31 October 2026: "Lets get this right and
// locked down so we do not go changing it without serious consideration"). See docs/design/neo-look.md.
//
// It draws fixed scenes with the game's own code (src/render), with the clock stopped and the stars
// seeded so every run is the same: the fleet in its role colours (and a Dark Edition's deep violet,
// where issue #292's uneven glow shows), a planet's edge against the stars and the sun, the hangar,
// and the stars alone. Each on a computer's 1× screen and on a phone, since the two glow differently.
//
//   npm run dev -- --port 5311 &
//   node tools/look-check.mjs            compare with tools/look/reference/; differences go to tools/look/out/
//   node tools/look-check.mjs --accept   make the pictures just taken the new reference (only with Mark's yes)
//
// Exits 1 if any picture differs. Needs Playwright with Chrome, like tools/smoke.mjs.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5311';
const ACCEPT = process.argv.includes('--accept');
const REF = 'tools/look/reference';
const OUT = 'tools/look/out';
/** A pixel counts as changed past this much in any channel (of 255): runs are identical, so this only absorbs a driver's rounding. */
const PIXEL = 6;
/** A picture fails if more than this share of its pixels changed. */
const SHARE = 0.002;

const { chromium, devices } = await import('playwright');
mkdirSync(REF, { recursive: true });
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });

const DEVICES = {
  computer: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { ...devices['iPhone 13 landscape'] },
};
const SCENES = ['fleet', 'planet', 'hangar', 'stars'];

// Same every run: a seeded Math.random (the stars) and a clock that only moves when told.
const FREEZE = () => {
  let s = 20261031;
  Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const t0 = 1_793_000_000_000;
  Date.now = () => t0;
  performance.now = () => 1000;
  // The game's own loop never runs: the check draws each scene itself.
  window.requestAnimationFrame = () => 0;
};

/** Draw one scene with the game's code and return it as a JPEG data URL of the canvas (small enough to keep in the repo, and the same every run). */
const DRAW = async (name) => {
  const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => import('three'));
  const r = await import('/src/render/renderer.ts');
  const { buildShip } = await import('/src/render/shipModel.ts');
  const { buildPlanet, buildSun } = await import('/src/render/bodies.ts');
  const { buildHangar } = await import('/src/render/hangar.ts');
  const { shipById } = await import('/src/content/ships.ts');
  const space = r.makeSpace();
  const scene = space.scene;
  const cam = r.camera;
  cam.position.set(0, 0, 0);
  cam.up.set(0, 1, 0);
  const add = (o, x, y, z) => (o.position.set(x, y, z), scene.add(o), o);
  if (name === 'fleet') {
    // Every role colour, and a Dark Edition's deep violet (the paint #292 is about).
    const ids = ['cobra-mk3', 'viper', 'sidewinder', 'mamba', 'fer-de-lance', 'lancer', 'falcon', 'bastion'];
    const defs = ids.map((id) => shipById(id)).filter(Boolean);
    const fdl = shipById('fer-de-lance');
    defs.push({ ...fdl, id: 'dark-edition', style: { ...fdl.style, lineColor: '#8f6bff' } });
    defs.forEach((def, i) => {
      const m = buildShip(def).root;
      const ext = Math.max(...def.geometry.vertices.map((v) => Math.hypot(...v)));
      m.scale.setScalar(40 / ext);
      m.rotation.set(0.45, 0.7 + i * 0.3, 0.1);
      add(m, ((i % 3) - 1) * 95, (1 - Math.floor(i / 3)) * 62, -260);
    });
    cam.lookAt(0, 0, -260);
  } else if (name === 'planet') {
    add(buildPlanet(5000, '#7fe3ff'), 0, 0, -14000);
    add(buildSun(4000), -60000, 22000, -40000);
    cam.position.set(4300, 1200, -6800);
    cam.lookAt(4800, 1500, -14000);
  } else if (name === 'hangar') {
    add(buildHangar(), 0, 0, 0);
    add(buildShip(shipById('cobra-mk3')).root, 0, 12, 0);
    cam.position.set(-70, 45, 120);
    cam.lookAt(0, 10, 0);
  } else {
    cam.lookAt(0, 0.3, -1);
  }
  space.stars.position.copy(cam.position);
  cam.updateMatrixWorld();
  r.setRetro(false);
  // Twice: the first draw compiles the shaders.
  r.render(scene);
  r.render(scene);
  return document.querySelector('#neo').toDataURL('image/jpeg', 0.92);
};

/** Compare two PNG data URLs in the page: share of changed pixels, and a picture of where. */
const DIFF = async ([a, b, PIXEL]) => {
  const load = async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, img.width, img.height);
  };
  const [x, y] = await Promise.all([load(a), load(b)]);
  if (x.width !== y.width || x.height !== y.height) return { share: 1, map: null };
  const map = new OffscreenCanvas(x.width, x.height);
  const mg = map.getContext('2d');
  const out = mg.createImageData(x.width, x.height);
  let changed = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
    const hit = d > PIXEL;
    if (hit) changed++;
    out.data[i] = hit ? 255 : y.data[i] * 0.3;
    out.data[i + 1] = hit ? 40 : y.data[i + 1] * 0.3;
    out.data[i + 2] = hit ? 90 : y.data[i + 2] * 0.3;
    out.data[i + 3] = 255;
  }
  mg.putImageData(out, 0, 0);
  const blob = await map.convertToBlob({ type: 'image/png' });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { share: changed / (x.width * x.height), map: `data:image/png;base64,${btoa(s)}` };
};

const bytes = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
const asDataUrl = (file) => `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`;
let failed = 0;
for (const [device, ctx] of Object.entries(DEVICES)) {
  for (const scene of SCENES) {
    const page = await (await browser.newContext(ctx)).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(FREEZE);
    await page.goto(`${BASE}/play/`);
    await page.waitForSelector('#neo');
    await page.waitForTimeout(1500);
    const shot = await page.evaluate(DRAW, scene);
    const name = `${scene}-${device}.jpg`;
    writeFileSync(`${OUT}/${name}`, bytes(shot));
    if (ACCEPT || !existsSync(`${REF}/${name}`)) {
      writeFileSync(`${REF}/${name}`, bytes(shot));
      console.log(`${ACCEPT ? 'ACCEPTED' : 'NEW     '}  ${name}`);
    } else {
      const { share, map } = await page.evaluate(DIFF, [asDataUrl(`${REF}/${name}`), shot, PIXEL]);
      const ok = share <= SHARE;
      if (!ok) {
        failed++;
        if (map) writeFileSync(`${OUT}/${scene}-${device}.diff.png`, bytes(map));
      }
      console.log(`${ok ? 'SAME    ' : 'CHANGED '}  ${name} · ${(share * 100).toFixed(3)}% of pixels${ok ? '' : ` · see ${OUT}/${scene}-${device}.diff.png`}`);
    }
    if (errors.length) {
      failed++;
      console.log(`ERROR     ${name} · ${errors[0]}`);
    }
    await page.context().close();
  }
}
await browser.close();
if (failed) {
  console.log(`\n${failed} picture(s) changed. If the change is meant, show Mark the pictures in ${OUT}/, and only with his yes run: node tools/look-check.mjs --accept`);
  process.exit(1);
}
console.log('\nThe Neo look is unchanged.');
