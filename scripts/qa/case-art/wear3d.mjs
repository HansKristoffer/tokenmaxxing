// Renders the Julemarked 3D wearables (hats, glasses, outfits, held, back) to sheet PNGs in headless Chromium.
//   bunx bun@1.4.4 scripts/qa/case-art/wear3d.mjs [--out /tmp/case-shots/julemarked/3d-wear]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = arg("out", "/tmp/case-shots/julemarked/3d-wear");
mkdirSync(out, { recursive: true });
const built = await Bun.build({
  entrypoints: [join(here, "wear3d-harness.ts")],
  target: "browser",
  format: "iife",
  plugins: [
    {
      name: "web-deps",
      setup(b) {
        b.onResolve({ filter: /^three(\/|$)/ }, (a) => ({
          path: Bun.resolveSync(a.path, join(root, "web/src/render3d/kit")),
        }));
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!built.success) {
  console.error(built.logs.join("\n"));
  process.exit(1);
}
const js = await built.outputs[0].text();
const tmp = join(out, ".harness");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
writeFileSync(
  join(tmp, "index.html"),
  `<!doctype html><meta charset=utf-8><body style="margin:0;background:#111"><script>${js.replaceAll("</script", "<\\/script")}</script>`,
);
const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);
const browser = await pw.chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
page.on("pageerror", (e) => console.error("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.error(m.text()));
await page.goto(
  `file://${join(tmp, "index.html")}${[process.env.VOXEL && "voxel", process.env.STALL && "stall"].filter(Boolean).join(",") ? `#${[process.env.VOXEL && "voxel", process.env.STALL && "stall"].filter(Boolean).join(",")}` : ""}`,
);
await page.waitForFunction(() => document.title === "ready", null, { timeout: 120000 }).catch(() => {});
for (const id of await page.$$eval("canvas[id^=sheet-]", (cs) => cs.map((c) => c.id))) {
  const file = join(out, `${id.replace("sheet-", "")}.png`);
  await page.locator(`#${id}`).screenshot({ path: file });
  console.log(file);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
