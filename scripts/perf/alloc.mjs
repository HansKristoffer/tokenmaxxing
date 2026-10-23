// bun scripts/perf/alloc.mjs <room> [style|tier] [seconds]: where the page allocates JS memory while it runs (CDP heap sampling), top functions by bytes per second, plus GC churn.
const pw = await import(process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs");
const [room = "town", style = "voxel", secs = "6"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:4652";
const tier = ["medium", "high", "ultra"].includes(style);
const browser = await pw.chromium.launch({ headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--js-flags=--expose-gc"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((s) => localStorage.setItem("demo3d.style", s), tier ? "voxel" : style);
const page = await ctx.newPage();
await page.goto(`${url}/?stage=${/^[A-Z]/.test(room) ? room : `World:${room}`}${tier ? `&tier=${style}` : "&q=2"}${process.env.EXTRA ?? ""}`);
await page.waitForFunction(() => window.world3d, null, { timeout: 60000 });
await page.waitForTimeout(4000);
const cdp = await ctx.newCDPSession(page);
await cdp.send("HeapProfiler.enable");
await page.evaluate(() => window.gc?.());
const h0 = await page.evaluate(() => performance.memory.usedJSHeapSize);
await cdp.send("HeapProfiler.startSampling", { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
const frames0 = await page.evaluate(() => (window.__probe?.frames ?? 0));
await page.waitForTimeout(Number(secs) * 1000);
const { profile } = await cdp.send("HeapProfiler.stopSampling");
const total = new Map();
let sum = 0;
const walk = (n, stack = []) => {
  const self = n.selfSize;
  const name = n.callFrame.functionName || "(anon)";
  stack = [...stack, name].slice(-Number(process.env.DEPTH ?? 4));
  if (self) {
    const k = process.env.STACK ? stack.reverse().join(" < ") : `${name} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber + 1}`;
    stack.reverse();
    total.set(k, (total.get(k) ?? 0) + self);
    sum += self;
  }
  n.children.forEach((c) => walk(c, stack));
};
walk(profile.head);
console.log(`${room} ${style}: sampled ${(sum / 1048576 / Number(secs)).toFixed(2)} MB/s allocated`);
for (const [k, v] of [...total].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`${((v / 1024) / Number(secs)).toFixed(0).padStart(7)} KB/s  ${k}`);
await browser.close();
