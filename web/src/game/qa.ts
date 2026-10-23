import { route } from "@tokenmaxxing/core/world.ts";
import { graphics } from "../settings/graphics.ts";
import { hud } from "../store.ts";
import { camera, viewHooks } from "./camera.ts";
import { walkTo } from "./input.ts";
import { perf, pickTile } from "./stage.ts";
import { self, world } from "./world.ts";

/**
 * A handle for the QA scripts (`scripts/qa`) to drive the real game: `localStorage["tokenmaxxing.qa"] = "1"`
 * turns it on as `window.__tm`. Nothing here is used by the game itself.
 */
export function exposeForQa(): void {
  if (typeof localStorage === "undefined" || !localStorage.getItem("tokenmaxxing.qa")) return;
  Object.assign(window, {
    __tm: { world, self, hud, graphics, camera, viewHooks, perf, pickTile, walkTo, route },
  });
}
