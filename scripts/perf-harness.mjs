// bun scripts/perf-harness.mjs [--url http://localhost:4652] [--out perf-results/run.json] [--rooms town,inn] [--styles hd,pixel,voxel0,voxel1,voxel2]
//   [--ms 4000] [--gl swiftshader|metal] [--viewport 1280x720]
// Drives the 3D demo (web/demo3d.html) headless with a fixed seed, fixed rooms and the GL probe (scripts/perf/probe.js), then
// writes frame times and hardware-independent counts (draw calls, triangles, programs, textures, bytes) per room x style.
// Frame times under software GL are only relative; the counts are what budgets are checked against.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://localhost:4652");
const out = arg("out", "perf-results/run.json");
const rooms = arg("rooms", "town,inn,upstairs,basement,shop-furniture,shop-clothes,dungeon,hq,office").split(",");
const styles = arg("styles", "hd,pixel,voxel0,voxel1,voxel2").split(",");
const ms = Number(arg("ms", "4000"));
const gl = arg("gl", "metal");
const [vw, vh] = arg("viewport", "1280x720").split("x").map(Number);

const pw = await import(process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs");
const probe = readFileSync(new URL("./perf/probe.js", import.meta.url), "utf8");
const browser = await pw.chromium.launch({
  headless: true,
  args: [
    gl === "metal" ? "--use-angle=metal" : "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--disable-frame-rate-limit",
    "--disable-gpu-vsync",
    "--enable-precise-memory-info",
    "--js-flags=--expose-gc",
  ],
});

const pct = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r1 = (n) => Math.round(n * 100) / 100;

const STYLE = {
  hd: ["smooth", ""],
  pixel: ["pixel", ""],
  voxel0: ["voxel", "0"],
  voxel1: ["voxel", "1"],
  voxel2: ["voxel", "2"],
};

const results = [];
for (const room of rooms) {
  for (const style of styles) {
    const [stored, q] = STYLE[style];
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
    await ctx.addInitScript(probe);
    if (process.env.BAKE_CELL) await ctx.addInitScript((c) => (window.__bakeCell = Number(c)), process.env.BAKE_CELL);
    await ctx.addInitScript((s) => localStorage.setItem("demo3d.style", s), stored);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const t0 = Date.now();
    const stage = /^[A-Z]/.test(room) ? room : `World:${room}`;
    await page.goto(`${url}/?stage=${stage}${q ? `&q=${q}` : ""}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__probe?.frames > 3 && window.world3d, null, { timeout: 60000 });
    const ready = Date.now() - t0;
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      window.gc?.();
      window.__probe.reset();
      window.__probe.timing = true;
    });
    const heap0 = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    await page.waitForTimeout(ms);
    const m = await page.evaluate(() => {
      const P = window.__probe;
      const stats = window.__perfStats?.() ?? [];
      return {
        frames: P.frames,
        draws: P.draws,
        tris: P.tris,
        instances: P.instances,
        programsFrame: P.programsUsed.size,
        texBytes: P.texBytes,
        bufBytes: P.bufBytes,
        rbBytes: P.rbBytes,
        live: { ...P.live },
        texUploads: P.texUploads,
        gaps: P.gaps,
        gpu: P.gpuMs,
        cpu: P.rafMs,
        longTasks: P.longTasks,
        heap: performance.memory?.usedJSHeapSize ?? 0,
        stats: stats[0] ?? null,
      };
    });
    const f = Math.max(1, m.frames);
    results.push({
      room,
      style,
      readyMs: ready,
      frames: m.frames,
      fps: r1((m.frames / ms) * 1000),
      frameMs: { p50: r1(pct(m.gaps, 0.5)), p95: r1(pct(m.gaps, 0.95)), p99: r1(pct(m.gaps, 0.99)) },
      gpuMs: { p50: r1(pct(m.gpu, 0.5)), p95: r1(pct(m.gpu, 0.95)), n: m.gpu.length },
      cpuMs: { p50: r1(pct(m.cpu, 0.5)), p95: r1(pct(m.cpu, 0.95)) },
      drawsPerFrame: Math.round(m.draws / f),
      trisPerFrame: Math.round(m.tris / f),
      programs: m.programsFrame,
      liveTextures: m.live.texture,
      liveBuffers: m.live.buffer,
      livePrograms: m.live.program,
      texUploadsPerFrame: r1(m.texUploads / f),
      gpuMB: r1((m.texBytes + m.bufBytes + m.rbBytes) / 1048576),
      heapMB: r1(m.heap / 1048576),
      heapGrowthMB: r1((m.heap - heap0) / 1048576),
      longTasks: m.longTasks,
      info: m.stats ? { ...m.stats.memory, programs: m.stats.programs } : null,
      scene: m.stats?.scene ?? null,
      errors: errors.slice(0, 3),
    });
    const r = results.at(-1);
    console.log(
      `${room.padEnd(15)} ${style.padEnd(7)} ready ${String(ready).padStart(5)}ms  p50 ${r.frameMs.p50}ms p95 ${r.frameMs.p95}  cpu ${r.cpuMs.p50} gpu ${r.gpuMs.p50}  draws ${r.drawsPerFrame}  tris ${r.trisPerFrame}  prog ${r.programs}  tex ${r.liveTextures}  gpu ${r.gpuMB}MB  heap ${r.heapMB}MB`,
    );
    await ctx.close();
  }
}
await browser.close();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), gl, viewport: [vw, vh], ms, results }, null, 1));
console.log(`wrote ${out}`);
