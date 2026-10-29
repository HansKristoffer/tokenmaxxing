// Browser harness for the prestige 3D showcase: the real avatars, wearing each track's set, on a WebGL canvas.
// Optional pieces (pet wear, home trophies) come from ./optional.ts, which shots.mjs generates.
import * as THREE from "three";
import { PRESTIGE_ITEMS, PRESTIGE_TRACKS } from "../../../core/src/prestige.ts";
import { setSmoothBands } from "../../../web/src/render3d/kit/kit.ts";
import { avatarFor } from "../../../web/src/render3d/people/gear3d.ts";
import "../../../web/src/render3d/people/gear3dPrestige.ts";
import { view } from "../../../web/src/render3d/perf/freeze.ts";
import { petFrom2D } from "../../../web/src/render3d/pets/pets3d.ts";
import { optionalPetwear, optionalTrophy } from "./optional.ts";

view.sees = () => true;
void PRESTIGE_ITEMS;

const CW = 300;
const CH = 400;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setScissorTest(true);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#2a2733");
scene.add(new THREE.AmbientLight("#ffffff", 0.9));
const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
sun.position.set(2, 4, 3);
const fill = new THREE.DirectionalLight("#9ec4ff", 0.5);
fill.position.set(-3, 2, -2);
scene.add(sun, fill);
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(0.7, 32),
  new THREE.MeshBasicMaterial({ color: "#3b3747" }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

function sheet(id: string, cols: number, rows: number) {
  const c = document.createElement("canvas");
  c.id = `sheet-${id}`;
  c.width = cols * CW;
  c.height = rows * CH;
  document.body.append(c);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a2733";
  ctx.fillRect(0, 0, c.width, c.height);
  return {
    ctx,
    draw(col: number, row: number, label: string, cam: THREE.PerspectiveCamera) {
      renderer.setSize(CW, CH, false);
      renderer.setViewport(0, 0, CW, CH);
      renderer.setScissor(0, 0, CW, CH);
      renderer.render(scene, cam);
      ctx.drawImage(renderer.domElement, col * CW, row * CH, CW, CH);
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      ctx.fillText(label, col * CW + 8, row * CH + 18);
    },
  };
}

const camFor = (h: number, dist = 1) => {
  const cam = new THREE.PerspectiveCamera(30, CW / CH, 0.05, 50);
  cam.position.set(0, h * 0.55, h * 2.9 * dist);
  cam.lookAt(0, h * 0.5, 0);
  return cam;
};

function sceneIdle(f: () => void) {
  try {
    f();
  } catch (e) {
    console.error(String((e as Error).stack ?? e));
  }
}

// People: per track, rows = smooth / voxel, columns = front and back at three animation moments.
for (const t of PRESTIGE_TRACKS) {
  const idx = 700 + t.rank - 1;
  const s = sheet(`track${t.rank}-${t.key}`, 6, 2);
  (["grown", "voxel"] as const).forEach((style, row) => {
    sceneIdle(() => {
      setSmoothBands(style === "voxel");
      const look = { style: 0, skin: 1, hair: 2, outfit: idx, hat: idx, back: idx, aura: idx };
      const av = avatarFor(look, undefined, style);
      scene.add(av.root);
      const cam = camFor(av.height + 0.2);
      let now = 0;
      const step = (to: number) => {
        for (; now < to; now += 1 / 30) av.update(1 / 30, now);
      };
      [0.5, 1.4, 2.6].forEach((time, k) => {
        step(time);
        [0, Math.PI].forEach((turn, a) => {
          av.root.rotation.y = turn;
          s.draw(
            k * 2 + a,
            row,
            `${t.name} ${style === "voxel" ? "voxel" : "smooth"} ${a ? "back" : "front"} t=${time}`,
            cam,
          );
        });
      });
      scene.remove(av.root);
      av.dispose();
    });
  });
}

// Pets in each pet-wear.
{
  const s = sheet("pets", 5, 2);
  PRESTIGE_TRACKS.forEach((t, col) => {
    sceneIdle(() => {
      setSmoothBands(false);
      [2, 3].forEach((species, row) => {
        const pet = petFrom2D(species);
        scene.add(pet.root);
        pet.update(1 / 30, 0);
        // Not wired into Pet3D yet: hang it on the rig's head by hand, at its top or neck anchor.
        const rig = (pet as unknown as { rig: { head: THREE.Object3D; top: number[]; neck: number[] } }).rig;
        const wear = optionalPetwear(t.rank, 0.09);
        if (wear) {
          const at = wear.userData.at === "top" ? rig.top : rig.neck;
          wear.position.set(at[0]!, at[1]!, at[2]!);
          rig.head.add(wear);
        }
        const cam = camFor(0.45, 0.9);
        cam.position.set(1.0, 0.8, 2.0);
        cam.lookAt(0, 0.4, 0);
        for (let i = 0; i < 30; i++) {
          pet.update(1 / 30, i / 30);
          wear?.userData.tick?.(i / 30);
        }
        s.draw(col, row, `${t.petwear.name}${wear ? "" : " (stub)"}`, cam);
        scene.remove(pet.root);
      });
    });
  });
}

// Home trophies.
{
  const s = sheet("trophies", 5, 1);
  PRESTIGE_TRACKS.forEach((t, col) => {
    sceneIdle(() => {
      setSmoothBands(false);
      const m = optionalTrophy(t.rank);
      if (!m) return;
      scene.add(m);
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      const h = Math.max(size.y, size.x, 0.3);
      const cam = camFor(h, 1);
      cam.position.set(h * 1.2, h * 1.1, h * 2.2);
      cam.lookAt(0, h * 0.4, 0);
      for (let i = 0; i < 20; i++) (m as unknown as { tick?: (t: number) => void }).tick?.(i / 30);
      s.draw(col, 0, t.trophy.name, cam);
      scene.remove(m);
    });
  });
}
document.title = "ready";
