import { type FestiveNpc, festiveNpcOf } from "@tokenmaxxing/core/festive.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { NPC_SPRITES } from "../art/festive-npc.ts";
import { C } from "../art/palette.ts";
import { hud } from "../store.ts";
import { festiveNow } from "./festive.ts";
import type { Frame } from "./frame.ts";
import { gameHits } from "./games.ts";
import { bubble, sign } from "./labels.ts";
import { self, world } from "./world.ts";

/**
 * The festive theme's named NPC in town (`FESTIVE_NPC`, `core/src/festive.ts`): there while the theme is, drawn
 * from its sprite (`art/festive-npc.ts`), named over its head, calling out to anyone near, and answering E (or a
 * click) with its next line in the dialog. The 3D town does the same (`render3d/town/festive-npc3d.ts`). Both ask
 * `festiveNpcNow()`, so the setting and the pins reach it.
 */

/** The NPC in town now, or null (not in the town, no theme, or the theme has none). */
export const festiveNpcNow = (): FestiveNpc | null =>
  world.room === "town" ? festiveNpcOf(festiveNow()) : null;

/** Whether E on (x, y) is talking to it. */
export const festiveNpcAt = (x: number, y: number): boolean => {
  const n = festiveNpcNow();
  return n !== null && n.x === x && n.y === y;
};

/** Whether the step onto (x, y) is onto the NPC: it stands there, so it is no step. */
export const blocksFestiveNpc = festiveNpcAt;

let turn = 0;
/** Its next line, in the dialog. */
export function talkToFestiveNpc(): void {
  const n = festiveNpcNow();
  if (!n || n.lines.length === 0) return;
  hud.set({ dialog: `${n.name}: ${n.lines[turn++ % n.lines.length]}` });
}

export function drawFestiveNpc({ g, items, labels, toScreen, now, dpr }: Frame): void {
  const n = festiveNpcNow();
  const id = festiveNow()?.id;
  if (!n || !id) return;
  const x = n.x * TILE;
  const y = n.y * TILE;
  const draw = NPC_SPRITES[id];
  const breath = Math.floor(now / 700) % 2 === 0 ? 0 : 1;
  items.push({
    y: y + TILE - 0.5,
    draw: () => {
      g.fillStyle = C.shadow;
      g.fillRect(x + 4, y + 14, 8, 2);
      if (draw) {
        const s = draw(n.facing, breath);
        g.drawImage(s, x + Math.floor((TILE - s.width) / 2), y + TILE - s.height - breath);
      }
    },
  });
  const [hx, hy] = toScreen(x + TILE / 2, y - 4);
  const me = self();
  const near = me && Math.abs(me.x - n.x) + Math.abs(me.y - n.y) <= 4;
  labels.push(() => {
    const top = hy - 2 * dpr;
    const { w, h } = sign(g, hx, top, n.name, dpr, false);
    gameHits.push({ x: hx - w / 2, y: top - h, w, h, open: talkToFestiveNpc });
    if (near && n.lines.length)
      bubble(g, hx, top - h - 2 * dpr, n.lines[Math.floor(now / 6000) % n.lines.length]!, dpr, 1000);
  });
}
