import { type FestiveId, type FestiveNpc, festiveNpcOf } from "@tokenmaxxing/core/festive.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { festiveNow } from "../../game/festive.ts";
import { disposeObject } from "../engine/dispose.ts";
import { gerdaModel } from "./halloween3d-models.ts";

/**
 * The 3D models of the festive NPCs (`FESTIVE_NPC`, `core/src/festive.ts`). A theme's agent adds its builder here: it
 * returns a group standing on y = 0 at the origin, facing +z, about 1.7 units tall (build it with `Model` as
 * `pumpkins3d.ts` does, `mergeStill` the still parts). Put `group.userData.tick = (t: number) => ...` on it for an
 * idle animation. No entry, nothing is shown (the 2D sprite and the dialogue still work).
 */
export type NpcModel = (npc: FestiveNpc) => THREE.Object3D;

export const NPC_MODELS: Partial<Record<FestiveId, NpcModel>> = {
  halloween: gerdaModel,
};

const TURN: Record<Facing, number> = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };

/**
 * Spawns and despawns the theme's NPC in the 3D town. Built lazily the first frame its theme is on (not in the
 * constructor), taken down (geometry and all) when the theme ends or changes while the page stays open. Not
 * pickable and not a block, like the other props; E on its tile talks (`game/festive-npc.ts`).
 */
export class FestiveNpc3d {
  readonly group = new THREE.Group();
  private shown: { id: FestiveId; npc: FestiveNpc; root: THREE.Object3D } | null = null;

  constructor(private readonly toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.name = "festive-npc";
    // Built after the town is batched: `live` keeps the batching from putting the empty group to sleep (hidden, matrices frozen).
    this.group.userData.live = true;
    this.group.userData.nobatch = true;
  }

  update(t: number): void {
    const f = festiveNow();
    const npc = festiveNpcOf(f);
    const id = f?.id;
    if (this.shown && (this.shown.id !== id || this.shown.npc !== npc)) this.clear();
    if (!this.shown && id && npc) this.build(id, npc);
    const root = this.shown?.root;
    (root?.userData.tick as ((t: number) => void) | undefined)?.(t);
  }

  private build(id: FestiveId, npc: FestiveNpc): void {
    const make = NPC_MODELS[id];
    if (!make) return;
    const root = make(npc);
    const [x, z] = this.toWorld(npc.x, npc.y);
    root.position.set(x, 0, z);
    root.rotation.y = TURN[npc.facing];
    root.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.group.add(root);
    this.shown = { id, npc, root };
  }

  private clear(): void {
    if (this.shown) {
      this.group.remove(this.shown.root);
      disposeObject(this.shown.root);
    }
    this.shown = null;
  }

  dispose(): void {
    this.clear();
  }
}
