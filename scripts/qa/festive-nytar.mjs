// bun scripts/qa/festive-nytar.mjs [low|medium|high|ultra|both] [--hop]: screenshots and smoke checks of the New Year's
// Eve theme (`nytar`) in 2D (low) and 3D (high). OUT=dir (default /tmp/seasonal-shots/nytar). Files: nytar-2d-<shot>.png,
// nytar-3d-<shot>.png. Checks the watchman talks on E and blocks his tile, the clock blocks, the theme id is `nytar`,
// and (with --hop) that Space at the stroke of midnight is remembered. Needs a local server and Playwright (see lib.mjs).
//
//   QA_ORIGIN=http://localhost:8824 bun scripts/qa/festive-nytar.mjs both --hop
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const hop = args.includes("--hop");
// --only=day,night,show runs just those parts (day includes the hats); the default is all, hop only with --hop.
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");
const want = (part) => !only || only.includes(part);
const TIERS = ["low", "medium", "high", "ultra"];
const first = args.find((a) => !a.startsWith("--"));
const tiers = !first || first === "both" ? ["low", "high"] : [first];
const out = process.env.OUT ?? "/tmp/seasonal-shots/nytar";
mkdirSync(out, { recursive: true });

/** `?sky=` moves the sun and the clock, `&theme=nytar&day=` pins the theme to the same moment. */
const at = (iso) => `?sky=${iso}&weather=clear&theme=nytar&day=${iso.slice(5)}`;
const CASES = {
  day: at("2026-12-31T13:00"),
  eve: at("2026-12-31T21:10"),
  show: at("2026-12-31T19:00"),
  hop: at("2026-12-31T23:57"),
};

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
let failed = 0;
const fail = (tier, why) => {
  failed++;
  console.error(`FAIL ${tier}: ${why}`);
};

for (const tier of tiers) {
  if (!TIERS.includes(tier)) throw new Error(`tier ${tier}`);
  const d = tier === "low" ? "2d" : "3d";
  const page = await openGame(browser, await signUp("n"), tier, { viewport: { width: 1100, height: 700 } });
  await ready(page);
  const shot = async (name) => {
    await page.screenshot({ path: `${out}/nytar-${d}-${name}.png` });
    console.log(`${out}/nytar-${d}-${name}.png`);
  };
  const shotsWithHud = new Set();
  const keys = async (k, n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.press(k);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(500);
  };
  const open = async (query) => {
    // A busy machine loads slowly: wait for the document, and `ready` for the game.
    await page.goto(`${page.url().split("#")[0].split("?")[0]}${query}`, {
      timeout: 180_000,
      waitUntil: "domcontentloaded",
    });
    await ready(page);
    const go = async (ch) => {
      const p = (await portals(page)).find((q) => q.ch === ch);
      if (p) await through(page, p.x, p.y);
    };
    if ((await room(page)) === "upstairs") await go("d");
    if ((await room(page)) === "inn") await go("x");
    if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
    const id = await page.evaluate(() => window.__tm.festive?.id ?? null);
    if (id !== "nytar") fail(tier, `festive is ${id}`);
    // The first shot of a page keeps the HUD (the toast, the accent colour); the rest are the scene alone.
    if (!shotsWithHud.has(query)) {
      shotsWithHud.add(query);
      await page.waitForTimeout(1500);
      await shot(`hud-${Object.keys(CASES).find((k) => CASES[k] === query)}`);
    }
    await page.addStyleTag({ content: "#hud{display:none !important}" });
  };
  const stand = async (x, y) => {
    await walkTile(page, x, y, 90_000);
    await page.waitForTimeout(2500);
    const me = await page.evaluate(() => ({ x: window.__tm.self().x, y: window.__tm.self().y }));
    if (me.x !== x || me.y !== y) fail(tier, `stood at ${me.x},${me.y}, wanted ${x},${y}`);
  };
  const rockets = () => page.evaluate(() => window.__nytar.rockets());
  // Turns the player on the spot (client side: a key press would step, and the server, on the real clock, has no
  // props to stop it on a pinned date).
  const face = (arrow) =>
    page.evaluate((f) => {
      window.__tm.self().facing = f;
    }, arrow.replace("Arrow", "").toLowerCase());

  // The day: the whole town, then the square, the watchman, the clock, the buffet. Everything stands on row 6 and is
  // reached from row 5, which stays open (click-to-walk routes ignore the props, so the walks keep to row 5).
  if (want("day")) {
    await open(CASES.day);
    await stand(11, 5);
    await page.waitForTimeout(3000);
    await keys("-", 3);
    await shot("town-day");
    await keys("0");
    await shot("square-day");
    // The props block their tiles (the client's rule; the server's is `isNytarProp`, on the real clock), and E talks.
    const blocks = await page.evaluate(() =>
      [
        [11, 6],
        [14, 6],
        [12, 6],
        [13, 6],
        [10, 6],
        [11, 5],
      ].map(([x, y]) => window.__nytar.blocks(x, y)),
    );
    if (blocks.join() !== "true,true,true,true,true,false") fail(tier, `blocks are ${blocks}`);
    await face("ArrowDown");
    await page.waitForTimeout(500);
    await page.keyboard.press("e");
    await page.waitForTimeout(500);
    const said = await page.evaluate(() => window.__tm.hud.get().dialog);
    if (!said?.startsWith("Nattevagt Niels:")) fail(tier, `dialog is ${JSON.stringify(said)}`);
    await keys("=", 6);
    await shot("npc-closeup");
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    // The clock, then the buffet (E from the tile above each).
    await stand(14, 5);
    await face("ArrowDown");
    await page.waitForTimeout(300);
    await page.keyboard.press("e");
    await page.waitForTimeout(400);
    const clockSays = await page.evaluate(() => window.__tm.hud.get().dialog);
    if (!clockSays?.startsWith("The Nytårsur")) fail(tier, `clock dialog is ${JSON.stringify(clockSays)}`);
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    await shot("clock-closeup");
    await stand(12, 5);
    await face("ArrowDown");
    await page.keyboard.press("e");
    await page.waitForTimeout(400);
    const tableSays = await page.evaluate(() => window.__tm.hud.get().dialog);
    if (!tableSays?.startsWith("The Nytårs buffet"))
      fail(tier, `buffet dialog is ${JSON.stringify(tableSays)}`);
    await page.evaluate(() => window.__tm.hud.set({ dialog: null }));
    await shot("buffet-closeup");
    await keys("0");
  }

  // Hats on the character, away from the props: set locally (the shop sells them only round the real New Year).
  // The 3D town dresses someone again when their `info` is replaced (the server's way), so it is.
  if (want("hats")) {
    await open(CASES.day);
    await stand(8, 5);
    await stand(7, 6);
    await keys("=", 8);
    const wear = (hat) =>
      page.evaluate((hat) => {
        const me = window.__tm.self();
        me.info = { ...me.info, look: { ...me.info.look, hat } };
      }, hat);
    for (const [i, name] of ["partyhat", "tophat", "kransekage"].entries()) {
      await wear(255 + i);
      await face("ArrowDown");
      await page.waitForTimeout(2500);
      await shot(`hat-${name}`);
    }
    await wear(0);
    await keys("0");
  }

  // The night: lights between the lamps, the clock lit.
  if (want("night")) {
    await open(CASES.eve);
    await stand(11, 5);
    await page.waitForTimeout(3000);
    await keys("-", 3);
    await shot("town-night");
    await keys("0");
    await shot("square-night");
    await keys("=", 2);
    await shot("clock-night");
    await keys("0");
  }

  // The evening's small show (two and a half minutes from 19:00), from the square's north side so the sky shows.
  if (want("show")) {
    await open(CASES.show);
    await stand(10, 2);
    await page.waitForTimeout(4000);
    if ((await rockets()) === 0) fail(tier, "no rockets in the evening show");
    await keys("-", 1);
    // A few frames a second apart: rockets climb, burst and fade.
    for (const n of [1, 2, 3]) {
      console.log(`${tier} rockets in the air: ${await rockets()}`);
      await shot(`show-evening-${n}`);
      await page.waitForTimeout(1100);
    }
    await keys("0");
  }

  // Midnight: Space as it strikes is remembered (hopping every 0.4 s from five seconds before it), the confetti
  // flies, and the big show goes up. The page's clock starts three minutes before it.
  if (hop && want("hop")) {
    await open(CASES.hop);
    await stand(8, 5);
    await page.evaluate(() => localStorage.removeItem("nytar:hop:2027"));
    let shotConfetti = false;
    let shotShow = false;
    for (;;) {
      const left = await page.evaluate(() => window.__nytar.left());
      if (left < -9000) break;
      if (left < 5000 && left > -4000) await page.keyboard.press("Space");
      if (left < -800 && !shotConfetti) {
        shotConfetti = true;
        await shot("hop-confetti");
      }
      if (left < -7000 && !shotShow) {
        shotShow = true;
        if ((await rockets()) === 0) fail(tier, "no rockets at midnight");
        await keys("-", 1);
        // A few frames a second apart: rockets climb, burst and fade.
        for (const n of [1, 2, 3]) {
          await shot(`show-midnight-${n}`);
          await page.waitForTimeout(1100);
        }
        await keys("0");
      }
      await page.waitForTimeout(400);
    }
    const flag = await page.evaluate(() => localStorage.getItem("nytar:hop:2027"));
    if (flag !== "1") fail(tier, `hop flag is ${flag}`);
  }
  if (page.errors.length) fail(tier, page.errors.slice(-4).join(" | "));
  await page.context().close();
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
