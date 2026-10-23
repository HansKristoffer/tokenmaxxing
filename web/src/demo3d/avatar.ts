/**
 * Characters: a big round head on a small body, in the game's skins, hairs and outfits
 * (`web/src/art/palette.ts`), so every look a player has today has a 3D twin. Pets are built the same way.
 */
import * as THREE from "three";
import { HAIRS, OUTFITS, PANTS, SKINS } from "../art/palette.ts";
import { Model, tint, toon, type V3 } from "./kit.ts";

export type Hat = "none" | "cap" | "beanie" | "headphones" | "crown";
export interface Look {
  skin: string;
  hair: string;
  /** 0 short, 1 spiky, 2 bob, 3 bun, 4 ponytail. */
  style: number;
  outfit: [string, string];
  pants: string;
  hat: Hat;
  /** Extra cosmetics (`gear3d.ts`: `lookFrom2D` fills this in); the base look draws without it. */
  gear?: Gear;
}

/** What `gear3d.ts` adds to an avatar: built once the body exists, then moved every frame. */
export interface Gear {
  dress(a: Avatar): void;
  update?(a: Avatar, dt: number, t: number): void;
}

export const HATS: readonly Hat[] = ["none", "cap", "beanie", "headphones", "crown"];

export function randomLook(rnd = Math.random): Look {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const outfit = Math.floor(rnd() * OUTFITS.length);
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    style: Math.floor(rnd() * 5),
    outfit: OUTFITS[outfit]!,
    pants: PANTS[outfit] ?? PANTS[0]!,
    hat: rnd() < 0.55 ? "none" : pick(HATS.slice(1)),
  };
}

export type Pose = "stand" | "walk" | "sit" | "type" | "sleep" | "wave" | "dance" | "dj";

export type Expression = "neutral" | "happy" | "laugh" | "surprised" | "love" | "wink" | "focus" | "sleep";
/** What's drawn: an expression, or a frame of one (mid-blink, mid-word). */
type Face = Expression | "blink" | "talk";

const INK = "#2b2433";
/** Draws a face on a 256×128 canvas, as it wraps the front of the head: eyes, brows, mouth, blush. */
function drawFace(g: CanvasRenderingContext2D, face: Face): void {
  const [lx, rx, ey, my] = [92, 164, 66, 96];
  g.lineCap = g.lineJoin = "round";
  // Blush.
  g.fillStyle = "rgba(242, 120, 160, 0.45)";
  for (const x of [lx - 26, rx + 26]) {
    g.beginPath();
    g.ellipse(x, ey + 22, 13, 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  const eye = (x: number, big = 1) => {
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(x, ey, 12 * big, 18 * big, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5a4a7a";
    g.beginPath();
    g.ellipse(x, ey + 7 * big, 9 * big, 9 * big, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(x + 5 * big, ey - 7 * big, 5.5 * big, 0, Math.PI * 2);
    g.arc(x - 3 * big, ey + 6 * big, 2 * big, 0, Math.PI * 2);
    g.fill();
  };
  const arc = (x: number, up: boolean) => {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    if (up) g.arc(x, ey + 6, 11, Math.PI * 1.15, Math.PI * 1.85);
    else g.arc(x, ey - 6, 11, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  };
  const brows = (lift: number, tilt = 0) => {
    g.strokeStyle = tint(INK, 0.15);
    g.lineWidth = 4;
    for (const [x, s] of [
      [lx, -1],
      [rx, 1],
    ] as const) {
      g.beginPath();
      g.moveTo(x - 10, ey - 24 - lift + s * tilt);
      g.lineTo(x + 10, ey - 24 - lift - s * tilt);
      g.stroke();
    }
  };
  const heart = (x: number) => {
    g.fillStyle = "#ff4f8b";
    g.beginPath();
    g.moveTo(x, ey + 12);
    g.bezierCurveTo(x - 18, ey, x - 12, ey - 16, x, ey - 6);
    g.bezierCurveTo(x + 12, ey - 16, x + 18, ey, x, ey + 12);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(x + 5, ey - 5, 2.5, 0, Math.PI * 2);
    g.fill();
  };
  const smile = (w: number, open = false) => {
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    if (open) {
      g.fillStyle = "#7a2a3a";
      g.moveTo(128 - w, my - 2);
      g.quadraticCurveTo(128, my + w * 1.6, 128 + w, my - 2);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#ff8a9a";
      g.beginPath();
      g.ellipse(128, my + w * 0.55, w * 0.45, w * 0.25, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.arc(128, my - w * 0.6, w, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
    }
  };
  const flat = (w: number) => {
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(128 - w, my);
    g.lineTo(128 + w, my);
    g.stroke();
  };
  const oh = (r: number) => {
    g.fillStyle = "#7a2a3a";
    g.strokeStyle = INK;
    g.lineWidth = 3.5;
    g.beginPath();
    g.ellipse(128, my + 2, r * 0.8, r, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };
  switch (face) {
    case "neutral":
      brows(0);
      eye(lx);
      eye(rx);
      smile(9);
      break;
    case "talk":
      brows(1);
      eye(lx);
      eye(rx);
      oh(7);
      break;
    case "blink":
      brows(0);
      arc(lx, false);
      arc(rx, false);
      smile(9);
      break;
    case "happy":
      brows(3);
      arc(lx, true);
      arc(rx, true);
      smile(12, true);
      break;
    case "laugh":
      brows(5, -2);
      for (const [x, s] of [
        [lx, 1],
        [rx, -1],
      ] as const) {
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x - 9 * s, ey - 10);
        g.lineTo(x + 7 * s, ey);
        g.lineTo(x - 9 * s, ey + 10);
        g.stroke();
      }
      smile(17, true);
      break;
    case "surprised":
      brows(9);
      eye(lx, 1.2);
      eye(rx, 1.2);
      oh(9);
      break;
    case "love":
      brows(3);
      heart(lx);
      heart(rx);
      smile(11, true);
      break;
    case "wink":
      brows(2, 2);
      eye(lx);
      arc(rx, true);
      smile(12);
      break;
    case "focus":
      brows(-2, 3);
      eye(lx, 0.85);
      eye(rx, 0.85);
      // Lids halfway down.
      g.strokeStyle = INK;
      g.lineWidth = 4;
      for (const x of [lx, rx]) {
        g.beginPath();
        g.moveTo(x - 12, ey - 4);
        g.lineTo(x + 12, ey - 4);
        g.stroke();
      }
      flat(7);
      break;
    case "sleep":
      arc(lx, false);
      arc(rx, false);
      oh(4);
      break;
  }
}

const faces = new Map<Face, THREE.CanvasTexture>();
function faceTexture(face: Face): THREE.CanvasTexture {
  let t = faces.get(face);
  if (!t) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext("2d")!;
    // Drawn a third bigger than laid out, and a touch low: big chibi eyes.
    g.translate(128, 70);
    g.scale(1.35, 1.35);
    g.translate(-128, -64);
    drawFace(g, face);
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    faces.set(face, t);
  }
  return t;
}

/** The front of a sphere, `r` across, for a face to be painted on. */
const FACE_GEOMETRY = new THREE.SphereGeometry(1, 32, 16, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.75, 1.5);

const HEAD_R = 0.25;
const HIP = 0.24;
const NECK = 0.52;

/** Hair: a cap over the head, then the style's own pieces. */
function hair(head: Model, look: Look): void {
  const c = look.hair;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R * 1.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    toon(c),
  );
  cap.rotation.x = -0.62;
  cap.castShadow = true;
  head.add(cap);
  // A fringe over the forehead.
  head.ball(0.09, c, [-0.08, 0.17, 0.15], [1.3, 0.45, 0.7], 10);
  head.ball(0.08, c, [0.09, 0.18, 0.15], [1.2, 0.4, 0.7], 10);
  switch (look.style) {
    case 1:
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        const spike = head.cyl(
          0.07,
          0.16,
          c,
          [Math.sin(a) * 0.12, 0.2, -0.03 + Math.cos(a) * 0.02],
          0.005,
          6,
        );
        spike.rotation.set(-0.5, 0, -a * 0.8);
      }
      break;
    case 2:
      head.box([0.54, 0.34, 0.3], c, [0, -0.2, -0.08], 0.12);
      break;
    case 3:
      head.ball(0.12, c, [0, 0.27, -0.1]);
      break;
    case 4: {
      head.ball(0.08, c, [0, 0.12, -0.26]);
      const tail = head.cyl(0.07, 0.3, c, [0, -0.2, -0.3], 0.04, 8);
      tail.rotation.x = 0.2;
      break;
    }
  }
}

function hat(head: Model, look: Look): void {
  const [main, dark] = look.outfit;
  switch (look.hat) {
    case "cap": {
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(HEAD_R * 1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        toon(main),
      );
      crown.castShadow = true;
      crown.position.y = 0.03;
      head.add(crown);
      head.box([0.34, 0.025, 0.2], dark, [0, 0.12, 0.24], 0.01).rotation.x = -0.12;
      head.ball(0.025, dark, [0, 0.3, 0]);
      break;
    }
    case "beanie":
      head.ball(HEAD_R * 1.1, "#e25d5d", [0, 0.08, -0.01], [1, 0.75, 1]);
      head.cyl(HEAD_R * 1.08, 0.08, "#b8443f", [0, 0.05, -0.01], HEAD_R * 1.08, 18);
      head.ball(0.06, C_WHITE, [0, 0.3, -0.02]);
      break;
    case "headphones": {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(HEAD_R * 1.12, 0.022, 6, 20, Math.PI),
        toon("#2b2433"),
      );
      band.castShadow = true;
      head.add(band);
      for (const s of [-1, 1]) {
        const cup = head.cyl(0.07, 0.07, "#2b2433", [s * 0.27, -0.02, 0], 0.07, 12);
        cup.rotation.z = (s * Math.PI) / 2;
        head.ball(0.045, "#3ddc84", [s * 0.31, -0.02, 0], [0.4, 1, 1]);
      }
      break;
    }
    case "crown": {
      head.cyl(0.13, 0.08, "#e9b73d", [0, 0.24, 0], 0.15, 10);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        head.cyl(0.03, 0.08, "#e9b73d", [Math.sin(a) * 0.13, 0.31, Math.cos(a) * 0.13], 0.002, 5);
      }
      head.ball(0.025, "#e25d5d", [0, 0.29, 0.15]);
      break;
    }
    case "none":
      break;
  }
}

const C_WHITE = "#fbf7ef";

export class Avatar {
  readonly root = new Model();
  readonly body = this.root.part();
  readonly head: Model;
  private readonly face: THREE.MeshToonMaterial;
  /** How they look; a blink or a word passes over it for a moment. */
  expression: Expression = "neutral";
  /** Talking: the mouth opens and shuts. */
  talking = false;
  readonly arms: Model[] = [];
  readonly legs: Model[] = [];
  pose: Pose = "stand";
  /** Seconds into the walk cycle. */
  private phase = Math.random() * 10;
  private blinkAt = Math.random() * 4;

  constructor(readonly look: Look) {
    const { skin } = look;
    const [main, dark] = look.outfit;
    const b = this.body;

    for (const s of [-1, 1]) {
      const leg = b.part([s * 0.075, HIP, 0]);
      leg.box([0.11, HIP - 0.04, 0.12], look.pants, [0, -HIP + 0.04, 0], 0.04);
      leg.box([0.12, 0.07, 0.17], "#2b2433", [0, -HIP, 0.025], 0.03);
      this.legs.push(leg);
    }
    b.box([0.3, 0.26, 0.2], main, [0, HIP - 0.02, 0], 0.08);
    b.box([0.31, 0.05, 0.21], dark, [0, HIP - 0.02, 0], 0.025);
    b.ball(0.06, dark, [0, NECK - 0.05, 0.06], [1.6, 0.5, 0.8]);
    for (const s of [-1, 1]) {
      const arm = b.part([s * 0.18, NECK - 0.07, 0]);
      const sleeve = arm.box([0.085, 0.16, 0.09], main, [0, -0.16, 0], 0.04);
      sleeve.rotation.z = s * 0.08;
      arm.ball(0.05, skin, [s * 0.012, -0.19, 0]);
      this.arms.push(arm);
    }

    const head = b.part([0, NECK, 0]);
    this.head = head;
    const skull = head.ball(HEAD_R, skin, [0, HEAD_R * 0.86, 0], [1.05, 0.95, 1], 24);
    this.face = new THREE.MeshToonMaterial({
      map: faceTexture("neutral"),
      transparent: true,
      depthWrite: false,
      gradientMap: toon(skin).gradientMap,
    });
    const face = new THREE.Mesh(FACE_GEOMETRY, this.face);
    face.scale.setScalar(HEAD_R * 1.008);
    // Tipped down a little, so the eyes sit low and big under the fringe, as chibis' do.
    face.rotation.x = 0.26;
    skull.add(face);
    const hairs = head.part([0, HEAD_R * 0.86, 0]);
    hair(hairs, look);
    hat(hairs, look);
    look.gear?.dress(this);
  }

  /** Moves the limbs for `pose`, `dt` seconds after the last frame. */
  update(dt: number, t: number): void {
    this.phase += dt;
    const [legL, legR] = this.legs as [Model, Model];
    const [armL, armR] = this.arms as [Model, Model];
    const b = this.body;
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    b.scale.set(1, 1, 1);
    this.head.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    armL.rotation.set(0, 0, 0);
    armR.rotation.set(0, 0, 0);

    switch (this.pose) {
      case "walk": {
        const s = Math.sin(this.phase * 11);
        legL.rotation.x = s * 0.6;
        legR.rotation.x = -s * 0.6;
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
        b.position.set(0, 0.06, 0.32);
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
    const map = faceTexture(face);
    if (this.face.map !== map) this.face.map = map;
    this.look.gear?.update?.(this, dt, t);
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
