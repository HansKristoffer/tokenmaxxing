import { TILE } from "@tokenmaxxing/core/world.ts";
import { fishingLine } from "./fishing-line.ts";
import type { Frame } from "./frame.ts";
import { nearPill } from "./labels.ts";
import { world } from "./world.ts";

export function drawFishing({ g, items, labels, now, toScreen, dpr }: Frame): void {
  if (world.room === "town") {
    const [sx, sy] = toScreen(4.5 * TILE, 11.5 * TILE);
    labels.push(() =>
      nearPill(g, sx, sy, "🎣 Pond fishing · E at the bank", dpr, "rgba(36,64,69,0.9)", "#fff0d1"),
    );
  }
  const cast = fishingLine();
  if (!cast) return;
  const x = (cast.waterX + 0.5) * TILE;
  const y = (cast.waterY + 0.5) * TILE;
  const bob = Math.sin(now / 220) * 0.7;
  items.push({
    y: y + 1,
    draw: () => {
      g.strokeStyle = "#fff0c8";
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo((cast.x + 0.5) * TILE, cast.y * TILE + 3);
      g.lineTo(x, y + bob);
      g.stroke();
      g.fillStyle = "#fff0d1";
      g.fillRect(x - 1, y - 2 + bob, 2, 3);
      g.fillStyle = "#db655f";
      g.fillRect(x - 1, y - 2 + bob, 2, 1);
    },
  });
}
