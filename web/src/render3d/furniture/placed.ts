import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { COMPANY_FURNITURE, flippedAt } from "@tokenmaxxing/core/office.ts";
import { POSTERS } from "@tokenmaxxing/core/posters.ts";

const pieceChars = new Map<string, number>(
  [...COMPANY_FURNITURE, ...POSTERS].map((p): [string, number] => [p.ch, p.w ?? 1]),
);

/**
 * What a company has dropped in its house, read off the map (a piece writes its character on every tile it covers),
 * with `flip` on a piece turned to face the other way.
 */
export function placedIn(map: GameMap): { ch: string; x: number; y: number; flip?: boolean }[] {
  const out: { ch: string; x: number; y: number; flip?: boolean }[] = [];
  map.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const w = pieceChars.get(row[rx]!);
      if (!w) continue;
      const [x, y] = [rx + map.x0, ry + map.y0];
      out.push({ ch: row[rx]!, x, y, ...(flippedAt(map, x, y) && { flip: true }) });
      rx += w - 1;
    }
  });
  return out;
}
