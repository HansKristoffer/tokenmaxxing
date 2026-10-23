// bun scripts/perf/counts.ts: hardware-independent counts of every room, built headlessly and batched (what the budget test checks).
import { BUDGETS } from "../../web/src/render3d/perf/budgets.ts";
import { installHeadlessGlobals } from "../../web/src/render3d/perf/stubs.ts";

installHeadlessGlobals();
const h = await import("../../web/src/render3d/perf/headless.ts");
await h.loadAllSlices();
for (const room of Object.keys(BUDGETS)) {
  const c = h.measureRoom(room);
  console.log(room.padEnd(15), JSON.stringify(c));
}
