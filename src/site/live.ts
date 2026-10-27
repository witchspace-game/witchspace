import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { shipById } from '../content/ships';
import { COMMODITIES } from '../economy/commodities';
import { activeEvent, EVENT_KINDS, newsAt, type WorldEvent } from '../economy/events';
import { drift, equilibriumPrice, freshMarket, priceAt } from '../economy/market';
import { distanceLy, galaxy, type StarSystem } from '../galaxy/generate';
import { stageInfo, STAGES, yardsNear } from '../game/yards';
import { buildShip } from '../render/shipModel';
import { setLineResolution } from '../render/wire';
import { escapeHtml } from '../ui/escape';

// The home page's live galaxy: the news around Lave, the nearest shipyard, a
// market in crisis, the ticker under the hero, and the Falcon turning. All
// from the game's own seed and clock, so it's what every commander would find
// right now, and it's worked out again every minute while the page is open.
// The page reads sensibly without it.

const $ = (id: string) => document.getElementById(id);
const lave = galaxy(0)[7];
const RANGE = 25; // light years: as far as news travels to Lave
const span = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};
const ly = (s: StarSystem) => `${distanceLy(lave, s).toFixed(1)} LY from Lave`;

let tickerItems: string[] = [];

/** The shortage among these worlds that's pushed a price furthest over the usual, if any is over 5%. */
function worst(trouble: { s: StarSystem; e: WorldEvent }[], now: number) {
  let crisis: { where: StarSystem; good: string; pct: number; e: WorldEvent } | null = null;
  for (const { s, e } of trouble) {
    for (const [id, shift] of Object.entries(EVENT_KINDS[e.type].effects)) {
      const i = COMMODITIES.findIndex((c) => c.id === id);
      if (shift >= 0 || i < 0) continue;
      const c = COMMODITIES[i];
      const pct = priceAt(s, freshMarket(s, now), id, now) / (equilibriumPrice(s, c, i) * drift(s, c, i, now)) - 1;
      if (pct > 0.05 && (!crisis || pct > crisis.pct)) crisis = { where: s, good: c.name, pct, e };
    }
  }
  return crisis;
}

function render() {
  const now = Date.now();
  // Every world in trouble right now, nearest Lave first: the galaxy always has a dozen or more.
  const trouble = galaxy(0)
    .map((s) => ({ s, e: activeEvent(s, now) }))
    .filter((t): t is { s: StarSystem; e: WorldEvent } => t.e !== null)
    .sort((a, b) => distanceLy(lave, a.s) - distanceLy(lave, b.s));

  // The news: what Lave has heard that's still going on, then trouble too far out
  // for news to reach Lave, then what's eased lately. Nothing within news range
  // that Lave hasn't heard yet: that's for a fast ship to bring.
  const heard = newsAt(lave, now).filter((n) => n.where !== lave);
  const ongoing = heard.filter((n) => now <= n.event.end);
  const lines = [
    ...ongoing.map((n) => ({ e: n.event, where: n.where, note: `${ly(n.where)} · began ${span(now - n.event.start)} ago · wanted: ${EVENT_KINDS[n.event.type].wanted}` })),
    ...trouble
      .filter((t) => distanceLy(lave, t.s) > RANGE)
      .slice(0, Math.max(0, 3 - ongoing.length))
      .map((t) => ({ e: t.e, where: t.s, note: `${ly(t.s)}, beyond the news at Lave · began ${span(now - t.e.start)} ago` })),
    ...heard.filter((n) => now > n.event.end).map((n) => ({ e: n.event, where: n.where, note: `${ly(n.where)} · eased ${span(now - n.event.end)} ago`, over: true })),
  ].slice(0, 4);
  $('now-news')!.innerHTML = lines
    .map((l) => `<div class="headline${'over' in l ? ' over' : ''}"><b>${escapeHtml(EVENT_KINDS[l.e.type].headline(l.where.name))}</b><small>${escapeHtml(l.note)}</small></div>`)
    .join('');

  // A market in crisis: the worst shortage within reach of Lave right now, or anywhere if there's none.
  const crisis = worst(trouble.filter((t) => distanceLy(lave, t.s) <= RANGE), now) ?? worst(trouble, now);
  if (crisis) {
    $('now-crisis')!.textContent = `${crisis.good} at ${crisis.where.name}`;
    $('now-crisis-pct')!.textContent = `+${Math.round(crisis.pct * 100)}%`;
    $('now-crisis-note')!.textContent = 'on the usual price, while the trouble lasts';
    $('now-crisis-meta')!.textContent = `${EVENT_KINDS[crisis.e.type].name} · ${ly(crisis.where)}`;
    $('now-crisis-cta')!.textContent = `Fly ${crisis.good.toLowerCase()} to ${crisis.where.name} →`;
  }

  // The nearest shipyard, and how far along: in news range if there is one, or the nearest anywhere.
  const near = yardsNear(lave, now, RANGE);
  const yards = near.length ? near : yardsNear(lave, now, Infinity);
  if (yards.length) {
    const { yard, where } = yards[0];
    const done = Math.min(1, (now - yard.start) / (yard.end - yard.start));
    $('now-yard')!.textContent = where.name;
    $('now-yard-line')!.textContent = `Wexley-Yorozu's Titanoboa: ${stageInfo(yard.stage).news}.`;
    $('now-yard-bar')!.style.width = `${Math.round(done * 100)}%`;
    $('now-yard-meta')!.textContent = `${ly(where)} · stage ${STAGES.findIndex((s) => s.stage === yard.stage) + 1} of ${STAGES.length} · opens in about ${Math.max(1, Math.ceil((yard.end - now) / 86400000))} days${near.length > 1 ? ` · ${near.length - 1} more within ${RANGE} LY` : ''}`;
  }

  // The ticker under the hero: a line at a time from all of the above.
  const first = ongoing[0];
  tickerItems = [
    first ? `<b>${escapeHtml(EVENT_KINDS[first.event.type].name)}</b> at ${escapeHtml(first.where.name)}, ${distanceLy(lave, first.where).toFixed(1)} LY out` : '',
    crisis ? `${escapeHtml(crisis.good)} <b>+${Math.round(crisis.pct * 100)}%</b> at ${escapeHtml(crisis.where.name)}` : '',
    yards.length ? `<b>${escapeHtml(yards[0].where.name)}</b> station: ${escapeHtml(stageInfo(yards[0].yard.stage).name)}` : '',
    `<b>${trouble.length}</b> worlds in trouble right now`,
  ].filter(Boolean);
}

render();
setInterval(() => document.hidden || render(), 60_000);

const ticker = $('ticker-item');
if (ticker) {
  let at = 0;
  let paused = false;
  const show = () => (ticker.innerHTML = tickerItems[at % tickerItems.length]);
  show();
  // Turn over every few seconds, with a fade; held still while pointed at or for reduced motion.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const link = ticker.closest('a')!;
    for (const [on, hold] of [['mouseenter', true], ['mouseleave', false], ['focus', true], ['blur', false]] as const) link.addEventListener(on, () => (paused = hold));
    setInterval(() => {
      if (paused || document.hidden) return;
      ticker.classList.add('out');
      setTimeout(() => {
        at++;
        show();
        ticker.classList.remove('out');
      }, 400);
    }, 5000);
  }
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
