import * as THREE from "three";
import { loadSlices } from "../kit/registry.ts";
import type { MapId } from "../rooms/world.ts";
import { World } from "../rooms/world.ts";
import { loadRoomSkins } from "../rooms/world-rooms.ts";
import { bakeStatic, freezeLayer } from "./bake.ts";
import { sceneStats } from "./stats.ts";

/** Registers every slice's tiles, as the game does at start. */
export async function loadAllSlices(): Promise<void> {
  await loadSlices();
  await loadRoomSkins();
}

export interface RoomCost {
  drawCalls: number;
  triangles: number;
  materials: number;
  textureMB: number;
  /** Canvas textures a room holds (after atlasing) and its largest edge in pixels. */
  textures: number;
  biggest: number;
}

const world = () => ((globalThis as { __perfWorld?: World }).__perfWorld ??= new World());

/** Builds a room with no renderer and counts what one pass over it would draw once batched. */
export function measureRoom(id: string): RoomCost {
  const room = world().room(id as MapId);
  const scene = new THREE.Scene();
  scene.add(room.group);
  const before = sceneStats(scene);
  const layer = bakeStatic(room.group);
  if (layer) layer.show("smooth");
  // People and pets that stand about are merged at run time (see `freeze.ts`): count them as the player sees them.
  const actors: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.actor) actors.push(o);
  });
  for (const a of actors) freezeLayer(a);
  const after = sceneStats(scene);
  let texBytes = 0;
  let biggest = 0;
  const seen = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const v of (Array.isArray(m) ? m : [m]).flatMap((x) => Object.values(x ?? {}))) {
      const t = v as THREE.Texture;
      const img = t?.isTexture ? (t.image as { width?: number; height?: number } | null) : null;
      if (!img || seen.has(t)) continue;
      seen.add(t);
      biggest = Math.max(biggest, img.width ?? 0, img.height ?? 0);
      if (t.mipmaps.length > 0) {
        for (const mip of t.mipmaps) {
          if ("width" in mip && "height" in mip) texBytes += mip.width * mip.height * 4;
        }
      } else texBytes += (img.width ?? 0) * (img.height ?? 0) * 4 * (t.generateMipmaps ? 1.34 : 1);
    }
  });
  void before;
  return {
    drawCalls: after.drawables,
    triangles: Math.round(after.triangles),
    materials: after.materials,
    textureMB: Math.round((texBytes / 1048576) * 10) / 10,
    textures: seen.size,
    biggest,
  };
}
