// bun scripts/perf/passes.mjs <room> [style] [q]: draws and triangles per renderer.render call for one frame, and the biggest GPU textures.
const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);

import { readFileSync } from "node:fs";

const [room = "town", style = "voxel", q = "2"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:4652";
const browser = await pw.chromium.launch({
  headless: true,
  args: process.env.SOFT
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    : ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({
  viewport: process.env.SOFT ? { width: 960, height: 540 } : { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
await ctx.addInitScript(readFileSync(new URL("./probe.js", import.meta.url), "utf8"));
await ctx.addInitScript((s) => localStorage.setItem("demo3d.style", s), style);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[error]", e.message));
await page.goto(
  `${url}/?stage=${/^[A-Z]/.test(room) ? room : `World:${room}`}&q=${q}${process.env.EXTRA ?? ""}`,
  { timeout: 120000 },
);
await page.waitForFunction(() => window.world3d && window.__perfStats?.()[0]?.scene, null, {
  timeout: 60000,
});
await page.waitForTimeout(Number(process.env.WAIT ?? 3500));
const out = await page.evaluate(
  async (SAMPLE) => {
    const r = window.__perfRenderer;
    const P = window.__probe;
    const rows = [];
    const o = r.render.bind(r);
    r.render = (sc, cam) => {
      const d0 = P.draws,
        t0 = P.tris,
        w0 = performance.now();
      o(sc, cam);
      P.gl.readPixels(0, 0, 1, 1, P.gl.RGBA, P.gl.UNSIGNED_BYTE, new Uint8Array(4));
      const rt = r.getRenderTarget();
      rows.push({
        what: sc.type === "Scene" ? "scene" : "quad",
        draws: P.draws - d0,
        tris: P.tris - t0,
        ms: Math.round(performance.now() - w0),
        rt: rt ? `${rt.width}x${rt.height}` : "screen",
      });
    };
    const sm = r.shadowMap;
    const so = sm.render;
    sm.render = (l, sc, cam) => {
      const d0 = P.draws,
        t0 = P.tris,
        w0 = performance.now();
      so.call(sm, l, sc, cam);
      if (P.draws > d0) P.gl.readPixels(0, 0, 1, 1, P.gl.RGBA, P.gl.UNSIGNED_BYTE, new Uint8Array(4));
      rows.push({
        what: "shadow",
        draws: P.draws - d0,
        tris: P.tris - t0,
        ms: Math.round(performance.now() - w0),
        rt: "shadow",
      });
    };
    await new Promise((res) => setTimeout(res, SAMPLE));
    const frames = [];
    let cur = [];
    for (const x of rows) {
      cur.push(x);
      if (x.rt === "screen") {
        frames.push(cur);
        cur = [];
      }
    }
    r.render = o;
    return { frames, info: { ...r.info.memory }, progs: r.info.programs.length };
  },
  Number(process.env.SAMPLE ?? 700),
);
console.log(JSON.stringify(out.frames.slice(-2)), JSON.stringify(out.info), out.progs);
await browser.close();
