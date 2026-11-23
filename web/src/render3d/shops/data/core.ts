/**
 * The shop rows' prices, levels and names come from core (the server's own catalogue); the rows here only add what core
 * does not know (the 3D model, the blurb for the room). A row whose id core knows takes core's price, level and name,
 * so a price change in core reaches the shelves, and the buy panel can never ask for coins the server will not take.
 * Ids core does not have (`pet.<n>.<variant>`, the creator's `style.`/`skin.`/`hair.`) are left as written.
 */
import { DECORS } from "@tokenmaxxing/core/decor.ts";
import { DESKS } from "@tokenmaxxing/core/desks.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";

interface Row {
  id: string;
  name: string;
  price: number;
  level?: number;
}

/** The server's row for an id core knows, or undefined when core has no such id. */
function truth(id: string): Row | undefined {
  const decor = /^decor\.(wall|floor)\.(.+)$/.exec(id);
  if (decor) {
    const [, kind, decorId] = decor;
    const found = DECORS[kind as "wall" | "floor"].find((decorRow) => decorRow.id === decorId);
    return found && { id, name: found.name, price: found.price, level: found.level };
  }

  if (id.startsWith("desk.")) {
    const desk = DESKS.find((deskRow) => `desk.${deskRow.id}` === id);
    return desk && { id, name: desk.name, price: desk.price, level: desk.level };
  }

  return itemById(id);
}

/** Takes name, price and level from core for every row core knows, and leaves the other rows as written. */
export function fromCore<T extends Row>(rows: readonly T[]): T[] {
  return rows.map((row) => {
    const core = truth(row.id);
    if (!core) return row;

    const merged = { ...row, name: core.name, price: core.price };
    if (core.level === undefined) delete merged.level;
    else merged.level = core.level;

    return merged;
  });
}
