/** What `town` does for street life (`core/src/street.ts`): the morning paper's facts. */
import { gameOf } from "@tokenmaxxing/core/games/index.ts";
import { random } from "@tokenmaxxing/core/games/random.ts";
import type { PaperFacts } from "@tokenmaxxing/core/paper.ts";
import { dayStart } from "@tokenmaxxing/core/raid.ts";
import { addDays } from "@tokenmaxxing/core/range.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { sortBy, sumBy } from "hanzio";
import { all, type Sql } from "../actors/shared.ts";
import { lookOf, TOKENS, USER_COLS, type UserRow } from "./users.ts";

/** How many days back the paper looks for streaks and comebacks, and for the month before the month. */
const LOOKBACK = 59;

/** The days (newest first, `day` itself first) each person was active, as a set of day keys. */
function streakOf(days: Set<string>, day: string): number {
  let n = 0;
  while (days.has(addDays(day, -n))) n++;
  return n;
}

/** Everything the paper can write about world day `day`, from usage, activity, looks and games. */
export async function paperFacts(sql: Sql, day: string): Promise<PaperFacts> {
  const users = await all<UserRow & { tokens: number }>(
    sql,
    `SELECT ${USER_COLS}, COALESCE(t.tokens, 0) AS tokens FROM users
     LEFT JOIN (SELECT user_id, SUM(${TOKENS}) AS tokens FROM usage_daily WHERE day = ? GROUP BY user_id) t
       ON t.user_id = users.id`,
    day,
  );
  const names = new Map(
    (await all<{ id: number; name: string }>(sql, "SELECT id, name FROM companies")).map((c) => [
      c.id,
      c.name,
    ]),
  );
  const active = users.filter((u) => u.tokens > 0).sort((a, b) => b.tokens - a.tokens);
  // By company as people are in them now: good enough for a paper.
  const byCompany = new Map<number, { tokens: number; members: number }>();
  for (const u of active)
    if (u.companyId !== null) {
      const c = byCompany.get(u.companyId) ?? { tokens: 0, members: 0 };
      byCompany.set(u.companyId, { tokens: c.tokens + u.tokens, members: c.members + 1 });
    }
  const [topCo] = sortBy([...byCompany], { by: ([, c]) => c.tokens, order: "desc" });
  const activity = await all<{ name: string; prs: number; prompts: number }>(
    sql,
    `SELECT users.name, a.prs, a.prompts FROM activity_daily a JOIN users ON users.id = a.user_id
     WHERE a.day = ? ORDER BY a.prs DESC`,
    day,
  );
  const [model] = await all<{ name: string; tokens: number }>(
    sql,
    `SELECT model AS name, SUM(${TOKENS}) AS tokens FROM usage_daily WHERE day = ? AND model != 'unknown'
     GROUP BY model ORDER BY tokens DESC LIMIT 1`,
    day,
  );
  const [game] = await all<{ name: string; game: string; won: number }>(
    sql,
    `SELECT users.name, m.game, m.won FROM match_players m JOIN users ON users.id = m.user_id
     WHERE m.day = ? ORDER BY m.won DESC LIMIT 1`,
    day,
  );
  // One pet owner a day, the same one all day: the day's own seed picks them.
  const owners = users.filter((u) => lookOf(u).pet > 0).sort((a, b) => a.id - b.id);
  const owner = owners[Math.floor(random(Number(day.replaceAll("-", "")))() * owners.length)];
  const shipper = activity[0];

  // The days before: one query for the last two months, then every comparison is arithmetic.
  const from = addDays(day, -LOOKBACK);
  const perDay = await all<{ user_id: number; day: string; tokens: number }>(
    sql,
    `SELECT user_id, day, SUM(${TOKENS}) AS tokens FROM usage_daily WHERE day BETWEEN ? AND ?
     GROUP BY user_id, day`,
    from,
    day,
  );
  const town = new Map<string, number>();
  const seen = new Map<number, Set<string>>();
  const leaders = new Map<string, { id: number; tokens: number }>();
  for (const r of perDay) {
    town.set(r.day, (town.get(r.day) ?? 0) + r.tokens);
    if (r.tokens <= 0) continue;
    (seen.get(r.user_id) ?? seen.set(r.user_id, new Set()).get(r.user_id)!).add(r.day);
    const lead = leaders.get(r.day);
    if (!lead || r.tokens > lead.tokens) leaders.set(r.day, { id: r.user_id, tokens: r.tokens });
  }
  const span = (end: number, days: number) =>
    sumBy(
      Array.from({ length: days }, (_, i) => town.get(addDays(day, -end - i)) ?? 0),
      (n) => n,
    );
  const [bestRow] = await all<{ best: number | null }>(
    sql,
    `SELECT MAX(t) AS best FROM (SELECT SUM(${TOKENS}) AS t FROM usage_daily WHERE day < ? GROUP BY day)`,
    day,
  );
  const byId = new Map(users.map((u) => [u.id, u]));
  // Who has led the most days running, counting back from `day`.
  const leader = leaders.get(day);
  let lead = 0;
  while (leader && leaders.get(addDays(day, -lead))?.id === leader.id) lead++;
  const marathon = sortBy(
    active.map((u) => ({ name: u.name, days: streakOf(seen.get(u.id) ?? new Set(), day) })),
    { by: (m) => m.days, order: "desc" },
  )[0];
  const quietWeek = (id: number) =>
    Array.from({ length: 6 }, (_, i) => addDays(day, -(i + 1))).every((d) => !seen.get(id)?.has(d));
  const wasAround = (id: number) =>
    Array.from({ length: 7 }, (_, i) => addDays(day, -(i + 7))).some((d) => seen.get(id)?.has(d));
  const comeback = active.find((u) => quietWeek(u.id) && wasAround(u.id));
  const [fresh] = await all<{ name: string }>(
    sql,
    "SELECT name FROM users WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 1",
    dayStart(day),
    dayStart(addDays(day, 1)),
  );
  const [shape] = await all<{ cache: number; turns: number; models: number }>(
    sql,
    `SELECT COALESCE(SUM(cache_read), 0) AS cache, COALESCE(SUM(turns), 0) AS turns,
       COUNT(DISTINCT model) AS models FROM usage_daily WHERE day = ?`,
    day,
  );
  const [agents] = await all<{ name: string; peak: number }>(
    sql,
    `SELECT users.name, a.peak_agents AS peak FROM activity_daily a JOIN users ON users.id = a.user_id
     WHERE a.day = ? ORDER BY a.peak_agents DESC LIMIT 1`,
    day,
  );
  const talker = [...activity].sort((a, b) => b.prompts - a.prompts)[0];
  const tokens = sumBy(active, "tokens");
  const lightest = active.at(-1);
  return {
    day,
    tokens,
    people: active.length,
    burner: active[0] ? { name: active[0].name, tokens: active[0].tokens } : null,
    company: topCo ? { name: names.get(topCo[0]) ?? "A company", ...topCo[1] } : null,
    prs: sumBy(activity, "prs"),
    shipper: shipper && shipper.prs > 0 ? { name: shipper.name, prs: shipper.prs } : null,
    prompts: sumBy(activity, "prompts"),
    model: model ?? null,
    pet: owner
      ? {
          owner: owner.name,
          pet: itemById(`pet.${lookOf(owner).pet}`)?.name ?? "pet",
          place:
            owner.companyId !== null && names.has(owner.companyId) ? names.get(owner.companyId)! : "the Inn",
        }
      : null,
    game: game ? { name: game.name, game: gameOf(game.game)?.name ?? game.game, won: game.won } : null,
    trend: {
      prev: town.get(addDays(day, -1)) ?? 0,
      week: span(0, 7),
      prevWeek: span(7, 7),
      month: span(0, 30),
      prevMonth: span(30, 30),
      best: bestRow?.best ?? 0,
      streak:
        leader && lead >= 2 && byId.has(leader.id) ? { name: byId.get(leader.id)!.name, days: lead } : null,
    },
    cache: tokens > 0 ? (shape?.cache ?? 0) / tokens : 0,
    turns: shape?.turns ?? 0,
    models: shape?.models ?? 0,
    agents: agents && agents.peak > 0 ? agents : null,
    talker: talker && talker.prompts > 0 ? { name: talker.name, prompts: talker.prompts } : null,
    newcomer: fresh?.name ?? null,
    comeback: comeback?.name ?? null,
    marathon: marathon && marathon.days >= 3 ? marathon : null,
    light: active.length >= 3 && lightest ? { name: lightest.name, tokens: lightest.tokens } : null,
  };
}
