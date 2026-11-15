import { pieceOf, type Rot, sideways } from "@tokenmaxxing/core/office.ts";
import * as THREE from "three";
import { assetOfChar, turnOfChar } from "../rooms/room-furnished.ts";
import type { RoomView } from "../rooms/rooms.ts";
import type { Asset } from "./furniture.ts";

/** A tile of the room's map, with the piece's own footprint. */
export interface Aim {
  x: number;
  y: number;
}

/** The see-through copy of the piece being placed, with what the aim needs to place it. */
interface Ghost {
  group: THREE.Group;
  material: THREE.MeshBasicMaterial;
  asset: Asset | undefined;
  /** Tiles wide, from the piece's footprint. */
  width: number;
  wall: boolean;
  /** Quarter turns the piece's art is drawn at. */
  artTurn: number;
}

/**
 * Putting a piece of furniture down in your Office: a see-through copy of it follows the pointer over the floor
 * (green where it can go, red where it cannot) and a click picks the tile. What happens then (walking up to the
 * tile, facing it, dropping) is the renderer's, through the same server call the Bag uses.
 */
export class Placer {
  private ghost: Ghost | null = null;
  /** The piece's item id, `furn.<ch>`, while one is being placed. */
  itemId: string | null = null;

  get active(): boolean {
    return this.itemId !== null;
  }

  /** Starts placing `itemId` (`furn.<ch>`) in `scene`; false when no art for it exists to show. */
  begin(itemId: string, scene: THREE.Scene): boolean {
    this.cancel();
    const ch = itemId.startsWith("furn.") ? itemId.slice(5) : null;
    if (!ch) return false;

    const piece = pieceOf(ch);
    const asset = assetOfChar(ch);
    const width = Math.max(1, piece?.w ?? 1);
    const wall = piece?.wall === true;
    const material = new THREE.MeshBasicMaterial({
      color: "#5be08a",
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const group = new THREE.Group();
    group.visible = false;
    group.userData.nopick = true;
    group.userData.live = true;

    const model = asset?.build();
    if (model) {
      // One flat colour over the whole piece (the shape is what matters).
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = material;
          m.castShadow = m.receiveShadow = false;
          m.userData.nopick = true;
        }
      });
      group.add(model);
    } else {
      // A wall piece without art is a flat slab on the wall, anything else a block on the floor.
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.9, wall ? 0.7 : 0.9, wall ? 0.06 : 0.9),
        material,
      );
      box.position.y = wall ? 0 : 0.45;
      group.add(box);
    }

    this.ghost = { group, material, asset, width, wall, artTurn: turnOfChar(ch) };
    this.itemId = itemId;
    scene.add(group);
    return true;
  }

  /**
   * Moves the ghost to the tile under the pointer (null: off the floor). `fits` says whether it can go there,
   * `rot` how far it is turned (quarter turns clockwise): a quarter turn lies it down its column from the aimed tile.
   */
  aim(view: RoomView, tile: Aim | null, fits: boolean, rot: Rot = 0): void {
    const ghost = this.ghost;
    if (!ghost) return;

    ghost.group.visible = tile !== null;
    if (!tile) return;

    const [x, z] = view.toWorld(tile.x, tile.y);
    // The footprint is `width` tiles to the right of the aimed one, centred on the aimed tile's row.
    const w = ghost.asset?.w ?? ghost.width;
    const d = ghost.asset?.d ?? 1;
    // A wall piece hangs on the wall row's inner face at the height the room hangs its own (`Room.hang`).
    const turned = ghost.wall ? 0 : rot;
    if (ghost.wall) ghost.group.position.set(x - 0.5 + w / 2, 0.95, z + 0.51);
    else if (sideways(turned)) ghost.group.position.set(x, 0, z - 0.5 + ghost.width / 2);
    else ghost.group.position.set(x - 0.5 + w / 2, 0, z - 0.5 + d / 2);

    ghost.group.rotation.y = ((ghost.artTurn - turned) * Math.PI) / 2;
    ghost.material.color.set(fits ? "#5be08a" : "#e8584f");
  }

  cancel(): void {
    this.ghost?.group.removeFromParent();
    this.ghost?.material.dispose();
    this.ghost = null;
    this.itemId = null;
  }
}
