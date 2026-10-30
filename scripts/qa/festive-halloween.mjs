// bun scripts/qa/festive-halloween.mjs [low|medium|high|ultra|both] [name ...]: screenshots of Halloween's spooky night in 2D
// (low) and 3D (high), from several places: the whole town, the graveyard, Gerda close up (and her dialogue), the cauldron, a
// doorstep (knocked on, then again), the dusk of the 30th, and a hat on the player. Asserts the theme is on, Gerda talks and blocks,
// a knock gives candy once a day, and the page has no errors; exits 1 if not. Files: OUT/halloween-<2d|3d>-<name>.png.
//   QA_ORIGIN=http://localhost:8821 OUT=/tmp/seasonal-shots/halloween bun scripts/qa/festive-halloween.mjs
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile as walk } from "./lib.mjs";

const args = process.argv.slice(2);
const TIERS = ["low", "medium", "high", "ultra"];
const tiers = args[0] === "both" || !TIERS.includes(args[0]) ? ["low", "high"] : [args[0]];
if (args[0] === "both" || TIERS.includes(args[0])) args.shift();
const only = new Set(args);
const out = process.env.OUT ?? "/tmp/seasonal-shots/halloween";
mkdirSync(out, { recursive: true });

const PEAK = "?sky=2026-10-31T21:00&weather=clear&theme=halloween&day=10-31T21:00&graveyard=on";
const DUSK = "?sky=2026-10-30T18:30&weather=clear&theme=halloween&day=10-30T18:30&graveyard=on";
const DAWN = "?sky=2026-10-31T13:00&weather=clear&theme=halloween&day=10-31T13:00&graveyard=on";

// A town character may stand in the way: try again (the route is found anew each time).
async function walkTile(page, x, y) {
  for (let i = 0; i < 5; i++) {
    await walk(page, x, y, 12_000);
    const at = await page.evaluate(() => ({ x: window.__tm.self().x, y: window.__tm.self().y }));
    if (at.x === x && at.y === y) return;
    await page.waitForTimeout(1500);
  }
}

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
let failed = 0;
const fail = (tier, why) => {
  failed++;
  console.error(`FAIL ${tier}: ${why}`);
};

for (const tier of tiers) {
  const page = await openGame(browser, await signUp("h"), tier, { viewport: { width: 1100, height: 700 } });
  await ready(page);
  const go = async (ch) => {
    const p = (await portals(page)).find((q) => q.ch === ch);
    if (p) await through(page, p.x, p.y);
  };
  const press = async (key, n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
    }
  };
  const renderer = async () =>
    (await page.evaluate(() => window.__tm.graphics.effective().renderer)) === "3d" ? "3d" : "2d";
  const shot = async (name) => {
    if (only.size && !only.has(name)) return;
    await page.waitForTimeout(1800);
    const d = await renderer();
    await page.screenshot({ path: `${out}/halloween-${d}-${name}.png` });
    console.log(`${out}/halloween-${d}-${name}.png`);
  };
  const open = async (query) => {
    await page.evaluate(() => window.__tm.hud.set({ panel: null, dialog: null }));
    await page.goto(`${page.url().split("#")[0].split("?")[0]}${query}`);
    await ready(page);
    if ((await room(page)) === "upstairs") await go("d");
    if ((await room(page)) === "inn") await go("x");
    if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
  };
  const zoomTo = async (steps) => {
    await press("0");
    if (steps > 0) await press("+", steps);
    if (steps < 0) await press("-", -steps);
    await page.waitForTimeout(600);
  };
  // Turn without stepping (the arrow keys turn with the 3D camera): E uses the way you face.
  const face = async (dir) => {
    await page.evaluate((dir) => {
      window.__tm.self().facing = dir;
    }, dir);
    await page.waitForTimeout(300);
  };
  const dialog = () => page.evaluate(() => window.__tm.hud.get().dialog);
  const candy = () => page.evaluate(() => localStorage.getItem("halloween:candy"));

  await open(PEAK);
  const info = await page.evaluate(() => ({
    f: window.__tm.festive,
    accent: document.documentElement.dataset.festive,
  }));
  if (info.f?.id !== "halloween" || info.accent !== "halloween")
    fail(tier, `theme is ${JSON.stringify(info)}`);

  // 1. The whole town, from the square, zoomed out.
  await walkTile(page, 9, 5);
  await zoomTo(-3);
  await shot("town");
  await press("q", 1);
  await shot("town-turned");
  await press("r", 1);

  // 2. The graveyard behind the Tavern, from the road side.
  await walkTile(page, 13, 9);
  await walkTile(page, 13, 11);
  await zoomTo(1);
  await shot("graveyard");
  await press("q", 1);
  await shot("graveyard-turned");
  await press("r", 1);

  // 3. Gerda (west lawn) and her stones: from the square, then close up. She blocks the step, E talks.
  await walkTile(page, -1, 5);
  await zoomTo(-1);
  await shot("gerda-lawn");
  await press("q", 1);
  await shot("gerda-lawn-turned");
  await press("r", 1);
  await walkTile(page, -2, 5);
  await page.evaluate(() => window.__tm.walkTo(-3, 5));
  await page.waitForTimeout(2500);
  const me = await page.evaluate(() => ({ x: window.__tm.self().x, y: window.__tm.self().y }));
  if (me.x !== -2 || me.y !== 5) fail(tier, `Gerda does not block: stood at ${me.x},${me.y}`);
  await face("left");
  await zoomTo(3);
  await shot("gerda");
  await press("e");
  await page.waitForTimeout(400);
  const talk = await dialog();
  if (!talk?.startsWith("Gerda")) fail(tier, `E on Gerda says ${JSON.stringify(talk)}`);
  await shot("gerda-talk");
  await page.evaluate(() => window.__tm.hud.set({ dialog: null }));

  // 4. The cauldron, from the Tavern's path: face it and stir.
  await walkTile(page, 11, 16);
  await face("down");
  await zoomTo(3);
  await shot("cauldron");
  await press("q", 1);
  await shot("cauldron-turned");
  await press("r", 1);
  await press("e");
  await page.waitForTimeout(300);
  if (!(await dialog())) fail(tier, "E on the cauldron says nothing");
  await shot("cauldron-stir");
  await page.evaluate(() => window.__tm.hud.set({ dialog: null }));

  // 5. A doorstep: the Tavern's pumpkin is right of its path. Stand on the path, face it, knock twice.
  await walkTile(page, 13, 16);
  await face("right");
  const before = await candy();
  await zoomTo(2);
  await press("e");
  await page.waitForTimeout(300);
  const knock = await dialog();
  const after = await candy();
  if (!knock) fail(tier, "knocking says nothing");
  console.log("knock:", knock, `candy ${before} -> ${after}`);
  await shot("doorstep");
  await page.evaluate(() => window.__tm.hud.set({ dialog: null, panel: null }));

  // 6. A shop door's step (the first shop door in the map): the cobwebs and pumpkin, then knock twice (the second says
  // "already" and gives nothing).
  const shop = await page.evaluate(() => {
    const m = window.__tm.world.map;
    for (const ch of ["ƒ", "Ç", "Ð", "ð", "Ñ"]) {
      const f = m.find(ch)[0];
      if (f) return { x: f[0], y: f[1], left: m.at(f[0] - 1, f[1] + 1) === "." };
    }
    return null;
  });
  if (shop) {
    await walkTile(page, shop.x, shop.y + 1);
    await face(shop.left ? "left" : "right");
    await zoomTo(2);
    await shot("door");
    await press("r", 1);
    await shot("door-turned");
    await press("q", 1);
    const c0 = await candy();
    await press("e");
    await page.waitForTimeout(300);
    const first = await dialog();
    if (!first?.includes("🎃")) fail(tier, `knocking on a shop door says ${JSON.stringify(first)}`);
    console.log("shop knock:", first, `candy ${c0} -> ${await candy()}`);
    await shot("shop-knock");
    const c1 = await candy();
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    await press("e");
    await page.waitForTimeout(300);
    if (!(await dialog())?.includes("already"))
      fail(tier, `the second knock says ${JSON.stringify(await dialog())}`);
    if ((await candy()) !== c1) fail(tier, "a second knock gave candy again");
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
  }

  // 7. A hat on the player: the three, front and (3D) turned.
  for (const [hat, name] of [
    [230, "witch"],
    [231, "ghost"],
    [232, "bat"],
  ]) {
    await walkTile(page, 9, 5);
    await zoomTo(6);
    await page.evaluate((hat) => {
      const me = window.__tm.self();
      me.info = { ...me.info, look: { ...me.info.look, hat } };
    }, hat);
    await page.waitForTimeout(600);
    await shot(`hat-${name}`);
  }
  await page.evaluate(() => {
    const me = window.__tm.self();
    me.info = { ...me.info, look: { ...me.info.look, hat: 0 } };
  });

  // 8. Dusk on the 30th and the afternoon of the 31st.
  await open(DUSK);
  await walkTile(page, 12, 12);
  await zoomTo(-1);
  await shot("dusk");
  await open(DAWN);
  await walkTile(page, 12, 12);
  await zoomTo(-1);
  await shot("afternoon");

  if (page.errors.length) fail(tier, `page errors: ${page.errors.slice(-3).join(" | ")}`);
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
