// bun scripts/perf-leak.mjs [--url ...] [--switches 50]: switches rooms (and styles) back and forth; the live GL objects and
// the JS heap must come back to where they were. Exit 1 on growth.
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://localhost:4652");
const n = Number(arg("switches", "50"));
const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);
const probe = (await import("node:fs")).readFileSync(new URL("./perf/probe.js", import.meta.url), "utf8");
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--enable-precise-memory-info", "--js-flags=--expose-gc"],
});
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.addInitScript(probe);
const page = await ctx.newPage();
await page.goto(`${url}/?stage=World:town&q=1`);
await page.waitForFunction(() => window.world3d && window.__probe?.frames > 3, null, { timeout: 60000 });
const rooms = ["inn", "basement", "town", "dungeon", "hq", "shop-furniture", "upstairs", "office"];
const snap = () =>
  page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 600));
    window.gc?.();
    const L = window.__probe.live;
    const i = window.__perfStats()[0];
    return {
      tex: L.texture,
      buf: L.buffer,
      prog: L.program,
      fb: L.framebuffer,
      rb: L.renderbuffer,
      geo: i.memory.geometries,
      heap: Math.round(performance.memory.usedJSHeapSize / 1048576),
    };
  });
// Two laps build every room and settle lazy uploads; the leak check is the laps after. (The demo's placePlayer adds an avatar per
// switch, about one texture and seven buffers: inside the 10% slack, not the engine.)
for (const r of [...rooms, ...rooms]) {
  await page.evaluate((r) => window.world3d.setStage(`World:${r}`), r);
  await page.waitForTimeout(500);
}
await page.evaluate(() => window.world3d.setStage("World:town"));
const base = await snap();
for (let i = 0; i < n; i++) {
  await page.evaluate((r) => window.world3d.setStage(`World:${r}`), rooms[i % rooms.length]);
  if (i % 10 === 9)
    await page.evaluate((i) => localStorage.setItem("demo3d.style", i % 20 === 9 ? "smooth" : "voxel"), i);
  await page.waitForTimeout(120);
}
await page.evaluate(() => window.world3d.setStage("World:town"));
const end = await snap();
console.log("before", JSON.stringify(base), "\nafter ", JSON.stringify(end));
let bad = false;
for (const k of ["tex", "buf", "prog", "fb", "rb", "geo"])
  if (end[k] > base[k] * 1.1 + 4) {
    bad = true;
    console.log(`LEAK ${k}: ${base[k]} -> ${end[k]}`);
  }
if (end.heap > base.heap * 1.25 + 20) {
  bad = true;
  console.log(`LEAK heap ${base.heap} -> ${end.heap} MB`);
}
await browser.close();
process.exit(bad ? 1 : 0);
