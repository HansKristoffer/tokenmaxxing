/**
 * The five prestige pet accessories in 3D (`petwear` in `core/src/prestige.ts`; the 2D twins are in
 * `art/prestige-petwear.ts`), made like the Lv50 crown in `pets3d.ts`. `petwear3d(rank)` is a group for the
 * wiring to add to the pet's head: put it at the rig's `top` (`worn.userData.at === "top"`) or `neck`, scale it
 * with `neckR` here, hide it when the pet sleeps, and call `userData.tick(t)` every frame.
 */
import * as THREE from "three";
import { glow, Model, toon } from "../kit/kit.ts";

export type PetwearAt = "top" | "neck";

/** A worn accessory: where it goes on the pet, and what to call each frame. */
export interface Petwear3D extends Model {
  userData: { at: PetwearAt; tick: (t: number) => void };
}

/** Where each rank sits (rank I at index 0): on the head's top, or the neck's middle. */
export const PETWEAR_AT: readonly PetwearAt[] = ["top", "neck", "top", "top", "top"];

const HUES = ["#ff5d73", "#ffb44d", "#fff06a", "#6dffa1", "#6fd8ff", "#8f8bff", "#ff7ad9"];

/** A flat ring lying in the xz plane. */
function ring(m: Model, r: number, tube: number, color: string | THREE.Material, y = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(r, tube, 5, 20),
    typeof color === "string" ? toon(color) : color,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  mesh.userData.noBlock = true;
  m.add(mesh);
  return mesh;
}

/** The little lit pip that circles the accessory. */
const pip = (m: Model, s: number, color: string): THREE.Mesh =>
  m.ball(0.009 * s, glow(color), [0, 0, 0], [1, 1, 1], 5);

/**
 * Prestige `rank`'s pet accessory for a pet whose neck is `neckR` thick (the crown's scale), at the origin of its
 * anchor. Rank 0 and past the last make an empty group that does nothing.
 */
export function petwear3d(rank: number, neckR = 0.09): Petwear3D {
  const g = new Model() as Petwear3D;
  const s = Math.max(0.7, neckR / 0.09);
  g.userData = { at: PETWEAR_AT[rank - 1] ?? "top", tick: () => {} };
  switch (rank) {
    case 1: {
      // A silver band, a violet stone at the front, a glint that runs round it.
      ring(g, 0.05 * s, 0.006 * s, "#d6dbe6", 0.012 * s);
      g.ball(0.016 * s, glow("#8b5cf6"), [0, 0.022 * s, 0.052 * s], [0.8, 1.2, 0.6], 6);
      g.ball(0.008 * s, glow("#c4a8ff"), [0, 0.034 * s, 0.054 * s], [1, 1, 0.6], 5);
      const glint = pip(g, s, "#ffffff");
      g.userData.tick = (t) => {
        const a = t * 1.6;
        glint.position.set(Math.sin(a) * 0.05 * s, 0.012 * s, Math.cos(a) * 0.05 * s);
        glint.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(t * 5)));
      };
      break;
    }
    case 2: {
      // A midnight collar with cyan studs and a star for a tag.
      const r = neckR * 1.04;
      g.cyl(r, 0.03, "#14214d", [0, -0.03, 0], r, 14);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        g.ball(
          0.006,
          glow("#22d3ee"),
          [Math.sin(a) * r * 1.02, -0.015, Math.cos(a) * r * 1.02],
          [1, 1, 1],
          4,
        );
      }
      const star = g.part([0, -0.065, r * 1.04]);
      star.ball(0.018, glow("#8cf0ff"), [0, 0, 0], [1, 1, 0.5], 6);
      star.box([0.05, 0.008, 0.008], glow("#ffffff"), [0, -0.004, 0.006], 0.002);
      star.box([0.008, 0.05, 0.008], glow("#ffffff"), [0, -0.025, 0.006], 0.002);
      g.userData.tick = (t) => star.scale.setScalar(0.85 + 0.25 * Math.sin(t * 3.2));
      break;
    }
    case 3: {
      // A black disc ringed in magenta fire, floating over the head.
      const f = g.part([0, 0.1 * s, 0]);
      f.cyl(0.044 * s, 0.01 * s, "#17101f", [0, -0.005 * s, 0], 0.044 * s, 16);
      ring(f, 0.047 * s, 0.007 * s, glow("#d946ef"));
      ring(f, 0.058 * s, 0.003 * s, glow("#ff7cf5"));
      const flames = Array.from({ length: 6 }, (_, i) => ({
        m: f.cyl(0.009 * s, 0.03 * s, glow(i % 2 ? "#ff7cf5" : "#ffd6fb"), [0, 0, 0], 0.001, 4),
        a: (i / 6) * Math.PI * 2,
      }));
      g.userData.tick = (t) => {
        f.position.y = (0.1 + Math.sin(t * 2) * 0.012) * s;
        f.rotation.y = t * 0.8;
        for (const [i, fl] of flames.entries()) {
          const k = 0.7 + 0.6 * Math.abs(Math.sin(t * 7 + i * 1.9));
          fl.m.position.set(Math.cos(fl.a) * 0.052 * s, 0, Math.sin(fl.a) * 0.052 * s);
          fl.m.scale.set(1, k, 1);
        }
      };
      break;
    }
    case 4: {
      // A gold ring of tiny gears, floating a little over the head, that turns.
      const h = g.part([0, 0.09 * s, 0]);
      ring(h, 0.045 * s, 0.005 * s, "#d4a017");
      const teeth = h.part();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const t = teeth.box(
          [0.012 * s, 0.014 * s, 0.012 * s],
          i % 2 ? "#ffe38a" : "#f5e6b8",
          [Math.cos(a) * 0.053 * s, -0.007 * s, Math.sin(a) * 0.053 * s],
          0.002,
        );
        t.rotation.y = -a;
      }
      const small = h.part([0.045 * s, 0, 0]);
      small.cyl(0.012 * s, 0.006 * s, "#ffe38a", [0, -0.003, 0], 0.012 * s, 8);
      g.userData.tick = (t) => {
        h.position.y = (0.09 + Math.sin(t * 1.8) * 0.01) * s;
        teeth.rotation.y = t * 0.9;
        small.rotation.y = -t * 2.4;
      };
      break;
    }
    case 5: {
      // Pearl points over a band of light that runs through the rainbow.
      g.cyl(0.05 * s, 0.014 * s, "#f4f0ff", [0, 0, 0], 0.05 * s, 14);
      const dots: THREE.Mesh[] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const x = Math.sin(a) * 0.05 * s;
        const z = Math.cos(a) * 0.05 * s;
        g.cyl(0.013 * s, 0.045 * s, "#f4f0ff", [x * 0.85, 0.01 * s, z * 0.85], 0.002, 4);
        dots.push(g.ball(0.008 * s, glow(HUES[i]!), [x * 1.02, 0.006 * s, z * 1.02], [1, 1, 1], 5));
      }
      const tint = new THREE.Color();
      g.userData.tick = (t) => {
        for (const [i, d] of dots.entries()) {
          tint.set(HUES[Math.floor(i + t * 4) % HUES.length]!);
          (d.material as THREE.MeshBasicMaterial).color.copy(tint);
        }
      };
      break;
    }
  }
  return g;
}
