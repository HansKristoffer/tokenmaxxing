import { unveiling } from "@tokenmaxxing/core/statue.ts";
import * as THREE from "three";
import { plaqueNow, statueNow, statueText } from "../../game/statue.ts";
import { serverNow } from "../../game/world.ts";
import { hud } from "../../store.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Burst } from "../engine/overlay.ts";
import type { LiveFrame } from "../rooms/rooms.ts";
import { drapeModel, STATUE_TOP, statueModel } from "./fx3d-town.ts";

/**
 * The statue of the #1 model in the 3D town (2D: `game/statue.ts`, `art/statue.ts`): a marble figure holding a
 * gold star up, its sash and plaque in the maker's colour, on a stone plinth on the `♛` tile. Until a leader has
 * been read it stands under a velvet drape; when a new one takes the plinth the drape lifts off (`unveiling`)
 * with a burst of confetti. Its sign shows near it, and opens the plaque.
 */

// Reused for every projection, so a frame allocates no vector.
const scratch = new THREE.Vector3();

export class StatueLayer {
  readonly group = new THREE.Group();
  private readonly at: [number, number];
  private readonly root = new THREE.Group();
  private readonly drape = drapeModel();
  private look = "";
  private sign: HTMLDivElement | null = null;
  private signText = "";
  private signBg = "";
  /** The unveiling the confetti was for, so it bursts once. */
  private burstFor = 0;
  private burst: Burst | null = null;

  /** On `tile` (the map's `♛`, if it has one), in world units from `toWorld`. */
  constructor(
    tile: readonly [number, number] | undefined,
    toWorld: (tx: number, ty: number) => [number, number],
  ) {
    this.group.name = "statue";
    this.at = tile ? toWorld(tile[0], tile[1]) : [0, 0];
    this.group.visible = !!tile;
    this.root.position.set(this.at[0], 0, this.at[1]);
    this.drape.position.set(this.at[0], STATUE_TOP, this.at[1]);
    this.drape.userData.live = true;
    this.drape.userData.nopick = true;
    this.group.add(this.root, this.drape);
  }

  update(f: LiveFrame): void {
    if (!this.group.visible) return;
    const statue = statueNow();
    const { sign, accent } = plaqueNow();

    // Built again only when its colour changes, or it gets its first leader.
    const look = `${accent}:${!statue.leader}`;
    if (look !== this.look) {
      this.look = look;
      for (const old of [...this.root.children]) {
        this.root.remove(old);
        disposeObject(old);
      }
      const model = statueModel(accent, !statue.leader);
      mergeStill(model);
      this.root.add(model);
    }

    // `unveil` runs from 0 to 1 while the drape comes off, and is null when there is nothing to lift.
    const unveil = f.calm ? null : unveiling(statue, serverNow());
    this.drape.visible = !statue.leader || unveil !== null;
    if (unveil === null) {
      this.drape.position.y = STATUE_TOP;
      this.drape.scale.setScalar(1);
    } else {
      // Pulled up off the figure, then shrinking away once it's clear.
      this.drape.position.y = STATUE_TOP + unveil * 2.4;
      this.drape.scale.setScalar(1 - unveil * unveil);
      if (this.burstFor !== statue.since) {
        this.burstFor = statue.since;
        this.burst?.dispose();
        this.burst = new Burst(f.overlay, ["🎉", "✨", "🏆"], f.now);
      }
    }

    if (this.burst) {
      const [sx, sy] = f.overlay.project(scratch.set(this.at[0], 2, this.at[1]), f.camera);
      if (!this.burst.step(f.now, sx, sy)) {
        this.burst.dispose();
        this.burst = null;
      }
    }

    if (!this.sign) {
      this.sign = f.overlay.make("r3-sign link");
      this.sign.addEventListener("click", () => hud.set({ dialog: statueText() }));
    }
    if (this.signText !== sign) {
      this.signText = sign;
      this.sign.textContent = sign;
    }
    if (this.signBg !== accent) {
      this.signBg = accent;
      this.sign.style.background = accent;
    }
    f.overlay.place(this.sign, scratch.set(this.at[0], 2.35, this.at[1]), f.camera, 0, 0, true);
  }

  /** The town is kept while you're elsewhere: its sign is a DOM label and would hang over another room. */
  leave(): void {
    if (this.sign) this.sign.style.display = "none";
    this.burst?.dispose();
    this.burst = null;
  }

  dispose(): void {
    this.burst?.dispose();
    this.sign?.remove();
    this.group.removeFromParent();
    disposeObject(this.group);
  }
}
