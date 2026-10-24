// SOFT=1 bun scripts/perf/ablate.mjs <room> '<json options>' ['<json options>' ...]: frame time (software GL, 960x540) of one room under pipeline option sets.
const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);

import { readFileSync } from "node:fs";

const [room, ...sets] = process.argv.slice(2);
const soft = !!process.env.SOFT;
const browser = await pw.chromium.launch({
  headless: true,
  args: soft
    ? [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--disable-frame-rate-limit",
        "--disable-gpu-vsync",
      ]
    : ["--use-angle=metal", "--ignore-gpu-blocklist", "--disable-frame-rate-limit", "--disable-gpu-vsync"],
});
const ctx = await browser.newContext({
  viewport: soft ? { width: 960, height: 540 } : { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
await ctx.addInitScript(readFileSync(new URL("./probe.js", import.meta.url), "utf8"));
await ctx.addInitScript(() => localStorage.setItem("demo3d.style", "voxel"));
const page = await ctx.newPage();
await page.goto(
  `${process.env.URL ?? "http://localhost:4652"}/?stage=${/^[A-Z]/.test(room) ? room : `World:${room}`}&q=2`,
);
await page.waitForFunction(() => window.__pipe && window.__probe?.frames > 3, null, { timeout: 90000 });
await page.waitForTimeout(3000);
for (const set of sets) {
  const r = await page.evaluate(
    async ([o, soft]) => {
      const P = window.__probe;
      window.__pipe.configure(JSON.parse(o));
      await new Promise((r) => setTimeout(r, 1500));
      P.reset();
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, soft ? 8000 : 3000));
      const secs = (performance.now() - t0) / 1000;
      const s = [...P.gaps].sort((a, b) => a - b);
      return {
        fps: P.frames / secs,
        p50: s[Math.floor(s.length / 2)],
        n: s.length,
        draws: Math.round(P.draws / P.frames),
      };
    },
    [set, soft],
  );
  console.log(
    set.padEnd(70),
    `fps ${r.fps.toFixed(1)} p50 ${r.p50?.toFixed(1)}ms  frames ${r.n}  draws/frame ${r.draws}`,
  );
}
await browser.close();
