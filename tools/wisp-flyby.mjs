// The Will o' the Wisp, CMDR Bond's ship, passing close: she comes up on our left in open space,
// overtakes slowly about 300 m off, banking a little, then pulls ahead and climbs away. Filmed with
// the HUD and the game's own sound, as tools/pirate-clip.mjs films (tab capture, H.264 + AAC), for
// looking at the hull in the Neo look before she's merged.
//
//   npx vite --port 5183 --strictPort   (in another terminal)
//   node tools/wisp-flyby.mjs [--upright] [--out dir] [--url http://localhost:5183]

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

await page.addStyleTag({ content: '#keys-hint, #mouse-prompt, #account-nudge, .account-nudge, #install-hint, #radio, #radio-cards, #heads-up, #banner, #job { display: none !important; }' });
await page.keyboard.press('KeyL');
for (let i = 0; i < 20 && (await state()) !== 'flying'; i++) await wait(500);
await wait(3000);
// Out past the station, the planet behind her, nobody else about.
await page.evaluate(async (narrow) => {
  const w = window.witchspace;
  const { addNpc } = await import('/src/flight/traffic.ts');
  const { shipById } = await import('/src/content/ships.ts');
  const { planetPos } = w.explore;
  const me = w.player.obj;
  const away = me.position.clone().sub(planetPos).normalize();
  me.position.copy(planetPos).addScaledVector(away, (w.explore.bodies?.[0]?.radius ?? 20000) * 5).add(new away.constructor(0, 60000, 0));
  me.lookAt(me.position.clone().add(new away.constructor(0, 1, 0).cross(away)));
  w.player.speed = 0;
  for (const n of w.npcs) n.obj.position.addScaledVector(away, 200000);
  const q = me.quaternion.clone();
  const p0 = me.position.clone();
  const at = (x, y, z) => new p0.constructor(-x * narrow, y, z).applyQuaternion(q).add(p0);
  const her = addNpc(shipById('will-o-the-wisp'), 'trader', at(-240, -30, -320));
  Object.assign(her, { hostile: false, fights: false });
  window.__her = her;
  const from = performance.now();
  // Her pass: she comes up from behind on our left, overtakes slowly about 300 m off, banking
  // gently towards us, then pulls ahead, rolls level and climbs away.
  const path = (t) => {
    if (t < 9) { const k = t / 9; return at(-240 + 60 * k, -30 + 20 * k, -320 + 760 * k); }
    const k = Math.min(1, (t - 9) / 5); const e = k * k;
    return at(-180 + 120 * e, -10 + 420 * e, 440 + 2600 * e);
  };
  const bank = (t) => (t < 9 ? 0.32 * Math.sin((Math.PI * t) / 9) : -0.18 * Math.min(1, (t - 9) / 2));
  window.__fly = setInterval(() => {
    const t = (performance.now() - from) / 1000;
    her.ship.speed = 0;
    her.obj.position.copy(path(t));
    her.obj.lookAt(path(t + 0.08));
    her.obj.rotateZ(bank(t));
    // The camera flies straight, turning a little to keep her in view.
    const look = me.clone(); look.lookAt(her.obj.position);
    me.quaternion.slerp(look.quaternion, 0.06);
    w.player.speed = 0;
  }, 16);
}, UPRIGHT ? 0.5 : 1);
await roll();
await wait(14000);
await cut();
const size = await page.evaluate(() => window.__rec.finish());
const parts = [];
for (let i = 0; i < size; i += 4 << 20) parts.push(Buffer.from(await page.evaluate(([i, n]) => window.__rec.chunk(i, n), [i, 4 << 20]), 'base64'));
const file = join(OUT, `will-o-the-wisp${UPRIGHT ? '-upright' : ''}.mp4`);
writeFileSync(file, Buffer.concat(parts));
say(`${file} · ${(size / 1048576).toFixed(1)} MB`);
await browser.close();
