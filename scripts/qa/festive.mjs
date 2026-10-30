// bun scripts/qa/festive.mjs [low|medium|high|ultra|both] [case ...]: screenshots of the town under each festive theme
// in 2D (low) and 3D (high), and a smoke test: before each shot it asserts `window.__tm.festive` (the theme in play)
// and the page's `data-festive` are what the case expects, and that the once-a-day toast shows (none for no theme), and
// exits 1 if not. `both` (the default) runs low then high. Files: OUT/<name>-2d.png and OUT/<name>-3d.png (and
// -toast.png ones taken the moment the page is ready, with the toast up); a case's name is its theme, or theme-date
// when two cases share a theme. OUT=dir (default /tmp/festive). Needs a local server and Playwright (see lib.mjs).
//
// A case is `theme@YYYY-MM-DDTHH:MM` (Copenhagen time; moves the sun with ?sky= and the theme with &day=):
//   halloween christmas sanktHans nytar paaske befrielsen agustusan   pin that theme (?theme=<id>&day=MM-DDTHH:MM)
//   off@2026-10-31T21:00         ?theme=off, expects none (the control)
//   clock@2026-11-15T21:00       no pin, the clock alone (?sky=), expects none; add `=halloween` to expect a theme
//   setting-off@2026-10-31T21:00 no pin, in the window, with the "Seasonal effects" setting off: expects none
// Default cases: every theme at its evening peak, and the off control.
//
//   bun scripts/qa/festive.mjs high halloween@2026-10-31T21:00 off@2026-10-31T21:00
//   OUT=/tmp/seasonal-shots/framework bun scripts/qa/festive.mjs
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const args = process.argv.slice(2);
const TIERS = ["low", "medium", "high", "ultra"];
const tiers = args[0] === "both" || !TIERS.includes(args[0]) ? ["low", "high"] : [args[0]];
if (args[0] === "both" || TIERS.includes(args[0])) args.shift();
const cases = args.length
  ? args
  : [
      "halloween@2026-10-31T21:00",
      "christmas@2026-12-23T17:00",
      "sanktHans@2026-06-23T21:00",
      "nytar@2026-12-31T23:30",
      "paaske@2026-04-05T18:30",
      "befrielsen@2026-05-04T21:30",
      "agustusan@2026-08-17T17:30",
      "off@2026-10-31T21:00",
    ];
const out = process.env.OUT ?? "/tmp/festive";
mkdirSync(out, { recursive: true });

/** `halloween@2026-10-31T21:00=x` -> { kind, iso, want, url } */
function parse(text) {
  const m = /^([A-Za-z-]+)@(\d{4}-\d\d-\d\dT\d\d:\d\d)(?:=(halloween|christmas|none))?$/.exec(text);
  if (!m) throw new Error(`bad case ${text}: want theme@YYYY-MM-DDTHH:MM`);
  const [, kind, iso, explicit] = m;
  const day = iso.slice(5);
  const base = `?sky=${iso}&weather=clear`;
  const ids = ["halloween", "christmas", "sanktHans", "nytar", "paaske", "befrielsen", "agustusan"];
  const table = {
    ...Object.fromEntries(ids.map((id) => [id, [`${base}&theme=${id}&day=${day}`, id]])),
    off: [`${base}&theme=off`, "none"],
    clock: [base, "none"],
    "setting-off": [base, "none"],
  };
  if (!table[kind]) throw new Error(`unknown theme ${kind} in ${text}`);
  const [query, want] = table[kind];
  return { name: kind, iso, kind, query, want: explicit ?? want };
}

const parsed = cases.map(parse);
for (const c of parsed)
  if (parsed.filter((d) => d.kind === c.kind).length > 1) c.name = `${c.kind}-${c.iso.replace(/:/g, "")}`;

const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
let failed = 0;

for (const tier of tiers) {
  const page = await openGame(browser, await signUp("f"), tier, { viewport: { width: 1100, height: 700 } });
  await ready(page);
  const go = async (ch) => {
    const p = (await portals(page)).find((q) => q.ch === ch);
    if (p) await through(page, p.x, p.y);
  };
  const fail = (name, why) => {
    failed++;
    console.error(`FAIL ${tier} ${name}: ${why}`);
  };
  for (const c of parsed) {
    // The setting is saved, so it is set on this page before the next one loads.
    await page.evaluate(
      (off) => window.__tm.graphics.override("seasonal", off ? false : undefined),
      c.kind === "setting-off",
    );
    await page.goto(`${page.url().split("#")[0].split("?")[0]}${c.query}`);
    // The toast is up 8 s from the moment the HUD is, which 3D's slower start can outlast `ready`: catch it first.
    const toast = await page
      .waitForSelector(".festive-toast", { timeout: c.want === "none" ? 6000 : 30_000 })
      .then(async (el) => {
        const text = await el.textContent();
        await page.screenshot({ path: `${out}/${c.name}-${tier === "low" ? "2d" : "3d"}-toast.png` });
        return text;
      })
      .catch(() => null);
    await ready(page);
    const info = await page.evaluate(() => ({
      f: window.__tm.festive,
      accent: document.documentElement.dataset.festive ?? null,
      renderer: window.__tm.graphics.effective().renderer,
    }));
    const d = info.renderer === "3d" ? "3d" : "2d";
    const got = info.f?.id ?? "none";
    if (got !== c.want) fail(c.name, `festive is ${got}, wanted ${c.want}`);
    if ((info.accent ?? "none") !== c.want) fail(c.name, `data-festive is ${info.accent}, wanted ${c.want}`);
    if ((c.want === "none") !== (toast === null)) fail(c.name, `toast is ${JSON.stringify(toast)}`);
    console.log(c.name, d, JSON.stringify(info.f), info.accent, toast);
    // Then in the square, a few seconds on.
    if ((await room(page)) === "upstairs") await go("d");
    if ((await room(page)) === "inn") await go("x");
    if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
    const spot = await page.evaluate(() => {
      const m = window.__tm.world.map;
      let best = null;
      for (let y = m.y0; y < m.y0 + m.height; y++)
        for (let x = m.x0; x < m.x0 + m.width; x++)
          if (m.kind(x, y).walk !== false && m.at(x, y) !== "T") {
            const k = Math.hypot(x - 14, y - 6);
            if (!best || k < best.k) best = { x, y, k };
          }
      return best;
    });
    if (spot) await walkTile(page, spot.x, spot.y);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/${c.name}-${d}.png` });
    console.log(`${out}/${c.name}-${d}.png`);
  }
  if (page.errors.length) fail("page", page.errors.slice(-3).join(" | "));
}
await browser.close();
if (failed) process.exit(1);
console.log("ok");
