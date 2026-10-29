/**
 * The five prestige home trophies in 3D (`PRESTIGE_TRACKS[n].trophy` in core/src/prestige.ts), the same pieces as
 * `art/prestige-trophy.ts` draws in 2D: an Ascendant obelisk, a Cosmic orrery, a contained Voidwalker black hole,
 * an Architect holographic town and a Prismatic token monument. Built like `norse3d.ts`: bottom centre at the
 * origin, front along +z, `w` tiles wide and one deep, and each one animates through `ticks`.
 */
import * as THREE from "three";
import { glass, glow, Model, seeded, ticks } from "../kit/kit.ts";
import { light } from "./furniture.ts";

const SILVER = "#d6dbe6";
const SILVER_DARK = "#8f97ab";
const BRASS = "#e9b73d";
const BRASS_DARK = "#b98a1f";

/** A flat lit sheet that lets what is behind it show: holograms, rays. */
const beam = (color: string, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

// MARK: Ascendant obelisk

/** Violet-veined dark stone on a silver plinth: light climbs the veins, a pale feather of light rises off the tip. */
const obelisk = (): Model => {
  const m = new Model();
  m.box([0.8, 0.1, 0.8], SILVER, [0, 0, 0], 0.03);
  m.box([0.62, 0.1, 0.62], SILVER_DARK, [0, 0.1, 0], 0.025);
  // The shaft tapers: a cone of four sides, turned square.
  const shaft = m.cyl(0.3, 1.5, "#3d3163", [0, 0.2, 0], 0.19, 4);
  shaft.rotation.y = Math.PI / 4;
  const cap = m.cyl(0.19, 0.28, SILVER, [0, 1.7, 0], 0.02, 4);
  cap.rotation.y = Math.PI / 4;
  // Veins: lit strips down each face, bright beads running up them.
  const veins: THREE.Mesh[] = [];
  const beads: { o: THREE.Mesh; p: number }[] = [];
  for (let f = 0; f < 4; f++) {
    const face = m.part([0, 0, 0], (f * Math.PI) / 2);
    const wobble = [0.03, -0.04, 0.02, -0.02, 0.04];
    for (let i = 0; i < 5; i++) {
      const y = 0.3 + i * 0.28;
      const r = 0.285 - (i * 0.28 * 0.11) / 1.5 + 0.004;
      const v = face.box(
        [0.03, 0.3, 0.02],
        glow("#8b5cf6"),
        [wobble[i]! * 1.5 + (f % 2) * 0.05, y, r / Math.SQRT2 + 0.15],
        0.004,
      );
      v.rotation.z = wobble[i]! * 2;
      veins.push(v);
    }
    const bead = face.box([0.05, 0.05, 0.03], glow("#e6d9ff"), [0, 0.3, 0.3], 0.01);
    beads.push({ o: bead, p: f / 4 });
  }
  // The feather of light.
  const feather = m.part([0, 2.0, 0]);
  feather.box([0.02, 0.28, 0.02], glow("#c4a8ff"), [0, -0.14, 0], 0.004);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const v = feather.box(
        [0.14 - i * 0.03, 0.012, 0.012],
        glow(i === 0 ? "#ffffff" : "#c4a8ff"),
        [s * 0.06, -0.04 - i * 0.05, 0],
        0.002,
      );
      v.rotation.z = s * -0.5;
    }
  }
  light(m, [0, 1.2, 0.6], "#a88cff", 1.6, 4);
  ticks.push((t) => {
    const k = (t * 0.25) % 1;
    for (const b of beads) {
      const u = (k + b.p) % 1;
      b.o.position.y = 0.3 + u * 1.4;
      b.o.position.z = 0.285 - u * 0.1 + 0.02;
      b.o.scale.setScalar(Math.sin(u * Math.PI));
    }
    veins.forEach((v, i) => {
      v.scale.set(1, 1, 0.8 + 0.4 * Math.sin(t * 2.4 + i));
    });
    feather.position.y = 2.0 + ((t * 0.3) % 1) * 0.35;
    feather.scale.setScalar(1 - ((t * 0.3) % 1) * 0.6);
    feather.rotation.y = t * 0.8;
  });
  return m;
};

// MARK: Cosmic orrery

/** A midnight plate on a brass pedestal: a lit star and six worlds on brass arms, each at its own speed. */
const orrery = (): Model => {
  const m = new Model();
  m.cyl(0.55, 0.08, BRASS_DARK, [0, 0, 0], 0.5, 20);
  m.cyl(0.2, 0.35, BRASS, [0, 0.08, 0], 0.14, 14);
  m.cyl(0.8, 0.1, BRASS, [0, 0.43, 0], 0.88, 28).scale.z = 0.55;
  m.cyl(0.84, 0.04, "#14214d", [0, 0.53, 0], 0.84, 28).scale.z = 0.55;
  // Fixed stars on the plate.
  const rnd = seeded(5);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * 6.28;
    const r = 0.1 + rnd() * 0.72;
    m.box(
      [0.016, 0.006, 0.016],
      glow(i % 3 ? "#8cf0ff" : "#ffffff"),
      [Math.cos(a) * r, 0.575, Math.sin(a) * r * 0.55],
      0.002,
    );
  }
  // The post and the star, carried well above the plate.
  m.cyl(0.03, 0.5, BRASS, [0, 0.57, 0], 0.03, 8);
  const star = m.ball(0.14, glow("#8cf0ff"), [0, 1.1, 0], [1, 1, 1], 14);
  const halo = m.ball(0.2, beam("#22d3ee", 0.25), [0, 1.1, 0], [1, 1, 1], 12);
  const worlds: { pivot: Model; body: Model; r: number; speed: number }[] = [];
  const flat = m.part([0, 0.7, 0]);
  flat.scale.z = 0.55;
  const specs = [
    [0.2, "#9aa7c7", 0.035, 2.2],
    [0.3, "#f2a65a", 0.045, 1.6],
    [0.4, "#3b8cf0", 0.06, 1.1],
    [0.5, "#e8584f", 0.05, 0.8],
    [0.62, "#e9c46a", 0.07, 0.55],
    [0.74, "#8cf0ff", 0.04, 0.4],
  ] as const;
  specs.forEach(([r, color, size, speed], i) => {
    // The orbit as a thin ring on the plate's plane, and an arm from the post to the world.
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r + 0.004, 48), beam("#5a7ad0", 0.5));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.6;
    ring.scale.y = 0.55;
    m.add(ring);
    // The arm lies in a flattened frame (the plate is seen at an angle); the world itself stays round.
    const pivot = flat.part([0, 0, 0], i);
    pivot.box([r, 0.01, 0.014], BRASS, [r / 2, 0, 0], 0.003);
    const body = m.part([0, 0.7, 0]);
    body.ball(size, color, [0, 0, 0], [1, 1, 1], 10);
    if (i === 4) body.cyl(size * 1.9, 0.006, "#fff0b3", [0, 0, 0], size * 1.9, 14).rotation.z = 0.35;
    worlds.push({ pivot, body, r, speed });
  });
  light(m, [0, 1.1, 0.3], "#8cf0ff", 1.8, 4);
  ticks.push((t) => {
    worlds.forEach((w, i) => {
      const a = i + t * w.speed;
      w.pivot.rotation.y = a;
      w.body.position.set(Math.cos(a) * w.r, 0.7, -Math.sin(a) * w.r * 0.55);
    });
    star.scale.setScalar(1 + 0.06 * Math.sin(t * 3));
    halo.scale.setScalar(1 + 0.15 * Math.sin(t * 2 + 1));
  });
  m.scale.setScalar(1.0);
  return m;
};

// MARK: Contained black hole

/** A glass cell on a black plinth: a dark sphere in a ring of magenta fire that turns, light spiralling in. */
const blackHole = (): Model => {
  const m = new Model();
  m.box([0.84, 0.3, 0.84], "#17101f", [0, 0, 0], 0.04);
  m.box([0.86, 0.04, 0.86], "#4a4660", [0, 0.3, 0], 0.01);
  for (let i = 0; i < 6; i++)
    m.box([0.07, 0.07, 0.01], glow(i % 2 ? "#d946ef" : "#7a1f8f"), [-0.3 + i * 0.12, 0.1, 0.425], 0.004);
  // The void in the cell and the steel cap.
  m.box([0.7, 1.15, 0.7], "#0a0610", [0, 0.34, 0], 0.01);
  const hole = m.part([0, 0.92, 0]);
  hole.ball(0.1, "#000000", [0, 0, 0], [1, 1, 1], 14);
  hole.ball(0.115, beam("#ff7cf5", 0.35), [0, 0, 0], [1, 1, 1], 12);
  // The accretion disc: 28 bright and dim segments in a ring that spins.
  const disc = hole.part([0, 0, 0]);
  disc.rotation.x = 0.28;
  const spin = disc.part([0, 0, 0]);

  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const k = i % 7;
    const c = k < 1 ? "#ffe0fb" : k < 3 ? "#ff7cf5" : k < 5 ? "#d946ef" : "#7a1f8f";
    const s = spin.box([0.06, 0.012, 0.05], glow(c), [Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26], 0.002);
    s.rotation.y = -a;
    if (k < 5) {
      const inner = spin.box([0.04, 0.01, 0.04], glow(c), [Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19], 0.002);
      inner.rotation.y = -a;
    }
  }
  // Lensed light bent over the top of the hole.
  const lens = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 28), beam("#ff7cf5", 0.8));
  hole.add(lens);
  // Motes falling in.
  const rnd = seeded(8);
  const motes = Array.from({ length: 5 }, (_, i) => ({
    o: hole.box([0.018, 0.018, 0.018], glow("#ffe0fb"), [0, 0, 0], 0.003),
    a: rnd() * 6.28,
    p: i / 5,
  }));
  // The glass: four faces, a pane each.
  m.box([0.74, 1.2, 0.74], glass("#b9c4f2", 0.16), [0, 0.34, 0], 0.01);
  m.box([0.86, 0.1, 0.86], "#4a4660", [0, 1.54, 0], 0.02);
  m.box([0.86, 0.06, 0.86], "#4a4660", [0, 0.3, 0], 0.02);
  light(m, [0, 0.92, 0.6], "#ff7cf5", 1.8, 4);
  ticks.push((t) => {
    spin.rotation.y = -t * 1.6;
    lens.rotation.y = t * 0.3;
    lens.scale.set(1, 1, 1 + 0.08 * Math.sin(t * 2));
    for (const s of motes) {
      const u = (t * 0.35 + s.p) % 1;
      const r = 0.34 * (1 - u);
      const a = s.a + u * 5;
      s.o.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.12 * (1 - u), Math.sin(a) * r);
      s.o.scale.setScalar(Math.sin(u * Math.PI));
    }
  });
  m.scale.set(1.15, 1.15, 1.15);
  return m;
};

// MARK: Holographic town

/** Your town in blueprint gold over a dark projector: citizens blink in time, a scan line sweeps up it. */
const holoTown = (): Model => {
  const m = new Model();
  m.box([1.8, 0.22, 0.8], "#2a2210", [0, 0, 0], 0.04);
  m.box([1.84, 0.02, 0.84], "#4a3c1a", [0, 0.22, 0], 0.005);
  for (let i = 0; i < 12; i++)
    m.box([0.07, 0.03, 0.01], glow(i % 4 ? "#d4a017" : "#f5e6b8"), [-0.8 + i * 0.145, 0.07, 0.402], 0.003);
  m.cyl(0.6, 0.03, "#5c4512", [0, 0.24, 0], 0.6, 32).scale.z = 0.55;
  const holo = m.part([0, 0.28, 0]);
  const edge = glow("#ffe38a");
  const body = beam("#d4a017", 0.38);
  const lit: THREE.Mesh[] = [];
  const bldg = (x: number, z: number, w: number, d: number, h: number) => {
    const b = holo.box([w, h, d], body, [x, 0, z], 0.002);
    b.castShadow = false;
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: "#ffe38a" }),
    );
    wire.position.set(x, h / 2, z);
    holo.add(wire);
    holo.box([w, 0.012, d], edge, [x, h, z], 0.002);
    // Windows.
    for (let wy = 0.1; wy < h - 0.05; wy += 0.1)
      for (const side of [-1, 1]) {
        const win = holo.box(
          [0.03, 0.03, 0.01],
          glow("#fff1c0"),
          [x + side * w * 0.22, wy, z + d / 2 + 0.006],
          0.001,
        );
        lit.push(win);
      }
  };
  bldg(0, 0, 0.2, 0.2, 0.75);
  holo.box([0.012, 0.2, 0.012], edge, [0, 0.75, 0], 0.002);
  bldg(-0.38, 0.05, 0.22, 0.2, 0.3);
  bldg(0.4, 0.02, 0.26, 0.22, 0.42);
  bldg(-0.7, -0.05, 0.18, 0.18, 0.2);
  bldg(0.72, 0.08, 0.16, 0.2, 0.26);
  bldg(0.2, 0.22, 0.14, 0.12, 0.14);
  bldg(-0.18, 0.22, 0.14, 0.12, 0.18);
  const dome = holo.ball(0.12, body, [-0.55, 0.18, 0.2], [1, 0.6, 1], 12);
  dome.castShadow = false;
  // Citizens: tiny lit figures pacing the streets.
  const folk = Array.from({ length: 6 }, (_, i) => ({
    o: holo.box([0.02, 0.045, 0.02], glow("#f5e6b8"), [0, 0, 0], 0.003),
    x0: -0.7 + i * 0.28,
    z: 0.3 - (i % 2) * 0.05,
    dir: i % 2 ? -1 : 1,
  }));
  // The scan line.
  const scan = holo.box([1.5, 0.008, 0.6], glow("#fff1c0"), [0, 0, 0], 0.001);
  light(m, [0, 0.8, 0.6], "#ffd36a", 1.6, 4);
  ticks.push((t) => {
    folk.forEach((f, i) => {
      f.o.position.set(f.x0 + Math.sin(t * 0.6 + i) * 0.1 * f.dir, 0, f.z);
      f.o.visible = Math.floor(t * 2 + i * 0.5) % 4 !== 3;
    });
    lit.forEach((w, i) => {
      w.visible = (Math.floor(t * 1.5) + i) % 3 !== 0;
    });
    const k = (t * 0.4) % 1;
    scan.position.y = k * 0.9;
    scan.scale.set(1, 1, 1);
    holo.rotation.y = Math.sin(t * 0.3) * 0.02;
    body.opacity = 0.34 + 0.06 * Math.sin(t * 7);
  });
  m.scale.setScalar(1.05);
  return m;
};

// MARK: Prismatic token monument

const RAINBOW = ["#ff5d6c", "#ffa94d", "#ffe66b", "#7bed9f", "#6ec6ff", "#b18cff"];

/** A pearl token the height of a person on a pearl plinth: light goes into a prism and leaves as every colour. */
const monument = (): Model => {
  const m = new Model();
  m.box([1.7, 0.16, 0.8], "#f4f0ff", [0, 0, 0], 0.04);
  m.box([1.1, 0.14, 0.6], "#c9c2e6", [0, 0.16, 0], 0.03);
  m.box([1.12, 0.03, 0.62], glow("#ff7ad9"), [0, 0.28, 0], 0.005);
  m.box([0.4, 0.3, 0.2], "#a69fcc", [0, 0.3, 0], 0.02);
  // The token on its edge, facing front: a pearl rim round a midnight face.
  const coin = m.part([0, 1.2, 0]);
  const rim = coin.cyl(0.86, 0.16, "#f4f0ff", [0, 0, -0.08], 0.86, 40);
  rim.rotation.x = Math.PI / 2;
  const face = coin.cyl(0.66, 0.02, "#231c47", [0, 0, 0.082], 0.66, 40);
  face.rotation.x = Math.PI / 2;
  // The groove: rainbow segments that slide round it.
  const groove: THREE.Mesh[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const s = coin.box(
      [0.1, 0.1, 0.02],
      glow(RAINBOW[Math.floor(i / 6) % 6]!),
      [Math.cos(a) * 0.73, Math.sin(a) * 0.73 - 0.05, 0.075],
      0.003,
    );
    s.rotation.z = a;
    groove.push(s);
  }
  // The prism and its fan, on the face.
  const prism = coin.cyl(0.16, 0.05, glow("#ffffff"), [0, -0.1, 0.09], 0.01, 3);
  prism.rotation.x = Math.PI / 2;
  prism.rotation.y = Math.PI;
  coin.box([0.34, 0.02, 0.02], glow("#ffffff"), [-0.3, -0.05, 0.1], 0.003).rotation.z = 0.25;
  const fan = RAINBOW.map((c, i) => {
    const b = coin.part([0.08, -0.05, 0.1]);
    b.rotation.z = (2.5 - i) * 0.09 - 0.1;
    b.box([0.5, 0.02, 0.012], glow(c), [0.25, 0, 0], 0.002);
    return b;
  });
  // Rays thrown out past the token on either side, shimmering.
  const rays = RAINBOW.map((c, i) => {
    const r = m.box([0.25, 0.025, 0.02], beam(c, 0.8), [0, 0.7 + i * 0.1, 0.1], 0.003);
    return r;
  });
  // Pearls of light that drift up.
  const rnd = seeded(21);
  const sparks = Array.from({ length: 8 }, (_, i) => ({
    o: m.box([0.03, 0.03, 0.03], glow(i % 2 ? "#ffffff" : "#9fe8ff"), [0, 0, 0], 0.005),
    x: (rnd() - 0.5) * 1.6,
    z: (rnd() - 0.3) * 0.4,
    p: i / 8,
  }));
  light(m, [0, 1.4, 0.7], "#ffd7f5", 1.6, 4.5);
  ticks.push((t) => {
    coin.rotation.y = Math.sin(t * 0.5) * 0.18;
    groove.forEach((g, i) => {
      g.material = glow(RAINBOW[(Math.floor(i / 6) + Math.floor(t * 3)) % 6]!);
    });
    fan.forEach((b, i) => {
      b.scale.x = 0.85 + 0.15 * Math.sin(t * 3 + i);
    });
    rays.forEach((r, i) => {
      const side = i % 2 ? 1 : -1;
      r.position.x = side * (0.92 + 0.04 * Math.sin(t * 2 + i));
      (r.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(t * 3 + i * 1.3);
    });
    for (const s of sparks) {
      const u = (t * 0.2 + s.p) % 1;
      s.o.position.set(s.x, 0.3 + u * 1.9, s.z);
      s.o.rotation.set(t * 2, t * 3, 0);
      s.o.scale.setScalar(Math.sin(u * Math.PI));
    }
  });
  m.position.y = 0;
  return m;
};

const BUILDERS = [obelisk, orrery, blackHole, holoTown, monument] as const;

/** The 3D model of the prestige trophy for a rank (1 is the first): a fresh one each call. */
export function prestigeTrophy3d(rank: number): Model {
  const build = BUILDERS[rank - 1];
  if (!build) throw new Error(`no prestige trophy for rank ${rank}`);
  return build();
}

/** The trophies as furniture assets, shaped like `NORSE_ASSETS`, for the registry to take up later. */
export const PRESTIGE_TROPHY_ASSETS: readonly {
  id: string;
  name: string;
  w: number;
  d: number;
  build: () => Model;
}[] = [
  { id: "prestige-trophy-1", name: "Ascendant obelisk", w: 1, d: 1, build: obelisk },
  { id: "prestige-trophy-2", name: "Miniature orrery", w: 2, d: 1, build: orrery },
  { id: "prestige-trophy-3", name: "Contained black hole", w: 1, d: 1, build: blackHole },
  { id: "prestige-trophy-4", name: "Holographic town", w: 2, d: 1, build: holoTown },
  { id: "prestige-trophy-5", name: "Prismatic token monument", w: 2, d: 1, build: monument },
];
