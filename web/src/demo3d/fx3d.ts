/**
 * The world's atmosphere and street life for the 3D demo. `Fx` is the one controller `main.ts` talks to:
 * `setWeather`, `setTime`, `setEvent`. It ports `web/src/game/sky.ts` (a sky over Aarhus with a sun that
 * rises and sets, stars and a phased moon, clouds, fog, drizzle, rain, storms with lightning, snow) and
 * `game/emoji.ts` (emoji bursts), and mounts the town's street life (`fx3d-town.ts`): the cop and his siren,
 * the roaming merchant, the outage picnic and "touched grass", the build snail, the paperboy and the
 * Sprint Race. The light follows the clock smoothly: the same lamps and windows as the old Night button,
 * but dimmed in by degrees, and the sun swings round the sky.
 */

import { dayKey, worldWall } from "@tokenmaxxing/core/range.ts";
import { copenhagenToMs as aarhusToMs, type Light, moonPhase, presetWeather, type Weather, type WeatherKind, winterSnow } from "@tokenmaxxing/core/sky.ts";
import * as THREE from "three";
import { AarhusWeather, lightAt } from "./aarhus.ts";
import type { Avatar } from "./avatar.ts";
import { FX_ASSETS, type FxCtx, type FxHost, type FxLabelHandle, type FxStageRef, TownFx } from "./fx3d-town.ts";
import { ticks } from "./kit.ts";
import { addPatch } from "./patches.ts";

export { FX_ASSETS, type FxHost, type FxLabelHandle, type FxStageRef };

export type FxEvent =
  | "cop"
  | "merchant"
  | "picnic"
  | "grass"
  | "race"
  | "paperboy"
  | "snail"
  | "emoji"
  | "coffee"
  | "glow"
  | "lightning"
  | "sleepers"
  | "chat-emoji";

export type FxWeather = WeatherKind | "winter" | "live";

/**
 * How the real game drives `Fx` instead of the demo: its own clock and the server's weather (so no Open-Meteo,
 * no debug panel, no scripted street life), and the game's sun. Left out, `Fx` is the demo's.
 */
export interface FxOptions {
  /** Now, in ms: the game's sky clock. */
  clock?: () => number;
  /** The weather to show (already with winter's snow rule). */
  weather?: () => Weather;
  /** The sun's light at a time (the game's, over Copenhagen). */
  light?: (ms: number) => Light;
  /** The debug panel and the Aarhus weather fetch (default true). */
  demo?: boolean;
  /** The cop, merchant, picnic... of `fx3d-town.ts` (default true). */
  streetLife?: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const col = (hex: string) => new THREE.Color(hex);
const mixCol = (a: THREE.Color, b: THREE.Color, k: number) => a.clone().lerp(b, clamp01(k));

// MARK: Emoji

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
/** The emoji in `text` (one per grapheme), or null if it holds anything else. (`web/src/game/emoji.ts`) */
export function emojiOnly(text: string): string[] | null {
  const parts = [...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim() !== "");
  const isEmoji = (s: string) =>
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s) && !/[\p{L}\p{N}]/u.test(s);
  return parts.length > 0 && parts.length <= 8 && parts.every(isEmoji) ? parts : null;
}

const BURST_MS = 1800;
const BURST_COUNT = 10;
const emojiTextures = new Map<string, THREE.CanvasTexture>();
function emojiTexture(e: string): THREE.CanvasTexture {
  let t = emojiTextures.get(e);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.font = `46px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(e, 32, 36);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    emojiTextures.set(e, t);
  }
  return t;
}

interface Floater {
  mesh: THREE.Mesh;
  scene: THREE.Scene;
  born: number;
  delay: number;
  at: () => THREE.Vector3;
  angle: number;
  reach: number;
  size: number;
  life: number;
}

// MARK: Sky

const SKY_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 top; uniform vec3 hor; uniform vec3 cloudCol;
uniform float dark; uniform float time; uniform float cloud; uniform float flash;
uniform float aspect; uniform float wind; uniform float moonAge; uniform float murk;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.,0.)), f.x), mix(h(i+vec2(0.,1.)), h(i+vec2(1.,1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a*n(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec3 c = mix(hor, top, smoothstep(0.0, 1.0, vUv.y));
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float night = dark * dark * (1.0 - cloud * 0.9);
  // Stars: a few hundred cells, some bigger, all twinkling.
  vec2 g = p * 64.0; vec2 id = floor(g); float r = h(id);
  float rad = 0.16 + 0.22 * h(id + 3.0);
  float star = step(0.975, r) * step(length(fract(g) - 0.5), rad) * (0.6 + 0.4 * sin(time * 2.0 + r * 60.0));
  c += vec3(0.9, 0.93, 1.0) * star * night * (0.5 + 0.5 * vUv.y);
  // The moon, at its phase: the lit side bright, the rest a faint disc.
  vec2 mc = vec2(aspect * 0.78, 0.8); float R = 0.05;
  vec2 d = (p - mc) / R; float len = length(d);
  float a = 6.2831853 * moonAge;
  if (len < 1.0) {
    float nz = sqrt(1.0 - len*len);
    float lit = smoothstep(-0.04, 0.04, dot(vec3(d, nz), vec3(sin(a), 0.0, -cos(a))));
    float crater = 0.06 * step(0.8, h(floor(d * 6.0)));
    vec3 mcol = mix(vec3(0.16, 0.2, 0.33), vec3(0.96, 0.94, 0.86) - crater, lit);
    c = mix(c, mcol, night);
  } else c += vec3(0.8, 0.85, 1.0) * 0.12 * exp(-(len - 1.0) * 3.5) * night;
  // Clouds drifting with the wind: more of them the heavier the cover.
  float f = fbm(p * 2.4 + vec2(time * wind * 0.012, 0.0));
  float m = smoothstep(0.66 - cloud * 0.36, 0.86 - cloud * 0.3, f) * (0.35 + 0.65 * smoothstep(0.0, 0.5, vUv.y + cloud * 0.3));
  c = mix(c, cloudCol, m * (0.55 + 0.4 * cloud));
  c = mix(c, c * vec3(0.7, 0.74, 0.8), murk);
  c += vec3(0.75, 0.8, 1.0) * flash * (0.35 + 0.65 * m);
  gl_FragColor = vec4(c, 1.0);
}
`;

// MARK: Weather particles

const RAIN_MAX = 900;
const SNOW_MAX = 700;
const REACH = 17;

class Particles {
  readonly group = new THREE.Group();
  private readonly rain: THREE.InstancedMesh;
  private readonly snow: THREE.InstancedMesh;
  private readonly rainPos: THREE.Vector3[] = [];
  private readonly snowPos: THREE.Vector3[] = [];
  private readonly ripples: { m: THREE.Mesh; age: number }[] = [];
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly bolt = new THREE.Group();
  private boltUntil = 0;
  flash = 0;
  density = 1;
  calm = false;
  private nextBolt = 0;

  constructor() {
    const rnd = (a: number) => (Math.random() - 0.5) * 2 * a;
    this.rain = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.014, 0.5, 0.014),
      new THREE.MeshBasicMaterial({ color: "#bcd8ff", transparent: true, opacity: 0.6, depthWrite: false }),
      RAIN_MAX,
    );
    this.snow = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false }),
      SNOW_MAX,
    );
    for (const m of [this.rain, this.snow]) {
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    for (let i = 0; i < RAIN_MAX; i++) this.rainPos.push(new THREE.Vector3(rnd(REACH), Math.random() * 11, rnd(REACH)));
    for (let i = 0; i < SNOW_MAX; i++) this.snowPos.push(new THREE.Vector3(rnd(REACH), Math.random() * 10, rnd(REACH)));
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.09, 12),
        new THREE.MeshBasicMaterial({ color: "#d6e4fa", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.ripples.push({ m, age: 9 });
    }
    this.group.add(this.bolt);
  }

  /** `lightning`: forces a strike now. */
  strike(t: number, centre: THREE.Vector3): void {
    this.bolt.clear();
    const x = centre.x + (Math.random() - 0.5) * 16;
    const z = centre.z + (Math.random() - 0.5) * 12;
    const mat = new THREE.MeshBasicMaterial({ color: "#f4f7ff", transparent: true, depthWrite: false });
    let px = x;
    let py = 15;
    let pz = z;
    while (py > 0.05) {
      const ny = Math.max(0, py - 1 - Math.random() * 1.2);
      const nx = px + (Math.random() - 0.5) * 1.2;
      const nz = pz + (Math.random() - 0.5) * 1.2;
      const len = Math.hypot(nx - px, ny - py, nz - pz);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, 0.07), mat);
      seg.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx - px, ny - py, nz - pz).normalize());
      this.bolt.add(seg);
      px = nx;
      py = ny;
      pz = nz;
    }
    this.boltUntil = t + 0.35;
    this.flash = 1;
    this.flashAt = t;
  }
  private flashAt = -9;

  update(dt: number, t: number, w: Weather, centre: THREE.Vector3, auto: boolean, wind: THREE.Vector2): void {
    const falls = w.kind === "rain" || w.kind === "drizzle" || w.kind === "storm";
    const snows = w.kind === "snow";
    const rainN = falls ? Math.round(w.intensity * RAIN_MAX * this.density * (w.kind === "drizzle" ? 0.7 : 1)) : 0;
    const snowN = snows ? Math.round(w.intensity * SNOW_MAX * this.density) : 0;
    this.rain.count = rainN;
    this.snow.count = snowN;
    this.group.position.set(centre.x, 0, centre.z);
    // Rain: streaks slanted with the wind.
    if (rainN) {
      const speed = w.kind === "drizzle" ? 9 : w.kind === "storm" ? 17 : 14;
      const vel = new THREE.Vector3(wind.x * 3, -speed, wind.y * 3);
      this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize().negate());
      const k = w.kind === "drizzle" ? 0.6 : w.kind === "storm" ? 1.4 : 1;
      this.s.set(1, k, 1);
      for (let i = 0; i < rainN; i++) {
        const p = this.rainPos[i]!;
        p.addScaledVector(vel, dt * (0.8 + (i % 7) * 0.06));
        if (p.y < 0.05) {
          if (Math.random() < 0.05) this.drop(p.x, p.z);
          p.set((Math.random() - 0.5) * 2 * REACH, 10 + Math.random() * 3, (Math.random() - 0.5) * 2 * REACH);
        }
        this.m4.compose(p, this.q, this.s);
        this.rain.setMatrixAt(i, this.m4);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }
    if (snowN) {
      this.q.identity();
      this.s.set(1, 1, 1);
      for (let i = 0; i < snowN; i++) {
        const p = this.snowPos[i]!;
        p.y -= dt * (0.7 + (i % 5) * 0.15) * (1 + w.intensity);
        p.x += (wind.x * 0.5 + Math.sin(t * 0.9 + i) * 0.4) * dt;
        p.z += (wind.y * 0.5 + Math.cos(t * 0.8 + i * 1.7) * 0.3) * dt;
        if (p.y < 0.05) p.set((Math.random() - 0.5) * 2 * REACH, 9 + Math.random() * 2, (Math.random() - 0.5) * 2 * REACH);
        this.m4.compose(p, this.q, this.s);
        this.snow.setMatrixAt(i, this.m4);
      }
      this.snow.instanceMatrix.needsUpdate = true;
    }
    // Ripples where it lands.
    for (const r of this.ripples) {
      r.age += dt;
      const k = r.age / 0.45;
      r.m.visible = k < 1 && falls;
      if (r.m.visible) {
        r.m.scale.setScalar(1 + k * 3);
        (r.m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      }
    }
    // Lightning: now and then in a storm, a double flicker and a bolt.
    if (w.kind === "storm" && auto && !this.calm) {
      if (t > this.nextBolt) {
        this.strike(t, centre);
        this.nextBolt = t + 5 + Math.random() * 8;
      }
    }
    const e = t - this.flashAt;
    this.flash = this.calm ? 0 : e < 0.07 ? 0.9 : e < 0.13 ? 0.15 : e < 0.2 ? 0.8 : e < 0.5 ? 0.8 * (1 - (e - 0.2) / 0.3) : 0;
    this.bolt.visible = t < this.boltUntil && (e < 0.2 || Math.floor(e * 40) % 2 === 0);
  }

  private drop(x: number, z: number): void {
    const r = this.ripples.find((q) => q.age > 0.45);
    if (!r) return;
    r.age = 0;
    r.m.position.set(x, 0.11, z);
  }
}

/** How deep the snow lies, shared by every patched material (materials outlive a town and its `Fx`). */
const SNOW = { value: 0 };

// MARK: Fx

/** Seconds a `setTime(..., smooth)` jump takes to blend. */
const BLEND = 0.35;

export class Fx {
  private readonly ctx: FxCtx;
  private readonly host: FxHost;
  readonly town: TownFx | null;
  private readonly particles = new Particles();
  private readonly opts: FxOptions;
  private readonly lightOf: (ms: number) => Light;
  private readonly sky: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  /** 0..1 how deep the snow lies; shared by every patched material. */
  private readonly snowAmt = SNOW;
  private snowScan = 0;
  private readonly fogBank: THREE.Mesh[] = [];
  private readonly floaters: Floater[] = [];
  private readonly toastEl: HTMLDivElement;
  private readonly aarhus: AarhusWeather | null;
  private weatherPick: FxWeather = "live";
  private weather: Weather = { kind: "clear", intensity: 0, windMs: 1.5, windDir: 270, cloud: 0.1 };
  private shown: Weather = { ...this.weather };
  private winter = false;
  /** Sim clock: ms at `base`, running `speed` times real time from wall time `from`. */
  private base = Date.now();
  private from = performance.now();
  private speed = 1;
  private live = true;
  private light = { dark: 0, warm: 0, glow: 0 };
  private lit = { dark: 0, warm: 0, glow: 0 };
  private nightOn = false;
  private lightsAt = -9;
  private pointLights = new Map<string, THREE.PointLight[]>();
  private sleepers: { name: string; level: number }[] = [];
  private sleepTag?: FxLabelHandle;
  private chipTag?: FxLabelHandle;
  private jitter = new Map<Avatar, { until: number; cups: number }>();
  private glowBuff = new Map<Avatar, { until: number; halo: THREE.Mesh }>();
  private steam: { m: THREE.Mesh; born: number; avatar: Avatar }[] = [];
  private flashBoost = 0;
  private lastT = performance.now() / 1000;
  panel: HTMLDivElement | null = null;
  /** The clock being shown, updated every frame. */
  clockText = "";

  /** 0 to 1: how much of the rain and snow to draw (the graphics settings'). */
  set density(d: number) {
    this.particles.density = d;
  }

  /** How far the rain and snow spread round the middle: 1 is the demo's 17 units; wider for a wider picture. */
  set spread(k: number) {
    this.particles.group.scale.set(k, 1, k);
  }

  /** No lightning flashes. */
  set calm(on: boolean) {
    this.particles.calm = on;
  }

  constructor(host: FxHost, opts: FxOptions = {}) {
    this.host = host;
    this.opts = opts;
    this.lightOf = opts.light ?? lightAt;
    this.aarhus = opts.demo === false ? null : new AarhusWeather(() => this.syncPanel());
    this.ctx = {
      host,
      burst: (emojis, at, stage) => this.burst(emojis, at, stage),
      toast: (text) => this.toast(text),
    };
    this.toastEl = document.createElement("div");
    this.toastEl.className = "fx-toast";
    document.body.append(this.toastEl);
    this.sky = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: {
          top: { value: col("#5aa5e8") },
          hor: { value: col("#cfe8f8") },
          cloudCol: { value: col("#ffffff") },
          dark: { value: 0 },
          time: { value: 0 },
          cloud: { value: 0 },
          flash: { value: 0 },
          aspect: { value: 1.6 },
          wind: { value: 2 },
          moonAge: { value: 0.5 },
          murk: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    // Snow settles on every upward-facing surface (ground, roofs, benches) via a shader patch, see `whiten`.
    this.whiten(host.town.scene);
    // Fog banks: soft white slabs drifting over the ground.
    const fogMat = new THREE.MeshBasicMaterial({ color: "#e4e9ee", transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), fogMat.clone());
      m.scale.set(5 + Math.random() * 4, 0.6 + Math.random() * 0.5, 3 + Math.random() * 2);
      m.position.set(Math.random() * 34, 0.5 + Math.random() * 1.5, Math.random() * 30);
      m.userData.speed = 0.15 + Math.random() * 0.25;
      m.visible = false;
      host.town.scene.add(m);
      this.fogBank.push(m);
    }
    host.town.scene.add(this.particles.group);
    this.town = opts.streetLife === false ? null : new TownFx(this.ctx);
    this.setSleepers([]);
    if (opts.demo !== false) this.buildPanel();
  }

  /** Takes the toast and the panel out of the page; the scene's own objects go with the scene. */
  dispose(): void {
    this.toastEl.remove();
    this.panel?.remove();
    for (const f of this.floaters) {
      f.mesh.removeFromParent();
      (f.mesh.material as THREE.Material).dispose();
      f.mesh.geometry.dispose();
    }
    this.floaters.length = 0;
    for (const s of this.steam) s.m.removeFromParent();
    this.steam.length = 0;
    this.sleepTag?.remove();
    this.chipTag?.remove();
  }

  // ——— Clock ———

  /** How dark the sky is now, 0 (day) to 1 (night), as last shown. */
  clockDark(): number {
    return this.lit.dark;
  }

  /** Whether the sky dome is in the scene being shown (the town) rather than a plain background. */
  hasSky(): boolean {
    return this.sky.parent !== null;
  }

  /** The sky's colour at the horizon right now (for atmospheric haze). */
  horizon(): THREE.Color {
    return this.sky.material.uniforms.hor!.value as THREE.Color;
  }

  /** Aarhus time now on the sim clock. */
  now(): number {
    if (this.opts.clock) return this.opts.clock();
    return this.live ? Date.now() : this.base + (performance.now() - this.from) * this.speed;
  }

  /**
   * `"live"` (the real Aarhus clock), `"HH:MM"` or `"HH:MM:SS"` (today, Aarhus), a full
   * `"2026-10-21T22:30"`, or minutes since midnight as a number. The clock keeps running from there.
   */
  setTime(spec: "live" | string | number): void {
    if (spec === "live") {
      this.live = true;
      this.speed = 1;
      return;
    }
    const day = dayKey(Date.now());
    let ms: number | null = null;
    if (typeof spec === "number") {
      ms = aarhusToMs(`${day}T${String(Math.floor(spec / 60)).padStart(2, "0")}:${String(Math.floor(spec % 60)).padStart(2, "0")}`);
    } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(spec)) {
      const [h, m, s = "0"] = spec.split(":");
      ms = aarhusToMs(`${day}T${h!.padStart(2, "0")}:${m}`);
      if (ms !== null) ms += Number(s) * 1000;
    } else ms = aarhusToMs(spec);
    if (ms === null) return;
    this.live = false;
    this.base = ms;
    this.from = performance.now();
  }

  /** How fast the clock runs: 1 is real time, 1800 a whole day in 48 seconds. 0 freezes it. */
  setSpeed(x: number): void {
    this.base = this.now();
    this.from = performance.now();
    this.live = false;
    this.speed = x;
  }

  /** Minutes since midnight in Aarhus. */
  minutes(): number {
    const w = worldWall(this.now());
    return w.hour * 60 + w.minute + w.second / 60;
  }

  setWeather(pick: FxWeather): void {
    this.weatherPick = pick;
    this.winter = pick === "winter";
    this.weather = this.resolve();
    if (pick === "storm") this.particles.strike(performance.now() / 1000, this.host.town.target);
  }

  private resolve(): Weather {
    if (this.opts.weather) return this.opts.weather();
    const pick = this.weatherPick;
    const kind: WeatherKind = pick === "live" || pick === "winter" ? "clear" : pick;
    const base = presetWeather(kind)!;
    if (pick === "winter") return { ...presetWeather("cloudy")!, kind: "snow", intensity: 0.6 };
    // "Live" is Aarhus's real weather (Open-Meteo); until that has arrived, or offline with no cache, a clear day.
    // Open-Meteo's own snow is real, so only the preset gets winter's snow rule.
    if (pick === "live" && this.aarhus?.latest) return { ...this.aarhus.latest.weather };
    return winterSnow(base, this.now());
  }

  // ——— Events ———

  setEvent(name: FxEvent, on?: boolean | number): void {
    const t = performance.now() / 1000;
    const me = this.host.me();
    switch (name) {
      case "cop":
        this.town?.pullOver(t);
        break;
      case "merchant":
        this.town?.setMerchant(on === undefined ? !this.town.state().merchant : !!on);
        break;
      case "picnic":
        this.town?.setPicnic(on === undefined ? !this.town.state().picnic : !!on);
        break;
      case "grass":
        this.town?.touchGrass();
        break;
      case "race":
        if (this.town?.state().race && on !== true) this.town.endRace();
        else this.town?.startRace(t);
        break;
      case "paperboy":
        this.town?.paperboy(t);
        break;
      case "snail":
        this.host.show("Town");
        this.setTime("16:59:40");
        break;
      case "emoji":
        if (me) this.burst(["😂", "🔥", "🎉", "🚀"], () => me.top());
        break;
      case "chat-emoji":
        this.say("🔥🔥🚀", me ? () => me.top() : () => new THREE.Vector3(18, 1.5, 13));
        break;
      case "coffee":
        if (me) this.coffee(me.avatar, typeof on === "number" ? on : 3);
        break;
      case "glow":
        if (me) this.glowOn(me.avatar, 15);
        break;
      case "lightning":
        this.host.show("Town");
        this.particles.strike(t, this.host.town.target);
        break;
      case "sleepers":
        this.setSleepers(
          on === false || (on === undefined && this.sleepers.length > 2)
            ? []
            : [...this.sleepers, { name: ["lin", "ida", "ellen", "ada"][this.sleepers.length % 4]!, level: 4 + this.sleepers.length }],
        );
        break;
    }
    this.syncPanel();
  }

  /** `💤 N asleep` over the square, and a `💤 name Lv5` chip row under the mansion's sign (`game/labels.ts`). */
  setSleepers(list: { name: string; level: number }[]): void {
    this.sleepers = list;
    this.sleepTag?.remove();
    this.chipTag?.remove();
    this.sleepTag = this.chipTag = undefined;
    if (!list.length) return;
    this.sleepTag = this.host.label(this.host.town, `💤 ${list.length} asleep`, "tag", () => new THREE.Vector3(18, 2.1, 2.4));
    this.chipTag = this.host.label(
      this.host.town,
      list
        .slice(0, 4)
        .map((p) => `💤 ${p.name} Lv${p.level}`)
        .join("  "),
      "tag pet",
      () => new THREE.Vector3(6.8, 1.45, 9.0),
    );
  }

  // ——— Emoji ———

  /** Emoji popping out round `at` and floating up, a little staggered, fading (`labels.ts burst`). */
  burst(emojis: string[], at: () => THREE.Vector3, stage: FxStageRef = this.current()): void {
    const t = performance.now() / 1000;
    for (let i = 0; i < BURST_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: emojiTexture(emojis[i % emojis.length]!),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      stage.scene.add(mesh);
      this.floaters.push({
        mesh,
        scene: stage.scene,
        born: t,
        delay: ((i % 4) * 80) / 1000,
        at,
        angle: -Math.PI / 2 + ((i + 0.5) / BURST_COUNT - 0.5) * Math.PI * 1.5,
        reach: 0.25 + (i % 3) * 0.12,
        size: 0.3 + (i % 2) * 0.1,
        life: BURST_MS / 1000,
      });
    }
  }

  /** A chat line: made only of emoji, it bursts round its author instead of showing a bubble. */
  say(text: string, at: () => THREE.Vector3): boolean {
    const e = emojiOnly(text);
    if (e) this.burst(e, at);
    return !!e;
  }

  // ——— Coffee, jitter and the glow buff ———

  /** The coffee station: a cup's steam, and a shake a little per cup left (`render.ts drawAvatar`). */
  coffee(a: Avatar, cups: number, seconds = 10): void {
    this.jitter.set(a, { until: performance.now() / 1000 + seconds, cups });
    const t = performance.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }),
      );
      m.visible = false;
      this.steam.push({ m, born: t + i * 0.25, avatar: a });
      this.current().scene.add(m);
    }
    this.burst(["☕"], () => a.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    this.toast(`☕ ${cups} cups: wired for ${seconds} seconds.`);
  }

  /** The Tavern's glow special: a warm halo that pulses round you. */
  glowOn(a: Avatar, seconds: number): void {
    const old = this.glowBuff.get(a);
    old?.halo.removeFromParent();
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 16, 12),
      new THREE.MeshBasicMaterial({
        color: "#ffde78",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    a.root.add(halo);
    halo.position.y = 0.55;
    this.glowBuff.set(a, { until: performance.now() / 1000 + seconds, halo });
  }

  // ——— Toast ———

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("on");
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add("on");
  }

  // ——— Frame ———

  private current(): FxStageRef {
    return this.host.stages.find((s) => s.name === this.host.current()) ?? this.host.town;
  }

  /** Jumps the light and weather to where the clock and the weather say, without blending (a room just built). */
  settle(t: number, camera: THREE.OrthographicCamera): void {
    for (let i = 0; i < 3; i++) {
      this.lastT = t - 0.5;
      this.update(0, t, camera);
    }
  }

  /** Call once a frame, after the stage's own update. */
  update(_dt: number, t: number, camera: THREE.OrthographicCamera): void {
    // Our own frame time (main.ts clamps its dt to 50 ms, which would slow the weather on a slow machine).
    const dt = Math.min(0.5, Math.max(0.001, t - this.lastT));
    this.lastT = t;
    const ms = this.now();
    const stage = this.current();
    const inTown = stage === this.host.town;
    const l = this.lightOf(ms);
    // Weather eases in and out.
    this.weather = this.resolve();
    const w = this.weather;
    const k = Math.min(1, dt * 1.5);
    const s = this.shown;
    if (s.kind !== w.kind) {
      // Cross over: fade the old intensity out first, then switch.
      s.intensity = lerp(s.intensity, 0, Math.min(1, dt * 3));
      if (s.intensity < 0.05 || w.kind === "clear" || w.kind === "cloudy" || w.kind === "fog") s.kind = w.kind;
    }
    s.intensity = lerp(s.intensity, w.intensity, k);
    s.cloud = lerp(s.cloud, w.cloud, k);
    s.windMs = lerp(s.windMs, w.windMs, k);
    s.windDir = w.windDir;
    if (s.kind === w.kind) s.intensity = lerp(s.intensity, w.intensity, k);

    // The light of the sky, with clouds dimming it.
    const storm = s.kind === "storm" ? 0.2 : 0;
    const murk = s.cloud * 0.35 + storm + (s.kind === "fog" ? 0.1 * s.intensity : 0);
    const glowTarget = Math.min(1, Math.max(l.darkness, l.warmth * 0.5, s.cloud * 0.25 * (s.kind === "storm" ? 2 : 1)));
    const blend = Math.min(1, dt / BLEND);
    this.lit.dark = lerp(this.lit.dark, l.darkness, blend);
    this.lit.warm = lerp(this.lit.warm, l.warmth, blend);
    this.lit.glow = lerp(this.lit.glow, glowTarget, blend);
    const { dark, warm, glow } = this.lit;
    this.flashBoost = this.particles.flash;
    this.applyLight(dark, warm, murk, ms, glow);
    this.clockText = `${String(worldWall(ms).hour).padStart(2, "0")}:${String(worldWall(ms).minute).padStart(2, "0")}`;

    // Lamps and windows come on once it's dim enough.
    if (!this.nightOn && glow > 0.4) {
      this.nightOn = true;
      this.host.applyNight(true);
    } else if (this.nightOn && glow < 0.3) {
      this.nightOn = false;
      this.host.applyNight(false);
    }
    this.applyPointLights(glow, t);

    // The dome.
    if (inTown) {
      if (this.sky.parent !== stage.scene) stage.scene.add(this.sky);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      this.sky.position.copy(camera.position).addScaledVector(dir, 150);
      this.sky.quaternion.copy(camera.quaternion);
      const sw = (camera.right - camera.left) * 1.05;
      const sh = (camera.top - camera.bottom) * 1.05;
      this.sky.scale.set(sw, sh, 1);
      const u = this.sky.material.uniforms;
      const day = col("#4f9be0");
      const dayH = col("#bfe3f7");
      const warmT = col("#5a78b8");
      const warmH = col("#ffb27a");
      const nightT = col("#070b1c");
      const nightH = col("#1a2145");
      const grey = col("#8c97a6");
      const greyH = col("#c3c9d0");
      let top = mixCol(day, warmT, warm * 0.85);
      let hor = mixCol(dayH, warmH, warm * 0.85);
      top = mixCol(top, nightT, dark ** 1.3);
      hor = mixCol(hor, nightH, dark ** 1.3);
      const gk = clamp01(s.cloud * 0.6 + storm * 2 + (s.kind === "fog" ? 0.3 : 0)) * (1 - dark * 0.7);
      top = mixCol(top, grey.clone().multiplyScalar(1 - dark * 0.8 - storm), gk);
      hor = mixCol(hor, greyH.clone().multiplyScalar(1 - dark * 0.8 - storm), gk);
      u.top!.value.copy(top);
      u.hor!.value.copy(hor);
      u.cloudCol!.value.copy(mixCol(col("#ffffff"), mixCol(col("#ffb89a"), col("#1b2038"), dark), Math.max(warm * 0.6, dark)).multiplyScalar(1 - storm * 2.2));
      u.dark!.value = dark;
      u.time!.value = t;
      u.cloud!.value = s.cloud;
      u.flash!.value = this.flashBoost;
      u.aspect!.value = sw / sh;
      u.wind!.value = s.windMs;
      u.moonAge!.value = moonPhase(ms).age;
      u.murk!.value = murk * 0.5;
      // Fog fades the far end of the slab into the horizon.
      if (s.kind === "fog") {
        if (!stage.scene.fog) stage.scene.fog = new THREE.Fog(hor.getHex(), 60, 90);
        const f = stage.scene.fog;
        (f as THREE.Fog).color.copy(hor);
        (f as THREE.Fog).near = lerp(90, 46, s.intensity);
        (f as THREE.Fog).far = lerp(120, 78, s.intensity);
      } else stage.scene.fog = null;
    } else if (this.sky.parent) this.sky.removeFromParent();

    // Weather in the town (the indoor stages stay dry).
    const winds = new THREE.Vector2(
      -Math.sin((s.windDir * Math.PI) / 180) * Math.min(1, s.windMs / 10) * 2.5,
      Math.cos((s.windDir * Math.PI) / 180) * Math.min(1, s.windMs / 10) * 1.2,
    );
    this.particles.group.visible = inTown;
    this.particles.update(dt, t, s, this.host.town.target, true, winds);
    // Snow settles on up-facing surfaces and melts away; fog banks drift.
    const snowy = (s.kind === "snow" && s.intensity > 0.05) || this.winter;
    this.snowAmt.value = lerp(this.snowAmt.value, snowy ? 1 : 0, Math.min(1, dt * 0.5));
    this.snowScan -= dt;
    if (this.snowScan <= 0) {
      this.snowScan = 1.5;
      this.whiten(this.host.town.scene); // pick up props built since the last pass
    }
    for (const m of this.fogBank) {
      const mat = m.material as THREE.MeshBasicMaterial;
      const want = s.kind === "fog" ? 0.14 * s.intensity : 0;
      mat.opacity = lerp(mat.opacity, want, Math.min(1, dt));
      m.visible = mat.opacity > 0.01 && inTown;
      m.position.x += (m.userData.speed as number) * dt * (winds.x >= 0 ? 1 : -1);
      if (m.position.x > 40) m.position.x = -6;
      if (m.position.x < -6) m.position.x = 40;
    }

    // Street life and emoji.
    this.town?.update(dt, t, ms, glow);
    this.updateFloaters(t, camera);
    this.updateBuffs(dt, t, camera);
  }

  private applyLight(dark: number, warm: number, murk: number, ms: number, glow: number): void {
    const dayHemi = col("#fff4e0");
    const warmHemi = col("#ffc89a");
    const nightHemi = col("#8fa0ff");
    const daySun = col("#fff1d6");
    const warmSun = col("#ff9a5c");
    const nightSun = col("#9fb0ff");
    const wall = worldWall(ms);
    const hours = wall.hour + wall.minute / 60;
    // Morning on the left, evening on the right; at night the moon takes the same arc.
    const az = Math.max(-1.3, Math.min(1.3, (hours - 13) / 6));
    const flash = this.flashBoost;
    for (const s of this.host.stages) {
      const h = mixCol(mixCol(dayHemi, warmHemi, warm * 0.8), nightHemi, dark ** 1.4);
      const sc = mixCol(mixCol(daySun, warmSun, warm * 0.8), nightSun, dark ** 1.4);
      const grey = (c: THREE.Color) => c.lerp(new THREE.Color(0.7, 0.72, 0.76), murk * 0.5);
      s.hemi.color.copy(grey(h));
      s.sun.color.copy(grey(sc));
      s.hemi.intensity = lerp(1.6, 0.55, dark) * (1 - murk * 0.25) * (1 - warm * 0.08) + flash * 2.4;
      s.sun.intensity = lerp(lerp(2.4, 1.8, warm), 0.35, dark) * (1 - murk * 1.1);
      s.sun.intensity = Math.max(0.15, s.sun.intensity);
      const reach = s.sun.shadow.camera.right;
      const elev = clamp01(this.lightOf(ms).elevation / 55);
      s.sun.position.set(
        s.target.x + az * reach * 0.7,
        lerp(7, 15, Math.max(elev, dark * 0.6)),
        s.target.z + reach * 0.35,
      );
      s.sun.target.position.copy(s.target);
      (s.scene.background as THREE.Color | null)?.copy(mixCol(col("#1b1f2a"), col("#0f111a"), dark));
    }
    void glow;
  }

  /** Lamps shine in proportion to how dim it is: smoothly, not on and off. */
  private applyPointLights(glow: number, t: number): void {
    if (Math.abs(glow - this.light.glow) < 0.004 && t - this.lightsAt < 1.5) return;
    this.light.glow = glow;
    const refresh = t - this.lightsAt > 1.5;
    if (refresh) this.lightsAt = t;
    for (const s of this.host.stages) {
      let list = this.pointLights.get(s.name);
      if (!list || refresh) {
        list = [];
        s.scene.traverse((o) => {
          if (o instanceof THREE.PointLight && typeof o.userData.night === "number") list!.push(o);
        });
        this.pointLights.set(s.name, list);
      }
      for (const p of list) p.intensity = (p.userData.night as number) * glow;
    }
  }

  private updateFloaters(t: number, camera: THREE.Camera): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      const e = t - f.born - f.delay;
      if (e > f.life) {
        f.scene.remove(f.mesh);
        (f.mesh.material as THREE.Material).dispose();
        f.mesh.geometry.dispose();
        this.floaters.splice(i, 1);
        continue;
      }
      if (e < 0) continue;
      const k = e / f.life;
      const out = 1 - (1 - k) ** 3;
      const pop = k < 0.15 ? k / 0.15 : 1;
      const base = f.at();
      f.mesh.visible = true;
      f.mesh.position.set(base.x, base.y + 0.2, base.z);
      // Fan out in the screen plane (the camera's right and up), rise a little as it goes.
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const reach = (0.35 + 1.2 * out) * (0.7 + f.reach);
      f.mesh.position
        .addScaledVector(right, Math.cos(f.angle) * reach)
        .addScaledVector(up, Math.sin(f.angle) * reach * 0.8 + 0.5 * k);
      f.mesh.quaternion.copy(camera.quaternion);
      f.mesh.scale.setScalar(f.size * (0.6 + 0.9 * pop) * 2.1);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }

  private updateBuffs(dt: number, t: number, camera: THREE.Camera): void {
    for (const [a, j] of this.jitter) {
      if (t > j.until) {
        this.jitter.delete(a);
        continue;
      }
      // A nudge every frame, a little per cup still in their system; it wears off.
      const left = Math.min(4, j.cups * (1 - (t - (j.until - 10)) / 10 + 0.2));
      a.body.position.x += (Math.random() * 2 - 1) * left * 0.012;
      a.body.position.z += (Math.random() * 2 - 1) * left * 0.012;
      a.body.position.y += Math.random() * left * 0.004;
    }
    for (const [a, b] of this.glowBuff) {
      if (t > b.until) {
        b.halo.removeFromParent();
        this.glowBuff.delete(a);
        continue;
      }
      b.halo.scale.setScalar(1 + 0.12 * Math.sin(t * 3.1));
      (b.halo.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.1 * Math.sin(t * 3.1) + this.lit.glow * 0.12;
    }
    for (let i = this.steam.length - 1; i >= 0; i--) {
      const p = this.steam[i]!;
      const e = t - p.born;
      if (e > 1.4) {
        p.m.removeFromParent();
        this.steam.splice(i, 1);
        continue;
      }
      if (e < 0) continue;
      p.m.visible = true;
      const root = p.avatar.root.position;
      p.m.position.set(root.x + 0.12 + Math.sin(e * 5 + i) * 0.04, root.y + 0.5 + e * 0.5, root.z + 0.2);
      p.m.scale.setScalar(0.7 + e);
      (p.m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - e / 1.4);
    }
    void dt;
    void camera;
  }

  /** Teach every toon material in `root` to go white on surfaces that face up, scaled by `snowAmt`. */
  private whiten(root: THREE.Object3D): void {
    const uSnow = this.snowAmt;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(mat as THREE.MeshToonMaterial).isMeshToonMaterial || mat.userData.snowy) continue;
        mat.userData.snowy = true;
        addPatch(mat, "snowy", (sh) => {
          sh.uniforms.uSnow = uSnow;
          sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nvarying float vSnowUp;")
            .replace(
              "#include <beginnormal_vertex>",
              "#include <beginnormal_vertex>\n  vSnowUp = normalize(mat3(modelMatrix) * objectNormal).y;",
            );
          sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vSnowUp;\nuniform float uSnow;")
            .replace(
              "#include <dithering_fragment>",
              "#include <dithering_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.94, 0.97, 1.0), smoothstep(0.5, 0.8, vSnowUp) * uSnow * 0.95);",
            );
        });
      }
    });
  }

  // ——— Debug panel ———

  private syncPanel(): void {
    if (!this.panel) return;
    const st = this.town?.state() ?? {};
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-ev]")) {
      const ev = b.dataset.ev as string;
      b.classList.toggle("on", !!st[ev as keyof typeof st]);
    }
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-weather]"))
      b.classList.toggle("on", b.dataset.weather === this.weatherPick);
    const ar = this.panel.querySelector<HTMLElement>("#fx-aarhus");
    if (ar) {
      const wall = (ms: number) => {
        const w = worldWall(ms);
        return `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
      };
      ar.textContent = `${this.aarhus?.line()} · ${this.aarhus?.sourceLine(wall)}${this.weatherPick === "live" ? "" : " · manual override"}`;
    }
  }

  private buildPanel(): void {
    const style = document.createElement("style");
    style.textContent = `
      .fxpanel{left:12px;top:196px;width:262px;max-height:calc(100vh - 340px);overflow:auto;display:flex;flex-direction:column;gap:7px;font-size:12px}
      .fxpanel .head{display:flex;justify-content:space-between;cursor:pointer;font-weight:700}
      .fxpanel .head span{color:var(--muted);font-weight:400}
      .fxpanel.min .body{display:none}
      .fxpanel .body{display:flex;flex-direction:column;gap:7px}
      .fxpanel .row button{padding:3px 7px;font-size:12px}
      .fxpanel .lbl{color:var(--muted);font-size:11px;width:100%}
      .fxpanel input[type=range]{width:150px;accent-color:var(--accent)}
      .fx-toast{position:fixed;left:50%;top:14px;transform:translate(-50%,-80px);max-width:520px;padding:9px 14px;border-radius:10px;background:#fbf7ef;color:var(--ink);font-size:13px;box-shadow:0 3px 0 rgba(0,0,0,.3);pointer-events:none;opacity:0;z-index:30}
      .fx-toast.on{animation:fxtoast 4.2s ease-out forwards}
      @keyframes fxtoast{0%{opacity:0;transform:translate(-50%,-30px)}8%{opacity:1;transform:translate(-50%,0)}88%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-14px)}}
    `;
    document.head.append(style);
    const el = document.createElement("div");
    el.className = "panel fxpanel";
    const btn = (label: string, attrs: string) => `<button type="button" ${attrs}>${label}</button>`;
    el.innerHTML = `
      <div class="head" data-act="min">🌦️ Atmosphere &amp; street life <span id="fx-clock"></span></div>
      <div class="body">
        <div class="lbl">Time (Aarhus)</div>
        <div class="row">
          ${btn("Live", 'data-time="live"')}
          ${btn("🌅 06:30", 'data-time="06:30"')}
          ${btn("☀️ 12:00", 'data-time="12:00"')}
          ${btn("🌇 17:45", 'data-time="17:45"')}
          ${btn("🌙 23:30", 'data-time="23:30"')}
        </div>
        <div class="row"><input id="fx-time" type="range" min="0" max="1439" step="1" value="720" /> ${btn("▶ Day", 'data-act="cycle"')}</div>
        <div class="lbl">Weather</div>
        <div class="lbl" id="fx-aarhus" style="line-height:1.35" title="Live weather for Aarhus from Open-Meteo"></div>
        <div class="row">
          ${(
            [
              ["live", "📡 Live"],
              ["clear", "☀️"],
              ["cloudy", "☁️"],
              ["fog", "🌫️"],
              ["drizzle", "🌦️"],
              ["rain", "🌧️"],
              ["storm", "⛈️"],
              ["snow", "🌨️"],
              ["winter", "❄️ winter"],
            ] as const
          )
            .map(([k, e]) => btn(k === "live" ? e : `${e} ${k === "winter" ? "" : k}`.trim(), `data-weather="${k}"`))
            .join("")}
          ${btn("⚡ Bolt", 'data-ev="lightning"')}
        </div>
        <div class="lbl">Street life (Town)</div>
        <div class="row">
          ${btn("🚨 Cop", 'data-ev="cop"')}${btn("🛒 Merchant", 'data-ev="merchant"')}${btn("🧺 Picnic", 'data-ev="picnic"')}${btn("🌱 Touch grass", 'data-ev="grass"')}
          ${btn("🏁 Race", 'data-ev="race"')}${btn("📰 Paper", 'data-ev="paperboy"')}${btn("🐌 Snail", 'data-ev="snail"')}${btn("💤 Sleepers", 'data-ev="sleepers"')}
        </div>
        <div class="lbl">You</div>
        <div class="row">
          ${btn("😂 Emoji burst", 'data-ev="emoji"')}${btn("🔥🚀 Chat emoji", 'data-ev="chat-emoji"')}${btn("☕ Coffee", 'data-ev="coffee"')}${btn("✨ Glow", 'data-ev="glow"')}
        </div>
      </div>`;
    document.body.append(el);
    this.panel = el;
    const range = el.querySelector<HTMLInputElement>("#fx-time")!;
    const clock = el.querySelector<HTMLElement>("#fx-clock")!;
    el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-time],[data-weather],[data-ev],[data-act]");
      if (!b) return;
      if (b.dataset.time) {
        this.setTime(b.dataset.time);
      } else if (b.dataset.weather) this.setWeather(b.dataset.weather as FxWeather);
      else if (b.dataset.ev) this.setEvent(b.dataset.ev as FxEvent);
      else if (b.dataset.act === "min") el.classList.toggle("min");
      else if (b.dataset.act === "cycle") {
        const on = this.speed !== 1800 || this.live;
        if (on) this.setSpeed(1800);
        else this.setSpeed(1);
        b.classList.toggle("on", on);
      }
      this.syncPanel();
    });
    range.oninput = () => {
      const was = this.speed;
      this.setTime(Number(range.value));
      this.speed = was;
    };
    ticks.push(() => {
      clock.textContent = this.clockText;
      if (document.activeElement !== range) range.value = String(Math.round(this.minutes()));
    });
    this.syncPanel();
  }
}
