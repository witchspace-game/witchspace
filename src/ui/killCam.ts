import * as THREE from 'three';
import { shipById } from '../content/ships';
import { buildPlanet, disposePlanet } from '../render/bodies';
import { Explosion } from '../render/explosion';
import { atSize, makeSpace, render, type Space } from '../render/renderer';
import { buildShip, disposeShip, showUnidentified, type ShipModel } from '../render/shipModel';
import { Beams } from '../game/weapons';
import { bracket, focusOf, killerOf, type TrackData } from '../game/track';
import { encodeVideo } from './encodeVideo';
import { escapeHtml } from './escape';
import { ICONS } from './shareLinks';
import { openShareSheet } from './shareSheet';
import { fontFamily, houseCard, loadIcon, stamp, still } from './videoCards';

// The kill cam (docs/design/kill-cam.md, stage 2): a moment rebuilt from its
// track, in the game's own renderer, so you can watch it from outside. A death,
// behind the ship that got you; any other clip, behind the ship you were
// fighting; or behind you, or orbiting the fight; paused, scrubbed or slowed,
// and saved upright for Shorts or wide. Always labelled a reconstruction: the
// video is what you saw, this is the assessors' account of what happened.

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
const AFTER_DEATH = 4;
const SLOW = 0.25;
const BOOM = 4.5; // seconds an explosion lasts
const FPS = 30;
const CARD = 2.5; // seconds of the house card at the end of a saved video
const SIZES: Record<Shape, [number, number]> = { wide: [1280, 720], upright: [720, 1280] };

export class KillCam {
  active = false;
  readonly space: Space = makeSpace();
  private data: TrackData | null = null;
  private models = new Map<number, ShipModel>();
  private unknown = new Map<number, boolean>();
  private labels = new Map<number, HTMLElement>();
  private planet: THREE.Group | null = null;
  private beams = new Beams(this.space.scene);
  private booms: { at: number; boom: Explosion }[] = [];
  private t = 0;
  private start = 0;
  private end = 0;
  private deathAt = 0;
  /** The other ship: whoever got you (a death), or the ship you were fighting. */
  private killer: number | undefined;
  /** A death, or any other moment. */
  private death = false;
  /** The moment's own title, for a clip that isn't a death. */
  private named: string | undefined;
  /** Watching someone's shared clip (from its link): its hearts, a report, and the way into the game. */
  private shared: SharedView | null = null;
  private playing = true;
  private speed = 1;
  private view: View = 'killer';
  private orbit = { yaw: 0.6, pitch: 0.25, dist: 0, dragging: false, auto: true };
  private readonly saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 50 };
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private snap = true;
  private onClose: (() => void) | null = null;
  /** Rendering a video: the live loop leaves the screen alone. */
  exporting = false;
  /** Where saved videos go (the game logs them in the flight log). */
  onVideo: ((v: KillCamVideo) => Promise<void>) | null = null;
  private lastVideo: KillCamVideo | null = null;
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
    this.onClose = opts.onClose ?? null;
    this.shared = opts.shared ?? null;
    const death = data.events.find((e) => e.kind === 'death');
    const last = data.samples[data.samples.length - 1]?.t ?? 0;
    this.death = Boolean(death);
    this.named = opts.title;
    if (death) {
      this.deathAt = death.t;
      this.end = Math.min(last, this.deathAt + AFTER_DEATH);
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
    this.snap = true;

    for (const s of data.ships) {
      const def = shipById(s.def);
      if (!def) continue;
      const model = buildShip(def);
      model.root.visible = false;
      this.space.scene.add(model.root);
      this.models.set(s.id, model);
      if (s.role !== 'missile') {
        const label = document.createElement('span');
        label.className = 'killcam-label';
        this.el.append(label);
        this.labels.set(s.id, label);
      }
    }
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
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();
    this.renderControls();
    this.el.hidden = false;
    document.body.classList.add('killcam-open');
    this.active = true;
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
    for (const b of this.booms) b.boom.group.removeFromParent();
    this.booms = [];
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
    this.updateLabels(this.data);
    this.updateTime();
  }

  /** Move the reconstruction on by dt seconds (scaled by the replay speed) and aim the camera. */
  private advance(dt: number) {
    const d = this.data;
    if (!d) return;
    const before = this.t;
    if (this.playing) {
      this.t = Math.min(this.end, this.t + dt * this.speed);
      if (this.t >= this.end) this.playing = false;
      // Shots fired since the last frame, as the game drew them.
      for (const e of d.events) if (e.kind === 'beam' && e.t > before && e.t <= this.t) this.beams.fire(new THREE.Vector3(...e.a), new THREE.Vector3(...e.b), e.color);
    }
    this.beams.update(dt * (this.playing ? this.speed : 0));
    this.placeShips(d);
    this.updateBooms(d, this.playing ? dt * this.speed : 0);
    this.aimCamera(d, dt);
    this.space.stars.position.copy(this.camera.position);
  }

  /** Where everyone was at time t: positions interpolated, orientations slerped between samples. */
  private placeShips(d: TrackData) {
    const br = bracket(d, this.t);
    for (const m of this.models.values()) m.root.visible = false;
    if (!br) return;
    const q = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    for (const a of br.a.poses) {
      const m = this.models.get(a.id);
      if (!m) continue;
      const b = br.b.poses.find((p) => p.id === a.id) ?? a;
      m.root.position.set(a.p[0] + (b.p[0] - a.p[0]) * br.f, a.p[1] + (b.p[1] - a.p[1]) * br.f, a.p[2] + (b.p[2] - a.p[2]) * br.f);
      m.root.quaternion.copy(q.set(...a.q)).slerp(qb.set(...b.q), br.f);
      m.root.visible = true;
      const unknown = Boolean(a.unknown);
      if (this.unknown.get(a.id) !== unknown) {
        showUnidentified(m, unknown);
        this.unknown.set(a.id, unknown);
      }
    }
  }

  /** Explosions that should be playing at time t; scrubbing rebuilds them from their start. */
  private updateBooms(d: TrackData, dt: number) {
    const due = d.events.filter((e) => e.kind === 'boom' && e.t <= this.t && this.t < e.t + BOOM);
    const stale = this.booms.length !== due.length || this.booms.some((b, i) => due[i]?.t !== b.at) || dt === 0;
    if (stale) {
      for (const b of this.booms) b.boom.group.removeFromParent();
      this.booms = [];
      for (const e of due) {
        if (e.kind !== 'boom') continue;
        const ship = d.ships.find((s) => s.id === e.id);
        const def = ship && shipById(ship.def);
        if (!def) continue;
        const at = new THREE.Object3D();
        at.position.set(...e.p);
        const boom = new Explosion(def, at, new THREE.Vector3());
        this.space.scene.add(boom.group);
        // Catch up to where it should be.
        for (let age = 0; age < this.t - e.t; age += 1 / 30) boom.update(Math.min(1 / 30, this.t - e.t - age));
        this.booms.push({ at: e.t, boom });
      }
      return;
    }
    for (const b of this.booms) b.boom.update(dt);
  }

  private posOf(id: number | undefined): THREE.Vector3 | null {
    const m = id === undefined ? undefined : this.models.get(id);
    return m?.root.visible ? m.root.position : null;
  }

  /** Where you were, or where you died once you're gone. */
  private you(d: TrackData): THREE.Vector3 {
    const here = this.posOf(d.scene.you);
    if (here) return here;
    const boom = d.events.find((e) => e.kind === 'boom' && e.id === d.scene.you);
    if (boom && boom.kind === 'boom') return new THREE.Vector3(...boom.p);
    return new THREE.Vector3();
  }

  private aimCamera(d: TrackData, dt: number) {
    const you = this.you(d);
    const killerModel = this.killer !== undefined ? this.models.get(this.killer) : undefined;
    const killer = killerModel?.root.visible ? killerModel.root : null;
    // Each view: a ship to follow (the anchor), and where the camera sits and looks relative to it.
    const anchor = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    let view = this.view;
    if (view === 'killer' && !killer) view = 'orbit';
    const youModel = this.models.get(d.scene.you);
    if (view === 'you' && !youModel?.root.visible) view = 'orbit';
    // An upright frame is narrow: stand further back, so the ship doesn't fill it.
    const back = this.camera.aspect < 1 ? 1 / this.camera.aspect : 1;
    if (view === 'killer' && killer) {
      // Over the shoulder of the ship that got you, looking at you.
      const r = Math.max(30, (killerModel!.radius ?? 20) * 3.2) * back;
      const toYou = you.clone().sub(killer.position).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(killer.quaternion);
      anchor.copy(killer.position);
      pos.copy(toYou).multiplyScalar(-r).addScaledVector(up, r * 0.22); // low enough that the ship sits above the controls
      look.copy(you).sub(anchor);
    } else if (view === 'you' && youModel) {
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(youModel.root.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(youModel.root.quaternion);
      anchor.copy(you);
      pos.copy(f).multiplyScalar(-70 * back).addScaledVector(up, 22 * back);
      look.copy(f).multiplyScalar(300);
    } else {
      // Orbit the fight: you, and whoever killed you.
      const centre = killer ? you.clone().lerp(killer.position, 0.5) : you.clone();
      const spread = killer ? killer.position.distanceTo(you) : 0;
      const dist = this.orbit.dist || THREE.MathUtils.clamp(spread * 0.9 + 160, 180, 2500);
      if (this.orbit.auto && this.playing) this.orbit.yaw += dt * 0.12;
      anchor.copy(centre);
      pos.set(Math.cos(this.orbit.yaw) * Math.cos(this.orbit.pitch), Math.sin(this.orbit.pitch), Math.sin(this.orbit.yaw) * Math.cos(this.orbit.pitch)).multiplyScalar(dist);
      look.set(0, 0, 0);
    }
    // Ease the camera around the ship it follows (never in world space: a fighter outruns an easing camera),
    // except on the first frame or a cut.
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 6);
    this.snap = false;
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(anchor).add(this.camPos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(anchor.add(this.camLook));
  }

  private updateLabels(d: TrackData | null) {
    if (!d) return;
    const v = new THREE.Vector3();
    for (const [id, el] of this.labels) {
      const m = this.models.get(id);
      if (!m?.root.visible) {
        el.hidden = true;
        continue;
      }
      v.copy(m.root.position).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
        el.hidden = true;
        continue;
      }
      const ship = d.ships.find((s) => s.id === id)!;
      const text = this.unknown.get(id) ? 'Unidentified contact' : id === d.scene.you ? `${ship.label} (you)` : ship.label;
      const killing = this.death && id === this.killer ? ' · fired the killing shot' : '';
      el.textContent = text + killing;
      el.classList.toggle('killer', this.death && id === this.killer);
      el.hidden = false;
      el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -160%)`;
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

  private renderControls() {
    const d = this.data!;
    const killerName = this.killer !== undefined ? d.ships.find((s) => s.id === this.killer)?.label.split(' · ')[0] : undefined;
    this.el.insertAdjacentHTML(
      'afterbegin',
      `<div class="killcam-head"><strong>Reconstruction</strong><span>${
        this.death
          ? `Our assessors have reconstructed the incident at ${escapeHtml(d.scene.system)} from your flight recorder${killerName ? `. The killing shot: the ${escapeHtml(killerName)}` : ''}.`
          : this.shared
            ? `${escapeHtml(this.named ?? '')}. Rebuilt from the flight recorder${killerName ? `, following the ${escapeHtml(killerName)}` : ''}.`
            : `Rebuilt from your flight recorder at ${escapeHtml(d.scene.system)}${killerName ? `, following the ${escapeHtml(killerName)}` : ''}.`
      }</span>${
        this.shared
          ? `<div class="killcam-shared"><button type="button" class="killcam-heart" data-act="heart" aria-pressed="${this.shared.mine}" aria-label="Heart this clip">♥ <b>${this.shared.hearts}</b></button><button type="button" class="primary" data-act="play-free">Play Witchspace free</button><button type="button" class="killcam-report" data-act="report">Report</button></div>`
          : ''
      }</div>
      <button type="button" class="killcam-close" data-act="close" aria-label="Close">${ICONS.close}</button>
      <div class="killcam-bar">
        <div class="killcam-time-row">
          <button type="button" class="killcam-play" data-act="play" aria-label="Pause">${TRANSPORT.Pause}</button>
          <input class="killcam-scrub" type="range" min="${this.start}" max="${this.end}" step="0.05" value="${this.start}" aria-label="Time" />
          <span class="killcam-time"></span>
          <button type="button" class="killcam-slow" data-act="slow" aria-pressed="false" title="Quarter speed">¼×</button>
        </div>
        <div class="killcam-row">
          <div class="killcam-seg killcam-views" role="group" aria-label="Camera">
            <button type="button" data-view="killer" title="${this.death ? 'Behind the ship that got you' : 'Behind the ship you fought'}"${this.killer === undefined ? ' disabled' : ''}>${this.death ? 'Killer' : 'Target'}</button>
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
        this.snap = true;
        mark();
      }),
    );
    this.el.querySelector<HTMLButtonElement>('[data-act="play"]')!.onclick = () => {
      if (this.t >= this.end) this.t = this.start;
      this.playing = !this.playing;
    };
    const slow = this.el.querySelector<HTMLButtonElement>('[data-act="slow"]')!;
    slow.onclick = () => {
      this.speed = this.speed === 1 ? SLOW : 1;
      slow.setAttribute('aria-pressed', String(this.speed !== 1));
    };
    const scrub = this.el.querySelector<HTMLInputElement>('.killcam-scrub')!;
    scrub.oninput = () => {
      this.t = Number(scrub.value);
      this.playing = false;
    };
    this.el.querySelector<HTMLButtonElement>('[data-act="close"]')!.onclick = () => this.close();
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
    this.el.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((b) => (b.onclick = () => void this.save(b.dataset.save as Shape)));
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

  /** Save the reconstruction from the camera you're watching, ending on the house card; then offer to share it. */
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
    const fight = Math.ceil(span * FPS);
    const frames = fight + Math.ceil(CARD * FPS);
    const title = this.title(d);
    const icon = await loadIcon();
    let poster: Blob | null = null;
    // Start clean: no beams or explosions left over from watching.
    this.beams.update(1);
    for (const b of this.booms) b.boom.group.removeFromParent();
    this.booms = [];
    this.t = this.start;
    this.playing = true;
    this.speed = 1;
    this.snap = true;
    const video = await atSize(w, h, (canvas) =>
      encodeVideo({
        width: w,
        height: h,
        fps: FPS,
        frames,
        onProgress: (f) => {
          const label = box.querySelector('.killcam-saving');
          if (label) label.textContent = `Saving · ${Math.round(f * 100)}%`;
        },
        draw: async (i, g) => {
          if (i < fight) {
            this.playing = true;
            this.advance(i === 0 ? 0 : 1 / FPS);
            render(this.space.scene);
            g.drawImage(canvas, 0, 0, w, h);
            this.drawLabels(g, d, w, h);
            stamp(g, w, h, title);
            if (!poster && this.t >= this.deathAt - 1.5) poster = await still(g, w, h);
          } else houseCard(g, w, h, title, icon);
        },
      }),
    ).catch(() => null);
    this.exporting = false;
    Object.assign(this, { t: keep.t, playing: keep.playing, speed: keep.speed });
    this.orbit.yaw = keep.yaw;
    this.snap = true;
    if (!video) {
      box.innerHTML = '<span class="killcam-saving">This browser can\'t save video</span>';
      setTimeout(() => {
        box.innerHTML = was;
        this.renderSaveButtons();
      }, 2500);
      return;
    }
    this.lastVideo = { video, poster, seconds: span + CARD, title, description: `Reconstructed from the flight recorder at ${d.scene.system}`, system: d.scene.system };
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
  private drawLabels(g: OffscreenCanvasRenderingContext2D, d: TrackData, w: number, h: number) {
    const v = new THREE.Vector3();
    const size = Math.round(Math.min(w, h) / 42);
    g.font = `500 ${size}px ${fontFamily()}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    for (const [id] of this.labels) {
      const m = this.models.get(id);
      if (!m?.root.visible) continue;
      v.copy(m.root.position).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const ship = d.ships.find((s) => s.id === id)!;
      const killing = this.death && id === this.killer;
      const text = (this.unknown.get(id) ? 'Unidentified contact' : id === d.scene.you ? `${ship.label} (you)` : ship.label) + (killing ? ' · fired the killing shot' : '');
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h - size * 1.6;
      const tw = g.measureText(text).width;
      g.fillStyle = 'rgba(0, 6, 4, 0.6)';
      g.fillRect(x - tw / 2 - size * 0.4, y - size * 1.25, tw + size * 0.8, size * 1.5);
      g.fillStyle = killing ? '#ff8da1' : '#d8e2f0';
      g.fillText(text, x, y);
    }
  }

  /** Keys while it's open: space plays or pauses, Escape closes. Returns true if it used the key. */
  key(code: string): boolean {
    if (!this.active) return false;
    if (code === 'Escape') this.close();
    else if (code === 'Space') {
      if (this.t >= this.end) this.t = this.start;
      this.playing = !this.playing;
    } else return false;
    return true;
  }
}

/** Share a saved reconstruction: the share sheet, with its card (ui/shareSheet.ts). */
export function shareVideo(v: KillCamVideo) {
  openShareSheet({ blob: v.video, poster: v.poster ?? undefined, title: v.title, name: `witchspace-reconstruction-${v.system.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp4` });
}
