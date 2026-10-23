/** Atmosphere and set dressing: far skyline, clouds, and the cyberpunk pass (neon, billboards, holograms, traffic, cables, steam). */
import * as THREE from "three";
import { Avatar } from "../avatar.ts";
import { glow, seeded } from "../kit.ts";
import { petFrom2D } from "../pets3d.ts";
import { Batch, type V3 } from "./batch.ts";
import { person } from "./chars.ts";
import { C, FL, type Vol } from "./city.ts";
import type { World } from "./scene.ts";
import { sign } from "./signs.ts";

const NEON = ["#ff3d9a", "#2fe0ff", "#ffb347", "#9b6bff", "#7bffb5", "#ff4d5a"];

/** More towers fading into the haze, so the town reads as part of something endless. */
export function farSkyline(world: World, count = 90): void {
  const rnd = seeded(41);
  const night = world.theme === "cyber";
  const dusk = world.theme === "dusk";
  const b = new Batch();
  b.jitter = 0.05;
  const lit = new Batch();
  lit.jitter = 0;
  const hx = (world.city.W * C) / 2 + 8;
  const hz = (world.city.D * C) / 2 + 8;
  let n = 0;
  let guard = 0;
  while (n < count && guard++ < 2000) {
    const x = (rnd() - 0.5) * 900;
    const z = (rnd() - 0.5) * 900;
    if (Math.abs(x) < hx + 4 && Math.abs(z) < hz + 4) continue;
    // keep the front (camera side) mostly clear
    if (x * 0.64 + z * 0.77 > -230 || Math.abs(-x * 0.77 + z * 0.64) > 230) continue;
    const w = 7 + rnd() * 10;
    const d = 7 + rnd() * 10;
    const h = 30 + rnd() * 90 * (1 - Math.min(0.5, Math.hypot(x, z) / 700));
    const base = night ? ["#171833", "#1b1530", "#12182c"][n % 3]! : dusk ? ["#c9a7a8", "#b79aa8", "#d4b0a0"][n % 3]! : ["#b5cfcf", "#c2d6d2", "#a9c4c8", "#bcd0c0"][n % 3]!;
    b.box(x, -0.5, z, w, h, d, base);
    b.box(x, h - 0.5, z, w * 0.7, h * 0.18, d * 0.7, base);
    if (!night) b.box(x + (rnd() - 0.5) * 2, h - 0.5 + h * 0.18, z, w * 0.5, 0.4, d * 0.5, "#6fbf6a");
    // lit windows on the camera faces
    if (night) {
      const rows = Math.floor(h / 2.2);
      for (let r = 2; r < rows; r++) {
        for (let c = 0; c < Math.floor(w / 1.8); c++) {
          if (rnd() > 0.28) continue;
          const col = ["#ffd27a", "#7fe9ff", "#ff5ad8", "#a98bff", "#ffe8b0"][Math.floor(rnd() * 5)]!;
          lit.box(x - w / 2 + 0.9 + c * 1.8, r * 2.2 - 0.5, z + d / 2 + 0.03, 0.9, 0.9, 0.04, col, 1.3);
          if (rnd() < 0.25) lit.box(x + w / 2 + 0.03, r * 2.2 - 0.5, z - d / 2 + 0.9 + c * 1.8, 0.04, 0.9, 0.9, col, 1.3);
        }
      }
      if (rnd() < 0.5) lit.box(x, h + h * 0.18 - 0.5, z, 0.3, 0.3, 0.3, NEON[n % NEON.length]!, 2.5);
    }
    n++;
  }
  world.scene.add(b.build({ shadows: false }));
  if (night) world.scene.add(lit.build({ glow: true }));
}

export function clouds(world: World, tint = "#ffffff", count = 16): void {
  const rnd = seeded(77);
  const b = new Batch();
  b.jitter = 0.02;
  for (let k = 0; k < count; k++) {
    const x = (rnd() - 0.5) * 300;
    const z = (rnd() - 0.5) * 300 - 80;
    const y = 125 + rnd() * 50;
    for (let p = 0; p < 6; p++) {
      const w = 4 + rnd() * 6;
      b.box(x + (p - 2.5) * 5 + rnd() * 3, y + (p % 2) * 1.2, z + (rnd() - 0.5) * 5, w, 2 + rnd() * 2.2, 5 + rnd() * 4, tint);
    }
  }
  const m = b.build({ shadows: false });
  (m.material as THREE.MeshToonMaterial).fog = false;
  world.scene.add(m);
}

const WORDS = ["NOODLES", "24H BAR", "ARCADE", "COMPILE", "HOTEL", "BANK", "SHIP IT", "CAFE", "DEBUG", "MERGE", "SYNTH", "RAMEN", "MEGACORP", "LGTM", "SUDO", "TOKENS", "CLINIC", "SPA"];

function vertical(text: string, w: number, h: number, fg: string, alt: string): THREE.Object3D {
  const s = sign(text, h, w, { fg, alt, theme: "cyber" });
  return s;
}

export function cyberPass(world: World): void {
  const { city, scene } = world;
  const rnd = seeded(2024);
  const g = world.content;
  const neon = new Batch();
  neon.jitter = 0;
  const cables = new Batch();
  cables.jitter = 0.02;

  // 1. Corner neon strips and roof-lip lines
  for (const v of city.vols) {
    if (v.kind === "bridge" || v.kind === "walk") continue;
    if (v.f1 - v.f0 < 4) continue;
    if (rnd() < 0.5) {
      const col = NEON[Math.floor(rnd() * NEON.length)]!;
      const x = city.cx(v.i1) + C / 2 + 0.05;
      const z = city.cz(v.j1) + C / 2 + 0.05;
      // only where the corner is really exposed
      if (!city.occ(v.i1 + 1, v.j1, v.f0 + 1) && !city.occ(v.i1, v.j1 + 1, v.f0 + 1) && !city.occ(v.i1 + 1, v.j1 + 1, v.f0 + 1)) {
        neon.box(x, v.f0 * FL + 0.2, z, 0.09, (v.f1 - v.f0) * FL - 0.2, 0.09, col, 2.2);
      }
    }
  }
  for (const r of city.roofs) {
    if (!r.edge.some(Boolean) || rnd() > 0.3) continue;
    const col = NEON[Math.floor(rnd() * NEON.length)]!;
    if (r.edge[2]) neon.box(r.x, r.y - 0.04, r.z + C / 2 + 0.03, C, 0.06, 0.06, col, 2.4);
    if (r.edge[0]) neon.box(r.x + C / 2 + 0.03, r.y - 0.04, r.z, 0.06, 0.06, C, col, 2.4);
  }
  g.add(neon.build({ glow: true }));

  // 2. Billboards on faces that look out over open air (+z wide boards, +x blade signs)
  const used = new Set<string>();
  let nb = 0;
  const clearOutZ = (i: number, j: number, f: number) => [1, 2, 3].every((d) => !city.occ(i, j + d, f) && !city.occ(i, j + d, f + 2));
  const clearOutX = (i: number, j: number, f: number) => [1, 2, 3].every((d) => !city.occ(i + d, j, f) && !city.occ(i + d, j, f + 2));
  const vols = [...city.vols].filter((v) => v.kind !== "bridge" && v.kind !== "walk" && v.f1 - v.f0 >= 4).sort(() => rnd() - 0.5);
  for (const v of vols) {
    if (nb > 44) break;
    const col = NEON[nb % NEON.length]!;
    const alt = NEON[(nb + 2) % NEON.length]!;
    const word = WORDS[nb % WORDS.length]!;
    const f = v.f0 + Math.floor(rnd() * Math.max(1, v.f1 - v.f0 - 3));
    if (v.i1 > v.i0 && rnd() < 0.5) {
      const i = v.i0 + Math.floor(rnd() * (v.i1 - v.i0));
      if (!clearOutZ(i, v.j1, f) || !clearOutZ(i + 1, v.j1, f) || used.has(`z${i},${v.j1},${f}`)) continue;
      used.add(`z${i},${v.j1},${f}`);
      const s = sign(word, C * 4.2, 2.6, { fg: col, alt, theme: "cyber" });
      s.position.set((city.cx(i) + city.cx(i + 1)) / 2, f * FL + 0.4, city.cz(v.j1) + C / 2 + 0.1);
      g.add(s);
      nb++;
    } else {
      const j = v.j0 + Math.floor(rnd() * (v.j1 - v.j0 + 1));
      if (!clearOutX(v.i1, j, f) || used.has(`x${v.i1},${j},${f}`)) continue;
      used.add(`x${v.i1},${j},${f}`);
      const s = sign(word.replace(/ /g, ""), 2.8, Math.min(18, 2.4 * word.length + 2), { fg: col, alt, theme: "cyber", vertical: true });
      s.rotation.y = Math.PI / 2;
      s.position.set(city.cx(v.i1) + C / 2 + 0.1, f * FL - 0.5, city.cz(j));
      g.add(s);
      nb++;
    }
  }

  // 3. Cables between roofs
  const roofs = city.roofs;
  for (let k = 0; k < 90; k++) {
    const a = roofs[Math.floor(rnd() * roofs.length)]!;
    const b2 = roofs[Math.floor(rnd() * roofs.length)]!;
    const d = Math.hypot(a.x - b2.x, a.z - b2.z);
    if (d < 4 || d > 22 || Math.abs(a.y - b2.y) > 14) continue;
    const sag = 0.7 + d * 0.06;
    const N = 12;
    const at = (t: number): V3 => [a.x + (b2.x - a.x) * t, a.y + 0.6 + (b2.y - a.y) * t - 4 * sag * t * (1 - t), a.z + (b2.z - a.z) * t];
    for (let i = 0; i < N; i++) cables.beam(at(i / N), at((i + 1) / N), 0.045, "#0c0a14");
  }
  g.add(cables.build());

  // 4. Holograms
  const holoMat = (hex: string) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const holo = (obj: THREE.Object3D, hex: string) => {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = holoMat(hex);
        m.castShadow = m.receiveShadow = false;
        m.userData.noBlock = false;
      }
    });
  };
  const hq = world.plan.marks.hqTop!;
  const hx = city.cx(hq.i0);
  const hz = city.cz(hq.j0);
  const ha = new Avatar(person(rnd, true).look, "voxel");
  ha.pose = "wave";
  ha.update(0.2, 1.4);
  holo(ha.root, "#2fe0ff");
  ha.root.scale.setScalar(8);
  ha.root.position.set(hx + 0.5, hq.f1 * FL + 0.5, hz + 1);
  g.add(ha.root);
  const proj = new Batch();
  proj.jitter = 0;
  proj.box(hx + 0.5, hq.f1 * FL + 0.2, hz + 1, 3, 0.3, 3, "#2fe0ff", 2.2);
  g.add(proj.build({ glow: true }));

  const rt = world.plan.marks.raidTop!;
  const dragon = petFrom2D(4, 0);
  holo(dragon.root, "#ff3d9a");
  dragon.root.scale.setScalar(9);
  dragon.root.rotation.y = 0.5;
  dragon.root.position.set(city.cx(rt.i0), rt.f1 * FL + 0.3, city.cz(rt.j0) + 1);
  g.add(dragon.root);

  // 5. Traffic: flying cars with light trails
  const cars = new Batch();
  cars.jitter = 0.04;
  const lights = new Batch();
  lights.jitter = 0;
  const trails = new Batch();
  trails.jitter = 0;
  const spanX = city.W * C * 0.55;
  const spanZ = city.D * C * 0.55;
  for (let k = 0; k < 70; k++) {
    const alongX = rnd() < 0.5;
    const y = 8 + rnd() * 70;
    const sc = 1.3 + rnd() * 1.6;
    const dir = rnd() < 0.5 ? 1 : -1;
    const x = (rnd() - 0.5) * 2 * spanX;
    const z = (rnd() - 0.5) * 2 * spanZ;
    const ci = Math.round(x / C + city.W / 2 - 0.5);
    const cj = Math.round(z / C + city.D / 2 - 0.5);
    const f0 = Math.floor(y / FL);
    if ([-1, 0, 1].some((a) => [-1, 0, 1].some((b2) => [0, 1].some((c2) => city.occ(ci + a, cj + b2, f0 + c2))))) continue;
    const col = ["#1d2038", "#2a1740", "#12303c", "#3a1a2e", "#202a44"][k % 5]!;
    const L = 2.1 * sc;
    const W = 0.95 * sc;
    const H = 0.4 * sc;
    const sx = alongX ? 1 : 0;
    const sz = alongX ? 0 : 1;
    const dx = (alongX ? L : W) * 1;
    const dz = (alongX ? W : L) * 1;
    cars.box(x, y, z, dx, H, dz, col);
    cars.box(x - sx * 0.1 * sc * dir, y + H, z - sz * 0.1 * sc * dir, alongX ? L * 0.5 : W * 0.85, 0.32 * sc, alongX ? W * 0.85 : L * 0.5, "#0a0f1a");
    const ncol = NEON[k % NEON.length]!;
    lights.box(x, y - 0.04, z, dx * 0.8, 0.06, dz * 0.8, ncol, 2.4);
    // headlights (front) and tail lights
    lights.box(x + sx * dir * (L / 2), y + H * 0.35, z + sz * dir * (L / 2), alongX ? 0.06 : W * 0.7, 0.14 * sc, alongX ? W * 0.7 : 0.06, "#fff6d8", 2.8);
    lights.box(x - sx * dir * (L / 2), y + H * 0.35, z - sz * dir * (L / 2), alongX ? 0.06 : W * 0.7, 0.12 * sc, alongX ? W * 0.7 : 0.06, "#ff2d4a", 2.6);
    const tl = 3 + rnd() * 4;
    trails.box(x - sx * dir * (L / 2 + tl / 2), y + H * 0.35, z - sz * dir * (L / 2 + tl / 2), alongX ? tl : 0.08, 0.08, alongX ? 0.08 : tl, "#ff3d6a", 1.3);
  }
  g.add(cars.build(), lights.build({ glow: true }), trails.build({ glow: true, opacity: 0.45 }));

  // 6. Steam plumes
  const steam = new Batch();
  steam.jitter = 0.03;
  const techs = city.roofs.filter((r) => r.vol.roof === "tech" && r.free);
  for (let k = 0; k < 26 && techs.length; k++) {
    const r = techs[Math.floor(rnd() * techs.length)]!;
    const sc = 0.8 + rnd() * 0.8;
    for (let p = 0; p < 7; p++) {
      const s = (0.6 + p * 0.28) * sc;
      steam.box(r.x + (rnd() - 0.5) * 0.4 + p * 0.1, r.y + 0.6 + p * 0.7 * sc, r.z + (rnd() - 0.5) * 0.4, s, s * 0.8, s, k % 3 === 0 ? "#d9a6ff" : k % 3 === 1 ? "#a6f0ff" : "#ffd6e8", 0.9);
    }
  }
  void steam;

  // 7. Searchlights
  const beams = new Batch();
  beams.jitter = 0;
  for (let k = 0; k < 4; k++) {
    const r = roofs[Math.floor(rnd() * roofs.length)]!;
    const col = ["#7fe9ff", "#ff6bd6", "#ffd27a", "#9b6bff"][k]!;
    beams.beam([r.x, r.y + 0.3, r.z], [r.x + (rnd() - 0.5) * 30, r.y + 90, r.z - 20 - rnd() * 20], 1.2 + rnd(), col, 1.2);
  }
  // landmark beacons
  const m = world.plan.marks;
  const pts: [Vol, string][] = [[m.tavern!, "#ffb347"], [m.hqTop!, "#2fe0ff"], [m.raidTop!, "#ff3d9a"], [m.arcade!, "#7bffb5"]];
  for (const [v, col] of pts) {
    const x = city.cx(v.i0);
    const z = city.cz(v.j0);
    const y = v.f1 * FL + 2;
    beams.beam([x, y, z], [x - 1, y + 140, z - 1], 1.6, col, 1.4);
  }
  g.add(beams.build({ glow: true, opacity: 0.09, additive: true }));
  void scene;
  void glow;
  void (null as unknown as Vol);
  void vertical;
}

/** Ground-level cyberpunk dressing around the plaza: vending machines, bollards, steam vents, hover cars, a hologram ad, point lights. */
export function streetDress(world: World, px: number, pz: number): void {
  const g = world.content;
  const rnd = seeded(555);
  const b = new Batch();
  b.jitter = 0.03;
  const gl = new Batch();
  gl.jitter = 0;
  // vending machines along the shops side
  for (let k = 0; k < 4; k++) {
    const x = px - 15 + k * 3.1;
    const z = pz + 6.4;
    const col = NEON[k % NEON.length]!;
    b.box(x, 0.06, z, 0.9, 2.0, 0.7, "#1a1c2a");
    gl.box(x, 0.8, z + 0.36, 0.7, 1.0, 0.03, col, 1.6);
    gl.box(x, 1.9, z + 0.36, 0.7, 0.06, 0.03, "#ffffff", 1.2);
  }
  // bollards with glowing caps around the plaza
  for (let k = 0; k < 14; k++) {
    const x = px - 6 + k * 0.92;
    b.box(x, 0.06, pz + 6.25, 0.22, 0.65, 0.22, "#252838");
    gl.box(x, 0.7, pz + 6.25, 0.24, 0.06, 0.24, NEON[(k + 1) % NEON.length]!, 2.4);
  }
  // puddle glow strips (reflections do the rest)
  for (let k = 0; k < 6; k++) gl.box(px - 12 + rnd() * 24, 0.075, pz + 2 + rnd() * 10, 1.4 + rnd() * 2, 0.01, 0.5 + rnd() * 0.5, NEON[k % NEON.length]!, 0.9);
  g.add(b.build(), gl.build({ glow: true }));

  // steam vents
  const steam = new Batch();
  steam.jitter = 0.03;
  for (let k = 0; k < 5; k++) {
    const x = px - 9 + k * 4.5 + (rnd() - 0.5) * 2;
    const z = pz + 8 + rnd() * 3;
    for (let p = 0; p < 5; p++) {
      const s = 0.35 + p * 0.22;
      steam.box(x + Math.sin(p * 1.3 + k) * 0.2 * p, 0.2 + p * 0.5, z + Math.cos(p) * 0.15, s, s * 0.7, s, k % 2 ? "#7a4aa8" : "#3a8ab0", 1);
    }
  }
  g.add(steam.build({ glow: true, opacity: 0.07 }));

  // hover cars low over the street (with underglow), a hologram ad above the plaza
  const cars = new Batch();
  cars.jitter = 0.04;
  const cl = new Batch();
  cl.jitter = 0;
  for (let k = 0; k < 6; k++) {
    const x = px - 24 + k * 8.5;
    const z = pz + 9.5 + (k % 2) * 2.2;
    const col = ["#2a1740", "#12303c", "#3a1a2e", "#202a44"][k % 4]!;
    cars.box(x, 0.45, z, 3.2, 0.55, 1.4, col);
    cars.box(x - 0.2, 1.0, z, 1.7, 0.45, 1.2, "#0a0f1a");
    cl.box(x, 0.38, z, 2.8, 0.05, 1.2, NEON[k % NEON.length]!, 2.6);
    cl.box(x + 1.62, 0.7, z, 0.06, 0.18, 1.1, "#fff6d8", 2.8);
    cl.box(x - 1.62, 0.7, z, 0.06, 0.16, 1.1, "#ff2d4a", 2.6);
  }
  g.add(cars.build(), cl.build({ glow: true }));

  const ad = sign("TOKEN SQUARE · OPEN 24/7", 7.5, 1.2, { fg: "#7fe9ff", alt: "#ff3d9a", theme: "cyber" });
  ad.position.set(px - 6, 7.2, pz + 5.5);
  g.add(ad);

  // point lights: magenta/cyan/amber spill on the wet paving
  const add = (c: string, i: number, x: number, y: number, z: number, d = 18) => {
    const l = new THREE.PointLight(c, i, d, 1.6);
    l.position.set(x, y, z);
    g.add(l);
  };
  add("#ff3d9a", 9, px - 12, 2.4, pz + 7.5, 14);
  add("#2fe0ff", 7, px - 5, 4.2, pz + 8, 14);
  add("#ffb347", 2.5, px - 0.8, 3.8, pz + 8.5, 14);
  add("#9b6bff", 7, px + 6, 3, pz + 8, 14);
}
