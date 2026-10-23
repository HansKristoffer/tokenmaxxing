/**
 * Draws a scene the way the game would: at a low resolution, scaled up without smoothing, with a dark
 * line round every silhouette (from depth) and a light one along creases (from normals). At pixel size 1
 * it's a clean cel-shaded look instead.
 */
import * as THREE from "three";

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

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: opts.preserve ?? false,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
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

  render(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): void {
    const r = this.renderer;
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
