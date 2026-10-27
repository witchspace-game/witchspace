import type { Vec3 } from '../content/types';

// One blueprint view of the ship editor: the ship flat from the top, the side or
// the front, in metres, drawn in SVG. The chosen part's points are handles to
// drag; their mirror images are hollow, and drag mirrored. In "add" mode a tap
// on empty space puts a point there.

export type Axis = 0 | 1 | 2;

export interface View {
  name: string;
  /** Which coordinate runs left to right, and which runs up the page. */
  h: Axis;
  v: Axis;
}

export const VIEWS: View[] = [
  { name: 'Top', h: 0, v: 2 },
  { name: 'Side', h: 2, v: 1 },
  { name: 'Front', h: 0, v: 1 },
];

export interface Handle {
  part: number;
  point: number;
  at: Vec3;
  /** Drawn where the point's mirror image is: dragging moves the point mirrored. */
  ghost: boolean;
  /** Inside the body or along an edge, so not a corner: it makes no difference to the shape. */
  inside: boolean;
}

export interface Scene {
  edges: { a: Vec3; b: Vec3; part: number }[];
  handles: Handle[];
  selected: { part: number; point: number | null };
  /** Half the width of the view, in metres. */
  half: number;
  colour: string;
  adding: boolean;
}

export interface BlueprintEvents {
  select(part: number, point: number): void;
  /** `done` once the drag ends, so the change can go in the undo history once. */
  move(part: number, point: number, to: Vec3, done: boolean): void;
  add(at: Vec3): void;
  /** Snaps a coordinate to the grid (or not). */
  snap(c: number): number;
}

const NS = 'http://www.w3.org/2000/svg';

export function blueprint(svg: SVGSVGElement, view: View, on: BlueprintEvents) {
  let scene: Scene | null = null;
  let drag: { handle: Handle; pointer: number } | null = null;

  /** The pointer, in the view's metres. */
  const metres = (e: PointerEvent) => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { h: p.x, v: -p.y };
  };

  const moved = (h: Handle, e: PointerEvent): Vec3 | null => {
    const m = metres(e);
    if (!m) return null;
    const to = [...h.at] as Vec3;
    to[view.h] = on.snap(m.h);
    to[view.v] = on.snap(m.v);
    // A ghost is the mirror image: its x is the point's, negated.
    if (h.ghost) to[0] = -to[0];
    return to;
  };

  svg.addEventListener('pointerdown', (e) => {
    if (!scene) return;
    const el = (e.target as Element).closest<SVGElement>('[data-handle]');
    if (el) {
      const handle = scene.handles[Number(el.dataset.handle)];
      on.select(handle.part, handle.point);
      drag = { handle, pointer: e.pointerId };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (scene.adding) {
      const m = metres(e);
      if (!m) return;
      const at: Vec3 = [0, 0, 0];
      at[view.h] = on.snap(m.h);
      at[view.v] = on.snap(m.v);
      // The third coordinate comes from the chosen point, so new points sit beside it.
      const sel = scene.handles.find((h) => !h.ghost && h.part === scene!.selected.part && h.point === scene!.selected.point);
      const depth = ([0, 1, 2] as Axis[]).find((a) => a !== view.h && a !== view.v)!;
      at[depth] = sel ? sel.at[depth] : 0;
      on.add(at);
      e.preventDefault();
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const to = moved(drag.handle, e);
    if (to) on.move(drag.handle.part, drag.handle.point, to, false);
  });
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const to = moved(drag.handle, e);
    if (to) on.move(drag.handle.part, drag.handle.point, to, true);
    drag = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  function draw(s: Scene) {
    scene = s;
    const { half } = s;
    svg.setAttribute('viewBox', `${-half} ${-half} ${half * 2} ${half * 2}`);
    const step = half <= 30 ? 5 : half <= 120 ? 10 : 50;
    const parts: string[] = [];
    for (let g = Math.ceil(-half / step) * step; g <= half; g += step) {
      const cls = g === 0 ? 'bp-axis' : 'bp-grid';
      parts.push(`<line class="${cls}" x1="${g}" y1="${-half}" x2="${g}" y2="${half}"/><line class="${cls}" x1="${-half}" y1="${g}" x2="${half}" y2="${g}"/>`);
    }
    const x = (p: Vec3) => p[view.h];
    const y = (p: Vec3) => -p[view.v];
    for (const e of s.edges) {
      const mine = e.part === s.selected.part;
      parts.push(`<line class="bp-edge${mine ? ' mine' : ''}" x1="${x(e.a)}" y1="${y(e.a)}" x2="${x(e.b)}" y2="${y(e.b)}" stroke="${s.colour}"/>`);
    }
    const r = half * 0.028;
    s.handles.forEach((h, i) => {
      if (h.part !== s.selected.part) return;
      const chosen = !h.ghost && h.point === s.selected.point;
      const cls = `bp-point${h.ghost ? ' ghost' : ''}${h.inside ? ' inside' : ''}${chosen ? ' chosen' : ''}`;
      // A bigger, invisible circle under each point, for fingers.
      parts.push(`<g data-handle="${i}" class="${cls}"><circle class="bp-hit" cx="${x(h.at)}" cy="${y(h.at)}" r="${r * 2.6}"/><circle cx="${x(h.at)}" cy="${y(h.at)}" r="${h.ghost ? r * 0.7 : r}"/></g>`);
    });
    svg.innerHTML = parts.join('');
    svg.classList.toggle('adding', s.adding);
  }

  return { draw, dragging: () => Boolean(drag) };
}

/** An SVG element for a view, ready to put in the page. */
export function blueprintSvg(view: View): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'blueprint');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${view.name} view: drag the points to shape the ship`);
  return svg;
}
