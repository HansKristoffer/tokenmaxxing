/**
 * Tokenmaxxing: burn the most real tokens in the time you agreed on. Nobody moves;
 * the match pulls each player's tokens from their synced events, counting only
 * events stamped inside the battle, and keeps counting late syncs for a few
 * minutes after the end.
 */
import { compact } from "../format.ts";
import { type Callout, type GameDef, refused } from "./types.ts";

export const MINUTES = [15, 30, 60, 240, 1440] as const;
/** Everyone gets time to fire up their agents; the battle starts on the minute after this. */
export const COUNTDOWN_MS = 60_000;
/** Late syncs still count, for events stamped before the end. */
export const GRACE_MS = 3 * 60_000;
/** ponytail: a fixed cap per player per minute; tune it from real battles. */
export const MINUTE_CAP = 50_000_000;
/** Chart points kept per player; older ones are thinned out. */
const MAX_POINTS = 120;

type Phase = "countdown" | "live" | "grace" | "over";

export interface TokenmaxxingState {
  players: number[];
  minutes: number;
  startsAt: number;
  endsAt: number;
  phase: Phase;
  tokens: Record<number, number>;
  /** [time, tokens so far] per player, for the chart. */
  history: Record<number, [number, number][]>;
  flagged: number[];
  forfeited: number[];
}

export type TokenmaxxingView = Omit<TokenmaxxingState, "minutes"> & { graceUntil: number };

const ranked = (s: TokenmaxxingState) =>
  s.players
    .filter((p) => !s.forfeited.includes(p))
    .sort((a, b) => (s.tokens[b] ?? 0) - (s.tokens[a] ?? 0) || a - b);
const leader = (s: TokenmaxxingState) => {
  const [first, second] = ranked(s);
  return first !== undefined && (s.tokens[first] ?? 0) > (second === undefined ? 0 : (s.tokens[second] ?? 0))
    ? first
    : null;
};
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

function phaseAt(s: TokenmaxxingState, now: number): Phase {
  if (now < s.startsAt) return "countdown";
  if (now < s.endsAt) return "live";
  return now < s.endsAt + GRACE_MS ? "grace" : "over";
}

export const tokenmaxxing: GameDef<TokenmaxxingState, TokenmaxxingView> = {
  id: "tokenmaxxing",
  name: "Tokenmaxxing",
  emoji: "🏁",
  blurb: "Burn the most real tokens before the time runs out.",
  players: { min: 2, max: 12 },
  tickMs: 1000,
  options: { minutes: MINUTES },
  holdPlayers: false,

  setup(players, _seed, options, now) {
    const minutes = Number(options.minutes) || 60;
    // On the minute, at least a minute from now.
    const startsAt = Math.ceil((now + COUNTDOWN_MS) / 60_000) * 60_000;
    return {
      players,
      minutes,
      startsAt,
      endsAt: startsAt + minutes * 60_000,
      phase: "countdown",
      tokens: Object.fromEntries(players.map((p) => [p, 0])),
      history: Object.fromEntries(players.map((p) => [p, [[startsAt, 0]]])),
      flagged: [],
      forfeited: [],
    };
  },

  move: () => refused("Burn tokens in your editor: they count here on their own."),

  tick(s, now) {
    const phase = phaseAt(s, now);
    return phase === s.phase ? s : { ...s, phase };
  },

  usageWindow: (s) =>
    s.phase === "over" ? null : { from: s.startsAt, to: s.endsAt, until: s.endsAt + GRACE_MS },

  usage(s, player, { tokens, flagged }, now) {
    if (s.phase === "over" || s.forfeited.includes(player) || !s.players.includes(player)) return s;
    const was = s.tokens[player] ?? 0;
    const flag = flagged && !s.flagged.includes(player) ? [...s.flagged, player] : s.flagged;
    if (tokens === was && flag === s.flagged) return s;
    let points = [...(s.history[player] ?? []), [Math.min(now, s.endsAt), tokens] as [number, number]];
    if (points.length > MAX_POINTS) points = points.filter((_, i) => i % 2 === 0 || i === points.length - 1);
    return {
      ...s,
      tokens: { ...s.tokens, [player]: tokens },
      history: { ...s.history, [player]: points },
      flagged: flag,
    };
  },

  forfeit: (s, player) => (s.forfeited.includes(player) ? s : { ...s, forfeited: [...s.forfeited, player] }),

  view: (s) => ({
    players: s.players,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    graceUntil: s.endsAt + GRACE_MS,
    phase: s.phase,
    tokens: s.tokens,
    history: s.history,
    flagged: s.flagged,
    forfeited: s.forfeited,
  }),

  outcome(s) {
    const left = ranked(s);
    const gone = s.forfeited.map((p) => [p]);
    if (left.length <= 1) return { places: [left, ...gone] };
    if (s.phase !== "over") return null;
    if (left.every((p) => !s.tokens[p])) return { void: "Nobody burned a single token." };
    const scores = [...new Set(left.map((p) => s.tokens[p] ?? 0))].sort((a, b) => b - a);
    return { places: [...scores.map((n) => left.filter((p) => (s.tokens[p] ?? 0) === n)), ...gone] };
  },

  // The first 10% of the battle, at most 10 minutes: late bets can't just back the leader.
  betsCloseAt: (s) => s.startsAt + Math.min(10 * 60_000, (s.endsAt - s.startsAt) / 10),

  callouts(before, after) {
    const out: Callout[] = [];
    if (before.phase !== after.phase) {
      if (after.phase === "live") out.push({ player: null, text: "🏁 Go! Burn those tokens" });
      if (after.phase === "grace") out.push({ player: null, text: "⏳ Time! Counting the last tokens…" });
    }
    const was = leader(before);
    const now = leader(after);
    if (now !== null && now !== was) out.push({ player: now, text: "🔥 Takes the lead!" });
    return out;
  },

  board: (s) =>
    ranked(s).map((p) => ({ player: p, value: s.tokens[p] ?? 0, label: compact(s.tokens[p] ?? 0) })),

  headline: (s) =>
    s.phase === "countdown"
      ? "starting…"
      : s.phase === "grace"
        ? "⏳ counting the last tokens…"
        : s.phase === "over"
          ? "final"
          : `${s.minutes >= 60 ? `${s.minutes / 60}h` : `${s.minutes} min`} battle`,

  endsAt: (s) => (s.phase === "live" ? s.endsAt : null),

  status(s, player) {
    const place = ranked(s).indexOf(player);
    if (place < 0) return null;
    return `🏁 ${ordinal(place + 1)} · ${compact(s.tokens[player] ?? 0)}${s.flagged.includes(player) ? " ⚠️" : ""}`;
  },
};
