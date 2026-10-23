// bun scripts/perf-report.mjs <run.json> [baseline.json] [--p1 pass1.json] [--rooms town,inn] [--styles hd,voxel1] [--full]
//   A markdown table of a harness run. With a baseline, each number carries its change; with --p1 (the first pass of the work) the
//   table reads "original → first pass → now". --full prints every column, the default prints the headline ones.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (k) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? null : args[i + 1];
};
const [file, base] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!file) {
  console.error(
    "usage: perf-report.mjs run.json [baseline.json] [--p1 pass1.json] [--rooms a,b] [--styles x,y] [--full]",
  );
  process.exit(1);
}
const load = (f) => (f ? JSON.parse(readFileSync(f, "utf8")) : null);
const run = load(file);
const old = load(base);
const p1 = load(flag("p1"));
const rooms = flag("rooms")?.split(",");
const styles = flag("styles")?.split(",");
const full = args.includes("--full");
const find = (r, x) => r?.results.find((y) => y.room === x.room && y.style === x.style);
const pct = (a, b) => (b ? `${a <= b ? "" : "+"}${Math.round(((a - b) / b) * 100)}%` : "");

const cols = [
  ["draws", (r) => r.drawsPerFrame],
  ["tris K", (r) => Math.round(r.trisPerFrame / 1000)],
  ["GPU MB", (r) => Math.round(r.gpuMB)],
  ["cpu p50 ms", (r) => r.cpuMs.p50],
  ["frame p50/p95 ms", (r) => `${r.frameMs.p50}/${r.frameMs.p95}`, true],
  ...(full
    ? [
        ["progs", (r) => r.programs],
        ["tex", (r) => r.liveTextures],
        ["heap MB", (r) => Math.round(r.heapMB)],
        ["gpu p50 ms", (r) => r.gpuMs?.p50 ?? 0],
        ["ready ms", (r) => r.readyMs],
      ]
    : []),
];

console.log(`GL: ${run.gl}, viewport ${run.viewport.join("x")}, ${run.ms} ms per run, ${run.at}`);
console.log(`\n| room | style | ${cols.map((c) => c[0]).join(" | ")} |\n|${"---|".repeat(cols.length + 2)}`);
for (const r of run.results) {
  if ((rooms && !rooms.includes(r.room)) || (styles && !styles.includes(r.style))) continue;
  const o = find(old, r);
  const q = find(p1, r);
  const cells = cols.map(([, f, text]) => {
    const v = f(r);
    if (text) return o ? `${f(o)} → ${v}` : String(v);
    const chain = [o && f(o), q && f(q), v].filter((x) => x !== null && x !== undefined);
    const change = o && typeof f(o) === "number" ? ` (${pct(v, f(o))})` : "";
    return chain.length > 1 ? `${chain.join(" → ")}${change}` : String(v);
  });
  console.log(`| ${r.room} | ${r.style} | ${cells.join(" | ")} |`);
}
