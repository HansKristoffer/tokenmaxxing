// bun scripts/qa/festive-befrielsen.mjs [low|high|both] [dusk|day|early ...]: screenshots of Befrielsen (4 and 5 May)
// in 2D (low) and 3D (high): the whole town, the memorial, Henning close up and talking, a lit candle, a house
// window, and the two hats on the player. Asserts the theme is on and the NPC and E work. OUT=dir (default
// /tmp/seasonal-shots/befrielsen), files <OUT>/befrielsen-<2d|3d>-<case>-<shot>.png. Needs a server and Playwright
// (see lib.mjs); QA_ORIGIN=http://localhost:8826 for the port this theme used.
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const TIERS = ["low", "high"];
const tiers = args[0] === "both" || !TIERS.includes(args[0]) ? TIERS : [args[0]];
if (args[0] === "both" || TIERS.includes(args[0])) args.shift();
const CASES = {
  dusk: ["2026-05-04T21:30", "05-04T21:30"],
  night: ["2026-05-04T22:45", "05-04T22:45"],
  day: ["2026-05-05T13:00", "05-05T13:00"],
  early: ["2026-05-04T11:00", "05-04T11:00"],
};
const cases = args.length ? args : ["dusk", "night", "day"];
const out = process.env.OUT ?? "/tmp/seasonal-shots/befrielsen";
mkdirSync(out, { recursive: true });

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-gl=angle"],
});
let failed = 0;
const fail = (why) => {
  failed++;
  console.error(`FAIL ${why}`);
};

for (const tier of tiers) {
  const page = await openGame(browser, await signUp("bf", 8_000_000, true), tier, {
    viewport: { width: 1280, height: 800 },
  });
  await ready(page);
  const d = tier === "low" ? "2d" : "3d";
  for (const name of cases) {
    const [iso, day] = CASES[name];
    // The scenery shots hide the HUD; the ones with a dialog or the toast keep it.
    const shot = async (what, hud = false) => {
      await page.waitForTimeout(700);
      await page.evaluate((hud) => {
        const el = document.getElementById("hud");
        if (el) el.style.visibility = hud ? "visible" : "hidden";
      }, hud);
      await page.waitForTimeout(150);
      const path = `${out}/befrielsen-${d}-${name}-${what}.png`;
      await page.screenshot({ path });
      console.log(path);
    };
    await page.goto(
      `${page.url().split("#")[0].split("?")[0]}?sky=${iso}&weather=clear&theme=befrielsen&day=${day}`,
    );
    await ready(page);
    if ((await room(page)) !== "town") {
      const p = (await portals(page)).find((q) => q.ch === "x" || q.ch === "d");
      if (p) await through(page, p.x, p.y);
    }
    const f = await page.evaluate(() => window.__tm.festive);
    if (f?.id !== "befrielsen") fail(`${tier} ${name}: festive is ${JSON.stringify(f)}`);
    const zoom = async (n) => {
      for (let i = 0; i < Math.abs(n); i++) {
        await page.keyboard.press(n > 0 ? "+" : "-");
        await page.waitForTimeout(120);
      }
    };
    const reset = () => page.keyboard.press("0");
    const where = () => page.evaluate(() => [window.__tm.self().x, window.__tm.self().y]);
    // Walks to a tile (the 3D town is slow to start: try again) and turns to `key`'s way.
    const go = async (x, y, key) => {
      for (let i = 0; i < 4; i++) {
        await walkTile(page, x, y);
        const [cx, cy] = await where();
        if (cx === x && cy === y) break;
      }
      if (key) {
        await page.keyboard.press(key);
        await page.waitForTimeout(600);
      }
    };
    await reset();

    // The whole town, zoomed all the way out, from the square.
    await go(10, 5);
    await zoom(-6);
    await page.waitForTimeout(1500);
    await shot("town");
    await reset();

    // The square and its lawns, a medium view.
    await go(8, 7);
    await zoom(-1);
    await shot("lawn");
    await zoom(1);

    // A house on the west block, and the candles in its windows.
    await go(0, 4);
    await zoom(2);
    await shot("house");
    await zoom(-2);

    // The memorial from the south, then a candle.
    await go(3, 9);
    await go(3, 8, "ArrowUp");
    await zoom(2);
    await page.waitForTimeout(500);
    await shot("memorial");
    await page.keyboard.press("e");
    await page.waitForTimeout(500);
    const dialog = await page.evaluate(() => window.__tm.hud.get().dialog);
    if (!dialog?.includes("candle")) fail(`${tier} ${name}: E at the memorial said ${dialog}`);
    await shot("candle", true);
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));

    // Henning, from the east.
    await go(6, 7, "ArrowLeft");
    await zoom(1);
    await page.waitForTimeout(500);
    await shot("npc");
    await page.keyboard.press("e");
    await page.waitForTimeout(500);
    const talk = await page.evaluate(() => window.__tm.hud.get().dialog);
    if (!talk?.startsWith("Henning:")) fail(`${tier} ${name}: E at Henning said ${talk}`);
    await shot("npc-talk", true);
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    // He blocks: walking into him leaves us put.
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(400);
    const at = await page.evaluate(() => ({ x: window.__tm.self().x, y: window.__tm.self().y }));
    if (at.x !== 6 || at.y !== 7) fail(`${tier} ${name}: walked into Henning, now at ${JSON.stringify(at)}`);

    // The hats, worn: the look is overridden locally for the shot.
    for (const hat of [265, 266]) {
      await page.evaluate((hat) => {
        window.__befHat = setInterval(() => {
          const me = window.__tm.self();
          if (me) me.info = { ...me.info, look: { ...me.info.look, hat } };
        }, 30);
      }, hat);
      await go(7, 9, "ArrowDown");
      await zoom(5);
      await page.waitForTimeout(900);
      await shot(`hat${hat}`);
      await zoom(-5);
      await page.evaluate(() => clearInterval(window.__befHat));
    }
    await reset();
  }
  if (page.errors.length) fail(`${tier} page errors: ${page.errors.slice(-3).join(" | ")}`);
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
