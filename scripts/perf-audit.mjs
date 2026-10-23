// bun scripts/perf-audit.mjs [--url ...] [--rooms ...] [--out perf-results/audit]: batching must not change the picture.
// Per room and style, screenshots with and without `?nobake`, a pixel diff, and a check that nothing batched has moved.
import { mkdirSync } from "node:fs";
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://localhost:4652");
const out = arg("out", "perf-results/audit");
const rooms = arg("rooms", "town,inn,upstairs,basement,shop-furniture,shop-clothes,shop-barber,shop-pets,dungeon,hq,office").split(",");
const styles = arg("styles", "smooth,voxel").split(",");
const pw = await import(process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs");
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
let bad = 0;
const seed = () => {
  let s = 99;
  Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};
async function shot(room, style, nobake) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(seed);
  await ctx.addInitScript((s) => localStorage.setItem("demo3d.style", s), style);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${url}/?stage=World:${room}&q=2${nobake ? "&nobake" : ""}`);
  await page.waitForFunction(() => window.world3d && window.__perfStats?.()[0]?.scene, null, { timeout: 60000 });
  await page.addStyleTag({ content: "body > *:not(canvas){display:none !important}" });
  await page.waitForTimeout(2500);
  const png = await page.screenshot();
  // Sources that moved after the bake: baked copies would be stale.
  const stale = nobake ? [] : await page.evaluate(async () => {
    const layers = window.__layers ?? [];
    const before = layers.map((l) => l.sourceMeshes.map((m) => m.matrixWorld.elements.join()));
    await new Promise((r) => setTimeout(r, 6000));
    const bad = [];
    layers.forEach((l, i) =>
      l.sourceMeshes.forEach((m, j) => {
        l.root.updateMatrixWorld(true);
        if (m.matrixWorld.elements.join() !== before[i][j]) bad.push(m.name || m.geometry.type);
      }),
    );
    return bad.slice(0, 5);
  });
  await ctx.close();
  return { png, errors, stale };
}
const diff = async (page, a, b) =>
  page.evaluate(
    async ([x, y]) => {
      const load = (d) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${d}`; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const get = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      const A = get(ia), B = get(ib);
      let sum = 0, big = 0;
      for (let k = 0; k < A.length; k += 4) {
        const d = Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]);
        sum += d;
        if (d > 90) big++;
      }
      return { mean: sum / (A.length / 4) / 3, bigPct: (big / (A.length / 4)) * 100 };
    },
    [a.toString("base64"), b.toString("base64")],
  );
const dpage = await (await browser.newContext()).newPage();
await dpage.goto("about:blank");
for (const room of rooms)
  for (const style of styles) {
    const a = await shot(room, style, true);
    const b = await shot(room, style, false);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${out}/${room}-${style}-plain.png`, a.png);
    writeFileSync(`${out}/${room}-${style}-baked.png`, b.png);
    const d = await diff(dpage, a.png, b.png);
    const flag = d.bigPct > 1.5 || b.stale.length || b.errors.length;
    if (flag) bad++;
    console.log(`${flag ? "CHECK" : "ok   "} ${room.padEnd(15)} ${style.padEnd(7)} mean diff ${d.mean.toFixed(2)}  >90: ${d.bigPct.toFixed(2)}%  stale ${JSON.stringify(b.stale)} ${b.errors[0] ?? ""}`);
  }
await browser.close();
process.exit(bad ? 1 : 0);
