/**
 * Prestige track 4's legendary aura in 3D (`core/src/prestige.ts`, slot "aura"): Orbiting wireframe. Like the cases'
 * (`gear3dAura.ts`) the builder gets a frame at the middle of the body, scaled to the avatar's height (one unit is one
 * metre of a 0.95 m person), and registers a tick that moves its parts. Loaded by `gear3dPrestige4.ts`.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { AURA_BUILDERS } from "./gear3dAura.ts";

const GOLD_LIGHT = "#f0c94a";
const IVORY = "#f5e6b8";
const GLOW = "#ffe38a";

/** Materials every wearer shares: one per colour and opacity, never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(color: string, opacity = 1): THREE.Material {
  const key = `${color}/${opacity}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

type V3 = [number, number, number];
type Edge = [number, number];
interface Solid {
  v: V3[];
  e: Edge[];
}

// biome-ignore format: a catalogue reads best one to a line
const SOLIDS: Solid[] = [
  // A cube.
  {
    v: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ],
  },
  // An octahedron.
  {
    v: [
      [1.3, 0, 0],
      [-1.3, 0, 0],
      [0, 1.3, 0],
      [0, -1.3, 0],
      [0, 0, 1.3],
      [0, 0, -1.3],
    ],
    e: [
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 4],
      [4, 3],
      [3, 5],
      [5, 2],
    ],
  },
  // A tetrahedron.
  {
    v: [
      [1.2, 1.2, 1.2],
      [1.2, -1.2, -1.2],
      [-1.2, 1.2, -1.2],
      [-1.2, -1.2, 1.2],
    ],
    e: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [2, 3],
      [3, 1],
    ],
  },
];

const geometries = new Map<string, THREE.BufferGeometry>();
/** A geometry built once and kept: every wearer shares it, and it is never disposed with a model. */
function kept(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geometries.set(key, g);
  }
  return g;
}

const merged = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  for (const p of parts) p.dispose();
  return g;
};

/** A solid drawn as thin gold bars along its edges, `r` metres to the unit and `t` thick. */
function bars(s: Solid, r: number, t: number): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0);
  return merged(
    s.e.map(([a, b]) => {
      const p = new THREE.Vector3(...s.v[a]!).multiplyScalar(r);
      const q = new THREE.Vector3(...s.v[b]!).multiplyScalar(r);
      const len = p.distanceTo(q);
      const g = new THREE.BoxGeometry(t, len + t, t);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, q.clone().sub(p).normalize()));
      return g.translate(...p.add(q).multiplyScalar(0.5).toArray());
    }),
  );
}

/** A small cube at each corner of a solid. */
const corners = (s: Solid, r: number, t: number): THREE.BufferGeometry =>
  merged(s.v.map(([x, y, z]) => new THREE.BoxGeometry(t, t, t).translate(x * r, y * r, z * r)));

/** The drafted circle: a ring of dashes with a longer tick every quarter, flat. */
function circle(r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 18 === 0;
    const g = new THREE.BoxGeometry(long ? 0.034 : 0.012, 0.004, long ? 0.034 : 0.012);
    g.rotateY(a);
    parts.push(g.translate(Math.sin(a) * r, 0, Math.cos(a) * r));
  }
  return merged(parts);
}

// Orbiting wireframe: a cube, an octahedron and a tetrahedron of gold bars circle the wearer at different heights, each
// turning as it goes, with a bright pen tip running along the edges of each as if it were being drawn. A drafted circle
// of dashes and ticks turns round the middle of the body.
AURA_BUILDERS["Orbiting wireframe"] = (m, tick) => {
  const R = 0.5;
  const unit = [0.07, 0.085, 0.08];
  const orbits = SOLIDS.map((s, i) => {
    const r = unit[i]!;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(
      kept(`frame${i}`, () => bars(s, r, 0.008)),
      basic(GOLD_LIGHT),
    );
    const joints = new THREE.Mesh(
      kept(`joint${i}`, () => corners(s, r, 0.018)),
      basic(GLOW),
    );
    // The pen.
    const pen = new THREE.Mesh(
      kept("pen", () => new THREE.BoxGeometry(1, 1, 1)),
      basic("#ffffff"),
    );
    pen.scale.setScalar(0.022);
    for (const o of [frame, joints, pen]) {
      o.userData.noBlock = true;
      g.add(o);
    }
    m.add(g);
    return { g, s, r, pen, i };
  });
  const dash = new THREE.Mesh(
    kept("circle", () => circle(R)),
    basic(GLOW, 0.55),
  );
  dash.userData.noBlock = true;
  dash.position.y = 0.02;
  m.add(dash);
  // The pen ticks along a few ivory marks too.
  const marks = Array.from({ length: 4 }, () => {
    const o = new THREE.Mesh(
      kept("pen", () => new THREE.BoxGeometry(1, 1, 1)),
      basic(IVORY),
    );
    o.userData.noBlock = true;
    o.scale.setScalar(0.014);
    m.add(o);
    return o;
  });

  tick((t, walking) => {
    const pace = walking ? 1.5 : 1;
    for (const o of orbits) {
      const a = t * 0.5 * pace + (o.i * Math.PI * 2) / 3;
      o.g.position.set(
        Math.sin(a) * R,
        Math.sin(t * 0.8 + o.i * 2.1) * 0.22 + (o.i - 1) * 0.04,
        Math.cos(a) * R,
      );
      o.g.rotation.set(0.5 + o.i * 0.4, t * (0.9 + o.i * 0.15), t * 0.3);
      // The pen goes edge to edge, a new one every second or so.
      const k = (t * 0.9 + o.i * 0.37) * 1;
      const e = Math.floor(k) % o.s.e.length;
      const f = k - Math.floor(k);
      const [va, vb] = o.s.e[e]!;
      const p = o.s.v[va]!;
      const q = o.s.v[vb]!;
      o.pen.position.set(
        (p[0] + (q[0] - p[0]) * f) * o.r,
        (p[1] + (q[1] - p[1]) * f) * o.r,
        (p[2] + (q[2] - p[2]) * f) * o.r,
      );
    }
    dash.rotation.y = -t * 0.25;
    marks.forEach((o, i) => {
      const a = -t * 0.25 + (i * Math.PI) / 2;
      o.position.set(Math.sin(a) * R, 0.035 + Math.sin(t * 2 + i) * 0.01, Math.cos(a) * R);
    });
  });
};
