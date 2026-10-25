import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { canHang } from "@tokenmaxxing/core/office.ts";
import { type Drop, dropCovers, pieceOfDrop, type RoomId } from "@tokenmaxxing/core/world.ts";

// MARK: Where a piece can stand

/** What the ghost is checked against: the room as the client sees it. */
export interface FitsWorld {
  drops: readonly Drop[];
  /** The map with the furniture on it. */
  map: Pick<GameMap, "walkable" | "kind">;
  /** The map without any, for hanging a poster. */
  base: GameMap;
  people: readonly { x: number; y: number }[];
}

/**
 * Whether a piece (`item`, `furn.<ch>`) can stand with its left end on `t`: bare floor nobody stands on (or the
 * floor the piece being moved, `moving`, stands on), or bare wall for a poster. The server decides in the end
 * (`fitsAt`); this is what the green and the red are.
 */
export function ghostFits(
  w: FitsWorld,
  item: string,
  moving: Drop | null,
  t: { x: number; y: number },
): boolean {
  const piece = pieceOfDrop({ item });
  if (!piece) return false;
  const width = piece.w ?? 1;
  for (let i = 0; i < width; i++) {
    const x = t.x + i;
    if (w.drops.some((o) => o.id !== moving?.id && dropCovers(o, x, t.y))) return false;
    if (piece.wall) continue;
    const own = moving !== null && dropCovers(moving, x, t.y);
    if (!own && (!w.map.walkable(x, t.y) || w.map.kind(x, t.y).portal)) return false;
    for (const a of w.people) if (a.x === x && a.y === t.y) return false;
  }
  return !piece.wall || canHang(w.base, t.x, t.y, width, piece.home);
}

// MARK: Undo

/** What one step of furnishing did, with what is needed to take it back. */
export type Undoable =
  /** Took a piece off the floor: undo puts it down on the same tile (`co`: from the storeroom). */
  | { kind: "take"; room: RoomId; id: number; item: string; x: number; y: number; co?: number }
  /** Moved a piece from `(x, y)`: undo moves it back. */
  | { kind: "move"; room: RoomId; id: number; x: number; y: number }
  /** Put a piece down (`id`): undo takes it back. */
  | { kind: "place"; room: RoomId; id: number; item: string; co?: number };

export const UNDO_DEPTH = 10;

/** The last few furnishing steps of this session, newest last. */
export class UndoStack {
  private steps: Undoable[] = [];

  get size(): number {
    return this.steps.length;
  }

  push(step: Undoable): void {
    this.steps.push(step);
    if (this.steps.length > UNDO_DEPTH) this.steps.shift();
  }

  peek(): Undoable | undefined {
    return this.steps.at(-1);
  }

  pop(): Undoable | undefined {
    return this.steps.pop();
  }

  /** A piece taken and put down again is a new row: the steps that name the old one now mean the new one. */
  remap(from: number, to: number): void {
    this.steps = this.steps.map((s) => (s.id === from ? { ...s, id: to } : s));
  }

  clear(): void {
    this.steps = [];
  }
}
