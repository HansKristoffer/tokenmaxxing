/**
 * The morning paper: a front page about yesterday in town, filled into templates from numbers the
 * town has anyway, set against the days, weeks and months before it. Pure and seeded by the day, so a
 * day's paper reads the same to everyone and in tests; `town` builds the facts once a day
 * (`server/src/town/street.ts`).
 */
import { compact, fill } from "./format.ts";
import { random } from "./games/random.ts";
import { addDays } from "./range.ts";

/** What the paper can write about one world day. Nulls are things that didn't happen. */
export interface PaperFacts {
  /** The day it's about, `YYYY-MM-DD`. */
  day: string;
  /** Everyone's tokens, and how many people used any. */
  tokens: number;
  people: number;
  burner: { name: string; tokens: number } | null;
  company: { name: string; tokens: number; members: number } | null;
  prs: number;
  shipper: { name: string; prs: number } | null;
  prompts: number;
  model: { name: string; tokens: number } | null;
  pet: { owner: string; pet: string; place: string } | null;
  game: { name: string; game: string; won: number } | null;
  /** The town's tokens before `day`, for the paper to chain yesterday onto. */
  trend: {
    /** The day before. */
    prev: number;
    /** The 7 days ending on `day`, and the 7 before them. */
    week: number;
    prevWeek: number;
    /** The 30 days ending on `day`, and the 30 before them. */
    month: number;
    prevMonth: number;
    /** The biggest day before `day`. */
    best: number;
    /** Whoever has led the board the most days in a row, ending on `day`. */
    streak: { name: string; days: number } | null;
  };
  /** The share of the day's tokens that were cache reads, 0 to 1. */
  cache: number;
  turns: number;
  models: number;
  agents: { name: string; peak: number } | null;
  talker: { name: string; prompts: number } | null;
  newcomer: string | null;
  /** Used tokens on `day` after a week away. */
  comeback: string | null;
  /** The longest run of active days ending on `day`. */
  marathon: { name: string; days: number } | null;
  /** The lightest touch of the day, when the day had enough people to have one. */
  light: { name: string; tokens: number } | null;
}

interface Headline {
  title: string;
  /** The line under it. */
  deck: string;
}

/** One line of the markets box: tokens over a stretch of days, against the stretch before. */
export interface Market {
  label: string;
  value: string;
  /** Against the stretch before, as a fraction (0.2 is up 20%); null when there's nothing to compare. */
  change: number | null;
}

/** A small box in the corner of the page. */
export interface Corner {
  kicker: string;
  text: string;
}

export interface Paper {
  /** The day it's about. */
  day: string;
  headlines: Headline[];
  /** One-liners under "In brief". */
  briefs: string[];
  markets: Market[];
  forecast: string;
  corners: Corner[];
}

/** The lead and six more: two full rows of three. */
export const HEADLINES = 7;
export const BRIEFS = 4;

type Story = [string, string][];

/** The lead: whoever burned the most. `{name}`, `{tokens}`. */
const BURNER: Story = [
  ["{name} burns {tokens} tokens", "Cloud provider sends a fruit basket and a 'we noticed' email."],
  ["{name} hits {tokens} tokens, says it was 'mostly cache reads'", "Accountants unconvinced."],
  ["{name} spends {tokens} tokens on a 'small refactor'", "The diff is 4,000 lines. The PR title is 'nit'."],
  ["{tokens} tokens: {name} tops the board", "Neighbours report hearing laptop fans from across the square."],
];
/** `{name}`, `{tokens}`, `{members}`. */
const COMPANY: Story = [
  [
    "{name} burns {tokens}, calls it 'an investment in velocity'",
    "{members} on the team. One standup. Forty minutes.",
  ],
  ["{name} leads the town with {tokens}", "CFO seen pacing by the fountain."],
  ["{name}: {tokens} tokens and counting", "Insiders say the roadmap is 'just vibes, but fast'."],
];
/** `{prs}`, and `{name}` with `{n}` for the top shipper. */
const PRS: Story = [
  ["{prs} PRs opened in town", "Reviewers update LinkedIn to 'open to work'."],
  ["{name} opens {n} PRs in a day", "Approves own vibes. 'LGTM' remains the town's most-typed phrase."],
  [
    "Merge queue reaches the Inn: {prs} PRs yesterday",
    "{name} alone sent {n}. Nobody read the descriptions.",
  ],
];
/** `{owner}`, `{pet}`, `{place}`. */
const PET: Story = [
  ["{owner}'s {pet} spotted at {place}", "Witnesses say it 'looked like it knew where the bug was'."],
  ["Sighting: a {pet} at {place}", "Belongs to {owner}. Has not been invited to standup. Yet."],
  ["{pet} seen near {place}, refuses to comment", "{owner} says it's 'between projects'."],
];
/** `{name}`, `{game}`, `{won}`. */
const GAME: Story = [
  ["{name} wins 🪙 {won} at {game}", "Plans to spend it on 'compute'. It's pølser."],
  ["{game}: {name} walks off with 🪙 {won}", "Losers demand a rematch and a post-mortem."],
];
/** `{name}`, `{tokens}`. */
const MODEL: Story = [
  [
    "{name} did most of the typing yesterday",
    "{tokens} tokens. It would like that on its performance review.",
  ],
  ["{name} writes {tokens} tokens of the town's code", "Humans 'reviewed' it. Some of it."],
];
/** `{tokens}`, `{people}`, `{prompts}`. */
const TOWN: Story = [
  ["Town burns {tokens} across {people} devs", "The fountain now runs entirely on cache reads."],
  ["{prompts} prompts sent from town", "Most of them were 'try again', 'no, the other one' and 'continue'."],
];
/** `{pct}`, `{tokens}`, `{prev}`: the day against the one before it. */
const DAY_UP: Story = [
  ["Town up {pct}% on the day before", "{tokens} against {prev}. Economists blame 'one more prompt'."],
  ["Burn rate climbs {pct}% overnight", "Nobody can say why. Everybody says 'agents'."],
];
const DAY_DOWN: Story = [
  ["Town down {pct}% on the day before", "{tokens} against {prev}. Analysts suspect a long lunch, or a rate limit."],
  ["Burn rate slips {pct}%", "Sources blame 'touching grass'. Several have since recovered."],
];
/** `{pct}`, `{tokens}`: the week so far against last week. */
const WEEK_UP: Story = [
  ["Week running {pct}% hotter than last", "{tokens} in seven days. The thermostat is a spreadsheet."],
  ["Seven days, {tokens}: up {pct}% on last week", "Nobody was asked. Nobody objected."],
];
const WEEK_DOWN: Story = [
  ["Week running {pct}% cooler than last", "{tokens} in seven days. 'Strategic cooldown', says someone."],
  ["Seven days, {tokens}: down {pct}% on last week", "Insiders call it 'a consolidation phase'. It is a Tuesday."],
];
/** `{pct}`, `{tokens}`: the month against the one before. */
const MONTH_UP: Story = [
  ["Month by month: up {pct}%", "{tokens} in thirty days. The fountain has been upgraded to a firehose."],
];
const MONTH_DOWN: Story = [
  ["Month by month: down {pct}%", "{tokens} in thirty days. Historians will call it 'the Calm'."],
];
/** `{tokens}`, `{best}`. */
const RECORD: Story = [
  ["RECORD: town burns {tokens} in a day", "Beats the old best of {best}. A plaque is being discussed."],
  ["New all-time high: {tokens}", "Previous record, {best}, 'was a warm-up' say sources."],
];
/** `{name}`, `{days}`. */
const STREAK: Story = [
  ["{name} tops the board {days} days running", "Challengers describe the lead as 'unreasonable'."],
  ["{days} days at the top: {name} shows no sign of stopping", "Has been asked to 'leave some tokens for the others'."],
];
/** `{name}`, `{days}`. */
const MARATHON: Story = [
  ["{name} on a {days}-day streak", "Has not been seen to touch grass. Is, by all accounts, thriving."],
  ["{days} days straight for {name}", "'Weekends are a state of mind,' they said, mid-prompt."],
];
/** `{pct}`. */
const CACHE: Story = [
  ["{pct}% of the town's tokens were cache reads", "Experts: 'that's mostly just remembering things loudly'."],
  ["Cache hit rate: {pct}%", "The other {rest}% was new, original and probably a typo."],
];
/** `{name}`, `{peak}`. */
const AGENTS: Story = [
  ["{name} runs {peak} agents at once", "Asked who is in charge, {name} said 'the agents, probably'."],
  ["{peak} agents, one {name}", "Local man 'delegates' so hard the standup has an agenda."],
];
/** `{name}`, `{prompts}`. */
const TALKER: Story = [
  ["{name} sends {prompts} prompts", "Said to have typed 'continue' more than anyone in recorded history."],
  ["{prompts} messages from {name}", "Replies, according to {name}, were 'mostly fine'."],
];
/** `{name}`. */
const NEWCOMER: Story = [
  ["{name} arrives in town", "Welcome basket: a lanyard, a token budget and one sausage."],
  ["New face: {name}", "Has already been asked to 'quickly look at something'."],
];
const COMEBACK: Story = [
  ["{name} returns after a week away", "Says it was 'a digital detox'. Their first prompt was 'what did I miss'."],
  ["{name} is back", "The branch they left is, miraculously, still red."],
];
/** `{name}`, `{tokens}`. */
const LIGHT: Story = [
  ["{name} burns a modest {tokens}", "Praised for 'restraint', mocked for the same."],
  ["{name}: {tokens}, and not a token more", "Accused of 'thinking before prompting'. Denies it."],
];
/** `{models}`. */
const MODELS: Story = [
  ["{models} different models at work in town", "Nobody remembers which one wrote the good part."],
];

/** Stories that need no facts at all: the paper's own made-up wire. Some of them run every day. */
const WIRE: Story = [
  ["Man replaces entire codebase with 'a cleaner approach'", "Original codebase 'was fine, actually'. Tests 'unavailable for comment'."],
  ["Local dev asks AI to 'make it pop', gets confetti", "Production now celebrates every 404."],
  ["Standup runs 40 minutes, discusses standup", "Motion to make it shorter referred to a committee."],
  ["Rubber duck promoted to Staff Engineer", "'It listens better than most,' says the committee."],
  ["Meeting could have been an email, confirms email", "Email could have been a prompt. Prompt could have been silence."],
  ["Coffee machine achieves sentience, files bug against itself", "Closed as 'works on my machine'."],
  ["'It works on my machine' ships to production", "The machine has been recalled."],
  ["Intern finds off-by-one error, enters a fugue state", "Is expected to make a full recovery by Q3."],
  ["Town's last tab-versus-spaces debate ends in a draw", "Both sides claim victory. A linter claims everything."],
  ["Friday deploy goes 'surprisingly fine', nobody trusts it", "Someone has gone to check the logs. Slowly."],
  ["Sprint planning 'quick' for third week running", "Sources say the sprint 'has not yet been informed'."],
  ["Regex now 'basically understood' by two people", "Both have promised not to touch it. Both are lying."],
  ["Local branch named 'final-final-v3' declared stable", "Its sibling 'final-final-v3-REAL' disagrees."],
  ["Dependency update 'just a patch', breaks 14 things", "The patch notes read: 'misc fixes'. They were not misc."],
  ["Clean git history spotted in the wild", "Experts urge calm. Do not approach."],
  ["Missing semicolon sighted; entire afternoon vanishes", "Authorities recover the afternoon in a different timezone."],
];

/** When there's nothing to report. */
const QUIET: Story = [
  ["Quiet day in town", "CI took a long lunch. Nobody noticed."],
  ["Build snail still deploying", "Sources close to the snail say it's 'nearly there'."],
  ["Nothing shipped, everything is fine", "Everything is not fine. But nothing shipped."],
  ["Pølsevogn reports steady demand", "'Med det hele' remains the house favourite."],
  ["Town clock confirms it is, in fact, Copenhagen time", "Remote workers in other timezones file a ticket."],
];

/** One for each weekday of the edition, Sunday first. Always the first brief. */
const WEEKDAYS = [
  "Sunday edition: no standup, only the sound of a cron job.",
  "Monday edition: everyone is 'just catching up'. Nobody has caught up.",
  "Tuesday edition: the only day nobody has a good excuse.",
  "Wednesday edition: halfway to Friday, and the build still isn't green.",
  "Thursday edition: 'tomorrow' is the deadline. It was also yesterday.",
  "Friday edition: no deploys today, said the sign. Someone deployed under it.",
  "Saturday edition: 'just a quick fix' enters its fourth hour.",
];

/** In brief: `{turns}`, `{tokens}`, `{people}`, `{prompts}`, `{prs}`. Some only run when they're true. */
const BRIEF_RANDOM = [
  "The fountain is 'between refills'. Pigeons remain optimistic.",
  "Lost: one sprint goal. Last seen near the backlog. Answers to 'scope'.",
  "Found: a TODO from 2024. Owner unknown. Still relevant.",
  "The Inn reports the wifi password is still 'correct horse'.",
  "A sausage was dropped. Nobody has stepped forward.",
  "Pigeon mistakes the build snail for a deploy. The snail is unbothered.",
  "Weekly reminder: 'sudo' is not a personality.",
  "Town clerk asks everyone to stop naming branches 'wip'. Branches named 'wip2'.",
  "Someone asked the AI to 'be concise'. It wrote four paragraphs about it.",
  "A reviewer has typed 'LGTM' for the 9,000th time. A small ceremony was held.",
  "The bench by the fountain is reserved for 'thinking'. It is full of laptops.",
  "Cache invalidation: still one of the two hard things. Naming remains the other.",
];

/** Weather for token traffic. `{pct}` is the day-on-day change. */
const FORECAST_UP = [
  "Rising: scattered rate limits by afternoon, clearing by Thursday.",
  "Heavy token fall expected. Bring a context window.",
  "Warm front of 'one more prompt' moving in from the north.",
];
const FORECAST_DOWN = [
  "Cooling: light drizzle of 'continue', with brief sunny prompts.",
  "A calm day ahead. Local agents may idle in the shade.",
  "Quiet skies. Cache reads expected to drift in from the west.",
];
const FORECAST_FLAT = [
  "Steady as she goes: 'try again' on all sides.",
  "Fair, with a chance of 'actually, can you also…'.",
  "Unchanged: sixty percent chance of 'one small thing'.",
];

const SIGNS = ["Opus", "Sonnet", "Haiku", "Cache", "Agent", "Linter", "Prompt", "Branch", "Token", "Diff"];
/** The corner boxes: each has a kicker, and a paper runs two different ones. */
const CORNERS: Corner[] = [
  { kicker: "Classifieds", text: "FOR SALE: one pair of context windows. Barely used. 200K each. Ask for 'Dave'." },
  { kicker: "Classifieds", text: "WANTED: someone to review a 4,000-line PR. Pays in exposure and sausages." },
  { kicker: "Classifieds", text: "FREE TO GOOD HOME: legacy codebase. Please take it. It knows where you live." },
  { kicker: "Classifieds", text: "LOST: variable named 'temp'. Answers to 'temp2'. Reward: a refactor." },
  { kicker: "Letters", text: "'Dear Tidende, why is my agent so confident and so wrong? — Concerned, 3rd floor'" },
  { kicker: "Letters", text: "'Dear Tidende, is it normal to talk to the AI like a colleague? — Polite'" },
  { kicker: "Letters", text: "'Dear Tidende, the fountain has no cache reads. Fix it. — Thirsty'" },
  { kicker: "Obituary", text: "Here lies feature/final-final-v2. Merged in a hurry. Survived by 14 TODOs." },
  { kicker: "Obituary", text: "Here lies the build that was green yesterday. We hardly knew why." },
  { kicker: "Sport", text: "Cache reads beat fresh input 4–1 in a match everyone watched at 3x speed." },
  { kicker: "Sport", text: "The Linters hold off the Formatters in a long, pedantic final. Tabs lose again." },
  { kicker: "Crossword", text: "7 across: 'A thing that works, until it doesn't' (4). Everyone writes 'DEMO'." },
  { kicker: "Recipe", text: "Pølse med det hele: one sausage, all the toppings, no plan. Serves one standup." },
  { kicker: "Advice", text: "Tip of the day: read the error. No, the whole thing. Yes, the bit at the top." },
];

/** A day key as a seed: the same paper for everyone, a different one tomorrow. */
function seedOf(day: string): number {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The change from `before` to `now` as a fraction, or null when `before` gives nothing to compare to. */
const change = (now: number, before: number): number | null => (before > 0 ? now / before - 1 : null);

/** A story for a rise or a fall, when the change is big enough to be news (at least 5%). */
function movement(c: number | null, up: Story, down: Story): Story | null {
  if (c === null || Math.abs(c) < 0.05) return null;
  return c > 0 ? up : down;
}

/**
 * Yesterday's front page, in this order of importance: the biggest burner leads; then what the day
 * means against the days, weeks and months before it, and whatever else the town did; two made-up
 * wire stories run in the mix every day, and filler covers a quiet one. `HEADLINES` of them, never the
 * same title twice.
 */
export function headlines(f: PaperFacts, rand = random(seedOf(f.day))): Headline[] {
  const pick = (story: Story, vars: Record<string, string | number> = {}): Headline => {
    const [title, deck] = story[Math.floor(rand() * story.length)]!;
    return { title: fill(title, vars), deck: fill(deck, vars) };
  };
  const t = f.trend;
  const lead = f.burner && pick(BURNER, { name: f.burner.name, tokens: compact(f.burner.tokens) });
  const others: Headline[] = [];
  const add = (story: Story | null | undefined, vars: Record<string, string | number> = {}) => {
    if (story) others.push(pick(story, vars));
  };
  const pct = (c: number | null) => Math.round(Math.abs(c ?? 0) * 100);
  add(f.company && COMPANY, {
    name: f.company?.name ?? "",
    tokens: compact(f.company?.tokens ?? 0),
    members: f.company?.members ?? 0,
  });
  if (f.prs > 0 && f.shipper) add(PRS, { prs: f.prs, name: f.shipper.name, n: f.shipper.prs });
  add(f.pet && PET, { ...f.pet });
  if (f.game && f.game.won > 0) add(GAME, { ...f.game });
  add(f.model && MODEL, { name: f.model?.name ?? "", tokens: compact(f.model?.tokens ?? 0) });
  if (f.people > 1) add(TOWN, { tokens: compact(f.tokens), people: f.people, prompts: f.prompts });
  // The days, weeks and months before: a record, or how this one moved against the last.
  if (t.best > 0 && f.tokens > t.best) add(RECORD, { tokens: compact(f.tokens), best: compact(t.best) });
  const dc = change(f.tokens, t.prev);
  add(movement(dc, DAY_UP, DAY_DOWN), { pct: pct(dc), tokens: compact(f.tokens), prev: compact(t.prev) });
  const wc = change(t.week, t.prevWeek);
  add(movement(wc, WEEK_UP, WEEK_DOWN), { pct: pct(wc), tokens: compact(t.week) });
  const mc = change(t.month, t.prevMonth);
  add(movement(mc, MONTH_UP, MONTH_DOWN), { pct: pct(mc), tokens: compact(t.month) });
  if (t.streak) add(STREAK, { ...t.streak });
  if (f.marathon) add(MARATHON, { ...f.marathon });
  if (f.tokens > 0 && f.cache > 0) {
    const cache = Math.round(f.cache * 100);
    add(CACHE, { pct: cache, rest: 100 - cache });
  }
  if (f.agents && f.agents.peak > 1) add(AGENTS, { ...f.agents });
  if (f.talker && f.talker.prompts > 0) add(TALKER, { ...f.talker });
  if (f.newcomer) add(NEWCOMER, { name: f.newcomer });
  if (f.comeback) add(COMEBACK, { name: f.comeback });
  if (f.light) add(LIGHT, { name: f.light.name, tokens: compact(f.light.tokens) });
  if (f.models > 1) add(MODELS, { models: f.models });
  // Two made-up ones every day, shuffled in with the real ones: which stories make the front page
  // changes from day to day, and so does how much of it is true.
  const wire = shuffle(WIRE, rand).slice(0, 2);
  const quiet = shuffle(QUIET, rand);
  const rest = [...shuffle([...others, ...wire.map(([title, deck]) => ({ title, deck }))], rand), ...quiet.map(([title, deck]) => ({ title, deck }))];
  const front = [...(lead ? [lead] : []), ...rest];
  // Never the same title twice, and WIRE tops up what quiet days leave short.
  const seen = new Set<string>();
  const unique = [...front, ...shuffle(WIRE, rand).map(([title, deck]) => ({ title, deck }))].filter(
    (h) => !seen.has(h.title) && seen.add(h.title),
  );
  return unique.slice(0, HEADLINES);
}

/** Tokens over a day, a week and a month, each against the stretch before it. */
export function markets(f: PaperFacts): Market[] {
  const t = f.trend;
  return [
    { label: "Day", value: compact(f.tokens), change: change(f.tokens, t.prev) },
    { label: "7 days", value: compact(t.week), change: change(t.week, t.prevWeek) },
    { label: "30 days", value: compact(t.month), change: change(t.month, t.prevMonth) },
    { label: "Cache", value: f.tokens > 0 ? `${Math.round(f.cache * 100)}%` : "–", change: null },
  ];
}

/** The page around the headlines: briefs, markets, weather and two corner boxes. */
export function paper(f: PaperFacts): Paper {
  // Its own seed, so adding a brief never reshuffles the headlines.
  const rand = random(seedOf(`${f.day}:page`));
  const weekday = new Date(`${addDays(f.day, 1)}T00:00:00Z`).getUTCDay();
  const factual = [
    f.turns > 0 && `${f.turns.toLocaleString("en")} turns taken. Turns not taken: all the good ones.`,
    f.prs > 0 && `${f.prs} PRs opened. Opinions on them: ${f.prs * 3}.`,
    f.prompts > 0 && `${f.prompts.toLocaleString("en")} prompts sent. 'Continue' was the most common.`,
    f.people > 0 && `${f.people} ${f.people === 1 ? "dev was" : "devs were"} at their desks, in spirit.`,
  ].filter((b): b is string => !!b);
  const briefs = [WEEKDAYS[weekday]!, ...shuffle([...factual.slice(0, 2), ...BRIEF_RANDOM], rand)].slice(0, BRIEFS);
  const dc = change(f.tokens, f.trend.prev);
  const forecast = shuffle(dc === null || Math.abs(dc) < 0.05 ? FORECAST_FLAT : dc > 0 ? FORECAST_UP : FORECAST_DOWN, rand)[0]!;
  const sign = SIGNS[Math.floor(rand() * SIGNS.length)]!;
  const horoscope = {
    kicker: `Horoscope: ${sign}`,
    text: shuffle(
      [
        "A refactor you postponed will return today. It has brought friends.",
        "Beware of 'quick questions'. They are never quick, and rarely questions.",
        "A merge conflict approaches. Remember: theirs is wrong, and yours is the one that is.",
        "Today you will say 'it's probably a caching issue'. You will be right, and so unhappy.",
      ],
      rand,
    )[0]!,
  };
  // Two corners of different kinds; the horoscope joins the pool as its own kind.
  const pool = shuffle([...CORNERS, horoscope], rand);
  const first = pool[0]!;
  const second = pool.find((c) => c.kicker !== first.kicker)!;
  return { day: f.day, headlines: headlines(f), briefs, markets: markets(f), forecast, corners: [first, second] };
}
