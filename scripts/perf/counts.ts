// bun scripts/perf/counts.ts: hardware-independent counts of every room, built headlessly and batched (what the budget test checks),
// for the geometry detail of one tier (`bun scripts/perf/counts.ts medium|high [--check]`): medium has plain boxes, high chamfers (ultra is the same).
import { BUDGETS } from "../../web/src/render3d/perf/budgets.ts";
import { installHeadlessGlobals } from "../../web/src/render3d/perf/stubs.ts";

installHeadlessGlobals();
const h = await import("../../web/src/render3d/perf/headless.ts");
const { setGeometryDetail } = await import("../../web/src/demo3d/kit.ts");
await h.loadAllSlices();
const tier = (process.argv[2] ?? "high") as "medium" | "high";
const check = process.argv.includes("--check");
setGeometryDetail(tier === "medium" ? 0 : 1);
let bad = 0;
console.log(`— ${tier}`);
for (const [room, b] of Object.entries(BUDGETS[tier])) {
  const c = h.measureRoom(room);
  const over = (Object.keys(b) as (keyof typeof b)[]).filter((k) => c[k] > b[k]);
  if (over.length) bad++;
  console.log(room.padEnd(15), JSON.stringify(c), over.length ? `OVER ${over.join(",")}` : "");
}
if (check && bad) process.exit(1);
