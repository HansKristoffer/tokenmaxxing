import { doorSteps } from "@tokenmaxxing/core/halloween.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import {
  batAt,
  batCount,
  CANDY_SPOTS,
  CAULDRON,
  EXTRA_STONES,
  GERDA,
  GERDA_TILE,
  ghostAt,
  HAUNTS,
} from "@tokenmaxxing/core/spooky.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { festiveNow } from "../../game/festive.ts";
import { talkToFestiveNpc } from "../../game/festive-npc.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Model } from "../kit/kit.ts";
import type { Sign } from "../rooms/rooms.ts";
import {
  type BatRig,
  batModel,
  type CauldronRig,
  candyInto,
  cauldronModel,
  cobwebMaterial,
  extraStoneModel,
  type GhostRig,
  ghostModel,
} from "./halloween3d-models.ts";

/** Bats at the peak. */
const MAX_BATS = 8;

/** Where the doors' cobwebs hang, from the door's middle: out to the side, up, and out from the wall. */
const WEB = { dx: 0.5, y: 2.05, dz: 0.3, size: 0.55 } as const;

interface Built {
  root: THREE.Group;
  bats: BatRig[];
  ghosts: { rig: GhostRig; i: number }[];
  cauldron: CauldronRig;
}

/**
 * Halloween's spooky night in the 3D town (the 2D one is `game/spooky.ts`, over `core/src/spooky.ts`): bats around the
 * Tavern and the windmill, ghosts that drift and shy away from you, cobwebs at the doors, the cauldron, the lawn's
 * extra tombstones and sweets. Built lazily the first frame the festive theme is Halloween,
 * taken down (geometry and all) when it ends while the page stays open. Scenery: nothing is pickable, and Gerda's
 * tile and the cauldron block through the input (`blocksSpooky`).
 */
export class HalloweenTown3d {
  readonly group = new THREE.Group();
  private built: Built | null = null;
  private readonly origin: [number, number];

  constructor(
    private readonly map: GameMap,
    private readonly toWorld: (tx: number, ty: number) => [number, number],
  ) {
    this.group.name = "halloween";
    // Built after the town is batched (an empty group would be put to sleep, hidden and all): the batching leaves it alone.
    this.group.userData.live = true;
    this.group.userData.nobatch = true;
    const [x, z] = toWorld(0, 0);
    // Tile coordinates with a fraction (the left edge of tile 0 is its middle less a half).
    this.origin = [x - 0.5, z - 0.5];
  }

  private at(x: number, y: number): [number, number] {
    return [this.origin[0] + x, this.origin[1] + y];
  }

  update(t: number, me: readonly [number, number] | null): void {
    const on = festiveNow()?.id === "halloween";
    if (on && !this.built) this.build();
    if (!on && this.built) this.teardown();
    // Shown or hidden with the theme, like the pumpkins.
    this.group.visible = on;
    const b = this.built;
    if (!b) return;
    const intensity = festiveNow()?.intensity ?? 0.5;

    const n = Math.min(MAX_BATS, batCount(intensity));
    b.bats.forEach((bat, i) => {
      bat.root.visible = i < n;
      if (i >= n) return;
      const p = batAt(i, t);
      const q = batAt(i, t + 0.1);
      const [x, z] = this.at(p.x, p.y);
      bat.root.position.set(x, p.h, z);
      bat.root.rotation.y = Math.atan2(q.x - p.x, q.y - p.y);
      bat.root.rotation.z = Math.sin(t * 0.7 + i) * 0.15;
      const w = Math.sin(p.flap) * 0.75;
      bat.wings[0].rotation.z = -w;
      bat.wings[1].rotation.z = w;
    });

    for (const { rig, i } of b.ghosts) {
      const h = HAUNTS[i]!;
      const p = ghostAt(h, t);
      const q = ghostAt(h, t + 0.1);
      const [x, z] = this.at(p.x + 0.5, p.y + 0.5);
      rig.root.position.set(x, p.lift, z);
      rig.root.rotation.y = Math.atan2(q.x - p.x, q.y - p.y);
      // Shy: see-through, then gone, as you come within a tile and a half.
      const d = me ? Math.hypot(me[0] - x, me[1] - z) : 9;
      const shy = Math.min(1, Math.max(0, (d - 1) / 1.5));
      rig.root.visible = shy > 0.02;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2 + i);
      (rig.mats[0] as THREE.MeshToonMaterial).opacity = 0.68 * pulse * shy;
      (rig.mats[1] as THREE.MeshBasicMaterial).opacity = 0.28 * pulse * shy;
      (rig.mats[2] as THREE.MeshBasicMaterial).opacity = 0.85 * shy;
    }

    b.cauldron.bubbles.forEach((m, i) => {
      const k = (t * 0.7 + i * 0.27) % 1;
      m.position.set(Math.sin(i * 2.4) * 0.16, 0.74 + k * 0.28, Math.cos(i * 2.4) * 0.16);
      m.scale.setScalar(Math.max(0.05, 1 - k * k));
    });
    b.cauldron.flames.forEach((m, i) => {
      m.scale.set(1, 0.8 + Math.abs(Math.sin(t * 7 + i * 2)) * 0.5, 1);
    });
  }

  /** Gerda's name over her, a button for E (`NPC_MODELS` draws her; this is the label). */
  signs(): Sign[] {
    if (!this.built) return [];
    const [x, z] = this.toWorld(GERDA_TILE.x, GERDA_TILE.y);
    return [{ key: "gerda", at: [x, 1.95, z], kind: "label", text: GERDA.name, onClick: talkToFestiveNpc }];
  }

  private build(): void {
    const root = new THREE.Group();
    const still = new Model();

    for (const s of EXTRA_STONES) {
      const m = extraStoneModel(s.kind, s.text);
      const [x, z] = this.toWorld(s.x, s.y);
      m.position.set(x, 0, z);
      m.rotation.y = ((s.x * 7 + s.y) % 5) * 0.05 - 0.1;
      still.add(m);
    }

    for (const [i, c] of CANDY_SPOTS.entries()) {
      const [x, z] = this.at(c.x, c.y);
      candyInto(still, c.c, [x, 0, z], i * 1.7);
    }
    root.add(still);
    mergeStill(still);

    // Cobwebs in both top corners of every door, one merged mesh.
    const webs: THREE.BufferGeometry[] = [];
    for (const { door } of doorSteps(this.map)) {
      const [x, z] = this.toWorld(door[0], door[1]);
      for (const side of [-1, 1]) {
        // The web hangs from the corner: its middle is half its size in and down from it.
        const g = new THREE.PlaneGeometry(WEB.size, WEB.size);
        if (side > 0) g.scale(-1, 1, 1);
        g.translate(x + side * (WEB.dx - WEB.size / 2), WEB.y - WEB.size / 2, z + WEB.dz);
        webs.push(g);
      }
    }
    const webMesh = webs.length ? new THREE.Mesh(mergeGeometries(webs), cobwebMaterial()) : null;
    for (const g of webs) g.dispose();
    if (webMesh) {
      webMesh.userData.live = true;
      root.add(webMesh);
    }

    const cauldron = cauldronModel();
    const [cx, cz] = this.toWorld(CAULDRON.x, CAULDRON.y);
    cauldron.root.position.set(cx, 0, cz);
    root.add(cauldron.root);

    const bats = Array.from({ length: MAX_BATS }, () => {
      const b = batModel();
      root.add(b.root);
      return b;
    });
    const ghosts = HAUNTS.map((h, i) => {
      const rig = ghostModel(h.hue, h.size);
      root.add(rig.root);
      return { rig, i };
    });

    root.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.group.add(root);
    this.built = { root, bats, ghosts, cauldron };
  }

  private teardown(): void {
    if (this.built) {
      this.group.remove(this.built.root);
      disposeObject(this.built.root);
    }
    this.built = null;
  }

  dispose(): void {
    this.teardown();
  }
}
