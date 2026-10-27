// The live viewer (docs/design/mcp-server.md, "Try it"): an MCP App, the page a
// client like claude.ai shows inside the chat when view_ship answers. It draws
// the ship in neo glow, turning, with the game's hidden-line look (faces filled
// dark and drawn far to near), and a Cobra beside it for scale: drag to turn it,
// pinch or scroll to zoom. One self-contained page, no network: the geometry
// arrives in the tool result's structuredContent. It speaks the MCP Apps
// protocol (2026-01-26) by hand: ui/initialize, then the tool result. Plain ASCII
// throughout (entities and \\u escapes), so no host's encoding can garble it.

export const VIEWER_URI = 'ui://witchspace/viewer.html';
export const VIEWER_MIME = 'text/html;profile=mcp-app';

/** What view_ship sends the page. */
export interface ViewerModel {
  name: string;
  color: string;
  glow: number;
  vertices: [number, number, number][];
  faces: number[][];
  details?: { vertices: [number, number, number][]; lines: [number, number][] };
  /** The Cobra Mk III, drawn beside it in grey. */
  scale?: { name: string; vertices: [number, number, number][]; faces: number[][] };
}

export const VIEWER_HTML = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Witchspace viewer</title>
<style>
  :root { color-scheme: dark; --bg: #04060a; --ink: #c9d4e3; --dim: #6b7787; --radius: var(--border-radius-md, 10px); }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font: 13px/1.4 var(--font-sans, system-ui, sans-serif); }
  #wrap { position: relative; border-radius: var(--radius); overflow: hidden; background: radial-gradient(ellipse at 50% 40%, #0b1220 0%, var(--bg) 70%); }
  canvas { display: block; width: 100%; height: 380px; touch-action: none; cursor: grab; }
  canvas:active { cursor: grabbing; }
  #bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: linear-gradient(transparent, rgba(4,6,10,.85)); }
  #name { font-weight: 600; letter-spacing: .02em; }
  #facts { color: var(--dim); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  button { font: inherit; color: var(--ink); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 4px 10px; cursor: pointer; }
  button[aria-pressed="true"] { border-color: currentColor; }
  #hint { position: absolute; top: 10px; left: 0; right: 0; text-align: center; color: var(--dim); font-size: 12px; transition: opacity .6s; pointer-events: none; }
  #wait { position: absolute; inset: 0; display: grid; place-items: center; color: var(--dim); }
  [hidden] { display: none !important; }
  @media (max-width: 480px) { #bar { flex-wrap: wrap; } #name { flex: 1; } #facts { order: 3; flex-basis: 100%; white-space: normal; } }
</style></head>
<body><div id="wrap">
  <canvas id="c" aria-label="The ship, turning in 3D"></canvas>
  <div id="hint">Drag to turn it &middot; pinch or scroll to zoom</div>
  <div id="wait">Waiting for the ship&hellip;</div>
  <div id="bar"><span id="name"></span><span id="facts"></span>
    <button id="cobra" aria-pressed="true" title="Show a Cobra Mk III beside it, to scale">Cobra for scale</button>
    <button id="full" hidden>Full screen</button></div>
</div>
<script>
(() => {
  const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  let model = null, yaw = -0.7, pitch = 0.35, zoom = 1, spinning = true, showCobra = true, last = 0;

  // --- MCP Apps: JSON-RPC over postMessage to the host -------------------------
  let nextId = 1; const pending = new Map();
  const post = (m) => window.parent.postMessage(Object.assign({ jsonrpc: '2.0' }, m), '*');
  const request = (method, params) => new Promise((resolve) => { const id = nextId++; pending.set(id, resolve); post({ id, method, params }); });
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    const m = e.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id != null && !m.method && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); return; }
    if (m.method === 'ui/notifications/tool-result') show(m.params && m.params.structuredContent);
    else if (m.method === 'ui/notifications/host-context-changed') context(m.params || {});
    else if (m.method === 'ui/resource-teardown') post({ id: m.id, result: {} });
  });
  function context(c) {
    const vars = c.styles && c.styles.variables;
    if (vars) for (const k in vars) if (/^--(font|border-radius)/.test(k)) document.documentElement.style.setProperty(k, vars[k]);
    if (c.availableDisplayModes) $('full').hidden = !c.availableDisplayModes.includes('fullscreen');
  }
  request('ui/initialize', {
    protocolVersion: '2026-01-26',
    clientInfo: { name: 'Witchspace viewer', version: '1' },
    capabilities: {},
    appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
  }).then((r) => { context(r.hostContext || {}); post({ method: 'ui/notifications/initialized', params: {} }); });
  let sized = 0;
  new ResizeObserver(() => { clearTimeout(sized); sized = setTimeout(() => post({ method: 'ui/notifications/size-changed', params: { width: Math.ceil(document.body.scrollWidth), height: Math.ceil(document.body.scrollHeight) } }), 100); }).observe(document.body);
  $('full').onclick = () => request('ui/request-display-mode', { mode: 'fullscreen' });

  // --- The ship -------------------------------------------------------------------
  function show(m) {
    if (!m || !Array.isArray(m.vertices) || !Array.isArray(m.faces)) return;
    model = m;
    $('wait').hidden = true;
    $('name').textContent = m.name;
    $('name').style.color = m.color;
    const zs = m.vertices.map((v) => v[2]), xs = m.vertices.map((v) => v[0]);
    const len = Math.round(Math.max(...zs) - Math.min(...zs)), span = Math.round(Math.max(...xs) - Math.min(...xs));
    $('facts').textContent = len + ' m long, ' + span + ' m across \\u00b7 ' + m.vertices.length + ' vertices, ' + m.faces.length + ' faces';
    $('cobra').hidden = !m.scale;
  }
  $('cobra').onclick = () => { showCobra = !showCobra; $('cobra').setAttribute('aria-pressed', String(showCobra)); };

  const turn = (v) => {
    const [x, y, z] = v;
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    return [x1, y * Math.cos(pitch) - z1 * Math.sin(pitch), y * Math.sin(pitch) + z1 * Math.cos(pitch)];
  };
  const extent = (vs) => Math.max(1, ...vs.map((v) => Math.hypot(v[0], v[1], v[2])));

  /** Faces filled dark, far to near, each outlined as it lands: near faces hide far lines, as in the game. */
  function drawShape(vs, faces, ox, scale, color, glow, ghost) {
    const w = canvas.width, h = canvas.height, d = extent(vs) * 5; // a gentle perspective: the eye five sizes away
    const t = vs.map(turn);
    const p = t.map(([x, y, z]) => { const k = d / (d + z); return [w / 2 + ox + x * scale * k, h * 0.46 - y * scale * k]; });
    const order = faces.map((f, i) => [i, f.reduce((s, j) => s + t[j][2], 0) / f.length]).sort((a, b) => b[1] - a[1]);
    ctx.lineJoin = 'round';
    for (const [i] of order) {
      const f = faces[i];
      if (f.some((j) => !p[j])) continue;
      ctx.beginPath();
      f.forEach((j, n) => (n ? ctx.lineTo(p[j][0], p[j][1]) : ctx.moveTo(p[j][0], p[j][1])));
      ctx.closePath();
      ctx.fillStyle = '#04070c';
      ctx.fill();
      if (ghost) { ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(150,165,190,.45)'; ctx.lineWidth = 1; ctx.stroke(); continue; }
      ctx.shadowColor = color; ctx.shadowBlur = 10 * glow * devicePixelRatio;
      ctx.strokeStyle = color; ctx.lineWidth = 1.6 * devicePixelRatio; ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.6 * devicePixelRatio; ctx.stroke();
    }
    return p;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (spinning) yaw += dt * 0.35;
    const r = canvas.getBoundingClientRect();
    const W = Math.round(r.width * devicePixelRatio), H = Math.round(r.height * devicePixelRatio);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.clearRect(0, 0, W, H);
    if (model) {
      const cobra = showCobra && model.scale;
      const e = extent(model.vertices), ce = cobra ? extent(model.scale.vertices) : 0;
      // Side by side, centred as a pair: the Cobra's centre sits 1.05 x (both sizes) to the left of the ship's.
      const gap = (e + ce) * 1.05;
      const room = cobra ? W * 0.9 / (gap + e + ce) : W * 0.42 / e;
      const scale = Math.min(room, H * 0.36 / Math.max(e, ce)) * zoom;
      const ox = cobra ? ((gap + ce - e) * scale) / 2 : 0; // the Cobra's left edge and the ship's right edge equally far out
      if (cobra) drawShape(model.scale.vertices, model.scale.faces, ox - gap * scale, scale, '', 0, true);
      drawShape(model.vertices, model.faces, ox, scale, model.color, model.glow == null ? 1 : model.glow, false);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- Turning it: drag (mouse or finger), pinch or scroll to zoom ------------------
  const pointers = new Map(); let pinch = 0;
  const stop = () => { spinning = false; $('hint').style.opacity = 0; };
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); stop(); });
  canvas.addEventListener('pointermove', (e) => {
    const was = pointers.get(e.pointerId);
    if (!was) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoom = Math.min(4, Math.max(0.4, zoom * dist / pinch));
      pinch = dist;
      return;
    }
    yaw += (e.clientX - was[0]) * 0.01;
    pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - was[1]) * 0.01));
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); stop(); zoom = Math.min(4, Math.max(0.4, zoom * Math.exp(-e.deltaY * 0.0015))); }, { passive: false });
})();
</script></body></html>`;
