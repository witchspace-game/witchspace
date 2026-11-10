// A renowned pirate, start to finish, filmed with the HUD and the game's own sound: his warning
// after you've killed his crew, the call and the 90-second clock, his arrival, the fight at range,
// and him ejecting. For a social post (Mark, 10 November 2026).
//
// Unlike tools/press-shots.mjs (the 3D picture only, its clock stepped a frame at a time), this
// films the whole tab in real time, as a player would see and hear it, with Chrome's own tab
// capture. The recorder pauses between the moments worth seeing, so the clip runs about 40
// seconds and the 90-second wait is a cut.
//
//   npx vite --port 5183 --strictPort   (in another terminal)
//   node tools/pirate-clip.mjs [--upright] [--out dir] [--url http://localhost:5183]
//
// Writes renowned-pirate.mp4 (1920×1080), or renowned-pirate-upright.mp4 (1080×1920), H.264 + AAC.
// The pirate is a seeded one (Retila's, "Old Iron"), not one of the three hand-written; the
// commander is a test callsign, so no real player's name is on screen.

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const OUT = opt('--out', join(homedir(), 'Desktop', 'Witchspace clips'));
const URL = opt('--url', 'http://localhost:5183');
const UPRIGHT = args.includes('--upright');
const SYSTEM = 20; // Retila: Teague Grieve, "Old Iron", in Small Mercy
const CALLSIGN = 'Corvane'; // a test callsign, free on the live server
// The page at 1.5×, so the HUD reads: 1280×720 is a 1920×1080 picture.
const [CW, CH] = UPRIGHT ? [720, 1280] : [1280, 720];
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  // A window, not headless: headless Chrome captures a tab's picture but not its sound. The sound
  // is kept off the speakers while it's captured, and the window keeps drawing when covered.
  headless: false,
  args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1.5', '--auto-accept-this-tab-capture', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
});
const ctx = await browser.newContext({ viewport: { width: CW, height: CH } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  page error:', e.message));
page.on('console', (m) => m.text().startsWith('REC') && console.log(`  ${m.text()}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => page.evaluate(() => window.witchspace.state);
const say = (t) => console.log(`  ${new Date().toISOString().slice(14, 19)} ${t}`);

await page.goto(`${URL}/play/`);
await page.waitForFunction(() => window.witchspace);
await wait(1200);
await page.keyboard.press('KeyN'); // a new commander, even if one is saved
await wait(400);
for (let i = 0; i < 12 && (await state()) !== 'docked'; i++) {
  await page.keyboard.press('Enter');
  await wait(500);
}
// A veteran (renowned pirates leave Harmless commanders alone), in a Cobra with the kit to win.
await page.evaluate((callsign) => {
  const w = window.witchspace;
  const c = w.commander;
  c.name = callsign;
  c.lasers = { front: 'pulse' }; // one pulse laser up front: a fight worth watching, not a one-sided one
  c.equipment = [...new Set([...c.equipment, 'combat-computer', 'ecm', 'extra-energy', 'large-cargo-bay', 'fuel-scoops', 'docking-computer', 'escape-pod', 'galactic-hyperdrive'])];
  c.kills = 140;
  c.credits = 9850;
  c.renowned = {};
  w.renderDocked();
}, CALLSIGN);
await page.addStyleTag({ content: '#keys-hint, #mouse-prompt, #account-nudge, .account-nudge, #install-hint { display: none !important; }' });

// The tab's own picture and sound, ready to record. Asking needs a click (a user gesture), so it's asked while docked.
// Encoded here, frame by frame, into a plain MP4 (MediaRecorder's is fragmented, and players misread its length);
// between the moments worth keeping, frames are dropped and the clock held, so each cut is clean.
await page.addScriptTag({ path: 'node_modules/mp4-muxer/build/mp4-muxer.js' });
await page.evaluate(([W, H]) => {
  window.__ask = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: W, height: H, frameRate: 30 },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2, suppressLocalAudioPlayback: true },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    });
    const [vt] = stream.getVideoTracks();
    const [at] = stream.getAudioTracks();
    const { width, height } = vt.getSettings();
    const rate = at?.getSettings().sampleRate ?? 48000;
    const channels = 2; // stereo out, whatever the tab gives (one channel is copied to both)
    const aac = (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: rate, numberOfChannels: channels, bitrate: 192000 })).supported;
    const target = new Mp4Muxer.ArrayBufferTarget();
    const mux = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width, height, frameRate: 30 }, ...(at ? { audio: { codec: aac ? 'aac' : 'opus', sampleRate: rate, numberOfChannels: channels } } : {}), fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    const venc = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: (e) => console.log('REC video', e.message) });
    venc.configure({ codec: 'avc1.640033', width, height, bitrate: 12e6, framerate: 30, latencyMode: 'quality' });
    const aenc = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: (e) => console.log('REC audio', e.message) });
    if (at) aenc.configure({ codec: aac ? 'mp4a.40.2' : 'opus', sampleRate: rate, numberOfChannels: channels, bitrate: 192000 });
    // Time kept so far (µs). Each stretch is timed by this page's own clock (video) and by counting
    // samples (sound): the captured frames' own timestamps can't be trusted to share a clock.
    let rolling = false;
    let rolledAt = 0;
    let kept = 0;
    let samples = 0;
    let frames = 0;
    let lastV = -1;
    const pump = async (track, each) => {
      const reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        if (rolling) each(value);
        value.close();
      }
    };
    pump(vt, (f) => {
      const ts = kept + Math.round((performance.now() - rolledAt) * 1000);
      if (ts <= lastV) return;
      lastV = ts;
      const g = new VideoFrame(f, { timestamp: ts });
      venc.encode(g, { keyFrame: frames++ % 60 === 0 });
      g.close();
    });
    if (at)
      pump(at, (d) => {
        if (d.sampleRate !== rate) return void console.log(`REC audio at ${d.sampleRate} Hz, not ${rate}`);
        const n = d.numberOfFrames;
        const data = new Float32Array(n * 2);
        for (let ch = 0; ch < 2; ch++) d.copyTo(data.subarray(ch * n, (ch + 1) * n), { planeIndex: Math.min(ch, d.numberOfChannels - 1), format: 'f32-planar' });
        const e = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: n, numberOfChannels: 2, timestamp: kept + Math.round((samples / rate) * 1e6), data });
        samples += n;
        aenc.encode(e);
        e.close();
      });
    window.__rec = {
      roll() {
        rolledAt = performance.now();
        samples = 0;
        frames = 0; // a key frame to start each stretch
        rolling = true;
      },
      cut() {
        rolling = false;
        console.log(`REC stretch: ${frames} frames in ${((performance.now() - rolledAt) / 1000).toFixed(1)} s`);
        kept += Math.round((performance.now() - rolledAt) * 1000);
      },
      seconds: () => (kept + (rolling ? (performance.now() - rolledAt) * 1000 : 0)) / 1e6,
      async finish() {
        rolling = false;
        await venc.flush();
        if (at) await aenc.flush();
        mux.finalize();
        stream.getTracks().forEach((t) => t.stop());
        window.__bytes = new Uint8Array(target.buffer);
        return window.__bytes.length;
      },
      chunk(i, n) {
        const b = window.__bytes.subarray(i, i + n);
        let s = '';
        for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode(...b.subarray(k, k + 0x8000));
        return btoa(s);
      },
    };
    return { width, height, audio: at ? (aac ? 'AAC' : 'Opus') + ` ${channels} ch` : '' };
  };
}, [CW * 1.5, CH * 1.5]);
await page.mouse.click(CW - 4, CH - 4);
const got = await page.evaluate(() => window.__ask());
say(`capturing ${got.width}×${got.height}, ${got.audio ? `sound ${got.audio}` : 'WITHOUT sound'}`);
const roll = () => page.evaluate(() => window.__rec.roll());
const cut = () => page.evaluate(() => window.__rec.cut());

// Launch, and hyperspace to his system.
await page.keyboard.press('KeyL');
for (let i = 0; i < 20 && (await state()) !== 'flying'; i++) await wait(500);
await wait(2500);
await page.evaluate((i) => window.witchspace.jumpTo(i), SYSTEM);
for (let k = 0; k < 40; k++) {
  await wait(1000);
  if (k > 12 && (await state()) === 'flying') break;
}
await wait(3000);
await page.evaluate(() => {
  // Clear of the station and any traffic: out towards the planet, with nobody else about.
  const w = window.witchspace;
  const { planetPos } = w.explore;
  const away = w.player.obj.position.clone().sub(planetPos).normalize();
  const r = w.explore.bodies?.[0]?.radius ?? 20000;
  w.player.obj.position.copy(planetPos).addScaledVector(away, r * 3);
  w.player.obj.lookAt(planetPos);
  w.player.speed = 0;
});

// The director: turn the nose onto the nearest pirate (the sights on him), and keep the camera alive.
await page.evaluate(async () => (window.__flight = (await import('/src/scene.ts')).flight));
await page.evaluate(() => {
  const w = window.witchspace;
  window.__director = setInterval(() => {
    const me = w.player.obj;
    const them = w.npcs.filter((n) => n.role === 'pirate' && !n.dead && n.def.id !== 'escape-pod');
    const pod = w.npcs.find((n) => n.def.id === 'escape-pod');
    const on = window.__watchPod && pod ? pod : window.__mark && !window.__mark.dead && w.npcs.includes(window.__mark) ? window.__mark : them.sort((a, b) => a.obj.position.distanceTo(me.position) - b.obj.position.distanceTo(me.position))[0];
    w.player.hull = Math.max(w.player.hull, 70);
    w.player.shields = Math.max(w.player.shields, 40);
    w.player.speed = Math.min(w.player.speed, window.__speed ?? 120);
    // A pilot's trigger: in bursts, only with him in the sights, easing off before the laser runs hot.
    const flight = window.__flight;
    const want = Boolean(window.__trigger && on && flight && flight.laserHeat < 50 && on.obj.position.clone().sub(me.position).angleTo(w.player.forward()) < 0.06);
    if (want !== Boolean(window.__firing)) {
      window.__firing = want;
      dispatchEvent(new KeyboardEvent(want ? 'keydown' : 'keyup', { code: 'KeyF' }));
    }
    if (!on) return;
    // A pilot's hands, not a robot's: the nose turns no faster than a Cobra's, and the aim is off by
    // about what the duel simulation gives a human (tools/simulate-duel.ts, 0.03 rad), drifting slowly.
    const t = performance.now() / 1000;
    const err = window.__human ? 0.03 : 0;
    const aimAt = on.obj.position.clone().add(new on.obj.position.constructor(Math.sin(t * 0.9), Math.sin(t * 1.3 + 2), Math.cos(t * 0.7)).multiplyScalar(err * on.obj.position.distanceTo(me.position)));
    const look = me.clone();
    look.lookAt(aimAt);
    const most = window.__human ? 1.1 * 0.016 : Infinity; // radians a tick: about a Cobra's turn
    const gap = me.quaternion.angleTo(look.quaternion);
    me.quaternion.slerp(look.quaternion, Math.min(0.06, gap > 0 ? most / gap : 1));
  }, 16);
});

/** His crew, a loose pack ahead. */
/**
 * His crew: four ahead, the rest of the pack sent far off. They hold their fire: with a hostile
 * ship in range the radio is in a fight and folds everything into a summary for afterwards, and
 * the clip is about what he says.
 */
const pack = () =>
  page.evaluate(() => {
    const w = window.witchspace;
    for (let i = 0; i < 12 && w.npcs.filter((n) => n.role === 'pirate').length < 4; i++) w.spawnPirates(w.player.obj.position.clone().addScaledVector(w.player.forward(), -4200));
    const me = w.player.obj;
    const fwd = w.player.forward();
    const ps = w.npcs.filter((n) => n.role === 'pirate');
    ps.forEach((n, i) => {
      Object.assign(n, { hostile: false, fights: false, firedOnPlayer: false });
      const side = new me.position.constructor((i - 1.5) * 260, (i % 2 ? 1 : -1) * 90, 0).applyQuaternion(me.quaternion);
      if (i < 4) n.obj.position.copy(me.position).addScaledVector(fwd, 1100 + i * 180).add(side);
      n.obj.lookAt(me.position);
    });
    // The rest of the pack: gone, quietly (nobody's kill), so none of them hails mid-clip.
    ps.slice(4).forEach((n) => (n.obj.position.addScaledVector(fwd, -60000), w.destroyNpc(n, null)));
    // Keep them quiet until they're shot.
    window.__quiet = setInterval(() => w.npcs.forEach((n) => n.role === 'pirate' && n.style !== 'holdBack' && Object.assign(n, { hostile: false, fights: false })), 50);
    return Math.min(4, ps.length);
  });
/**
 * Down the nearest of his crew, by our own guns: the nose on him, firing, until he goes. If he's
 * slow to die, he's finished off only while he's in the sights, so no shot is seen to miss.
 */
const killOne = async () => {
  const id = await page.evaluate(() => {
    const w = window.witchspace;
    const me = w.player.obj.position;
    const t = w.npcs.filter((n) => n.role === 'pirate' && !n.dead && n.style !== 'holdBack').sort((a, b) => a.obj.position.distanceTo(me) - b.obj.position.distanceTo(me))[0];
    window.__mark = t;
    return Boolean(t);
  });
  if (!id) return;
  const end = Date.now() + 9000;
  while (Date.now() < end) {
    const state = await page.evaluate((late) => {
      const w = window.witchspace;
      const t = window.__mark;
      if (!t || t.dead || !w.npcs.includes(t)) return 'down';
      const to = t.obj.position.clone().sub(w.player.obj.position).normalize();
      if (late && to.angleTo(w.player.forward()) < 0.05) {
        w.playerHitNpc(t, 9999);
        return 'down';
      }
      return 'fighting';
    }, Date.now() > end - 6500);
    if (state === 'down') return;
    await wait(100);
  }
  await page.evaluate(() => window.__mark && !window.__mark.dead && window.witchspace.playerHitNpc(window.__mark, 9999));
};

say(`${await pack()} of his crew`);
await wait(1500);
await page.evaluate(() => (window.__trigger = true));
// 1. Two of his crew down, and his warning.
// One of each pair goes down off camera: the clip shows the second, and what it brings.
await killOne();
await roll();
await killOne();
await wait(4500); // the warning comes 2.5 s after
await cut();
// 2. Two more, and the call: he's coming, 90 seconds.
await killOne();
await roll();
await killOne();
const called = Date.now(); // he's due 90 s of flight after this kill
await page.evaluate(() => (window.__trigger = false));
await wait(7000); // the call, then the computer's "about 90 seconds"; long enough to read
await cut();
// From here it's him alone: any other pirate the system sends is cleared away before it can hail.
await page.evaluate(() => {
  const w = window.witchspace;
  setInterval(() => {
    for (const n of [...w.npcs]) if (n.role === 'pirate' && n.style !== 'holdBack' && n.def.id !== 'escape-pod') n.obj.position.addScaledVector(w.player.forward(), -80000), w.destroyNpc(n, null);
  }, 200);
});
say('waiting for him (90 s)');
// 3. Him: rolling the moment he's here (his hail comes as he arrives). Watched for, not timed:
// a busy machine can run the game's clock slow.
const him = () => page.evaluate(() => window.witchspace.npcs.some((n) => n.style === 'holdBack' && !n.brokeOff));
await wait(Math.max(0, called + 80_000 - Date.now()));
await page.evaluate(() => (window.__speed = 60));
const until = async (test, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end && !(await test())) await wait(100);
  return test();
};
if (!(await until(him, 120_000))) {
  // Now and then the call doesn't take (a kill missed in the count): bring him by the game's own arrival.
  say('no sign of him: bringing him in');
  await page.evaluate(() => window.witchspace.spawnRenowned());
  if (!(await until(him, 5_000))) throw new Error('he never came');
}
await roll();
say('he is here');
// His entrance: he sweeps past close, so the Cobra reads as a ship (on a phone, not a glowing dot),
// then breaks away to his range. Flown on a set path for a few seconds; then he's his own man.
await page.evaluate((narrow) => {
  const w = window.witchspace;
  const r = w.npcs.find((n) => n.style === 'holdBack');
  const me = w.player.obj;
  const q = me.quaternion.clone();
  const p0 = me.position.clone();
  const at = (x, y, z) => new p0.constructor(-x * narrow, y, z).applyQuaternion(q).add(p0); // x right, y up, z ahead (as press-shots)
  const from = performance.now();
  const T = 3.6;
  window.__pass = setInterval(() => {
    const t = Math.min(1, (performance.now() - from) / 1000 / T);
    const e = t * t * (3 - 2 * t);
    const pos = (k) => at(520 - 1040 * k, 70 - 110 * k, 700 - 560 * k);
    r.obj.position.copy(pos(e));
    r.obj.lookAt(pos(Math.min(1, e + 0.05)));
    if (t >= 1) clearInterval(window.__pass);
  }, 16);
}, UPRIGHT ? 0.45 : 1);
await wait(6000); // his hail, the pass, and him pulling out to his range
// 4. The fight: him holding off with his beam, us turning to keep him in the sights.
await page.evaluate(() => ((window.__trigger = true), (window.__human = true)));
const fightFrom = Date.now();
const ejected = () => page.evaluate(() => window.witchspace.npcs.some((n) => n.def.id === 'escape-pod'));
const nearlyBeaten = () => page.evaluate(() => {
  const r = window.witchspace.npcs.find((n) => n.style === 'holdBack' && !n.brokeOff);
  return !r || r.health < 0.235;
});
if (!(await until(ejected, 9_000))) {
  // A real fight runs most of a minute (the duel simulation's average is 50 s). Nine seconds of it,
  // a cut while it goes on, unrecorded, then the end of it as it happened.
  await cut();
  if (!(await until(nearlyBeaten, 150_000))) {
    // Still at it after two and a half minutes: help it to an end, as before.
    await page.evaluate(() => {
      const w = window.witchspace;
      const r = w.npcs.find((n) => n.style === 'holdBack' && !n.brokeOff);
      if (r) w.playerHitNpc(r, Math.max(0, r.ship.shields + r.ship.hull - 0.28 * (r.def.stats.shields + r.def.stats.hull)));
    });
    say('helped to an end');
  }
  await roll();
  await until(ejected, 30_000);
}
await page.evaluate(() => (window.__trigger = false));
await page.evaluate(() => (window.__watchPod = true));
say(`ejected after ${Math.round((Date.now() - fightFrom) / 1000)} s`);
// 5. His pod, running.
await wait(4500);
await cut();
say(`${(await page.evaluate(() => window.__rec.seconds())).toFixed(1)} s kept`);

const size = await page.evaluate(() => window.__rec.finish());
const parts = [];
for (let i = 0; i < size; i += 4 << 20) parts.push(Buffer.from(await page.evaluate(([i, n]) => window.__rec.chunk(i, n), [i, 4 << 20]), 'base64'));
const file = join(OUT, `renowned-pirate${UPRIGHT ? '-upright' : ''}.mp4`);
writeFileSync(file, Buffer.concat(parts));
say(`${file} · ${(size / 1048576).toFixed(1)} MB`);
await browser.close();
