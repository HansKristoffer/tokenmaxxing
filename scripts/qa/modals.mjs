// bun run qa:modals [low|medium|high|ultra|both] [--only bag-you,raid] [--out dir] [--size 1440x900] [--page]
// Opens every modal of the HUD as a seeded player and screenshots it: one PNG per modal in
// `.data/qa/modals/<tier>/` (git-ignored), plus `_hud.png`, the HUD with nothing open. `both` (the default)
// is Low and High: the HUD has one skin on Low (2D) and another on the 3D tiers. On a 3D tier the world is
// held still (`holdStill` in lib.mjs), so the modals' own 3D (the Bag's preview) still draws live.
//
// `--only` takes names from PANELS below. `--page` shoots the whole window instead of the dialog alone.
// A dialog taller than the window is shot whole: its height cap is lifted for the shot.
// Needs `bun run qa:serve`. The player (level 50, a full bag, a pet, a company with a member and an
// applicant) and five townspeople are made once per server and kept in `.data/qa/hero.json`.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { holdStill, ORIGIN, openGame, playwright, ready } from "./lib.mjs";
import { qaAdminToken, ROOT, STATE_DIR } from "./server.mjs";

const { createClient } = await import(Bun.resolveSync("rivetkit/client", join(ROOT, "server/")));

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const TIERS = ["low", "medium", "high", "ultra"];
const tiers = TIERS.includes(args[0]) ? [args[0]] : ["low", "high"];
const only = opt("only", null)?.split(",");
const outRoot = opt("out", join(STATE_DIR, "modals"));
const [width, height] = opt("size", "1440x900").split("x").map(Number);
const wholePage = args.includes("--page");

const HERO_FILE = join(STATE_DIR, "hero.json");
const from = (ip, params) =>
  createClient({ endpoint: `${ORIGIN}/api/rivet`, headers: { "x-real-ip": ip } }).town.getOrCreate(
    ["main"],
    params ? { params } : undefined,
  );

/** `days` of usage for `name`: three sessions a day of 40 turns each. */
function usage(name, days, perTurn) {
  const events = [];
  const now = Date.now();
  for (let d = days; d >= 0; d--)
    for (let s = 0; s < 3; s++)
      for (let m = 0; m < 40; m++)
        events.push({
          source: s % 2 ? "codex" : "claude_code",
          sessionId: `${name}-${d}-${s}`,
          agentId: null,
          messageId: `${name}-${d}-${s}-${m}`,
          requestId: null,
          timestamp: now - d * 86_400_000 - (40 - m) * 60_000,
          model: s % 2 ? "gpt-5-codex" : "claude-sonnet-4-5",
          messageType: "assistant",
          inputTokens: perTurn,
          outputTokens: perTurn / 4,
          cacheCreationTokens: 0,
          cacheReadTokens: perTurn * 20,
          reasoningTokens: null,
        });
  return events;
}

/** The hero and the town around them. */
async function seed() {
  const admin = qaAdminToken();
  if (!admin)
    throw new Error("the seed needs the server's admin token: use `bun run qa:serve`, or set ADMIN_TOKEN");
  const tag = Date.now().toString(36).slice(-3);
  const people = [
    { name: `hero${tag}`, days: 20, perTurn: 3_000_000 },
    { name: `anna${tag}`, days: 10, perTurn: 400_000 },
    { name: `bo${tag}`, days: 6, perTurn: 150_000 },
    { name: `cy${tag}`, days: 3, perTurn: 60_000 },
    { name: `dee${tag}`, days: 1, perTurn: 20_000 },
    { name: `eli${tag}`, days: 0, perTurn: 5_000 },
  ];
  const made = [];
  for (const [i, p] of people.entries()) {
    // Sign-ups are limited per IP: each one poses as a new address.
    const ip = `10.6.${Math.floor(Math.random() * 250)}.${10 + i}`;
    const u = await from(ip).signUp(p.name);
    const token = { params: { token: u.token } };
    const player = createClient({ endpoint: `${ORIGIN}/api/rivet`, headers: { "x-real-ip": ip } }).player.get(
      [String(u.userId)],
      token,
    );
    const events = usage(p.name, p.days, p.perTurn);
    for (let at = 0; at < events.length; at += 1000) await player.ingest(events.slice(at, at + 1000));
    made.push({ ...u, town: from(ip, token.params) });
  }
  const [hero, anna, bo, cy] = made;
  const company = await hero.town.createCompany(`Arox ${tag}`);
  await anna.town.apply(company.id);
  await hero.town.approve(anna.userId);
  await bo.town.apply(company.id);
  await cy.town.createCompany(`Solo ${tag}`);
  const asAdmin = from("10.6.9.9", { admin });
  for (const m of made) await asAdmin.adminSetCoins(m.userId, 60_000);
  const buys = [
    ...["outfit.8", "outfit.9", "outfit.10", "outfit.11", "outfit.13"],
    ...["hat.1", "hat.2", "hat.3", "hat.5", "hat.6", "hat.7", "hat.8"],
    ...["glasses.1", "glasses.2", "glasses.3", "glasses.4", "held.1", "held.3", "back.3", "back.4", "back.5"],
    ...["pet.1", "pet.2", "pet.4", "petwear.1", "petwear.3"],
    ...["furn.=", "furn.p", "furn.p", "furn.L", "furn.c", "furn.k", "dance.3"],
  ];
  for (const id of buys)
    await hero.town.buy(id).catch((e) => console.log(`seed: could not buy ${id}: ${e.message}`));
  await hero.town.setBio("Runs too many agents. Reviews none of them.");
  const saved = {
    userId: hero.userId,
    token: hero.token,
    name: hero.name,
    companyId: company.id,
    other: anna.userId,
  };
  await Bun.write(HERO_FILE, JSON.stringify(saved));
  return saved;
}

/** The saved hero when this server knows their token (a `--fresh` or another server does not), else a new one. */
async function hero() {
  try {
    const saved = JSON.parse(readFileSync(HERO_FILE, "utf8"));
    await from("10.6.9.8", { token: saved.token }).me();
    return saved;
  } catch {}
  console.log("seeding a player and a town (once per server)…");
  return seed();
}

const me = await hero();
/** [file name, the panel as `hud.set({ panel })` takes it]. One per modal and, where they differ much, per tab. */
const PANELS = [
  ["menu", { kind: "menu" }],
  ["bag-you", { kind: "bag", tab: "you" }],
  ["bag-pet", { kind: "bag", tab: "pet" }],
  ["bag-things", { kind: "bag", tab: "things" }],
  ["card-me", { kind: "card", userId: me.userId }],
  ["card-other", { kind: "card", userId: me.other }],
  ["raid", { kind: "raid" }],
  ["leaderboard", { kind: "leaderboard" }],
  ["company", { kind: "company" }],
  ["companyCard", { kind: "companyCard", companyId: me.companyId }],
  ["companyShop", { kind: "companyShop" }],
  ["merch", { kind: "merch", companyId: me.companyId }],
  ["shop", { kind: "shop" }],
  ["shops", { kind: "shops" }],
  ["caseShop", { kind: "caseShop" }],
  ["caseLeaderboard", { kind: "caseLeaderboard" }],
  ["caseOpening", { kind: "caseOpening" }],
  ["market-display", { kind: "market", tab: "display" }],
  ["market-shelf", { kind: "market", tab: "shelf" }],
  ["marketSlot", { kind: "marketSlot", slot: 0 }],
  ["merchant", { kind: "merchant" }],
  ["julekalender", { kind: "julekalender" }],
  ["arcade", { kind: "arcade" }],
  ["newTable", { kind: "newTable" }],
  ["retro", { kind: "retro", cabinet: 0 }],
  ["rouletteWatch", { kind: "rouletteWatch" }],
  ["pokerWatch", { kind: "pokerWatch" }],
  ["trade", { kind: "trade", userId: me.other }],
  ["trades", { kind: "trades" }],
  ["quests", { kind: "quests" }],
  ["bar", { kind: "bar" }],
  ["tournament", { kind: "tournament" }],
  ["requests", { kind: "requests" }],
  ["hallOfFame", { kind: "hallOfFame" }],
  ["collection", { kind: "collection" }],
  ["regulars", { kind: "regulars" }],
  ["jukebox", { kind: "jukebox" }],
  ["fishing", { kind: "fishing" }],
  ["prestige", { kind: "prestige" }],
  ["graphics", { kind: "graphics" }],
  ["paper", { kind: "paper" }],
  ["pamphlet", { kind: "pamphlet" }],
  ["keynote", { kind: "keynote" }],
  ["stars", { kind: "stars" }],
  ["trophies", { kind: "trophies", userId: me.userId, name: me.name }],
  ["openOffices", { kind: "openOffices" }],
  ["directory", { kind: "directory" }],
  ["decor", { kind: "decor" }],
  ["desk", { kind: "desk" }],
  ["changelog", { kind: "changelog" }],
];
/** Kinds this script leaves out, and why. A kind in neither list is new: the run says so and fails. */
const SKIPPED = {
  match: "needs a game in play: open one with two players (scripts/qa/crowd.mjs has two)",
  tombstone: "needs a grave's id from the graveyard's own data",
};
const known = new Set([...PANELS.map(([, p]) => p.kind), ...Object.keys(SKIPPED)]);
const store = readFileSync(join(ROOT, "web/src/store.ts"), "utf8");
const union = store.slice(store.indexOf("export type Panel ="), store.indexOf("/** The jukebox's mute"));
const missing = [...union.matchAll(/\| \{ kind: "(\w+)"/g)].map((m) => m[1]).filter((k) => !known.has(k));
const unknown = (only ?? []).filter((name) => !PANELS.some(([n]) => n === name));
if (unknown.length) {
  console.error(`no such modal: ${unknown.join(", ")}. Names: ${PANELS.map(([n]) => n).join(" ")}`);
  process.exit(1);
}

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
let failed = 0;
for (const tier of tiers) {
  const out = join(outRoot, tier);
  mkdirSync(out, { recursive: true });
  const started = Date.now();
  const page = await openGame(browser, me, tier, { viewport: { width, height } });
  await ready(page);
  if (tier !== "low") await holdStill(page);
  if (!only) await page.screenshot({ path: join(out, "_hud.png") });
  let shot = 0;
  for (const [name, panel] of PANELS) {
    if (only && !only.includes(name)) continue;
    await page.evaluate((p) => window.__tm.hud.set({ panel: p, dialog: null }), panel);
    const dialog = page.locator("[role=dialog]").first();
    const path = join(out, `${name}.png`);
    try {
      await dialog.waitFor({ timeout: 5000 });
    } catch {
      failed++;
      console.error(`FAIL ${tier} ${name}: no dialog opened`);
      await page.screenshot({ path });
      continue;
    }
    // Its entrance animation, what it fetches, and in the Bag the 3D preview's first frames.
    await page.waitForTimeout(panel.kind === "bag" ? 1800 : 900);
    const overflow = await dialog.evaluate((el) => el.scrollHeight - el.clientHeight);
    if (wholePage) await page.screenshot({ path });
    else if (overflow <= 20) await dialog.screenshot({ path });
    else {
      // Taller than the window: lift the height cap so the shot has all of it.
      await dialog.evaluate((el) => {
        el.dataset.qaStyle = el.style.cssText;
        el.style.cssText += ";max-height:none;height:auto;position:absolute;top:0";
      });
      await page.setViewportSize({ width, height: Math.min(4000, height + overflow + 40) });
      await page.waitForTimeout(200);
      await dialog.screenshot({ path });
      await dialog.evaluate((el) => {
        el.style.cssText = el.dataset.qaStyle ?? "";
      });
      await page.setViewportSize({ width, height });
    }
    shot++;
  }
  await page.evaluate(() => window.__tm.hud.set({ panel: null }));
  const errors = [...new Set(page.errors)];
  if (errors.length) {
    failed++;
    console.error(`FAIL ${tier}: the page logged errors\n  ${errors.slice(0, 10).join("\n  ")}`);
  }
  console.log(`${tier}: ${shot} modals in ${Math.round((Date.now() - started) / 1000)} s -> ${out}`);
  await page.context().close();
}
await browser.close();
if (missing.length) {
  failed++;
  console.error(
    `FAIL web/src/store.ts has panel kinds this script does not open: ${missing.join(", ")}. Add them to PANELS or SKIPPED.`,
  );
}
process.exit(failed ? 1 : 0);
