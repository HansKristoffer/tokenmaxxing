// bun scripts/perf-report.mjs <run.json> [baseline.json]   -> a markdown table (with deltas against the baseline).
import { readFileSync } from "node:fs";

const [file, base] = process.argv.slice(2);
if (!file) {
  console.error("usage: perf-report.mjs run.json [baseline.json]");
  process.exit(1);
}
const load = (f) => JSON.parse(readFileSync(f, "utf8"));
const run = load(file);
const old = base ? load(base) : null;
const find = (r, x) => r.results.find((y) => y.room === x.room && y.style === x.style);
const d = (a, b) => (b == null || !b ? "" : ` (${a <= b ? "" : "+"}${Math.round(((a - b) / b) * 100)}%)`);
const cols = [
  ["draws", (r) => r.drawsPerFrame],
  ["tris K", (r) => Math.round(r.trisPerFrame / 1000)],
  ["progs", (r) => r.programs],
  ["tex", (r) => r.liveTextures],
  ["GPU MB", (r) => r.gpuMB],
  ["heap MB", (r) => r.heapMB],
  ["cpu p50 ms", (r) => r.cpuMs.p50],
  ["gpu p50 ms", (r) => r.gpuMs?.p50 ?? 0],
  ["frame p50/p95/p99 ms", (r) => `${r.frameMs.p50}/${r.frameMs.p95}/${r.frameMs.p99}`],
  ["ready ms", (r) => r.readyMs],
];
const num = new Set(["draws", "tris K", "GPU MB", "heap MB", "cpu p50 ms", "gpu p50 ms", "ready ms"]);
console.log(`GL: ${run.gl}, viewport ${run.viewport.join("x")}, ${run.ms} ms per run, ${run.at}`);
console.log(`\n| room | style | ${cols.map((c) => c[0]).join(" | ")} |\n|${"---|".repeat(cols.length + 2)}`);
for (const r of run.results) {
  const o = old ? find(old, r) : null;
  const cells = cols.map(([name, f]) => {
    const v = f(r);
    return num.has(name) && o ? `${v}${d(v, f(o))}` : String(v);
  });
  console.log(`| ${r.room} | ${r.style} | ${cells.join(" | ")} |`);
}
