import { type FestiveId, type FestiveNpc, festiveNpcOf } from "@tokenmaxxing/core/festive.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { festiveNow } from "../../game/festive.ts";
import { disposeObject } from "../engine/dispose.ts";
import { gerdaModel } from "./halloween3d-models.ts";
import { knudModel } from "./christmas3d.ts";
import { baltalerModel } from "./midsommer3d.ts";
import { nytarNpcModel } from "./nytar3d.ts";
import { gudrun3d } from "./paaske-npc3d.ts";
import { pakBudiModel } from "./agustusan-npc3d.ts";

/**
 * The 3D models of the festive NPCs (`FESTIVE_NPC`, `core/src/festive.ts`). A theme's agent adds its builder here: it
 * returns a group standing on y = 0 at the origin, facing +z, about 1.7 units tall (build it with `Model` as
 * `pumpkins3d.ts` does, `mergeStill` the still parts). Put `group.userData.tick = (t: number) => ...` on it for an
 * idle animation. No entry, nothing is shown (the 2D sprite and the dialogue still work).
 */
export type NpcModel = (npc: FestiveNpc) => THREE.Object3D;

export const NPC_MODELS: Partial<Record<FestiveId, NpcModel>> = {
  halloween: gerdaModel,
  christmas: knudModel,
  sanktHans: baltalerModel,
  nytar: nytarNpcModel,
  paaske: gudrun3d,
  // Henning is built with the memorial (`befrielsen3d.ts`) and drawn there, so this stays empty.
  befrielsen: () => new THREE.Group(),
  agustusan: pakBudiModel,
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
    // Empty at first, so the room's bake would put it to sleep (hidden, its matrices frozen): it must stay awake for its NPC.
    this.group.userData.noBake = true;
    // Empty at first: the room's batching would hide and sleep an empty subtree for good, so it is marked live.
    // Built after the town is baked, and rebuilt as themes come and go: the bake must not put it to sleep.
    this.group.userData.live = true;
    // Empty when the room is baked, it would be put to sleep (hidden, its matrices frozen) as a quiet group.
    this.group.userData.noBake = true;
  }

  update(t: number): void {
    const f = festiveNow();
    const npc = festiveNpcOf(f);
    const id = f?.id;
    if (this.shown && (this.shown.id !== id || this.shown.npc !== npc)) this.clear();
    if (!this.shown && id && npc) this.build(id, npc);
    // The room hides what it did not build itself: a built NPC shows its own group.
    this.group.visible = this.shown !== null;
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
