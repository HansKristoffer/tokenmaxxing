// bun scripts/perf-shots.mjs --out perf-results/shots/<name> [--rooms ..] [--modes smooth,v1,v2] [--times 12:00,23:30]
// Screenshots every room per mode (smooth = classic look, v1/v2 = Voxel quality 1/2) with a fixed seed; compare two runs with perf-diff.mjs.
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://localhost:4652");
const out = arg("out", "perf-results/shots/now");
const rooms = arg(
  "rooms",
  "town,inn,upstairs,basement,shop-furniture,shop-clothes,shop-barber,shop-pets,dungeon,hq,office",
).split(",");
const modes = arg("modes", "smooth,v1,v2").split(",");
const times = arg("times", "12:00,23:30").split(",");
const extra = arg("extra", "");
const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const seed = () => {
  let s = 99;
  Math.random = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
for (const room of rooms)
  for (const mode of modes)
    for (const time of times) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      await ctx.addInitScript(seed);
      await ctx.addInitScript(
        (s) => localStorage.setItem("demo3d.style", s),
        mode === "smooth" || mode === "medium" ? "smooth" : "voxel",
      );
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const tier = ["medium", "high", "ultra"].includes(mode);
      const q = mode === "v1" ? 1 : 2;
      await page.goto(
        `${url}/?stage=${/^[A-Z]/.test(room) ? room : `World:${room}`}${tier ? `&tier=${mode}` : `&q=${q}`}${extra}`,
      );
      await page.waitForFunction(() => window.world3d && window.__perfStats?.()[0]?.scene, null, {
        timeout: 60000,
      });
      await page.evaluate((t) => window.fx?.setTime(t), time);
      await page.addStyleTag({ content: "body > *:not(canvas){display:none !important}" });
      await page.waitForTimeout(3500);
      writeFileSync(`${out}/${room}-${mode}-${time.replace(":", "")}.png`, await page.screenshot());
      if (errors.length) console.log("ERR", room, mode, errors[0]);
      await ctx.close();
    }
await browser.close();
console.log("shots in", out);
