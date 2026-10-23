// Renders one concept still: bun scripts/concept-shot.mjs <name> "<query>" [port]
// Needs playwright (any copy; set PLAYWRIGHT to its path) and the dev server on PORT (default 4638).
import { writeFileSync } from "node:fs";

const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);
const [name, query = "", port = "4638"] = process.argv.slice(2);
const params = new URLSearchParams(query);
const w = Number(params.get("w") ?? 1600);
const h = Number(params.get("h") ?? 900);
const browser = await pw.chromium.launch({
  headless: true,
  args: [
    "--use-angle=metal",
    "--enable-gpu-rasterization",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[error]", e.message));
const t = Date.now();
await page.goto(`http://localhost:${port}/concept.html?${query}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
const url = await page.evaluate(() => (window.out ?? document.querySelector("#view")).toDataURL("image/png"));
writeFileSync(`/tmp/3d-concept/media/concept/${name}.png`, Buffer.from(url.split(",")[1], "base64"));
console.log(name, "ok", Date.now() - t, "ms", await page.title());
await browser.close();
