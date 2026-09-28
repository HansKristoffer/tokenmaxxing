/**
 * Moments: things worth telling people (someone passed you, yesterday's
 * winners, a chat message). The server stores one row per moment; this module
 * renders it for a given viewer, so the helper and the dashboard word it the same.
 */

export type MomentKind =
  | "overtake"
  | "climb"
  | "take_lead"
  | "close_gap"
  | "day_title"
  | "personal_best"
  | "achievement"
  | "chat";

/** The only reactions there are: validation is a lookup and the picker is this row. */
export const REACTIONS = ["🔥", "😂", "👑", "💀", "👀", "🫡"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];
export const isReaction = (s: unknown): s is ReactionEmoji => REACTIONS.includes(s as ReactionEmoji);

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Moment {
  id: number;
  kind: MomentKind;
  actor: string;
  target: string | null;
  groupId: number | null;
  groupName: string | null;
  /** `YYYY-MM-DD` in the group's (or the actor's) timezone. */
  day: string;
  data: Record<string, unknown>;
  createdAt: number;
  reactions: Reaction[];
}

/** Below this many tokens today, being passed isn't news (everyone is at 0 after midnight). */
export const RACE_MIN_TOKENS = 1_000_000;
export const CHAT_MAX_LENGTH = 500;

export type TitleCategory = "tokens" | "parallelism" | "prs";
export const TITLE_EMOJI: Record<TitleCategory, string> = { tokens: "👑", parallelism: "🐙", prs: "🚢" };

export const ACHIEVEMENTS = {
  hat_trick: { emoji: "🎩", name: "Hat trick", desc: "Won the day 3 days in a row" },
  photo_finish: { emoji: "📸", name: "Photo finish", desc: "Won the day by less than 2%" },
  hydra: { emoji: "🐉", name: "Hydra", desc: "10 agents running at once" },
  night_owl: { emoji: "🦉", name: "Night owl", desc: "Agents running between 02:00 and 05:00" },
  polyglot: { emoji: "🗣️", name: "Polyglot", desc: "3 different tools in one day" },
  shipper: { emoji: "📦", name: "Shipper", desc: "5 pull requests in one day" },
  billionaire: { emoji: "💰", name: "Billionaire", desc: "1B lifetime tokens" },
  streak_7: { emoji: "🔥", name: "On fire", desc: "Active 7 days in a row" },
  streak_30: { emoji: "☄️", name: "Unstoppable", desc: "Active 30 days in a row" },
} as const;
export type AchievementKey = keyof typeof ACHIEVEMENTS;

const LEVEL_TITLES = [
  "Newcomer",
  "Prompt Intern",
  "Context Goblin",
  "Cache Enjoyer",
  "Agent Wrangler",
  "Subagent Shepherd",
  "Token Baron",
  "Gigamaxxer",
  "Context Lord",
  "Teramaxxer",
  "Singularity",
];

/** Half-decade steps from 1M: 1M → L1, 10M → L3, 100M → L5, 1B → L7, 10B → L9. */
export function levelFor(tokens: number): { level: number; title: string } {
  const level = tokens < 1e6 ? 0 : Math.floor(2 * Math.log10(tokens / 1e6)) + 1;
  return { level, title: levelTitle(level) };
}

export const levelTitle = (level: number): string => LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)]!;

export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export interface Described {
  title: string;
  body: string;
  /** Worth a macOS notification for this viewer. */
  notify: boolean;
  /** Higher wins when the helper has to drop some. */
  priority: number;
}

const num = (v: unknown) => (typeof v === "number" ? v : 0);

/** Case-insensitive `@name` not followed by more handle characters. */
export const mentions = (text: string, name: string): boolean =>
  new RegExp(`@${name.replace(/[.]/g, "\\.")}(?![a-z0-9._-])`, "i").test(text);

/** One moment, worded for `viewer`. */
export function describeMoment(m: Moment, viewer: string): Described {
  const isActor = m.actor === viewer;
  const isTarget = m.target === viewer;
  const who = isActor ? "You" : m.actor;
  const whom = isTarget ? "you" : (m.target ?? "");
  const where = m.groupName ? ` in ${m.groupName}` : "";
  const d = m.data;
  switch (m.kind) {
    case "overtake":
      return {
        title: `${who} passed ${whom}`,
        body: `${isActor ? "You're" : `${m.actor} is`} #${num(d.rank)}${where} today with ${compact(num(d.tokens))} tokens`,
        notify: isActor || isTarget,
        priority: isTarget ? 3 : 2,
      };
    case "climb":
      return {
        title: `${who} jumped from #${num(d.from)} to #${num(d.to)}`,
        body: `${compact(num(d.tokens))} tokens today${where}`,
        notify: isActor,
        priority: 2,
      };
    case "take_lead":
      return {
        title: isTarget ? `${m.actor} took #1 from you` : `${who} took #1${where}`,
        body: `${compact(num(d.tokens))} tokens today${isTarget ? where : m.target ? `, ahead of ${m.target}` : ""}`,
        notify: true,
        priority: isTarget ? 6 : isActor ? 4 : 1,
      };
    case "close_gap":
      return isTarget
        ? {
            title: `${m.actor} is ${compact(num(d.gap))} behind you`,
            body: `Closing in on your #${num(d.rank)}${where}`,
            notify: true,
            priority: 1,
          }
        : {
            title: `${isActor ? "You're" : `${m.actor} is`} ${compact(num(d.gap))} behind ${m.target}`,
            body: `for #${num(d.rank)}${where} today`,
            notify: isActor,
            priority: 1,
          };
    case "day_title": {
      const cat = d.category as TitleCategory;
      return {
        title: `${TITLE_EMOJI[cat] ?? "🏆"} ${isActor ? "You" : m.actor} won ${m.day}${where}`,
        body: titleValue(cat, num(d.value)),
        notify: true,
        priority: 0,
      };
    }
    case "personal_best":
      return {
        title: isActor ? "Your biggest day yet" : `${m.actor} is having their biggest day yet`,
        body: `${compact(num(d.tokens))} tokens`,
        notify: isActor,
        priority: 2,
      };
    case "achievement": {
      const a = ACHIEVEMENTS[d.key as AchievementKey];
      const label =
        d.key === "level"
          ? `Level ${num(d.level)}: ${levelTitle(num(d.level))}`
          : a
            ? `${a.emoji} ${a.name}`
            : String(d.key);
      return {
        title: isActor ? `Unlocked ${label}` : `${m.actor} unlocked ${label}`,
        body: a?.desc ?? "",
        notify: isActor,
        priority: 2,
      };
    }
    case "chat": {
      const text = typeof d.text === "string" ? d.text : "";
      return {
        title: m.groupName ? `${m.actor} in ${m.groupName}` : m.actor,
        body: text,
        notify: !isActor && mentions(text, viewer),
        priority: 5,
      };
    }
  }
}

function titleValue(cat: TitleCategory, v: number): string {
  if (cat === "parallelism") return `${v.toFixed(1)}×`;
  if (cat === "prs") return `${v} PR${v === 1 ? "" : "s"}`;
  return `${compact(v)} tokens`;
}

/**
 * The morning recap: one line per group from its `day_title` rows, e.g.
 * "Yesterday in Arox" / "👑 anna 84.0M · 🐙 you 3.1× · 🚢 bo 4 PRs".
 */
export function describeDayResults(titles: Moment[], viewer: string): { title: string; body: string } {
  const first = titles[0]!;
  const order: TitleCategory[] = ["tokens", "parallelism", "prs"];
  const parts = [...titles]
    .sort(
      (a, b) =>
        order.indexOf(a.data.category as TitleCategory) - order.indexOf(b.data.category as TitleCategory),
    )
    .map((t) => {
      const cat = t.data.category as TitleCategory;
      const v = num(t.data.value);
      const value = cat === "tokens" ? compact(v) : titleValue(cat, v);
      return `${TITLE_EMOJI[cat]} ${t.actor === viewer ? "you" : t.actor} ${value}`;
    });
  return { title: `Yesterday in ${first.groupName ?? "your group"}`, body: parts.join(" · ") };
}
