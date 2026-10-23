/**
 * Draws a scene the way the game would: at a low resolution, scaled up without smoothing, with a dark
 * line round every silhouette (from depth) and a light one along creases (from normals). At pixel size 1
 * it's a clean cel-shaded look instead.
 */
import * as THREE from "three";
import { blockify, unblockify } from "./blocky.ts";
import { sceneEpoch, syncBaked, trackAdditions } from "../render3d/perf/bake.ts";
import { trackRenderer } from "../render3d/perf/stats.ts";
import { setSmoothBands } from "./kit.ts";

export type RenderStyle = "classic" | "voxel";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 texel;
uniform float span;
uniform float outline;
uniform float crease;
varying vec2 vUv;

float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * span; }
vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

void main() {
  vec3 color = texture2D(tColor, vUv).rgb;
  float d = depthAt(vUv);
  vec3 n = normalAt(vUv);
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
    // Creases: a turn in the surface, drawn on the side that faces up or left.
    vec3 nn = normalAt(vUv + dirs[i]);
    float bias = step(0.0, dot(n - nn, vec3(-1.0, 1.0, 0.0)));
    edge = max(edge, step(0.35, 1.0 - dot(n, nn)) * bias * step(abs(nd - d), 0.12));
  }
  if (d > span * 0.999) silhouette = 0.0;
  color = mix(color, color * 1.28 + 0.03, edge * crease * (1.0 - silhouette));
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
  color = aces(color);
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(l), color, 1.14);
  color *= mix(vec3(0.94, 0.98, 1.06), vec3(1.05, 1.0, 0.94), smoothstep(0.15, 0.75, l));
  vec2 q = vUv - 0.5;
  color *= 1.0 - dot(q, q) * 0.45;
  color += (ign(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
  #include <colorspace_fragment>
}
`;

export class Pipeline {
  readonly renderer: THREE.WebGLRenderer;
  pixelSize = 3;
  outline = 1;
  crease = 1;
  private color?: THREE.WebGLRenderTarget;
  private normal?: THREE.WebGLRenderTarget;
  private readonly normals = new THREE.MeshNormalMaterial();
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
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
  private vox?: THREE.WebGLRenderTarget;
  private voxKey = "";
  private readonly voxQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly fill = new THREE.DirectionalLight("#9ec4ff", 0);
  private readonly fillScenes = new Set<THREE.Scene>();
  private slow = 0;
  private frames = 0;
  private lastAt = 0;
  private lastScene: THREE.Scene | null = null;

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: opts.preserve ?? false,
    });
    this.renderer.shadowMap.enabled = true;
    trackAdditions();
    trackRenderer(this.renderer, () => this.lastScene);
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.voxQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
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
        },
      }),
    );
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
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
  }

  /** Low-resolution targets for a canvas of `w`×`h` CSS pixels. */
  private targets(w: number, h: number): void {
    const dpr = this.pixelSize === 1 ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const lw = Math.max(1, Math.floor((w * dpr) / this.pixelSize));
    const lh = Math.max(1, Math.floor((h * dpr) / this.pixelSize));
    const key = `${lw}x${lh}`;
    if (key === this.size) return;
    this.size = key;
    this.color?.dispose();
    this.normal?.dispose();
    const filter = this.pixelSize === 1 ? THREE.LinearFilter : THREE.NearestFilter;
    this.color = new THREE.WebGLRenderTarget(lw, lh, {
      type: THREE.HalfFloatType,
      minFilter: filter,
      magFilter: filter,
      depthTexture: new THREE.DepthTexture(lw, lh, THREE.FloatType),
    });
    this.normal = new THREE.WebGLRenderTarget(lw, lh, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    const u = this.quad.material.uniforms;
    u.tColor!.value = this.color.texture;
    u.tDepth!.value = this.color.depthTexture;
    u.tNormal!.value = this.normal.texture;
    u.texel!.value.set(1 / lw, 1 / lh);
  }

  /** Soft lit matte look: smooth diffuse, retuned lights, big soft shadows, then AO/haze/grade in one pass. */
  private renderVoxel(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): void {
    const r = this.renderer;
    const q = this.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 1.5 : 1) * (q === 0 ? 0.75 : 1);
    r.setPixelRatio(dpr);
    r.setSize(w, h, false);
    const lw = Math.max(1, Math.floor(w * dpr));
    const lh = Math.max(1, Math.floor(h * dpr));
    const samples = q >= 2 ? 4 : 0;
    const key = `${lw}x${lh}x${samples}`;
    if (key !== this.voxKey) {
      this.voxKey = key;
      this.vox?.dispose();
      this.vox = new THREE.WebGLRenderTarget(lw, lh, {
        type: THREE.HalfFloatType,
        samples,
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
    const lights: { l: THREE.Light; color: THREE.Color; intensity: number; ground?: THREE.Color }[] = [];
    let sun: THREE.DirectionalLight | undefined;
    scene.traverse((o) => {
      const l = o as THREE.Light;
      if (!l.isLight || o === this.fill) return;
      lights.push({
        l,
        color: l.color.clone(),
        intensity: l.intensity,
        ground: (l as THREE.HemisphereLight).isHemisphereLight ? (l as THREE.HemisphereLight).groundColor.clone() : undefined,
      });
      if ((l as THREE.DirectionalLight).isDirectionalLight && l.castShadow) sun = l as THREE.DirectionalLight;
    });
    for (const e of lights) {
      const hemi = e.l as THREE.HemisphereLight;
      if (hemi.isHemisphereLight) {
        hemi.color.lerp(new THREE.Color("#b9d6ff"), 0.4);
        hemi.groundColor.lerp(new THREE.Color("#b89a78"), 0.5);
        hemi.intensity = e.intensity * 0.6;
      } else if ((e.l as THREE.DirectionalLight).isDirectionalLight && e.l.castShadow) {
        e.l.color.lerp(new THREE.Color("#ffd9a8"), 0.35);
        e.l.intensity = e.intensity * 1.4;
      }
    }
    const shadowSize = q >= 2 ? 4096 : 2048;
    if (sun) {
      const sh = sun.shadow;
      sun.userData.classic ??= { size: sh.mapSize.x, radius: sh.radius, bias: sh.bias };
      if (sh.mapSize.x !== shadowSize) {
        sh.mapSize.set(shadowSize, shadowSize);
        sh.map?.dispose();
        sh.map = null;
      }
      sh.radius = q >= 1 ? 4 : 2;
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

    for (const e of lights) {
      e.l.color.copy(e.color);
      e.l.intensity = e.intensity;
      if (e.ground) (e.l as THREE.HemisphereLight).groundColor.copy(e.ground);
    }

    const u = this.voxQuad.material.uniforms;
    u.span!.value = camera.far - camera.near;
    u.pxPerUnit!.value = lw / ((camera.right - camera.left) / camera.zoom);
    u.aoSamples!.value = q >= 2 ? 24 : q === 1 ? 10 : 0;
    u.aoStrength!.value = this.night > 0.5 ? 1.6 : 2.4;
    u.tilt!.value = q >= 2 ? 1 : 0;
    u.haze!.value = scene.userData.noHaze ? 0 : 0.3;
    u.gradient!.value = this.gradient ? 1 : 0;
    u.exposure!.value = this.night > 0.5 ? 1.5 : 1.05;
    r.setRenderTarget(null);
    r.clear();
    r.render(this.voxQuad, this.quadCamera);
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
    this.lastScene = scene;
    setSmoothBands(this.style === "voxel");
    syncBaked(scene, this.style === "voxel" ? "block" : "smooth");
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
    r.setPixelRatio(this.pixelSize === 1 ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    r.setSize(w, h, false);
    this.targets(w, h);
    const u = this.quad.material.uniforms;
    u.span!.value = camera.far - camera.near;
    u.outline!.value = this.outline;
    u.crease!.value = this.crease;

    r.setRenderTarget(this.color!);
    r.render(scene, camera);

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
    r.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = background;
    for (const o of hidden) o.visible = true;
    r.setClearColor(0x000000, 0);

    r.setRenderTarget(null);
    r.clear();
    r.render(this.quad, this.quadCamera);
  }
}
