import { hud } from "../../store.ts";
import type { LiveFrame } from "./rooms.ts";
import type { RouletteModel } from "./roulette3d.ts";

/**
 * The net cafe's roulette table, live: the wheel and ball play each spin the server rolled (`hud.roulette`),
 * the landed number and the last pockets show over the table, and a chip stack and a glow mark each seated spot.
 */
export class RouletteEvents {
  constructor(private readonly table: RouletteModel | null) {}

  update(f: LiveFrame): void {
    // The step is capped at 0.1 s, so one long frame does not jump the wheel.
    this.table?.show(hud.get().roulette, Date.now(), Math.min(f.dt, 0.1));
  }

  /** Nothing to free: the table belongs to the basement, which frees it. */
  dispose(): void {}
}
