/**
 * The traveling merchant in town (`core/src/merchant.ts`): the cart by the square while it's in,
 * the merchant beside it calling out to anyone near, and a signpost while it's away. Clicking the
 * cart, its sign or the merchant (or E in front of them) opens the cart.
 */
import {
  CART_H,
  CART_SPOT,
  CART_W,
  cartOpen,
  lineup,
  underCart,
  weekOf,
} from "@tokenmaxxing/core/merchant.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { CART_PX, cartSprite, glow, lantern, merchantFrame, signpost } from "../art/cart.ts";
import { C } from "../art/palette.ts";
import { hud } from "../store.ts";
import { gameHits } from "./games.ts";
import { bubble, sign } from "./labels.ts";
import { self, world } from "./world.ts";

type Draw = { y: number; draw: () => void };
type ToScreen = (px: number, py: number) => readonly [number, number];

/** Where the merchant stands: by the cart's back wheel, on the edge of the square. */
const MERCHANT = { x: CART_SPOT.x - 1, y: CART_SPOT.y };

const CALLS = [
  "Merchant editions! Numbered, and never many.",
  "Only here till Monday morning, friend.",
  "Every copy stamped. Every one a little bit rare.",
  "Fresh from the far side of the context window!",
];

const serverNow = () => Date.now() - hud.get().clockSkew;

export const openCart = (): void => {
  if (cartOpen(serverNow())) hud.set({ panel: { kind: "merchant" } });
  else
    hud.set({
      dialog: "The merchant's pitch. The cart rolls in on Thursday at 08:00 and stays the weekend.",
    });
};

/** Whether E on (x, y) is talking to the merchant: the cart, him, or the signpost. */
export const merchantAt = (x: number, y: number): boolean =>
  world.room === "town" && (underCart(x, y) || (x === MERCHANT.x && y === MERCHANT.y));

export function drawMerchant(
  g: CanvasRenderingContext2D,
  items: Draw[],
  labels: (() => void)[],
  toScreen: ToScreen,
  now: number,
  dpr: number,
): void {
  if (world.room !== "town") return;
  const at = serverNow();
  const left = CART_SPOT.x * TILE;
  const bottom = (CART_SPOT.y + CART_H) * TILE;
  if (!cartOpen(at)) {
    const post = signpost();
    const px = (CART_SPOT.x + 1) * TILE;
    items.push({ y: bottom - 1, draw: () => g.drawImage(post, px, bottom - post.height) });
    const [sx, sy] = toScreen(px + TILE / 2, bottom - post.height);
    labels.push(() => {
      const y = sy - 4 * dpr;
      const { w, h } = sign(g, sx, y, "🛒 Back Thursday", dpr, false);
      gameHits.push({ x: sx - w / 2, y: y - h, w, h, open: openCart });
    });
    return;
  }

  const cart = cartSprite(lineup(weekOf(at)));
  const top = bottom - CART_PX.h;
  const lit = Math.floor(now / 260) % 5 !== 0;
  items.push({
    y: bottom - 1,
    draw: () => {
      g.drawImage(cart, left, top);
      g.drawImage(lantern(lit), left + CART_PX.w - 6, top + 14);
      glow(g, left + CART_PX.w - 3, top + 19, lit ? 12 : 10);
    },
  });

  // The merchant: a breath every so often, and a look over at the square now and then.
  const mx = MERCHANT.x * TILE;
  const my = MERCHANT.y * TILE;
  const facing = Math.floor(now / 2600) % 3 === 2 ? "left" : "down";
  const bob = Math.floor(now / 700) % 2;
  items.push({
    y: my + TILE - 0.5,
    draw: () => {
      g.fillStyle = C.shadow;
      g.fillRect(mx + 4, my + 14, 8, 2);
      g.drawImage(merchantFrame(facing), mx, my - 2 - bob);
    },
  });

  const [cx, cy] = toScreen(left + (CART_W * TILE) / 2, top);
  const [hx, hy] = toScreen(mx + TILE / 2, my - 2);
  const [x0, y0] = toScreen(left, top);
  const [x1, y1] = toScreen(left + CART_PX.w, bottom);
  const [mx1, my1] = toScreen(mx + TILE, my + TILE);
  const me = self();
  const near = me && Math.abs(me.x - MERCHANT.x) + Math.abs(me.y - MERCHANT.y) <= 4;
  labels.push(() => {
    const y = cy - 4 * dpr;
    const { w, h } = sign(g, cx, y, "🛒 Traveling merchant · editions", dpr, true);
    gameHits.push({ x: cx - w / 2, y: y - h, w, h, open: openCart });
    gameHits.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, open: openCart });
    gameHits.push({ x: 2 * hx - mx1, y: hy, w: 2 * (mx1 - hx), h: my1 - hy, open: openCart });
    if (near) bubble(g, hx, hy - 2 * dpr, CALLS[Math.floor(now / 6000) % CALLS.length]!, dpr, 1000);
  });
}
