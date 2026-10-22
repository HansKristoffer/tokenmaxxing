import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import type { Frame, Lobby, MatchChatLine } from "@tokenmaxxing/core/games/wire.ts";
import type { JukeboxNow } from "@tokenmaxxing/core/jukebox.ts";
import type { LootNews } from "@tokenmaxxing/core/loot.ts";
import type { QuestBoard } from "@tokenmaxxing/core/quests.ts";
import { CALM, type Weather } from "@tokenmaxxing/core/sky.ts";
import type { TournamentBoard } from "@tokenmaxxing/core/tournament.ts";
import type { ChatLine, CompanyInfo, Notice, RoomId } from "@tokenmaxxing/core/world.ts";
import type { Me, Raid, Today, Wallet } from "@tokenmaxxing/server/registry";
import { useSyncExternalStore } from "react";

export type Panel =
  | { kind: "leaderboard" }
  | { kind: "card"; userId: number }
  | { kind: "companyCard"; companyId: number }
  | { kind: "company" }
  | { kind: "companyShop" }
  | { kind: "merch"; companyId: number }
  | { kind: "look" }
  | { kind: "shop" }
  | { kind: "merchant" }
  | { kind: "bag" }
  | { kind: "petLooks"; pet: number }
  | { kind: "arcade" }
  | { kind: "newTable"; invite?: number; inviteName?: string; game?: GameId }
  | { kind: "match"; id: number }
  | { kind: "trade"; userId: number }
  | { kind: "trades" }
  | { kind: "paper" }
  | { kind: "trophies"; userId: number; name: string }
  | { kind: "raid" }
  | { kind: "quests" }
  | { kind: "tournament" }
  | { kind: "hallOfFame" }
  | { kind: "collection" }
  | { kind: "regulars" }
  | { kind: "jukebox" }
  | { kind: "menu" };

/** The jukebox's mute and volume, kept on this device. */
export interface JukeSettings {
  muted: boolean;
  volume: number;
}
export const JUKE_KEY = "tokenmaxxing.jukebox";

function loadJukeSettings(): JukeSettings {
  try {
    const s = JSON.parse(localStorage.getItem(JUKE_KEY) ?? "{}") as Partial<JukeSettings>;
    const volume = typeof s.volume === "number" ? Math.min(1, Math.max(0, s.volume)) : 0.6;
    return { muted: s.muted === true, volume };
  } catch {
    return { muted: false, volume: 0.6 };
  }
}

/** Game panels keep the chat usable beside them. */
export const chatBeside = (panel: Panel | null): boolean =>
  panel?.kind === "arcade" || panel?.kind === "newTable" || panel?.kind === "match";

/** Everything the React HUD shows. The canvas world keeps its own state in `game/world.ts`. */
interface HudState {
  status: "connecting" | "ready" | "signedOut" | "expired" | "offline";
  me: Me | null;
  stats: Today["me"] | null;
  wallet: Wallet | null;
  /** Today's quests and the week's. */
  questBoard: QuestBoard | null;
  /** The basement's tournament: the live bracket, and the champion (who has a title in chat). */
  tournament: TournamentBoard | null;
  /** This week's boss and the town's fight with it. */
  raid: Raid | null;
  /** Today's top players by tokens, with me appended when I'm outside them. */
  board: Today["top"];
  room: RoomId;
  occupancy: Partial<Record<RoomId, number>>;
  companies: CompanyInfo[];
  chat: ChatLine[];
  panel: Panel | null;
  /** A line of text at the bottom (inspecting things, locked doors). */
  dialog: string | null;
  /** The room name, shown briefly on entering. */
  banner: { text: string; at: number } | null;
  /** Bumped to ask the chat input to take focus. */
  chatFocus: number;
  /** A line from the server for me: someone asked to join my company, or offered me a trade. */
  notice: (Notice & { at: number }) | null;
  /** Tables, games and where I am in them, live from the arcade. */
  lobby: Lobby | null;
  /** The open match panel's latest frame. */
  frame: Frame | null;
  /** The open match's own chat. */
  matchChat: MatchChatLine[];
  /** How far my clock is ahead of the server's, for countdowns. */
  clockSkew: number;
  /** The table of an invite that just came in, shown as a toast. */
  inviteTable: number | null;
  /** The last time someone @-mentioned me from another room. */
  mention: { line: ChatLine; at: number } | null;
  /** The weather over Copenhagen, from the server. */
  weather: Weather;
  /** What the raid's last kills dropped, for everyone (`world` sends `loot`). */
  lootNews: { news: LootNews[]; at: number } | null;
  /** What the Tavern's jukebox is playing for the room, or null (`world` sends `jukebox`). */
  jukebox: JukeboxNow | null;
  jukeSettings: JukeSettings;
}

let state: HudState = {
  status: "connecting",
  me: null,
  stats: null,
  wallet: null,
  questBoard: null,
  tournament: null,
  raid: null,
  board: [],
  room: "town",
  occupancy: {},
  companies: [],
  chat: [],
  panel: null,
  dialog: null,
  banner: null,
  chatFocus: 0,
  mention: null,
  lootNews: null,
  jukebox: null,
  jukeSettings: loadJukeSettings(),
  notice: null,
  lobby: null,
  frame: null,
  matchChat: [],
  clockSkew: 0,
  inviteTable: null,
  weather: CALM,
};
const listeners = new Set<() => void>();

export const hud = {
  get: () => state,
  set(patch: Partial<HudState> | ((s: HudState) => Partial<HudState>)) {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useHud<T>(select: (s: HudState) => T): T {
  return useSyncExternalStore(hud.subscribe, () => select(state));
}
