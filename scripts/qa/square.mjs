// bun scripts/qa/square.mjs [tier] : screenshots of the town square, HUD hidden: the whole town zoomed out and the
// square close up, by day, at dusk and at night. OUT=dir saves them (default .data/qa/square). SHOTS picks from
// `day,dusk,night`; ZOOMS from `far,mid,near`; AT=x,y stands somewhere else than the spawn; SEASON and WEATHER
// pass through as `?season=` and `?weather=`; EVAL is an expression to run in the page and print after each shot. The first run starts a few companies, so the square has houses round it.
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const tier = process.argv[2] ?? "high";
const out = process.env.OUT ?? ".data/qa/square";
mkdirSync(out, { recursive: true });
const TIMES = { day: "2026-07-14T13:30", dusk: "2026-10-26T17:40", night: "2026-11-14T22:30" };
const ZOOMS = { far: -6, mid: -2, near: 1 };
const shots = (process.env.SHOTS ?? "day,night").split(",");
const zooms = (process.env.ZOOMS ?? "far,mid").split(",");
const at = process.env.AT?.split(",").map(Number);
const size = (process.env.SIZE ?? "1600x1000").split("x").map(Number);

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
const user = await signUp("sq");
const page = await openGame(browser, user, tier, { viewport: { width: size[0], height: size[1] } });
await ready(page);
const companies = await page.evaluate(() => window.__tm.world.companies?.size ?? 0);
for (let i = companies; i < Number(process.env.COMPANIES ?? 8); i++) await signUp("co", 8_000_000, true);

const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (p) await through(page, p.x, p.y);
};
for (const shot of shots) {
  const query = new URLSearchParams({ sky: TIMES[shot] ?? shot, weather: process.env.WEATHER ?? "clear" });
  if (process.env.SEASON) query.set("season", process.env.SEASON);
  await page.goto(`${page.url().split("#")[0].split("?")[0]}?${query}`);
  await ready(page);
  if ((await room(page)) === "upstairs") await go("d");
  if ((await room(page)) === "inn") await go("x");
  if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
  const [x, y] = at ?? (await page.evaluate(() => window.__tm.spawn ?? [9, 6]));
  await walkTile(page, x, y, 60_000);
  await page.addStyleTag({ content: "#hud{visibility:hidden !important}" });
  for (const zoom of zooms) {
    // The 3D camera's zoom; the 2D tier (Low) keeps its own.
    await page.evaluate(
      (level) => {
        if (window.__r3d) window.__r3d.rig.level = level;
      },
      ZOOMS[zoom] ?? Number(zoom),
    );
    await page.waitForTimeout(Number(process.env.SETTLE ?? 6000));
    const path = `${out}/${tier}-${shot}-${zoom}.png`;
    await page.screenshot({ path });
    console.log(path, page.errors.slice(-3));
  }
  if (process.env.EVAL) console.log(await page.evaluate(process.env.EVAL));
}
await browser.close();
