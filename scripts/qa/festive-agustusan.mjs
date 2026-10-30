// bun scripts/qa/festive-agustusan.mjs [low|high|both] [scene ...]: screenshots of Agustusan (10-17 Aug) in 2D (low) and 3D
// (high), from several angles: the whole town as it builds up, the square, Pak Budi close up and talking, the panjat
// pinang pole with a climber, the tumpeng and gapura, the sack-race lane, the hats on a character, and the dusk.
// Asserts the theme is on, the NPC is in the registry and the page logged no errors. OUT=dir (default
// /tmp/seasonal-shots/agustusan), files agustusan-2d-<scene>.png / agustusan-3d-<scene>.png. Needs a local server and
// Playwright (see lib.mjs), QA_ORIGIN=http://localhost:8827 for this theme's server.
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const tiers = ["low", "high"].includes(args[0])
  ? [args.shift()]
  : args[0] === "both"
    ? (args.shift(), ["low", "high"])
    : ["low", "high"];
const out = process.env.OUT ?? "/tmp/seasonal-shots/agustusan";
mkdirSync(out, { recursive: true });

const noon = (d) => `?sky=2026-08-${d}T12:00&weather=clear&theme=agustusan&day=08-${d}T12:00`;
// One scene a line. `inn`/`inn3`: zoom steps in (2D / 3D); `out`: steps out; `via`: waypoints round the props.
// prettier-ignore
const SCENES = [
  // The build-up, the whole town (zoomed all the way out).
  { name: "town-10aug", q: noon("10"), stand: [9, 6], out: 9 },
  { name: "town-14aug", q: noon("14"), stand: [9, 6], out: 9 },
  { name: "town-17aug", q: noon("17"), stand: [9, 6], out: 9 },
  // The square.
  { name: "square", q: noon("17"), stand: [9, 7] },
  { name: "square-rotated", q: noon("17"), stand: [9, 7], rotate: 2 },
  // Pak Budi, and what he says.
  { name: "npc", q: noon("17"), stand: [13, 5], via: [[13, 6]], face: "left", inn: 2, inn3: 7 },
  { name: "npc-side", q: noon("17"), stand: [11, 7], via: [[11, 6]], face: "up", inn: 2, inn3: 7 },
  { name: "npc-back", q: noon("17"), stand: [13, 5], via: [[13, 6]], face: "left", inn: 2, inn3: 7, rotate: 2 },
  { name: "npc-talk", q: noon("17"), stand: [13, 5], via: [[13, 6]], face: "left", inn: 1, inn3: 5, press: ["e"], hud: true },
  // The panjat pinang pole, with a climber partway up, and a press of E on it.
  { name: "pole", q: noon("17"), stand: [13, 8], via: [[12, 7], [12, 8]], face: "up", inn3: 4, climb: 6 },
  { name: "pole-slip", q: noon("17"), stand: [13, 8], via: [[12, 7], [12, 8]], face: "up", inn3: 4, climb: 6, press: ["e"], hud: true },
  // The tumpeng and the gapura.
  { name: "tumpeng", q: noon("17"), stand: [15, 5], via: [[14, 5]], face: "up", inn: 2, inn3: 6 },
  { name: "gapura", q: noon("17"), stand: [9, 6], inn3: 3 },
  { name: "gapura-close", q: noon("17"), stand: [9, 7], inn: 2, inn3: 5 },
  // The sack-race lane and the kerupuk string.
  { name: "lane", q: noon("17"), stand: [6, 6], inn: 1, inn3: 4 },
  { name: "kerupuk", q: noon("17"), stand: [4, 8], via: [[3, 7], [3, 8]], face: "up", inn: 2, inn3: 6, press: ["e"], hud: true },
  // Hats on a character.
  { name: "hat-peci", q: noon("17"), stand: [19, 5], via: [[19, 4]], face: "down", inn: 5, inn3: 10, hat: 270 },
  { name: "hat-ikat", q: noon("17"), stand: [19, 5], via: [[19, 4]], face: "down", inn: 5, inn3: 10, hat: 271 },
  // The evening.
  { name: "dusk", q: "?sky=2026-08-17T21:50&weather=clear&theme=agustusan&day=08-17T21:50", stand: [9, 7], inn3: 1 },
];
const only = args.length ? SCENES.filter((s) => args.includes(s.name)) : SCENES;

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
let failed = 0;
const fail = (why) => {
  failed++;
  console.error(`FAIL ${why}`);
};

for (const tier of tiers) {
  const d = tier === "low" ? "2d" : "3d";
  const page = await openGame(browser, await signUp("ag"), tier, { viewport: { width: 1100, height: 700 } });
  await ready(page);
  const go = async (ch) => {
    const p = (await portals(page)).find((q) => q.ch === ch);
    if (p) await through(page, p.x, p.y);
  };
  for (const s of only) {
    await page.goto(`${page.url().split("#")[0].split("?")[0]}${s.q}`);
    await ready(page);
    if ((await room(page)) === "upstairs") await go("d");
    if ((await room(page)) === "inn") await go("x");
    if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
    const f = await page.evaluate(() => window.__tm.festive);
    if (f?.id !== "agustusan") fail(`${tier} ${s.name}: festive is ${JSON.stringify(f)}`);
    // Start from a tile off the way, walk to the spot, and face as asked.
    for (const [vx, vy] of s.via ?? []) await walkTile(page, vx, vy);
    await walkTile(page, s.stand[0], s.stand[1]);
    const at = await page.evaluate(() => ({ x: window.__tm.self().x, y: window.__tm.self().y }));
    if (at.x !== s.stand[0] || at.y !== s.stand[1])
      fail(`${tier} ${s.name}: stood at ${at.x},${at.y}, wanted ${s.stand}`);
    if (s.face) {
      await page.keyboard.down(
        { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[s.face],
      );
      await page.waitForTimeout(60);
      await page.keyboard.up(
        { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[s.face],
      );
    }
    await page.keyboard.press("0");
    for (let i = 0; i < (s.out ?? 0); i++) await page.keyboard.press("-");
    for (let i = 0; i < (tier === "low" ? (s.inn ?? 0) : (s.inn3 ?? s.inn ?? 0)); i++)
      await page.keyboard.press("+");
    for (let i = 0; i < (s.rotate ?? 0); i++) await page.keyboard.press("r");
    if (s.climb) await page.evaluate((h) => window.__agustusan?.setClimb(h), s.climb);
    for (const key of s.press ?? []) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(tier === "low" ? 1500 : 3500);
    // The server sends the saved look again now and then: put the hat on just before the shot.
    if (s.hat) {
      await page.evaluate((hat) => {
        const a = window.__tm.world.avatars.get(window.__tm.world.selfId);
        a.info = { ...a.info, look: { ...a.info.look, hat } };
      }, s.hat);
      await page.waitForTimeout(tier === "low" ? 400 : 1500);
    }
    if (!s.hud) await page.addStyleTag({ content: "#hud{visibility:hidden !important}" });
    await page.waitForTimeout(200);
    const path = `${out}/agustusan-${d}-${s.name}.png`;
    await page.screenshot({ path });
    await page.addStyleTag({ content: "#hud{visibility:visible !important}" });
    console.log(path);
  }
  const bad = page.errors.filter((e) => !/favicon|WebGL|GPU|swiftshader/i.test(e));
  if (bad.length) fail(`${tier} page errors: ${bad.slice(-4).join(" | ")}`);
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
