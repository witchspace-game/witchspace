import * as THREE from 'three';
import { shipById } from '../content/ships';
import { buildPlanet, disposePlanet } from '../render/bodies';
import { Explosion } from '../render/explosion';
import { atSize, makeSpace, render, type Space } from '../render/renderer';
import { buildPainted, disposeShip, showUnidentified, type ShipModel } from '../render/shipModel';
import { Beams } from '../game/weapons';
import { focusOf, killerOf, poseAt, SAMPLE_RATE, smoothPosition, timelines, type Timeline, type TrackData } from '../game/track';
import { encodeVideo } from './encodeVideo';
import { escapeHtml } from './escape';
import { aftermathShot, assessorsNote, CameraRig, labelText, pickLabels, twoShot, type LabelBox, type Shot } from './killCamShots';
import { ICONS } from './shareLinks';

/** A heart, drawn as an outline; filled by CSS once you've hearted the clip. */
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
/** On a short screen (a phone held sideways), the controls tuck away after this long untouched while it plays. */
const IDLE_AFTER = 2500;
const shortScreen = () => window.matchMedia('(max-height: 500px)').matches;
import { openShareSheet } from './shareSheet';
import { caption, cardAlpha, endCard, fontFamily, loadIcon, stamp, still, uprightBand, videoFrames } from './videoCards';

// The kill cam (docs/design/kill-cam.md, stage 2): a moment rebuilt from its
// track, in the game's own renderer, so you can watch it from outside. A death,
// framed from behind the ship that got you with you in the same shot; any
// other clip, behind the ship you were fighting; or behind you, or orbiting
// the fight; paused, scrubbed or slowed, and saved upright for Shorts or wide.
// Always labelled a reconstruction: the video is what you saw, this is the
// assessors' account of what happened. The camera work is in killCamShots.ts.

/** The play button's three faces. */
const TRANSPORT: Record<'Play' | 'Pause' | 'Again', string> = {
  Play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  Pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  Again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2z"/></svg>',
};

type View = 'killer' | 'you' | 'orbit';
export type Shape = 'wide' | 'upright';

/** A shared clip, watched from its link: its hearts and the actions on it. */
export interface SharedView {
  hearts: number;
  mine: boolean;
  heart(on: boolean): Promise<{ hearts: number; mine: boolean } | null>;
  report(): Promise<boolean>;
}

/** A saved reconstruction, for the flight log and sharing. */
export interface KillCamVideo {
  video: Blob;
  poster: Blob | null;
  seconds: number;
  title: string;
  description: string;
  system: string;
}

const BEFORE_DEATH = 14; // seconds of the fight shown before the end, at first
/** How long a kill cam explosion lasts, seconds: done well before the end card fades up. */
const BOOM_LASTS = 2.6;
/** A ship whose radius is this share of half the frame or more is drawn at full brightness; smaller, dimmer, down to DIMMEST. */
const SHARP_SHARE = 0.1;
const DIMMEST = 0.4;
const AFTER_DEATH = 4.4; // long enough for the explosion to play out into the end card
const SLOW = 0.25;
const BOOM = 4.5; // seconds an explosion lasts
const FPS = 30;
/** Ships carry on at their last speed this long past the end of the track, rather than freezing. */
const EXTEND = 1;
/** Seconds after the explosion that the assessors' note comes up in a saved video. */
const NOTE_AT = 0.8;
const SIZES: Record<Shape, [number, number]> = { wide: [1280, 720], upright: [1080, 1920] };

interface Placed {
  id: number;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  killer: boolean;
  alpha: number;
}

export class KillCam {
  active = false;
  readonly space: Space = makeSpace();
  private data: TrackData | null = null;
  private tracks = new Map<number, Timeline>();
  private trackEnd = 0;
  private models = new Map<number, ShipModel>();
  private unknown = new Map<number, boolean>();
  private labels = new Map<number, HTMLElement>();
  private labelAlpha = new Map<number, number>();
  private planet: THREE.Group | null = null;
  private beams = new Beams(this.space.scene);
  private booms: { at: number; boom: Explosion }[] = [];
  private t = 0;
  private start = 0;
  private end = 0;
  private deathAt = 0;
  /** The other ship: whoever got you (a death), or the ship you were fighting. */
  private killer: number | undefined;
  /** The explosion the shot holds on: yours (a death), or the ship you were fighting. */
  private finale: { t: number; p: THREE.Vector3; r: number; from: THREE.Vector3 } | null = null;
  /** What the assessors found, in a line (deaths only). */
  private note: string | null = null;
  /** A death, or any other moment. */
  private death = false;
  /** The moment's own title, for a clip that isn't a death. */
  private named: string | undefined;
  /** Watching someone's shared clip (from its link): its hearts, a report, and the way into the game. */
  private shared: SharedView | null = null;
  private playing = true;
  /** When the viewer last touched anything: the controls tuck away on a short screen after a while (Marketing's check). */
  private touchedAt = 0;
  private speed = 1;
  private view: View = 'killer';
  private orbit = { yaw: 0.6, pitch: 0.25, dist: 0, dragging: false, auto: true };
  private readonly saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 50 };
  private readonly rig = new CameraRig();
  private onClose: (() => void) | null = null;
  /** Rendering a video: the live loop leaves the screen alone. */
  exporting = false;
  /** Where saved videos go (the game logs them in the flight log). */
  onVideo: ((v: KillCamVideo) => Promise<void>) | null = null;
  private lastVideo: KillCamVideo | null = null;
  private icon: ImageBitmap | null = null;
  private readonly el: HTMLElement;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.el = document.createElement('div');
    this.el.id = 'killcam';
    this.el.hidden = true;
    document.body.append(this.el);
  }

  /** Open a track: a death's, or any clip's (`seconds` long, ending where the track ends, titled `title`). */
  open(data: TrackData, opts: { seconds?: number; title?: string; onClose?: () => void; shared?: SharedView } = {}) {
    this.close(false);
    this.data = data;
    this.tracks = timelines(data);
    this.onClose = opts.onClose ?? null;
    this.shared = opts.shared ?? null;
    const death = data.events.find((e) => e.kind === 'death');
    const last = data.samples[data.samples.length - 1]?.t ?? 0;
    this.trackEnd = last;
    this.death = Boolean(death);
    this.named = opts.title;
    if (death) {
      this.deathAt = death.t;
      this.end = Math.min(last + EXTEND, this.deathAt + AFTER_DEATH);
      this.start = Math.max(0, this.deathAt - BEFORE_DEATH);
      this.killer = killerOf(data);
    } else {
      this.end = this.deathAt = last;
      this.start = Math.max(0, last - (opts.seconds ?? BEFORE_DEATH));
      this.killer = focusOf(data, this.start, this.end);
    }
    this.t = this.start;
    this.view = this.killer !== undefined ? 'killer' : 'orbit';
    this.playing = true;
    this.speed = 1;
    this.rig.reset();
    this.labelAlpha.clear();

    for (const s of data.ships) {
      const def = shipById(s.def);
      if (!def) continue;
      const model = buildPainted(def, s.look);
      model.root.visible = false;
      this.space.scene.add(model.root);
      this.models.set(s.id, model);
      if (s.role !== 'missile') {
        const label = document.createElement('span');
        label.className = 'killcam-label';
        label.hidden = true;
        this.el.append(label);
        this.labels.set(s.id, label);
      }
    }
    this.finale = this.findFinale(data);
    const killerName = this.killer !== undefined ? data.ships.find((s) => s.id === this.killer)?.label.split(' · ')[0] : undefined;
    this.note = this.death && killerName ? assessorsNote(data, this.killer, killerName, this.tracks) : null;
    const planet = data.scene.planet;
    if (planet) {
      this.planet = buildPlanet(planet.r, planet.color);
      this.planet.position.set(...planet.p);
      this.space.scene.add(this.planet);
    }
    if (data.scene.sun) this.space.sun.position.set(...data.scene.sun).normalize();

    this.saved.pos.copy(this.camera.position);
    this.saved.quat.copy(this.camera.quaternion);
    this.saved.fov = this.camera.fov;
    this.renderControls();
    this.el.hidden = false;
    document.body.classList.add('killcam-open');
    this.active = true;
    void loadIcon().then((i) => (this.icon = i));
  }

  close(notify = true) {
    if (!this.data) return;
    for (const m of this.models.values()) {
      m.root.removeFromParent();
      disposeShip(m);
    }
    this.models.clear();
    this.unknown.clear();
    this.labels.clear();
    this.clearBooms();
    if (this.planet) {
      this.planet.removeFromParent();
      disposePlanet(this.planet);
      this.planet = null;
    }
    this.data = null;
    this.active = false;
    this.el.hidden = true;
    this.el.innerHTML = '';
    document.body.classList.remove('killcam-open');
    this.camera.position.copy(this.saved.pos);
    this.camera.quaternion.copy(this.saved.quat);
    this.camera.fov = this.saved.fov;
    this.camera.updateProjectionMatrix();
    if (notify) this.onClose?.();
  }

  update(dt: number) {
    if (this.exporting) return;
    this.advance(dt);
    this.updateLabels(this.data, dt);
    this.updateTime();
    this.updateEnd();
  }

  /** Move the reconstruction on by dt seconds (scaled by the replay speed) and aim the camera. */
  private advance(dt: number) {
    const d = this.data;
    if (!d) return;
    const before = this.t;
    const step = this.playing ? dt * this.speed : 0;
    if (this.playing) {
      this.t = Math.min(this.end, this.t + step);
      if (this.t >= this.end) this.playing = false;
      // Shots fired since the last frame, as the game drew them.
      for (const e of d.events) if (e.kind === 'beam' && e.t > before && e.t <= this.t) this.beams.fire(new THREE.Vector3(...e.a), new THREE.Vector3(...e.b), e.color);
    }
    this.beams.update(step);
    const idle = this.playing && shortScreen() && performance.now() - this.touchedAt > IDLE_AFTER;
    if (this.el.classList.contains('idle') !== idle) this.el.classList.toggle('idle', idle);
    this.placeShips(d);
    this.updateBooms(d, step);
    this.aimCamera(d, step, dt);
    this.space.stars.position.copy(this.camera.position);
  }

  /** Where everyone was at time t: each ship from its own timeline, positions interpolated, orientations slerped. */
  private placeShips(d: TrackData) {
    const q = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const tail = 1.5 / SAMPLE_RATE;
    for (const [id, m] of this.models) {
      const tl = this.tracks.get(id);
      // Ships still about when the track ends carry on a moment, rather than freezing.
      const extend = tl && tl.t[tl.t.length - 1] >= this.trackEnd - tail ? EXTEND : 0;
      const at = tl && poseAt(tl, this.t, undefined, extend);
      if (!at) {
        m.root.visible = false;
        continue;
      }
      const { a, b, f } = at;
      m.root.position.set(...smoothPosition(at));
      m.root.quaternion.copy(q.set(...a.q)).slerp(qb.set(...b.q), Math.min(1, f));
      // A ship that blew up is gone from that moment: its debris takes over.
      m.root.visible = !d.events.some((e) => e.kind === 'boom' && e.id === id && e.t <= this.t);
      // Small on screen, dimmer: the glow is the same size whatever the ship's, so a distant ship's glow
      // swamped its lines and a Cobra read as a green smear (Mark's Orgetibe clip). Dimmed, it stays a wireframe.
      if (m.root.visible) {
        const dist = Math.max(1, this.camera.position.distanceTo(m.root.position));
        // Its radius as a share of half the frame's height: the same at any screen or video size.
        const share = m.radius / (dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
        const k = THREE.MathUtils.clamp(share / SHARP_SHARE, DIMMEST, 1);
        if (m.root.userData.dim !== k) {
          for (const l of m.lines) l.material.color.copy(l.base).multiplyScalar(k);
          m.root.userData.dim = k;
        }
      }
      const unknown = Boolean(a.unknown);
      if (this.unknown.get(id) !== unknown) {
        showUnidentified(m, unknown);
        this.unknown.set(id, unknown);
      }
    }
  }

  private clearBooms() {
    for (const b of this.booms) b.boom.dispose();
    this.booms = [];
  }

  /** Explosions that should be playing at time t; scrubbing rebuilds them from their start. */
  private updateBooms(d: TrackData, dt: number) {
    const due = d.events.filter((e) => e.kind === 'boom' && e.t <= this.t && this.t < e.t + BOOM);
    const stale = this.booms.length !== due.length || this.booms.some((b, i) => due[i]?.t !== b.at) || dt === 0;
    if (stale) {
      this.clearBooms();
      for (const e of due) {
        if (e.kind !== 'boom') continue;
        const ship = d.ships.find((s) => s.id === e.id);
        const def = ship && shipById(ship.def);
        if (!def) continue;
        const at = new THREE.Object3D();
        at.position.set(...e.p);
        // Line debris and a soft glow: the solid flash ball read as a white disc up close.
        // Burnt out in 2.6 s, so the screen is clear before the end card (Mark: the wreckage hanging there looked untidy).
        const painted = ship.look ? { ...def, style: { ...def.style, lineColor: ship.look.colour } } : def;
        const boom = new Explosion(painted, at, new THREE.Vector3(), { flash: 'glow', lasts: BOOM_LASTS });
        this.space.scene.add(boom.group);
        // Catch up to where it should be.
        for (let age = 0; age < this.t - e.t; age += 1 / 30) boom.update(Math.min(1 / 30, this.t - e.t - age));
        this.booms.push({ at: e.t, boom });
      }
      return;
    }
    for (const b of this.booms) b.boom.update(dt);
  }

  /** A ship's position at time t (null if it isn't there then). */
  private posAt(id: number | undefined, t: number): THREE.Vector3 | null {
    const tl = id === undefined ? undefined : this.tracks.get(id);
    const at = tl && poseAt(tl, t, undefined, EXTEND);
    if (!at) return null;
    return new THREE.Vector3(...smoothPosition(at));
  }

  private radiusOf(id: number | undefined): number {
    return (id !== undefined && this.models.get(id)?.radius) || 20;
  }

  /**
   * The explosion the replay ends on, and the side the camera holds it from:
   * the side the two-shot was on when it happened, so the move to it is a glide.
   */
  private findFinale(d: TrackData): KillCam['finale'] {
    const id = this.death ? d.scene.you : this.killer;
    const e = d.events.find((x) => x.kind === 'boom' && x.id === id && x.t >= this.start && x.t <= this.end);
    if (!e || e.kind !== 'boom') return null;
    const p = new THREE.Vector3(...e.p);
    const r = this.radiusOf(id);
    // The two-shot is always from behind the other ship (the killer, or the target) towards you.
    const lead = this.killer;
    const other = d.scene.you;
    const leadAt = this.posAt(lead, e.t - 0.05);
    const otherAt = this.death ? p : this.posAt(other, e.t - 0.05);
    let from = new THREE.Vector3(0.3, 0.4, -1);
    if (leadAt && otherAt) {
      const s = twoShot({ p: leadAt, r: this.radiusOf(lead) }, { p: otherAt, r: this.radiusOf(other) }, this.camera.aspect);
      if (s.pos.distanceToSquared(p) > 1) from = s.pos.clone().sub(p);
    }
    from.normalize();
    // Fights often end by the station: don't hold on the debris through it. Of a few
    // sides near the two-shot's, take the first with the station well off the line of sight.
    const station = d.ships.find((s) => s.role === 'station');
    const sp = station && this.posAt(station.id, e.t);
    if (sp) {
      const up = new THREE.Vector3(0, 1, 0);
      const dist = Math.max(r * 8, 150);
      const clear = (dir: THREE.Vector3) => {
        const cam = p.clone().addScaledVector(dir, dist);
        const toStation = sp.clone().sub(cam);
        const ahead = toStation.dot(p.clone().sub(cam).normalize());
        // Behind the camera, or wide of the shot, is fine.
        return ahead <= 0 || toStation.angleTo(p.clone().sub(cam)) > THREE.MathUtils.degToRad(40);
      };
      const tries = [0, 1, -1, 2, -2, 3].map((k) => from.clone().applyAxisAngle(up, k * 0.8));
      tries.push(from.clone().lerp(up, 0.7).normalize(), from.clone().lerp(up.clone().negate(), 0.7).normalize());
      from = tries.find(clear) ?? from;
    }
    return { t: e.t, p, r, from };
  }

  private visiblePos(id: number | undefined): THREE.Vector3 | null {
    const m = id === undefined ? undefined : this.models.get(id);
    return m?.root.visible ? m.root.position : null;
  }

  /** Where you were, or where you died once you're gone. */
  private you(d: TrackData): THREE.Vector3 {
    const here = this.visiblePos(d.scene.you);
    if (here) return here;
    const boom = d.events.find((e) => e.kind === 'boom' && e.id === d.scene.you);
    if (boom && boom.kind === 'boom') return new THREE.Vector3(...boom.p);
    return this.posAt(d.scene.you, this.t) ?? new THREE.Vector3();
  }

  /** The shot the current view wants at time t. */
  private shot(d: TrackData, step: number): Shot {
    const aspect = this.camera.aspect;
    const you = this.you(d);
    const killer = this.visiblePos(this.killer);
    const fin = this.finale;
    const view = this.view;
    // After the explosion, the killer and target views hold on it (so does yours, once you're the one gone).
    if (fin && this.t >= fin.t && (view === 'killer' || (view === 'you' && this.death))) {
      const k = this.death && killer ? { p: killer, r: this.radiusOf(this.killer) } : null;
      return aftermathShot({ p: fin.p, r: fin.r }, fin.from, this.t - fin.t, aspect, k);
    }
    if (view === 'killer' && killer) return twoShot({ p: killer, r: this.radiusOf(this.killer) }, { p: you, r: this.radiusOf(d.scene.you) }, aspect, 'killer');
    const youModel = this.models.get(d.scene.you);
    if (view === 'you' && youModel?.root.visible) {
      const back = aspect < 1 ? 1 / aspect : 1;
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(youModel.root.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(youModel.root.quaternion);
      return {
        key: 'you',
        anchor: you.clone(),
        pos: you.clone().addScaledVector(f, -70 * back).addScaledVector(up, 22 * back),
        look: you.clone().addScaledVector(f, 300),
        fov: 55,
      };
    }
    // Orbit the fight: you, and whoever killed you.
    const centre = killer ? you.clone().lerp(killer, 0.5) : you.clone();
    const spread = killer ? killer.distanceTo(you) : 0;
    const dist = this.orbit.dist || THREE.MathUtils.clamp(spread * 0.9 + 160, 180, 2500) * (aspect < 1 ? 1.4 : 1);
    if (this.orbit.auto) this.orbit.yaw += step * 0.12;
    const o = this.orbit;
    const pos = new THREE.Vector3(Math.cos(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.sin(o.yaw) * Math.cos(o.pitch)).multiplyScalar(dist).add(centre);
    return { key: 'orbit', anchor: centre, pos, look: centre.clone(), fov: 50 };
  }

  private aimCamera(d: TrackData, step: number, dt: number) {
    // Dragging the orbit is direct: no easing between the finger and the view.
    if (this.orbit.dragging) this.rig.reset();
    this.rig.update(this.shot(d, step), this.playing ? step : dt);
    this.camera.position.copy(this.rig.pos);
    this.camera.quaternion.copy(this.rig.quat);
    this.camera.fov = this.rig.fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /**
   * Where the labels go in a w×h frame: the ship that got you and you always,
   * anyone else only where there's room (killCamShots.pickLabels), each fading
   * in and out rather than popping. `measure` gives a label's box size.
   */
  private layoutLabels(d: TrackData, w: number, h: number, measure: (id: number, text: string) => [number, number], dt: number, top = 0): Placed[] {
    const v = new THREE.Vector3();
    const boxes: (LabelBox & { text: string; killer: boolean })[] = [];
    const halfTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const k = this.visiblePos(this.killer);
    const y = this.visiblePos(d.scene.you);
    const centre = k && y ? k.clone().lerp(y, 0.5) : (k ?? y);
    const cs = centre ? centre.clone().project(this.camera) : null;
    for (const [id] of this.labels) {
      const m = this.models.get(id);
      if (!m?.root.visible) continue;
      v.copy(m.root.position).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const sx = ((v.x + 1) / 2) * w;
      const sy = ((1 - v.y) / 2) * h;
      const dist = this.camera.position.distanceTo(m.root.position);
      const rpx = (m.radius / (dist * halfTan)) * (h / 2);
      const ship = d.ships.find((s) => s.id === id)!;
      const isKiller = id === this.killer;
      const isYou = id === d.scene.you;
      const text = labelText(ship.label, { you: isYou, killer: this.death && isKiller, unknown: this.unknown.get(id) });
      const [bw, bh] = measure(id, text);
      const gap = THREE.MathUtils.clamp(rpx * 0.7, bh * 0.3, h * 0.2);
      const near = cs ? Math.hypot(v.x - cs.x, v.y - cs.y) : 1;
      const x = THREE.MathUtils.clamp(sx - bw / 2, 4, w - bw - 4);
      let ly = sy - gap - bh;
      if (ly < top) ly = sy + gap; // under its ship if the top band would cover it
      boxes.push({ id, rank: isKiller ? 0 : isYou ? 1 : 2 + near, x, y: ly, w: bw, h: bh, altY: sy + gap, text, killer: this.death && isKiller });
    }
    // A short screen has room for the two that matter: the killer and you.
    const chosen = pickLabels(h < 500 ? boxes.filter((b) => b.rank < 2) : boxes);
    const out: Placed[] = [];
    const ease = dt <= 0 ? 1 : Math.min(1, dt / 0.25);
    const seen = new Set<number>();
    for (const b of boxes) {
      seen.add(b.id);
      const want = chosen.has(b.id) ? 1 : 0;
      const was = this.labelAlpha.get(b.id) ?? 0;
      const alpha = was + (want - was) * ease;
      this.labelAlpha.set(b.id, alpha);
      if (alpha > 0.02) out.push({ id: b.id, text: b.text, x: b.x, y: chosen.get(b.id) ?? b.y, w: b.w, h: b.h, killer: b.killer, alpha });
    }
    for (const id of this.labelAlpha.keys()) if (!seen.has(id)) this.labelAlpha.set(id, 0);
    return out;
  }

  private updateLabels(d: TrackData | null, dt: number) {
    if (!d) return;
    for (const el of this.labels.values()) el.hidden = true;
    if (!this.playing && this.t >= this.end) return; // the end card has the screen
    const placed = this.layoutLabels(
      d,
      innerWidth,
      innerHeight,
      (id, text) => {
        const el = this.labels.get(id)!;
        if (el.textContent !== text) el.textContent = text;
        el.hidden = false;
        return [el.offsetWidth, el.offsetHeight];
      },
      this.playing ? dt * this.speed : 0,
      this.el.querySelector<HTMLElement>('.killcam-head')?.getBoundingClientRect().bottom ?? 0,
    );
    for (const el of this.labels.values()) el.hidden = true;
    for (const p of placed) {
      const el = this.labels.get(p.id)!;
      el.hidden = false;
      el.classList.toggle('killer', p.killer);
      el.style.opacity = p.alpha.toFixed(2);
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    }
  }

  private updateTime() {
    const range = this.el.querySelector<HTMLInputElement>('.killcam-scrub');
    if (range && document.activeElement !== range) range.value = String(this.t);
    const time = this.el.querySelector<HTMLElement>('.killcam-time');
    if (time) {
      const left = this.deathAt - this.t;
      time.textContent = !this.death ? `${(this.t - this.start).toFixed(1)} s` : left > 0 ? `${left.toFixed(1)} s before` : 'Ship destroyed';
    }
    const play = this.el.querySelector<HTMLButtonElement>('[data-act="play"]');
    const state = this.playing ? 'Pause' : this.t >= this.end ? 'Again' : 'Play';
    if (play && play.getAttribute('aria-label') !== state) {
      play.setAttribute('aria-label', state);
      play.innerHTML = TRANSPORT[state];
    }
  }

  /** Watched live, the replay ends on the same end card the videos do, faded up once it has played out. */
  private updateEnd() {
    const card = this.el.querySelector<HTMLCanvasElement>('.killcam-end');
    if (!card || !this.data) return;
    const over = !this.playing && this.t >= this.end;
    if (over && card.dataset.shown !== '1') {
      const dpr = Math.min(2, devicePixelRatio || 1);
      // On a short screen the card fits above the controls, so its last line and the address aren't under them.
      const bar = this.el.querySelector<HTMLElement>('.killcam-bar');
      const room = shortScreen() && bar ? Math.max(200, Math.floor(bar.getBoundingClientRect().top) - 8) : innerHeight;
      card.width = Math.round(innerWidth * dpr);
      card.height = Math.round(innerHeight * dpr);
      const g = card.getContext('2d')!;
      if (room < innerHeight) {
        // The whole screen goes dark; the card itself is laid out in the room above the controls.
        const top = document.createElement('canvas');
        top.width = card.width;
        top.height = Math.round(room * dpr);
        endCard(top.getContext('2d')!, top.width, top.height, this.title(this.data), this.icon);
        g.fillStyle = '#000';
        g.fillRect(0, 0, card.width, card.height);
        g.drawImage(top, 0, 0);
      } else endCard(g, card.width, card.height, this.title(this.data), this.icon);
      card.dataset.shown = '1';
    } else if (!over && card.dataset.shown === '1') card.dataset.shown = '';
  }

  private renderControls() {
    const d = this.data!;
    const killerName = this.killer !== undefined ? d.ships.find((s) => s.id === this.killer)?.label.split(' · ')[0] : undefined;
    this.el.insertAdjacentHTML(
      'afterbegin',
      `<canvas class="killcam-end" aria-hidden="true"></canvas><div class="killcam-head"><strong>Reconstruction</strong><span>${
        this.death
          ? `Our assessors have reconstructed the incident at ${escapeHtml(d.scene.system)} from your flight recorder${killerName ? `. The killing shot: the ${escapeHtml(killerName)}` : ''}.`
          : this.shared
            ? `${escapeHtml(this.named ?? '')}. Rebuilt from the flight recorder${killerName ? `, following the ${escapeHtml(killerName)}` : ''}.`
            : `Rebuilt from your flight recorder at ${escapeHtml(d.scene.system)}${killerName ? `, following the ${escapeHtml(killerName)}` : ''}.`
      }</span>${this.note ? `<span class="killcam-note">${escapeHtml(this.note)}</span>` : ''}${
        this.shared
          ? `<div class="killcam-shared"><button type="button" class="primary" data-act="play-free">Play Witchspace free</button><button type="button" class="killcam-report" data-act="report">Report</button></div>`
          : ''
      }</div>
      <button type="button" class="killcam-close" data-act="close" aria-label="Close">${ICONS.close}</button>${
        // The heart on the right edge, in thumb's reach as on Reels; an outline until you've hearted it (Mark).
        this.shared ? `<button type="button" class="killcam-heart" data-act="heart" aria-pressed="${this.shared.mine}" aria-label="Heart this clip">${HEART}<b>${this.shared.hearts}</b></button>` : ''
      }
      <div class="killcam-bar">
        <div class="killcam-time-row">
          <button type="button" class="killcam-play" data-act="play" aria-label="Pause">${TRANSPORT.Pause}</button>
          <input class="killcam-scrub" type="range" min="${this.start}" max="${this.end}" step="0.05" value="${this.start}" aria-label="Time" />
          <span class="killcam-time"></span>
          <button type="button" class="killcam-slow" data-act="slow" aria-pressed="false" title="Quarter speed">¼×</button>
        </div>
        <div class="killcam-row">
          <div class="killcam-seg killcam-views" role="group" aria-label="Camera">
            <button type="button" data-view="killer" title="${this.death ? 'The ship that got you, and you' : 'Behind the ship you fought'}"${this.killer === undefined ? ' disabled' : ''}>${this.death ? 'Killer' : 'Target'}</button>
            <button type="button" data-view="you" title="Behind your ship">You</button>
            <button type="button" data-view="orbit" title="Around the fight: drag to turn, scroll to zoom">Orbit</button>
          </div>
          <div class="killcam-seg killcam-save" role="group" aria-label="Save video">
            <span>Save</span>
            <button type="button" data-save="wide">Wide</button>
            <button type="button" data-save="upright" title="Upright, for Shorts, Reels and TikTok">Upright</button>
          </div>
        </div>
      </div>`,
    );
    const mark = () => this.el.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === this.view));
    mark();
    this.el.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
      b.addEventListener('click', () => {
        this.view = b.dataset.view as View;
        mark();
      }),
    );
    this.el.querySelector<HTMLButtonElement>('[data-act="play"]')!.onclick = () => this.togglePlay();
    const slow = this.el.querySelector<HTMLButtonElement>('[data-act="slow"]')!;
    slow.onclick = () => {
      this.speed = this.speed === 1 ? SLOW : 1;
      slow.setAttribute('aria-pressed', String(this.speed !== 1));
    };
    const scrub = this.el.querySelector<HTMLInputElement>('.killcam-scrub')!;
    scrub.oninput = () => {
      this.t = Number(scrub.value);
      this.playing = false;
      this.rig.reset(); // a scrubbed frame shows the shot as it is then
    };
    this.el.querySelector<HTMLButtonElement>('[data-act="close"]')!.onclick = () => this.close();
    this.touchedAt = performance.now();
    // The heart sits just above the controls where they fill the width: it needs their height.
    const barEl = this.el.querySelector<HTMLElement>('.killcam-bar');
    if (barEl) new ResizeObserver(() => this.el.style.setProperty('--killcam-bar-h', `${barEl.offsetHeight}px`)).observe(barEl);
    for (const ev of ['pointerdown', 'pointermove', 'keydown'] as const) this.el.addEventListener(ev, () => (this.touchedAt = performance.now()));
    const shared = this.shared;
    if (shared) {
      const heart = this.el.querySelector<HTMLButtonElement>('[data-act="heart"]')!;
      heart.onclick = async () => {
        heart.disabled = true;
        const r = await shared.heart(!shared.mine);
        heart.disabled = false;
        if (!r) return;
        Object.assign(shared, r);
        heart.setAttribute('aria-pressed', String(r.mine));
        heart.querySelector('b')!.textContent = String(r.hearts);
      };
      this.el.querySelector<HTMLButtonElement>('[data-act="play-free"]')!.onclick = () => this.close();
      const report = this.el.querySelector<HTMLButtonElement>('[data-act="report"]')!;
      report.onclick = async () => {
        if (!report.dataset.armed) {
          report.dataset.armed = '1';
          report.textContent = 'Report this clip?';
          return;
        }
        report.disabled = true;
        report.textContent = (await shared.report()) ? 'Reported · thank you' : 'Couldn’t report it';
      };
    }
    this.renderSaveButtons();
    // Drag to turn the orbit, scroll to zoom it.
    this.el.onpointerdown = (e) => {
      if ((e.target as HTMLElement).closest('.killcam-bar, .killcam-shared, .killcam-close')) return;
      this.orbit.dragging = true;
      this.orbit.auto = false;
      if (this.view !== 'orbit') {
        this.view = 'orbit';
        mark();
      }
    };
    this.el.onpointermove = (e) => {
      if (!this.orbit.dragging) return;
      this.orbit.yaw += e.movementX * 0.006;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + e.movementY * 0.006, -1.4, 1.4);
    };
    this.el.onpointerup = this.el.onpointercancel = () => (this.orbit.dragging = false);
    this.el.onwheel = (e) => {
      const base = this.orbit.dist || 600;
      this.orbit.dist = THREE.MathUtils.clamp(base * Math.exp(e.deltaY * 0.001), 60, 6000);
    };
  }

  private togglePlay() {
    if (this.t >= this.end) {
      this.t = this.start;
      this.rig.reset();
    }
    this.playing = !this.playing;
  }

  /** Save the reconstruction from the camera you're watching, fading into the end card; then offer to share it. */
  private async save(shape: Shape) {
    const d = this.data;
    if (!d || this.exporting) return;
    const box = this.el.querySelector<HTMLElement>('.killcam-save')!;
    const was = box.innerHTML;
    box.innerHTML = '<span class="killcam-saving">Saving · 0%</span>';
    this.exporting = true;
    const keep = { t: this.t, playing: this.playing, speed: this.speed, yaw: this.orbit.yaw };
    for (const l of this.labels.values()) l.hidden = true;
    const [w, h] = SIZES[shape];
    const span = this.end - this.start;
    const frames = videoFrames(span, FPS);
    const title = this.title(d);
    const icon = this.icon ?? (await loadIcon());
    const font = fontFamily();
    const size = h > w ? w / 26 : h / 30;
    const top = h > w ? uprightBand(w) : size * 4;
    let poster: Blob | null = null;
    // Start clean: no beams or explosions left over from watching.
    this.beams.update(1);
    this.clearBooms();
    this.t = this.start;
    this.playing = true;
    this.speed = 1;
    this.rig.reset();
    this.labelAlpha.clear();
    const video = await atSize(w, h, (canvas) =>
      encodeVideo({
        width: w,
        height: h,
        fps: FPS,
        frames: frames.total,
        onProgress: (f) => {
          const label = box.querySelector('.killcam-saving');
          if (label) label.textContent = `Saving · ${Math.round(f * 100)}%`;
        },
        draw: async (i, g) => {
          if (i < frames.scene) {
            this.playing = true;
            const dt = i === 0 ? 0 : 1 / FPS;
            this.advance(dt);
            render(this.space.scene);
            g.drawImage(canvas, 0, 0, w, h);
            g.font = `500 ${size}px ${font}`;
            this.drawLabels(g, this.layoutLabels(d, w, h, (_, text) => [g.measureText(text).width + size * 0.9, size * 1.5], dt, top), size);
            stamp(g, w, h, title);
            if (this.note && this.finale) {
              const since = this.t - this.finale.t - NOTE_AT;
              caption(g, w, h, `Assessors' note: ${this.note}`, Math.min(1, since / 0.5));
            }
            if (!poster && this.t >= this.deathAt - 1.5) poster = await still(g, w, h);
            endCard(g, w, h, title, icon, cardAlpha(i / FPS, span));
          } else endCard(g, w, h, title, icon);
        },
      }),
    ).catch(() => null);
    this.exporting = false;
    Object.assign(this, { t: keep.t, playing: keep.playing, speed: keep.speed });
    this.orbit.yaw = keep.yaw;
    this.rig.reset();
    this.clearBooms();
    if (!video) {
      box.innerHTML = '<span class="killcam-saving">This browser can\'t save video</span>';
      setTimeout(() => {
        box.innerHTML = was;
        this.renderSaveButtons();
      }, 2500);
      return;
    }
    this.lastVideo = { video, poster, seconds: frames.total / FPS, title, description: `Reconstructed from the flight recorder at ${d.scene.system}`, system: d.scene.system };
    await this.onVideo?.(this.lastVideo).catch(() => undefined);
    box.innerHTML = `<button type="button" class="primary" data-act="share-video">Share the video</button><span class="killcam-saving">Saved to your flight log</span>`;
    box.querySelector<HTMLButtonElement>('[data-act="share-video"]')!.onclick = () => {
      shareVideo(this.lastVideo!);
    };
  }

  private renderSaveButtons() {
    this.el.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((b) => (b.onclick = () => void this.save(b.dataset.save as Shape)));
  }

  /** "CMDR Kestrel: shot down by a Mamba at Riedquat". */
  private title(d: TrackData): string {
    if (!this.death && this.named) return this.named;
    const you = d.ships.find((s) => s.id === d.scene.you)?.label ?? 'A commander';
    const killer = this.killer !== undefined ? d.ships.find((s) => s.id === this.killer) : undefined;
    const who = killer ? (killer.def === 'falcon' ? 'the Falcon' : `a ${killer.label.split(' · ')[0]}`) : null;
    return `${you}: ${who ? `shot down by ${who}` : 'ship destroyed'} at ${d.scene.system}`;
  }

  /** The ship labels, drawn into the video (the live ones are HTML). */
  private drawLabels(g: OffscreenCanvasRenderingContext2D, placed: Placed[], size: number) {
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of placed) {
      g.globalAlpha = p.alpha;
      g.fillStyle = 'rgba(0, 6, 4, 0.66)';
      g.fillRect(p.x, p.y, p.w, p.h);
      if (p.killer) {
        g.strokeStyle = 'rgba(255, 77, 109, 0.7)';
        g.lineWidth = Math.max(1, size / 14);
        g.strokeRect(p.x, p.y, p.w, p.h);
      }
      g.fillStyle = p.killer ? '#ff8da1' : '#d8e2f0';
      g.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2 + size * 0.05);
    }
    g.restore();
  }

  /** Keys while it's open: space plays or pauses, Escape closes. Returns true if it used the key. */
  key(code: string): boolean {
    if (!this.active) return false;
    if (code === 'Escape') this.close();
    else if (code === 'Space') this.togglePlay();
    else return false;
    return true;
  }
}

/** Share a saved reconstruction: the share sheet, with its card (ui/shareSheet.ts). */
export function shareVideo(v: KillCamVideo) {
  openShareSheet({ blob: v.video, poster: v.poster ?? undefined, title: v.title, name: `witchspace-reconstruction-${v.system.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp4` });
}
