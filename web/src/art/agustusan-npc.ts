import { COSTUME_BASE } from "@tokenmaxxing/core/costumes.ts";
import type { Facing, Look } from "@tokenmaxxing/core/world.ts";
import { characterFrame } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached } from "./pixels.ts";

/** Who Pak Budi is under the peci: a white kemeja (shirt), grey hair, a black songkok (`hat.270`). */
export const PAK_BUDI_LOOK: Look = {
  style: 0,
  skin: 2,
  hair: 4,
  outfit: 7,
  glasses: 0,
  hat: COSTUME_BASE + 70,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};

const RED = "#d8283a";
const WHITE = "#fbf7ef";

/**
 * Pak Budi, the RT: the character frame with a red-and-white sash across his chest (the panitia's selempang) and a
 * little merah putih flag in his hand, which flutters between the two breaths. 16 x 20, feet at the bottom.
 */
export const pakBudiSprite = cached(
  (facing: Facing, breath: 0 | 1) => `${facing}.${breath}`,
  (facing: Facing, breath: 0 | 1) =>
    bake(16, 20, (p) => {
      const side = facing === "left" || facing === "right";
      const flip = facing === "left";
      p.g.drawImage(characterFrame(PAK_BUDI_LOOK, facing, "stand"), 0, 4);
      // The sash, from the shoulder down across the chest (not seen from behind, where it is a thin line).
      if (facing === "down") {
        p.px(5, 14, RED);
        p.px(6, 15, WHITE);
        p.px(7, 16, RED);
        p.px(8, 17, WHITE);
      } else if (side) {
        for (const [i, c] of [RED, WHITE, RED, WHITE].entries()) p.px(flip ? 9 - i : 6 + i, 14 + i, c);
      } else {
        p.px(6, 14, RED);
        p.px(7, 15, WHITE);
      }
      // The flag, held up on a stick beside him: down and sideways only.
      if (facing !== "up") {
        const x = flip ? 3 : 12;
        const fx = flip ? 0 : 13;
        p.rect(x, 7 + breath, 1, 9, "#9c7d3a");
        p.rect(fx, 7 + breath, 3, 2, RED);
        p.rect(fx, 9 + breath, 3, 2, WHITE);
      }
      p.rect(3, 18, 10, 1, C.shadow);
    }),
);
