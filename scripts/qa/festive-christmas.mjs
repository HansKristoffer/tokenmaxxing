// bun scripts/qa/festive-christmas.mjs [low|medium|high|ultra|both] [time ...]: Christmas in the town, in 2D (low) and 3D
// (high), from several angles: the whole town, the tree, Nisse Knud, a door with its wreath, the lamps with their
// lights, a hat on a character, and Knud's dialogue. Also a smoke test: the theme must be `christmas`, Knud must be
// where `NISSE_TILE` says and block the way, E on him and on the tree must open the dialog, and the page must have no errors.
// Files: OUT/christmas-2d-<time>-<view>.png and christmas-3d-... (OUT default /tmp/seasonal-shots/christmas).
//
// A time is `MM-DDTHH:MM` (Copenhagen, the pinned day), default: the 18th at noon (bare tree), the 21st at noon, and the
// 24th at 19:00 (everything on, after dark).
//   bun scripts/qa/festive-christmas.mjs high 12-24T19:00
//   QA_ORIGIN=http://localhost:8822 PLAYWRIGHT=... OUT=/tmp/seasonal-shots/christmas bun scripts/qa/festive-christmas.mjs
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const TIERS = ["low", "medium", "high", "ultra"];
const tiers = args[0] === "both" || !TIERS.includes(args[0]) ? ["low", "high"] : [args[0]];
if (args[0] === "both" || TIERS.includes(args[0])) args.shift();
const times = args.length ? args : ["12-18T12:00", "12-21T12:00", "12-24T19:00"];
const out = process.env.OUT ?? "/tmp/seasonal-shots/christmas";
mkdirSync(out, { recursive: true });

// The views: the tile to stand on, how many zoom steps (+ in, - out), quarter turns (3D), and a name.
const VIEWS = [
  { name: "town", at: [10, 10], zoom: -4, turns: 0 },
  { name: "square", at: [10, 9], zoom: -1, turns: 0 },
  { name: "tree", at: [10, 8], zoom: 2, turns: 0 },
  { name: "tree-side", at: [8, 7], zoom: 2, turns: 1 },
  { name: "knud", at: [13, 7], zoom: 3, turns: 0 },
  { name: "lamps", at: [3, 3], zoom: 1, turns: 0 },
  { name: "tavern", at: [13, 17], zoom: 1, turns: 0 },
];

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
let failed = 0;
const fail = (what) => {
  failed++;
  console.error(`FAIL ${what}`);
};

for (const tier of tiers) {
  const d = tier === "low" ? "2d" : "3d";
  const page = await openGame(browser, await signUp("c"), tier, { viewport: { width: 1280, height: 800 } });
  await ready(page);
  const go = async (ch) => {
    const p = (await portals(page)).find((q) => q.ch === ch);
    if (p) await through(page, p.x, p.y);
  };
  const key = async (k, n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.press(k);
      await page.waitForTimeout(120);
    }
  };
  for (const time of times) {
    const iso = `2026-${time}`;
    await page.goto(
      `${page.url().split("#")[0].split("?")[0]}?sky=${iso}&weather=clear&theme=christmas&day=${time}`,
    );
    await ready(page);
    if ((await room(page)) === "upstairs") await go("d");
    if ((await room(page)) === "inn") await go("x");
    const festive = await page.evaluate(() => window.__tm.festive);
    if (festive?.id !== "christmas") fail(`${tier} ${time}: festive is ${JSON.stringify(festive)}`);
    console.log(tier, time, JSON.stringify(festive));
    const shoot = async (name) => {
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${out}/christmas-${d}-${time.replace(":", "")}-${name}.png` });
      console.log(`${out}/christmas-${d}-${time.replace(":", "")}-${name}.png`);
    };
    for (const v of VIEWS) {
      await key("0");
      await walkTile(page, v.at[0], v.at[1]);
      for (let i = 0; i < Math.abs(v.zoom); i++) await key(v.zoom > 0 ? "=" : "-");
      if (d === "3d") for (let i = 0; i < v.turns; i++) await key("r");
      await shoot(v.name);
      if (d === "3d") for (let i = 0; i < v.turns; i++) await key("q");
    }
    // Knud blocks his tile and answers E; the tree answers too.
    await key("0");
    const talk = await page.evaluate(() => {
      const NPC = { x: 13, y: 5 };
      return { room: window.__tm.world.room, npc: NPC };
    });
    await walkTile(page, 13, 6);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(600);
    const at = await page.evaluate(() => {
      const me = window.__tm.self();
      return { x: me.x, y: me.y };
    });
    if (at.x !== 13 || at.y !== 6) fail(`${tier} ${time}: stepped into Knud's tile (${JSON.stringify(at)})`);
    await page.keyboard.press("e");
    await page.waitForTimeout(500);
    const said = await page.evaluate(() => window.__tm.hud.get().dialog);
    if (!said?.startsWith("Nisse Knud:"))
      fail(`${tier} ${time}: E on Knud said ${JSON.stringify(said)} (${talk.room})`);
    await shoot("knud-talk");
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    await walkTile(page, 10, 7);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(500);
    await page.keyboard.press("e");
    await page.waitForTimeout(500);
    const tree = await page.evaluate(() => window.__tm.hud.get().dialog);
    if (!tree?.includes("julehjerte")) fail(`${tier} ${time}: E on the tree said ${JSON.stringify(tree)}`);
    await key("=", 2);
    await shoot("tree-heart");
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    // A hat on a character: the Santa hat, the antlers, the mug, shown on our own avatar only (the 3D town's fitting
    // room preview, or the 2D look): nobody owns them out of season, and the server keeps the real look.
    await key("0");
    await walkTile(page, 6, 7);
    await key("=", 9);
    for (const [name, hat] of [
      ["santa", 240],
      ["antlers", 241],
      ["gloegg", 242],
    ]) {
      await page.evaluate((hat) => {
        const me = window.__tm.self();
        if (window.__r3d) window.__r3d.entities.previewLook({ hat });
        else me.info.look = { ...me.info.look, hat };
      }, hat);
      await shoot(`hat-${name}`);
    }
    await page.evaluate(() => window.__r3d?.entities.previewLook(null));
  }
  if (page.errors.length) fail(`${tier} page errors: ${page.errors.slice(-3).join(" | ")}`);
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
