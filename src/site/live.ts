import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { shipById } from '../content/ships';
import { COMMODITIES } from '../economy/commodities';
import { EVENT_KINDS, newsAt } from '../economy/events';
import { drift, equilibriumPrice, freshMarket, priceAt } from '../economy/market';
import { galaxy } from '../galaxy/generate';
import { stageInfo, STAGES, yardsNear } from '../game/yards';
import { buildShip } from '../render/shipModel';
import { setLineResolution } from '../render/wire';
import { escapeHtml } from '../ui/escape';

// The home page's live galaxy: the news reaching Lave, the nearest shipyard,
// a market in crisis, and the Falcon turning. All from the game's own seed
// and clock, so it's what every commander would find right now. The page
// reads sensibly without it.

const $ = (id: string) => document.getElementById(id);
const now = Date.now();
const lave = galaxy(0)[7];
const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
};

// The news, as it reaches Lave: what's still going on first, as the station's News tab does.
const news = newsAt(lave, now)
  .filter((n) => n.where !== lave)
  .sort((a, b) => Number(now > a.event.end) - Number(now > b.event.end) || b.heard - a.heard);
if (news.length && $('now-news')) {
  $('now-news')!.innerHTML = news
    .slice(0, 4)
    .map((n) => {
      const k = EVENT_KINDS[n.event.type];
      const over = now > n.event.end;
      return `<div class="headline"><b>${escapeHtml(k.headline(n.where.name))}</b><small>${n.distance.toFixed(1)} LY away · heard ${ago(now - n.heard)}${over ? ' · may be over by now' : ` · wanted: ${escapeHtml(k.wanted)}`}</small></div>`;
    })
    .join('');
}

// A market in crisis: the live news with the worst shortage, and what it's doing to the price there.
let crisis: { where: string; good: string; pct: number } | null = null;
for (const n of news) {
  if (now > n.event.end) continue;
  for (const [id, shift] of Object.entries(EVENT_KINDS[n.event.type].effects)) {
    const i = COMMODITIES.findIndex((c) => c.id === id);
    if (shift >= 0 || i < 0) continue;
    const s = galaxy(0)[n.event.system];
    const c = COMMODITIES[i];
    const pct = priceAt(s, freshMarket(s, now), id, now) / (equilibriumPrice(s, c, i) * drift(s, c, i, now)) - 1;
    if (!crisis || pct > crisis.pct) crisis = { where: s.name, good: c.name, pct };
  }
}
if (crisis && crisis.pct > 0.05) {
  $('now-crisis')!.textContent = `${crisis.good} at ${crisis.where}`;
  $('now-crisis-pct')!.textContent = `+${Math.round(crisis.pct * 100)}%`;
  $('now-crisis-cta')!.textContent = `Fly ${crisis.good.toLowerCase()} to ${crisis.where} →`;
}

// The nearest shipyard, and how far along.
const yards = yardsNear(lave, now);
if (yards.length) {
  const { yard, where } = yards[0];
  const done = Math.min(1, (now - yard.start) / (yard.end - yard.start));
  $('now-yard')!.textContent = where.name;
  $('now-yard-line')!.textContent = `Wexley-Yorozu's Titanoboa: ${stageInfo(yard.stage).news}.`;
  $('now-yard-bar')!.style.width = `${Math.round(done * 100)}%`;
  $('now-yard-meta')!.textContent = `Stage ${STAGES.findIndex((s) => s.stage === yard.stage) + 1} of ${STAGES.length} · opens in about ${Math.max(1, Math.ceil((yard.end - now) / 86400000))} days${yards.length > 1 ? ` · ${yards.length - 1} more within 25 LY` : ''}`;
}

// The strip under the hero.
const strip = $('live-strip');
if (strip) {
  const bits = [
    yards.length ? `<span><b>${yards.length}</b> station${yards.length === 1 ? '' : 's'} being built nearby</span>` : '',
    news[0] && now <= news[0].event.end ? `<span>${escapeHtml(EVENT_KINDS[news[0].event.type].name)} at <b>${escapeHtml(news[0].where.name)}</b></span>` : '',
    crisis && crisis.pct > 0.05 ? `<span>${escapeHtml(crisis.good)} ${Math.round(crisis.pct * 100)}% over the odds at <b>${escapeHtml(crisis.where)}</b></span>` : '',
  ].filter(Boolean);
  if (bits.length) strip.innerHTML = `<span class="live-dot" aria-hidden="true"></span><b>Live</b> ${bits.join('')}`;
}

// The Falcon, turning: opaque, in the card's colour (over a see-through canvas the glow pools into a wash).
const canvas = $('now-falcon') as HTMLCanvasElement | null;
if (canvas) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c0f15');
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    const model = buildShip(shipById('falcon')!);
    scene.add(model.root);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1, 0, 0.2);
    bloom.compositeMaterial.uniforms['bloomFactors'].value = [1, 0.75, 0.45, 0.18, 0.04];
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const size = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
      camera.position.set(0, model.radius * 0.35, (model.radius * 0.7) / Math.tan(THREE.MathUtils.degToRad(15)) / Math.min(1, camera.aspect));
      camera.lookAt(0, 0, 0);
    };
    new ResizeObserver(size).observe(canvas);
    size();
    model.root.rotation.set(0.25, -0.8, 0);
    composer.render(); // one frame now, so she's there before the card scrolls into view
    let visible = false;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = (t: number) => {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      model.root.rotation.set(0.25, still ? -0.8 : t / 3000, 0);
      composer.render();
    };
    requestAnimationFrame(frame);
  } catch {
    canvas.remove(); // no WebGL: the card stands without her
  }
}
