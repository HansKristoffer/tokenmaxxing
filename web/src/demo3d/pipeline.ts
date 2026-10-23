/**
 * Draws a scene the way the game would: at a low resolution, scaled up without smoothing, with a dark
 * line round every silhouette (from depth) and a light one along creases (from normals). At pixel size 1
 * it's a clean cel-shaded look instead.
 */
import * as THREE from "three";
import { type BakeMode, sceneEpoch, syncBaked, trackAdditions } from "../render3d/perf/bake.ts";
import { trackRenderer } from "../render3d/perf/stats.ts";
import { blockify, unblockify } from "./blocky.ts";
import { setActiveScene, setSmoothBands } from "./kit.ts";

export type RenderStyle = "classic" | "voxel";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
#ifdef CREASE
uniform sampler2D tNormal;
#endif
uniform vec2 texel;
uniform float span;
uniform float outline;
uniform float crease;
varying vec2 vUv;

float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * span; }
#ifdef CREASE
vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
#endif

void main() {
  vec3 color = texture2D(tColor, vUv).rgb;
  float d = depthAt(vUv);
#ifdef CREASE
  vec3 n = normalAt(vUv);
#endif
  vec2 dirs[4];
  dirs[0] = vec2(texel.x, 0.0);
  dirs[1] = vec2(-texel.x, 0.0);
  dirs[2] = vec2(0.0, texel.y);
  dirs[3] = vec2(0.0, -texel.y);
  float silhouette = 0.0;
  float edge = 0.0;
  for (int i = 0; i < 4; i++) {
    float nd = depthAt(vUv + dirs[i]);
    // Only the nearer side of a gap draws the line, so it's one pixel thick.
    silhouette = max(silhouette, step(0.12, nd - d));
#ifdef CREASE
    // Creases: a turn in the surface, drawn on the side that faces up or left.
    vec3 nn = normalAt(vUv + dirs[i]);
    float bias = step(0.0, dot(n - nn, vec3(-1.0, 1.0, 0.0)));
    edge = max(edge, step(0.35, 1.0 - dot(n, nn)) * bias * step(abs(nd - d), 0.12));
#endif
  }
  if (d > span * 0.999) silhouette = 0.0;
#ifdef CREASE
  color = mix(color, color * 1.28 + 0.03, edge * crease * (1.0 - silhouette));
#endif
  color = mix(color, color * 0.32, silhouette * outline);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;


const VOXEL_FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float span;
uniform float pxPerUnit;
uniform int aoSamples;
uniform float aoRadius;
uniform float aoStrength;
uniform float tilt;
uniform float haze;
uniform vec3 hazeColor;
uniform vec3 skyTop;
uniform vec3 skyHor;
uniform float gradient;
uniform float exposure;
uniform float night;
uniform float grade;
varying vec2 vUv;

float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * span; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  float d = depthAt(vUv);
  bool bg = d > span * 0.999;
  vec2 px = 1.0 / texel;
  // Tilt-shift: blur grows toward the top and bottom of the frame.
  float off = max(0.0, abs(vUv.y - 0.5) - 0.28) * 2.0;
  float br = tilt * off * off * 5.0;
  vec3 color = texture2D(tColor, vUv).rgb;
  if (br > 0.15) {
    vec3 acc = color;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      acc += texture2D(tColor, vUv + vec2(cos(a), sin(a)) * texel * br).rgb;
    }
    color = acc / 9.0;
  }
  if (bg) {
    if (gradient > 0.5) color = mix(skyHor, skyTop, smoothstep(0.1, 1.0, vUv.y));
  } else {
    // Ambient occlusion from depth alone: a neighbour that sits in front of this pixel's tangent plane
    // (slope read from the smaller one-sided depth step) darkens it, so crevices and wall feet go soft.
    float dl = depthAt(vUv - vec2(texel.x, 0.0));
    float dr = depthAt(vUv + vec2(texel.x, 0.0));
    float du = depthAt(vUv + vec2(0.0, texel.y));
    float dd = depthAt(vUv - vec2(0.0, texel.y));
    float sx = abs(dr - d) < abs(d - dl) ? dr - d : d - dl;
    float sy = abs(du - d) < abs(d - dd) ? du - d : d - dd;
    sx = clamp(sx, -2.0, 2.0);
    sy = clamp(sy, -2.0, 2.0);
    float R = aoRadius * pxPerUnit;
    float rot = ign(gl_FragCoord.xy) * 6.2831853;
    float occ = 0.0;
    for (int i = 0; i < 24; i++) {
      if (i >= aoSamples) break;
      float f = (float(i) + 0.5) / float(aoSamples);
      float a = rot + float(i) * 2.399963;
      vec2 o = vec2(cos(a), sin(a)) * R * sqrt(f);
      vec2 suv = vUv + o * texel;
      float ds = depthAt(suv);
      float pred = d + sx * o.x + sy * o.y;
      float excess = pred - ds;
      float near = smoothstep(0.05, 0.35, excess);
      float far = 1.0 - smoothstep(0.9, 2.2, excess);
      occ += near * far * (1.0 - f * 0.5);
    }
    occ /= float(aoSamples);
    float ao = 1.0 - clamp(occ * aoStrength, 0.0, 0.85);
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    ao = mix(ao, 1.0, smoothstep(0.8, 1.2, lum) * 0.6);
    color *= ao * mix(vec3(1.0), vec3(0.95, 1.0, 1.08), 1.0 - ao);
    // Atmospheric depth haze toward the sky colour.
    float hz = haze * smoothstep(span * 0.30, span * 0.95, d);
    color = mix(color, hazeColor, hz);
  }
  // Grade: exposure, filmic curve, a touch of saturation, warm lights and cool shadows.
  color *= exposure;
  if (grade > 0.5) {
    color = aces(color);
    float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(l), color, 1.14);
    color *= mix(vec3(0.94, 0.98, 1.06), vec3(1.05, 1.0, 0.94), smoothstep(0.15, 0.75, l));
    vec2 q = vUv - 0.5;
    color *= 1.0 - dot(q, q) * 0.45;
    color += (ign(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
  } else {
    color = clamp(color, 0.0, 1.0);
  }
  gl_FragColor = vec4(max(color, 0.0), 1.0);
  #include <colorspace_fragment>
}
`;

const BLIT = /* glsl */ `
uniform sampler2D tColor;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0);
  #include <colorspace_fragment>
}
`;

/** What the pipeline draws with. `Pipeline.configure` takes any part of it; `tiers.ts` derives it from the graphics settings. */
export interface PipelineOptions {
  style: RenderStyle;
  /** Classic styles: one rendered pixel is this many screen pixels. */
  pixelSize: number;
  /** Classic: dark silhouette lines (from depth) and light crease lines (from normals, costs a second scene pass). */
  outline: number;
  crease: number;
  /** Voxel: render resolution is `min(devicePixelRatio, dprCap) * renderScale`. */
  renderScale: number;
  dprCap: number;
  /** Shadow map edge in pixels, 0 for none. */
  shadowSize: number;
  /** The shadow map is redrawn every this many frames (static rooms barely notice 2). */
  shadowEvery: number;
  /** Ambient occlusion taps, 0 to 24. */
  aoSamples: number;
  /** MSAA samples for the voxel target (0 off). */
  msaa: number;
  tilt: boolean;
  haze: boolean;
  grade: boolean;
}

const HEMI_SKY = new THREE.Color("#b9d6ff");
const HEMI_GROUND = new THREE.Color("#b89a78");
const SUN_WARM = new THREE.Color("#ffd9a8");

interface LightRef {
  l: THREE.Light;
  hemi: boolean;
  color: THREE.Color;
  ground: THREE.Color;
  intensity: number;
}
interface SceneLights {
  epoch: number;
  refs: LightRef[];
  sun?: THREE.DirectionalLight;
}

export class Pipeline {
  readonly renderer: THREE.WebGLRenderer;
  pixelSize = 3;
  outline = 1;
  crease = 1;
  private color?: THREE.WebGLRenderTarget;
  private normal?: THREE.WebGLRenderTarget;
  private readonly normals = new THREE.MeshNormalMaterial();
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly quadCreased: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly blit: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly quadCamera = new THREE.Camera();
  private size = "";

  // ——— Voxel (Plethora) style ———
  style: RenderStyle = "classic";
  /** 0 = cheap, 1 = balanced, 2 = full (AO, tilt-shift, MSAA, 4k shadows). Drops by itself when frames run slow. */
  quality = 2;
  autoQuality = true;
  /** Colours for the composite: haze toward the sky, and a gradient sky for scenes that have none. */
  hazeColor = new THREE.Color("#cfe8f8");
  skyTop = new THREE.Color("#7fc4e8");
  skyHor = new THREE.Color("#d6efee");
  gradient = false;
  night = 0;
  /** Set by `configure`; until then everything follows `quality`, as before. */
  private opts: Partial<PipelineOptions> = {};
  private vox?: THREE.WebGLRenderTarget;
  private voxKey = "";
  private readonly voxQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly fill = new THREE.DirectionalLight("#9ec4ff", 0);
  private readonly fillScenes = new Set<THREE.Scene>();
  private readonly lights = new WeakMap<THREE.Scene, SceneLights>();
  private slow = 0;
  private frames = 0;
  private lastAt = 0;
  private lastScene: THREE.Scene | null = null;
  private frameNo = 0;
  private sized = "";
  private shadowsWere: boolean | null = null;
  /** Per-frame facts for the console and the perf harness. */
  readonly last = { passes: 0, shadowUpdated: false };

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: opts.preserve ?? false,
      powerPreference: "high-performance",
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The shadow map is redrawn on the pipeline's schedule (`shadowEvery`), not on every render() call.
    this.renderer.shadowMap.autoUpdate = false;
    trackAdditions();
    trackRenderer(this.renderer, () => this.lastScene);
    const plane = new THREE.PlaneGeometry(2, 2);
    this.voxQuad = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: VOXEL_FRAGMENT,
        uniforms: {
          tColor: { value: null },
          tDepth: { value: null },
          texel: { value: new THREE.Vector2() },
          span: { value: 1 },
          pxPerUnit: { value: 40 },
          aoSamples: { value: 20 },
          aoRadius: { value: 1.0 },
          aoStrength: { value: 1.7 },
          tilt: { value: 1 },
          haze: { value: 0.3 },
          hazeColor: { value: this.hazeColor },
          skyTop: { value: this.skyTop },
          skyHor: { value: this.skyHor },
          gradient: { value: 0 },
          exposure: { value: 1 },
          night: { value: 0 },
          grade: { value: 1 },
        },
      }),
    );
    const classic = (creased: boolean) =>
      new THREE.Mesh(
        plane,
        new THREE.ShaderMaterial({
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          defines: creased ? { CREASE: "" } : {},
          uniforms: {
            tColor: { value: null },
            tDepth: { value: null },
            tNormal: { value: null },
            texel: { value: new THREE.Vector2() },
            span: { value: 1 },
            outline: { value: 1 },
            crease: { value: 1 },
          },
          transparent: true,
        }),
      );
    this.quad = classic(false);
    this.quadCreased = classic(true);
    this.blit = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: BLIT, uniforms: { tColor: { value: null } } }),
    );
  }

  /** Applies explicit settings (see `PipelineOptions`); unset fields keep following `quality`. */
  configure(o: Partial<PipelineOptions>): void {
    Object.assign(this.opts, o);
    if (o.style) this.style = o.style;
    if (o.pixelSize !== undefined) this.pixelSize = o.pixelSize;
    if (o.outline !== undefined) this.outline = o.outline;
    if (o.crease !== undefined) this.crease = o.crease;
    this.autoQuality = false;
  }

  /** What a voxel frame is drawn with right now: the explicit options, or what `quality` implies. */
  private voxelOptions(): PipelineOptions {
    const q = this.quality;
    const o = this.opts;
    return {
      style: "voxel",
      pixelSize: 1,
      outline: 0,
      crease: 0,
      renderScale: o.renderScale ?? (q === 0 ? 0.75 : 1),
      dprCap: o.dprCap ?? (q >= 2 ? 1.5 : 1),
      shadowSize: o.shadowSize ?? (q >= 2 ? 4096 : 2048),
      shadowEvery: o.shadowEvery ?? 1,
      aoSamples: o.aoSamples ?? (q >= 2 ? 24 : q === 1 ? 10 : 0),
      msaa: o.msaa ?? (q >= 2 ? 4 : 0),
      tilt: o.tilt ?? q >= 2,
      haze: o.haze ?? true,
      grade: o.grade ?? true,
    };
  }

  /** Low-resolution targets for a canvas of `w`×`h` CSS pixels. */
  private targets(w: number, h: number, depth: boolean, creased: boolean): void {
    const dpr = this.pixelSize === 1 ? Math.min(window.devicePixelRatio || 1, this.opts.dprCap ?? 2) : 1;
    const scale = this.pixelSize === 1 ? (this.opts.renderScale ?? 1) : 1;
    const lw = Math.max(1, Math.floor((w * dpr * scale) / this.pixelSize));
    const lh = Math.max(1, Math.floor((h * dpr * scale) / this.pixelSize));
    const key = `${lw}x${lh}${depth ? "d" : ""}${creased ? "n" : ""}`;
    if (key === this.size) return;
    this.size = key;
    this.color?.dispose();
    this.normal?.dispose();
    this.normal = undefined;
    const filter = this.pixelSize === 1 ? THREE.LinearFilter : THREE.NearestFilter;
    // Only the outline pass reads depth; the plain blit gets by with a depth buffer and an 8-bit colour target.
    this.color = new THREE.WebGLRenderTarget(lw, lh, {
      type: depth ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: filter,
      magFilter: filter,
      depthTexture: depth ? new THREE.DepthTexture(lw, lh, THREE.FloatType) : undefined,
    });
    if (creased)
      this.normal = new THREE.WebGLRenderTarget(lw, lh, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });
    for (const q of [this.quad, this.quadCreased]) {
      const u = q.material.uniforms;
      u.tColor!.value = this.color.texture;
      u.tDepth!.value = this.color.depthTexture;
      u.tNormal!.value = this.normal?.texture ?? null;
      u.texel!.value.set(1 / lw, 1 / lh);
    }
    this.blit.material.uniforms.tColor!.value = this.color.texture;
  }

  private setSize(w: number, h: number, dpr: number): void {
    const key = `${w}x${h}@${dpr}`;
    if (key === this.sized) return;
    this.sized = key;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
  }

  /** The lights of a scene, found once and again only after something was added. */
  private lightsOf(scene: THREE.Scene): SceneLights {
    let s = this.lights.get(scene);
    if (s && s.epoch === sceneEpoch()) return s;
    s = { epoch: sceneEpoch(), refs: [] };
    scene.traverse((o) => {
      const l = o as THREE.Light;
      if (!l.isLight || o === this.fill) return;
      s!.refs.push({
        l,
        hemi: !!(l as THREE.HemisphereLight).isHemisphereLight,
        color: new THREE.Color(),
        ground: new THREE.Color(),
        intensity: 0,
      });
      const d = l as THREE.DirectionalLight;
      if (d.isDirectionalLight && (d.castShadow || d.userData.sunShadow)) {
        d.userData.sunShadow = true;
        s!.sun = d;
      }
    });
    this.lights.set(scene, s);
    return s;
  }

  private shadowsFor(scene: THREE.Scene, size: number, every: number): void {
    const r = this.renderer;
    const { sun } = this.lightsOf(scene);
    const on = size > 0 && !!sun;
    if (this.shadowsWere !== on) {
      // Programs bake in whether shadows are on: they recompile once when it flips.
      this.shadowsWere = on;
      r.shadowMap.enabled = size > 0;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const x of Array.isArray(m) ? m : m ? [m] : []) x.needsUpdate = true;
      });
    }
    if (sun) {
      sun.castShadow = size > 0;
      const sh = sun.shadow;
      if (size > 0 && sh.mapSize.x !== size) {
        sh.mapSize.set(size, size);
        sh.map?.dispose();
        sh.map = null;
      }
    }
    const fresh = this.frameNo % Math.max(1, every) === 0 || !sun?.shadow.map;
    r.shadowMap.needsUpdate = on && fresh;
    this.last.shadowUpdated = on && fresh;
  }

  /** Soft lit matte look: smooth diffuse, retuned lights, big soft shadows, then AO/haze/grade in one pass. */
  private renderVoxel(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): void {
    const r = this.renderer;
    const o = this.voxelOptions();
    const dpr = Math.min(window.devicePixelRatio || 1, o.dprCap) * o.renderScale;
    this.setSize(w, h, dpr);
    const lw = Math.max(1, Math.floor(w * dpr));
    const lh = Math.max(1, Math.floor(h * dpr));
    const key = `${lw}x${lh}x${o.msaa}`;
    if (key !== this.voxKey) {
      this.voxKey = key;
      this.vox?.dispose();
      this.vox = new THREE.WebGLRenderTarget(lw, lh, {
        type: THREE.HalfFloatType,
        samples: o.msaa,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthTexture: new THREE.DepthTexture(lw, lh, THREE.FloatType),
      });
      const u = this.voxQuad.material.uniforms;
      u.tColor!.value = this.vox.texture;
      u.tDepth!.value = this.vox.depthTexture;
      u.texel!.value.set(1 / lw, 1 / lh);
    }
    // Lights: cool sky over warm bounce, a warm sun with big soft shadows, a cool fill from the far side.
    const { refs, sun } = this.lightsOf(scene);
    for (const e of refs) {
      const l = e.l;
      e.color.copy(l.color);
      e.intensity = l.intensity;
      if (e.hemi) {
        const hemi = l as THREE.HemisphereLight;
        e.ground.copy(hemi.groundColor);
        hemi.color.lerp(HEMI_SKY, 0.4);
        hemi.groundColor.lerp(HEMI_GROUND, 0.5);
        hemi.intensity = e.intensity * 0.6;
      } else if (l === sun) {
        l.color.lerp(SUN_WARM, 0.35);
        l.intensity = e.intensity * 1.4;
      }
    }
    this.shadowsFor(scene, o.shadowSize, o.shadowEvery);
    if (sun) {
      const sh = sun.shadow;
      sun.userData.classic ??= { size: sh.mapSize.x, radius: sh.radius, bias: sh.bias };
      sh.radius = o.shadowSize >= 2048 ? 4 : 2;
      sh.bias = -0.0006;
      if (this.fill.parent !== scene) {
        scene.add(this.fill, this.fill.target);
        this.fillScenes.add(scene);
      }
      const t = sun.target.position;
      this.fill.target.position.copy(t);
      this.fill.position.set(2 * t.x - sun.position.x, 6, 2 * t.z - sun.position.z);
      this.fill.intensity = Math.min(1.2, sun.intensity * 0.22);
    }

    r.setRenderTarget(this.vox!);
    r.render(scene, camera);

    for (const e of refs) {
      e.l.color.copy(e.color);
      e.l.intensity = e.intensity;
      if (e.hemi) (e.l as THREE.HemisphereLight).groundColor.copy(e.ground);
    }

    const u = this.voxQuad.material.uniforms;
    u.span!.value = camera.far - camera.near;
    u.pxPerUnit!.value = lw / ((camera.right - camera.left) / camera.zoom);
    u.aoSamples!.value = o.aoSamples;
    u.aoStrength!.value = this.night > 0.5 ? 1.6 : 2.4;
    u.tilt!.value = o.tilt ? 1 : 0;
    u.haze!.value = scene.userData.noHaze || !o.haze ? 0 : 0.3;
    u.gradient!.value = this.gradient ? 1 : 0;
    u.exposure!.value = this.night > 0.5 ? 1.5 : 1.05;
    u.grade!.value = o.grade ? 1 : 0;
    r.setRenderTarget(null);
    r.clear();
    r.render(this.voxQuad, this.quadCamera);
    this.last.passes = 2;
    this.watch();
  }

  /** If frames keep taking too long, step down a quality level. */
  private watch(): void {
    const now = performance.now();
    const dt = now - this.lastAt;
    this.lastAt = now;
    if (!this.autoQuality || dt > 250) return; // hidden tab or a hitch
    this.frames++;
    if (dt > 30) this.slow++;
    if (this.frames >= 90) {
      if (this.slow > 55 && this.quality > 0) this.quality--;
      this.frames = this.slow = 0;
    }
  }

  /** Back to the classic styles: drop the fill light from every scene it joined. */
  private leaveVoxel(): void {
    for (const s of this.fillScenes) {
      s.remove(this.fill, this.fill.target);
      s.traverse((o) => {
        const l = o as THREE.DirectionalLight;
        const c = l.userData.classic as { size: number; radius: number; bias: number } | undefined;
        if (!l.isDirectionalLight || !c) return;
        l.shadow.mapSize.set(c.size, c.size);
        l.shadow.map?.dispose();
        l.shadow.map = null;
        l.shadow.radius = c.radius;
        l.shadow.bias = c.bias;
      });
    }
    this.fillScenes.clear();
    this.voxKey = "";
    this.vox?.dispose();
    this.vox = undefined;
  }

  render(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): void {
    const r = this.renderer;
    this.frameNo++;
    if (scene !== this.lastScene) this.frameNo = 0;
    this.lastScene = scene;
    setActiveScene(scene);
    setSmoothBands(this.style === "voxel");
    const mode: BakeMode = this.style === "voxel" ? "block" : "smooth";
    syncBaked(scene, mode);
    if (this.style === "voxel") {
      // Only when something was added since: swapping geometries is not free, and the scene is mostly still.
      if (!scene.userData.blocky || scene.userData.blockEpoch !== sceneEpoch()) {
        blockify(scene);
        scene.userData.blockEpoch = sceneEpoch();
      }
      scene.userData.blocky = true;
      this.renderVoxel(scene, camera, w, h);
      return;
    }
    if (scene.userData.blocky) {
      unblockify(scene);
      scene.userData.blocky = false;
    }
    if (this.fillScenes.size) this.leaveVoxel();
    const dpr = this.pixelSize === 1 ? Math.min(window.devicePixelRatio || 1, this.opts.dprCap ?? 2) : 1;
    this.setSize(w, h, dpr);
    const lines = this.outline > 0 || this.crease > 0;
    const creased = this.crease > 0;
    this.targets(w, h, lines, creased);
    this.shadowsFor(scene, this.opts.shadowSize ?? 2048, this.opts.shadowEvery ?? 1);
    const q = creased ? this.quadCreased : this.quad;
    const u = q.material.uniforms;
    u.span!.value = camera.far - camera.near;
    u.outline!.value = this.outline;
    u.crease!.value = this.crease;

    r.setRenderTarget(this.color!);
    r.render(scene, camera);
    this.last.passes = 2;

    if (creased) {
      // Normals of everything solid: see-through things (glass, faces, light cones) would draw lines.
      const hidden: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        if (o instanceof THREE.Mesh && !Array.isArray(o.material) && o.material.transparent) hidden.push(o);
      });
      for (const o of hidden) o.visible = false;
      const background = scene.background;
      scene.background = null;
      scene.overrideMaterial = this.normals;
      r.setRenderTarget(this.normal!);
      r.setClearColor(0x8080ff, 1);
      r.clear();
      // The shadow map from the colour pass is still good: this one only reads normals.
      r.shadowMap.needsUpdate = false;
      r.render(scene, camera);
      scene.overrideMaterial = null;
      scene.background = background;
      for (const o of hidden) o.visible = true;
      r.setClearColor(0x000000, 0);
      this.last.passes = 3;
    }

    r.setRenderTarget(null);
    r.clear();
    r.render(lines ? q : this.blit, this.quadCamera);
  }
}
