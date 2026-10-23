// bun scripts/perf/inspect.mjs <room> [style] [shot.png]: what is left unbatched in a room, and a screenshot.
const pw = await import(process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs");
const [room = "town", style = "voxel", shot] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:4652";
const browser = await pw.chromium.launch({ headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => localStorage.setItem("demo3d.style", s), style);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[error]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
await page.goto(`${url}/?stage=World:${room}&q=2`);
await page.waitForFunction(() => window.world3d && window.__perfStats?.()[0]?.scene, null, { timeout: 60000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const st = window.world3d.stages.find((s) => s.name === window.world3d.stages.at(-1).name);
  const cur = window.world3d.stages.find((s) => s.scene === window.__stageScene?.());
  return null;
});
const info = await page.evaluate(() => JSON.stringify(window.__perfStats()[0], null, 1));
console.log(info);
console.log(JSON.stringify(await page.evaluate(() => window.__bakes)));
const left = await page.evaluate(() => window.__unbatched?.() ?? null);
if (left) console.log(JSON.stringify(left));
if (shot) await page.screenshot({ path: shot });
await browser.close();
