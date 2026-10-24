// bun scripts/perf/profile.mjs <room> [style] [ms]: a CPU profile of the page's JS, top self-time functions.
const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);
const [room = "town", style = "voxel", ms = "5000"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:4652";
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--disable-frame-rate-limit", "--disable-gpu-vsync"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => localStorage.setItem("demo3d.style", s), style);
const page = await ctx.newPage();
await page.goto(`${url}/?stage=World:${room}&q=2`);
await page.waitForFunction(() => window.world3d && window.__perfStats?.()[0]?.scene, null, {
  timeout: 60000,
});
await page.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
await page.waitForTimeout(Number(ms));
const { profile } = await cdp.send("Profiler.stop");
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  const n = byId.get(id);
  const f = n.callFrame;
  const k = `${f.functionName || "(anon)"} ${f.url.split("/").slice(-2).join("/")}:${f.lineNumber}`;
  self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0));
});
const total = [...self.values()].reduce((a, b) => a + b, 0);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25))
  console.log(`${((v / total) * 100).toFixed(1).padStart(5)}%  ${(v / 1000).toFixed(0).padStart(6)}ms  ${k}`);
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const want = (process.env.CALLERS ?? "traverse,updateMatrixWorld,toDataURL,setStyle").split(",");
for (const w of want) {
  const agg = new Map();
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    if (n.callFrame.functionName !== w) return;
    const chain = [];
    for (let p = parent.get(id), d = 0; p && d < 4; p = parent.get(p), d++)
      chain.push(byId.get(p).callFrame.functionName || "(anon)");
    const k = chain.join(" < ");
    agg.set(k, (agg.get(k) ?? 0) + (dt[i] ?? 0));
  });
  console.log(`-- callers of ${w}`);
  for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, 4))
    console.log(`   ${(v / 1000).toFixed(0)}ms ${k}`);
}
await browser.close();
