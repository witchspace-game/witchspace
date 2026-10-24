// Press screenshots, set up scene by scene so they can be taken again whenever
// the game changes. Each scene stages a moment through the dev build's
// window.witchspace handle and takes a burst of frames; pick the best from the
// contact sheet. Fights involve chance, so bursts, not single frames.
//
//   npm run dev   (in another terminal)
//   PLAYWRIGHT=/path/to/playwright/index.mjs node tools/press-shots.mjs [scene ...] [--out dir] [--url http://localhost:5183]
//
// With no scenes, takes all the stills. Scenes named clip-* record video
// instead (all of them with "clips"): the game's clock is stepped a frame at a
// time, so every clip is a smooth 30 fps however slowly the GPU draws. The
// trailer is cut from them by tools/press-video.mjs. Output lands in
// press-shots/ (git-ignored).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const OUT = opt('--out', 'press-shots');
const URL = opt('--url', 'http://localhost:5183');
const { chromium, devices } = await import(process.env.PLAYWRIGHT ?? 'playwright');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A fresh Modern commander, docked at Lave. */
async function start({ viewport = { width: 1920, height: 1080 }, scale = 1, device, touch = false } = {}) {
  // scale 1.5 at 1280×720 is still a 1920×1080 picture, with the HUD big enough to read.
  if (scale !== 1) viewport = { width: Math.round(1920 / scale), height: Math.round(1080 / scale) };
  const ctx = await browser.newContext(device ? { ...devices[device] } : { viewport, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  // Touch mode counts as aiming (a headless browser can't lock the pointer), so the gimbals swing onto targets.
  await page.goto(`${URL}/play/${touch ? '?touch' : ''}`);
  await page.waitForFunction(() => window.witchspace);
  await wait(1200);
  const key = (code) => page.evaluate((c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); }, code);
  const state = () => page.evaluate(() => window.witchspace.state);
  await key('KeyN'); // a new commander, even if one is saved
  await wait(400);
  for (let i = 0; i < 12 && (await state()) !== 'docked'; i++) { await key('Enter'); await wait(500); }
  // A Cobra worth showing: military lasers on all four mounts, gimbals, and the kit a commander earns.
  await page.evaluate(() => {
    const w = window.witchspace;
    const c = w.commander;
    c.lasers = { front: 'military', rear: 'military', left: 'military', right: 'military' };
    c.equipment = [...new Set([...c.equipment, 'gimbal-mount', 'combat-computer', 'ecm', 'extra-energy', 'large-cargo-bay', 'fuel-scoops', 'docking-computer', 'escape-pod', 'survey-scanner', 'galactic-hyperdrive'])];
    c.kills = 412;
    c.credits = 18450;
    w.renderDocked();
  });
  // Quiet: no sound, and no account prompts over the picture.
  await page.addStyleTag({ content: '#keys-hint, #mouse-prompt, #account-nudge, .account-nudge, #install-hint { display: none !important; } body.clean > :not(#neo):not(#retro) { visibility: hidden !important; }' });
  return { ctx, page, key, state };
}

async function launch(s) {
  await s.key('KeyL');
  for (let i = 0; i < 20 && (await s.state()) !== 'flying'; i++) await wait(500);
  await wait(2500);
}

/** Hyperspace to a system (by name or a test on its data) and wait to arrive. */
async function jump(s, pick) {
  const index = await s.page.evaluate(async (pick) => {
    const g = await import('/src/galaxy/generate.ts');
    const all = g.galaxy(0);
    return typeof pick === 'string' ? all.findIndex((x) => x.name.toLowerCase() === pick.toLowerCase()) : all.findIndex((x, k) => k !== 7 && x.government === pick.government);
  }, pick);
  await s.page.evaluate((i) => window.witchspace.jumpTo(i), index);
  for (let k = 0; k < 40; k++) {
    await wait(1000);
    if (k > 12 && (await s.state()) === 'flying') break;
  }
  await wait(3000);
  return index;
}

/** A burst of frames; with clean, each frame twice, the second without the HUD. */
async function burst(s, name, { count = 10, every = 350, clean = false } = {}) {
  for (let i = 0; i < count; i++) {
    const n = String(i).padStart(2, '0');
    if (clean) {
      await s.page.evaluate(() => document.body.classList.add('clean'));
      await s.page.screenshot({ path: join(OUT, `${name}-${n}-clean.jpg`), quality: 92 });
      await s.page.evaluate(() => document.body.classList.remove('clean'));
    }
    await s.page.screenshot({ path: join(OUT, `${name}-${n}.jpg`), quality: 92 });
    await wait(every);
  }
}

/**
 * The director: each frame, turn the ship towards the nearest ship of a role
 * (a little off the nose, for a better picture) and, if asked, hold the guns.
 */
async function direct(s, { role = 'pirate', offset = 0.06, fire = true } = {}) {
  await s.page.evaluate(({ role, offset }) => {
    const w = window.witchspace;
    clearInterval(window.__director);
    window.__director = setInterval(() => {
      const me = w.player.obj;
      const them = w.npcs.filter((n) => n.role === role && !n.dead);
      if (!them.length) return;
      them.sort((a, b) => a.obj.position.distanceTo(me.position) - b.obj.position.distanceTo(me.position));
      const look = me.clone();
      look.lookAt(them[0].obj.position);
      look.rotateY(offset);
      me.quaternion.slerp(look.quaternion, 0.08);
      w.player.speed = Math.min(w.player.speed, 140);
      // The camera mustn't die mid-shoot.
      w.player.hull = Math.max(w.player.hull, 60);
      w.player.shields = Math.max(w.player.shields, 30);
    }, 16);
  }, { role, offset });
  if (fire) await s.page.keyboard.down('KeyF');
}

const FPS = 30;

/**
 * Record the game's own picture (no HUD) for a number of seconds, stepping its
 * clock frame by frame. Cues run at given seconds: { 1.2: async () => ... }.
 */
async function record(s, name, secs, cues = {}) {
  await s.page.addScriptTag({ path: 'node_modules/mp4-muxer/build/mp4-muxer.js' });
  await s.page.evaluate((fps) => {
    const out = new OffscreenCanvas(1920, 1080);
    const g = out.getContext('2d');
    const target = new Mp4Muxer.ArrayBufferTarget();
    const mux = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: 1920, height: 1080, frameRate: fps }, fastStart: 'in-memory' });
    const enc = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: (e) => console.log('REC', e.message) });
    enc.configure({ codec: 'avc1.640033', width: 1920, height: 1080, bitrate: 20e6, framerate: fps });
    let n = 0;
    const visible = () => ['#tunnel', '#retro', '#neo'].map((q) => document.querySelector(q)).find((c) => c && !c.hidden && getComputedStyle(c).display !== 'none');
    window.__rec = {
      grab() {
        const c = visible();
        g.fillStyle = '#000';
        g.fillRect(0, 0, 1920, 1080);
        g.drawImage(c, 0, 0, 1920, 1080);
        const f = new VideoFrame(out, { timestamp: Math.round((n * 1e6) / fps), duration: Math.round(1e6 / fps) });
        enc.encode(f, { keyFrame: n % fps === 0 });
        f.close();
        n++;
      },
      async finish() {
        await enc.flush();
        mux.finalize();
        window.__recBytes = new Uint8Array(target.buffer);
        return window.__recBytes.length;
      },
      chunk(i, size) {
        const b = window.__recBytes.subarray(i, i + size);
        let str = '';
        for (let k = 0; k < b.length; k += 0x8000) str += String.fromCharCode(...b.subarray(k, k + 0x8000));
        return btoa(str);
      },
    };
  }, FPS);
  // The last real frame time the game saw, plus a margin, so its next frame time is later.
  await s.page.evaluate(() => {
    window.__trackT = true;
    const loop = (t) => window.__trackT && ((window.__lastT = t), requestAnimationFrame(loop));
    requestAnimationFrame(loop);
  });
  await wait(150);
  await s.page.evaluate(() => {
    window.__trackT = false;
    window.__realNow = Math.max(window.__lastT ?? 0, performance.now()) + 50;
  });
  await s.page.clock.install();
  // Take each frame straight after the game draws it, in the same callback: read any later and the canvas may be blank.
  // Time carries on from the real clock (frame times and performance.now alike), so the game never sees it run backwards.
  // From here the recorder runs the frames: frame callbacks are queued and run exactly once per
  // video frame, a fixed 1/30 s apart, so the game moves the same amount every frame (left to the
  // browser, a step could hold one game frame or two, and the motion stutters).
  await s.page.evaluate(() => {
    const fakeNow = performance.now.bind(performance);
    const offset = window.__realNow - fakeNow();
    performance.now = () => fakeNow() + offset;
    window.__rafQ = [];
    window.requestAnimationFrame = (cb) => (window.__rafQ.push(cb), window.__rafQ.length);
    window.__frame = (grab) => {
      const q = window.__rafQ;
      window.__rafQ = [];
      const t = performance.now();
      for (const cb of q) cb(t);
      if (grab) window.__rec.grab();
    };
  });
  for (let i = 0; i < 12; i++) {
    // A few frames to settle before the first one kept.
    await s.page.clock.runFor(1000 / FPS);
    await s.page.evaluate(() => window.__frame(false));
  }
  const frames = Math.round(secs * FPS);
  const pending = Object.entries(cues).map(([t, fn]) => [Math.round(Number(t) * FPS), fn]);
  for (let i = 0; i < frames; i++) {
    for (const [at, fn] of pending) if (at === i) await fn();
    await s.page.clock.runFor(1000 / FPS);
    await s.page.evaluate(() => window.__frame(true));
  }
  const size = await s.page.evaluate(() => window.__rec.finish());
  // An encoder that fails quietly leaves a near-empty file: say so rather than cut a film from it.
  if (size < 100_000) throw new Error(`${name}: only ${size} bytes recorded; record it again`);
  const parts = [];
  for (let i = 0; i < size; i += 4 << 20) parts.push(Buffer.from(await s.page.evaluate(([i, n]) => window.__rec.chunk(i, n), [i, 4 << 20]), 'base64'));
  writeFileSync(join(OUT, `${name}.mp4`), Buffer.concat(parts));
  console.log(`  ${name}.mp4 · ${frames} frames · ${(size / 1048576).toFixed(1)} MB`);
}

/** Remember the camera's starting frame; window.__at([x, y, z]) maps from it to the world. */
const frame0 = (s) =>
  s.page.evaluate(() => {
    const me = window.witchspace.player.obj;
    const p0 = me.position.clone();
    window.__q0 = me.quaternion.clone();
    window.__at = ([x, y, z]) => new p0.constructor(-x, y, z).applyQuaternion(window.__q0).add(p0);
  });

/** Run fn(t) every few milliseconds of game time from now (t in seconds): the director. */
const animate = (s, fn) =>
  s.page.evaluate((src) => {
    const w = window.witchspace;
    const fn = eval(`(${src})`);
    // Once a frame, in step with what's drawn (a timer drifts against the frames and the camera wobbles).
    // Elapsed time by summing small steps, so the jump when the recorder takes over the clock doesn't count.
    let t = 0;
    let last = performance.now();
    const id = (window.__directorId = (window.__directorId ?? 0) + 1);
    const step = () => {
      if (window.__directorId !== id) return; // a newer director took over
      requestAnimationFrame(step);
      const now = performance.now();
      t += Math.min(Math.max(now - last, 0), 50) / 1000;
      last = now;
      w.player.speed = 0;
      w.player.hull = 100;
      w.player.shields = 100;
      fn(t);
      // The gimbals: aim at the nearest pirate in reach of the nose (the aim clamps to what they can swing to).
      const me = w.player.obj.position;
      const near = w.npcs.filter((n) => n.role === 'pirate' && !n.dead).sort((a, b) => a.obj.position.distanceTo(me) - b.obj.position.distanceTo(me))[0];
      if (near) {
        w.aim.dir.copy(near.obj.position).sub(me).normalize();
        w.aim.clamp(w.player);
      } else w.aim.reset(w.player);
    };
    requestAnimationFrame(step);
    fn(0);
  }, fn.toString());

/** Break up the i-th pirate, as a hit from the player's guns. */
const kill = (s, i) =>
  s.page.evaluate((i) => {
    const w = window.witchspace;
    const t = w.npcs.filter((n) => n.role === 'pirate')[i];
    if (t && !t.dead) w.playerHitNpc(t, 9999);
  }, i);

/** Dock at the system in the worst crisis in the news (a famine, a shortage), with money and cargo to trade. */
const dockAtCrisis = (s) =>
  s.page.evaluate(async () => {
    const { galaxy } = await import('/src/galaxy/generate.ts');
    const { EVENT_KINDS, newsAt } = await import('/src/economy/events.ts');
    const { COMMODITIES } = await import('/src/economy/commodities.ts');
    const { drift, equilibriumPrice, freshMarket, priceAt } = await import('/src/economy/market.ts');
    const now = Date.now();
    let best = null;
    for (const n of newsAt(galaxy(0)[7], now)) {
      if (now > n.event.end) continue;
      for (const [id, shift] of Object.entries(EVENT_KINDS[n.event.type].effects)) {
        const i = COMMODITIES.findIndex((c) => c.id === id);
        if (shift >= 0 || i < 0) continue;
        const sys = galaxy(0)[n.event.system];
        const c = COMMODITIES[i];
        const pct = priceAt(sys, freshMarket(sys, now), id, now) / (equilibriumPrice(sys, c, i) * drift(sys, c, i, now)) - 1;
        if (!best || pct > best.pct) best = { system: n.event.system, name: sys.name, good: id, pct };
      }
    }
    const w = window.witchspace;
    if (best) w.commander.location.system = best.system;
    w.commander.cargo = { [best?.good ?? 'food']: 12, computers: 4 };
    w.renderDocked();
    return best;
  });

const tab = (s, name) => s.page.click(`.tabs [data-tab="${name}"]`);

/** Face the planet from a way off, so it fills the background. */
const facePlanet = (s, distance = 3.2) =>
  s.page.evaluate((distance) => {
    const w = window.witchspace;
    const { planetPos } = w.explore;
    const away = w.player.obj.position.clone().sub(planetPos).normalize();
    const r = w.explore.bodies?.[0]?.radius ?? 20000;
    w.player.obj.position.copy(planetPos).addScaledVector(away, r * distance);
    w.player.obj.lookAt(planetPos);
    w.player.speed = 0;
  }, distance);

/** Pirates in a loose pack ahead, closing. */
const pirates = (s, distance = 900) =>
  s.page.evaluate((distance) => {
    const w = window.witchspace;
    for (let i = 0; i < 8 && w.npcs.filter((n) => n.role === 'pirate').length < 3; i++) w.spawnPirates(w.player.obj.position.clone().addScaledVector(w.player.forward(), -4200));
    const me = w.player.obj;
    const fwd = w.player.forward();
    const pack = w.npcs.filter((n) => n.role === 'pirate');
    pack.forEach((n, i) => {
      const side = new me.position.constructor((i - 1) * 220, (i % 2 ? 1 : -1) * 90, 0).applyQuaternion(me.quaternion);
      n.obj.position.copy(me.position).addScaledVector(fwd, distance + i * 160).add(side);
      n.obj.lookAt(me.position);
    });
    return pack.map((n) => n.def.id);
  }, distance);

const SCENES = {
  /** A pirate pack in an anarchy. */
  async pack() {
    const s = await start();
    await launch(s);
    await jump(s, { government: 0 });
    await facePlanet(s);
    console.log('  pirates:', await pirates(s));
    await direct(s, { fire: false, offset: 0.1 });
    await wait(1200);
    await burst(s, 'pack-in', { count: 8, every: 250 });
    await s.page.keyboard.down('KeyF');
    await burst(s, 'pack', { count: 30, every: 300, clean: true });
    await s.ctx.close();
  },

  /** The Falcon, running dark, close enough to read her hull. */
  async falcon() {
    const s = await start();
    await launch(s);
    await jump(s, { government: 0 });
    await facePlanet(s, 2.6);
    for (const [name, dist, side] of [['falcon-a', 110, 30], ['falcon-b', 160, -50], ['falcon-c', 75, 14]]) {
      await s.page.evaluate(([dist, side]) => {
        const w = window.witchspace;
        for (const n of w.npcs.filter((n) => n.def.id === 'falcon')) n.obj.position.set(1e9, 1e9, 1e9);
        w.spawnFalcon();
        const f = w.npcs.find((n) => n.def.id === 'falcon' && n.obj.position.x < 1e8);
        const me = w.player.obj;
        const right = new me.position.constructor(side, side * 0.25, 0).applyQuaternion(me.quaternion);
        f.obj.position.copy(me.position).addScaledVector(w.player.forward(), dist).add(right);
        f.obj.lookAt(me.position.clone().addScaledVector(w.player.forward(), dist).add(right.clone().multiplyScalar(-4)));
        // Hold her there, drifting slowly across, so the frames catch her close.
        const at = f.obj.position.clone();
        const drift = right.clone().setLength(-0.25);
        clearInterval(window.__hold);
        window.__hold = setInterval(() => f.obj.position.copy(at.add(drift)), 16);
      }, [dist, side]);
      await burst(s, name, { count: 8, every: 200, clean: true });
    }
    await s.ctx.close();
  },

  /** Trading from the dock: the exchange at a market in crisis. */
  async market() {
    const s = await start();
    console.log('  crisis:', await dockAtCrisis(s));
    await tab(s, 'market');
    await wait(1500);
    await s.page.screenshot({ path: join(OUT, 'market-00.jpg'), quality: 92 });
    await s.ctx.close();
  },

  /** The news, and a system in it opened on the chart with a route planned. */
  async news() {
    const s = await start();
    await tab(s, 'news');
    await wait(800);
    await s.page.screenshot({ path: join(OUT, 'news-00.jpg'), quality: 92 });
    const link = await s.page.$('#news-list .sys-link');
    if (link) {
      await link.click();
      await wait(1500);
      await s.page.screenshot({ path: join(OUT, 'news-01-chart.jpg'), quality: 92 });
      await s.key('Enter'); // set it as the destination: the route is planned
      await wait(1200);
      await s.page.screenshot({ path: join(OUT, 'news-02-route.jpg'), quality: 92 });
      await s.key('Tab');
      await wait(1200);
      await s.page.screenshot({ path: join(OUT, 'news-03-local.jpg'), quality: 92 });
    } else console.log('  no news links');
    await s.ctx.close();
  },

  /** Wexley-Yorozu's Titanoboa building a station: four views. */
  async yard() {
    const s = await start();
    await launch(s);
    const yards = await s.page.evaluate(() => window.witchspace.yards());
    if (!yards.length) return console.log('  no yards at work');
    await s.page.evaluate((i) => window.witchspace.jumpTo(i), yards[0].system);
    for (let i = 0; i < 40 && !(await s.page.evaluate(() => window.witchspace.state === 'flying' && window.witchspace.yard)); i++) await wait(1000);
    await wait(4000);
    await s.page.evaluate(() => { for (const n of window.witchspace.npcs) n.hostile = false; });
    for (const [name, dist, up, side, atStation] of [['yard-far', 9000, 2500, -3000, false], ['yard-mid', 3500, 900, -1500, false], ['yard-close', 900, 350, 600, false], ['yard-station', 450, 150, -350, true]]) {
      await s.page.evaluate(([dist, up, side, atStation]) => {
        const w = window.witchspace;
        const y = w.yard;
        const target = atStation && y.station ? y.station.root.position.clone() : y.centre.clone();
        const off = new target.constructor(dist, up, side).applyQuaternion(y.titan.root.quaternion);
        w.player.obj.position.copy(target).add(off);
        w.player.obj.up.set(0, 1, 0);
        w.player.obj.lookAt(target);
        w.player.speed = 0;
      }, [dist, up, side, atStation]);
      await wait(1500);
      await burst(s, name, { count: 2, every: 1500, clean: true });
    }
    await s.ctx.close();
  },

  /** Leaving the station: the Coriolis, traffic and police. */
  async station() {
    const s = await start();
    await launch(s);
    for (const [name, x, y, z] of [['station-a', 260, 90, 700], ['station-b', -380, -120, 520], ['station-c', 90, 40, 1100]]) {
      await s.page.evaluate(([x, y, z]) => {
        const w = window.witchspace;
        const st = w.station.root.position;
        w.player.obj.position.copy(w.station.toWorld(new st.constructor(x, y, z)));
        w.player.obj.lookAt(st);
        w.player.speed = 0;
      }, [x, y, z]);
      await wait(2500);
      await burst(s, name, { count: 3, every: 1200, clean: true });
    }
    await s.ctx.close();
  },

  /** Surveying a world: low over the planet, the survey bar filling. */
  async survey() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await jump(s, 'Diso');
    await s.page.evaluate(() => {
      const w = window.witchspace;
      const b = w.explore.bodies[0];
      const up = w.player.obj.position.clone().sub(b.centre).normalize();
      w.player.obj.position.copy(b.centre).addScaledVector(up, b.radius * 1.35);
      // Look along the horizon, the limb across the frame.
      const side = new up.constructor(0, 1, 0).cross(up).normalize();
      w.player.obj.up.copy(up);
      w.player.obj.lookAt(w.player.obj.position.clone().addScaledVector(side, b.radius).addScaledVector(up, -b.radius * 0.55));
      w.player.speed = 0;
    });
    await wait(6000);
    await burst(s, 'survey', { count: 3, every: 4000, clean: true });
    await s.ctx.close();
  },

  /** Signals: a wreck or a beacon, found out in the dark. */
  async wreck() {
    const s = await start();
    await launch(s);
    for (const name of ['Diso', 'Zaonce', 'Reorte', 'Isinor']) {
      const found = await s.page.evaluate(() => window.witchspace.explore.pois.length);
      if (found) break;
      await jump(s, name);
    }
    const pois = await s.page.evaluate(() => window.witchspace.explore.pois.map((p) => p.poi.kind ?? p.poi.id));
    console.log('  signals:', pois);
    for (let i = 0; i < pois.length; i++) {
      await s.page.evaluate((i) => {
        const w = window.witchspace;
        const p = w.explore.pois[i];
        p.revealed = true;
        const r = p.models?.[0]?.radius ?? 60;
        w.player.obj.position.copy(p.position).add(new p.position.constructor(r * 2.2, r * 0.8, r * 3));
        w.player.obj.lookAt(p.position);
        w.player.speed = 0;
      }, i);
      await wait(2500);
      await burst(s, `wreck-${i}`, { count: 2, every: 2000, clean: true });
    }
    await s.ctx.close();
  },

  /** The same moment in neo-vector and in 1984, for the slider: the pack frozen close, the planet behind. */
  async look() {
    const s = await start();
    await launch(s);
    await jump(s, { government: 0 });
    for (let i = 0; i < 3; i++) {
      await facePlanet(s, 3.2 + i * 0.5);
      await pirates(s, 170 + i * 40);
      await s.page.evaluate((i) => {
        const w = window.witchspace;
        const me = w.player.obj;
        // Turn each one a little, so the pack reads as ships, not edges.
        w.npcs.filter((n) => n.role === 'pirate').forEach((n, k) => n.obj.lookAt(me.position.clone().add(new me.position.constructor(400 * (k - 1), 150 + 60 * i, 0).applyQuaternion(me.quaternion))));
        const keep = w.npcs.map((n) => [n, n.obj.position.clone(), n.obj.quaternion.clone()]);
        clearInterval(window.__freeze);
        window.__freeze = setInterval(() => keep.forEach(([n, p, q]) => { n.obj.position.copy(p); n.obj.quaternion.copy(q); }), 4);
        document.body.classList.add('clean');
      }, i);
      await wait(400);
      await s.page.screenshot({ path: join(OUT, `look-${i}-neo.jpg`), quality: 92 });
      await s.key('KeyM');
      await wait(500);
      await s.page.screenshot({ path: join(OUT, `look-${i}-1984.jpg`), quality: 92 });
      await s.key('KeyM');
      await s.page.evaluate(() => { clearInterval(window.__freeze); document.body.classList.remove('clean'); });
      await wait(800);
    }
    await s.ctx.close();
  },

  /** Company work: the contracts board. */
  async contracts() {
    const s = await start();
    await tab(s, 'contracts');
    await wait(1000);
    await s.page.screenshot({ path: join(OUT, 'contracts-00.jpg'), quality: 92 });
    await s.ctx.close();
  },

  /** On an iPhone: docked, the exchange, the news, and flying in a fight (landscape). */
  async phone() {
    const s = await start({ device: 'iPhone 13' });
    await s.page.screenshot({ path: join(OUT, 'phone-docked.jpg'), quality: 90 });
    await dockAtCrisis(s);
    await tab(s, 'market');
    await wait(1500);
    await s.page.screenshot({ path: join(OUT, 'phone-market.jpg'), quality: 90 });
    await tab(s, 'news');
    await wait(800);
    await s.page.screenshot({ path: join(OUT, 'phone-news.jpg'), quality: 90 });
    await s.ctx.close();
    const f = await start({ device: 'iPhone 13 landscape' });
    await launch(f);
    await jump(f, { government: 0 });
    await facePlanet(f);
    await pirates(f);
    await direct(f, { fire: false, offset: 0.1 });
    await wait(1500);
    await burst(f, 'phone-flight', { count: 10, every: 500 });
    await f.ctx.close();
  },

  /** Kills on camera: the planet behind, each pirate placed where the beams meet, then broken up. */
  async kills() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await jump(s, { government: 0 });
    for (let k = 0; k < 4; k++) {
      await facePlanet(s, 3.0 + k * 0.4);
      await pirates(s, 900);
      await s.page.keyboard.down('KeyF');
      const hit = await s.page.evaluate((k) => {
        const w = window.witchspace;
        const me = w.player.obj;
        w.player.hull = 100;
        w.player.shields = 100;
        const t = w.npcs.find((n) => n.role === 'pirate' && !n.dead);
        if (!t) return null;
        const V = me.position.constructor;
        const off = new V([-40, 35, -25, 50][k], [-18, 10, 22, -8][k], 0).applyQuaternion(me.quaternion);
        t.obj.position.copy(me.position).addScaledVector(w.player.forward(), 260).add(off);
        t.obj.lookAt(me.position.clone().add(new V(300, 80, 0).applyQuaternion(me.quaternion)));
        return t.def.id;
      }, k);
      if (!hit) break;
      await wait(350);
      await s.page.evaluate(() => {
        const w = window.witchspace;
        const t = w.npcs.filter((n) => n.role === 'pirate' && !n.dead).sort((a, b) => a.obj.position.distanceTo(w.player.obj.position) - b.obj.position.distanceTo(w.player.obj.position))[0];
        w.playerHitNpc(t, 9999);
      });
      await burst(s, `kill-${k}`, { count: 7, every: 90, clean: true });
      await s.page.keyboard.up('KeyF');
      await wait(1500);
    }
    await s.ctx.close();
  },

  /** The beacon, close, with the planet behind it. */
  async beacon() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    for (const name of ['Diso', 'Zaonce', 'Reorte', 'Isinor']) {
      if (await s.page.evaluate(() => window.witchspace.explore.pois.length)) break;
      await jump(s, name);
    }
    for (const [name, k] of [['beacon-a', 1], ['beacon-b', 1.8]]) {
      await s.page.evaluate((k) => {
        const w = window.witchspace;
        const p = w.explore.pois[0];
        p.revealed = true;
        const { planetPos } = w.explore;
        // Stand on the far side of the beacon from the planet, a little off the line.
        const away = p.position.clone().sub(planetPos).normalize();
        const side = new away.constructor(0, 1, 0).cross(away).normalize();
        w.player.obj.position.copy(p.position).addScaledVector(away, 70 * k).addScaledVector(side, 28 * k).add(new away.constructor(0, 14 * k, 0));
        w.player.obj.lookAt(p.position);
        w.player.speed = 0;
      }, k);
      await wait(2500);
      await burst(s, name, { count: 2, every: 1500, clean: true });
    }
    await s.ctx.close();
  },

  // --- Clips, for the trailer ------------------------------------------------
  // Each is directed: the camera on a path, the ships flown on set paths, while
  // the game draws its own lasers, explosions and planets. Paths are in the
  // camera's starting frame (x right, y up, z ahead), so the framing holds
  // whichever system it's shot in.

  /** Launch: drifting past a Coriolis station. */
  async 'clip-station'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await animate(s, (t) => {
      const w = window.witchspace;
      const st = w.station.root.position;
      const V = st.constructor;
      const k = t / 6;
      w.player.obj.position.copy(w.station.toWorld(new V(700 - 1100 * k, 220 - 80 * k, 1300 - 500 * k)));
      w.player.obj.lookAt(st);
    });
    await record(s, 'clip-station', 6);
    await s.ctx.close();
  },

  /** The pack, coming in over a ringed planet; the guns open up; two break up. */
  async 'clip-pack'() {
    const s = await start({ scale: 1.5, touch: true });
    await launch(s);
    await jump(s, { government: 0 });
    await facePlanet(s, 3.4);
    await pirates(s, 900);
    await frame0(s);
    await animate(s, (t) => {
      const w = window.witchspace;
      const at = window.__at;
      w.player.obj.position.copy(at([0, 0, 30 * t]));
      w.player.obj.quaternion.copy(window.__q0);
      const lanes = [[-260, 60], [40, -40], [300, 110]];
      w.npcs.filter((n) => n.role === 'pirate').forEach((n, i) => {
        if (n.dead) return;
        const [x, y] = lanes[i % 3];
        const z = Math.max(300, 900 - 120 * t - i * 100);
        n.obj.position.copy(at([(x * z) / 1500, (y * z) / 1500, z + 30 * t]));
        n.obj.lookAt(w.player.obj.position);
      });
    });
    await record(s, 'clip-pack', 6.5, {
      1.6: () => s.page.keyboard.down('KeyF'),
      3.6: () => kill(s, 1),
      5.0: () => kill(s, 0),
    });
    await s.ctx.close();
  },

  /** The Falcon crossing close, wings swept, the camera turning to follow. */
  async 'clip-falcon'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await jump(s, { government: 0 });
    await facePlanet(s, 2.6);
    await s.page.evaluate(() => window.witchspace.spawnFalcon());
    await frame0(s);
    await animate(s, (t) => {
      const w = window.witchspace;
      const at = window.__at;
      const f = w.npcs.find((n) => n.def.id === 'falcon');
      const k = t / 5;
      f.obj.position.copy(at([140 - 300 * k, 30 - 40 * k, 150 + 20 * Math.sin(k * 3)]));
      f.obj.lookAt(at([-400, -60, 160]));
      const look = w.player.obj.clone();
      look.quaternion.copy(window.__q0);
      look.rotateY(0.18 - 0.36 * k);
      w.player.obj.quaternion.copy(look.quaternion);
      w.player.obj.position.copy(at([0, 0, 0]));
    });
    await record(s, 'clip-falcon', 5);
    await s.ctx.close();
  },

  /** Wexley-Yorozu's Titanoboa at work, the camera gliding along her. */
  async 'clip-yard'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    const yards = await s.page.evaluate(() => window.witchspace.yards());
    await s.page.evaluate((i) => window.witchspace.jumpTo(i), yards[0].system);
    for (let i = 0; i < 40 && !(await s.page.evaluate(() => window.witchspace.state === 'flying' && window.witchspace.yard)); i++) await wait(1000);
    await wait(3000);
    await s.page.evaluate(() => { for (const n of window.witchspace.npcs) n.hostile = false; });
    await animate(s, (t) => {
      const w = window.witchspace;
      const y = w.yard;
      const V = y.centre.constructor;
      const k = t / 7;
      const off = new V(1500 - 600 * k, 420 - 100 * k, -1800 + 2600 * k).applyQuaternion(y.titan.root.quaternion);
      w.player.obj.position.copy(y.centre).add(off);
      w.player.obj.up.set(0, 1, 0).applyQuaternion(y.titan.root.quaternion);
      w.player.obj.lookAt(y.centre.clone().add(new V(0, 0, -300 + 600 * k).applyQuaternion(y.titan.root.quaternion)));
    });
    await record(s, 'clip-yard', 7);
    await s.ctx.close();
  },

  /** Surveying: gliding low along a world's horizon. */
  async 'clip-survey'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await jump(s, 'Diso');
    await animate(s, (t) => {
      const w = window.witchspace;
      const b = w.explore.bodies[0];
      if (!window.__up) {
        window.__up = w.player.obj.position.clone().sub(b.centre).normalize();
        window.__side = new window.__up.constructor(0, 1, 0).cross(window.__up).normalize();
      }
      const axis = window.__side.clone().cross(window.__up).normalize();
      const up = window.__up.clone().applyAxisAngle(axis, t * 0.012);
      w.player.obj.position.copy(b.centre).addScaledVector(up, b.radius * 1.28);
      w.player.obj.up.copy(up);
      w.player.obj.lookAt(w.player.obj.position.clone().addScaledVector(window.__side, b.radius).addScaledVector(up, -b.radius * 0.5));
    });
    await record(s, 'clip-survey', 5.5);
    await s.ctx.close();
  },

  /** Hyperspace: the jump, and the tunnel. */
  async 'clip-jump'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await facePlanet(s, 4);
    const target = await s.page.evaluate(async () => (await import('/src/galaxy/generate.ts')).galaxy(0).findIndex((x) => x.name === 'Diso'));
    await record(s, 'clip-jump', 7, { 0.4: () => s.page.evaluate((i) => window.witchspace.jumpTo(i), target) });
    await s.ctx.close();
  },

  /** One key: neo-vector, then 1984, the same moment. */
  async 'clip-look'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await jump(s, { government: 0 });
    await facePlanet(s, 3.4);
    await pirates(s, 300);
    await frame0(s);
    await animate(s, (t) => {
      const w = window.witchspace;
      const at = window.__at;
      w.player.obj.position.copy(at([0, 0, 25 * t]));
      w.player.obj.quaternion.copy(window.__q0);
      w.npcs.filter((n) => n.role === 'pirate').forEach((n, i) => {
        n.obj.position.copy(at([[-120, 20, 110][i % 3] + 12 * t, [-30, 40, -10][i % 3], 300 + 80 * i + 25 * t]));
        n.obj.lookAt(at([600, 100, 0]));
      });
    });
    await record(s, 'clip-look', 6, { 2.6: () => s.key('KeyM') });
    await s.ctx.close();
  },

  /** The docking computer flying you in: the station turning, the slot lining up. */
  async 'clip-dock'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await s.page.evaluate(() => {
      const w = window.witchspace;
      const st = w.station.root.position;
      w.player.obj.position.copy(w.station.toWorld(new st.constructor(260, 110, 1900)));
      w.player.obj.lookAt(st);
      w.player.speed = 0;
      w.aim.reset(w.player);
      for (const n of w.npcs) n.obj.position.set(1e7, 0, 0); // a clear approach
    });
    await wait(1500);
    await record(s, 'clip-dock', 40, { 0.3: () => s.key('KeyC') });
    console.log('  ended', await s.page.evaluate(() => window.witchspace.state));
    await s.ctx.close();
  },

  /** The Co-operative Marshals: a witchspace rift tears open and the Bastion slides through. */
  async 'clip-bastion'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await jump(s, { government: 3 });
    await facePlanet(s, 5);
    await s.page.evaluate(() => {
      const w = window.witchspace;
      w.becomeFugitive(); // so they stay, and launch their Lancers
      w.summonCarrier();
    });
    // Beside and above the rift's mouth, in the carrier's own axes, watching the hull slide out.
    await animate(s, (t) => {
      const w = window.witchspace;
      const c = w.carrier;
      if (!c) return;
      if (!window.__mouth) {
        const o = c.npc.obj;
        const V = o.position.constructor;
        window.__mouth = {
          at: c.rift.group.position.clone(),
          fwd: new V(0, 0, 1).applyQuaternion(o.quaternion),
          up: new V(0, 1, 0).applyQuaternion(o.quaternion),
          right: new V(1, 0, 0).applyQuaternion(o.quaternion),
        };
      }
      const { at, fwd, up, right } = window.__mouth;
      const out = Math.max(0, t - 31) * 50; // metres of hull through
      // Wide on the rift as it opens, then closing in on the hull as it comes out.
      const k = Math.min(1, Math.max(0, (t - 29) / 16));
      const e = k * k * (3 - 2 * k);
      const r = 2600 - 8 * Math.min(t, 29) - 1500 * e;
      w.player.obj.position.copy(at).addScaledVector(right, r).addScaledVector(up, 1000 - 600 * e).addScaledVector(fwd, 900 - 500 * e + out * 0.5);
      w.player.obj.up.copy(up);
      w.player.obj.lookAt(at.clone().addScaledVector(fwd, 150 + (out - 380) * e + out * 0.2 * (1 - e)));
    });
    await record(s, 'clip-bastion', 62);
    await s.ctx.close();
  },

  /** The Falcon running dark: a cold white unknown closing, the hull read, and she's past. */
  async 'clip-falcon-dark'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    await jump(s, { government: 0 });
    await facePlanet(s, 3.0);
    await s.page.evaluate(() => window.witchspace.spawnFalcon());
    await frame0(s);
    await animate(s, (t) => {
      const w = window.witchspace;
      const at = window.__at;
      const f = w.npcs.find((n) => n.def.id === 'falcon');
      if (!f) return;
      // In from far off, nearly head on, then breaking past to the right.
      const k = Math.min(1, t / 7.5);
      const z = 3400 * Math.pow(1 - k, 1.5) + 38;
      const x = 12 + 70 * Math.pow(k, 5);
      f.obj.position.copy(at([x, 20 - 30 * k, z]));
      f.obj.lookAt(at([x + 600 * k * k, -20, z - 400]));
      w.player.obj.position.copy(at([0, 0, 0]));
      w.player.obj.quaternion.copy(window.__q0);
    });
    await record(s, 'clip-falcon-dark', 8.5);
    await s.ctx.close();
  },

  /** Dogfight: banking through a pack crossing the frame, two kills. */
  async 'clip-fight'() {
    const s = await start({ scale: 1.5, touch: true });
    await launch(s);
    await jump(s, { government: 0 });
    await facePlanet(s, 2.8);
    await pirates(s, 700);
    await frame0(s);
    await animate(s, (t) => {
      const w = window.witchspace;
      const at = window.__at;
      const me = w.player.obj;
      me.position.copy(at([0, 0, 20 * t]));
      me.quaternion.copy(window.__q0);
      me.rotateZ(-0.35 + 0.12 * t); // banking through the turn
      me.rotateY(0.06 * Math.sin(t * 0.8));
      w.npcs.filter((n) => n.role === 'pirate').forEach((n, i) => {
        if (n.dead) return;
        // Crossing right to left, staggered, closing a little.
        const x = 520 - 190 * t + i * 160;
        n.obj.position.copy(at([x, [-40, 60, 0][i % 3] + 10 * Math.sin(t + i), 520 - 25 * t + i * 60]));
        n.obj.lookAt(at([x - 900, 0, 400]));
      });
    });
    await record(s, 'clip-fight', 6.5, {
      0.8: () => s.page.keyboard.down('KeyF'),
      2.9: () => kill(s, 0),
      4.6: () => kill(s, 1),
    });
    await s.ctx.close();
  },

  /** The yard close in: circling the new station as the Titanoboa works. */
  async 'clip-yard-station'() {
    const s = await start({ scale: 1.5 });
    await launch(s);
    const yards = await s.page.evaluate(() => window.witchspace.yards());
    await s.page.evaluate((i) => window.witchspace.jumpTo(i), yards[0].system);
    for (let i = 0; i < 40 && !(await s.page.evaluate(() => window.witchspace.state === 'flying' && window.witchspace.yard)); i++) await wait(1000);
    await wait(3000);
    await s.page.evaluate(() => { for (const n of window.witchspace.npcs) n.hostile = false; });
    await animate(s, (t) => {
      const w = window.witchspace;
      const y = w.yard;
      const V = y.centre.constructor;
      const c = y.station ? y.station.root.position : y.centre;
      const a = 0.9 + t * 0.07;
      const off = new V(Math.cos(a) * 700, 200, Math.sin(a) * 700).applyQuaternion(y.titan.root.quaternion);
      w.player.obj.position.copy(c).add(off);
      w.player.obj.up.set(0, 1, 0).applyQuaternion(y.titan.root.quaternion);
      w.player.obj.lookAt(c);
    });
    await record(s, 'clip-yard-station', 8);
    await s.ctx.close();
  },
};

const all = Object.keys(SCENES);
const names = !args.length ? all.filter((n) => !n.startsWith('clip-')) : args.flatMap((a) => (a === 'clips' ? all.filter((n) => n.startsWith('clip-')) : [a]));
for (const n of names) {
  if (!SCENES[n]) { console.log(`No scene "${n}". Scenes: ${Object.keys(SCENES).join(', ')}`); continue; }
  console.log(n);
  await SCENES[n]();
}
await browser.close();
