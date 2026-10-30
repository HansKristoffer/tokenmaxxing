// bun scripts/qa/festive-sanktHans.mjs [low|medium|high|ultra|both] : screenshots of the Sankt Hans theme in 2D (low)
// and 3D (high): the whole town at three times of the evening, the build-up the day before, the båltaler close up,
// the bonfire with the heks flying, the flags and a door wreath, a picnic blanket, and each of the three hats on
// the player. Also a smoke test: it asserts the theme, the NPC and the dialogue on E, and exits 1 on a mismatch.
// QA_ORIGIN=http://localhost:8823 OUT=/tmp/seasonal-shots/sanktHans bun scripts/qa/festive-sanktHans.mjs
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const TIERS = ["low", "medium", "high", "ultra"];
const tiers = args[0] === "both" || !TIERS.includes(args[0]) ? ["low", "high"] : [args[0]];
const out = process.env.OUT ?? "/tmp/seasonal-shots/sanktHans";
mkdirSync(out, { recursive: true });

/** The pin for a Copenhagen evening: the sun and the theme both. */
const url = (iso, extra = "") => `?sky=${iso}&weather=clear&theme=sanktHans&day=${iso.slice(5)}${extra}`;
const EVE = "2026-06-23T21:45";
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
let failed = 0;
const fail = (tier, why) => {
  failed++;
  console.error(`FAIL ${tier}: ${why}`);
};

for (const tier of tiers) {
  const d = tier === "low" ? "2d" : "3d";
  const page = await openGame(browser, await signUp("sh"), tier, { viewport: { width: 1280, height: 800 } });
  await ready(page);
  const base = page.url().split("#")[0].split("?")[0];
  const load = async (iso, extra = "") => {
    await page.goto(`${base}${url(iso, extra)}`);
    await ready(page);
    if ((await room(page)) === "upstairs") {
      const p = (await portals(page)).find((q) => q.ch === "d");
      if (p) await through(page, p.x, p.y);
    }
    if ((await room(page)) === "inn") {
      const p = (await portals(page)).find((q) => q.ch === "x");
      if (p) await through(page, p.x, p.y);
    }
    if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
    const f = await page.evaluate(() => window.__tm.festive);
    if (f?.id !== "sanktHans") fail(tier, `theme is ${JSON.stringify(f)} at ${iso}`);
  };
  const keys = async (k, n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.press(k);
      await page.waitForTimeout(160);
    }
  };
  const shot = async (name, wait = 2500) => {
    if (only && !only.test(name)) return;
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/sanktHans-${d}-${name}.png` });
    console.log(`${out}/sanktHans-${d}-${name}.png`);
  };
  const reset = () => keys("0");
  // The pathfinder does not know the bonfire is solid: go by the path column x = 7 and the one along y = 16.
  const go = async (x, y) => {
    await walkTile(page, 7, 11);
    await walkTile(page, 7, 16);
    await walkTile(page, x, y);
  };

  // 1. The evening, lit: the whole town from the square, then the lawn.
  await load(EVE);
  await walkTile(page, 9, 10);
  await reset();
  await keys("-", 3);
  await shot("town-evening", 3500);
  await keys("-", 2);
  await shot("town-wide", 1500);
  await reset();

  // 2. The båltaler close up, and her speech on E.
  await go(6, 17);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(500);
  await keys("+", 2);
  await shot("npc", 2500);
  await page.keyboard.press("e");
  await page.waitForTimeout(500);
  const say = await page.evaluate(() => window.__tm.hud.get().dialog);
  if (!say?.startsWith("Birgit the båltaler")) fail(tier, `E on Birgit says ${JSON.stringify(say)}`);
  await shot("npc-talk", 300);
  await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
  // She blocks: walking left from (6,17) stays put.
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(600);
  const at = await page.evaluate(() => ({ x: window.__tm.self().x, y: window.__tm.self().y }));
  if (at.x !== 6) fail(tier, `walked into the båltaler: ${JSON.stringify(at)}`);

  // 3. The bonfire, and the heks flying to Bloksbjerg.
  await go(8, 17);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  await reset();
  await keys("+", 1);
  await shot("bonfire", 1500);
  // Town folk wander through here: close their panel and try again.
  const sendHeks = async () => {
    let said = null;
    for (let tries = 0; tries < 4 && !said?.includes("Bloksbjerg"); tries++) {
      await page.evaluate(() => window.__tm.hud.set({ dialog: null, panel: null }));
      await go(8, 17);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
      await page.keyboard.press("e");
      await page.waitForTimeout(700);
      said = await page.evaluate(() => window.__tm.hud.get().dialog);
    }
    return said;
  };
  const heks = await sendHeks();
  if (!heks?.includes("Bloksbjerg")) fail(tier, `E on the fire says ${JSON.stringify(heks)}`);
  // Her flight frozen at a point (?heksat=), so a slow machine still catches her in the air.
  for (const [n, at] of [
    [1, 0.1],
    [2, 0.3],
    [3, 0.55],
  ]) {
    await load(EVE, `&heksat=${at}`);
    await sendHeks();
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    await keys("-", 1);
    await shot(`heks-${n}`, 1500);
  }

  // 4. Flags and a wreath at the Tavern door, picnic blankets.
  await reset();
  await go(13, 17);
  await page.keyboard.press("ArrowUp");
  await keys("+", 1);
  await shot("tavern-door", 2000);
  await go(12, 17);
  await keys("+", 1);
  await shot("picnic", 1500);
  await reset();
  await go(2, 16);
  await shot("pond-glow", 1500);

  // 5. The hats, on the player: each worn in turn.
  await go(12, 16);
  await reset();
  await keys("+", 3);
  for (const [n, hat] of [
    ["wreath", 250],
    ["heks", 251],
    ["straw", 252],
  ]) {
    await page.evaluate((h) => {
      const me = window.__tm.self();
      me.info = { ...me.info, look: { ...me.info.look, hat: h } };
    }, hat);
    await shot(`hat-${n}`, 1200);
  }

  // 6. The build-up the day before: morning on the 22nd, then the afternoon of the 23rd, then night.
  await load("2026-06-22T11:00");
  await walkTile(page, 9, 10);
  await reset();
  await keys("-", 3);
  await shot("town-buildup-22nd", 3000);
  await load("2026-06-23T18:30");
  await walkTile(page, 9, 10);
  await keys("-", 3);
  await shot("town-afternoon-pile", 3000);
  await load("2026-06-23T23:40");
  await walkTile(page, 9, 12);
  await keys("-", 3);
  await shot("town-night", 3000);

  if (page.errors.length) fail(tier, page.errors.slice(-3).join(" | "));
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
