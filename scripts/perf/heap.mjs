// bun scripts/perf/heap.mjs <room> [style|tier] [top]: what the demo's JS heap holds after warm-up (a CDP heap snapshot),
// self size by constructor, and what holds the typed-array backing stores. EXTRA='&crowd=40' adds URL parameters.
// bun scripts/perf/heap.mjs <file.heapsnapshot> [top]: the same for a snapshot already taken (`perf/game.mjs --heap`).
import { readFileSync } from "node:fs";

const file = process.argv[2]?.endsWith(".heapsnapshot") ? process.argv[2] : null;
const [room = "town", style = "medium", top = "30"] = file
  ? ["", "", process.argv[3] ?? "30"]
  : process.argv.slice(2);
let used = 0;
const chunks = [];
if (!file) {
  const pw = await import(
    process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
  );
  const url = process.env.URL ?? "http://localhost:4652";
  const tier = ["medium", "high", "ultra"].includes(style);
  const browser = await pw.chromium.launch({
    headless: true,
    args: [
      "--use-angle=metal",
      "--ignore-gpu-blocklist",
      "--enable-precise-memory-info",
      "--js-flags=--expose-gc",
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((s) => localStorage.setItem("demo3d.style", s), tier ? "voxel" : style);
  const page = await ctx.newPage();
  await page.goto(
    `${url}/?stage=${/^[A-Z]/.test(room) ? room : `World:${room}`}${tier ? `&tier=${style}` : "&q=2"}${process.env.EXTRA ?? ""}`,
  );
  await page.waitForFunction(() => window.world3d, null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.gc?.());
  used = await page.evaluate(() => performance.memory.usedJSHeapSize);
  const cdp = await ctx.newCDPSession(page);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", (e) => chunks.push(e.chunk));
  await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  await browser.close();
}

const snap = JSON.parse(file ? readFileSync(file, "utf8") : chunks.join(""));
const m = snap.snapshot.meta;
const F = m.node_fields.length;
const [iType, iName, iSelf] = ["type", "name", "self_size"].map((k) => m.node_fields.indexOf(k));
const types = m.node_types[0];
const by = new Map();
const big = [];
const nodes = snap.nodes;
for (let i = 0; i < nodes.length; i += F) {
  const type = types[nodes[i + iType]];
  const name = snap.strings[nodes[i + iName]];
  const size = nodes[i + iSelf];
  const k = type === "object" || type === "native" ? `${type}:${name}` : `(${type})`;
  const e = by.get(k) ?? { n: 0, size: 0 };
  e.n++;
  e.size += size;
  by.set(k, e);
  if (size > 1 << 20) big.push([size, `${type}:${name}`]);
}
const mb = (b) => (b / 1048576).toFixed(1).padStart(7);
console.log(
  `usedJSHeapSize ${mb(used)} MB, snapshot total ${mb([...by.values()].reduce((a, e) => a + e.size, 0))} MB`,
);
for (const [k, e] of [...by].sort((a, b) => b[1].size - a[1].size).slice(0, Number(top)))
  console.log(`${mb(e.size)} MB  ${String(e.n).padStart(8)}  ${k}`);
console.log("\nlargest single nodes:");
for (const [s, k] of big.sort((a, b) => b[0] - a[0]).slice(0, 15)) console.log(`${mb(s)} MB  ${k}`);

// Who holds the array buffers: the retainer chain (by constructor, a few levels up) of every backing store over 4 KB.
const E = m.edge_fields.length;
const [eType, eTo] = ["type", "to_node"].map((k) => m.edge_fields.indexOf(k));
const edgeTypes = m.edge_types[0];
const iEdges = m.node_fields.indexOf("edge_count");
const retainers = new Map();
for (let i = 0, e = 0; i < nodes.length; i += F) {
  for (let k = 0; k < nodes[i + iEdges]; k++, e += E) {
    const t = edgeTypes[snap.edges[e + eType]];
    if (t === "weak" || t === "shortcut") continue;
    const to = snap.edges[e + eTo];
    if (!retainers.has(to)) retainers.set(to, []);
    retainers.get(to).push(i);
  }
}
const label = (i) => {
  const t = types[nodes[i + iType]];
  return t === "object" || t === "native" ? snap.strings[nodes[i + iName]].slice(0, 40) : `(${t})`;
};
const chains = new Map();
const DEPTH = Number(process.env.DEPTH ?? 4);
for (let i = 0; i < nodes.length; i += F) {
  if (snap.strings[nodes[i + iName]] !== "system / JSArrayBufferData" || nodes[i + iSelf] < 4096) continue;
  const path = [];
  let at = i;
  for (let d = 0; d < DEPTH; d++) {
    const r = (retainers.get(at) ?? []).find((j) => !["(array)", "(hidden)"].includes(label(j)) || d === 0);
    if (r === undefined) break;
    path.push(label(r));
    at = r;
  }
  const k = path.join(" < ");
  const e = chains.get(k) ?? { n: 0, size: 0 };
  e.n++;
  e.size += nodes[i + iSelf];
  chains.set(k, e);
}
console.log("\narray buffers by retainer chain:");
for (const [k, e] of [...chains].sort((a, b) => b[1].size - a[1].size).slice(0, 20))
  console.log(`${mb(e.size)} MB  ${String(e.n).padStart(6)}  ${k}`);
