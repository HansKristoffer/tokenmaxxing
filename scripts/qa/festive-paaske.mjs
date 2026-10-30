// bun scripts/qa/festive-paaske.mjs [low|high|both] [stage ...]: screenshots of Påske in the town in 2D (low) and 3D (high),
// and a smoke test: the theme is on, the farmer talks, an egg is picked up by walking over it, the hunt chip counts, and
// the chick follows once all eight are found. Stages: whole square npc talk tree frokost stall lambs egg eggs chick seed hat night
// early (all by default). Files: OUT/paaske-2d-<stage>.png and OUT/paaske-3d-<stage>.png (OUT default
// /tmp/seasonal-shots/paaske). Needs a local server (QA_ORIGIN) and Playwright (see lib.mjs).
//
//   QA_ORIGIN=http://localhost:8825 bun scripts/qa/festive-paaske.mjs both
import { mkdirSync } from "node:fs";
import { townMap } from "../../core/src/maps.ts";
import { EASTER_TREE, eggSpots, FARMER_TILE, FROKOST, STALL } from "../../core/src/paaske.ts";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const TIERS = ["low", "high"];
const tiers = args[0] === "both" || !TIERS.includes(args[0]) ? TIERS : [args[0]];
if (args[0] === "both" || TIERS.includes(args[0])) args.shift();
const only = new Set(args);
const want = (s) => only.size === 0 || only.has(s);
const out = process.env.OUT ?? "/tmp/seasonal-shots/paaske";
mkdirSync(out, { recursive: true });

const DAY = "2026-04-04";
const SKY = `${DAY}T15:00`;
const url = (sky = SKY, day = "04-04T15:00") => `?sky=${sky}&weather=clear&theme=paaske&day=${day}`;

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
let failed = 0;
const fail = (tier, why) => {
  failed++;
  console.error(`FAIL ${tier}: ${why}`);
};

for (const tier of tiers) {
  const d = tier === "low" ? "2d" : "3d";
  const page = await openGame(browser, await signUp("pk"), tier, { viewport: { width: 1280, height: 800 } });
  await ready(page);
  const shot = async (name, wait = 1500) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/paaske-${d}-${name}.png` });
    console.log(`${out}/paaske-${d}-${name}.png`);
  };
  const zoom = async (n) => {
    for (let i = 0; i < Math.abs(n); i++) {
      if (tier === "low") await page.keyboard.press(n > 0 ? "+" : "-");
      else await page.evaluate((s) => window.__tm.viewHooks.zoom(s), n > 0 ? 1 : -1);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);
  };
  const reset = () => page.keyboard.press("0");
  /** A shot with the HUD hidden, for the props and the people. */
  const clean = async (name, wait = 1200) => {
    await page.addStyleTag({ content: "#hud{visibility:hidden !important}" });
    await shot(name, wait);
    await page.addStyleTag({ content: "#hud{visibility:visible !important}" });
  };
  const go = async (ch) => {
    const p = (await portals(page)).find((q) => q.ch === ch);
    if (p) await through(page, p.x, p.y);
  };
  const load = async (query) => {
    await page.goto(`${page.url().split("#")[0].split("?")[0]}${query}`);
    await ready(page);
    if ((await room(page)) === "upstairs") await go("d");
    if ((await room(page)) === "inn") await go("x");
    if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
  };
  const talk = async () => page.keyboard.press("e");
  // 3D under software GL runs at a few frames a second: walking takes a while.
  const walk = async (x, y) => {
    // The town's regulars stand in doorways and on routes: ask again from where we got stuck.
    for (let n = 0; n < 4; n++) {
      await walkTile(page, x, y, tier === "low" ? 25_000 : 100_000);
      const at = await page.evaluate(() => [window.__tm.self().x, window.__tm.self().y]);
      if (at[0] === x && at[1] === y) return;
      await page.waitForTimeout(1500);
    }
    const at = await page.evaluate(() => [window.__tm.self().x, window.__tm.self().y]);
    console.warn(`  ${tier}: wanted ${x},${y}, at ${at}`);
  };

  await load(url());
  const info = await page.evaluate(() => window.__tm.festive);
  if (info?.id !== "paaske") fail(tier, `festive is ${JSON.stringify(info)}`);
  console.log(tier, JSON.stringify(info));

  if (want("whole")) {
    await walk(9, 5);
    await zoom(-8);
    await page.addStyleTag({ content: "#hud{visibility:hidden !important}" });
    await shot("whole", 2500);
    await page.evaluate(() => window.__tm.hud.set({ panel: null }));
    await page.addStyleTag({ content: "#hud{visibility:visible !important}" });
    await reset();
    if (tier === "low") for (let i = 0; i < 8; i++) await page.keyboard.press("-");
    await shot("whole-hud", 800);
    if (tier === "low") await reset();
  }
  if (want("square")) {
    await walk(9, 6);
    await page.evaluate(() => window.__tm.viewHooks.zoom?.(0));
    await reset();
    await zoom(tier === "low" ? 0 : -2);
    await shot("square", 1500);
  }
  if (want("npc") || want("talk")) {
    await walk(FARMER_TILE.x + 1, FARMER_TILE.y);
    await page.keyboard.press("ArrowLeft");
    await reset();
    await zoom(3);
    await shot("npc", 1500);
    await zoom(3);
    await clean("npc-close", 2000);
    await zoom(-3);
    if (want("talk")) {
      await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
      await talk();
      await page.waitForTimeout(500);
      const dialog = await page.evaluate(() => window.__tm.hud.get().dialog);
      if (!dialog?.startsWith("Farmer Gudrun:")) fail(tier, `E on Gudrun said ${JSON.stringify(dialog)}`);
      await shot("talk", 400);
      await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    }
    // She blocks the way: walking into her leaves us where we are.
    await walk(FARMER_TILE.x + 1, FARMER_TILE.y + 1);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    const at = await page.evaluate(() => [window.__tm.self().x, window.__tm.self().y]);
    if (at[0] === FARMER_TILE.x && at[1] === FARMER_TILE.y) fail(tier, "walked onto Gudrun");
    await reset();
  }
  if (want("stall")) {
    await walk(STALL.x, STALL.y + 1);
    await zoom(4);
    await clean("stall", 1200);
    await reset();
  }
  if (want("tree")) {
    await walk(EASTER_TREE.x + 1, EASTER_TREE.y + 1);
    await zoom(4);
    await clean("tree", 1200);
    await reset();
  }
  if (want("frokost")) {
    await walk(FROKOST.x, FROKOST.y + 2);
    await zoom(3);
    await clean("frokost", 1200);
    await reset();
  }
  if (want("lambs")) {
    await walk(-4, 7);
    await zoom(3);
    await shot("lambs", 1200);
    await shot("lambs-2", 2300);
    await reset();
    await walk(20, 13);
    await zoom(3);
    await shot("bunnies", 1500);
    await reset();
  }
  const eggs = eggSpots(townMap([]), DAY);
  /** The egg the close-up is of: the one with the most open ground round it (no tree or house to hide it). */
  const town = townMap([]);
  const open = (e) => {
    let n = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) if (town.at(e.x + dx, e.y + dy) === ".") n++;
    return n;
  };
  const FIRST = eggs.reduce((best, e, i) => (open(e) > open(eggs[best]) ? i : best), 0);
  if (want("egg") || want("eggs") || want("chick")) {
    // Walk to a tile behind the egg (the camera looks from the bottom right), shoot it in the grass, then step on it.
    const e = eggs[FIRST];
    await walk(e.x - 1, e.y - 1);
    await zoom(5);
    await clean("egg", 1500);
    await walk(e.x, e.y);
    await page.waitForTimeout(600);
    const chip = await page.textContent(".paaske-eggs").catch(() => null);
    if (!chip?.includes("1 / 8")) fail(tier, `the chip says ${JSON.stringify(chip)} after one egg`);
    await shot("egg-found", 300);
    await reset();
  }
  if (want("seed")) {
    // The quick way to the chick (3D walks are slow): write what the walk would have, and reload.
    await page.evaluate(
      ([day, keys]) => {
        localStorage.setItem(`paaske-eggs:${day}`, JSON.stringify(keys));
        localStorage.setItem(`paaske-chick:${day.slice(0, 4)}`, "1");
      },
      [DAY, eggs.map((e) => `${e.x},${e.y}`)],
    );
    await load(url());
    await walk(9, 6);
    await page.waitForTimeout(2500);
    await zoom(4);
    const chip = await page.textContent(".paaske-eggs").catch(() => null);
    if (!chip?.includes("8 / 8")) fail(tier, `the chip says ${JSON.stringify(chip)} after seeding all eight`);
    await clean("chick", 1500);
    await reset();
  }
  if (want("eggs") || want("chick")) {
    for (const e of eggs.filter((_, i) => i !== FIRST)) await walk(e.x, e.y);
    await page.waitForTimeout(800);
    const chip = await page.textContent(".paaske-eggs").catch(() => null);
    if (!chip?.includes("8 / 8")) fail(tier, `the chip says ${JSON.stringify(chip)} after all eight`);
    await shot("eggs-done", 300);
    await walk(9, 6);
    await page.waitForTimeout(2500);
    await zoom(4);
    await shot("chick", 1000);
    await reset();
  }
  if (want("hat")) {
    // The shop only sells these round Easter (the server's clock is the real one), so try each on: the 3D town's
    // fitting room (`previewLook`) there, the look itself in 2D.
    await walk(9, 6);
    await zoom(tier === "low" ? 4 : 10);
    for (const hat of [260, 261, 262]) {
      await page.evaluate(
        ([hat, three]) => {
          if (three) window.__r3d.entities.previewLook({ hat });
          else {
            const me = window.__tm.self();
            me.info.look = { ...me.info.look, hat };
          }
        },
        [hat, tier !== "low"],
      );
      await clean(`hat-${hat}`, 2500);
    }
    if (tier !== "low") await page.evaluate(() => window.__r3d.entities.previewLook(null));
    await reset();
  }
  if (want("night")) {
    await load(url(`${DAY}T20:40`, "04-04T20:40"));
    await walk(9, 6);
    await zoom(tier === "low" ? 0 : -2);
    await shot("dusk", 2500);
    await load(url("2026-04-05T11:00", "04-05T11:00"));
    await walk(9, 6);
    await zoom(tier === "low" ? 0 : -2);
    await shot("easter-sunday", 2500);
  }
  if (want("early")) {
    await load(url("2026-03-29T11:00", "03-29T11:00"));
    await walk(9, 6);
    await zoom(tier === "low" ? 0 : -2);
    await shot("palm-sunday", 2500);
  }
  const errors = page.errors.filter((e) => !/Failed to load resource|WebSocket/.test(e));
  if (errors.length) fail(tier, errors.slice(-3).join(" | "));
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
