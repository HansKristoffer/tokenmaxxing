// bun scripts/qa/julemarked.mjs [low|medium|high|ultra|both] : the Julemarked (the Christmas market), in 2D (low) and 3D
// (high): the whole town with the gate's block, a close-up of the gate, then through the gate into the courtyard (a wide view,
// a stall, and E on Nissens bod, which must open the case shop on the Julemarked case). Also a smoke test: the gate is a
// portal, the room is "julemarked" and the page has no errors. Files: OUT/julemarked-<2d|3d>-<view>.png (OUT default
// /tmp/case-shots/julemarked/town). Run on a pinned December day: ?sky=2026-12-02T14:00&weather=clear.
//   QA_ORIGIN=http://localhost:4671 CHROME=... bun scripts/qa/julemarked.mjs both
import { mkdirSync } from "node:fs";
import { openGame, playwright, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const TIERS = ["low", "medium", "high", "ultra"];
const tiers = args[0] === "both" || !TIERS.includes(args[0]) ? ["low", "high"] : [args[0]];
const out = process.env.OUT ?? "/tmp/case-shots/julemarked/town";
mkdirSync(out, { recursive: true });

const pw = await playwright();
const browser = await pw.chromium.launch({
  executablePath: process.env.CHROME || undefined,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let failed = 0;
const fail = (what) => {
  failed++;
  console.error(`FAIL ${what}`);
};

for (const tier of tiers) {
  const d = tier === "low" ? "2d" : "3d";
  const page = await openGame(browser, await signUp("jm"), tier, { viewport: { width: 1280, height: 800 } });
  await ready(page);
  await page.goto(`${page.url().split("#")[0].split("?")[0]}?sky=2026-12-02T14:00&weather=clear`);
  await ready(page);
  const key = async (k, n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.press(k);
      await page.waitForTimeout(120);
    }
  };
  const shoot = async (name) => {
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/julemarked-${d}-${name}.png` });
    console.log(`${out}/julemarked-${d}-${name}.png`);
  };
  const view = async (name, [x, y], zoom, turns = 0) => {
    await key("0");
    await walkTile(page, x, y);
    for (let i = 0; i < Math.abs(zoom); i++) await key(zoom > 0 ? "=" : "-");
    if (d === "3d") for (let i = 0; i < turns; i++) await key("r");
    await shoot(name);
    if (d === "3d") for (let i = 0; i < turns; i++) await key("q");
  };
  if ((await room(page)) === "upstairs") await through(page, ...(await gatePortal(page, "d")));
  async function gatePortal(p, ch) {
    const list = await p.evaluate(() => {
      const m = window.__tm.world.map;
      const o = [];
      for (let y = m.y0; y < m.y0 + m.height; y++)
        for (let x = m.x0; x < m.x0 + m.width; x++) if (m.kind(x, y).portal) o.push({ ch: m.at(x, y), x, y });
      return o;
    });
    const q = list.find((c) => c.ch === ch);
    return q ? [q.x, q.y] : [0, 0];
  }
  if ((await room(page)) === "inn") await through(page, ...(await gatePortal(page, "x")));
  if ((await room(page)) !== "town") fail(`${tier}: not in town (${await room(page)})`);
  const [gx, gy] = await gatePortal(page, "Ȣ");
  if (gx === 0 && gy === 0) fail(`${tier}: the town has no Julemarked gate`);
  await view("town", [10, 4], -4);
  await view("block", [gx + 1, gy + 4], -1);
  await view("gate", d === "2d" ? [gx, gy + 4] : [gx, gy + 3], d === "2d" ? 0 : 2);
  if (d === "3d") await view("gate-side", [gx + 3, gy + 3], 2, 1);
  const inside = await through(page, gx, gy);
  if (inside !== "julemarked") fail(`${tier}: the gate led to ${inside}`);
  await view("market", [12, 11], -1);
  await view("market-wide", [12, 11], -2);
  await view("stall", [4, 6], 2);
  await view("stall-sweets", [19, 6], 2);
  await view("tree", [12, 9], 2);
  await view("exit", [11, 14], 1);
  // E on Nissens bod opens the case shop on the Julemarked case.
  await walkTile(page, 4, 5);
  await page.evaluate(() => window.__tm.hud.set({ panel: null, dialog: null }));
  await key("ArrowUp");
  await key("ArrowUp");
  await page.waitForTimeout(400);
  await key("e");
  await page.waitForTimeout(600);
  const panel = await page.evaluate(() => window.__tm.hud.get().panel);
  if (panel?.kind !== "caseShop") fail(`${tier}: E on Nissens bod gave ${JSON.stringify(panel)}`);
  await shoot("case-shop");
  if (page.errors.length) fail(`${tier}: ${page.errors.join(" | ")}`);
  await page.context().close();
}
await browser.close();
console.log(failed ? `${failed} failed` : "ok");
process.exit(failed ? 1 : 0);
