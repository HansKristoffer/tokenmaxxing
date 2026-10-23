/**
 * Characters: one look (skin, hair, outfit, hat, species, age) worn in any of five styles (`styles.ts`), all
 * posed the same way here, with painted faces (`faces.ts`). The colours are the game's own
 * (`web/src/art/palette.ts`), so every look a player has today has a 3D twin. Pets are built the same way.
 */
import type * as THREE from "three";
import { HAIRS, OUTFITS, PANTS, SKINS } from "../art/palette.ts";
import { type Expression, type Face, faceTexture } from "./faces.ts";
import { Model, tint, type V3 } from "./kit.ts";
import {
  AGES,
  type Age,
  ANIMALS,
  animal,
  bot,
  type CharStyle,
  chibi,
  grown,
  type Hat,
  type Job,
  type Look,
  type Rig,
  type Top,
} from "./styles.ts";
import { voxel } from "./voxel.ts";

const BUILD: Record<CharStyle, (body: Model, look: Look) => Rig> = { voxel, grown, animal, chibi, bot };

export type { Expression } from "./faces.ts";
export type { CharStyle, Look } from "./styles.ts";

export const HATS: readonly Hat[] = ["none", "cap", "beanie", "headphones", "crown"];

const JOBS: readonly Job[] = ["chef", "farmer", "officer"];

/** What people wear at each age. */
const TOPS: Record<Age, readonly Top[]> = {
  young: ["tee", "hoodie", "hoodie"],
  adult: ["tee", "hoodie", "blazer", "blazer"],
  senior: ["cardigan", "cardigan", "blazer"],
};

export function randomLook(rnd = Math.random): Look {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const outfit = Math.floor(rnd() * OUTFITS.length);
  // Mostly working age.
  const age: Age = rnd() < 0.15 ? "senior" : pick(AGES.slice(0, 2));
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    style: Math.floor(rnd() * 5),
    outfit: OUTFITS[outfit]!,
    pants: PANTS[outfit] ?? PANTS[0]!,
    hat: rnd() < 0.55 ? "none" : pick(HATS.slice(1)),
    species: rnd() < 0.5 ? "human" : pick(ANIMALS),
    age,
    top: pick(TOPS[age]),
    beard: age !== "young" && rnd() < 0.4 ? 1 + Math.floor(rnd() * 2) : 0,
    glasses: age === "senior" || rnd() < 0.2,
    job: rnd() < 0.2 ? pick(JOBS) : undefined,
  };
}

export type Pose = "stand" | "walk" | "sit" | "type" | "sleep" | "wave" | "dance" | "dj";

export class Avatar {
  readonly root = new Model();
  readonly body = this.root.part();
  readonly head: Model;
  /** Standing height, to the top of the head, and the hips, which a sitter drops by. */
  readonly height: number;
  readonly hip: number;
  private readonly rig: Rig;
  /** Short legs don't bend; theirs are stand-ins. */
  private readonly knees: [Model, Model];
  /** How they look; a blink or a word passes over it for a moment. */
  expression: Expression = "neutral";
  /** Talking: the mouth opens and shuts. */
  talking = false;
  pose: Pose = "stand";
  /** Seconds into the walk cycle. */
  private phase = Math.random() * 10;
  private blinkAt = Math.random() * 4;

  constructor(
    readonly look: Look,
    readonly style: CharStyle = "grown",
  ) {
    this.rig = BUILD[style](this.body, look);
    this.head = this.rig.head;
    this.height = this.rig.height;
    this.hip = this.rig.hip;
    this.knees = this.rig.knees ?? [new Model(), new Model()];
  }

  /** Moves the limbs for `pose`, `dt` seconds after the last frame. */
  update(dt: number, t: number): void {
    this.phase += dt;
    const [legL, legR] = this.rig.legs;
    const [armL, armR] = this.rig.arms;
    const [kneeL, kneeR] = this.knees;
    const HIP = this.rig.hip;
    const b = this.body;
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    b.scale.set(1, 1, 1);
    this.head.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    armL.rotation.set(0, 0, 0);
    armR.rotation.set(0, 0, 0);
    kneeL.rotation.set(0, 0, 0);
    kneeR.rotation.set(0, 0, 0);

    switch (this.pose) {
      case "walk": {
        const s = Math.sin(this.phase * 11);
        legL.rotation.x = s * 0.6;
        legR.rotation.x = -s * 0.6;
        // The leg behind bends at the knee.
        kneeL.rotation.x = Math.max(0, s) * 0.8;
        kneeR.rotation.x = Math.max(0, -s) * 0.8;
        armL.rotation.x = -s * 0.7;
        armR.rotation.x = s * 0.7;
        b.position.y = Math.abs(Math.cos(this.phase * 11)) * 0.035;
        b.rotation.z = s * 0.04;
        break;
      }
      case "sit":
      case "type":
        b.position.y = -HIP + 0.02;
        legL.rotation.x = legR.rotation.x = -Math.PI / 2;
        kneeL.rotation.x = kneeR.rotation.x = 1.35;
        if (this.pose === "type") {
          armL.rotation.x = armR.rotation.x = -1.15;
          armL.rotation.x += Math.sin(t * 22) * 0.07;
          armR.rotation.x += Math.cos(t * 19) * 0.07;
          this.head.rotation.x = 0.08 + Math.sin(t * 1.3) * 0.03;
        } else {
          armL.rotation.x = armR.rotation.x = -0.35;
          this.head.rotation.y = Math.sin(t * 0.5) * 0.25;
        }
        break;
      case "sleep":
        b.rotation.x = -Math.PI / 2;
        // Feet to the foot of the bed, however tall.
        b.position.set(0, 0.06, 0.32 + Math.max(0, this.height - 0.97));
        b.scale.y = 1 + Math.sin(t * 1.6) * 0.02;
        armL.rotation.z = 0.15;
        armR.rotation.z = -0.15;
        break;
      case "wave":
        armR.rotation.z = 2.6 + Math.sin(t * 9) * 0.35;
        this.head.rotation.z = Math.sin(t * 3) * 0.06;
        break;
      case "dance": {
        const beat = t * 7 + this.phase;
        b.position.y = Math.abs(Math.sin(beat)) * 0.07;
        b.rotation.y = Math.sin(beat * 0.5) * 0.4;
        armL.rotation.z = -2.4 - Math.sin(beat) * 0.4;
        armR.rotation.z = 2.4 - Math.sin(beat) * 0.4;
        legL.rotation.x = Math.max(0, Math.sin(beat)) * -0.5;
        legR.rotation.x = Math.max(0, -Math.sin(beat)) * -0.5;
        kneeL.rotation.x = Math.max(0, Math.sin(beat)) * 0.9;
        kneeR.rotation.x = Math.max(0, -Math.sin(beat)) * 0.9;
        this.head.rotation.z = Math.sin(beat) * 0.12;
        break;
      }
      case "dj":
        armL.rotation.x = -1.3 + Math.sin(t * 7) * 0.1;
        armR.rotation.x = -0.9;
        armR.rotation.z = 0.3 + Math.sin(t * 3.5) * 0.3;
        this.head.rotation.x = Math.max(0, Math.sin(t * 7)) * 0.18;
        b.position.y = Math.abs(Math.sin(t * 7)) * 0.02;
        break;
      case "stand":
        b.position.y = Math.sin(t * 2.2 + this.phase) * 0.006;
        armL.rotation.z = -0.04 - Math.sin(t * 2.2) * 0.02;
        armR.rotation.z = 0.04 + Math.sin(t * 2.2) * 0.02;
        break;
    }

    // Blink every few seconds, and move the mouth while talking.
    const blink = t > this.blinkAt && t < this.blinkAt + 0.12;
    if (t > this.blinkAt + 0.12) this.blinkAt = t + 2 + Math.random() * 4;
    let face: Face = this.pose === "sleep" ? "sleep" : this.expression;
    if (face === "neutral" && this.talking && Math.sin(t * 16) > 0) face = "talk";
    if (blink && (face === "neutral" || face === "focus" || face === "surprised")) face = "blink";
    for (const f of this.rig.faces) {
      const map = faceTexture(face, f.kind);
      if (f.material.map !== map) f.material.map = map;
    }
    this.rig.tick?.(t);
  }
}

export type PetKind = "cat" | "dog" | "duck";

/** A pet, about a third of a tile tall, with a `bob` for walking. */
export class Pet {
  readonly root = new Model();
  private readonly body = this.root.part();
  private readonly tail?: THREE.Object3D;
  moving = false;

  constructor(
    readonly kind: PetKind,
    color: string,
  ) {
    const b = this.body;
    const eye = (at: V3) => b.ball(0.02, "#2b2433", at, [1, 1.2, 0.5], 8);
    switch (kind) {
      case "cat": {
        b.box([0.18, 0.13, 0.3], color, [0, 0.06, -0.03], 0.06);
        for (const [x, z] of [
          [-0.06, 0.08],
          [0.06, 0.08],
          [-0.06, -0.12],
          [0.06, -0.12],
        ] as const)
          b.box([0.05, 0.08, 0.05], color, [x, 0, z], 0.02);
        b.ball(0.12, color, [0, 0.25, 0.13], [1.1, 0.95, 1]);
        for (const s of [-1, 1]) {
          b.cyl(0.04, 0.08, color, [s * 0.07, 0.33, 0.12], 0.003, 4).rotation.z = -s * 0.25;
          eye([s * 0.045, 0.26, 0.24]);
        }
        b.ball(0.015, "#f28bb2", [0, 0.22, 0.25]);
        const tail = b.part([0, 0.16, -0.17]);
        tail.cyl(0.025, 0.24, color, [0, 0, 0], 0.02, 6).rotation.x = -0.5;
        this.tail = tail;
        break;
      }
      case "dog": {
        b.box([0.2, 0.15, 0.34], color, [0, 0.08, -0.03], 0.07);
        for (const [x, z] of [
          [-0.06, 0.1],
          [0.06, 0.1],
          [-0.06, -0.13],
          [0.06, -0.13],
        ] as const)
          b.box([0.06, 0.1, 0.06], color, [x, 0, z], 0.025);
        b.ball(0.13, color, [0, 0.29, 0.15]);
        b.box([0.11, 0.08, 0.1], tint(color, 0.3), [0, 0.22, 0.26], 0.04);
        b.ball(0.025, "#2b2433", [0, 0.29, 0.31]);
        for (const s of [-1, 1]) {
          b.box([0.05, 0.13, 0.06], tint(color, -0.3), [s * 0.13, 0.22, 0.13], 0.025).rotation.z = s * 0.2;
          eye([s * 0.05, 0.32, 0.26]);
        }
        const tail = b.part([0, 0.2, -0.19]);
        tail.cyl(0.025, 0.14, color, [0, 0, 0], 0.015, 6).rotation.x = -0.9;
        this.tail = tail;
        break;
      }
      case "duck":
        b.ball(0.15, color, [0, 0.13, 0], [1, 0.85, 1.2]);
        b.ball(0.1, color, [0, 0.31, 0.08]);
        b.box([0.09, 0.03, 0.08], "#f08a2c", [0, 0.28, 0.18], 0.012);
        b.ball(0.07, tint(color, -0.08), [0, 0.18, -0.15], [1, 0.6, 1]);
        for (const s of [-1, 1]) {
          eye([s * 0.045, 0.34, 0.16]);
          b.box([0.05, 0.02, 0.07], "#f08a2c", [s * 0.05, 0, 0.03], 0.008);
        }
        break;
    }
  }

  update(t: number): void {
    const b = this.body;
    b.position.y = this.moving ? Math.abs(Math.sin(t * 14)) * 0.04 : 0;
    b.rotation.z = this.moving ? Math.sin(t * 14) * 0.06 : 0;
    if (this.tail) this.tail.rotation.y = Math.sin(t * (this.moving ? 12 : 3)) * 0.5;
  }
}
