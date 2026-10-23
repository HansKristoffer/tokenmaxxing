/** Scene assembly for the concept stills: lights, ground, base, sky blocks, cameras and 2D finishing. */
import * as THREE from "three";
import { Batch } from "./batch.ts";
import { buildCity, C, type City, shade, type Theme } from "./city.ts";
import { addBridges, type Plan, planCity } from "./plan.ts";

export interface Look {
  skyTop: string;
  skyHor: string;
  haze: string;
  sun: string;
  sunI: number;
  sunPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  night: boolean;
}

export const LOOKS: Record<Theme, Look> = {
  day: {
    skyTop: "#7ec9e6",
    skyHor: "#dff3ec",
    haze: "#cfe9e6",
    sun: "#fff0d0",
    sunI: 2.6,
    sunPos: [-1, 1.35, 0.7],
    hemiSky: "#fff6e6",
    hemiGround: "#8a8a7a",
    hemiI: 1.5,
    night: false,
  },
  dusk: {
    skyTop: "#5b6fb5",
    skyHor: "#ffb36b",
    haze: "#e8a07e",
    sun: "#ff9a4a",
    sunI: 3.0,
    sunPos: [1.4, 0.5, 0.3],
    hemiSky: "#b9a0d8",
    hemiGround: "#8a5a4a",
    hemiI: 1.1,
    night: false,
  },
  cyber: {
    skyTop: "#06050f",
    skyHor: "#2b0f3f",
    haze: "#2a1646",
    sun: "#9fb4ff",
    sunI: 1.5,
    sunPos: [-1, 1.2, 0.6],
    hemiSky: "#5a6cff",
    hemiGround: "#3a1450",
    hemiI: 0.55,
    night: true,
  },
};

export interface World {
  scene: THREE.Scene;
  city: City;
  plan: Plan;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  look: Look;
  theme: Theme;
  /** Everything but the ground plate: what a wet street mirrors. */
  content: THREE.Group;
  ground: THREE.Mesh;
  water: THREE.Mesh;
  update: (t: number) => void;
}

export function makeWorld(theme: Theme, seed = 11): World {
  const look = LOOKS[theme];
  const scene = new THREE.Scene();
  const plan = planCity(seed);
  addBridges(plan, seed + 3);
  const city = buildCity(plan.vols, plan.W, plan.D, theme, seed);
  const content = new THREE.Group();
  scene.add(content);
  content.add(city.lit.build(), city.glow.build({ glow: true }), city.glass.build());

  const hemi = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, look.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(look.sun, look.sunI);
  const reach = 62;
  const sp = look.sunPos;
  sun.position.set(sp[0] * 70, sp[1] * 70, sp[2] * 70);
  sun.target.position.set(0, 14, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = sun.shadow.camera;
  s.left = s.bottom = -reach;
  s.right = s.top = reach;
  s.near = 1;
  s.far = 220;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  if (theme === "cyber") {
    // neon spill: magenta onto the faces that look +x, cyan onto +z, a violet ambient floor
    const mag = new THREE.DirectionalLight("#ff2fa8", 0.8);
    mag.position.set(90, 40, 10);
    const cy = new THREE.DirectionalLight("#18d8ff", 0.75);
    cy.position.set(10, 36, 90);
    const amb = new THREE.AmbientLight("#3a2a6a", 0.22);
    scene.add(mag, cy, amb);
  }
  if (theme === "dusk") {
    const rim = new THREE.DirectionalLight("#7a8cff", 0.7);
    rim.position.set(-40, 40, 80);
    scene.add(rim);
  }

  // Ground
  const gb = new Batch();
  gb.jitter = 0.02;
  const night = theme === "cyber";
  const asphalt = night ? "#0c0d14" : "#6b6b6e";
  const paving = night ? "#1c1d28" : "#bdb6a4";
  // retaining wall + base ring
  gb.box(0, -0.58, 0, plan.W * C + 3, 0.6, plan.D * C + 3, night ? "#16161e" : "#8f8a7a");
  for (let j = 0; j < plan.D; j++)
    for (let i = 0; i < plan.W; i++) {
      if (city.top(i, j) > 0) continue;
      const inPlaza = plan.plaza.some((p) => i >= p.i0 && i <= p.i1 && j >= p.j0 && j <= p.j1);
      const street = i % 5 === 0 || j % 5 === 0;
      gb.box(city.cx(i), 0, city.cz(j), C, 0.06, C, street && !inPlaza ? asphalt : paving);
    }
  const ground = gb.build();
  ground.castShadow = false;
  scene.add(ground);
  // water all round: a calm lake in daylight, black rain-slick water at night
  const wb = new Batch();
  wb.jitter = 0;
  wb.box(0, -1.2, 0, 1400, 1.2, 1400, night ? "#0a0a18" : theme === "dusk" ? "#6a5580" : "#3a86a2");
  const water = wb.build();
  water.castShadow = false;
  scene.add(water);
  return { scene, city, plan, sun, hemi, look, theme, content, ground, water, update: () => {} };
}

export interface Cam {
  /** Azimuth, elevation in degrees; target in world units; view = world units top to bottom. */
  az: number;
  el: number;
  target: [number, number, number];
  view: number;
}

export function aim(camera: THREE.OrthographicCamera, c: Cam, aspect: number): void {
  const az = (c.az * Math.PI) / 180;
  const el = (c.el * Math.PI) / 180;
  const dist = 200;
  const t = new THREE.Vector3(...c.target);
  camera.position.set(
    t.x + dist * Math.cos(el) * Math.sin(az),
    t.y + dist * Math.sin(el),
    t.z + dist * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(t);
  camera.near = 1;
  camera.far = 520;
  camera.left = (-c.view * aspect) / 2;
  camera.right = (c.view * aspect) / 2;
  camera.top = c.view / 2;
  camera.bottom = -c.view / 2;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
export { shade };

/** Reflections: mirror everything under half-clear water, and (wet streets) under the city's own ground. */
export function addWet(world: World, water = 0.62, streets = 0): void {
  const mirror = world.content.clone(true);
  mirror.scale.y = -1;
  mirror.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  world.scene.add(mirror);
  const w = world.water.material as THREE.MeshToonMaterial;
  w.transparent = true;
  w.opacity = water;
  if (streets > 0) {
    const g = world.ground.material as THREE.MeshToonMaterial;
    g.transparent = true;
    g.opacity = streets;
  }
}
